/**
 * 计算输入装配 + 真算 hook（档位 2 · 轻量真算）
 *
 * 职责：把「模块级参数值 store（三入口同源）+ mock 底表」装配成 `CalcParams`，
 *       调 `engine/calculator.ts` 的 `computeAll()`，并按 store 版本号做缓存与「本次改动影响」diff。
 *
 * 铁律：**页面数字的唯一来源**。改参数（页面内联 / 参数面板 / 对话）→ store 版本号 +1 → 所有下游重算。
 * 底表仍为 mock（线上接湖仓）；口径以 PRD V7.8 为准，见 calculator.ts 顶部注释。
 */

import { computeAll, type CalcParams, type CalcResult, type CalcMaterialInput } from './calculator';
import { getPageValue } from '../components/InlineEdit';
import { useValueVersion } from '../components/InlineEdit';
import {
  mockProduct, aggregatedMaterials, mockRegionCoefficients, storeBaseData,
  allWarehouseSummary, supplierRoot,
} from '../data/mock';

/* ============================ 外部数据（不参与重算） ============================ */

/**
 * T-30 统配覆盖率（mock）：真实场景下「统配量」是 T-30 出数的**外部绝对量**，
 * 一旦出数就不再随页面调参变化 —— 所以这里按**基准参数**冻结一次，之后固定。
 * 效果：调参 → 预测量变 → 统配外 / 可销售天数跟着变 → 安全库存预警状态可被调参翻转（可演示）。
 */
const UNIFIED_RATIO: Record<string, number> = {
  '北京二级仓': 0.78, '广东一级仓': 0.74, '上海一级仓': 0.76, '湖北一级仓': 0.72,
  '四川一级仓': 0.75, '浙江一级仓': 0.73, '辽宁一级仓': 0.77, '天津一级仓': 0.71,
};

let frozenUnified: Record<string, number> | null = null;
let freezing = false;

/* ============================ 默认参数（底表原值） ============================ */

function defaultMaterials(): CalcMaterialInput[] {
  // ⚠️ 用**聚合物料清单**（aggregatedMaterials）：Step 0 多选同系列新品时，
  //    Step 2 起全链路按「合并品名」聚合 —— 共用物料只占一个席位、量按 demandFactors 加和。
  return aggregatedMaterials.map(m => ({
    name: m.materialName,
    merged: m.mergedProductName || m.materialName,
    code: m.materialCode,
    unit: m.unit,
    spec: m.spec,
    shelfLifeDays: m.shelfLifeDays,
    stockCoefficient: m.stockCoefficient,
    lossRate: m.lossRate,
    baseLossRate: m.lossRate,
    w: [m.cupRatioW1, m.cupRatioW2, m.cupRatioW3, m.cupRatioW4],
    demandFactors: m.demandFactors,
  }));
}

function warehouseSubsidiary(name: string): string {
  const hit = storeBaseData.find(s => s.wh === name);
  if (hit) return hit.sub;
  return name.replace(/(一级|二级)仓$/, '') + '子公司';
}

function defaultWarehouses() {
  return allWarehouseSummary.map(w => ({
    name: w.warehouseName,
    storeCount: w.storeCount,
    subsidiary: warehouseSubsidiary(w.warehouseName),
  }));
}

/** 供应商分配（底表 mock：只填份额 + MOQ；份额可在页面改） */
function supplierInputs() {
  return supplierRoot.flatMap(g => g.rows.map(([key, share]) => {
    const [material, supplier] = key.split(' / ');
    const moqDefault = MOQ_DEFAULTS[key] ?? 1;
    return {
      merged: g.merged,
      material,
      supplier,
      shareKey: key,
      share: getPageValue('供应商份额', key, share),
      moq: Math.max(1, Math.round(getPageValue('MOQ', key, moqDefault))),
    };
  }));
}

/** MOQ 底表默认值（沿用 V2.15 供应商分配表的 mock 值） */
export const MOQ_DEFAULTS: Record<string, number> = {
  '安溪铁观音-1 / 福建安溪茶业A': 500,
  '安溪铁观音-2 / 云南普洱供应链B': 300,
  '莲雾苹果汁 / 海南果汁工厂C': 200,
  '冷冻生椰乳 / 椰树供应链D': 100,
  '冷冻生椰乳 / 海南椰品E': 100,
  '东方美人乌龙茶-A / 台湾茶业F': 200,
  '冷冻凤梨汁 / 新供应商G（虚拟项）': 1,
};

/* ============================ 装配 ============================ */

function baseParams(): CalcParams {
  const materials = defaultMaterials();
  const suppliers = supplierInputs();

  // 合并品名 → 份额加权 MOQ（§4.10：无 MOQ 时默认 1＝不取整）
  const moqByMerged: Record<string, number> = {};
  const shareSum: Record<string, number> = {};
  const moqSum: Record<string, number> = {};
  suppliers.forEach(s => {
    shareSum[s.merged] = (shareSum[s.merged] || 0) + s.share;
    moqSum[s.merged] = (moqSum[s.merged] || 0) + s.share * s.moq;
  });
  Object.keys(shareSum).forEach(k => {
    moqByMerged[k] = shareSum[k] > 0 ? Math.max(1, Math.round(moqSum[k] / shareSum[k])) : 1;
  });

  return {
    product: {
      name: mockProduct.name,
      launchDate: mockProduct.launchDate,
      storeCount: mockProduct.storeCount,
      firstWeekDailyCups: mockProduct.firstWeekDailyCups,
      firstMonthDailyCups: mockProduct.firstMonthDailyCups,
      totalSalesMay: mockProduct.totalSalesMay,
    },
    materials,
    regions: Object.fromEntries(mockRegionCoefficients.map(r => [r.subsidiary, r.coefficient])),
    warehouses: defaultWarehouses(),
    stores: storeBaseData.map(s => ({
      storeId: s.id, storeName: s.name, warehouse: s.wh, subsidiary: s.sub,
      province: s.prov, city: s.city, maySales: s.sales,
    })),
    unifiedQty: {},
    moqByMerged,
    suppliers,
    safetyStockDays: 7,
    sellDaysN: 7,
    orderDaysN: 7,
    alertDaysN: 7,
  };
}

