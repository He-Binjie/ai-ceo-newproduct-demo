// 724 Excel 真实数据 mock（苹果莲雾汁）
import type { BOMMaterial, RegionCoefficient, NewProductInfo } from '../types';

export const mockProduct: NewProductInfo = {
  name: '苹果莲雾汁',
  launchDate: '2026-07-24',
  firstWeekDailyCups: 15000,
  firstMonthDailyCups: 16000,
  scope: '全国',
};

export const mockMaterials: BOMMaterial[] = [
  {
    id: 'mat-001',
    name: '莲雾浓缩汁',
    spec: '1L×12',
    purchaseUnit: '箱',
    unitConversion: 1000,
    retentionRate: 0.95,
    applicationRateW1: 11.41,
    applicationRateW2: 11.41,
    applicationRateW3: 11.41,
    applicationRateW4: 11.41,
    ratioW1: 0.05,
    ratioW2: 0.035,
    ratioW3: 0.0224,
    ratioW4: 0.012544,
    stockCoefficient: 1.0,
    shelfLifeMinWeeks: 4,
    moq: 50,
    selected: true,
  },
  {
    id: 'mat-002',
    name: '苹果原汁',
    spec: '1L×12',
    purchaseUnit: '箱',
    unitConversion: 1000,
    retentionRate: 0.95,
    applicationRateW1: 8.5,
    applicationRateW2: 8.5,
    applicationRateW3: 8.5,
    applicationRateW4: 8.5,
    ratioW1: 0.05,
    ratioW2: 0.035,
    ratioW3: 0.0224,
    ratioW4: 0.012544,
    stockCoefficient: 1.0,
    shelfLifeMinWeeks: 6,
    moq: 100,
    selected: true,
  },
  {
    id: 'mat-003',
    name: '果糖糖浆',
    spec: '5kg×4',
    purchaseUnit: '箱',
    unitConversion: 5000,
    retentionRate: 0.98,
    applicationRateW1: 15.0,
    applicationRateW2: 15.0,
    applicationRateW3: 15.0,
    applicationRateW4: 15.0,
    ratioW1: 0.05,
    ratioW2: 0.035,
    ratioW3: 0.0224,
    ratioW4: 0.012544,
    stockCoefficient: 1.0,
    shelfLifeMinWeeks: 8,
    moq: 200,
    selected: true,
  },
  {
    id: 'mat-004',
    name: '茉莉绿茶底',
    spec: '500g×20',
    purchaseUnit: '箱',
    unitConversion: 500,
    retentionRate: 0.92,
    applicationRateW1: 3.2,
    applicationRateW2: 3.2,
    applicationRateW3: 3.2,
    applicationRateW4: 3.2,
    ratioW1: 0.05,
    ratioW2: 0.035,
    ratioW3: 0.0224,
    ratioW4: 0.012544,
    stockCoefficient: 1.0,
    shelfLifeMinWeeks: 12,
    moq: 30,
    selected: true,
  },
  {
    id: 'mat-005',
    name: '定制杯盖（莲雾款）',
    spec: '1000只/箱',
    purchaseUnit: '箱',
    unitConversion: 1,
    retentionRate: 1.0,
    applicationRateW1: 1.0,
    applicationRateW2: 1.0,
    applicationRateW3: 1.0,
    applicationRateW4: 1.0,
    ratioW1: 0.05,
    ratioW2: 0.035,
    ratioW3: 0.0224,
    ratioW4: 0.012544,
    stockCoefficient: 1.1,
    shelfLifeMinWeeks: 0,
    moq: 500,
    selected: false,
  },
];

// 区域系数 mock（基于历史新品销售数据）
export const mockRegionCoefficients: RegionCoefficient[] = [
  { region: '华东', subsidiary: '上海分公司', storeCount: 1850, salesRatio: 0.28, nationalAvgRatio: 0.14, coefficient: 2.0 },
  { region: '华南', subsidiary: '广州分公司', storeCount: 1620, salesRatio: 0.22, nationalAvgRatio: 0.14, coefficient: 1.57 },
  { region: '华北', subsidiary: '北京分公司', storeCount: 1380, salesRatio: 0.18, nationalAvgRatio: 0.14, coefficient: 1.29 },
  { region: '西南', subsidiary: '成都分公司', storeCount: 1250, salesRatio: 0.15, nationalAvgRatio: 0.14, coefficient: 1.07 },
  { region: '华中', subsidiary: '武汉分公司', storeCount: 980, salesRatio: 0.09, nationalAvgRatio: 0.14, coefficient: 1.0 },
  { region: '东北', subsidiary: '沈阳分公司', storeCount: 650, salesRatio: 0.05, nationalAvgRatio: 0.14, coefficient: 1.0 },
  { region: '西北', subsidiary: '西安分公司', storeCount: 420, salesRatio: 0.03, nationalAvgRatio: 0.14, coefficient: 1.0 },
];

// 相似历史新品（用于区域系数计算）
export const similarProducts = [
  { name: '蜜桃乌龙茶', launchDate: '2026-03-15', firstMonthCups: 18000, regionMatch: 0.92 },
  { name: '杨梅冰茶', launchDate: '2025-06-20', firstMonthCups: 14000, regionMatch: 0.88 },
  { name: '芒果椰椰', launchDate: '2025-09-10', firstMonthCups: 12000, regionMatch: 0.85 },
  { name: '葡萄冰酿', launchDate: '2026-01-08', firstMonthCups: 16500, regionMatch: 0.90 },
  { name: '柠檬绿茶', launchDate: '2025-04-22', firstMonthCups: 20000, regionMatch: 0.78 },
];

