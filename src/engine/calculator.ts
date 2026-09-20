// 计算引擎 - 真实计算函数（V2 - 9/9会议修正：预警公式+多品聚合）
// 用于门店预测、仓库聚合、预警检查、多品物料聚合

import type { BOMRecord, RegionCoefficient, StoreForecast, WarehouseAggregation, WarehouseMaterialAgg, Warning } from '../types';

/**
 * 应用率数据（每杯用量，单位：g/ml）
 * 来源：交互文档中的实际应用率
 */
export const APPLICATION_RATES: Record<string, { w1: number; w2: number; w3: number; w4: number }> = {
  '安溪铁观音': { w1: 270.62, w2: 353.29, w3: 352.41, w4: 362.85 },
  '莲雾苹果汁': { w1: 11.41, w2: 11.41, w3: 11.41, w4: 11.41 },
  '东方美人乌龙茶-A': { w1: 346.15, w2: 346.15, w3: 346.15, w4: 346.15 },
  '老盐糖浆': { w1: 194, w2: 194, w3: 194, w4: 194 },
  '冷冻生椰乳': { w1: 24.25, w2: 24.25, w3: 24.25, w4: 24.25 },
  '冷冻凤梨汁': { w1: 23.04, w2: 23.04, w3: 23.04, w4: 23.04 },
  '椰子水': { w1: 16.17, w2: 16.17, w3: 16.17, w4: 16.17 },
};

/**
 * 生成门店预测数据
 * @param firstWeekDailyCups - 首周日均杯数（大盘预测）
 * @param firstMonthDailyCups - 首月日均杯数（大盘预测）
 * @param regions - 区域系数列表
 * @param materials - BOM物料列表
 * @param storeData - 门店基础数据（5月销量等）
 */
export function generateStoreForecasts(
  firstWeekDailyCups: number,
  firstMonthDailyCups: number,
  regions: RegionCoefficient[],
  materials: BOMRecord[],
  storeData?: { storeId: string; storeName: string; warehouse: string; subsidiary: string; province: string; city: string; maySales: number }[],
): StoreForecast[] {
  if (!storeData || storeData.length === 0) return [];

  const totalMaySales = storeData.reduce((sum, s) => sum + s.maySales, 0);
  const selectedMaterials = materials.filter(m => m.selected);

  return storeData.map(store => {
    const region = regions.find(r => r.subsidiary === store.subsidiary);
    const regionCoeff = region?.coefficient ?? 1.0;
    const salesRatio = totalMaySales > 0 ? store.maySales / totalMaySales : 0;
    const mayDailyAvg = store.maySales / 31; // 5月31天

    // 门店日均杯数预测（基于5月销量占比 × 大盘预测 × 区域系数）
    const firstWeekDaily = firstWeekDailyCups * salesRatio * regionCoeff * storeData.length;
    const monthDaily = firstMonthDailyCups * salesRatio * regionCoeff * storeData.length;

    // 新品杯数（W1-W4，使用杯占比）
    const cupRatioW1 = selectedMaterials[0]?.cupRatioW1 ?? 0.05;
    const cupRatioW2 = selectedMaterials[0]?.cupRatioW2 ?? 0.035;
    const cupRatioW3 = selectedMaterials[0]?.cupRatioW3 ?? 0.022;
    const cupRatioW4 = selectedMaterials[0]?.cupRatioW4 ?? 0.013;

    const w1Cups = Math.round(firstWeekDaily * 7 * cupRatioW1);
    const w2Cups = Math.round(firstWeekDaily * 7 * cupRatioW2);
    const w3Cups = Math.round(monthDaily * 7 * cupRatioW3);
    const w4Cups = Math.round(monthDaily * 7 * cupRatioW4);
    const totalCups = w1Cups + w2Cups + w3Cups + w4Cups;

    // 物料用量计算（基于应用率）
    let w1Material = 0, w2Material = 0, w3Material = 0, w4Material = 0;
    selectedMaterials.forEach(mat => {
      const rate = APPLICATION_RATES[mat.materialName];
      if (rate) {
        w1Material += w1Cups * rate.w1 / 1000; // 转换为kg
        w2Material += w2Cups * rate.w2 / 1000;
        w3Material += w3Cups * rate.w3 / 1000;
        w4Material += w4Cups * rate.w4 / 1000;
      }
    });

    const totalMaterial = w1Material + w2Material + w3Material + w4Material;
    const isFloorProtected = regionCoeff <= 1.0;

    return {
      storeId: store.storeId,
      storeName: store.storeName,
      warehouse: store.warehouse,
      subsidiary: store.subsidiary,
      province: store.province,
      city: store.city,
      maySales: store.maySales,
      mayDailyAvg,
      firstWeekDaily,
      monthDaily,
      regionCoeff,
      salesRatio,
      isFloorProtected,
      w1Cups,
      w2Cups,
      w3Cups,
      w4Cups,
      totalCups,
      w1Material: Math.round(w1Material * 100) / 100,
      w2Material: Math.round(w2Material * 100) / 100,
      w3Material: Math.round(w3Material * 100) / 100,
      w4Material: Math.round(w4Material * 100) / 100,
      totalMaterial: Math.round(totalMaterial * 100) / 100,
    };
  });
}

