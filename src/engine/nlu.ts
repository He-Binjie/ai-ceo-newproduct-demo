// NLU 意图解析（增强版 - 支持参数修改意图）

export interface ParsedIntent {
  type: string;
  entities: Record<string, any>;
  thinking?: string[];
}

export function parseIntent(text: string): ParsedIntent {
  const lower = text.toLowerCase().trim();

  // ===== 基础导航意图 =====
  if (/确认|继续|ok|好|可以|没问题|next/.test(lower)) {
    return { type: 'confirm', entities: {}, thinking: ['解析用户意图：确认当前步骤'] };
  }
  if (/下一步|next step/.test(lower)) {
    return { type: 'next_step', entities: {}, thinking: ['解析用户意图：进入下一步'] };
  }
  if (/上一步|prev|返回/.test(lower)) {
    return { type: 'prev_step', entities: {}, thinking: ['解析用户意图：返回上一步'] };
  }
  if (/导出|excel|下载/.test(lower)) {
    return { type: 'export_excel', entities: {}, thinking: ['解析用户意图：导出Excel'] };
  }
  if (/帮助|help|怎么用/.test(lower)) {
    return { type: 'help', entities: {} };
  }

  // ===== 参数修改意图 =====

  // 修改门店数
  const storeCountMatch = text.match(/门店[数量]*[改调设修]*[成为到至]?\s*(\d+)/);
  if (storeCountMatch) {
    return {
      type: 'modify_store_count',
      entities: { storeCount: parseInt(storeCountMatch[1]) },
      thinking: [`解析用户意图：修改门店数为 ${storeCountMatch[1]}`],
    };
  }

  // 修改首周日均杯数
  const firstWeekCupsMatch = text.match(/(?:首周|第一周|w1)[日均]*杯[数量]*[改调设修]*[成为到至]?\s*(\d+)/);
  if (firstWeekCupsMatch) {
    return {
      type: 'modify_first_week_cups',
      entities: { firstWeekDailyCups: parseInt(firstWeekCupsMatch[1]) },
      thinking: [`解析用户意图：修改首周日均杯数为 ${firstWeekCupsMatch[1]}`],
    };
  }

  // 修改首月日均杯数
  const firstMonthCupsMatch = text.match(/(?:首月|第一个月)[日均]*杯[数量]*[改调设修]*[成为到至]?\s*(\d+)/);
  if (firstMonthCupsMatch) {
    return {
      type: 'modify_first_month_cups',
      entities: { firstMonthDailyCups: parseInt(firstMonthCupsMatch[1]) },
      thinking: [`解析用户意图：修改首月日均杯数为 ${firstMonthCupsMatch[1]}`],
    };
  }

  // 修改区域系数（如"湖北系数改成1.1"）
  const regionCoeffMatch = text.match(/(.+?)(?:子公司)?系数[改调设修]*[成为到至]?\s*(\d+\.?\d*)/);
  if (regionCoeffMatch) {
    return {
      type: 'modify_region_coefficient',
      entities: { subsidiary: regionCoeffMatch[1].trim(), coefficient: parseFloat(regionCoeffMatch[2]) },
      thinking: [`解析用户意图：修改 ${regionCoeffMatch[1].trim()} 区域系数为 ${regionCoeffMatch[2]}`],
    };
  }

  // 修改杯占比（如"W1杯占比改成0.06"）
  const cupRatioMatch = text.match(/(?:W|第)(\d)[周]?杯占比[改调设修]*[成为到至]?\s*(\d+\.?\d*)/);
  if (cupRatioMatch) {
    return {
      type: 'modify_cup_ratio',
      entities: { week: parseInt(cupRatioMatch[1]), ratio: parseFloat(cupRatioMatch[2]) },
      thinking: [`解析用户意图：修改第${cupRatioMatch[1]}周杯占比为 ${cupRatioMatch[2]}`],
    };
  }

  // 取消/选择物料（如"取消椰子水"）
  const materialToggleMatch = text.match(/(取消|去掉|移除|选择|勾选|加上)(.+)/);
  if (materialToggleMatch) {
    const action = /取消|去掉|移除/.test(materialToggleMatch[1]) ? 'deselect' : 'select';
    return {
      type: 'toggle_material',
      entities: { materialName: materialToggleMatch[2].trim(), action },
      thinking: [`解析用户意图：${action === 'deselect' ? '取消选择' : '选择'}物料 ${materialToggleMatch[2].trim()}`],
    };
  }

  // 修改备货系数（如"铁观音备货系数改成1.2"）
  const stockCoeffMatch = text.match(/(.+?)备货系数[改调设修]*[成为到至]?\s*(\d+\.?\d*)/);
  if (stockCoeffMatch) {
    return {
      type: 'modify_stock_coefficient',
      entities: { materialName: stockCoeffMatch[1].trim(), stockCoefficient: parseFloat(stockCoeffMatch[2]) },
      thinking: [`解析用户意图：修改 ${stockCoeffMatch[1].trim()} 备货系数为 ${stockCoeffMatch[2]}`],
    };
  }

  // 重跑/重新计算
  if (/重跑|重新计算|重算|再算/.test(lower)) {
    return {
      type: 'recalculate',
      entities: {},
      thinking: ['解析用户意图：重新执行计算'],
    };
  }

  // 发送通知
  const notifyMatch = text.match(/发送[给到]?\s*(.+)/);
  if (notifyMatch) {
    return {
      type: 'send_notification',
      entities: { recipients: notifyMatch[1].trim() },
      thinking: [`解析用户意图：发送通知给 ${notifyMatch[1].trim()}`],
    };
  }

  // 调整上新日期
  const launchDateMatch = text.match(/(?:上新|上市|发售)(?:日期|时间)?[改调设修]*[成为到至]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  if (launchDateMatch) {
    return {
      type: 'modify_launch_date',
      entities: { launchDate: launchDateMatch[1] },
      thinking: [`解析用户意图：修改上新日期为 ${launchDateMatch[1]}`],
    };
  }

  return { type: 'unknown', entities: {} };
}

export const QUICK_COMMANDS: Record<number, { label: string; text: string }[]> = {
  1: [
    { label: '✅ 确认信息', text: '确认，继续' },
    { label: '✏️ 修改门店数', text: '门店数改成7200' },
    { label: '✏️ 修改首周杯数', text: '首周日均杯数改成650' },
  ],
  2: [
    { label: '✅ 全选确认', text: '确认，继续' },
    { label: '☐ 取消椰子水', text: '取消椰子水' },
    { label: '☐ 取消凤梨汁', text: '取消冷冻凤梨汁' },
  ],
  3: [
    { label: '✅ 确认系数', text: '确认，继续' },
    { label: '✏️ 调整湖北', text: '湖北系数改成1.1' },
    { label: '✏️ 调整广东', text: '广东系数改成1.05' },
  ],
  4: [
    { label: '✅ 确认预测', text: '确认，继续' },
    { label: '✏️ 修改W1杯占比', text: 'W1杯占比改成0.06' },
  ],
  5: [
    { label: '✅ 确认计算', text: '确认，继续' },
    { label: '🔄 调参重跑', text: '调整参数后重跑' },
  ],
  6: [
    { label: '✅ 确认汇总', text: '确认，继续' },
  ],
  7: [
    { label: '✅ 使用默认值', text: '确认，继续' },
  ],
  8: [
    { label: '✅ 确认预警', text: '确认，继续' },
    { label: '🔄 调参重跑', text: '调整区域系数后重跑' },
  ],
  9: [
    { label: '✅ 确认MOQ', text: '确认，继续' },
  ],
  10: [
    { label: '✅ 确认统配', text: '确认，继续' },
  ],
  11: [
    { label: '✅ 确认安全库存', text: '确认，继续' },
    { label: '✏️ 修改备货系数', text: '安溪铁观音备货系数改成1.2' },
  ],
  12: [
    { label: '📥 导出Excel', text: '导出Excel' },
    { label: '📤 发送通知', text: '发送给罗雄和王敏' },
  ],
};
