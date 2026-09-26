// 向磊飞书多维表格模板数据（V4 - 9/9会议修正：多品+预警+统配仓级视图）
import type { BOMRecord, NewProductInfo, RegionCoefficient, StoreForecast, UnifiedDistribution, WarehouseDistributionCompare, MonitorSubWhRow, ParamItem } from '../types';

// ===== 新品列表（Step 0 选择用） =====
export const newProductList = [
  { id: 'np-001', name: '铁观音莲雾苹果', launchDate: '2026-09-15', status: '进行中' as const, stage: 'Step 1 信息读取', productLevel: 'S级', scope: '全国', seriesId: 'series-tieguanyin' },
  { id: 'np-002', name: '铁观音凤梨白月光', launchDate: '2026-09-15', status: '进行中' as const, stage: '未开始', productLevel: 'A级', scope: '全国', seriesId: 'series-tieguanyin' },
  { id: 'np-003', name: '清沫观音', launchDate: '2026-10-01', status: '计划中' as const, stage: '未开始', productLevel: 'A级', scope: '全国', seriesId: 'series-qingmo' },
  { id: 'np-004', name: '蜜桃脱咖茉莉', launchDate: '2026-10-15', status: '计划中' as const, stage: '未开始', productLevel: 'B级', scope: '区域', seriesId: 'series-mitao' },
];