/**
 * 按仓库聚合门店预测数据
 * @param forecasts - 门店预测列表
 * @param materials - BOM物料列表
 */
export function aggregateToWarehouse(forecasts: StoreForecast[], materials: BOMRecord[]): WarehouseAggregation[] {
  const warehouseMap = new Map<string, { stores: StoreForecast[]; subsidiary: string }>();

  forecasts.forEach(f => {
    const key = f.warehouse;
    if (!warehouseMap.has(key)) {
      warehouseMap.set(key, { stores: [], subsidiary: f.subsidiary });
    }
    warehouseMap.get(key)!.stores.push(f);
  });

  const selectedMaterials = materials.filter(m => m.selected);

  return Array.from(warehouseMap.entries()).map(([warehouseName, { stores, subsidiary: _subsidiary }]) => {
    const materialAggs: WarehouseMaterialAgg[] = selectedMaterials.map(mat => {
      const rate = APPLICATION_RATES[mat.materialName];
      let forecastQty = 0;

      stores.forEach(store => {
        if (rate) {
          forecastQty += (store.w1Cups * rate.w1 + store.w2Cups * rate.w2 + store.w3Cups * rate.w3 + store.w4Cups * rate.w4) / 1000;
        }
      });

      forecastQty = Math.round(forecastQty);
      const allocationQty = 0; // 调拨量需要额外逻辑
      const extraStock = Math.round(forecastQty * (mat.stockCoefficient - 1));
      const total = forecastQty + extraStock;
      const orderQty = Math.ceil(total / 5) * 5; // 向上取整到5的倍数（MOQ简化）
      const sellableDays = mat.shelfLifeDays;

      return {
        materialName: mat.materialName,
        forecastQty,
        allocationQty,
        extraStock,
        total,
        orderQty,
        sellableDays,
      };
    });

    const warehouseType = warehouseName.includes('一级') ? '一级仓' as const : '二级仓' as const;

    return {
      warehouseId: `wh-${warehouseName}`,
      warehouseName,
      warehouseType,
      coveredStores: stores.length,
      materials: materialAggs,
    };
  });
}

/**
 * 检查预警条件（9/9修正：备货偏差 = 分仓计算值 vs 理论需求量）
 * 理论需求量 = 纯预测杯量 × 用量（不带区域系数、不带备货系数）
 * 分仓计算值 = 经过区域系数、备货系数、MOQ取整等修正后的当前备货量
 * @param totalCups - 总预测杯数（带系数）
 * @param theoreticalCups - 理论杯数（不带系数）
 * @param aggregations - 仓库聚合数据
 * @param materials - BOM物料列表
 */
