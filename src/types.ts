// 新品分仓备货 Demo 类型定义（V4 - 9/9会议修正：多品+预警+统配仓级视图）

// ===== 新品列表项（支持多品选择） =====
export interface NewProductItem {
  id: string;
  name: string;
  launchDate: string;
  status: '进行中' | '计划中';
  stage: string;
  productLevel: string;
  scope: string;
  seriesId: string;  // 同系列品共享相同seriesId，用于多品聚合
}

// ===== 飞书多维表格：新品BOM（1张扁平表，每行=一个新品下的一个原材料） =====
export interface BOMRecord {
  id: string;
  // 新品维度字段（每行冗余）
  productName: string;       // 新品名称
  launchDate: string;        // 上新日
  launchStartDate?: string;  // 上新开始时间（V7.6 新增，飞书表字段）
  launchEndDate?: string;    // 上新结束时间（V7.6 新增，飞书表字段；上新期 1~3 个月）
  // 物料维度字段
  materialName: string;      // 原材料名称
  mergedProductName?: string; // 合并品名（V7.6 新增：同物料多供应商统一维度。门店→仓全链路按合并品名聚合，仅 Step 7 供应商分配才拆 SKU/规格/箱规）
  materialCode: string;      // 原材料编码（可能为空）
  spec: string;              // 规格型号
  unit: string;              // 单位
  unitUsage: number;         // 单位用量
  usageUnit: string;         // 用量单位 (g/ml)
  shelfLifeDays: number;     // 原材料开封效期（天）
  stockCoefficient: number;  // 原材料备货系数
  lossRate: number;          // 损耗率
  /**
   * 多品聚合折算系数（W1-W4 各一个，默认 1＝不加成）。
   *
   * 用途：Step 0 可多选同系列新品，**共用物料的需求量必须按两品加和**（PRD §4.11「多品共用物料时
   * 只能算总偏差（共用物料按系列聚合后统一计算）」）。但引擎里每个物料只有一个席位、杯量基准取
   * 「系列主品」（品1：首周 609 / 首月 650），所以把另一品的需求折成主品基准下的倍数：
   *
   *   factor_n = (品1需求_n + 品2需求_n) ÷ 品1需求_n
   *            = 1 + (杯量2_n × W2_n × 备货系数2) ÷ (杯量1_n × W1_n × 备货系数1)   ← 应用率同物料同损耗时约掉
   *
   * 品2 独有物料（冷冻凤梨汁）反过来：参数用品2 的，杯量按品2/品1 折算 ⇒ factor_n = 杯量2_n ÷ 杯量1_n。
   */
  demandFactors?: [number, number, number, number];
  // W1-W4杯占比（每行冗余，实际值相同）
  cupRatioW1: number;        // 第1周新品杯占比
  cupRatioW2: number;        // 第2周新品杯占比
  cupRatioW3: number;        // 第3周新品杯占比
  cupRatioW4: number;        // 第4周新品杯占比
  /** 该行物料来自哪些新品（多品聚合时展示；单品 BOM 行不写） */
  sourceProducts?: string[];
  // UI状态
  selected: boolean;
}

// ===== 系统自动获取的数据（非表格读取） =====
export interface SystemData {
  storeCount: number;          // 在营门店数（成品销售报表，滚动30天）
  firstWeekDailyCups: number;  // 大盘预测首周日均（上游预测系统）
  firstMonthDailyCups: number; // 大盘预测首月日均（上游预测系统）
  totalSalesMay: number;       // 全国5月总销量（成品销售报表）
}

// 兼容旧代码
export type NewProductInfo = {
  name: string;
  launchDate: string;
  scope: string;
  storeCount: number;
  firstWeekDailyCups: number;
  firstMonthDailyCups: number;
  totalSalesMay: number;
  cupRatioW1: number;
  cupRatioW2: number;
  cupRatioW3: number;
  cupRatioW4: number;
};

export type BOMMaterial = BOMRecord;

export interface RegionCoefficient {
  subsidiary: string;
  rawValue: number;
  coefficient: number;
  isFloored: boolean;
  editable: boolean;
}

export interface StoreForecast {
  storeId: string;
  storeName: string;
  warehouse: string;
  subsidiary: string;
  province: string;
  city: string;
  maySales: number;
  mayDailyAvg: number;
  firstWeekDaily: number;
  monthDaily: number;
  regionCoeff: number;
  salesRatio: number;
  isFloorProtected: boolean;
  w1Cups: number;
  w2Cups: number;
  w3Cups: number;
  w4Cups: number;
  totalCups: number;
  w1Material: number;
  w2Material: number;
  w3Material: number;
  w4Material: number;
  totalMaterial: number;
}

export interface WarehouseAggregation {
  warehouseId: string;
  warehouseName: string;
  warehouseType: '一级仓' | '二级仓';
  coveredStores: number;
  materials: WarehouseMaterialAgg[];
}

