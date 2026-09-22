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
  // W1-W4杯占比（每行冗余，实际值相同）
  cupRatioW1: number;        // 第1周新品杯占比
  cupRatioW2: number;        // 第2周新品杯占比
  cupRatioW3: number;        // 第3周新品杯占比
  cupRatioW4: number;        // 第4周新品杯占比
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

// ===== V7.6 新增：上新期间监控看板（演示态） =====
export interface MonitorWarehouseRow {
  warehouseName: string;
  warehouseType: '一级仓' | '二级仓';
  coversStores: number;
  forecastDailyCups: number;    // 仓备货预测日均杯量 = 仓维度上新预测总量 ÷ 28
  actualDailyCups: number;      // 仓实际日均杯量 = 仓对应门店成品销售杯量 ÷ 售卖天数 N（最近 N 天、不含当天）
  deviationPct: number;         // 仓偏差率 =（实际 − 预测）÷ 预测 ×100%；|偏差| > 20% 触发预警
  warehouseSellableDays: number;// 仓库可售天数 = 物料可用库存 ÷ 仓物料订货日均（订货量 ÷ 订货天数 N）
  storeSellableDays: number;    // 仓预计门店可售天数 =（仓库可用库存+门店库存+门店在途）÷ 门店成品物料销量
  isDeviationAlert: boolean;
  isStockAlert: boolean;
}

export interface TrendPoint { day: number; date: string; cups: number; share: number; }
export interface MonitorTrend { national: TrendPoint[]; byWarehouse: Record<string, TrendPoint[]>; }

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
