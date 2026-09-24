// C：页面内叙事（每步"在回答什么 / 可改什么 / 对应 PRD 步骤"）
// 依据：decision 2026-09-23「叙事脚本在页面中体现，不出独立脚本文件」
// 术语口径：PRD V7.6（12 步算法链 / 四分类预警 / §三 可修改的值）

export type NarrativeEntry = {
  /** 这一步在回答什么（结论导向的一句话口播） */
  question: string;
  /** 本步页面上能直接改什么 */
  canEdit: string;
  /** 对应 PRD V7.6 的步骤编号 */
  prdSteps: string;
};

/** key = RIGHT_TABS 的 step（0 监控入口 / 1-4 四步 / 5 参数面板） */
export const NARRATIVE: Record<number, NarrativeEntry> = {
  0: {
    // 2026-09-24：首页监控数据已按 PRD V7.8 §5.4 全部删除（看板载体＝智能问数看板），本 Tab 只剩指路卡
    question: '这批新品现在卖得怎么样、要不要动手？',
    canEdit: '不在本页改 —— 看数据进「智能问数 → 看板 → 新品监控」；预警走飞书推送',
    prdSteps: '⑫ 上新期间监控（§5.4 六项指标看板载体＝智能问数看板 + C 类 2 条预警）',
  },
  1: {
    question: '卖得动的门店有多少、每家每天能卖多少杯？',
    canEdit: '开封效期 / 损耗率 → 点表格里的数字直接改',
    prdSteps: '① 新品信息读取 + ② 门店级杯量预测',
  },
  2: {
    question: '每个区域该放大多少倍、每箱料能出多少杯？',
    canEdit: '区域系数（24 个子公司）/ 备货系数 / W1-W4 占比',
    prdSteps: '③ 区域系数 + ④ 物料量计算 + ⑤ 效期校验',
  },
  3: {
    question: '每个仓要备多少、哪家供应商供哪个仓、有没有超标？',
    canEdit: '供应商份额 / MOQ → 分配表内逐行改（份额合计须 = 100%）',
    prdSteps: '⑥ 汇总到仓 + ⑦ 供应商分配 + ⑧⑨ 检测 + ⑩ 统配比对',
  },
  4: {
    question: '最终方案是多少、能不能直接下单？',
    canEdit: '安全库存天数 → 参数面板',
    prdSteps: '⑪ 安全库存校验 + 结果输出（6 Sheet 对接 SCM）',
  },
  5: {
    question: '一共哪些参数能改、在哪改、改完什么时候生效？',
    canEdit: '全部 10 项 —— 页面直接改是主入口',
    prdSteps: 'PRD §三 可修改的值及修改方式',
  },
};

export type GuideStep = {
  n: number;
  title: string;
  /** 结论先行的一句话口播（演示时读这句就够） */
  oneLiner: string;
  prd: string;
  canEdit: string;
  keyNumber: string;
};

/** 左侧步骤条 / 讲解卡共用的 5 步口播词（对应 PRD 12 步算法链） */
export const GUIDE_STEPS: GuideStep[] = [
  {
    n: 1,
    title: '选择新品 · 读取信息',
    oneLiner: '这次要给两款新品分货：先看清能卖得动的门店有多少、店与店的量差多少。',
    prd: '⓪ 选择新品 + ① 新品信息读取',
    canEdit: '—（只读）',
    keyNumber: '在营门店 7,188 家 ｜ 大盘首周 609 杯 / 首月 650 杯',
  },
  {
    n: 2,
    title: '区域系数 · BOM 拆解',
    oneLiner: '不平均分：每个区域按历史新品的真实表现放大，高于 1 的照算、低于 1 的一律兜底到 1 —— 宁多勿缺。',
    prd: '③ 区域系数 + ④ 物料量计算 + ⑤ 效期校验',
    canEdit: '区域系数 / 备货系数 / W1-W4 占比',
    keyNumber: '8 个子公司兜底 ｜ 最高 湖北 1.196',
  },
  {
    n: 3,
    title: '汇总到仓 · 供应商 · 检测',
    oneLiner: '7,188 家门店的量按仓店映射归到 8 个仓，再按份额和 MOQ 落到供应商；同时跑 3 项过程检测，超标只提醒、不阻断。',
    prd: '⑥ 汇总到仓 + ⑦ 供应商分配 + ⑧⑨ 检测 + ⑩ 统配比对',
    canEdit: '供应商份额 / MOQ',
    keyNumber: '冷冻生椰乳备货偏差 +12.1%（超 10%，可继续下一步）',
  },
  {
    n: 4,
    title: '结果输出',
    oneLiner: '输出每个仓每个物料的下单量，6 个 Sheet 直接对接 SCM 下单。',
    prd: '⑪ 安全库存校验 + 结果输出',
    canEdit: '安全库存天数',
    keyNumber: '4 个物料全通过 ｜ 异常统配门店 12 家',
  },
  {
    n: 5,
    title: '参数调整',
    oneLiner: '任何数字不满意都能当场改：页面上点一下，或者直接跟我说一句话。',
    prd: '§三 可修改的值（页面直接改为主入口）',
    canEdit: '10 项全部',
    keyNumber: '页面改即时生效 ｜ 底表改 15–20 分钟后生效',
  },
];

/** PRD 12 步 ↔ Demo 5 步 映射（消除讲解时的脑内翻译） */
export const STEP_MAPPING = [
  { demo: '① 选择新品 · 读取信息', prd: '⓪ 选品 → ① 信息读取 → ② 门店级预测' },
  { demo: '② 区域系数 · BOM 拆解', prd: '③ 区域系数 → ④ 物料量 → ⑤ 效期校验' },
  { demo: '③ 汇总到仓 · 供应商 · 检测', prd: '⑥ 汇总到仓 → ⑦ 供应商分配 → ⑧⑨ 检测 → ⑩ 统配比对' },
  { demo: '④ 结果输出', prd: '⑪ 安库校验 + 下单VS大盘 + 输出' },
  { demo: '首页 监控看板', prd: '⑫ 上新期间库存监控（T+1~T+28）' },
];