export function checkWarnings(
  totalCups: number,
  theoreticalCups: number,
  aggregations: WarehouseAggregation[],
  materials: BOMRecord[],
): Warning[] {
  const warnings: Warning[] = [];

  // 1. 备货偏差预警：分仓计算值 vs 理论需求量（9/9修正）
  // 理论需求量 = 纯预测杯量 × 用量（不带任何系数）
  // 分仓计算值 = 经过区域系数、备货系数、MOQ取整后的当前备货量
  const deviation = theoreticalCups > 0 ? (totalCups - theoreticalCups) / theoreticalCups : 0;
  if (Math.abs(deviation) > 0.15) {
    warnings.push({
      level: 'red',
      type: 'stock_deviation',
      message: `备货偏差 ${(deviation * 100).toFixed(1)}%（分仓计算值${totalCups} vs 理论需求量${theoreticalCups}），超阈值`,
      deviation,
      threshold: 0.15,
      suggestion: '建议检查区域系数和备货系数是否合理，可尝试调参后重算',
    });
  } else if (Math.abs(deviation) > 0.10) {
    warnings.push({
      level: 'yellow',
      type: 'stock_deviation',
      message: `备货偏差 ${(deviation * 100).toFixed(1)}%（分仓计算值 vs 理论需求量），接近阈值`,
      deviation,
      threshold: 0.10,
      suggestion: '可关注区域系数调整，确认系数推荐是否合理',
    });
  } else {
    warnings.push({
      level: 'green',
      type: 'stock_deviation',
      message: `备货偏差 ${(deviation * 100).toFixed(1)}% ✅（分仓计算值 vs 理论需求量）`,
      deviation,
      threshold: 0.10,
      suggestion: '偏差在合理范围内',
    });
  }

  // 2. 效期预警：检查短效期物料
  materials.filter(m => m.selected).forEach(mat => {
    if (mat.shelfLifeDays <= 7) {
      warnings.push({
        level: 'yellow',
        type: 'shelf_life',
        message: `${mat.materialName} 效期仅${mat.shelfLifeDays}天，需关注到货时间`,
        deviation: 0,
        threshold: 7,
        suggestion: '建议与供应商确认交货周期，确保到货后剩余效期充足',
      });
    }
  });

  // 3. 库存系数预警：过高系数可能导致浪费
  materials.filter(m => m.selected).forEach(mat => {
    if (mat.stockCoefficient > 1.3) {
      warnings.push({
        level: 'yellow',
        type: 'overstock_risk',
        message: `${mat.materialName} 备货系数${mat.stockCoefficient}较高，可能产生库存积压`,
        deviation: mat.stockCoefficient - 1.0,
        threshold: 0.3,
        suggestion: '建议评估历史新品衰减速度，适当降低系数',
      });
    }
  });

  // 4. 仓库覆盖预警
  aggregations.forEach(agg => {
    if (agg.coveredStores > 500) {
      warnings.push({
        level: 'green',
        type: 'warehouse_load',
        message: `${agg.warehouseName} 覆盖${agg.coveredStores}家门店，负荷正常`,
        deviation: 0,
        threshold: 500,
        suggestion: '无需调整',
      });
    }
  });

  return warnings;
}

/**
 * 多品物料聚合（9/9新增：同系列多品的共用物料合并计算）
 * @param allMaterials - 所有新品的BOM物料（含多个品）
 * @returns 按物料编码聚合后的物料列表，标注来源品
 */
export function aggregateMultiProductMaterials(
  allMaterials: BOMRecord[],
): { materialCode: string; materialName: string; sourceProducts: string[]; totalUsage: number; isShared: boolean }[] {
  const materialMap = new Map<string, { materialName: string; sourceProducts: Set<string>; totalUsage: number }>();

  allMaterials.filter(m => m.selected).forEach(mat => {
    const key = mat.materialCode || mat.materialName; // 编码为空时用名称
    const existing = materialMap.get(key);
    if (existing) {
      existing.sourceProducts.add(mat.productName);
      existing.totalUsage += mat.unitUsage;
    } else {
      materialMap.set(key, {
        materialName: mat.materialName,
        sourceProducts: new Set([mat.productName]),
        totalUsage: mat.unitUsage,
      });
    }
  });

  return Array.from(materialMap.entries()).map(([code, data]) => ({
    materialCode: code,
    materialName: data.materialName,
    sourceProducts: Array.from(data.sourceProducts),
    totalUsage: data.totalUsage,
    isShared: data.sourceProducts.size > 1,
  }));
}

/**
 * 计算全国物料汇总
 */
export function calculateNationalSummary(aggregations: WarehouseAggregation[]): { name: string; forecastQty: number; allocationQty: number; extraStock: number; orderQty: number }[] {
  const materialMap = new Map<string, { forecastQty: number; allocationQty: number; extraStock: number; orderQty: number }>();

  aggregations.forEach(agg => {
    agg.materials.forEach(mat => {
      const existing = materialMap.get(mat.materialName) || { forecastQty: 0, allocationQty: 0, extraStock: 0, orderQty: 0 };
      existing.forecastQty += mat.forecastQty;
      existing.allocationQty += mat.allocationQty;
      existing.extraStock += mat.extraStock;
      existing.orderQty += mat.orderQty;
      materialMap.set(mat.materialName, existing);
    });
  });

  return Array.from(materialMap.entries()).map(([name, data]) => ({
    name,
    ...data,
  }));
}
