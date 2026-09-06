// 新品分仓备货 Demo 类型定义

export interface NewProductInfo {
  name: string;
  launchDate: string;
  firstWeekDailyCups: number;
  firstMonthDailyCups: number;
  scope: '全国' | '区域';
  scopeRegions?: string[];
}

export interface BOMMaterial {
  id: string;
  name: string;
  spec: string;
  purchaseUnit: string;
  unitConversion: number; // g per unit
  retentionRate: number; // 保留率
  applicationRateW1: number;
  applicationRateW2: number;
  applicationRateW3: number;
  applicationRateW4: number;
  ratioW1: number;
  ratioW2: number;
  ratioW3: number;
  ratioW4: number;
  stockCoefficient: number;
  shelfLifeMinWeeks: number;
  moq: number;
  selected: boolean;
}

export interface RegionCoefficient {
  region: string;
  subsidiary: string;
  storeCount: number;
  salesRatio: number;
  nationalAvgRatio: number;
  coefficient: number; // max(salesRatio / nationalAvgRatio, 1.0)
}

export interface StoreForecast {
  storeId: string;
  storeName: string;
  region: string;
  subsidiary: string;
  storeCount: number;
  salesRatio: number;
  regionCoeff: number;
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
  coveredStores: number;
  totalForecast: number;
  allocationQty: number;
  extraStock: number; // max(forecast - allocation, 0)
  sellableDays: number;
  moqRounded: number;
  supplier: string;
}

export interface Warning {
  level: 'red' | 'yellow' | 'green';
  type: '备货预警' | 'MOQ取整预警' | '安全库存预警';
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
}

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface WizardState {
  currentStep: WizardStep;
  productInfo: NewProductInfo | null;
  materials: BOMMaterial[];
  selectedMaterials: string[];
  regionCoefficients: RegionCoefficient[];
  storeForecasts: StoreForecast[];
  warehouseAggregations: WarehouseAggregation[];
  warnings: Warning[];
  confirmed: boolean;
}
