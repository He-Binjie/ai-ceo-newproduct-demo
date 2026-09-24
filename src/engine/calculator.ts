/**
 * 计算引擎（档位 2 · 轻量真算）—— 按 **PRD V7.8** 口径重写，纯函数、无 React 依赖。
 *
 * 依据：茶姬 PRD `SU4PwOYWzid2Tsk0xAVccry4nNb`
 *   §4.2.1 应用率 = 一个采购单位（箱）能产出多少杯饮品
 *   §4.7   W1物料量    = 首周日均杯量 × 区域系数 × W1占比 × 7 ÷ 应用率W1 × 备货系数
 *          W2-W4物料量 = 月日均杯量   × 区域系数 × Wn占比 × 7 ÷ 应用率Wn × 备货系数
 *          预测总量    = Roundup(W1 + W2 + W3 + W4)
 *   §4.8   效期影响周最小量 = round(7 ÷ 开封效期天数)；Wn < 该值则顶到该值（「一周至少备 1 箱」）
 *   §4.9   仓库物料量 = Σ(该仓覆盖的所有门店的物料量)
 *   §4.10  各仓下单量 = ceil(仓库需求量 ÷ MOQ) × MOQ（无 MOQ 默认 1＝不取整）
 *   §4.11  理论需求量 = 纯预测杯量 × 用量（不带备货系数、不带区域系数）
 *          备货偏差率 = (当前分仓计算值 − 理论需求量) ÷ 理论需求量，阈值 10%（超阈值不阻断）
 *   §4.12  MOQ取整偏差率 = (Σ各仓下单量 − 当前分仓计算值) ÷ 当前分仓计算值，阈值 5%
 *   §4.15  安库（日均消耗量） = round(仓维度上新预测总量 ÷ 28)；可销售天数 = 统配外 ÷ 日均消耗；< N 天 → 预警
 *
 * ⚠️ **口径决策（与原 README / 旧 calculator.ts 都不完全一致，需复核）**
 *   - 旧 README 写「÷ 应用率」，旧 `calculator.ts` 实现成「× 应用率 ÷ 1000」——两者必有一错。
 *     本轮**按 PRD §4.7 的除**为准（README 对、旧代码的乘错）。
 *   - PRD §4.2.1 的「真实数据示例」表（安溪铁观音 270.62/353.29/…、莲雾苹果汁 11.41…）当作
 *     **基准应用率（杯/箱，逐周 W1-W4）**；损耗率按 §4.2.1 定义里的 `(1 − 损耗率)` 项等比修正
 *     （基准损耗率＝底表原值）。这样「损耗率改 → 应用率变 → 物料量变」是真的联动，且默认值下
 *     应用率 == PRD 公布值（可逐项核对）。
 *   - 另一种读法是「表里是单杯用量，应用率由规格型号解析出的单位转化量算出」——那会让物料量整体
 *     小两个数量级，与底表的 MOQ / 周可供量量级不匹配，故未采用。如需切换，改
 *     `BASE_RATE_IS_APPLICATION_RATE` 一处即可（见下）。
 */

export const BASE_RATE_IS_APPLICATION_RATE = true;

/** 基准应用率（杯/箱）＝ PRD §4.2.1「真实数据示例」表（W1-W4 逐周） */
export const APPLICATION_RATES: Record<string, { w1: number; w2: number; w3: number; w4: number }> = {
  '安溪铁观音': { w1: 270.62, w2: 353.29, w3: 352.41, w4: 362.85 },
  '莲雾苹果汁': { w1: 11.41, w2: 11.41, w3: 11.41, w4: 11.41 },
  '东方美人乌龙茶-A': { w1: 346.15, w2: 346.15, w3: 346.15, w4: 346.15 },
  '老盐糖浆': { w1: 194, w2: 194, w3: 194, w4: 194 },
  '冷冻生椰乳': { w1: 24.25, w2: 24.25, w3: 24.25, w4: 24.25 },
  '冷冻凤梨汁': { w1: 23.04, w2: 23.04, w3: 23.04, w4: 23.04 },
  '椰子水': { w1: 16.17, w2: 16.17, w3: 16.17, w4: 16.17 },
};

