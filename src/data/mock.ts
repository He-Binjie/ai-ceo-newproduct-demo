// 向磊飞书多维表格模板数据（V3 - 1张扁平表「新品BOM」）
import type { BOMRecord, NewProductInfo, RegionCoefficient, StoreForecast, UnifiedDistribution } from '../types';

// ===== 新品列表（Step 0 选择用） =====
export const newProductList = [
  { id: 'np-001', name: '铁观音莲雾苹果', launchDate: '2026-09-15', status: '进行中' as const, stage: 'Step 1 信息读取', productLevel: 'S级', scope: '全国' },
  { id: 'np-002', name: '铁观音凤梨白月光', launchDate: '2026-09-15', status: '进行中' as const, stage: '未开始', productLevel: 'A级', scope: '全国' },
  { id: 'np-003', name: '清沫观音', launchDate: '2026-10-01', status: '计划中' as const, stage: '未开始', productLevel: 'A级', scope: '全国' },
  { id: 'np-004', name: '蜜桃脱咖茉莉', launchDate: '2026-10-15', status: '计划中' as const, stage: '未开始', productLevel: 'B级', scope: '区域' },
];

// ===== 飞书多维表格：新品BOM（向磊模板，15字段，对齐真实表格） =====
export const mockBOMRecords: BOMRecord[] = [
  {
    id: 'recHQ5NH2EgqKL',
    productName: '铁观音莲雾苹果',
    launchDate: '2026-09-15',
    materialName: '安溪铁观音',
    materialCode: '20260901-001',
    spec: '50g/包×50包/箱',
    unit: '箱',
    unitUsage: 5,
    usageUnit: 'g',
    shelfLifeDays: 7,
    stockCoefficient: 1.0,
    lossRate: 0.01,
    cupRatioW1: 0.05,
    cupRatioW2: 0.035,
    cupRatioW3: 0.022,
    cupRatioW4: 0.013,
    selected: true,
  },
  {
    id: 'recv1TFHkkJ9fC',
    productName: '铁观音莲雾苹果',
    launchDate: '2026-09-15',
    materialName: '莲雾苹果汁',
    materialCode: '20260902-002',
    spec: '1kg/瓶×12瓶/箱',
    unit: '箱',
    unitUsage: 15,
    usageUnit: 'g',
    shelfLifeDays: 7,
    stockCoefficient: 1.1,
    lossRate: 0.03,
    cupRatioW1: 0.05,
    cupRatioW2: 0.035,
    cupRatioW3: 0.022,
    cupRatioW4: 0.013,
    selected: true,
  },
  {
    id: 'recL2WNmiqiCoR',
    productName: '铁观音莲雾苹果',
    launchDate: '2026-09-15',
    materialName: '冷冻生椰乳',
    materialCode: '20260903-003',
    spec: '1kg/瓶×15瓶/箱',
    unit: '瓶',
    unitUsage: 20,
    usageUnit: 'g',
    shelfLifeDays: 9,
    stockCoefficient: 1.15,
    lossRate: 0.02,
    cupRatioW1: 0.05,
    cupRatioW2: 0.035,
    cupRatioW3: 0.022,
    cupRatioW4: 0.013,
    selected: true,
  },
  {
    id: 'reccZlrhQV3VC3',
    productName: '铁观音莲雾苹果',
    launchDate: '2026-09-15',
    materialName: '东方美人乌龙茶-A',
    materialCode: '0260815-004',
    spec: '1kg/瓶×12瓶/箱',
    unit: '箱',
    unitUsage: 5,
    usageUnit: 'g',
    shelfLifeDays: 4,
    stockCoefficient: 1.0,
    lossRate: 0.01,
    cupRatioW1: 0.05,
    cupRatioW2: 0.035,
    cupRatioW3: 0.022,
    cupRatioW4: 0.013,
    selected: true,
  },
];

// ===== 系统自动获取（非表格读取） =====
export const mockSystemData = {
  storeCount: 7188,
  firstWeekDailyCups: 609,
  firstMonthDailyCups: 650,
  totalSalesMay: 121169659,
};

