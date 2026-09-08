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

// ===== 区域系数计算过程：每个历史品在每个子公司的达标率（实际/预测） =====
// 展示用：选取5个代表性子公司 × 23个历史品的达标率
export const regionCalcProcess = {
  // 展示5个代表性子公司（含兜底和非兜底）
  sampleSubs: ['湖北子公司', '广东子公司', '浙江子公司', '北京子公司', '辽宁子公司'],
  // 23个历史品在这些子公司的达标率（实际销量/预测销量）
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

// ===== 全部门店数据（50条mock，支持分页） =====
const storeBaseData: Array<{ id: string; name: string; wh: string; sub: string; prov: string; city: string; sales: number }> = [
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