/* ============================ 输入 / 输出类型 ============================ */

export type CalcMaterialInput = {
  name: string;
  merged: string;
  code: string;
  unit: string;
  spec: string;
  /** 开封效期（天） */
  shelfLifeDays: number;
  /** 备货系数 */
  stockCoefficient: number;
  /** 当前损耗率（0–1，页面可改） */
  lossRate: number;
  /** 基准损耗率（0–1，底表原值，用于应用率等比修正） */
  baseLossRate: number;
  /** W1-W4 杯占比（成品维度，同品全物料同值） */
  w: [number, number, number, number];
  /**
   * 多品聚合折算系数（W1-W4，默认 1＝不加成）—— 见 BOMRecord.demandFactors 的口径说明。
   * 多选同系列新品时，共用物料的需求 = 各品需求之和，折成「系列主品杯量基准」下的倍数逐周相乘。
   */
  demandFactors?: [number, number, number, number];
};

export type CalcStoreInput = {
  storeId: string;
  storeName: string;
  warehouse: string;
  subsidiary: string;
  province: string;
  city: string;
  maySales: number;
};

export type CalcWarehouseInput = {
  name: string;
  storeCount: number;
  subsidiary: string;
};

export type CalcProductInput = {
  name: string;
  launchDate: string;
  storeCount: number;
  firstWeekDailyCups: number;
  firstMonthDailyCups: number;
  totalSalesMay: number;
};

export type CalcParams = {
  product: CalcProductInput;
  materials: CalcMaterialInput[];
  /** 子公司 → 区域系数（已含 <1.0 兜底为 1.0） */
  regions: Record<string, number>;
  warehouses: CalcWarehouseInput[];
  /** 门店样本（底表 mock 为 50 家；线上接全量 7,188 家） */
  stores: CalcStoreInput[];
  /** 外部 T-30 统配量（绝对量，按基准参数冻结，不随参数变化）key = `物料@仓` */
  unifiedQty: Record<string, number>;
  /** 供应商份额加权 MOQ，key = 合并品名 */
  moqByMerged: Record<string, number>;
  /** 供应商分配行（用于分配表真算） */
  suppliers: Array<{ merged: string; material: string; supplier: string; shareKey: string; share: number; moq: number }>;
  safetyStockDays: number;
  sellDaysN: number;
  orderDaysN: number;
  alertDaysN: number;
};

export type AppRate = { w1: number; w2: number; w3: number; w4: number };

export type StoreMatRow = {
  material: string;
  unit: string;
  w: [number, number, number, number];
  /** 效期影响周最小量 */
  effMin: number;
  /** 是否被效期下限顶起 */
  effLifted: boolean;
  total: number;
};

export type StoreRow = {
  storeId: string;
  storeName: string;
  warehouse: string;
  subsidiary: string;
  maySales: number;
  salesRatio: number;
  regionCoeff: number;
  isFloorProtected: boolean;
  firstWeekDaily: number;
  monthDaily: number;
  materials: StoreMatRow[];
  totalBoxes: number;
};

export type WhMatRow = {
  material: string;
  merged: string;
  code: string;
  unit: string;
  /** 当前分仓计算值（含区域系数 × 备货系数 × 效期下限） */
  forecastQty: number;
  /** 统配量（外部 T-30） */
  unifiedQty: number;
  /** 统配外 = max(预测 − 统配, 0) */
  unifiedExtra: number;
  /** 合计 = 统配量 + 统配外 */
  total: number;
  moq: number;
  /** 下单量 = ceil(合计 ÷ MOQ) × MOQ */
  orderQty: number;
  /** 安库 = round(仓上新预测总量 ÷ 28) */
  avgDailyConsume: number;
  /** 可销售天数 = 统配外 ÷ 日均消耗 */
  sellableDays: number;
  safetyPass: boolean;
};

export type WhRow = {
  warehouseName: string;
  subsidiary: string;
  storeCount: number;
  regionCoeff: number;
  materials: WhMatRow[];
  /** 仓维度上新预测总量（杯，首月＝W1 周 + W2-W4 三周） */
  forecastCups: number;
  /** 仓备货预测日均杯量 = 预测总量 ÷ 28 */
  forecastDailyCups: number;
};