// ===== 兼容旧代码的 mockProduct =====
export const mockProduct: NewProductInfo = {
  name: '铁观音莲雾苹果',
  launchDate: '2026-09-15',
  scope: '全国',
  storeCount: 7188,
  firstWeekDailyCups: 609,
  firstMonthDailyCups: 650,
  totalSalesMay: 121169659,
  cupRatioW1: 0.05,
  cupRatioW2: 0.035,
  cupRatioW3: 0.022,
  cupRatioW4: 0.013,
};

// 兼容旧代码
export const mockMaterials = mockBOMRecords;

// ===== 历史上新品列表（23个） =====
export const historicalProducts = [
  '归云南·云漫普洱', '归云南·云卷松风', '归云南', '一抹山月', '月抹静山',
  '白雾红尘', '肉桂橙大红袍', '草莓云顶大红袍', '芒果云顶大红袍',
  '轻因·云游栖梦', '轻因·花田乌龙', '轻因·伯牙绝弦', '轻因·云栖梦',
  '醒时春山', '龙井玄米酪', '海上雾奇兰', '小森林柚子',
  '晴天罗勒桃', '夏梦玫珑', '蜜瓜开心果椰',
  '诶？橙柚康普', '嘿！菠萝马黛', '耶～抹茶龙井',
];

export const historicalProductsDetail = [
  { name: '归云南·云漫普洱', category: '特调茶', launchDate: '2025-12-19', similarity: 0.85 },
  { name: '归云南·云卷松风', category: '特调茶', launchDate: '2025-12-19', similarity: 0.82 },
  { name: '归云南', category: '特调茶', launchDate: '2025-12-19', similarity: 0.80 },
  { name: '一抹山月', category: '鲜奶茶', launchDate: '2026-01-16', similarity: 0.78 },
  { name: '月抹静山', category: '鲜奶茶', launchDate: '2026-01-16', similarity: 0.75 },
  { name: '白雾红尘', category: '特调茶', launchDate: '2026-02-04', similarity: 0.88 },
  { name: '肉桂橙大红袍', category: '特调茶', launchDate: '2026-02-13', similarity: 0.90 },
  { name: '草莓云顶大红袍', category: '特调茶', launchDate: '2026-02-13', similarity: 0.87 },
  { name: '芒果云顶大红袍', category: '特调茶', launchDate: '2026-02-13', similarity: 0.86 },
  { name: '轻因·云游栖梦', category: '轻因系列', launchDate: '2026-03-21', similarity: 0.70 },
  { name: '轻因·花田乌龙', category: '轻因系列', launchDate: '2026-03-21', similarity: 0.68 },
  { name: '轻因·伯牙绝弦', category: '轻因系列', launchDate: '2026-03-21', similarity: 0.65 },
  { name: '轻因·云栖梦', category: '轻因系列', launchDate: '2026-03-21', similarity: 0.63 },
  { name: '醒时春山', category: '鲜奶茶', launchDate: '2026-04-03', similarity: 0.76 },
  { name: '龙井玄米酪', category: '特调茶', launchDate: '2026-04-17', similarity: 0.83 },
  { name: '海上雾奇兰', category: '纯茶', launchDate: '2026-04-17', similarity: 0.72 },
  { name: '小森林柚子', category: '果茶', launchDate: '2026-05-04', similarity: 0.91 },
  { name: '晴天罗勒桃', category: '果茶', launchDate: '2026-05-04', similarity: 0.89 },
  { name: '夏梦玫珑', category: '果茶', launchDate: '2026-05-21', similarity: 0.92 },
  { name: '蜜瓜开心果椰', category: '特调茶', launchDate: '2026-05-21', similarity: 0.84 },
  { name: '诶？橙柚康普', category: '果茶', launchDate: '2026-05-21', similarity: 0.88 },
  { name: '嘿！菠萝马黛', category: '果茶', launchDate: '2026-05-21', similarity: 0.86 },
  { name: '耶～抹茶龙井', category: '特调茶', launchDate: '2026-05-21', similarity: 0.81 },
];

