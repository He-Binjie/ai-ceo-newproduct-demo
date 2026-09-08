// 新品分仓备货 Demo 类型定义（V3 - 对齐向磊飞书多维表格模板）

// ===== 飞书多维表格：新品BOM（1张扁平表，每行=一个新品下的一个原材料） =====
export interface BOMRecord {
  id: string;
  // 新品维度字段（每行冗余）
  productName: string;       // 新品名称
  launchDate: string;        // 上新日
  // 物料维度字段
  materialName: string;      // 原材料名称
  materialCode: string;      // 原材料编码（可能为空）
  spec: string;              // 规格型号
  unit: string;              // 单位
  unitUsage: number;         // 单位用量
  usageUnit: string;         // 用量单位 (g/ml)
  shelfLifeDays: number;     // 原材料开封效期（天）
  stockCoefficient: number;  // 原材料备货系数
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
}

export interface ConfirmAction {
  label: string;
  type: 'confirm' | 'edit' | 'skip' | 'recalculate' | 'export' | 'notify';
  value?: string;
}

export type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface WizardState {
  currentStep: WizardStep;
  bomRecords: BOMRecord[];
  systemData: SystemData;
  regionCoefficients: RegionCoefficient[];
  storeForecasts: StoreForecast[];
  warehouseAggregations: WarehouseAggregation[];
  supplierAllocations: SupplierAllocation[];
  warnings: Warning[];
  confirmed: boolean;
}