export type MatRow = {
  material: string;
  merged: string;
  code: string;
  unit: string;
  /** 应用率（杯/箱，逐周） */
  app: AppRate;
  /** W1-W4 杯占比（成品维度，本物料当前取值） */
  w: [number, number, number, number];
  /** 理论需求量（不带任何系数） */
  theoreticalQty: number;
  /** 加系数（未效期）后的全国量 */
  qtyWithCoeff: number;
  /** 当前分仓计算值（含系数 + 效期下限）= 全国预测量 */
  forecastQty: number;
  /** 全国下单量（Σ各仓 MOQ 取整后） */
  orderQty: number;
  unifiedQty: number;
  unifiedExtra: number;
  moq: number;
  /** 备货偏差率（%） */
  devPct: number;
  /** MOQ 取整偏差率（%） */
  moqDevPct: number;
  /** 全国加权可销售天数 */
  safetyDays: number;
  stockPass: boolean;
  moqPass: boolean;
  safetyPass: boolean;
};

export type SupplierAllocRow = {
  merged: string;
  material: string;
  supplier: string;
  share: number;
  moq: number;
  /** 需求分配量 = round(全国合并品名量 × 份额) */
  allocQty: number;
  /** MOQ 取整后 */
  moqQty: number;
};

export type CalcResult = {
  version: number;
  stores: StoreRow[];
  warehouses: WhRow[];
  materials: MatRow[];
  mergedQty: Record<string, number>;
  supplierRows: SupplierAllocRow[];
  totals: {
    storeCount: number;
    materialCount: number;
    /** 备货偏差超阈值的物料数 */
    stockAlertCount: number;
    /** MOQ 取整偏差超阈值的物料数 */
    moqAlertCount: number;
    /** 安全库存不足的物料数 */
    safetyAlertCount: number;
    /** 命中的检测项总数（含 .length 用于 UI 展示） */
    alertCount: number;
    worstMaterial: string;
    totalForecast: number;
    totalOrder: number;
    /** 区域系数加权（Σ 仓门店数 × 系数 ÷ 门店数） */
    coeffWeighted: number;
  };
  breakdown: {
    material: string;
    unit: string;
    theoreticalQty: number;
    forecastQty: number;
    orderQty: number;
    /** Σ各仓「统配量 + 统配外」（MOQ 取整前） */
    total: number;
    coeffLift: number;
    expireLift: number;
    moqLift: number;
    /** 三因素逐项（按贡献绝对值排序，name = 系数 / 效期下限 / MOQ 取整） */
    parts: Array<{ name: string; value: number; share: number; desc: string }>;
    /** 主因：系数 / 效期下限 / MOQ 取整 */
    main: string;
    mainSharePct: number;
    advice: string[];
    /** 备货偏差率（%） */
    devPct: number;
    /** 下单量 − 理论需求量的总量差 */
    totalDelta: number;
  } | null;
};

/* ============================ 公式实现 ============================ */

/** 1) 应用率（杯/箱）：基准应用率 × (1 − 损耗率) ÷ (1 − 基准损耗率) */
export function applicationRateFor(mat: CalcMaterialInput): AppRate {
  const base = APPLICATION_RATES[mat.name];
  const fallback: AppRate = { w1: 100, w2: 100, w3: 100, w4: 100 };
  if (!BASE_RATE_IS_APPLICATION_RATE) return fallback;
  if (!base) return fallback;
  const denom = 1 - mat.baseLossRate;
  const factor = denom > 0 ? (1 - mat.lossRate) / denom : 1;
  return {
    w1: base.w1 * factor,
    w2: base.w2 * factor,
    w3: base.w3 * factor,
    w4: base.w4 * factor,
  };
}

/** §4.8 效期影响周最小量 = round(7 ÷ 开封效期天数)，至少 1 */
export function weekMinQty(shelfLifeDays: number): number {
  const days = shelfLifeDays > 0 ? shelfLifeDays : 1;
  return Math.max(1, Math.round(7 / days));
}