// ===== 区域系数（24个子公司） =====
export const mockRegionCoefficients: RegionCoefficient[] = [
  { subsidiary: '广东子公司', rawValue: 0.821, coefficient: 1.0, isFloored: true, editable: true },
  { subsidiary: '江苏子公司', rawValue: 0.909, coefficient: 1.0, isFloored: true, editable: true },
  { subsidiary: '浙江子公司', rawValue: 1.086, coefficient: 1.086, isFloored: false, editable: true },
  { subsidiary: '安徽子公司', rawValue: 0.985, coefficient: 1.0, isFloored: true, editable: true },
  { subsidiary: '四川子公司', rawValue: 0.996, coefficient: 1.0, isFloored: true, editable: true },
  { subsidiary: '福建子公司', rawValue: 1.060, coefficient: 1.060, isFloored: false, editable: true },
  { subsidiary: '山东子公司', rawValue: 1.025, coefficient: 1.025, isFloored: false, editable: true },
  { subsidiary: '上海子公司', rawValue: 1.072, coefficient: 1.072, isFloored: false, editable: true },
  { subsidiary: '广西子公司', rawValue: 0.825, coefficient: 1.0, isFloored: true, editable: true },
  { subsidiary: '天津子公司', rawValue: 1.090, coefficient: 1.090, isFloored: false, editable: true },
  { subsidiary: '河南子公司', rawValue: 1.003, coefficient: 1.003, isFloored: false, editable: true },
  { subsidiary: '湖北子公司', rawValue: 1.196, coefficient: 1.196, isFloored: false, editable: true },
  { subsidiary: '云南子公司', rawValue: 1.131, coefficient: 1.131, isFloored: false, editable: true },
  { subsidiary: '贵州子公司', rawValue: 1.175, coefficient: 1.175, isFloored: false, editable: true },
  { subsidiary: '陕西子公司', rawValue: 1.162, coefficient: 1.162, isFloored: false, editable: true },
  { subsidiary: '江西子公司', rawValue: 1.050, coefficient: 1.050, isFloored: false, editable: true },
  { subsidiary: '甘青宁子公司', rawValue: 1.056, coefficient: 1.056, isFloored: false, editable: true },
  { subsidiary: '湖南子公司', rawValue: 1.094, coefficient: 1.094, isFloored: false, editable: true },
  { subsidiary: '重庆子公司', rawValue: 1.093, coefficient: 1.093, isFloored: false, editable: true },
  { subsidiary: '北京子公司', rawValue: 0.996, coefficient: 1.0, isFloored: true, editable: true },
  { subsidiary: '辽宁子公司', rawValue: 1.188, coefficient: 1.188, isFloored: false, editable: true },
  { subsidiary: '新疆子公司', rawValue: 0.991, coefficient: 1.0, isFloored: true, editable: true },
  { subsidiary: '海南子公司', rawValue: 0.846, coefficient: 1.0, isFloored: true, editable: true },
  { subsidiary: '山西子公司', rawValue: 1.036, coefficient: 1.036, isFloored: false, editable: true },
];

