// 自然语言意图解析引擎（前端模拟）
import type { NewProductInfo, BOMMaterial } from '../types';

export interface Intent {
  type: string;
  confidence: number;
  entities: Record<string, any>;
  thinking: string[];
}

// 意图匹配规则
const INTENT_PATTERNS: { pattern: RegExp; type: string; extract: (match: RegExpMatchArray) => Record<string, any> }[] = [
  // Step 1: 新品信息
  {
    pattern: /(?:创建|新建|录入|添加).*(?:新品|产品)[，,。.]*.*?(?:叫|名称[是为]?)(.+?)(?:[，,。.]|$)/,
    type: 'create_product',
    extract: (m) => ({ name: m[1].trim() }),
  },
  {
    pattern: /(?:首周|第一周).*(?:日均|每天).*(?:杯量?|预测)[是为]*(\d+)/,
    type: 'set_first_week_cups',
    extract: (m) => ({ firstWeekDailyCups: parseInt(m[1]) }),
  },
  {
    pattern: /(?:首月|第一个月).*(?:日均|每天).*(?:杯量?|预测)[是为]*(\d+)/,
    type: 'set_first_month_cups',
    extract: (m) => ({ firstMonthDailyCups: parseInt(m[1]) }),
  },
  {
    pattern: /(?:上市|上新).*(?:日期|时间)[是为]*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/,
    type: 'set_launch_date',
    extract: (m) => ({ launchDate: m[1].replace(/\//g, '-') }),
  },
  {
    pattern: /(?:上新范围|覆盖范围)[是为]*(全国|区域)/,
    type: 'set_scope',
    extract: (m) => ({ scope: m[1] }),
  },
  // 一步到位的完整录入
  {
    pattern: /(?:帮我|请)?(?:创建|新建|录入).*(.+?)[，,].*?首周.*?(\d+).*?首月.*?(\d+)/,
    type: 'create_product_full',
    extract: (m) => ({ name: m[1].trim(), firstWeekDailyCups: parseInt(m[2]), firstMonthDailyCups: parseInt(m[3]) }),
  },

  // Step 2: 物料筛选
  {
    pattern: /(?:选择|勾选|选中|筛选).*(?:全部|所有).*(?:物料|核心)/,
    type: 'select_all_materials',
    extract: () => ({}),
  },
  {
    pattern: /(?:取消|去掉|不选).*(.+?)(?:[，,。.]|$)/,
    type: 'deselect_material',
    extract: (m) => ({ materialName: m[1].trim() }),
  },
  {
    pattern: /(?:只选|只保留).*(.+?)(?:[，,。.]|$)/,
    type: 'select_only',
    extract: (m) => ({ materialName: m[1].trim() }),
  },

  // Step 3: 区域系数
  {
    pattern: /(?:调整|修改|改).*(?:华东|上海).*(?:系数|区域系数)[为到]*(\d+\.?\d*)/,
    type: 'adjust_region_coeff',
    extract: (m) => ({ region: '华东', coefficient: parseFloat(m[1]) }),
  },
  {
    pattern: /(?:相似|参考|历史).*(?:产品|新品)/,
    type: 'show_similar_products',
    extract: () => ({}),
  },

  // Step 5-6: 计算
  {
    pattern: /(?:开始|执行|运行).*(?:计算|预测)/,
    type: 'run_calculation',
    extract: () => ({}),
  },
  {
    pattern: /(?:重新|再).*(?:计算|算一下)/,
    type: 'recalculate',
    extract: () => ({}),
  },

  // Step 7: 预警处理
  {
    pattern: /(?:调低|降低|减少).*(?:区域系数|备货系数)[为到]*(\d+\.?\d*)/,
    type: 'adjust_coefficient',
    extract: (m) => ({ newValue: parseFloat(m[1]) }),
  },
  {
    pattern: /(?:协商|降低).*MOQ[为到]*(\d+)/,
    type: 'negotiate_moq',
    extract: (m) => ({ newMoq: parseInt(m[1]) }),
  },

  // Step 8: 确认
  {
    pattern: /(?:确认|同意|OK|ok|可以|没问题)/,
    type: 'confirm',
    extract: () => ({}),
  },
  {
    pattern: /(?:导出|下载|生成).*?(?:Excel|excel|表格)/,
    type: 'export_excel',
    extract: () => ({}),
  },

  // 通用
  {
    pattern: /(?:下一步|next|继续|往下)/,
    type: 'next_step',
    extract: () => ({}),
  },
  {
    pattern: /(?:上一步|返回|back|回退)/,
    type: 'prev_step',
    extract: () => ({}),
  },
  {
    pattern: /(?:帮助|help|怎么用|你能做什么)/,
    type: 'help',
    extract: () => ({}),
  },
];

export function parseIntent(text: string): Intent {
  const normalizedText = text.trim();

  for (const rule of INTENT_PATTERNS) {
    const match = normalizedText.match(rule.pattern);
    if (match) {
      const entities = rule.extract(match);
      return {
        type: rule.type,
        confidence: 0.92,
        entities,
        thinking: [
          `识别到用户意图：${INTENT_LABELS[rule.type] || rule.type}`,
          `提取实体：${JSON.stringify(entities)}`,
          `置信度：92%`,
          `执行操作...`,
        ],
      };
    }
  }

  // Fallback: 尝试提取数字
  const numbers = normalizedText.match(/\d+/g);
  if (numbers && numbers.length > 0) {
    return {
      type: 'unknown_with_numbers',
      confidence: 0.4,
      entities: { numbers: numbers.map(Number) },
      thinking: [
        '未匹配到明确意图',
        `检测到数字：${numbers.join(', ')}`,
        '建议用户使用更明确的指令',
      ],
    };
  }

  return {
    type: 'unknown',
    confidence: 0.2,
    entities: {},
    thinking: [
      '未识别到明确意图',
      '建议用户参考快捷指令或使用更具体的描述',
    ],
  };
}

const INTENT_LABELS: Record<string, string> = {
  create_product: '创建新品',
  create_product_full: '一步创建新品',
  set_first_week_cups: '设置首周日均杯量',
  set_first_month_cups: '设置首月日均杯量',
  set_launch_date: '设置上市日期',
  set_scope: '设置上新范围',
  select_all_materials: '选择全部物料',
  deselect_material: '取消选择物料',
  select_only: '仅选择指定物料',
  adjust_region_coeff: '调整区域系数',
  show_similar_products: '查看相似产品',
  run_calculation: '执行计算',
  recalculate: '重新计算',
  adjust_coefficient: '调整系数',
  negotiate_moq: '协商MOQ',
  confirm: '确认方案',
  export_excel: '导出Excel',
  next_step: '下一步',
  prev_step: '上一步',
  help: '帮助',
};

// 每步的快捷指令
export const QUICK_COMMANDS: Record<number, { label: string; text: string }[]> = {
  1: [
    { label: '📝 创建新品', text: '帮我创建新品，叫苹果莲雾汁，首周日均15000杯，首月日均16000杯' },
    { label: '📅 设置日期', text: '上市日期是2026-07-24' },
    { label: '🌍 设置范围', text: '上新范围是全国' },
    { label: '➡️ 下一步', text: '下一步' },
  ],
  2: [
    { label: '✅ 全选物料', text: '选择全部核心物料' },
    { label: '❌ 去掉杯盖', text: '去掉定制杯盖' },
    { label: '➡️ 下一步', text: '下一步' },
  ],
  3: [
    { label: '📊 看相似产品', text: '看看相似历史新品' },
    { label: '🔧 调华东系数', text: '调整华东区域系数为1.8' },
    { label: '➡️ 下一步', text: '下一步' },
  ],
  4: [
    { label: '🔢 开始预测', text: '开始门店级杯量预测' },
    { label: '➡️ 下一步', text: '下一步' },
  ],
  5: [
    { label: '🧮 计算物料', text: '执行物料量计算' },
    { label: '➡️ 下一步', text: '下一步' },
  ],
  6: [
    { label: '📦 汇总到仓', text: '执行效期校验并汇总到仓' },
    { label: '➡️ 下一步', text: '下一步' },
  ],
  7: [
    { label: '🔧 调低系数', text: '调低区域系数为1.8' },
    { label: '📉 降MOQ', text: '协商MOQ降到30' },
    { label: '🔄 重新计算', text: '重新计算' },
    { label: '➡️ 下一步', text: '下一步' },
  ],
  8: [
    { label: '✅ 确认方案', text: '确认备货方案' },
    { label: '📥 导出Excel', text: '导出Excel' },
  ],
};
