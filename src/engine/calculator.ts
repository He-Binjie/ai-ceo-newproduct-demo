// 核心公式引擎 — 基于 PRD V5.0
import type { BOMMaterial, RegionCoefficient, StoreForecast, WarehouseAggregation, Warning } from '../types';
import { warehouseStoreMap } from '../data/mock';

/**
 * 计算单店单物料 W1-W4 物料量
 * W1物料量 = 首周日均杯量 × 区域系数 × W1占比 × 7 ÷ 应用率W1 × 备货系数
 * W2-W4物料量 = 月日均杯量 × 区域系数 × Wn占比 × 7 ÷ 应用率Wn × 备货系数
 */
export function calculateMaterialQty(
  material: BOMMaterial,
  firstWeekDailyCups: number,
  firstMonthDailyCups: number,
  regionCoeff: number,
  storeSalesRatio: number,
  storeCount: number,
): { w1: number; w2: number; w3: number; w4: number; total: number } {
  // 门店级日均杯量
  const storeFirstWeekDaily = firstWeekDailyCups * storeSalesRatio * storeCount;
  const storeMonthDaily = firstMonthDailyCups * storeSalesRatio * storeCount;

  const w1 = storeFirstWeekDaily * regionCoeff * material.ratioW1 * 7 / material.applicationRateW1 * material.stockCoefficient;
  const w2 = storeMonthDaily * regionCoeff * material.ratioW2 * 7 / material.applicationRateW2 * material.stockCoefficient;
  const w3 = storeMonthDaily * regionCoeff * material.ratioW3 * 7 / material.applicationRateW3 * material.stockCoefficient;
  const w4 = storeMonthDaily * regionCoeff * material.ratioW4 * 7 / material.applicationRateW4 * material.stockCoefficient;

  const total = Math.round(w1 + w2 + w3 + w4);

  return { w1, w2, w3, w4, total };
}

/**
 * 计算区域系数
 * coefficient = max(salesRatio / nationalAvgRatio, 1.0)
 */
export function calculateRegionCoefficient(salesRatio: number, nationalAvgRatio: number): number {
  return Math.max(salesRatio / nationalAvgRatio, 1.0);
}

/**
 * 汇总门店预测到仓库
 */
export function aggregateToWarehouse(
  storeForecasts: StoreForecast[],
  materials: BOMMaterial[],
): WarehouseAggregation[] {
  return warehouseStoreMap.map(wh => {
    const regionStores = storeForecasts.filter(s => s.region === wh.region);
    const totalForecast = regionStores.reduce((sum, s) => {
      return sum + materials.filter(m => m.selected).reduce((ms, m) => ms + s.totalMaterial, 0);
    }, 0);

    // Mock 统配量（假设为预测量的 70%）
    const allocationQty = Math.round(totalForecast * 0.7);
    const extraStock = Math.max(totalForecast - allocationQty, 0);
    const sellableDays = extraStock > 0 ? Math.round(extraStock / (totalForecast / 28)) : 0;

    // MOQ 取整
    const primaryMaterial = materials.find(m => m.selected);
    const moq = primaryMaterial?.moq || 50;
    const moqRounded = Math.ceil(extraStock / moq) * moq;

    return {
      warehouseId: wh.warehouseId,
      warehouseName: wh.warehouseName,
      coveredStores: wh.coveredStores,
      totalForecast,
      allocationQty,
      extraStock,
      sellableDays,
      moqRounded,
      supplier: '待分配',
    };
  });
}

/**
 * 检查预警
 */