export interface WarehouseMaterialAgg {
  materialName: string;
  forecastQty: number;
  allocationQty: number;
  extraStock: number;
  total: number;
  orderQty: number;
  sellableDays: number;
  sourceProducts?: string[];  // 9/9新增：标注该物料来自哪些新品（多品聚合时展示）
  theoreticalQty?: number;    // 9/9新增：理论需求量（不带系数，用于预警偏差计算）
}

export interface SupplierAllocation {
  materialName: string;
  supplierName: string;
  share: number;
  moq: number;
  allocatedQty: number;
  orderQty: number;
}

export interface UnifiedDistribution {
  storeId: string;
  storeName: string;
  warehouse: string;
  materials: { name: string; qty: number }[];
}

// ===== 仓级统配聚合（9/9新增：统配异常按仓维度展示） =====
export interface WarehouseDistributionCompare {
  warehouseName: string;
  forecastQty: number;      // 预测统配量
  actualQty: number;         // 实际统配量
  deviation: number;         // 差异（绝对值）
  deviationPct: number;      // 差异（百分比）
  isAbnormal: boolean;       // 是否异常（预测>统配）
}

export interface Warning {
  level: 'red' | 'yellow' | 'green';
  type: string;
  message: string;
  deviation: number;
  threshold: number;
  suggestion: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  thinking?: string[];
  confirmActions?: ConfirmAction[];
  chips?: string[];
}

export interface ConfirmAction {
  label: string;
  type: 'confirm' | 'edit' | 'skip' | 'recalculate' | 'export' | 'notify' | 'supplier_confirm' | 'supplier_skip';
  value?: string;
}

export type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface WizardState {
  currentStep: WizardStep;
  selectedProducts: string[];  // 9/9：支持多品选择（替代单选）
  bomRecords: BOMRecord[];
  systemData: SystemData;
  regionCoefficients: RegionCoefficient[];
  storeForecasts: StoreForecast[];
  warehouseAggregations: WarehouseAggregation[];
  supplierAllocations: SupplierAllocation[];
  warehouseDistributionCompare?: WarehouseDistributionCompare[];  // 9/9新增
  warnings: Warning[];
  confirmed: boolean;
}

// ===== V7.6：上新期间监控看板（2026-09-24 起：首页自建看板与 24 仓杯量监控行**已删除**） =====
// 彬节：首页的仓库监控数据全部删除（看板里已经有了）→ PRD V7.8 §5.4 明确 6 项监控指标的
// 看板载体＝智能问数看板。原先的 MonitorWarehouseRow / MonitorTrend / TrendPoint（30 天趋势）
// 三个类型随之废弃，监控数据换成下面「二级仓 × 核心物料」的 MonitorSubWhRow。

/**
 * 「新品监控」看板行 —— **二级仓 × 核心物料** 粒度（2026-09-24 彬节口径）。
 *
 * 口径：
 *   · 二级仓＝一级仓下的库区 / 共配仓（PRD §4.10「同一一级仓下的二级仓」；她报表口径里
 *     「一级仓库名称 + 二级仓库名称」成对出现）。一级仓沿用门店底表的 24 个仓，每个仓按库区拆 2 个二级仓。
 *   · 行 = 每种核心物料 × 它落到的所有二级仓（新品核心物料 5 种 → 5 × 24 = 120 行）。
 *   · 备货预测量按「仓覆盖门店 × 单店周备货量」摊（单店周量取自分仓真算的全国预测量 ÷ 门店数 ÷ 4 周）
 *     ⇒ 与分仓流程同一套口径，不是随机数。
 *   · 实际消耗 / 偏差率 / 可售天数为上新期监控值（**演示态**：仓的偏差线 + 物料级偏移）。
 */
export interface MonitorSubWhRow {
  /** 一级仓 */
  wh1: string;
  /** 二级仓（库区 / 共配仓） */
  wh2: string;
  subsidiary: string;
  /** 合并品名 */
  material: string;
  unit: string;
  /** 覆盖门店（＝所属一级仓覆盖门店） */
  coversStores: number;
  /** 备货预测量（该二级仓该物料的周备货量） */
  forecastQty: number;
  /** 实际消耗 */
  actualQty: number;
  /** 偏差率（%） */
  deviationPct: number;
  /** 仓库可售天数 */
  sellableDays: number;
  isDeviationAlert: boolean;
  isStockAlert: boolean;
}

// ===== V7.6 新增：参数面板（所有参数都支持页面直接改） =====
export interface ParamItem {
  key: string;
  name: string;
  granularity: string;
  value: string;
  pageEditable: boolean;    // 页面直接改（所有参数都为 true）
  sheetEditable: boolean;   // 飞书底表里也有该参数 → 底表改后系统 15–20 分钟才读到
  effect: string;           // 生效方式
  numeric?: boolean;        // 演示：可即时编辑的全局数值参数
  unit?: string;
}