// 仓库-门店映射（简化版）
export const warehouseStoreMap = [
  { warehouseId: 'WH-SH', warehouseName: '上海仓', region: '华东', coveredStores: 1850 },
  { warehouseId: 'WH-GZ', warehouseName: '广州仓', region: '华南', coveredStores: 1620 },
  { warehouseId: 'WH-BJ', warehouseName: '北京仓', region: '华北', coveredStores: 1380 },
  { warehouseId: 'WH-CD', warehouseName: '成都仓', region: '西南', coveredStores: 1250 },
  { warehouseId: 'WH-WH', warehouseName: '武汉仓', region: '华中', coveredStores: 980 },
  { warehouseId: 'WH-SY', warehouseName: '沈阳仓', region: '东北', coveredStores: 650 },
  { warehouseId: 'WH-XA', warehouseName: '西安仓', region: '西北', coveredStores: 420 },
];

// 供应商信息
export const suppliers = [
  { name: '云南莲雾农业', material: '莲雾浓缩汁', capacity: 8000, share: 0.6 },
  { name: '海南果源', material: '莲雾浓缩汁', capacity: 5000, share: 0.4 },
  { name: '山东苹果园', material: '苹果原汁', capacity: 12000, share: 0.7 },
  { name: '陕西果汁厂', material: '苹果原汁', capacity: 6000, share: 0.3 },
  { name: '广西糖业', material: '果糖糖浆', capacity: 20000, share: 1.0 },
  { name: '福建茶业', material: '茉莉绿茶底', capacity: 15000, share: 1.0 },
];

// AI 对话脚本（每步的引导话术）
export const chatScripts: Record<number, { assistant: string; userOptions?: string[] }[]> = {
  1: [
    { assistant: '你好！我是 AI CEO 新品分仓助手。我来帮你完成新品的分仓备货计算。\n\n首先，请录入新品的基本信息：\n• 新品名称\n• 计划上市日期\n• 大盘预测首周日均杯量\n• 大盘预测首月日均杯量\n• 上新范围\n\n请在右侧表单中填写。' },
  ],
  2: [
    { assistant: '新品信息已录入 ✅\n\n接下来请从 BOM 清单中筛选**核心物料**。\n\n核心物料是指：\n• 采购周期长（>2周）\n• 供应商产能有限\n• 新品专属（非通用物料）\n\n请勾选需要纳入分仓计算的物料。' },
  ],
  3: [
    { assistant: '核心物料已选定 ✅（4种物料）\n\n现在计算**区域系数**。我会从历史新品中找到相似产品，推算各区域的销售偏好。\n\n以下是系统推荐的5个相似历史新品，请确认或调整：' },
  ],
  4: [
    { assistant: '区域系数计算完成 ✅\n\n关键发现：\n• **华东**系数最高（2.0），上海消费者对果茶类新品接受度极强\n• **华中/东北/西北**系数为1.0（下限保护），实际销售占比低于全国均值\n\n现在开始**门店级杯量预测**，系统会根据区域系数和门店销量占比，计算每家门店的W1-W4预测杯量。' },
  ],
  5: [
    { assistant: '门店预测完成 ✅\n\n核心公式：\n```\nW1物料量 = 首周日均 × 区域系数 × W1占比 × 7 ÷ 应用率 × 备货系数\n```\n\n以**莲雾浓缩汁 @ 上海门店1101010005**为例：\n• W1 = 1077.92 × 1.2 × 0.05 × 7 ÷ 11.41 × 1 = **39.67**\n• 四周合计 = **99**\n\n右侧展示了各物料的门店级计算明细。' },
  ],
  6: [
    { assistant: '物料计算完成 ✅\n\n现在进行**效期校验**和**汇总到仓**：\n\n效期校验结果：\n• 莲雾浓缩汁（效期4周）→ W4用量10.62 > 最小量 ✅\n• 苹果原汁（效期6周）→ 安全 ✅\n• 果糖糖浆（效期8周）→ 安全 ✅\n• 茉莉绿茶底（效期12周）→ 安全 ✅\n\n门店预测已按仓库覆盖关系汇总。' },
  ],
  7: [
    { assistant: '⚠️ 发现预警！\n\n**第一道预警（备货偏差）**：\n全国备货总杯量 vs 大盘GMV目标偏差 **12.3%**，超过10%阈值。\n\n建议：\n1. 调低华东区域系数（2.0 → 1.8）\n2. 或调低备货系数（1.0 → 0.9）\n\n**第二道预警（MOQ取整）**：\n莲雾浓缩汁 MOQ=50，取整后偏差 **6.8%**，超过5%阈值。\n\n建议与供应商协商降低 MOQ 至 30。' },
  ],
  8: [
    { assistant: '所有计算和校验完成 ✅\n\n最终备货方案已生成：\n• 7个仓库 × 4种物料\n• 总备货量：12,847 单位\n• 最终偏差率：3.2%（< 5% ✅）\n\n请确认备货方案，确认后可导出 Excel 并发送给供应商。' },
  ],
};