export function checkWarnings(
  totalStockCups: number,
  gmvTargetCups: number,
  warehouseAggs: WarehouseAggregation[],
  materials: BOMMaterial[],
): Warning[] {
  const warnings: Warning[] = [];

  // 第一道：备货偏差 > 10%
  const deviation1 = Math.abs(totalStockCups - gmvTargetCups) / gmvTargetCups;
  if (deviation1 > 0.10) {
    warnings.push({
      level: 'red',
      type: '备货预警',
      message: `全国备货总杯量(${totalStockCups.toLocaleString()})与大盘GMV目标(${gmvTargetCups.toLocaleString()})偏差 ${(deviation1 * 100).toFixed(1)}%，超过10%阈值`,
      deviation: deviation1,
      threshold: 0.10,
      suggestion: '建议调低华东区域系数（2.0→1.8）或备货系数（1.0→0.9）',
    });
  } else {
    warnings.push({
      level: 'green',
      type: '备货预警',
      message: `备货偏差 ${(deviation1 * 100).toFixed(1)}%，在10%阈值内`,
      deviation: deviation1,
      threshold: 0.10,
      suggestion: '无需调整',
    });
  }

  // 第二道：MOQ取整偏差 > 5%
  const totalBeforeMoq = warehouseAggs.reduce((s, w) => s + w.extraStock, 0);
  const totalAfterMoq = warehouseAggs.reduce((s, w) => s + w.moqRounded, 0);
  const deviation2 = totalAfterMoq > 0 ? Math.abs(totalAfterMoq - totalBeforeMoq) / totalBeforeMoq : 0;
  if (deviation2 > 0.05) {
    warnings.push({
      level: 'yellow',
      type: 'MOQ取整预警',
      message: `MOQ取整后总量(${totalAfterMoq.toLocaleString()})与确认总量(${totalBeforeMoq.toLocaleString()})偏差 ${(deviation2 * 100).toFixed(1)}%，超过5%阈值`,
      deviation: deviation2,
      threshold: 0.05,
      suggestion: '建议与供应商协商降低MOQ，或从临近仓库调拨',
    });
  } else {
    warnings.push({
      level: 'green',
      type: 'MOQ取整预警',
      message: `MOQ取整偏差 ${(deviation2 * 100).toFixed(1)}%，在5%阈值内`,
      deviation: deviation2,
      threshold: 0.05,
      suggestion: '无需调整',
    });
  }

  // 安全库存预警
  warehouseAggs.forEach(wh => {
    if (wh.sellableDays < 5 && wh.sellableDays > 0) {
      warnings.push({
        level: 'yellow',
        type: '安全库存预警',
        message: `${wh.warehouseName}可售天数仅${wh.sellableDays}天，低于5天安全线`,
        deviation: wh.sellableDays / 5,
        threshold: 5,
        suggestion: `建议增加${wh.warehouseName}备货量`,
      });
    }
  });

  return warnings;
}

/**
 * 生成门店级预测（简化版，生成代表性门店）
 */
export function generateStoreForecasts(
  firstWeekDailyCups: number,
  firstMonthDailyCups: number,
  regions: RegionCoefficient[],
  materials: BOMMaterial[],
): StoreForecast[] {
  const stores: StoreForecast[] = [];
  const selectedMaterials = materials.filter(m => m.selected);

  // 每个区域生成 2-3 个代表性门店
  const storeTemplates = [
    { suffix: '旗舰店', ratioMultiplier: 1.5 },
    { suffix: '标准店', ratioMultiplier: 1.0 },
    { suffix: '社区店', ratioMultiplier: 0.6 },
  ];

  regions.forEach(region => {
    const baseStoreRatio = region.salesRatio / region.storeCount;

    storeTemplates.forEach((tmpl, idx) => {
      if (idx >= 2 && region.storeCount < 1000) return; // 小区只生成2个

      const storeSalesRatio = baseStoreRatio * tmpl.ratioMultiplier;
      const storeId = `${region.region}-${String(idx + 1).padStart(3, '0')}`;

      let totalMaterial = 0;
      let w1Mat = 0, w2Mat = 0, w3Mat = 0, w4Mat = 0;

      selectedMaterials.forEach(mat => {
        const qty = calculateMaterialQty(mat, firstWeekDailyCups, firstMonthDailyCups, region.coefficient, storeSalesRatio, 1);
        w1Mat += qty.w1;
        w2Mat += qty.w2;
        w3Mat += qty.w3;
        w4Mat += qty.w4;
        totalMaterial += qty.total;
      });

      const storeFirstWeekDaily = firstWeekDailyCups * storeSalesRatio;
      const storeMonthDaily = firstMonthDailyCups * storeSalesRatio;

      stores.push({
        storeId,
        storeName: `${region.subsidiary}${tmpl.suffix}`,
        region: region.region,
        subsidiary: region.subsidiary,
        storeCount: 1,
        salesRatio: storeSalesRatio,
        regionCoeff: region.coefficient,
        w1Cups: Math.round(storeFirstWeekDaily * region.coefficient * 0.05 * 7),
        w2Cups: Math.round(storeMonthDaily * region.coefficient * 0.035 * 7),
        w3Cups: Math.round(storeMonthDaily * region.coefficient * 0.0224 * 7),
        w4Cups: Math.round(storeMonthDaily * region.coefficient * 0.012544 * 7),
        totalCups: 0, // calculated below
        w1Material: w1Mat,
        w2Material: w2Mat,
        w3Material: w3Mat,
        w4Material: w4Mat,
        totalMaterial,
      });
    });
  });

  // Calculate total cups
  stores.forEach(s => {
    s.totalCups = s.w1Cups + s.w2Cups + s.w3Cups + s.w4Cups;
  });

  return stores;
}