// ===== 飞书多维表格：新品BOM（向磊模板，15字段，对齐真实表格） =====
export const mockBOMRecords: BOMRecord[] = [
  {
    id: 'recHQ5NH2EgqKL',
    productName: '铁观音莲雾苹果',
    launchDate: '2026-09-15',
    launchStartDate: '2026-09-15',
    launchEndDate: '2026-10-14',
    materialName: '安溪铁观音',
    mergedProductName: '安溪铁观音',
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
    launchStartDate: '2026-09-15',
    launchEndDate: '2026-10-14',
    materialName: '莲雾苹果汁',
    mergedProductName: '莲雾苹果汁',
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
    launchStartDate: '2026-09-15',
    launchEndDate: '2026-10-14',
    materialName: '冷冻生椰乳',
    mergedProductName: '冷冻生椰乳',
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
    launchStartDate: '2026-09-15',
    launchEndDate: '2026-10-14',
    materialName: '东方美人乌龙茶-A',
    mergedProductName: '东方美人乌龙茶',
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

// ===== 第二品BOM（铁观音凤梨白月光，与第一品共用安溪铁观音） =====
export const mockBOMRecordsProduct2: BOMRecord[] = [
  {
    id: 'recP2-001',
    productName: '铁观音凤梨白月光',
    launchDate: '2026-09-15',
    launchStartDate: '2026-09-15',
    launchEndDate: '2026-10-14',
    materialName: '安溪铁观音',  // 共用物料
    mergedProductName: '安溪铁观音',
    materialCode: '20260901-001',
    spec: '50g/包×50包/箱',
    unit: '箱',
    unitUsage: 4,
    usageUnit: 'g',
    shelfLifeDays: 7,
    stockCoefficient: 1.0,
    lossRate: 0.01,
    cupRatioW1: 0.04,
    cupRatioW2: 0.03,
    cupRatioW3: 0.02,
    cupRatioW4: 0.01,
    selected: true,
  },
  {
    id: 'recP2-002',
    productName: '铁观音凤梨白月光',
    launchDate: '2026-09-15',
    launchStartDate: '2026-09-15',
    launchEndDate: '2026-10-14',
    materialName: '冷冻凤梨汁',
    mergedProductName: '冷冻凤梨汁',
    materialCode: '20260904-005',
    spec: '1kg/瓶×12瓶/箱',
    unit: '箱',
    unitUsage: 20,
    usageUnit: 'g',
    shelfLifeDays: 14,
    stockCoefficient: 1.05,
    lossRate: 0.02,
    cupRatioW1: 0.04,
    cupRatioW2: 0.03,
    cupRatioW3: 0.02,
    cupRatioW4: 0.01,
    selected: true,
  },
  {
    id: 'recP2-003',
    productName: '铁观音凤梨白月光',
    launchDate: '2026-09-15',
    launchStartDate: '2026-09-15',
    launchEndDate: '2026-10-14',
    materialName: '冷冻生椰乳',  // 共用物料
    mergedProductName: '冷冻生椰乳',
    materialCode: '20260903-003',
    spec: '1kg/瓶×15瓶/箱',
    unit: '瓶',
    unitUsage: 15,
    usageUnit: 'g',
    shelfLifeDays: 9,
    stockCoefficient: 1.15,
    lossRate: 0.02,
    cupRatioW1: 0.04,
    cupRatioW2: 0.03,
    cupRatioW3: 0.02,
    cupRatioW4: 0.01,
    selected: true,
  },
];

// ===== 第二品系统数据 =====
export const mockSystemDataProduct2 = {
  storeCount: 7188,
  firstWeekDailyCups: 580,
  firstMonthDailyCups: 620,
  totalSalesMay: 121169659,
};

/* ===================== 多品聚合物料清单（Step 2 起的「合并品名」口径） =====================
 *
 * 彬节 2026-09-24：「两个新品按 BOM 物料拆分并加和的结果表」—— Step 0 可多选同系列新品，
 * Step 2 起全链路按**合并品名**聚合（PRD §4.11：多品共用物料只能算总偏差，按系列聚合后统一比对）。
 *
 * 所以这张表 = 两个新品 BOM 的并集去重 + 共用物料需求加和：
 *   安溪铁观音（两品共用）｜ 冷冻生椰乳（两品共用）｜ 莲雾苹果汁（品1）｜ 东方美人乌龙茶-A（品1）｜ 冷冻凤梨汁（品2）
 * ⇒ 5 种核心物料；**共用物料只出现一行**，其量 = 品1 需求 + 品2 需求。
 *
 * 参数（用量 / W1-W4 杯占 / 损耗 / 开封效期 / 备货系数）取**该物料的系列基准值**；
 * 另一品的需求通过 `demandFactors`（见 types.ts 注释）折算成基准品倍数，逐周进入引擎的 W1-W4。
 *
 * 折算数（杯量：品1 首周 609 / 首月 650；品2 首周 580 / 首月 620；备货系数 铁观音 1.0 / 生椰乳 1.15 两品同值）：
 *   共用物料 factor_n = 1 + (杯量2_n × W2_n) ÷ (杯量1_n × W1_n)
 *     W1: 1 + (580×0.04)/(609×0.05) = 1.761905
 *     W2: 1 + (620×0.03)/(650×0.035) = 1.817582
 *     W3: 1 + (620×0.02)/(650×0.022) = 1.867133
 *     W4: 1 + (620×0.01)/(650×0.013) = 1.733728
 *   品2 独有（冷冻凤梨汁）factor_n = 杯量2_n ÷ 杯量1_n
 *     W1: 580/609 = 0.952381；W2-W4: 620/650 = 0.953846
 *
 * ⚠️ 用量（20g/杯 等）**不参与引擎计算** —— 应用率（杯/箱）已经含了「单杯用量 × 损耗」，
 *    这里是展示字段（供业务方对照 BOM 表），共用物料显示系列主品的值。
 * ⚠️ 改物料集合/加品时要同步：APPLICATION_RATES（calculator.ts）、MOQ_DEFAULTS + supplierRoot（供应商侧）。
 */
export const aggregatedMaterials: BOMRecord[] = [
  {
    ...mockBOMRecords[0], // 安溪铁观音（两品共用，量已加和）
    id: 'agg-001',
    productName: '铁观音莲雾苹果 + 铁观音凤梨白月光（聚合）',
    sourceProducts: ['铁观音莲雾苹果', '铁观音凤梨白月光'],
    demandFactors: [1.761905, 1.817582, 1.867133, 1.733728],
  } as BOMRecord,
  {
    ...mockBOMRecords[1], // 莲雾苹果汁（仅品1）
    id: 'agg-002',
    productName: '铁观音莲雾苹果（聚合）',
    sourceProducts: ['铁观音莲雾苹果'],
    demandFactors: [1, 1, 1, 1],
  } as BOMRecord,
  {
    ...mockBOMRecords[2], // 冷冻生椰乳（两品共用，量已加和）
    id: 'agg-003',
    productName: '铁观音莲雾苹果 + 铁观音凤梨白月光（聚合）',
    sourceProducts: ['铁观音莲雾苹果', '铁观音凤梨白月光'],
    demandFactors: [1.761905, 1.817582, 1.867133, 1.733728],
  } as BOMRecord,
  {
    ...mockBOMRecords[3], // 东方美人乌龙茶-A（仅品1）
    id: 'agg-004',
    productName: '铁观音莲雾苹果（聚合）',
    sourceProducts: ['铁观音莲雾苹果'],
    demandFactors: [1, 1, 1, 1],
  } as BOMRecord,
  {
    // 冷冻凤梨汁（仅品2）—— 参数取品2 BOM，杯量按品2/品1 折算
    ...mockBOMRecordsProduct2[1],
    id: 'agg-005',
    productName: '铁观音凤梨白月光（聚合）',
    sourceProducts: ['铁观音凤梨白月光'],
    demandFactors: [0.952381, 0.953846, 0.953846, 0.953846],
  } as BOMRecord,
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

// ===== 区域系数计算过程：每个历史品在每个子公司的实际销量占比比值（9/9修正） =====
// 展示用：选取5个代表性子公司 × 23个历史品的实际销量占比比值（子公司新品占比/全国新品占比）
export const regionCalcProcess = {
  // 展示5个代表性子公司（含兜底和非兜底）
  sampleSubs: ['湖北子公司', '广东子公司', '浙江子公司', '北京子公司', '辽宁子公司'],
  // 23个历史品在这些子公司的实际销量占比比值（子公司新品占比/全国新品占比，9/9修正）
  data: [
    { name: '归云南·云漫普洱',    hubei: 1.210, guangdong: 0.830, zhejiang: 1.090, beijing: 1.010, liaoning: 1.200 },
    { name: '归云南·云卷松风',    hubei: 1.180, guangdong: 0.810, zhejiang: 1.070, beijing: 0.980, liaoning: 1.170 },
    { name: '归云南',             hubei: 1.220, guangdong: 0.840, zhejiang: 1.100, beijing: 1.020, liaoning: 1.210 },
    { name: '一抹山月',           hubei: 1.190, guangdong: 0.800, zhejiang: 1.080, beijing: 0.990, liaoning: 1.180 },
    { name: '月抹静山',           hubei: 1.200, guangdong: 0.820, zhejiang: 1.060, beijing: 1.000, liaoning: 1.190 },
    { name: '白雾红尘',           hubei: 1.180, guangdong: 0.850, zhejiang: 1.090, beijing: 1.010, liaoning: 1.200 },
    { name: '肉桂橙大红袍',       hubei: 1.210, guangdong: 0.830, zhejiang: 1.100, beijing: 0.990, liaoning: 1.180 },
    { name: '草莓云顶大红袍',     hubei: 1.190, guangdong: 0.810, zhejiang: 1.080, beijing: 1.000, liaoning: 1.190 },
    { name: '芒果云顶大红袍',     hubei: 1.200, guangdong: 0.840, zhejiang: 1.070, beijing: 0.980, liaoning: 1.170 },
    { name: '轻因·云游栖梦',      hubei: 1.170, guangdong: 0.790, zhejiang: 1.060, beijing: 0.970, liaoning: 1.160 },
    { name: '轻因·花田乌龙',      hubei: 1.180, guangdong: 0.800, zhejiang: 1.050, beijing: 0.990, liaoning: 1.180 },
    { name: '轻因·伯牙绝弦',      hubei: 1.190, guangdong: 0.820, zhejiang: 1.080, beijing: 1.010, liaoning: 1.190 },
    { name: '轻因·云栖梦',        hubei: 1.200, guangdong: 0.810, zhejiang: 1.070, beijing: 0.980, liaoning: 1.170 },
    { name: '醒时春山',           hubei: 1.210, guangdong: 0.830, zhejiang: 1.090, beijing: 1.000, liaoning: 1.200 },
    { name: '龙井玄米酪',         hubei: 1.180, guangdong: 0.840, zhejiang: 1.100, beijing: 1.010, liaoning: 1.180 },
    { name: '海上雾奇兰',         hubei: 1.190, guangdong: 0.820, zhejiang: 1.080, beijing: 0.990, liaoning: 1.190 },
    { name: '小森林柚子',         hubei: 1.220, guangdong: 0.850, zhejiang: 1.110, beijing: 1.020, liaoning: 1.210 },
    { name: '晴天罗勒桃',         hubei: 1.200, guangdong: 0.830, zhejiang: 1.090, beijing: 1.000, liaoning: 1.200 },
    { name: '夏梦玫珑',           hubei: 1.210, guangdong: 0.840, zhejiang: 1.100, beijing: 1.010, liaoning: 1.190 },
    { name: '蜜瓜开心果椰',       hubei: 1.180, guangdong: 0.810, zhejiang: 1.070, beijing: 0.980, liaoning: 1.180 },
    { name: '诶？橙柚康普',       hubei: 1.190, guangdong: 0.820, zhejiang: 1.080, beijing: 1.000, liaoning: 1.190 },
    { name: '嘿！菠萝马黛',       hubei: 1.200, guangdong: 0.830, zhejiang: 1.090, beijing: 0.990, liaoning: 1.200 },
    { name: '耶～抹茶龙井',       hubei: 1.180, guangdong: 0.800, zhejiang: 1.060, beijing: 0.980, liaoning: 1.170 },
  ],
};

// ===== 全部门店数据（50条mock，支持分页；档位 2 起由 engine/calcInput.ts 直接消费做真算） =====
export const storeBaseData: Array<{ id: string; name: string; wh: string; sub: string; prov: string; city: string; sales: number }> = [
  { id: '1101010005', name: '北京王府井APM店', wh: '北京二级仓', sub: '北京子公司', prov: '北京市', city: '北京市', sales: 29837 },
  { id: '44030708', name: '广东深圳龙岗摩尔城店', wh: '广东一级仓', sub: '广东子公司', prov: '广东省', city: '深圳市', sales: 36578 },
  { id: '46010612', name: '海南海口阳光城店', wh: '海南二级仓', sub: '海南子公司', prov: '海南省', city: '海口市', sales: 30301 },
  { id: '65010307', name: '新疆乌鲁木齐七一酱园广场店', wh: '新疆二级仓', sub: '新疆子公司', prov: '新疆维吾尔自治区', city: '乌鲁木齐市', sales: 12573 },
  { id: '62042301', name: '甘肃白银景泰三和购物广场店', wh: '甘青宁二级仓', sub: '甘青宁子公司', prov: '甘肃省', city: '白银市', sales: 8420 },
  { id: '31010501', name: '上海南京西路店', wh: '上海一级仓', sub: '上海子公司', prov: '上海市', city: '上海市', sales: 34521 },
  { id: '33010201', name: '杭州西湖银泰店', wh: '浙江一级仓', sub: '浙江子公司', prov: '浙江省', city: '杭州市', sales: 31205 },
  { id: '32010501', name: '南京新街口店', wh: '江苏一级仓', sub: '江苏子公司', prov: '江苏省', city: '南京市', sales: 28940 },
  { id: '51010401', name: '成都春熙路店', wh: '四川一级仓', sub: '四川子公司', prov: '四川省', city: '成都市', sales: 33102 },
  { id: '42010201', name: '武汉江汉路店', wh: '湖北一级仓', sub: '湖北子公司', prov: '湖北省', city: '武汉市', sales: 35678 },
  { id: '50010301', name: '重庆解放碑店', wh: '重庆一级仓', sub: '重庆子公司', prov: '重庆市', city: '重庆市', sales: 30112 },
  { id: '43010401', name: '长沙五一广场店', wh: '湖南一级仓', sub: '湖南子公司', prov: '湖南省', city: '长沙市', sales: 29450 },
  { id: '35010201', name: '福州东街口店', wh: '福建一级仓', sub: '福建子公司', prov: '福建省', city: '福州市', sales: 27830 },
  { id: '37010201', name: '济南泉城路店', wh: '山东一级仓', sub: '山东子公司', prov: '山东省', city: '济南市', sales: 26540 },
  { id: '21010201', name: '沈阳中街店', wh: '辽宁一级仓', sub: '辽宁子公司', prov: '辽宁省', city: '沈阳市', sales: 25890 },
  { id: '12010101', name: '天津滨江道店', wh: '天津一级仓', sub: '天津子公司', prov: '天津市', city: '天津市', sales: 28120 },
  { id: '61010201', name: '西安钟楼店', wh: '陕西一级仓', sub: '陕西子公司', prov: '陕西省', city: '西安市', sales: 31450 },
  { id: '53010201', name: '昆明南屏街店', wh: '云南一级仓', sub: '云南子公司', prov: '云南省', city: '昆明市', sales: 29780 },
  { id: '52010201', name: '贵阳花果园店', wh: '贵州一级仓', sub: '贵州子公司', prov: '贵州省', city: '贵阳市', sales: 27340 },
  { id: '36010201', name: '南昌中山路店', wh: '江西一级仓', sub: '江西子公司', prov: '江西省', city: '南昌市', sales: 24560 },
  { id: '34010201', name: '合肥淮河路店', wh: '安徽一级仓', sub: '安徽子公司', prov: '安徽省', city: '合肥市', sales: 25120 },
  { id: '45010201', name: '南宁朝阳广场店', wh: '广西一级仓', sub: '广西子公司', prov: '广西壮族自治区', city: '南宁市', sales: 23890 },
  { id: '41010201', name: '郑州二七广场店', wh: '河南一级仓', sub: '河南子公司', prov: '河南省', city: '郑州市', sales: 27650 },
  { id: '14010201', name: '太原柳巷店', wh: '山西一级仓', sub: '山西子公司', prov: '山西省', city: '太原市', sales: 22340 },
  { id: '1101010006', name: '北京王府井喜悦店', wh: '北京二级仓', sub: '北京子公司', prov: '北京市', city: '北京市', sales: 27560 },
  { id: '44010301', name: '广州天河城店', wh: '广东一级仓', sub: '广东子公司', prov: '广东省', city: '广州市', sales: 35210 },
  { id: '44030101', name: '深圳福田COCO Park店', wh: '广东一级仓', sub: '广东子公司', prov: '广东省', city: '深圳市', sales: 33890 },
  { id: '31010401', name: '上海徐家汇店', wh: '上海一级仓', sub: '上海子公司', prov: '上海市', city: '上海市', sales: 32450 },
  { id: '33020101', name: '宁波天一广场店', wh: '浙江一级仓', sub: '浙江子公司', prov: '浙江省', city: '宁波市', sales: 26780 },
  { id: '32050101', name: '苏州观前街店', wh: '江苏一级仓', sub: '江苏子公司', prov: '江苏省', city: '苏州市', sales: 27340 },
  { id: '51010701', name: '成都太古里店', wh: '四川一级仓', sub: '四川子公司', prov: '四川省', city: '成都市', sales: 34560 },
  { id: '42010601', name: '武汉光谷店', wh: '湖北一级仓', sub: '湖北子公司', prov: '湖北省', city: '武汉市', sales: 28900 },
  { id: '50010501', name: '重庆观音桥店', wh: '重庆一级仓', sub: '重庆子公司', prov: '重庆市', city: '重庆市', sales: 27890 },
  { id: '43010201', name: '长沙芙蓉广场店', wh: '湖南一级仓', sub: '湖南子公司', prov: '湖南省', city: '长沙市', sales: 26120 },
  { id: '35020101', name: '厦门中山路店', wh: '福建一级仓', sub: '福建子公司', prov: '福建省', city: '厦门市', sales: 28450 },
  { id: '37020101', name: '青岛台东店', wh: '山东一级仓', sub: '山东子公司', prov: '山东省', city: '青岛市', sales: 25670 },
  { id: '21020101', name: '大连青泥洼桥店', wh: '辽宁一级仓', sub: '辽宁子公司', prov: '辽宁省', city: '大连市', sales: 24890 },
  { id: '12010401', name: '天津南开店', wh: '天津一级仓', sub: '天津子公司', prov: '天津市', city: '天津市', sales: 25340 },
  { id: '61010401', name: '西安小寨店', wh: '陕西一级仓', sub: '陕西子公司', prov: '陕西省', city: '西安市', sales: 29120 },
  { id: '53010301', name: '昆明翠湖店', wh: '云南一级仓', sub: '云南子公司', prov: '云南省', city: '昆明市', sales: 26450 },
  { id: '52010301', name: '贵阳喷水池店', wh: '贵州一级仓', sub: '贵州子公司', prov: '贵州省', city: '贵阳市', sales: 24780 },
  { id: '36010401', name: '南昌红谷滩店', wh: '江西一级仓', sub: '江西子公司', prov: '江西省', city: '南昌市', sales: 23120 },
  { id: '34010401', name: '合肥蜀山店', wh: '安徽一级仓', sub: '安徽子公司', prov: '安徽省', city: '合肥市', sales: 24560 },
  { id: '45010301', name: '南宁万象城店', wh: '广西一级仓', sub: '广西子公司', prov: '广西壮族自治区', city: '南宁市', sales: 22890 },
  { id: '41010501', name: '郑州花园路店', wh: '河南一级仓', sub: '河南子公司', prov: '河南省', city: '郑州市', sales: 26340 },
  { id: '14010601', name: '太原亲贤街店', wh: '山西一级仓', sub: '山西子公司', prov: '山西省', city: '太原市', sales: 21560 },
  { id: '11010501', name: '北京朝阳大悦城店', wh: '北京二级仓', sub: '北京子公司', prov: '北京市', city: '北京市', sales: 31230 },
  { id: '44010601', name: '广州珠江新城店', wh: '广东一级仓', sub: '广东子公司', prov: '广东省', city: '广州市', sales: 34560 },
  { id: '31011501', name: '上海陆家嘴店', wh: '上海一级仓', sub: '上海子公司', prov: '上海市', city: '上海市', sales: 33890 },
  { id: '33010601', name: '杭州武林广场店', wh: '浙江一级仓', sub: '浙江子公司', prov: '浙江省', city: '杭州市', sales: 30120 },
];

const TOTAL_SALES_MAY = 121169659;
const FIRST_WEEK = 609;
const FIRST_MONTH = 650;

export const mockStoreSamples: StoreForecast[] = storeBaseData.map(s => {
  const ratio = s.sales / TOTAL_SALES_MAY;
  const dailyAvg = s.sales / 31;
  const regionCoeff = mockRegionCoefficients.find(r => r.subsidiary === s.sub)?.coefficient ?? 1.0;
  const fw = FIRST_WEEK * ratio * 7188 * regionCoeff;
  const md = FIRST_MONTH * ratio * 7188 * regionCoeff;
  return {
    storeId: s.id, storeName: s.name, warehouse: s.wh, subsidiary: s.sub, province: s.prov, city: s.city,
    maySales: s.sales, mayDailyAvg: Math.round(dailyAvg * 100) / 100,
    firstWeekDaily: Math.round(fw * 100) / 100, monthDaily: Math.round(md * 100) / 100,
    regionCoeff, salesRatio: ratio, isFloorProtected: false,
    w1Cups: 0, w2Cups: 0, w3Cups: 0, w4Cups: 0, totalCups: 0,
    w1Material: 0, w2Material: 0, w3Material: 0, w4Material: 0, totalMaterial: 0,
  };
});

// ===== 统配数据 =====
export const mockUnifiedDistribution: UnifiedDistribution[] = [
  { storeId: '1101010005', storeName: '北京王府井APM店', warehouse: '北京二级仓', materials: [{ name: '安溪铁观音', qty: 6 }, { name: '莲雾苹果汁', qty: 35 }, { name: '冷冻生椰乳', qty: 12 }] },
  { storeId: '1101010006', storeName: '北京王府井喜悦店', warehouse: '北京二级仓', materials: [{ name: '安溪铁观音', qty: 5 }, { name: '莲雾苹果汁', qty: 35 }, { name: '冷冻生椰乳', qty: 12 }] },
];

// ===== 仓级统配对比（9/9新增：统配异常按仓维度聚合展示） =====
export const mockWarehouseDistributionCompare: WarehouseDistributionCompare[] = [
  { warehouseName: '北京二级仓', forecastQty: 21280, actualQty: 19800, deviation: 1480, deviationPct: 7.5, isAbnormal: false },
  { warehouseName: '广东一级仓', forecastQty: 45600, actualQty: 42100, deviation: 3500, deviationPct: 8.3, isAbnormal: false },
  { warehouseName: '上海一级仓', forecastQty: 38200, actualQty: 35800, deviation: 2400, deviationPct: 6.7, isAbnormal: false },
  { warehouseName: '湖北一级仓', forecastQty: 32100, actualQty: 28500, deviation: 3600, deviationPct: 12.6, isAbnormal: true },
  { warehouseName: '四川一级仓', forecastQty: 29800, actualQty: 27200, deviation: 2600, deviationPct: 9.6, isAbnormal: false },
  { warehouseName: '浙江一级仓', forecastQty: 27500, actualQty: 24100, deviation: 3400, deviationPct: 14.1, isAbnormal: true },
  { warehouseName: '辽宁一级仓', forecastQty: 18900, actualQty: 17600, deviation: 1300, deviationPct: 7.4, isAbnormal: false },
  { warehouseName: '天津一级仓', forecastQty: 22300, actualQty: 20800, deviation: 1500, deviationPct: 7.2, isAbnormal: false },
];

// ===== 全国物料汇总（与BOM 4种物料统一） =====
export const nationalMaterialSummary = [
  { name: '安溪铁观音', forecastQty: 66285, allocationQty: 23365, extraStock: 42920, orderQty: 66285 },
  { name: '莲雾苹果汁', forecastQty: 363340, allocationQty: 138786, extraStock: 224554, orderQty: 363540 },
  { name: '冷冻生椰乳', forecastQty: 138095, allocationQty: 59779, extraStock: 78316, orderQty: 138345 },
  { name: '东方美人乌龙茶-A', forecastQty: 28585, allocationQty: 0, extraStock: 28585, orderQty: 28655 },
];

// ===== 仓库汇总示例（与BOM 4种物料统一） =====
export const warehouseSummarySample = {
  warehouseName: '北京二级仓',
  materials: [
    { name: '安溪铁观音', allocationQty: 589, extraStock: 1539, total: 2128, orderQty: 2128 },
    { name: '莲雾苹果汁', allocationQty: 5154, extraStock: 8245, total: 13399, orderQty: 13404 },
    { name: '冷冻生椰乳', allocationQty: 2792, extraStock: 2035, total: 4827, orderQty: 4830 },
    { name: '东方美人乌龙茶-A', allocationQty: 0, extraStock: 823, total: 823, orderQty: 825 },
  ],
};

// ===== 全部仓库汇总（8仓，9/20会议补充仓维度信息） =====
export const allWarehouseSummary = [
  { warehouseName: '北京二级仓', storeCount: 892, materials: [
    { name: '安溪铁观音', allocationQty: 589, extraStock: 1539, total: 2128, orderQty: 2128, unit: '箱' },
    { name: '莲雾苹果汁', allocationQty: 5154, extraStock: 8245, total: 13399, orderQty: 13404, unit: '箱' },
    { name: '冷冻生椰乳', allocationQty: 2792, extraStock: 2035, total: 4827, orderQty: 4830, unit: '瓶' },
    { name: '东方美人乌龙茶-A', allocationQty: 0, extraStock: 823, total: 823, orderQty: 825, unit: '箱' },
  ]},
  { warehouseName: '广东一级仓', storeCount: 1245, materials: [
    { name: '安溪铁观音', allocationQty: 820, extraStock: 2140, total: 2960, orderQty: 2960, unit: '箱' },
    { name: '莲雾苹果汁', allocationQty: 7180, extraStock: 11490, total: 18670, orderQty: 18675, unit: '箱' },
    { name: '冷冻生椰乳', allocationQty: 3890, extraStock: 2835, total: 6725, orderQty: 6730, unit: '瓶' },
    { name: '东方美人乌龙茶-A', allocationQty: 0, extraStock: 1148, total: 1148, orderQty: 1150, unit: '箱' },
  ]},
  { warehouseName: '上海一级仓', storeCount: 1034, materials: [
    { name: '安溪铁观音', allocationQty: 680, extraStock: 1775, total: 2455, orderQty: 2455, unit: '箱' },
    { name: '莲雾苹果汁', allocationQty: 5960, extraStock: 9535, total: 15495, orderQty: 15500, unit: '箱' },
    { name: '冷冻生椰乳', allocationQty: 3230, extraStock: 2355, total: 5585, orderQty: 5590, unit: '瓶' },
    { name: '东方美人乌龙茶-A', allocationQty: 0, extraStock: 953, total: 953, orderQty: 955, unit: '箱' },
  ]},
  { warehouseName: '湖北一级仓', storeCount: 978, materials: [
    { name: '安溪铁观音', allocationQty: 645, extraStock: 1680, total: 2325, orderQty: 2325, unit: '箱' },
    { name: '莲雾苹果汁', allocationQty: 5650, extraStock: 9040, total: 14690, orderQty: 14695, unit: '箱' },
    { name: '冷冻生椰乳', allocationQty: 3060, extraStock: 2230, total: 5290, orderQty: 5295, unit: '瓶' },
    { name: '东方美人乌龙茶-A', allocationQty: 0, extraStock: 903, total: 903, orderQty: 905, unit: '箱' },
  ]},
  { warehouseName: '四川一级仓', storeCount: 856, materials: [
    { name: '安溪铁观音', allocationQty: 565, extraStock: 1470, total: 2035, orderQty: 2035, unit: '箱' },
    { name: '莲雾苹果汁', allocationQty: 4950, extraStock: 7920, total: 12870, orderQty: 12875, unit: '箱' },
    { name: '冷冻生椰乳', allocationQty: 2680, extraStock: 1955, total: 4635, orderQty: 4640, unit: '瓶' },
    { name: '东方美人乌龙茶-A', allocationQty: 0, extraStock: 792, total: 792, orderQty: 795, unit: '箱' },
  ]},
  { warehouseName: '浙江一级仓', storeCount: 812, materials: [
    { name: '安溪铁观音', allocationQty: 535, extraStock: 1395, total: 1930, orderQty: 1930, unit: '箱' },
    { name: '莲雾苹果汁', allocationQty: 4690, extraStock: 7505, total: 12195, orderQty: 12200, unit: '箱' },
    { name: '冷冻生椰乳', allocationQty: 2540, extraStock: 1850, total: 4390, orderQty: 4395, unit: '瓶' },
    { name: '东方美人乌龙茶-A', allocationQty: 0, extraStock: 750, total: 750, orderQty: 752, unit: '箱' },
  ]},
  { warehouseName: '辽宁一级仓', storeCount: 623, materials: [
    { name: '安溪铁观音', allocationQty: 410, extraStock: 1070, total: 1480, orderQty: 1480, unit: '箱' },
    { name: '莲雾苹果汁', allocationQty: 3600, extraStock: 5760, total: 9360, orderQty: 9365, unit: '箱' },
    { name: '冷冻生椰乳', allocationQty: 1950, extraStock: 1420, total: 3370, orderQty: 3375, unit: '瓶' },
    { name: '东方美人乌龙茶-A', allocationQty: 0, extraStock: 576, total: 576, orderQty: 578, unit: '箱' },
  ]},
  { warehouseName: '天津一级仓', storeCount: 748, materials: [
    { name: '安溪铁观音', allocationQty: 492, extraStock: 1285, total: 1777, orderQty: 1777, unit: '箱' },
    { name: '莲雾苹果汁', allocationQty: 4320, extraStock: 6910, total: 11230, orderQty: 11235, unit: '箱' },
    { name: '冷冻生椰乳', allocationQty: 2345, extraStock: 1710, total: 4055, orderQty: 4060, unit: '瓶' },
    { name: '东方美人乌龙茶-A', allocationQty: 0, extraStock: 691, total: 691, orderQty: 693, unit: '箱' },
  ]},
];

// ===== 供应商分配底表（mock：只填份额 + MOQ；份额/MOQ 可在页面内联改 → 触发真算） =====
// 「合并品名」维度聚合，仅 Step 7 才拆到 SKU / 规格 —— 对齐 PRD §4.2.4 / §4.10
export const supplierRoot: Array<{ merged: string; rows: Array<[string, number]> }> = [
  { merged: '安溪铁观音', rows: [['安溪铁观音-1 / 福建安溪茶业A', 60], ['安溪铁观音-2 / 云南普洱供应链B', 40]] },
  { merged: '莲雾苹果汁', rows: [['莲雾苹果汁 / 海南果汁工厂C', 100]] },
  { merged: '冷冻生椰乳', rows: [['冷冻生椰乳 / 椰树供应链D', 70], ['冷冻生椰乳 / 海南椰品E', 30]] },
  { merged: '东方美人乌龙茶', rows: [['东方美人乌龙茶-A / 台湾茶业F', 100]] },
  { merged: '冷冻凤梨汁', rows: [['冷冻凤梨汁 / 新供应商G（虚拟项）', 100]] },
];

// ================= V7.6 新增（9/22 罗雄会议）：监控看板 =================
// ⚠️ 本段全部为**演示态数据（mock）**，不是真实取数结果

/* 「新品监控」看板底表 —— **二级仓库维度**（2026-09-26 彬节口径：一级仓 / 二级仓改用茶姬真实仓主数据）
 *
 * 仓清单来源：茶姬 SCM 仓主数据导出《茶姬一级仓-二级仓数据.xlsx》（87 行「一级仓库 + 二级仓库」成对）
 *   ① 按二级仓库去重：同一二级仓在多行出现时，一级仓库取「非自身」的父仓；只有自映射时取自身 → 76 个
 *   ② 剔除名称带「（停用）」的仓 → **65 个在用二级仓 / 44 个一级仓**
 *   口径与她报表里的「一级仓库名称 + 二级仓库名称」成对口径一致（见 demo.v4.3 RPT_Q 的 rpt-wlxs / bd-inv）。
 *
 * 数字口径（PRD V7.8 §5.4 六项监控指标；全部确定性，仓名 hash 作种子，不用随机数）：
 *   ① 仓备货预测日均杯量 = 覆盖门店 × 单店首周日均新品杯量
 *      （大盘首周日均 FIRST_WEEK=609 杯 × 第 1 周新品杯占比 5.0% = 30.45；＝ PRD「仓维度上新预测总量 ÷ 28」的日均形态）
 *   ② 仓实际日均杯量 = ① × (1 + 偏差率)（PRD 为「仓饮品销量 ÷ 售卖天数 N」，默认 7 天、不含当日）
 *   ③ 仓偏差率 = ±28% 内幂律分布（多数在 ±5% 内、约 10% 超 20% 触发销量偏差预警）
 *   ④ 近 7 日销售趋势 = PRD 的 30 天销售占比趋势在大宽表里的近 7 日环比形态
 *   ⑤ 仓库可售天数 = 仓库可用库存 ÷ 仓物料订货日均（订货天数 N=7）；< 7 天触发库存预警
 *   ⑥ 仓预计门店可售天数 = (仓库可用库存 + 门店库存 + 门店在途) ÷ 门店成品物料销量（仅展示、不监控）
 *   ⚠️ 覆盖门店 = 按城市门店规模手写摊分到全国 7,188（Σ = 7,188，构建期自检）—— 演示态，真实「仓 ← 门店」归属要等门店主数据。
 *   ⚠️ 上新期监控值要等上新后 T+1 ~ T+28 才有真实出数，以上均为演示态。
 */
const MONITOR_WH_PAIRS: Array<[string, string]> = [
  /* [一级仓库名称, 二级仓库名称] —— 父仓 → 二级仓（自映射＝该仓自身即二级仓） */
  ['成都仓', '兰州二级仓'],
  ['苏州仓', '南京二级仓'],
  ['合肥共配仓-C', '合肥共配仓-C'],
  ['成都仓', '成都仓'],
  ['天津仓', '北京二级仓'],
  ['郑州共配仓-G', '郑州共配仓-G'],
  ['武汉仓', '南昌二级仓'],
  ['成都仓', '西安二级仓'],
  ['太原共配仓-C', '太原共配仓-C'],
  ['武汉仓', '郑州仓'],
  ['重庆二级仓', '重庆二级仓'],
  ['呼和浩特共配仓-A', '呼和浩特共配仓-A'],
  ['南宁共配仓-E', '南宁共配仓-E'],
  ['桃浦共配仓-B', '桃浦共配仓-B'],
  ['南京共配仓-G', '南京共配仓-G'],
  ['宁波共配仓-B', '宁波共配仓-B'],
  ['武汉仓', '济南二级仓'],
  ['青岛共配仓-C', '青岛共配仓-C'],
  ['苏州仓', '宁波二级仓'],
  ['直配仓-水果直运', '直配仓-水果直运'],
  ['天津仓', '天津仓'],
  ['长沙二级仓', '长沙二级仓'],
  ['温州二级仓', '温州二级仓'],
  ['金华共配仓-B', '金华共配仓-B'],
  ['无锡共配仓-B', '无锡共配仓-B'],
  ['苏州仓', '上海二级仓'],
  ['福州共配仓-B', '福州共配仓-B'],
  ['天津仓', '沈阳二级仓'],
  ['浦东共配仓-B', '浦东共配仓-B'],
  ['广州仓', '福州二级仓'],
  ['昆明共配仓-D', '昆明共配仓-D'],
  ['武汉仓01', '武汉仓01'],
  ['蚌埠共配仓-C', '蚌埠共配仓-C'],
  ['广州仓', '广州仓'],
  ['广州仓', '南宁二级仓'],
  ['温州共配仓-B', '温州共配仓-B'],
  ['苏州仓', '淮安二级仓'],
  ['浪拓虚拟仓', '浪拓虚拟仓'],
  ['上海共配仓', '上海共配仓'],
  ['苏州共配仓-B', '苏州共配仓-B'],
  ['广州仓', '潮州二级仓'],
  ['杭州共配仓-B', '杭州共配仓-B'],
  ['济南共配仓-C', '济南共配仓-C'],
  ['广州共配仓-A', '广州共配仓-A'],
  ['直配仓', '直配仓'],
  ['苏州仓', '杭州二级仓'],
  ['东莞共配仓-A', '东莞共配仓-A'],
  ['昆明仓', '昆明仓'],
  ['北京共配仓-C', '北京共配仓-C'],
  ['苏州仓', '苏州仓'],
  ['淮安共配仓-G', '淮安共配仓-G'],
  ['昆明二级仓', '昆明二级仓'],
  ['成都仓', '乌鲁木齐二级仓'],
  ['南通共配仓-B', '南通共配仓-B'],
  ['苏州仓', '合肥二级仓'],
  ['广州仓', '厦门二级仓'],
  ['成都仓', '贵阳仓'],
  ['武汉仓', '武汉仓'],
  ['广州仓', '深圳二级仓'],
  ['厦门共配仓-B', '厦门共配仓-B'],
  ['贵阳二级仓', '贵阳二级仓'],
  ['常州共配仓-B', '常州共配仓-B'],
  ['嘉兴共配仓-B', '嘉兴共配仓-B'],
  ['广州仓', '海口二级仓'],
  ['昆山共配仓-B', '昆山共配仓-B'],
];

/** 覆盖门店：按城市门店规模手写权重后等比缩放到全国 7,188（Σ 严格 = 7,188 ✓）
 *  ⚠️ 演示态：真实「仓 ← 门店」归属要等门店主数据（湖仓）；此处只保证总量与量级合理
 *    （北上深广成 > 省会/强二线 > 淮安/蚌埠/潮州/浪拓虚拟仓 这类小仓） */
const MONITOR_STORES_BY_WH2: Record<string, number> = {
  '兰州二级仓': 52,
  '南京二级仓': 169,
  '合肥共配仓-C': 73,
  '成都仓': 290,
  '北京二级仓': 370,
  '郑州共配仓-G': 97,
  '南昌二级仓': 81,
  '西安二级仓': 145,
  '太原共配仓-C': 58,
  '郑州仓': 129,
  '重庆二级仓': 177,
  '呼和浩特共配仓-A': 29,
  '南宁共配仓-E': 56,
  '桃浦共配仓-B': 161,
  '南京共配仓-G': 129,
  '宁波共配仓-B': 64,
  '济南二级仓': 68,
  '青岛共配仓-C': 113,
  '宁波二级仓': 81,
  '直配仓-水果直运': 64,
  '天津仓': 137,
  '长沙二级仓': 137,
  '温州二级仓': 68,
  '金华共配仓-B': 50,
  '无锡共配仓-B': 73,
  '上海二级仓': 338,
  '福州共配仓-B': 56,
  '沈阳二级仓': 81,
  '浦东共配仓-B': 266,
  '福州二级仓': 73,
  '昆明共配仓-D': 48,
  '武汉仓01': 153,
  '蚌埠共配仓-C': 24,
  '广州仓': 266,
  '南宁二级仓': 45,
  '温州共配仓-B': 52,
  '淮安二级仓': 29,
  '浪拓虚拟仓': 16,
  '上海共配仓': 193,
  '苏州共配仓-B': 126,
  '潮州二级仓': 21,
  '杭州共配仓-B': 185,
  '济南共配仓-C': 48,
  '广州共配仓-A': 193,
  '直配仓': 89,
  '杭州二级仓': 234,
  '东莞共配仓-A': 73,
  '昆明仓': 64,
  '北京共配仓-C': 282,
  '苏州仓': 161,
  '淮安共配仓-G': 23,
  '昆明二级仓': 56,
  '乌鲁木齐二级仓': 45,
  '南通共配仓-B': 50,
  '合肥二级仓': 97,
  '厦门二级仓': 81,
  '贵阳仓': 56,
  '武汉仓': 185,
  '深圳二级仓': 314,
  '厦门共配仓-B': 64,
  '贵阳二级仓': 42,
  '常州共配仓-B': 53,
  '嘉兴共配仓-B': 45,
  '海口二级仓': 42,
  '昆山共配仓-B': 48,
};

/** 全国在营门店数（PRD 二类数据：成品销售报表） */
const MONITOR_STORES_TOTAL = 7188;

/* 构建期自检：Σ 覆盖门店 必须 = 全国在营门店 7,188 —— 改任一端（仓清单 / 门店数）都会立刻在这里炸出来 */
if (MONITOR_WH_PAIRS.reduce((a, [, wh2]) => a + (MONITOR_STORES_BY_WH2[wh2] || 0), 0) !== MONITOR_STORES_TOTAL) {
  throw new Error('monitor: Σ 覆盖门店 ≠ ' + MONITOR_STORES_TOTAL + '（改仓清单或门店数后要同步重摊）');
}
if (MONITOR_WH_PAIRS.some(([, wh2]) => MONITOR_STORES_BY_WH2[wh2] == null)) {
  throw new Error('monitor: 有二级仓没有覆盖门店数（MONITOR_STORES_BY_WH2 缺项）');
}
/** 单店首周日均新品杯量 = 大盘预测首周日均 609 杯 × 第 1 周新品杯占比 5.0% */
const MONITOR_NEW_CUPS_PER_STORE = FIRST_WEEK * 0.05; // = 30.45

/** FNV-1a：仓名 hash → [0,1)，用作确定性「伪随机」种子（不用 Math.random，构建可复现） */
function monitorHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}
const monitorFrac = (wh: string, salt: string) => monitorHash(wh + '|' + salt);
const monitorR1 = (v: number) => Math.round(v * 10) / 10;

export const monitorSubWarehouses: MonitorSubWhRow[] = (() => {
  /* 覆盖门店：直接取手写摊分表（Σ 已自检 = 7,188） */
  const stores = MONITOR_WH_PAIRS.map(([, wh2]) => MONITOR_STORES_BY_WH2[wh2]);

  return MONITOR_WH_PAIRS.map(([wh1, wh2], i) => {
    /* 单店首周日均新品杯量 ±10%（区域系数 / 门店结构的演示态折算） */
    const perStore = MONITOR_NEW_CUPS_PER_STORE * (0.9 + monitorFrac(wh2, 'u') * 0.2);
    const forecastCupsDaily = Math.round(stores[i] * perStore);
    /* ③ 偏差率：sign(u) × |u|³ × 28% → 多数在 ±5% 内、约 10% 超 20% */
    const du = monitorFrac(wh2, 'd') * 2 - 1;
    const deviationPct = monitorR1(du * Math.pow(Math.abs(du), 2) * 28);
    /* ⑤ 仓库可售天数：(2u−1)³ 集中在 9.6 天左右、尾部落 5.0 ~ 14.2 天 → 少数 <7 天触发库存预警 */
    const su = monitorFrac(wh2, 's') * 2 - 1;
    const sellableDays = monitorR1(9.6 + 4.6 * Math.pow(su, 3));
    /* ⑥ 仓预计门店可售天数 = 仓库可售天数 × (1.25 ~ 2.00)（含门店库存 + 在途） */
    const estStoreSellableDays = monitorR1(sellableDays * (1.25 + monitorFrac(wh2, 'e') * 0.75));
    /* ④ 近 7 日销售趋势（环比 %） */
    const tu = monitorFrac(wh2, 't') * 2 - 1;
    const trendPct = monitorR1(tu * Math.pow(Math.abs(tu), 2) * 20);

    return {
      wh1,
      wh2,
      coversStores: stores[i],
      forecastCupsDaily,
      actualCupsDaily: Math.round(forecastCupsDaily * (1 + deviationPct / 100)),
      deviationPct,
      trendPct,
      sellableDays,
      estStoreSellableDays,
      isDeviationAlert: Math.abs(deviationPct) > 20,
      isStockAlert: sellableDays < 7,
    };
  });
})();

// 参数面板：V7.6 规则 = 所有参数都支持页面直接改；底表里也有的可两处改（底表改 15–20 分钟后生效）；计算以页面当前值为准
export const paramList: ParamItem[] = [
  { key: 'region', name: '区域系数', granularity: '分公司', value: '24 个子公司（湖北 1.196 最高）', pageEditable: true, sheetEditable: false, effect: '页面改即时生效 → 自动重算 Step ②-⑧' },
  { key: 'stock',  name: '备货系数', granularity: '物料', value: '1.0 / 1.1 / 1.4', pageEditable: true, sheetEditable: true, effect: '页面改即时；底表改 → 15–20 分钟后被读到' },
  { key: 'loss',   name: '损耗率', granularity: '物料', value: '1% ~ 3%', pageEditable: true, sheetEditable: true, effect: '页面改即时；底表改 → 15–20 分钟后被读到' },
  { key: 'shelf',  name: '开封效期', granularity: '物料', value: '4 ~ 9 天', pageEditable: true, sheetEditable: true, effect: '页面改即时；底表改 → 15–20 分钟后被读到' },
  { key: 'share',  name: '供应商份额', granularity: '供应商×物料', value: '安溪铁观音 60% / 40%；其余 100%', pageEditable: true, sheetEditable: true, effect: '页面改即时；底表改 → 15–20 分钟后被读到' },
  { key: 'moq',    name: 'MOQ', granularity: '供应商×物料', value: '100 ~ 500', pageEditable: true, sheetEditable: true, effect: '页面改即时；底表改 → 15–20 分钟后被读到' },
  { key: 'safety', name: '安全库存天数', granularity: '全局', value: '7', pageEditable: true, sheetEditable: false, effect: '页面改即时 → 重算安库校验', numeric: true, unit: '天' },
  { key: 'sellN',  name: '售卖天数 N', granularity: '全局', value: '7', pageEditable: true, sheetEditable: false, effect: '页面改即时 → 重算「仓实际日均杯量」分母（最近 N 天、不含当天）', numeric: true, unit: '天' },
  { key: 'orderN', name: '订货天数 N', granularity: '全局', value: '7', pageEditable: true, sheetEditable: false, effect: '页面改即时 → 重算「仓库可售天数」分母（仓物料订货日均 = 订货量 ÷ N 天）', numeric: true, unit: '天' },
  { key: 'alertN', name: '预警阈值天数', granularity: '全局', value: '7', pageEditable: true, sheetEditable: false, effect: '页面改即时 → 库存预警触发条件（仓库可售天数 < N 天）', numeric: true, unit: '天' },
  { key: 'devTh',  name: '销量偏差阈值', granularity: '全局', value: '20', pageEditable: true, sheetEditable: false, effect: '页面改即时 → 销量偏差预警触发条件（|偏差| > 20%）', numeric: true, unit: '%' },
  { key: 'stores', name: '门店数', granularity: '全局', value: '7,188（系统自动获取）', pageEditable: false, sheetEditable: false, effect: '一期不改（二期支持门店增减，通过区域系数/备货系数替代）' },
];