/** 多品聚合折算系数（默认 [1,1,1,1]＝不加成）—— 多选同系列新品时，共用物料需求量 = 各品之和 */
function demandFactorsOf(mat: CalcMaterialInput): [number, number, number, number] {
  return mat.demandFactors ?? [1, 1, 1, 1];
}

/** 单店/单仓口径的 W1-W4 物料量（§4.7 + §4.8），返回 [W1,W2,W3,W4] 与效期标记 */
function weeklyQty(
  firstWeekDaily: number,
  monthDaily: number,
  mat: CalcMaterialInput,
): { w: [number, number, number, number]; effMin: number; effLifted: boolean } {
  const app = applicationRateFor(mat);
  const f = demandFactorsOf(mat);
  const raw: [number, number, number, number] = [
    (firstWeekDaily * mat.w[0] * 7) / app.w1 * mat.stockCoefficient * f[0],
    (monthDaily * mat.w[1] * 7) / app.w2 * mat.stockCoefficient * f[1],
    (monthDaily * mat.w[2] * 7) / app.w3 * mat.stockCoefficient * f[2],
    (monthDaily * mat.w[3] * 7) / app.w4 * mat.stockCoefficient * f[3],
  ];
  const effMin = weekMinQty(mat.shelfLifeDays);
  const lifted = raw.map(v => (v < effMin ? effMin : v)) as [number, number, number, number];
  return { w: lifted, effMin, effLifted: lifted.some((v, i) => v > raw[i]) };
}

/** 2) 门店级：杯量预测 + W1-W4 物料量（§4.5 + §4.7 + §4.8） */
export function calcStoreForecasts(p: CalcParams): StoreRow[] {
  const totalSales = p.product.totalSalesMay;
  return p.stores.map(s => {
    const ratio = totalSales > 0 ? s.maySales / totalSales : 0;
    const rawCoeff = p.regions[s.subsidiary] ?? 1;
    const coeff = Math.max(1, rawCoeff); // §4.2.2 下限 1.0（宁多勿缺）
    const firstWeekDaily = p.product.firstWeekDailyCups * ratio * p.product.storeCount * coeff;
    const monthDaily = p.product.firstMonthDailyCups * ratio * p.product.storeCount * coeff;
    const materials: StoreMatRow[] = p.materials.map(m => {
      const { w, effMin, effLifted } = weeklyQty(firstWeekDaily, monthDaily, m);
      return {
        material: m.name,
        unit: m.unit,
        w,
        effMin,
        effLifted,
        total: Math.ceil(w[0] + w[1] + w[2] + w[3]), // 预测总量 = Roundup(ΣWn)
      };
    });
    return {
      storeId: s.storeId,
      storeName: s.storeName,
      warehouse: s.warehouse,
      subsidiary: s.subsidiary,
      maySales: s.maySales,
      salesRatio: ratio,
      regionCoeff: coeff,
      isFloorProtected: rawCoeff < 1,
      firstWeekDaily,
      monthDaily,
      materials,
      totalBoxes: materials.reduce((a, m) => a + m.total, 0),
    };
  });
}

/**
 * 3) 仓级滚动（§4.9）：仓库物料量 = Σ(该仓覆盖门店的物料量)
 * 底表只有 50 家门店样本且样本偏大 → 用「全国平均店」模型：单店杯量 = 大盘日均 × 区域系数，
 * 仓物料量 = 仓覆盖门店数 × 单店物料量（保证 Σ仓 == 全国，且区域系数改动对仓级生效）。
 */