// ===== 代表性门店数据 =====
export const mockStoreSamples: StoreForecast[] = [
  { storeId: '1101010005', storeName: '北京王府井APM店', warehouse: '北京二级仓', subsidiary: '北京子公司', province: '北京市', city: '北京市', maySales: 29837, mayDailyAvg: 962.48, firstWeekDaily: 1077.92, monthDaily: 1150.49, regionCoeff: 1.0, salesRatio: 0.000246, isFloorProtected: false, w1Cups: 0, w2Cups: 0, w3Cups: 0, w4Cups: 0, totalCups: 0, w1Material: 39.67, w2Material: 29.64, w3Material: 18.97, w4Material: 10.62, totalMaterial: 99 },
  { storeId: '44030708', storeName: '广东深圳龙岗摩尔城店', warehouse: '广东一级仓', subsidiary: '广东子公司', province: '广东省', city: '深圳市', maySales: 36578, mayDailyAvg: 1180.0, firstWeekDaily: 1324.18, monthDaily: 1413.35, regionCoeff: 1.0, salesRatio: 0.000302, isFloorProtected: false, w1Cups: 0, w2Cups: 0, w3Cups: 0, w4Cups: 0, totalCups: 0, w1Material: 48.73, w2Material: 36.41, w3Material: 23.30, w4Material: 13.05, totalMaterial: 122 },
  { storeId: '46010612', storeName: '海南海口阳光城店', warehouse: '海南二级仓', subsidiary: '海南子公司', province: '海南省', city: '海口市', maySales: 30301, mayDailyAvg: 977.45, firstWeekDaily: 1097.18, monthDaily: 1170.97, regionCoeff: 1.0, salesRatio: 0.000250, isFloorProtected: false, w1Cups: 0, w2Cups: 0, w3Cups: 0, w4Cups: 0, totalCups: 0, w1Material: 40.38, w2Material: 30.17, w3Material: 19.31, w4Material: 10.82, totalMaterial: 101 },
  { storeId: '65010307', storeName: '新疆乌鲁木齐七一酱园广场店', warehouse: '新疆二级仓', subsidiary: '新疆子公司', province: '新疆维吾尔自治区', city: '乌鲁木齐市', maySales: 12573, mayDailyAvg: 405.58, firstWeekDaily: 455.26, monthDaily: 485.90, regionCoeff: 1.0, salesRatio: 0.000104, isFloorProtected: false, w1Cups: 0, w2Cups: 0, w3Cups: 0, w4Cups: 0, totalCups: 0, w1Material: 16.75, w2Material: 12.52, w3Material: 8.01, w4Material: 4.49, totalMaterial: 42 },
  { storeId: '62042301', storeName: '甘肃白银景泰三和购物广场店', warehouse: '甘青宁二级仓', subsidiary: '甘青宁子公司', province: '甘肃省', city: '白银市', maySales: 8420, mayDailyAvg: 271.61, firstWeekDaily: 304.88, monthDaily: 325.39, regionCoeff: 1.056, salesRatio: 0.0000695, isFloorProtected: false, w1Cups: 0, w2Cups: 0, w3Cups: 0, w4Cups: 0, totalCups: 0, w1Material: 11.93, w2Material: 9.18, w3Material: 6.12, w4Material: 3.58, totalMaterial: 31 },
];

// ===== 统配数据 =====
export const mockUnifiedDistribution: UnifiedDistribution[] = [
  { storeId: '1101010005', storeName: '北京王府井APM店', warehouse: '北京二级仓', materials: [{ name: '安溪铁观音', qty: 6 }, { name: '莲雾苹果汁', qty: 35 }, { name: '冷冻生椰乳', qty: 12 }] },
  { storeId: '1101010006', storeName: '北京王府井喜悦店', warehouse: '北京二级仓', materials: [{ name: '安溪铁观音', qty: 5 }, { name: '莲雾苹果汁', qty: 35 }, { name: '冷冻生椰乳', qty: 12 }] },
];

// ===== 全国物料汇总（724 Excel） =====
export const nationalMaterialSummary = [
  { name: '安溪铁观音', forecastQty: 66285, allocationQty: 23365, extraStock: 42920, orderQty: 66285 },
  { name: '莲雾苹果汁', forecastQty: 363340, allocationQty: 138786, extraStock: 224554, orderQty: 363540 },
  { name: '东方美人乌龙茶-A', forecastQty: 28585, allocationQty: 0, extraStock: 28585, orderQty: 28655 },
  { name: '老盐糖浆', forecastQty: 24825, allocationQty: 10231, extraStock: 14594, orderQty: 25032 },
  { name: '冷冻生椰乳', forecastQty: 138095, allocationQty: 59779, extraStock: 78316, orderQty: 138345 },
  { name: '冷冻凤梨汁', forecastQty: 128517, allocationQty: 0, extraStock: 128517, orderQty: 128712 },
  { name: '椰子水', forecastQty: 174821, allocationQty: 0, extraStock: 174821, orderQty: 174996 },
];

// ===== 仓库汇总示例 =====
export const warehouseSummarySample = {
  warehouseName: '北京二级仓',
  materials: [
    { name: '安溪铁观音', allocationQty: 589, extraStock: 1539, total: 2128, orderQty: 2128 },
    { name: '莲雾苹果汁', allocationQty: 5154, extraStock: 8245, total: 13399, orderQty: 13404 },
    { name: '东方美人乌龙茶-A', allocationQty: 0, extraStock: 823, total: 823, orderQty: 825 },
    { name: '冷冻生椰乳', allocationQty: 2792, extraStock: 2035, total: 4827, orderQty: 4830 },
  ],
};