/** 读参数 store（三入口同源）→ 覆盖默认值 */
export function buildParams(): CalcParams {
  const p = baseParams();
  return {
    ...p,
    materials: p.materials.map(m => ({
      ...m,
      shelfLifeDays: getPageValue('开封效期', m.name, m.shelfLifeDays),
      stockCoefficient: getPageValue('备货系数', m.name, m.stockCoefficient),
      lossRate: getPageValue('损耗率', m.name, m.baseLossRate * 100) / 100,
      w: [
        getPageValue('W1 杯占比', `${m.name}（成品维度）`, m.w[0]),
        getPageValue('W2 杯占比', `${m.name}（成品维度）`, m.w[1]),
        getPageValue('W3 杯占比', `${m.name}（成品维度）`, m.w[2]),
        getPageValue('W4 杯占比', `${m.name}（成品维度）`, m.w[3]),
      ] as [number, number, number, number],
    })),
    regions: Object.fromEntries(
      Object.entries(p.regions).map(([sub, def]) => [sub, getPageValue('区域系数', sub, def)]),
    ),
    unifiedQty: frozenUnifiedQty(),
    safetyStockDays: getPageValue('安全库存天数', '全局', 7),
    sellDaysN: getPageValue('售卖天数 N', '全局', 7),
    orderDaysN: getPageValue('订货天数 N', '全局', 7),
    alertDaysN: getPageValue('预警阈值天数', '全局', 7),
  };
}

/** 冻结基线统配量（只在首次调用时按**默认参数**算一次） */
function frozenUnifiedQty(): Record<string, number> {
  if (frozenUnified) return frozenUnified;
  if (freezing) return {};
  freezing = true;
  const base = computeAll(buildParamsWithoutUnified(), -1);
  const out: Record<string, number> = {};
  base.warehouses.forEach(w => {
    const ratio = UNIFIED_RATIO[w.warehouseName] ?? 0.75;
    w.materials.forEach(m => {
      out[`${m.material}@${w.warehouseName}`] = Math.round(m.forecastQty * ratio);
    });
  });
  frozenUnified = out;
  freezing = false;
  return out;
}

function buildParamsWithoutUnified(): CalcParams {
  const p = baseParams();
  return { ...p, unifiedQty: {} };
}

/* ============================ 缓存 + 影响 diff + hook ============================ */

export type ImpactRow = {
  material: string;
  unit: string;
  before: number;
  after: number;
  deltaPct: number;
  devBefore: number;
  devAfter: number;
};

export type Impact = {
  rows: ImpactRow[];
  alertsBefore: number;
  alertsAfter: number;
  /** 仓级「安全库存校验」不通过数（仓 × 物料），改安全库存天数 N 时只有它变 */
  whSafetyBefore: number;
  whSafetyAfter: number;
};

/** 仓级安全库存不通过数（跟 totals.alertCount 不同：后者是物料级全国加权口径） */
function whSafetyFails(r: CalcResult): number {
  return r.warehouses.reduce((a, w) => a + w.materials.filter(m => !m.safetyPass).length, 0);
}

let cache: { v: number; result: CalcResult } | null = null;
let lastImpact: Impact | null = null;

function diffMaterials(prev: CalcResult, next: CalcResult): Impact {
  const rows: ImpactRow[] = [];
  next.materials.forEach(m => {
    const p = prev.materials.find(x => x.material === m.material);
    if (!p) return;
    if (p.forecastQty === m.forecastQty && p.devPct === m.devPct) return;
    const deltaPct = p.forecastQty > 0 ? ((m.forecastQty - p.forecastQty) / p.forecastQty) * 100 : 0;
    rows.push({
      material: m.material, unit: m.unit,
      before: p.forecastQty, after: m.forecastQty,
      deltaPct: Math.round(deltaPct * 10) / 10,
      devBefore: p.devPct, devAfter: m.devPct,
    });
  });
  rows.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
  return {
    rows: rows.slice(0, 4),
    alertsBefore: prev.totals.alertCount,
    alertsAfter: next.totals.alertCount,
    whSafetyBefore: whSafetyFails(prev),
    whSafetyAfter: whSafetyFails(next),
  };
}

export function getCalc(v: number): CalcResult {
  if (!cache || cache.v !== v) {
    const prev = cache?.result ?? null;
    const next = computeAll(buildParams(), v);
    lastImpact = prev ? diffMaterials(prev, next) : null;
    cache = { v, result: next };
  }
  return cache.result;
}

/** 右侧所有面板共用的真算结果（订阅参数 store；版本变化即重算） */
export function useCalc(): { calc: CalcResult; impact: Impact | null } {
  const v = useValueVersion();
  const calc = getCalc(v);
  return { calc, impact: lastImpact };
}

/** 供非组件代码（脚本化自检）读取 */
export function calcSnapshot(v = 0): CalcResult { return getCalc(v); }