export function calcWarehouseRollup(p: CalcParams): WhRow[] {
  const mergedOf = (name: string) => p.materials.find(m => m.name === name)?.merged || name;
  const codeOf = (name: string) => p.materials.find(m => m.name === name)?.code || '';
  const unitOf = (name: string) => p.materials.find(m => m.name === name)?.unit || '';

  return p.warehouses.map(wh => {
    const coeff = Math.max(1, p.regions[wh.subsidiary] ?? 1);
    const firstWeekDaily = p.product.firstWeekDailyCups * coeff; // 平均店
    const monthDaily = p.product.firstMonthDailyCups * coeff;

    const materials: WhMatRow[] = p.materials.map(m => {
      const { w } = weeklyQty(firstWeekDaily, monthDaily, m);
      const perStore = Math.ceil(w[0] + w[1] + w[2] + w[3]);
      const forecastQty = perStore * wh.storeCount;
      const key = `${m.name}@${wh.name}`;
      const unifiedQty = p.unifiedQty[key] ?? 0;
      const unifiedExtra = Math.max(forecastQty - unifiedQty, 0);
      const total = unifiedQty + unifiedExtra;
      const moq = p.moqByMerged[m.merged] ?? 1;
      const orderQty = moq > 1 ? Math.ceil(total / moq) * moq : total;
      const avgDailyConsume = Math.round(forecastQty / 28); // §4.15 安库
      const sellableDays = avgDailyConsume > 0 ? unifiedExtra / avgDailyConsume : 0;
      return {
        material: m.name,
        merged: mergedOf(m.name),
        code: codeOf(m.name),
        unit: unitOf(m.name),
        forecastQty,
        unifiedQty,
        unifiedExtra,
        total,
        moq,
        orderQty,
        avgDailyConsume,
        sellableDays: Math.round(sellableDays * 10) / 10,
        safetyPass: sellableDays >= p.safetyStockDays,
      };
    });

    // 仓维度上新预测总量（杯）＝ 首周日均×7 + 月日均×7×3（首月四周）
    const forecastCups = Math.round((firstWeekDaily * 7 + monthDaily * 7 * 3) * wh.storeCount);
    return {
      warehouseName: wh.name,
      subsidiary: wh.subsidiary,
      storeCount: wh.storeCount,
      regionCoeff: coeff,
      materials,
      forecastCups,
      forecastDailyCups: Math.round(forecastCups / 28),
    };
  });
}

/** 4) 物料级汇总：理论需求量 / 当前分仓计算值 / 偏差率 / MOQ 偏差 / 安库（§4.11 / §4.12 / §4.15） */
export function calcMaterialSummary(p: CalcParams, whRows: WhRow[]): MatRow[] {
  const n = p.product.storeCount;
  const mergedOf = (name: string) => p.materials.find(m => m.name === name)?.merged || name;
  const codeOf = (name: string) => p.materials.find(m => m.name === name)?.code || '';
  const unitOf = (name: string) => p.materials.find(m => m.name === name)?.unit || '';

  return p.materials.map(m => {
    const app = applicationRateFor(m);
    const f = demandFactorsOf(m);
    // 理论需求量（不带区域系数、不带备货系数）＝ 单店纯用量 × 门店数（含多品聚合折算：共用物料 = 各品之和）
    const perStoreTheory =
      (p.product.firstWeekDailyCups * m.w[0] * 7) / app.w1 * f[0] +
      (p.product.firstMonthDailyCups * m.w[1] * 7) / app.w2 * f[1] +
      (p.product.firstMonthDailyCups * m.w[2] * 7) / app.w3 * f[2] +
      (p.product.firstMonthDailyCups * m.w[3] * 7) / app.w4 * f[3];
    const theoreticalQty = Math.round(perStoreTheory * n);

    const mats = whRows.map(w => w.materials.find(x => x.material === m.name)!);
    const forecastQty = mats.reduce((a, x) => a + x.forecastQty, 0);
    const orderQty = mats.reduce((a, x) => a + x.orderQty, 0);
    const unifiedQty = mats.reduce((a, x) => a + x.unifiedQty, 0);
    const unifiedExtra = mats.reduce((a, x) => a + x.unifiedExtra, 0);
    const total = mats.reduce((a, x) => a + x.total, 0);
    const dailySum = mats.reduce((a, x) => a + x.avgDailyConsume, 0);

    // 加系数后（未效期）：用区域系数加权 + 备货系数还原，仅用于偏差来源拆解
    const coeffWeighted = p.warehouses.reduce((a, w) => a + w.storeCount * Math.max(1, p.regions[w.subsidiary] ?? 1), 0) /
      Math.max(1, p.warehouses.reduce((a, w) => a + w.storeCount, 0));
    const qtyWithCoeff = Math.round(perStoreTheory * coeffWeighted * m.stockCoefficient * n);

    const devPct = theoreticalQty > 0 ? ((forecastQty - theoreticalQty) / theoreticalQty) * 100 : 0;
    const moqDevPct = total > 0 ? ((orderQty - total) / total) * 100 : 0;
    const safetyDays = dailySum > 0 ? unifiedExtra / dailySum : 0;

    return {
      material: m.name,
      merged: mergedOf(m.name),
      code: codeOf(m.name),
      unit: unitOf(m.name),
      app,
      w: m.w,
      theoreticalQty,
      qtyWithCoeff,
      forecastQty,
      orderQty,
      unifiedQty,
      unifiedExtra,
      moq: p.moqByMerged[m.merged] ?? 1,
      devPct: Math.round(devPct * 10) / 10,
      moqDevPct: Math.round(moqDevPct * 100) / 100,
      safetyDays: Math.round(safetyDays * 10) / 10,
      stockPass: Math.abs(devPct) <= 10,
      moqPass: moqDevPct <= 5,
      safetyPass: safetyDays >= p.safetyStockDays,
    };
  });
}

/** 5) 检测项汇总（§5 预警体系 · A 类计算过程检测：不推送、不阻断） */
export function checkWarnings(rows: MatRow[]): { stock: MatRow[]; moq: MatRow[]; safety: MatRow[] } {
  return {
    stock: rows.filter(r => !r.stockPass),
    moq: rows.filter(r => !r.moqPass),
    safety: rows.filter(r => !r.safetyPass),
  };
}

/* ============================ 编排 ============================ */

export function computeAll(p: CalcParams, version = 0): CalcResult {
  const stores = calcStoreForecasts(p);
  const warehouses = calcWarehouseRollup(p);
  const materials = calcMaterialSummary(p, warehouses);
  const warns = checkWarnings(materials);

  const storeSum = p.warehouses.reduce((a, w) => a + w.storeCount, 0);
  const coeffWeighted = storeSum > 0
    ? p.warehouses.reduce((a, w) => a + w.storeCount * Math.max(1, p.regions[w.subsidiary] ?? 1), 0) / storeSum
    : 1;

  const mergedQty: Record<string, number> = {};
  materials.forEach(m => { mergedQty[m.merged] = (mergedQty[m.merged] || 0) + m.forecastQty; });

  const supplierRows: SupplierAllocRow[] = p.suppliers.map(s => {
    const base = mergedQty[s.merged] || 0;
    const allocQty = Math.round(base * (s.share / 100));
    const moqQty = s.moq > 1 ? Math.ceil(allocQty / s.moq) * s.moq : allocQty;
    return { merged: s.merged, material: s.material, supplier: s.supplier, share: s.share, moq: s.moq, allocQty, moqQty };
  });

  // 偏差来源拆解：取 |备货偏差率| 最大的物料（系数 / 效期下限 / MOQ 取整 三因素精确分解）
  const worst = [...materials].sort((a, b) => Math.abs(b.devPct) - Math.abs(a.devPct))[0];
  const worstMat = worst ? p.materials.find(m => m.name === worst.material) : undefined;
  const breakdown: CalcResult['breakdown'] = worst && worstMat ? (() => {
    const whMats = warehouses.map(w => w.materials.find(x => x.material === worst.material)!);
    // 「加系数、未效期」的全国量 = Σ 仓（单店 W1-W4 原始量 × 仓门店数）
    const app = applicationRateFor(worstMat);
    const wf = demandFactorsOf(worstMat);
    const qtyNoExpire = warehouses.reduce((a, w) => {
      const c = w.regionCoeff;
      const perStore =
        (p.product.firstWeekDailyCups * c * worstMat.w[0] * 7) / app.w1 * worstMat.stockCoefficient * wf[0] +
        (p.product.firstMonthDailyCups * c * worstMat.w[1] * 7) / app.w2 * worstMat.stockCoefficient * wf[1] +
        (p.product.firstMonthDailyCups * c * worstMat.w[2] * 7) / app.w3 * worstMat.stockCoefficient * wf[2] +
        (p.product.firstMonthDailyCups * c * worstMat.w[3] * 7) / app.w4 * worstMat.stockCoefficient * wf[3];
      return a + perStore * w.storeCount;
    }, 0);
    const rQtyNoExpire = Math.round(qtyNoExpire);
    const coeffLift = rQtyNoExpire - worst.theoreticalQty;
    const expireLift = worst.forecastQty - rQtyNoExpire;
    const orderTotal = whMats.reduce((a, x) => a + x.total, 0);
    const moqLift = worst.orderQty - orderTotal;
    const totalDelta = worst.orderQty - worst.theoreticalQty;
    const effMin = weekMinQty(worstMat.shelfLifeDays);
    const parts = [
      { name: '系数', value: Math.abs(coeffLift), desc: `区域系数加权 ${coeffWeighted.toFixed(3)} × 备货系数 ${worstMat.stockCoefficient}` },
      { name: '效期下限', value: Math.abs(expireLift), desc: `部分仓周物料量被开封效期最小量顶起（效期 ${worstMat.shelfLifeDays} 天 → 每周至少 ${effMin} 箱）` },
      { name: 'MOQ 取整', value: Math.abs(moqLift), desc: `各仓按 MOQ ${worst.moq} 向上取整放大` },
    ].sort((a, b) => b.value - a.value);
    const sumAbs = parts.reduce((a, x) => a + x.value, 0) || 1;
    const withShare = parts.map(x => ({ ...x, share: Math.round((x.value / sumAbs) * 1000) / 10 }));
    const main = parts[0].name;
    const mainSharePct = Math.round((parts[0].value / sumAbs) * 1000) / 10;
    const topRegions = warehouses
      .map(w => ({ sub: w.subsidiary, c: p.regions[w.subsidiary] ?? 1 }))
      .sort((a, b) => b.c - a.c)
      .slice(0, 2);
    const advice: string[] = [];
    if (main === '系数') {
      advice.push(`① 优先调区域系数 —— ${topRegions.map(x => `${x.sub.replace('子公司', '')} ${x.c} → 1.10`).join('、')}（预计偏差降到 10% 以内）`);
      advice.push(`② 其次调备货系数（物料级）—— 偏差近似按倍数线性收窄`);
    } else if (main === '效期下限') {
      advice.push(`① 效期下限主导 → 调区域系数 / 备货系数无效：该物料每周至少备 ${effMin} 箱，小量仓会被顶起`);
      advice.push(`② 应与供应商协商更小包装规格 / 延长开封效期，或按合并品名跨仓合并下单`);
    } else {
      advice.push(`① MOQ 取整主导 → 与供应商协商降低 MOQ（当前 ${worst.moq}），或按合并品名跨仓凑单`);
      advice.push(`② 调区域系数只能小幅收窄（取整放大量不随系数等比变化）`);
    }
    return {
      material: worst.material,
      unit: worst.unit,
      theoreticalQty: worst.theoreticalQty,
      forecastQty: worst.forecastQty,
      orderQty: worst.orderQty,
      total: orderTotal,
      coeffLift,
      expireLift,
      moqLift,
      parts: withShare,
      main,
      mainSharePct,
      advice,
      devPct: worst.devPct,
      totalDelta,
    };
  })() : null;

  const alertCount = warns.stock.length + warns.moq.length + warns.safety.length;

  return {
    version,
    stores,
    warehouses,
    materials,
    mergedQty,
    supplierRows,
    totals: {
      storeCount: p.warehouses.reduce((a, w) => a + w.storeCount, 0),
      materialCount: materials.length,
      stockAlertCount: warns.stock.length,
      moqAlertCount: warns.moq.length,
      safetyAlertCount: warns.safety.length,
      alertCount,
      worstMaterial: worst?.material || '—',
      totalForecast: materials.reduce((a, m) => a + m.forecastQty, 0),
      totalOrder: materials.reduce((a, m) => a + m.orderQty, 0),
      coeffWeighted: Math.round(coeffWeighted * 1000) / 1000,
    },
    breakdown,
  };
}
