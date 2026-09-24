import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './styles.css';
import type { ChatMessage, NewProductInfo, BOMMaterial, RegionCoefficient, ConfirmAction, ParamItem } from './types';
import { mockProduct, mockMaterials, aggregatedMaterials, mockRegionCoefficients, historicalProducts, historicalProductsDetail, newProductList, mockBOMRecordsProduct2, mockSystemDataProduct2, mockWarehouseDistributionCompare, paramList, supplierRoot } from './data/mock';
import { parseIntent } from './engine/nlu';
import { NARRATIVE, GUIDE_STEPS, STEP_MAPPING } from './data/narrative';
import { EditableNumber, ChangeLogPanel, ToastHost, usePageValue, useValueVersion, getPageValue, setPageValue, setPageValueAll, setPageValueSmart, addChange } from './components/InlineEdit';
import { Icon } from './components/Icon';
import { useCalc, MOQ_DEFAULTS } from './engine/calcInput';
import { weekMinQty } from './engine/calculator';

// 简化为5步
const STEP_LABELS = ['选择新品', '预测杯量', '系数修正+BOM拆解', '汇总到仓+供应商', '结果输出'];

// V2.16：右侧 Tab 显式定义（原由 STEP_LABELS 推导），新增「监控入口」（首页默认视图）与「参数面板」
const RIGHT_TABS: Array<{ step: Step; label: string; icon?: string; always?: boolean }> = [
  // 2026-09-24：Tab 0 原为「监控看板」，首页监控数据已按 PRD V7.8 全部删除（看板载体＝智能问数看板），
  // 本 Tab 只剩一张指路卡 ⇒ 标签改为「监控入口」。
  { step: 0, label: '监控入口', icon: 'chart', always: true },
  { step: 1, label: '预测杯量' },
  { step: 2, label: '系数修正+BOM拆解' },
  { step: 3, label: '汇总到仓+供应商' },
  { step: 4, label: '结果输出' },
  { step: 5, label: '参数面板', icon: 'settings' },
];

const SKILLS = [
  // tile / tileBg / tileFg：对齐朱仙 V4.3 技能弹层的 .hp-skill-ico 规范（34×34 圆角 10 的彩色单字块）。
  // 「新品分仓备货」「缺货归因」两项与她那边同一技能，**色值逐字照抄她的**（#dcfce7/#15803d、#fee2e2/#b91c1c）；
  // 另外两个按她同一套「浅底 + 深字」规则补（蓝/琥珀），不要改成 emoji 或只留 SVG 图标。
  { id: 'newproduct', name: '新品分仓备货', icon: 'box', desc: '新品从录入到备货方案全流程', tile: '新', tileBg: '#dcfce7', tileFg: '#15803d' },
  { id: 'query', name: '智能问数', icon: 'chart', desc: '自然语言查询供应链数据', tile: '数', tileBg: '#dbeafe', tileFg: '#1d4ed8' },
  { id: 'stockout', name: '缺货归因', icon: 'alert', desc: '缺货原因分析与补货建议', tile: '缺', tileBg: '#fee2e2', tileFg: '#b91c1c' },
  { id: 'forecast', name: '销量预测', icon: 'trend', desc: '基于历史数据的销量预测', tile: '测', tileBg: '#fef3c7', tileFg: '#b45309' },
];

type Step = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * 合并问数模块（B 方案 · 同文档挂载）：
 *   壳只有一个（我们的 header），技能切换＝两个顶层容器的可见性切换。
 *   'newproduct' = 我们的新品分仓（#np-root 里的主内容区可见）
 *   'wenshu'     = 朱仙的问数整页（#wenshu-root 可见，我们的 .main-content 藏起来）
 * 可见性规则落在 src/wenshu-shell.css（用 html[data-skill] 选择器，不用 body.className ——
 * 她的 JS 会整体重写 body.className，用 body 类做技能态会被她的移动端逻辑冲掉）。
 */
type SkillMode = 'newproduct' | 'wenshu';

/** 她 header 槽位搬进我们 header 用的挂载点 id（搬家用 appendChild 移动同一批 DOM 节点） */
const WENSHU_SLOT_IDS = ['wenshu-header-center', 'wenshu-header-right'] as const;

// ============ B-4：参数「粒度清单」（三入口同源用） ============
// 页面内联编辑 / 参数面板 / 对话 三处写同一份 value store；
// 对话入口用下面的 known 列表做智能匹配，避免出现「对话说改了、表格没变」。
const GRAN_REGION = mockRegionCoefficients.map(r => r.subsidiary);
const GRAN_MATERIAL = mockMaterials.map(m => m.materialName);
const GRAN_SUPPLIER = supplierRoot.flatMap(g => g.rows.map(([k]) => k));

/** 「周可供量」＝业务侧提供的展示值（PRD：系统不配置产能字段，不参与计算） */
const SUPPLY_CAPACITY: Record<string, string> = {
  '安溪铁观音-1 / 福建安溪茶业A': '50,000',
  '安溪铁观音-2 / 云南普洱供应链B': '30,000',
  '莲雾苹果汁 / 海南果汁工厂C': '400,000',
  '冷冻生椰乳 / 椰树供应链D': '120,000',
  '冷冻生椰乳 / 海南椰品E': '60,000',
  '东方美人乌龙茶-A / 台湾茶业F': '35,000',
};

/** 对话入口写页面用的 apply 载荷 */
type ParamApply = { param: string; gran: string; value: number; syncAll?: boolean; known: string[] };

// 参数调整解析器 — 返回 targetStep 用于自动定位
function parseParameterAdjustment(text: string): { response: string; thinking: string[]; targetStep: Step; apply?: ParamApply } | null {
  const lower = text.toLowerCase();

  // 区域系数调整 → Step 2
  const regionMatch = text.match(/(?:调整|修改|设置)\s*区域系数\s*(\S+)\s+([\d.]+)/);
  if (regionMatch) {
    const [, subsidiary, value] = regionMatch;
    return {
      response: `✅ 已调整区域系数\n\n• **${subsidiary}**：→ **${value}**\n\n**参数已重算**（真算：物料量 → 汇总到仓 → 偏差率 → 预警） 右侧面板已跳转到 Step 2，请确认重算结果。\n\n💡 你还可以继续调整：\n• "调整区域系数 广东 1.05"\n• "调整备货系数 莲雾苹果汁 1.2"\n• "调整W1占比 0.06"\n• "安全库存改成7天"`,
      thinking: [`修改区域系数：${subsidiary} → ${value}`, `自动定位到 Step 2 系数修正`, `已按新值重算（真算）：系数 → 物料量 → 汇总到仓 → 偏差率 → 预警`],
      targetStep: 2,
      apply: { param: '区域系数', gran: `${subsidiary}子公司`, value: Number(value), known: GRAN_REGION },
    };
  }

  // 备货系数调整 → Step 2
  const stockMatch = text.match(/(?:调整|修改|设置)\s*备货系数\s*(\S+)\s+([\d.]+)/);
  if (stockMatch) {
    const [, material, value] = stockMatch;
    return {
      response: `✅ 已调整备货系数\n\n• **${material}**：→ **${value}**\n\n**参数已重算**（真算：物料量 → 汇总到仓 → 偏差率 → 预警） 右侧面板已跳转到 Step 2，请确认重算结果。\n\n💡 你还可以继续调整其他参数。`,
      thinking: [`修改备货系数：${material} → ${value}`, `自动定位到 Step 2 BOM拆解`, `已按新值重算（真算）：备货系数 → 应用率/物料量 → 汇总到仓 → 偏差率`],
      targetStep: 2,
      apply: { param: '备货系数', gran: material, value: Number(value), known: GRAN_MATERIAL },
    };
  }

  // W1-W4占比调整 → Step 2
  const wMatch = text.match(/(?:调整|修改|设置)\s*(W[1-4])\s*占比\s+([\d.]+)/);
  if (wMatch) {
    const [, week, value] = wMatch;
    return {
      response: `✅ 已调整${week}占比\n\n• **${week}**：→ **${value}**\n\n⚠️ W1-W4为成品维度参数，修改后所有物料同步生效。\n\n**参数已重算**（真算：物料量 → 汇总到仓 → 偏差率 → 预警） 右侧面板已跳转到 Step 2，请确认重算结果。`,
      thinking: [`修改${week}占比 → ${value}（成品维度，全物料生效）`, `自动定位到 Step 2 物料量计算`, `已按新值重算（真算）：${week} 杯占比（全物料）→ 物料量 → 汇总到仓`],
      targetStep: 2,
      apply: { param: `${week} 杯占比`, gran: '', value: Number(value), syncAll: true, known: [] },
    };
  }

  // 售卖天数 N（仓实际日均杯量分母）→ Step 5 参数面板
  const sellNMatch = text.match(/(?:售卖天数)\s*(?:改成|调整为|设置为?)\s*(\d+)\s*天?/);
  if (sellNMatch) {
    const [, days] = sellNMatch;
    return {
      response: `✅ 已调整**售卖天数 N**\n\n• 售卖天数 N：7天 → **${days}天**（最近 ${days} 天、不含当天）\n• 影响：**仓实际日均杯量 = 仓对应门店成品销售杯量 ÷ 售卖天数**（监控看板「仓实际日均杯量」与「仓偏差率」随之重算）\n\n**参数已重算**（真算：物料量 → 汇总到仓 → 偏差率 → 预警） 右侧面板已跳转到「参数面板」，请确认。`,
      thinking: [`修改售卖天数 N：7 → ${days} 天`, '重算仓实际日均杯量分母', '联动重算仓偏差率 / 全国偏差率'],
      targetStep: 5,
      apply: { param: '售卖天数 N', gran: '全局', value: Number(days), known: ['全局'] },
    };
  }

  // 订货天数 N（仓库可售天数分母）→ Step 5 参数面板
  const orderNMatch = text.match(/(?:订货天数)\s*(?:改成|调整为|设置为?)\s*(\d+)\s*天?/);
  if (orderNMatch) {
    const [, days] = orderNMatch;
    return {
      response: `✅ 已调整**订货天数 N**\n\n• 订货天数 N：7天 → **${days}天**（最近 ${days} 天）\n• 影响：**仓库可售天数 = 物料可用库存 ÷ 仓物料订货日均**，其中订货日均 = 订货量 ÷ 订货天数 N（监控看板「仓库可售天数」与库存预警随之重算）\n\n**参数已重算**（真算：物料量 → 汇总到仓 → 偏差率 → 预警） 右侧面板已跳转到「参数面板」，请确认。`,
      thinking: [`修改订货天数 N：7 → ${days} 天`, '重算仓物料订货日均（订货量 ÷ N 天）', '联动重算仓库可售天数 / 库存预警'],
      targetStep: 5,
      apply: { param: '订货天数 N', gran: '全局', value: Number(days), known: ['全局'] },
    };
  }

  // 安全库存天数调整 → Step 3
  const safetyMatch = text.match(/(?:安全库存|安库)\s*(?:改成|调整为|设置为?)\s*(\d+)\s*天?/);
  if (safetyMatch) {
    const [, days] = safetyMatch;
    return {
      response: `✅ 已调整安全库存天数\n\n• 安全库存：7天 → **${days}天**\n\n**参数已重算**（真算：物料量 → 汇总到仓 → 偏差率 → 预警） 右侧面板已跳转到 Step 3，请确认重算结果。`,
      thinking: [`修改安全库存天数：7天 → ${days}天`, `自动定位到 Step 3 偏差率检测`, `已按新阈值重算（真算）安库校验（可销售天数 vs N 天）`],
      targetStep: 3,
      apply: { param: '安全库存天数', gran: '全局', value: Number(days), known: ['全局'] },
    };
  }

  // 供应商设置 → Step 3
  const supplierMatch = text.match(/(?:设置|调整)\s*供应商\s+(\S+)\s+(\S+)\s+(\d+)%?\s*(?:MOQ\s*)?(\d+)?/i);
  if (supplierMatch) {
    const [, material, supplier, share, moq] = supplierMatch;
    return {
      response: `✅ 已设置供应商信息\n\n• **${material}**\n  - 供应商：${supplier}\n  - 份额：${share}%\n  - MOQ：${moq || '1（默认）'}\n\n💡 份额之和必须=100%，可继续添加其他供应商。\n\n**参数已重算**（真算：物料量 → 汇总到仓 → 偏差率 → 预警） 右侧面板已跳转到 Step 3，请确认重算结果。`,
      thinking: [`设置供应商：${material} → ${supplier} ${share}% MOQ=${moq || 1}`, `自动定位到 Step 3 供应商分配`, `已按新值重算（真算）：份额 → 需求分配量 → MOQ 取整 → 下单量`],
      targetStep: 3,
      apply: { param: '供应商份额', gran: `${material} / ${supplier}`, value: Number(share), known: GRAN_SUPPLIER },
    };
  }

  // 帮助/可调参数列表 — 不跳转
  if (lower.includes('可调') || lower.includes('调参') || lower.includes('修改参数') || lower.includes('帮助') || lower.includes('help')) {
    return {
      response: `📋 **可调整参数清单**\n\n以下参数支持在对话中直接输入修改：\n\n**1. 区域系数**（分公司维度）→ 影响 Step 2\n• 格式：\`调整区域系数 湖北 1.1\`\n• 说明：修改某子公司的区域系数\n\n**2. 备货系数**（物料维度）→ 影响 Step 2\n• 格式：\`调整备货系数 莲雾苹果汁 1.2\`\n• 说明：修改某物料的备货系数\n\n**3. W1-W4占比**（成品维度）→ 影响 Step 2\n• 格式：\`调整W1占比 0.06\`\n• 说明：修改后所有物料同步生效\n\n**4. 安全库存天数** → 影响 Step 3\n• 格式：\`安全库存改成7天\`\n• 说明：默认7天\n\n**5. 供应商信息** → 影响 Step 3\n• 格式：\`设置供应商 莲雾苹果汁 供应商A 40% MOQ500\`\n• 说明：份额之和必须=100%\n\n**6. 售卖天数 N**（全局，默认7天）→ 影响监控看板\n• 格式：\`售卖天数改成5天\`\n• 说明：「仓实际日均杯量」分母，最近 N 天、不含当天\n\n**7. 订货天数 N**（全局，默认7天）→ 影响监控看板\n• 格式：\`订货天数改成5天\`\n• 说明：「仓库可售天数」分母（仓物料订货日均 = 订货量 ÷ N 天）\n\n💡 所有参数也都可以在右侧「⚙️ 参数面板」里直接改（页面直接编辑）。`,
      thinking: ['展示可调参数清单'],
      targetStep: 0 as Step, // 0 means no navigation
    };
  }

  return null;
}

function App() {
  const [step, setStep] = useState<Step>(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [productInfo] = useState<NewProductInfo>({ ...mockProduct });
  const [materials] = useState<BOMMaterial[]>(mockMaterials.map(m => ({ ...m })));
  const [regions] = useState<RegionCoefficient[]>(mockRegionCoefficients.map(r => ({ ...r })));
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeSkill, setActiveSkill] = useState(SKILLS[0]);
  // 合并问数模块（朱仙 V4.3）：壳只有一个，选「智能问数」时把可见性交给她的整页
  const [skillMode, setSkillMode] = useState<SkillMode>('newproduct');
  const [selectedProduct, setSelectedProduct] = useState<string[]>([]);
  const [activeBOMTab, setActiveBOMTab] = useState(0);
  const [skillSelected, setSkillSelected] = useState(false);
  const [showSkillPopup, setShowSkillPopup] = useState(false);
  const [showGuide, setShowGuide] = useState(false); // C：演示讲解卡（默认收起）
  const [rightTab, setRightTab] = useState<Step>(1);
  const [tongpeiDone, setTongpeiDone] = useState(false);
  const [supplierDone, setSupplierDone] = useState(false);
  const [selectedHistoricalProducts, setSelectedHistoricalProducts] = useState<Set<string>>(
    () => new Set(historicalProductsDetail.map(p => p.name))
  );
  const [jumpedTab, setJumpedTab] = useState<Step | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  /** 最新的 showWelcome（见下方 __aiCeoSwitchSkill：跳回我们页面时重放欢迎语；showWelcome 定义在后面的行号） */
  const showWelcomeRef = useRef<() => void>(() => {});

  // Auto-switch right tab when step changes
  useEffect(() => {
    if (step >= 1) setRightTab(step);
  }, [step]);

  // ============ 合并问数模块（B 方案）：技能态 → DOM ============
  // ① 顶栏槽位搬移：把她的 #wenshu-header-center / #wenshu-header-right **移动**（不是复制）进我们 header，
  //    节点身份不变 → 她脚本里 getElementById 缓存的引用依然有效（规格 §3.3 方案 b）
  const slotsMoved = useRef(false);
  useEffect(() => {
    if (slotsMoved.current) return;
    slotsMoved.current = true;
    WENSHU_SLOT_IDS.forEach(id => {
      const node = document.getElementById(id);
      const holder = document.getElementById(`slot-${id}`);
      if (node && holder) {
        // 防御：产物不该带 hidden（hidden → display:none → 坑 1 的 echarts 0×0），
        // 可见性一律由 src/wenshu-shell.css 决定
        node.removeAttribute('hidden');
        holder.appendChild(node);
      } else console.warn(`[ai-ceo] 问数 header 槽位搬移失败：${id}`);
    });
  }, []);

  // ② 技能态 → html[data-skill]，可见性由 wenshu-shell.css 控制
  useEffect(() => {
    document.documentElement.dataset.skill = skillMode;
    // 坑 1（echarts 在不可见容器 init → 0 宽高）：我们用 visibility 而非 display 藏她的整页，
    // 容器始终有真实尺寸；这里再补一次 resize，让她自己的 resize 监听把图表按当前宽度重排。
    if (skillMode === 'wenshu') {
      const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
      return () => window.clearTimeout(t);
    }
  }, [skillMode]);

  // ③ 双向路由：她的技能弹层选「新品分货」→ 切回我们的新品分仓（见 public/wenshu/shell-bridge.js）
  //    ⚠️ 我方代码只允许暴露这一个 window 全局（规格 §4 坑 2：她 200+ 处 onclick 依赖 window 全局）
  //    ⚠️ 跳回来必须**重放欢迎语**（2026-09-24 实测）：进她的模块时我们清空了 messages，
  //       只切可见性的话回来会剩一个卡在「正在加载...」的空面板 —— 没有欢迎语、没有「开始新品分仓」入口 chip。
  //       用 ref 拿最新的 showWelcome（它在下面才定义，直接引用会踩块级作用域顺序）。
  useEffect(() => {
    (window as Window & { __aiCeoSwitchSkill?: (id: string) => void }).__aiCeoSwitchSkill = (id: string) => {
      setSkillMode(id === 'newproduct' ? 'newproduct' : 'wenshu');
      setActiveSkill(SKILLS.find(s => (id === 'newproduct' ? s.id === 'newproduct' : s.id === 'query')) ?? SKILLS[0]);
      if (id === 'newproduct') showWelcomeRef.current();
    };
    return () => {
      delete (window as Window & { __aiCeoSwitchSkill?: (id: string) => void }).__aiCeoSwitchSkill;
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const addBotMessage = useCallback((content: string, thinking?: string[], confirmActions?: ConfirmAction[], chips?: string[]) => {
    setMessages(prev => [...prev, {
      id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'assistant', content, timestamp: new Date(), thinking, confirmActions, chips,
    }]);
  }, []);

  const simulateTyping = useCallback((content: string, thinking?: string[], confirmActions?: ConfirmAction[], chips?: string[], delay = 800) => {
    setIsTyping(true);
    setTimeout(() => { setIsTyping(false); addBotMessage(content, thinking, confirmActions, chips); }, delay);
  }, [addBotMessage]);

  const confirmStep = (s: Step) => {
    if (s < 4) {
      const next = (s + 1) as Step;
      setStep(next);
      triggerStepMessage(next);
    }
  };

  const selectProduct = (productId: string) => {
    setSelectedProduct(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const confirmProductSelection = () => {
    if (selectedProduct.length > 0) {
      setStep(1);
      triggerStepMessage(1);
    }
  };

  const showWelcome = () => {
    setSkillSelected(true);
    setMessages([]);
    setTimeout(() => {
      addBotMessage(
        `你好！我是 **AI CEO 新品分仓助手** 📦\n\n基于历史新品数据预测新品首周/首月全国杯量，通过区域系数和备货系数修正后，经BOM拆解为物料需求，按仓库覆盖门店分配至各仓库，再按供应商份额与 MOQ 取整生成采购建议单。\n\n请选择操作开始：`,
        [],
        [],
        ['开始新品分仓'],
      );
    }, 300);
  };
  // 让 __aiCeoSwitchSkill（她的技能弹层 → 我们的新品分仓）拿到最新的 showWelcome
  useEffect(() => { showWelcomeRef.current = showWelcome; });

  const triggerStepMessage = (s: Step) => {
    switch (s) {
      case 0:
        simulateTyping(
          `当前有 **4** 个新品在上新周期内（前后2个月）。\n支持同时选择同系列多个品进行分仓（共用物料会自动聚合计算）。\n请选择要分仓的新品（可多选）：`,
          ['扫描上新周期：2026-06-08 ~ 2026-10-08', '筛选出4个新品（剔除已超期）'],
          [],
          newProductList.map(p => p.name),
        );
        break;
      case 1: {
        const selectedNames = selectedProduct.map(id => newProductList.find(p => p.id === id)?.name || id);
        const productInfos = selectedProduct.map(id => {
          if (id === 'np-001') return { name: '铁观音莲雾苹果', firstWeek: 609, firstMonth: 650 };
          if (id === 'np-002') return { name: '铁观音凤梨白月光', firstWeek: 580, firstMonth: 620 };
          if (id === 'np-003') return { name: '清沫观音', firstWeek: 520, firstMonth: 560 };
          if (id === 'np-004') return { name: '蜜桃脱咖茉莉', firstWeek: 450, firstMonth: 480 };
          return { name: id, firstWeek: 500, firstMonth: 540 };
        });
        const productDetails = productInfos.map(p => `📊 **${p.name}**\n• 大盘预测首周日均：**${p.firstWeek}**杯 | 首月日均：**${p.firstMonth}**杯`).join('\n\n');
        simulateTyping(
          `已从飞书多维表格读取 **${selectedNames.length}个新品** 的信息 ✅\n\n${productDetails}\n\n🏪 全部门店预测详见右侧（按品分Tab展示）\n\n⚠️ 数据一致性校验：首月日均 ≥ 首周日均 ✅`,
          ['读取飞书多维表格：新品基础信息表', '系统自动获取：滚动30天在营门店数', '抓取成品销售报表：7,188家门店', '计算门店销量占比 + 下限保护'],
          [{ label: '✅ 确认，继续', type: 'confirm' }],
        );
        break;
      }
      case 2:
        simulateTyping(
          `系数修正 + BOM拆解完成 ✅\n\n📐 **区域系数**（${historicalProducts.length}个历史品上新前两周实际销量占比比值）\n• 24个子公司：**8个兜底为1.0**，最高 **湖北(1.196)**\n• 基于上新前两周实际销售数据（不用预估数据）\n\n💡 **AI推荐：选择以下15个历史品（相似度≥80%）可使系数更精准**\n\n| 品名 | 品类 | 相似度 | 推荐理由 |\n|------|------|--------|----------|\n| 夏梦玫珑 | 果茶 | 92% | 果茶品类最高相似，区域分布一致 |\n| 小森林柚子 | 果茶 | 91% | 果茶+夏季上新，杯量曲线高度吻合 |\n| 肉桂橙大红袍 | 特调茶 | 90% | 特调茶基底相同，区域系数分布接近 |\n| 晴天罗勒桃 | 果茶 | 89% | 果茶品类，门店覆盖度相似 |\n| 白雾红尘 | 特调茶 | 88% | 特调茶经典品，实际占比比值稳定 |\n| 诶？橙柚康普 | 果茶 | 88% | 果茶+创新品类，区域表现参考性强 |\n| 草莓云顶大红袍 | 特调茶 | 87% | 同系列品，区域系数方差小 |\n| 芒果云顶大红袍 | 特调茶 | 86% | 同系列品，实际占比比值均值高 |\n| 嘿！菠萝马黛 | 果茶 | 86% | 果茶品类，夏季上新节奏一致 |\n| 归云南·云漫普洱 | 特调茶 | 85% | 特调茶+茶基底相似 |\n| 蜜瓜开心果椰 | 特调茶 | 84% | 特调茶+复合风味，区域分布参考 |\n| 龙井玄米酪 | 特调茶 | 83% | 特调茶品类，实际占比比值中位数接近 |\n| 归云南·云卷松风 | 特调茶 | 82% | 同系列品，区域表现一致 |\n| 耶～抹茶龙井 | 特调茶 | 81% | 茶基底相似，区域系数参考 |\n| 归云南 | 特调茶 | 80% | 同系列基准品，兜底参考 |\n\n排除轻因系列（4个，相似度63%-70%，品类差异大）。\n\n📦 **BOM拆解 → 物料需求**（${materials.filter(m=>m.selected).length}种核心物料）\n详见右侧面板。\n\n🧮 **物料量计算示例**（门店1101010005 × 莲雾苹果汁）\n\`\`\`\nW1 = 1077.92 × 1.2 × 0.05 × 7 ÷ 11.41 × 1.1 = 43.64\n预测总量 = Roundup(W1+W2+W3+W4) ✅\n\`\`\`\n\n全部计算公式和区域系数详见右侧面板。`,
          ['计算24个子公司区域系数（兜底<1.0→1.0）', 'BOM拆解：4种物料 × W1-W4', '核心公式：逐门店逐物料计算', 'Roundup向上取整 + 效期校验'],
          [{ label: '✅ 确认，继续', type: 'confirm' }, { label: '✏️ 使用AI推荐子集', type: 'edit' }],
        );
        break;
      case 3:
        simulateTyping(
          `汇总到仓 + 偏差率检测完成 ✅\n\n🏭 **汇总到仓**（仓店映射9,708条）\n• 北京二级仓：莲雾苹果汁 **13,399** 瓶\n• 详见右侧各仓库汇总\n\n📊 **偏差率检测（计算过程监控，非预警）**\n• 安溪铁观音：备货偏差 5.2%（分仓计算值 vs 理论需求量） ✅ ｜ MOQ 0.03% ✅ ｜ 安库 20.3天 ✅\n• 莲雾苹果汁：备货偏差 8.6%（分仓计算值 vs 理论需求量） ✅ ｜ MOQ 0.055% ✅ ｜ 安库 17.2天 ✅\n• 冷冻生椰乳：备货偏差 **12.1%**（分仓计算值 vs 理论需求量） ❌ 超阈值 ｜ MOQ 0.18% ✅ ｜ 安库 11.8天 ✅\n• 东方美人乌龙茶-A：备货偏差 3.8%（分仓计算值 vs 理论需求量） ✅ ｜ MOQ 0.24% ✅ ｜ 安库 20.0天 ✅\n\n📦 **仓级统配对比**\n• 湖北一级仓：偏差 12.6% ⚠️ 异常\n• 浙江一级仓：偏差 14.1% ⚠️ 异常\n• 其余6仓均在10%以内 ✅\n\n📦 **供应商数据**\n供应商分配数据是否已确认？确认后我将进行份额分配与MOQ取整。\n\n💡 **如需调整参数，可直接输入：**\n• "调整区域系数 湖北 1.1"\n• "调整备货系数 莲雾苹果汁 1.2"\n• "调整W1占比 0.06"\n• "安全库存改成7天"\n• 输入"帮助"查看完整参数清单`,
          ['读取仓店映射Sheet2：9,708条', '按仓库汇总门店物料量', '备货偏差 / MOQ取整 / 安全库存 — A 类计算过程检测（物料维度）'],
          [{ label: '✅ 供应商数据已确认', type: 'supplier_confirm' }, { label: '⏸️ 供应商数据未到，暂停', type: 'supplier_skip' }, { label: '🔄 调参重跑', type: 'recalculate' }],
        );
        break;
      case 4:
        simulateTyping(
          `🎉 **分仓备货方案生成完成！**\n\n📊 **全国物料最终方案**\n• 安溪铁观音：66,285 箱\n• 莲雾苹果汁：363,540 瓶\n• 冷冻生椰乳：138,345 瓶\n• 东方美人乌龙茶-A：28,655 袋\n\n📋 预警汇总：全部通过 ✅\n⚠️ 异常统配门店：12家（已标记）\n\n📥 导出Excel包含 **6个Sheet**：\n• Sheet1: 门店明细\n• Sheet2: 仓库汇总\n• Sheet3: 供应商分配\n• Sheet4: 预警清单\n• Sheet5: SCM导入模板\n• Sheet6: 仓级统配对比`,
          [],
          [{ label: '📥 导出Excel', type: 'export' }, { label: '📤 发送给相关人', type: 'notify' }, { label: '🔄 修改参数重跑', type: 'recalculate' }],
        );
        break;
    }
  };

  const handleUserInput = useCallback((text: string) => {
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`, role: 'user', content: text, timestamp: new Date(),
    }]);
    setInputText('');

    if (text === '开始新品分仓' || text === '查看当前上新周期新品') {
      setIsTyping(true);
      setTimeout(() => { setIsTyping(false); setStep(0); triggerStepMessage(0); }, 600);
      return;
    }

    if (text === '查看历史分仓记录') {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addBotMessage('📋 **历史分仓记录**\n\n最近3次分仓记录：\n• 2026-07-15：栀子花乌龙茶 → 已完成 ✅\n• 2026-06-01：轻因系列夏季版 → 已完成 ✅\n• 2026-04-20：芒果椰椰 → 已完成 ✅\n\n如需查看某次记录详情，请输入品名。');
      }, 600);
      return;
    }

    // 统配数据已到
    if (text === '统配数据已到' && step === 3 && !tongpeiDone) {
      setTongpeiDone(true);
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        simulateTyping(
          `⏰ **T-30 统配比对完成** ✅\n\n📊 **统配比对 — 门店1101010005（北京王府井APM店）**\n| 物料 | 预测 | 统配 | 统配外 | 合计 |\n|------|------|------|--------|------|\n| 安溪铁观音 | 16 | 6 | 10 | 16 |\n| 莲雾苹果汁 | 99 | 35 | 64 | 99 |\n| 冷冻生椰乳 | 32 | 12 | 20 | 32 |\n| 东方美人 | 8 | 0 | 8 | 8 |\n\n⚠️ 发现 **12** 家异常统配门店（统配>预测），已标记。\n\n统配外 = IF(预测-统配<0, 0, 预测-统配)\n\n详见右侧面板。确认后生成最终方案。`,
          ['读取统配清单', 'IF逻辑：统配外=IF(预测-统配<0, 0, 预测-统配)', '异常统配识别：统配>预测'],
          [{ label: '✅ 确认，生成方案', type: 'confirm' }],
        );
      }, 600);
      return;
    }

    // 供应商数据已确认
    if ((text === '供应商数据已确认' || text === '供应商已确认') && step === 3 && !supplierDone) {
      setSupplierDone(true);
      setRightTab(3);
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        simulateTyping(
          `📦 **供应商数据已确认** ✅\n\n已完成份额分配与MOQ取整：\n• 安溪铁观音：福建安溪茶业A(60%) + 云南普洱供应链B(40%)\n• 莲雾苹果汁：海南果汁工厂C(100%)\n• 冷冻生椰乳：椰树供应链D(70%) + 海南椰品E(30%)\n• 东方美人乌龙茶-A：台湾茶业F(100%)\n\n详见右侧「供应商分配表」与「AI推荐供应商→仓分配方案」。\n\n⏰ **统配数据（T-30出数）**\n统配数据是否已到？如果已到，我将继续进行统配比对和统配外计算。`,
          ['读取供应商主数据', '按份额分配采购量', 'MOQ取整校验'],
          [{ label: '✅ 统配数据已到，继续', type: 'confirm' }, { label: '⏸️ 统配数据未到，暂停', type: 'skip' }],
        );
      }, 600);
      return;
    }

    const matchedProduct = newProductList.find(p => p.name === text);
    if (matchedProduct) {
      selectProduct(matchedProduct.id);
      return;
    }

    // 参数调整识别 — 自动定位到对应step并重新引导计算
    const paramResult = parseParameterAdjustment(text);
    if (paramResult) {
      // B-4 三入口同源：对话入口同步写页面值（避免"对话说改了、表格没变"）
      let syncLine = '';
      if (paramResult.apply) {
        const a = paramResult.apply;
        let label: string | null = null;
        if (a.syncAll) { setPageValueAll(a.param, a.value); label = `${a.param}（全粒度同步）`; }
        else { label = setPageValueSmart(a.param, a.gran, a.value, a.known); }
        if (label) {
          addChange({ param: a.param, granularity: label, from: '表格原值', to: String(a.value), source: '对话', operator: '罗', effect: '见「参数面板」影响范围列' });
          syncLine = `\n\n📄 已同步到右侧表格：**${label} → ${a.value}**（真算：下游物料量/汇总/偏差率/预警已联动重算）`;
        }
      }
      // 自动定位到对应step的右侧面板 + 跳转动画
      if (paramResult.targetStep > 0 && step >= paramResult.targetStep) {
        setRightTab(paramResult.targetStep);
        setJumpedTab(paramResult.targetStep);
        setTimeout(() => setJumpedTab(null), 2000);
      }
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addBotMessage(paramResult.response + syncLine, paramResult.thinking, 
          paramResult.targetStep > 0 ? [{ label: '✅ 确认重算结果，继续', type: 'confirm' }, { label: '✏️ 继续调参', type: 'edit' }] : undefined
        );
      }, 600);
      return;
    }

    const intent = parseIntent(text);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      processIntent(intent, text);
    }, 600 + Math.random() * 400);
  }, [step, productInfo, materials, regions]);

  const processIntent = (intent: ReturnType<typeof parseIntent>, _rawText: string) => {
    const { type, thinking } = intent;
    switch (type) {
      case 'confirm': {
        if (step === 0) {
          addBotMessage('请先选择至少一个新品，然后点击"开始分仓"按钮。');
        } else {
          confirmStep(step);
        }
        break;
      }
      case 'next_step': {
        if (step < 4) {
          const next = (step + 1) as Step;
          setStep(next);
          triggerStepMessage(next);
        } else {
          addBotMessage('已经是最后一步了。请确认备货方案或导出Excel。');
        }
        break;
      }
      case 'prev_step': {
        if (step > 0) { setStep((step - 1) as Step); addBotMessage(`已返回 **${STEP_LABELS[step - 1]}**`); }
        break;
      }
      case 'export_excel': {
        addBotMessage(
          `📥 Excel 导出完成！\n\n文件名：**${productInfo.name}_分仓备货预测_${productInfo.launchDate}.xlsx**\n\n包含6个Sheet：\n• Sheet1: 门店明细（${productInfo.storeCount.toLocaleString()}门店 × ${materials.filter(m=>m.selected).length}物料 × W1-W4）\n• Sheet2: 仓库汇总（30+仓库）\n• Sheet3: 供应商分配\n• Sheet4: 预警清单\n• Sheet5: SCM导入模板\n• Sheet6: 仓级统配对比\n\n✅ 文件已保存到下载目录。\n✅ Sheet5可直接导入SCM系统。`,
          thinking,
        );
        break;
      }
      default: {
        addBotMessage(
          `收到！当前在 **${STEP_LABELS[step]}**\n\n你可以：\n• 点击确认按钮进入下一步\n• 输入"下一步"/"上一步"导航\n• 输入"帮助"查看所有指令`,
          thinking,
        );
      }
    }
  };

  const sendMessage = () => { if (!inputText.trim() || isTyping) return; handleUserInput(inputText.trim()); };

  const welcomeShown = useRef(false);
  useEffect(() => {
    if (!welcomeShown.current) {
      welcomeShown.current = true;
      showWelcome();
    }
  }, []);

  const flooredCount = regions.filter(r => r.isFloored).length;

  const handleSkillSelect = (skill: typeof SKILLS[0]) => {
    setActiveSkill(skill);
    setShowSkillPopup(false);
    if (skill.id === 'newproduct') {
      setSkillMode('newproduct');
      showWelcome();
    } else if (skill.id === 'query') {
      // 合并问数模块：她的整页接管（一个壳 + 技能切换），不再回「开发中」
      setSkillMode('wenshu');
      setSkillSelected(true);
      setMessages([]);
    } else {
      setSkillMode('newproduct');
      setSkillSelected(true);
      setMessages([]);
      setTimeout(() => {
        addBotMessage(`已切换到「${skill.name}」技能。\n\n该技能正在开发中，敬请期待。`);
      }, 300);
    }
  };

  // C：叙事条跟随当前可见视图（未选品时右侧显示首页监控看板）
  const narrativeTab = selectedProduct.length === 0 ? 0 : rightTab;

  return (
    <div className="app-container">
      {/* B-4：内联调参全局提示 */}
      <ToastHost />
      {/* Header */}
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="logo-text">熵海领航</span>
          <span className="logo-sub">AI CEO</span>
        </div>
        <div className="header-center">
          <span className="header-breadcrumb">经营首页</span>
          <span className="header-sep">/</span>
          <span className="header-current">{activeSkill.name}</span>
        </div>
        {/* 合并问数模块：她 topbar 中区（经营首页/自助取数/面包屑）搬进来的挂载点。
            holder 由 React 渲染，her 的节点在 useEffect 里被 appendChild 移动进来（节点身份不变）。 */}
        <div id="slot-wenshu-header-center" />
        <div className="user-info">
          <span className="mock-badge" title="分仓计算链路（杯量 → 物料量 → 汇总到仓 → 偏差率 → 检测）已按 PRD 公式真算，参数改动即时联动；底表仍为 mock 数据。首页监控数据已按 PRD V7.8 删除（6 项监控指标的看板载体＝智能问数看板 → 新品监控，粒度＝二级仓 × 核心物料）">底表 mock · 分仓链路已真算</span>
          <button className={`guide-btn ${showGuide ? 'active' : ''}`} onClick={() => setShowGuide(!showGuide)}>
            {showGuide ? '收起讲解' : '演示讲解'}
          </button>
          <span className="clock">{new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
          <div className="user-avatar">罗</div>
        </div>
        {/* 合并问数模块：她 topbar 右侧区（铃铛/时钟/我的）搬进来的挂载点 */}
        <div id="slot-wenshu-header-right" />
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Left: Chat Panel */}
        <div className="chat-panel">
          <div className="chat-header">
            <div className="chat-header-left">
              <span className="chat-header-title">AI CEO 助手</span>
              <span className="chat-header-status"><span className="status-dot" />在线</span>
            </div>
          </div>
          <div className="chat-messages">
            {skillSelected && messages.length === 0 && (
              <div className="welcome-section">
                <div className="welcome-avatar">
                  <svg viewBox="0 0 24 24" fill="white" width="36" height="36">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div className="welcome-text">正在加载...</div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`chat-msg ${msg.role}`}>
                {msg.role === 'assistant' ? (
                  <div className="chat-avatar bot-avatar-icon">
                    <svg viewBox="0 0 24 24" fill="white" width="16" height="16">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                ) : (
                  <div className="chat-avatar user-avatar-icon">罗</div>
                )}
                <div className="chat-bubble-wrapper">
                  {msg.thinking && msg.thinking.length > 0 && (
                    <div className="thinking-chain">
                      {msg.thinking.map((t, i) => (
                        <div key={i} className="thinking-step"><span className="step-icon">✓</span><span>{t}</span></div>
                      ))}
                    </div>
                  )}
                  <div className="chat-bubble">{formatMessage(msg.content)}</div>
                  {msg.chips && msg.chips.length > 0 && (
                    <div className="chips-row">
                      {msg.chips.map((chip, i) => {
                        const matchedProd = newProductList.find(p => p.name === chip);
                        const isSelected = matchedProd ? selectedProduct.includes(matchedProd.id) : false;
                        const isProductChip = !!matchedProd && step === 0;
                        return (
                          <button key={i} className={`chip-btn ${isProductChip && isSelected ? 'chip-selected' : ''}`} onClick={() => handleUserInput(chip)} disabled={isTyping}>
                            {isProductChip && <span style={{ marginRight: 4 }}>{isSelected ? '✓' : '☐'}</span>}
                            {chip}
                          </button>
                        );
                      })}
                      {step === 0 && msg.chips.some(c => newProductList.find(p => p.name === c)) && (
                        <button className="chip-btn chip-confirm" onClick={confirmProductSelection} disabled={isTyping || selectedProduct.length === 0} style={{ background: selectedProduct.length > 0 ? 'var(--accent)' : 'var(--border)', color: 'white', fontWeight: 600 }}>
                          开始分仓（已选{selectedProduct.length}品）
                        </button>
                      )}
                    </div>
                  )}
                  {msg.confirmActions && msg.confirmActions.length > 0 && (
                    <div className="confirm-actions">
                      {msg.confirmActions.map((action, i) => (
                        <button
                          key={i}
                          className={`confirm-btn confirm-btn-${action.type}`}
                          onClick={() => {
                            if (action.type === 'confirm') {
                              if (step === 3 && !tongpeiDone) {
                                // Step 3: 统配数据已到 → 展示统配比对结果
                                setTongpeiDone(true);
                                simulateTyping(
                                  `⏰ **T-30 统配比对完成** ✅\n\n📊 **统配比对 — 门店1101010005（北京王府井APM店）**\n| 物料 | 预测 | 统配 | 统配外 | 合计 |\n|------|------|------|--------|------|\n| 安溪铁观音 | 16 | 6 | 10 | 16 |\n| 莲雾苹果汁 | 99 | 35 | 64 | 99 |\n| 冷冻生椰乳 | 32 | 12 | 20 | 32 |\n| 东方美人 | 8 | 0 | 8 | 8 |\n\n⚠️ 发现 **12** 家异常统配门店（统配>预测），已标记。\n\n统配外 = IF(预测-统配<0, 0, 预测-统配)\n\n详见右侧面板。确认后生成最终方案。`,
                                  ['读取统配清单', 'IF逻辑：统配外=IF(预测-统配<0, 0, 预测-统配)', '异常统配识别：统配>预测'],
                                  [{ label: '✅ 确认，生成方案', type: 'confirm' }],
                                );
                              } else {
                                confirmStep(step);
                              }
                            }
                            else if (action.type === 'export') handleUserInput('导出Excel');
                            else if (action.type === 'recalculate') {
                              addBotMessage('🔄 **调参重跑**：已按当前参数重算一遍（真算），右侧物料量 / 汇总到仓 / 偏差率 / 预警全部按新参数刷新；变更留痕见「参数面板 → 变更日志」与「最近一次重算影响」。');
                              setTimeout(() => triggerStepMessage(step), 800);
                            }
                            else if (action.type === 'notify') addBotMessage('📤 已发送飞书通知 ✅');
                            else if (action.type === 'skip') {
                              if (step === 3 && !tongpeiDone) {
                                addBotMessage('⏸️ **统配数据未到，流程暂停**\n\n当前已完成：\n• ✅ 汇总到仓\n• ✅ 供应商分配\n• ✅ A 类计算过程检测 3 项（物料维度）\n\n等待统配数据到达后，输入"统配数据已到"或点击按钮继续。');
                              } else if (selectedHistoricalProducts.size < historicalProductsDetail.length) {
                                setSelectedHistoricalProducts(new Set(historicalProductsDetail.map(p => p.name)));
                                simulateTyping(
                                  '↩️ 已恢复使用 **全部23个历史品** 计算区域系数。\n\n右侧面板已更新，请确认。',
                                  ['恢复全部23个历史品', '重新计算24个子公司区域系数均值'],
                                  [{ label: '✅ 确认，继续', type: 'confirm' }],
                                );
                              } else {
                                addBotMessage('⏭️ 已跳过，继续下一步。');
                                confirmStep(step);
                              }
                            }
                            else if (action.type === 'edit') {
                              if (step === 2) {
                                const aiSubset = new Set(
                                  historicalProductsDetail.filter(p => p.similarity >= 0.80).map(p => p.name)
                                );
                                setSelectedHistoricalProducts(aiSubset);
                                setRightTab(2);
                                simulateTyping(
                                  `✅ 已切换为 **AI推荐子集**（${aiSubset.size}个历史品，相似度≥80%）\n\n区域系数已按新值重算（真算），物料量 / 汇总到仓 / 偏差率同步刷新，详见右侧面板。\n\n你可以在右侧面板中逐个勾选/取消历史品，进一步微调选择。`,
                                  ['筛选相似度≥80%的历史品：15个', '重新计算24个子公司区域系数均值', '右侧面板已更新'],
                                  [{ label: '✅ 确认，继续', type: 'confirm' }, { label: '↩️ 恢复全部23品', type: 'skip' }],
                                );
                              } else {
                                addBotMessage(`✏️ 请在对话中输入修改指令，或输入"返回修改"。`);
                              }
                            }
                            else if (action.type === 'supplier_confirm') {
                              setSupplierDone(true);
                              setRightTab(3);
                              simulateTyping(
                                `📦 **供应商数据已确认** ✅\n\n已完成份额分配与MOQ取整：\n• 安溪铁观音：福建安溪茶业A(60%) + 云南普洱供应链B(40%)\n• 莲雾苹果汁：海南果汁工厂C(100%)\n• 冷冻生椰乳：椰树供应链D(70%) + 海南椰品E(30%)\n• 东方美人乌龙茶-A：台湾茶业F(100%)\n\n详见右侧「供应商分配表」与「AI推荐供应商→仓分配方案」。\n\n⏰ **统配数据（T-30出数）**\n统配数据是否已到？如果已到，我将继续进行统配比对和统配外计算。`,
                                ['读取供应商主数据', '按份额分配采购量', 'MOQ取整校验'],
                                [{ label: '✅ 统配数据已到，继续', type: 'confirm' }, { label: '⏸️ 统配数据未到，暂停', type: 'skip' }],
                              );
                            }
                            else if (action.type === 'supplier_skip') {
                              addBotMessage('⏸️ **供应商数据未到，流程暂停**\n\n当前已完成：\n• ✅ 汇总到仓\n• ✅ A 类计算过程检测 3 项（物料维度，不推送不阻断）\n\n等待供应商数据确认后，输入"供应商数据已确认"或点击按钮继续。\n\n⏰ 统配数据也请同步关注。');
                            }
                          }}
                          disabled={isTyping}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="chat-msg assistant">
                <div className="chat-avatar bot-avatar-icon">
                  <svg viewBox="0 0 24 24" fill="white" width="16" height="16">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div className="chat-bubble typing-indicator">
                  <span className="dot-typing" /><span className="dot-typing" /><span className="dot-typing" />
                  <span className="typing-text">AI分析中...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="chat-input-area">
            <div className="input-box-wrapper">
              <textarea
                className="chat-textarea"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="用自然语言输入指令..."
                disabled={isTyping}
                rows={1}
              />
              <div className="input-toolbar">
                <div className="toolbar-left">
                  {/* ⚠️ 类名是 `np-skill-btn`，**不要**改回 `skill-btn`（2026-09-24 实测踩到）：
                      她的 wenshu.js 顶层有 `document.querySelector('.skill-btn').addEventListener(...)`
                      —— 取的是**全文档第一个**匹配节点。我们的 #root 在 DOM 里排在她的 #wenshu-root 之前，
                      撞名后她那行绑到了**我们的**按钮上 ⇒ ① 她的「选择技能」按钮彻底失效（点不开她的技能弹层，
                      也就永远选不到「新品分货」→ 跳不回我们页面）② 我们点自己的按钮反而会把她的弹层打开。
                      闸门：scripts/build-wenshu.mjs 的 `宿主侧不得使用她 document.querySelector 用到的 class`。 */}
                  <button className="np-skill-btn" onClick={() => setShowSkillPopup(!showSkillPopup)}>
                    <span>+</span> 选择技能
                  </button>
                </div>
                <button className={`send-btn ${inputText.trim() ? 'active' : ''}`} onClick={sendMessage} disabled={isTyping || !inputText.trim()}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="input-hint">Enter 发送 · Shift+Enter 换行</div>

            {showSkillPopup && (
              <div className="skill-popup">
                <div className="skill-popup-head">选择技能</div>
                {SKILLS.map(skill => (
                  <div key={skill.id} className={`skill-popup-item ${activeSkill.id === skill.id ? 'active' : ''}`}
                    onClick={() => handleSkillSelect(skill)}>
                    <span className="skill-popup-ico" style={{ background: skill.tileBg, color: skill.tileFg }}>{skill.tile}</span>
                    <div className="skill-popup-info">
                      <div className="skill-popup-name">{skill.name}</div>
                      <div className="skill-popup-desc">{skill.desc}</div>
                    </div>
                    <span className="skill-popup-go">›</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Data Display Only with Tabs */}
        <div className="right-panel">
          {/* C：这一步在回答什么 + 本步可改 + PRD 步骤对应 */}
          <div className="narrative-bar">
            <div className="narrative-main">
              <span className="narrative-tag">这一步在回答</span>
              <span className="narrative-q">{NARRATIVE[narrativeTab]?.question}</span>
            </div>
            <div className="narrative-side">
              <span className="narrative-tag">本步可改</span>
              <span className="narrative-edit">{NARRATIVE[narrativeTab]?.canEdit}</span>
            </div>
            <div className="narrative-map" title="对应 PRD V7.6 算法链步骤">PRD {NARRATIVE[narrativeTab]?.prdSteps}</div>
          </div>
          {/* C：演示讲解卡（默认收起，演示时一键展开） */}
          {showGuide && <GuidePanel currentStep={narrativeTab} />}
          {selectedProduct.length === 0 && <RightEmptyState />}
          {selectedProduct.length > 0 && (
            <>
              {/* Tab Navigation */}
              <div className="right-tabs">
                {RIGHT_TABS.map(t => {
                  const tabStep = t.step;
                  const isActive = rightTab === tabStep;
                  const isCompleted = tabStep >= 1 && tabStep <= 4 && step > tabStep;
                  const isAccessible = t.always ? true : (tabStep >= 1 && tabStep <= 4 ? step >= tabStep : step >= 1);
                  const isJumped = jumpedTab === tabStep;
                  return (
                    <button
                      key={tabStep}
                      className={`right-tab ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${!isAccessible ? 'disabled' : ''} ${isJumped ? 'jumped' : ''}`}
                      onClick={() => { if (isAccessible) setRightTab(tabStep); }}
                      disabled={!isAccessible}
                    >
                      <span className="right-tab-num">{isCompleted ? '✓' : (t.icon ? <Icon n={t.icon} size={13} /> : tabStep)}</span>
                      <span className="right-tab-label">{t.label}</span>
                    </button>
                  );
                })}
              </div>
              {/* Tab Content */}
              <div className="right-tab-content">
                {rightTab === 0 && <MonitorMovedNotice compact />}
                {rightTab === 5 && <RightParamPanel />}
                {rightTab === 1 && <RightStep1CupForecast productInfo={productInfo} materials={materials} selectedProduct={selectedProduct} activeBOMTab={activeBOMTab} setActiveBOMTab={setActiveBOMTab} />}
                {rightTab === 2 && <RightStep2CoefficientsAndBOM regions={regions} flooredCount={flooredCount} materials={aggregatedMaterials} productInfo={productInfo} selectedHistoricalProducts={selectedHistoricalProducts} setSelectedHistoricalProducts={setSelectedHistoricalProducts} selectedProduct={selectedProduct} />}
                {rightTab === 3 && <RightStep3WarehouseAndWarnings tongpeiDone={tongpeiDone} supplierDone={supplierDone} onTongpeiArrived={() => setTongpeiDone(true)} />}
                {rightTab === 4 && <RightStep4Output productInfo={productInfo} />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMessage(text: string) {
  const codeBlockRegex = /```([\s\S]*?)```/g;
  const parts: (string | { code: string })[] = [];
  let lastIndex = 0;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push({ code: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return parts.map((part, i) => {
    if (typeof part === 'object' && 'code' in part) {
      return <pre key={i} className="code-block">{part.code}</pre>;
    }
    const lines = part.split('\n');
    return <span key={i}>{lines.map((line, j) => {
      const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
      const rendered = boldParts.map((bp, k) => {
        if (bp.startsWith('**') && bp.endsWith('**')) return <strong key={k}>{bp.slice(2, -2)}</strong>;
        return <span key={k}>{bp}</span>;
      });
      return <span key={j}>{j > 0 && <br />}{rendered}</span>;
    })}</span>;
  });
}

// ===== Right Panel Components =====

function RightEmptyState() {
  // V2.16：新品分仓「首页」曾＝上新期间监控看板；
  // 2026-09-24 按 PRD V7.8 §5.4 把首页监控数据全部删除（看板载体＝智能问数看板）→ 只剩一张指路卡
  return (
    <div>
      <MonitorMovedNotice />
    </div>
  );
}

/* ===================== C：演示讲解卡（页面内叙事） ===================== */
function GuidePanel({ currentStep }: { currentStep: number }) {
  // 讲解卡里的步骤序号与右侧 Tab 对齐：Tab1-4 ↔ 讲解 1-4，Tab0/5 为看板与参数面板
  const highlight = currentStep >= 1 && currentStep <= 4 ? currentStep : 0;
  return (
    <div className="guide-panel">
      <div className="card" style={{ borderColor: 'var(--accent)' }}>
        <div className="card-title" style={{ color: 'var(--accent)' }}>
          演示讲解 · 5 步口播词（结论先行，照读即可）
        </div>
        <div className="guide-lede">
          讲解词与 <b>PRD V7.6</b> 口径一致；每步先给结论，再展开依据。当前页面对应第 {highlight || '—'} 步。
        </div>
        {GUIDE_STEPS.map(g => (
          <div key={g.n} className={`guide-step ${highlight === g.n ? 'current' : ''}`}>
            <div className="guide-step-head">
              <span className="guide-step-num">{g.n}</span>
              <span className="guide-step-title">{g.title}</span>
              <span className="guide-step-prd">{g.prd}</span>
            </div>
            <div className="guide-step-line">{g.oneLiner}</div>
            <div className="guide-step-meta">
              <span><b>可改</b>：{g.canEdit}</span>
              <span><b>关键数字</b>：{g.keyNumber}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-title">PRD 12 步 ↔ 本 Demo 5 步 映射（讲解时不用脑内翻译）</div>
        <table className="data-table table-fit">
          <thead><tr><th>本 Demo</th><th>PRD V7.6 算法链</th></tr></thead>
          <tbody>
            {STEP_MAPPING.map((m, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{m.demo}</td>
                <td style={{ fontSize: 12 }}>{m.prd}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="guide-foot">
          数字口径以 PRD V7.6 为准；预警只有 2 条（销量偏差 &gt;20%、仓库可售天数 &lt; N 天），其余为检测 / 监控项。
        </div>
      </div>
    </div>
  );
}

/* ====== 首页「上新期间监控看板」→ 2026-09-24 已删除（PRD V7.8 §5.4） ======
 * 彬节：首页的仓库监控数据**全部删除** ——「我们已经在看板中有了，这一条 PRD 已经更新了，demo 中需要更新」。
 * PRD V7.8 §5.4：6 项监控指标的**看板载体＝智能问数看板**，分仓 PRD 只定义口径与算法、不自建看板页面/入口。
 * 因此原先这里的「3 个 N 输入 / 仓 chip / 6 张 KPI 卡 / 30 天趋势图 / 仓明细表 / 预警卡」全部移除，
 * 只留一张指路卡（口径照 PRD 写死，避免演示时被问「数据哪来的」）。
 * 监控数据由 public/wenshu/np-monitor.js 注册在问数壳里的「新品监控」看板承载（粒度＝二级仓 × 核心物料）。
 */
function MonitorMovedNotice({ compact }: { compact?: boolean }) {
  return (
    <div className="card" style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent)' }}>
      <div className="card-title" style={{ color: 'var(--accent)' }}>
        <Icon n="chart" style={{ marginRight: 6, color: 'inherit' }} />监控看板已融合到「智能问数」看板
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.95 }}>
        这块原本自建的上新期间仓库监控看板（6 张 KPI + 30 天趋势 + 仓明细）<b>已按 PRD V7.8 §5.4 删除</b>：
        6 项监控指标（仓备货预测日均杯量 / 仓实际日均杯量 / 仓偏差率·全国偏差率 / 趋势 / 仓库可售天数 /
        仓预计门店可售天数）的<b>看板载体＝智能问数看板</b>，这里不再自建页面与入口。<br />
        👉 看数据走：<b>技能 → 智能问数 → 看板 → 新品监控</b>（粒度＝二级仓 × 核心物料：48 个二级仓 × 5 种物料 = 120 行）。<br />
        👉 分仓流程只保留<b>2 条预警</b>（PRD V7.8 §5.4）：① 销量偏差 |偏差| &gt; 20%（仓 + 全国）
        ② 仓库可售天数 &lt; 7 天 —— 触发走<b>飞书消息</b>推送；数值 N 页面不可改（后端配置可改）。
      </div>
      {!compact && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.85 }}>
          ← 在左侧对话里选新品即可开始分仓备货计算。监控与分仓是两套东西：监控是上新后每天在问数看板看，
          分仓计算是上新前跑一次（本页第 1–4 步）。
        </div>
      )}
    </div>
  );
}

/* ===================== V2.16 参数面板（所有参数都支持页面直接改） ===================== */
function RightParamPanel() {
  // 订阅参数值变化 + 取「最近一次重算影响」（三入口同源；对话 / 明细表改了 → 本面板同步刷新）
  const { impact } = useCalc();
  const [values, setValues] = useState<Record<string, string>>(() =>
    paramList.reduce((acc, p) => { acc[p.key] = p.value; return acc; }, {} as Record<string, string>));
  const [recalc, setRecalc] = useState<string | null>(null);
  const [sheetHint, setSheetHint] = useState<string | null>(null);

  const onPageEdit = (p: ParamItem, v: string) => {
    if (p.numeric) {
      if (v.trim() === '') return;
      const n = Number(v);
      if (!Number.isFinite(n)) return;
      const before = getPageValue(p.name, '全局', Number(p.value));
      setPageValue(p.name, '全局', n); // 写共享 store → 监控看板 / 检测阈值同步
      addChange({
        param: p.name, granularity: '全局',
        from: `${before}${p.unit || ''}`, to: `${v}${p.unit || ''}`,
        source: '页面', operator: '罗', effect: '真算：物料量 → 汇总到仓 → 偏差率 → 检测阈值同步',
      });
    } else {
      setValues(prev => ({ ...prev, [p.key]: v }));
    }
    setRecalc(`${p.name} → ${v}${p.unit || ''}：已按新值重算（真算）｜下游物料量 / 汇总到仓 / 偏差率 / 检测已联动`);
    setSheetHint(null);
    setTimeout(() => setRecalc(null), 2600);
  };

  return (
    <div>
      <div className="card" style={{ borderColor: 'var(--accent)' }}>
        <div className="card-title" style={{ color: 'var(--accent)' }}><Icon n="settings" style={{ marginRight: 6, color: 'inherit' }} />参数面板（所有参数都支持页面直接改）<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 10 }}>
          <b>规则（9/22 会议确认）</b>：① <b>所有参数都支持页面直接修改</b>（页面直接编辑是主入口）② 该参数在<b>飞书底表</b>里也有 → 底表也能改，但系统要 <b>15–20 分钟</b>后才读到、才生效 ③ 底表里没有的参数 → <b>仅支持页面修改</b> ④ <b>计算以页面当前值为准；底表更新被读取后覆盖页面值并提示用户</b>。
        </div>
        {recalc && <div className="param-ok"><span className="status-tag status-pass"><span className="dot dot-pass" />{recalc}</span></div>}
        {sheetHint && <div className="param-delay">⏳ {sheetHint}</div>}
        <table className="data-table table-fit">
          <thead>
            <tr><th>参数</th><th>粒度</th><th>当前值</th><th>页面直接改</th><th>飞书底表改</th><th>生效方式</th></tr>
          </thead>
          <tbody>
            {paramList.map(p => (
              <tr key={p.key}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td style={{ fontSize: 11 }}>{p.granularity}</td>
                <td>
                  {p.numeric ? (
                    <span>
                      <input className="param-input" type="number" value={getPageValue(p.name, '全局', Number(p.value))}
                        onChange={e => onPageEdit(p, e.target.value)} />
                      <span className="param-hint"> {p.unit}（默认 7）</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: 12 }}>{values[p.key]}</span>
                  )}
                </td>
                <td>
                  {p.pageEditable ? <span className="status-tag status-pass"><span className="dot dot-pass" />支持</span> : <span style={{ color: 'var(--text-muted)' }}>— 一期不改</span>}
                  {p.pageEditable && !p.numeric && <span className="param-hint"> 明细表内逐行改</span>}
                </td>
                <td>
                  {p.sheetEditable ? (
                    <span>
                      <span className="status-tag status-pass"><span className="dot dot-pass" />支持</span>
                      <button className="export-btn" style={{ marginLeft: 6 }} onClick={() => { setSheetHint(`${p.name}：底表已更新（模拟）→ 系统 15–20 分钟后读到新值，读取后覆盖页面值并提示（当前仍以页面值为准）`); setRecalc(null); }}>模拟底表更新</button>
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>— 底表无此参数</span>
                  )}
                </td>
                <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.effect}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.9 }}>
          <div><Icon n="clock" size={12} /> <b>两个 N 别混</b>：<b>售卖天数 N</b> 是「仓实际日均杯量」的分母（最近 N 天、不含当天）；<b>订货天数 N</b> 是「仓库可售天数」的分母（仓物料订货日均 = 订货量 ÷ N 天）。两个都可改、默认都是 7 天。</div>
          <div style={{ color: 'var(--text-muted)' }}>数据来源：飞书多维表格（新品BOM / 供应商信息）→ 湖仓 → 本体；页面改不回写底表。</div>
        </div>
      </div>
      <div className="card" style={{ borderColor: 'var(--border-main)' }}>
        <div className="card-title"><Icon n="chat" style={{ marginRight: 6, color: 'inherit' }} />也可以直接在左侧对话里改（自然语言，作为 AI 能力保留）</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.9 }}>
          • 调整区域系数 湖北 1.1<br/>
          • 调整备货系数 莲雾苹果汁 1.2<br/>
          • 调整W1占比 0.06<br/>
          • 安全库存改成7天<br/>
          • 售卖天数改成5天 ｜ 订货天数改成5天<br/>
          • 设置供应商 莲雾苹果汁 供应商A 40% MOQ500
        </div>
      </div>

      {/* 档位 2：最近一次重算影响（before → after，证明参数改动真的联动了下游） */}
      {impact && (impact.rows.length > 0 || impact.alertsBefore !== impact.alertsAfter || impact.whSafetyBefore !== impact.whSafetyAfter) && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <div className="card-title" style={{ color: 'var(--accent)' }}><Icon n="calc" style={{ marginRight: 6, color: 'inherit' }} />最近一次重算影响（真算 · before → after）</div>
          <table className="data-table table-fit">
            <thead><tr><th>物料</th><th className="num">全国预测量 前 → 后</th><th className="num">变化</th><th className="num">备货偏差率 前 → 后</th><th>单位</th></tr></thead>
            <tbody>
              {impact.rows.map(r => (
                <tr key={r.material}>
                  <td style={{ fontWeight: 600 }}>{r.material}</td>
                  <td className="num" style={{ fontSize: 12 }}>{r.before.toLocaleString()} → <b style={{ color: 'var(--accent)' }}>{r.after.toLocaleString()}</b></td>
                  <td className="num" style={{ fontWeight: 700, color: r.deltaPct >= 0 ? 'var(--good)' : 'var(--danger, #ef4444)' }}>{r.deltaPct > 0 ? '+' : ''}{r.deltaPct}%</td>
                  <td className="num" style={{ fontSize: 12 }}>{r.devBefore}% → <b>{r.devAfter}%</b></td>
                  <td style={{ fontSize: 11 }}>{r.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {impact.rows.length === 0 && (
            <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-muted)' }}>
              本次改动<b>不改变物料量/偏差率</b>（如只改检测阈值），只影响命中判定 —— 下方命中数为证。
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.8 }}>
            A 类检测项命中数（物料级全国加权口径）：<b>{impact.alertsBefore}</b> → <b style={{ color: 'var(--warn)' }}>{impact.alertsAfter}</b><br/>
            仓级「安全库存校验」不通过数（仓 × 物料）：<b>{impact.whSafetyBefore}</b> → <b style={{ color: 'var(--warn)' }}>{impact.whSafetyAfter}</b>
          </div>
        </div>
      )}

      {/* B-4：变更日志（内联调参留痕） */}
      <ChangeLogPanel />
    </div>
  );
}

function RightStep1CupForecast({ productInfo, materials, selectedProduct, activeBOMTab, setActiveBOMTab }: { productInfo: NewProductInfo; materials: BOMMaterial[]; selectedProduct: string[]; activeBOMTab: number; setActiveBOMTab: (n: number) => void }) {
  // 档位 2：门店级杯量 / 物料量来自引擎（区域系数、W1-W4、备货系数、损耗率、效期改动全部联动）
  const { calc } = useCalc();
  const [storePage, setStorePage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalStores = calc.stores.length;
  const totalPages = Math.ceil(totalStores / pageSize);
  const startIdx = (storePage - 1) * pageSize;
  const pageStores = calc.stores.slice(startIdx, startIdx + pageSize);

  // Determine which BOM data to show based on active tab
  const selectedNames = selectedProduct.map(id => newProductList.find(p => p.id === id)?.name || id);
  const currentBOM = activeBOMTab === 0 ? materials : mockBOMRecordsProduct2.map(m => ({ ...m }));
  const currentProduct = activeBOMTab === 0 ? productInfo : { ...productInfo, name: '铁观音凤梨白月光', firstWeekDailyCups: mockSystemDataProduct2.firstWeekDailyCups, firstMonthDailyCups: mockSystemDataProduct2.firstMonthDailyCups };

  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 1</span>预测杯量</div>

      {/* 多品Tab切换 */}
      {selectedProduct.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {selectedNames.map((name, i) => (
            <button key={i} onClick={() => setActiveBOMTab(i)} style={{
              padding: '6px 14px', borderRadius: 6, border: `1px solid ${activeBOMTab === i ? 'var(--accent)' : 'var(--border)'}`,
              background: activeBOMTab === i ? 'var(--accent-light)' : 'white', color: activeBOMTab === i ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: activeBOMTab === i ? 600 : 400, fontSize: 12, cursor: 'pointer',
            }}>
              {name}
            </button>
          ))}
        </div>
      )}

      {/* 新品基础信息表（飞书多维表格）— A-4：把 17 列拆成「只读主数据」+「可改参数」两张，消除横向裁切 */}
      <div className="card">
        <div className="card-title"><Icon n="list" style={{ marginRight: 6, color: 'inherit' }} />新品基础信息表 · 物料主数据（只读）<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
        <div className="data-source-tag">数据来源：飞书多维表格「新品BOM」表</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.7 }}>
          V7.6 字段增删：<b>新增</b> 合并品名 · 损耗率 · 上新开始/结束时间；<b>删除</b> 供应链归属子公司 · 供应商编码；供应商表只需填「供应商份额」。
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          新品名称：<strong>{currentProduct.name}</strong> ｜ 上新日：<strong>{currentProduct.launchDate}</strong> ｜ 共 <strong>{currentBOM.length}</strong> 种原材料
        </p>
        <table className="data-table table-fit">
          <thead>
            <tr>
              <th>原材料名称</th><th>原材料编码</th><th>合并品名</th><th>规格型号</th><th>单位</th>
              <th className="num">单位用量</th><th>用量单位</th><th>上新起止</th>
            </tr>
          </thead>
          <tbody>
            {currentBOM.map(m => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600 }}>{m.materialName}</td>
                <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{m.materialCode || <span style={{ color: 'var(--warn)' }}><Icon n="alert" size={12} /> 空</span>}</td>
                <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{m.mergedProductName || m.materialName}{m.mergedProductName && m.mergedProductName !== m.materialName && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}> ←合并</span>}</td>
                <td style={{ fontSize: 11 }}>{m.spec}</td>
                <td>{m.unit}</td>
                <td className="num">{m.unitUsage}</td>
                <td>{m.usageUnit}</td>
                <td style={{ fontSize: 11 }}>{m.launchStartDate || m.launchDate} ~ {m.launchEndDate || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 物料参数（可点改） */}
      <div className="card" style={{ borderColor: 'var(--accent)' }}>
        <div className="card-title" style={{ color: 'var(--accent)' }}><Icon n="calc" style={{ marginRight: 6, color: 'inherit' }} />物料参数（点数字直接改 · 改了真算）</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.7 }}>
          可改：开封效期 · 备货系数 · 损耗率 · W1-W4 杯占比（成品维度，改一处全物料同步）。改动<b>即时真算下游</b>：应用率 → 物料量 → 汇总到仓 → 偏差率 → 检测全部联动（档位 2 · 轻量真算），并记入「参数面板 → 变更日志」。
        </div>
        <table className="data-table table-fit">
          <thead>
            <tr>
              <th>原材料名称</th>
              <th className="num">开封效期</th><th className="num">备货系数</th><th className="num">损耗率</th>
              <th className="num">W1杯占</th><th className="num">W2杯占</th><th className="num">W3杯占</th><th className="num">W4杯占</th>
            </tr>
          </thead>
          <tbody>
            {currentBOM.map(m => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600 }}>{m.materialName}</td>
                <td className="num">
                  <EditableNumber value={m.shelfLifeDays} rule={{ min: 1, max: 30, int: true, suffix: '天' }} param="开封效期" granularity={m.materialName} effect="Step ⑤–⑧" />
                </td>
                <td className="num">
                  <EditableNumber value={m.stockCoefficient} rule={{ min: 0.1, max: 5, decimals: 2 }} param="备货系数" granularity={m.materialName} effect="Step ④–⑧" />
                </td>
                <td className="num">
                  <EditableNumber value={m.lossRate * 100} rule={{ min: 0, max: 50, suffix: '%' }} param="损耗率" granularity={m.materialName} effect="应用率 → Step ④–⑧" />
                </td>
                <td className="num"><EditableNumber value={m.cupRatioW1} rule={{ min: 0, max: 1, decimals: 4 }} param="W1 杯占比" granularity={`${m.materialName}（成品维度）`} effect="Step ④–⑧" syncAll /></td>
                <td className="num"><EditableNumber value={m.cupRatioW2} rule={{ min: 0, max: 1, decimals: 4 }} param="W2 杯占比" granularity={`${m.materialName}（成品维度）`} effect="Step ④–⑧" syncAll /></td>
                <td className="num"><EditableNumber value={m.cupRatioW3} rule={{ min: 0, max: 1, decimals: 4 }} param="W3 杯占比" granularity={`${m.materialName}（成品维度）`} effect="Step ④–⑧" syncAll /></td>
                <td className="num"><EditableNumber value={m.cupRatioW4} rule={{ min: 0, max: 1, decimals: 4 }} param="W4 杯占比" granularity={`${m.materialName}（成品维度）`} effect="Step ④–⑧" syncAll /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 系统自动获取数据 */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi-card"><div className="kpi-label">在营门店</div><div className="kpi-value">{currentProduct.storeCount.toLocaleString()}<span className="kpi-unit">家</span></div></div>
        <div className="kpi-card"><div className="kpi-label">首周日均</div><div className="kpi-value">{currentProduct.firstWeekDailyCups}<span className="kpi-unit">杯</span></div></div>
        <div className="kpi-card"><div className="kpi-label">首月日均</div><div className="kpi-value">{currentProduct.firstMonthDailyCups}<span className="kpi-unit">杯</span></div></div>
        <div className="kpi-card"><div className="kpi-label">触发下限保护</div><div className="kpi-value" style={{ color: 'var(--warn)' }}>~200<span className="kpi-unit">家</span></div></div>
      </div>
      <div className="card">
        <div className="card-title"><Icon n="store" style={{ marginRight: 6, color: 'inherit' }} />全部门店预测明细<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
        <table className="data-table table-fit">
            <thead><tr><th>门店编码</th><th>门店名称</th><th>子公司</th><th className="num">区域系数</th><th className="num">5月销量</th><th className="num">占比</th><th className="num">首周日均</th><th className="num">月日均</th><th className="num">预测总量<br/><span style={{ fontSize: 10, fontWeight: 400 }}>（{currentBOM.length}物料合计·箱）</span></th></tr></thead>
            <tbody>
              {pageStores.map((s, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{s.storeId}</td>
                  <td style={{ fontWeight: 600, fontSize: 11 }}>{s.storeName}</td>
                  <td style={{ fontSize: 11 }}>{s.subsidiary}</td>
                  <td className="num">{s.regionCoeff}{s.isFloorProtected && <span style={{ fontSize: 10, color: 'var(--warn)' }}> 兜底</span>}</td>
                  <td className="num">{s.maySales.toLocaleString()}</td>
                  <td className="num">{(s.salesRatio * 100).toFixed(4)}%</td>
                  <td className="num">{s.firstWeekDaily.toFixed(2)}</td>
                  <td className="num">{s.monthDaily.toFixed(2)}</td>
                  <td className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>{s.totalBoxes.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        {/* 分页控件 */}
        <div className="pagination-bar">
          <div className="pagination-info">
            共 <strong>{totalStores}</strong> 条（展示 {totalStores} 家，实际 {productInfo.storeCount.toLocaleString()} 家）
          </div>
          <div className="pagination-controls">
            <select className="page-size-select" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setStorePage(1); }}>
              <option value={10}>10条/页</option>
              <option value={20}>20条/页</option>
              <option value={50}>50条/页</option>
            </select>
            <button className="page-btn" disabled={storePage <= 1} onClick={() => setStorePage(1)}>首页</button>
            <button className="page-btn" disabled={storePage <= 1} onClick={() => setStorePage(p => p - 1)}>上一页</button>
            <span className="page-indicator">{storePage} / {totalPages}</span>
            <button className="page-btn" disabled={storePage >= totalPages} onClick={() => setStorePage(p => p + 1)}>下一页</button>
            <button className="page-btn" disabled={storePage >= totalPages} onClick={() => setStorePage(totalPages)}>末页</button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-title"><Icon n="calc" style={{ marginRight: 6, color: 'inherit' }} />计算公式</div>
        <pre className="formula-block">{`门店占比 = 门店5月销量 ÷ 全国5月总销量(${productInfo.totalSalesMay.toLocaleString()})
首周日均 = 大盘首周(${productInfo.firstWeekDailyCups}) × 门店占比 × 门店数(${productInfo.storeCount.toLocaleString()}) × 区域系数
月日均   = 大盘首月(${productInfo.firstMonthDailyCups}) × 门店占比 × 门店数(${productInfo.storeCount.toLocaleString()}) × 区域系数
区域系数 = 子公司新品前两周占比 ÷ 全国新品前两周占比（< 1.0 兜底取 1.0，宁多勿缺）

示例（表格第 1 行门店 × ${calc.stores[0]?.materials[0]?.material ?? ''}）：
  区域系数 ${calc.stores[0]?.regionCoeff} ｜ 首周日均 ${calc.stores[0]?.firstWeekDaily.toFixed(2)} ｜ 月日均 ${calc.stores[0]?.monthDaily.toFixed(2)}
  W1 物料量 = ${calc.stores[0]?.firstWeekDaily.toFixed(2)} × ${calc.materials[0]?.w[0]} × 7 ÷ ${calc.materials[0]?.app.w1.toFixed(2)} × 备货系数 = ${calc.stores[0]?.materials[0]?.w[0].toFixed(2)} 箱
  门店预测总量 = Roundup(ΣW1-W4) = ${calc.stores[0]?.materials[0]?.total} 箱（该门店 ${calc.stores[0]?.materials.length} 个物料合计 ${calc.stores[0]?.totalBoxes} 箱）`}</pre>
      </div>
    </div>
  );
}

function RightStep2CoefficientsAndBOM({ regions, materials, productInfo, selectedHistoricalProducts, setSelectedHistoricalProducts, selectedProduct }: { regions: RegionCoefficient[]; flooredCount: number; materials: BOMMaterial[]; productInfo: NewProductInfo; selectedHistoricalProducts: Set<string>; setSelectedHistoricalProducts: React.Dispatch<React.SetStateAction<Set<string>>>; selectedProduct: string[] }) {
  // Filter products based on selected set
  const filteredProducts = useMemo(() => {
    return historicalProductsDetail.filter(p => selectedHistoricalProducts.has(p.name));
  }, [selectedHistoricalProducts]);

  const isAllSelected = selectedHistoricalProducts.size === historicalProductsDetail.length;
  const isAISubset = selectedHistoricalProducts.size < historicalProductsDetail.length && 
    [...selectedHistoricalProducts].every(name => {
      const p = historicalProductsDetail.find(hp => hp.name === name);
      return p && p.similarity >= 0.80;
    });

  const toggleProduct = (name: string) => {
    setSelectedHistoricalProducts(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => setSelectedHistoricalProducts(new Set(historicalProductsDetail.map(p => p.name)));
  const selectAI = () => setSelectedHistoricalProducts(new Set(historicalProductsDetail.filter(p => p.similarity >= 0.80).map(p => p.name)));

  // Generate calculation matrix: each product × each subsidiary
  const calcData = useMemo(() => {
    return filteredProducts.map((p, pi) => {
      const values: Record<string, number> = {};
      regions.forEach((r) => {
        const noise = (Math.sin(pi * 127.1 + r.rawValue * 3117) * 43758.5453);
        const frac = noise - Math.floor(noise);
        values[r.subsidiary] = Math.round((r.rawValue + (frac * 0.08 - 0.04)) * 1000) / 1000;
      });
      return { name: p.name, category: p.category, similarity: p.similarity, values };
    });
  }, [filteredProducts, regions]);

  // Calculate mean for each subsidiary
  const means = useMemo(() => {
    const m: Record<string, number> = {};
    regions.forEach(r => {
      const sum = calcData.reduce((s, d) => s + d.values[r.subsidiary], 0);
      m[r.subsidiary] = Math.round((sum / calcData.length) * 1000) / 1000;
    });
    return m;
  }, [calcData, regions]);

  // Apply floor rule
  const floored = useMemo(() => {
    const f: Record<string, number> = {};
    regions.forEach(r => {
      f[r.subsidiary] = Math.round(Math.max(1, means[r.subsidiary]) * 1000) / 1000;
    });
    return f;
  }, [means, regions]);

  const currentFlooredCount = regions.filter(r => means[r.subsidiary] < 1).length;

  // 档位 2：把「历史品选择 → 均值 → 兜底」算出的系数写进共享 store，作为真算输入（单一真值）。
  // 这行同时实现了「勾选/取消历史品 → 区域系数变 → 物料量/汇总/偏差率真变」。
  const { calc } = useCalc();
  useEffect(() => {
    regions.forEach(r => {
      const next = Math.round(Math.max(1, means[r.subsidiary]) * 1000) / 1000;
      const cur = getPageValue('区域系数', r.subsidiary, next);
      if (Math.abs(cur - next) > 1e-9) setPageValue('区域系数', r.subsidiary, next);
    });
  }, [means, regions]);

  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 2</span>系数修正 + BOM拆解</div>

      {/* 区域系数 */}
      <div className="card">
        <div className="card-title">
          <Icon n="ruler" size={12} /> 区域系数（{filteredProducts.length}个历史品上新前两周实际销量占比比值）
          {isAISubset && <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 8, background: 'var(--accent-light)', padding: '2px 8px', borderRadius: 4 }}>AI推荐子集</span>}
          {!isAllSelected && !isAISubset && <span style={{ fontSize: 11, color: 'var(--warn)', marginLeft: 8, background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 4 }}>自定义选择</span>}
          <button className="export-btn"><Icon n="download" size={12} /> 导出</button>
        </div>
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="kpi-card"><div className="kpi-label">参考历史品数</div><div className="kpi-value" style={{ color: 'var(--accent)' }}>{filteredProducts.length}</div></div>
          <div className="kpi-card"><div className="kpi-label">兜底为1.0</div><div className="kpi-value" style={{ color: 'var(--warn)' }}>{currentFlooredCount}</div></div>
          <div className="kpi-card"><div className="kpi-label">最高系数</div><div className="kpi-value">{Math.max(...regions.map(r => floored[r.subsidiary])).toFixed(3)}</div></div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>
          <strong>计算公式：</strong>区域系数 = AVG(历史品上新前两周实际销量占比比值) = AVG(子公司新品占比 ÷ 全国新品占比)<br/>
          <strong>数据来源：</strong>基于上新前两周实际销售数据（不用预估数据）<br/>
          <strong>兜底规则：</strong>若均值 &lt; 1.0 → 取 1.0（防止低估）<br/>
          <strong>查看方式：</strong>23 品 × 24 子公司矩阵较宽，表内<b>左右滚动</b>查看（首列与表头固定）；最右侧为「兜底后系数」——<b>点数字即可直接改</b>
        </div>

        {/* 历史品选择器 */}
        <div style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--bg-subtle, #f8fafc)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}><Icon n="search" size={12} /> 历史品选择（已选 {selectedHistoricalProducts.size}/{historicalProductsDetail.length}）</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={selectAI} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer' }}>AI推荐（≥80%）</button>
              <button onClick={selectAll} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'white', cursor: 'pointer' }}>全选</button>
            </div>
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
            {historicalProductsDetail.map(p => (
              <label key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '3px 0', cursor: 'pointer', opacity: selectedHistoricalProducts.has(p.name) ? 1 : 0.5 }}>
                <input type="checkbox" checked={selectedHistoricalProducts.has(p.name)} onChange={() => toggleProduct(p.name)} style={{ accentColor: 'var(--accent)' }} />
                <span style={{ fontWeight: selectedHistoricalProducts.has(p.name) ? 600 : 400 }}>{p.name}</span>
                <span style={{ fontSize: 10, color: p.similarity >= 0.80 ? 'var(--good)' : p.similarity >= 0.70 ? 'var(--warn)' : 'var(--text-muted)', marginLeft: 'auto' }}>{(p.similarity * 100).toFixed(0)}%</span>
              </label>
            ))}
          </div>
        </div>

        {/* 统一表格：所有历史品 × 所有24个子公司 */}
        <div className="calc-table-wrapper">
          <table className="data-table calc-table">
            <thead>
              <tr>
                <th style={{ minWidth: 130 }}>历史品{isAISubset ? '（≥80%）' : ''}</th>
                {regions.map(r => (
                  <th key={r.subsidiary} className="num" style={{ minWidth: 72 }}>{r.subsidiary}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calcData.map((item, i) => (
                <tr key={i}>
                  <td>{item.name}</td>
                  {regions.map(r => (
                    <td key={r.subsidiary} className="num" style={{ color: item.values[r.subsidiary] >= 1 ? 'var(--accent)' : 'var(--warn)' }}>
                      {item.values[r.subsidiary].toFixed(3)}
                    </td>
                  ))}
                </tr>
              ))}
              {/* 均值行 */}
              <tr className="mean-row">
                <td>均值（{filteredProducts.length}品）</td>
                {regions.map(r => (
                  <td key={r.subsidiary} className="num" style={{ color: means[r.subsidiary] >= 1 ? 'var(--accent)' : 'var(--warn)' }}>
                    {means[r.subsidiary].toFixed(3)}
                  </td>
                ))}
              </tr>
              {/* 兜底后行 */}
              <tr className="floor-row">
                <td>兜底后系数 <span style={{ fontWeight: 400, fontSize: 10 }}>（点数字直接改）</span></td>
                {regions.map(r => (
                  <td key={r.subsidiary} className="num" style={{ color: 'var(--good)' }}>
                    <EditableNumber
                      value={floored[r.subsidiary]}
                      format={v => v.toFixed(3)}
                      rule={{ min: 0.01, max: 9.99, decimals: 3, floorHint: true }}
                      param="区域系数" granularity={r.subsidiary} effect="Step ②–⑧"
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* BOM物料清单 —— 两个新品按 BOM 拆分并加和后的**聚合结果**（2026-09-24 彬节：
          「下面那个两个新品按照 bom 物料拆分并加和的结果表 BOM 物料清单，开封有效天数等后面的字段都删除，
            仅展示聚合后的结果」）⇒ 尾部字段（开封效期 / 备货系数 / 损耗率 / W1-W4 杯占）全部移除：
          它们是**品维度**的参数（两品取值不同），放在聚合表里会误导；改参数走 Step 1 的分品 BOM 表。 */}
      <div className="card">
        <div className="card-title"><Icon n="box" style={{ marginRight: 6, color: 'inherit' }} />BOM物料清单 · 聚合结果（{aggregatedMaterials.length}种合并品名）<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
        <div className="data-source-tag">数据来源：飞书多维表格「新品BOM」表（两个新品的物料按合并品名聚合）</div>
        <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 8, padding: '6px 10px', background: 'rgba(37,99,235,0.06)', borderRadius: 6, lineHeight: 1.7 }}>
          <Icon n="link" size={12} /> 聚合范围：{selectedProduct.map(id => `[${newProductList.find(p => p.id === id)?.name || id}]`).join(' ')}
          {selectedProduct.length > 1 ? ` ${selectedProduct.length} 个新品` : ''} —— 按 BOM 拆分后<b>按合并品名加和</b>：共用物料只占一行、需求量＝各品之和（PRD §4.11 多品共用物料按系列聚合统一计算）。
          物料参数（开封效期 / 备货系数 / 损耗率 / W1-W4 杯占比）按<b>品</b>维护，见第 1 步「预测杯量」里的分品 BOM 参数表。
        </div>
        <table className="data-table table-fit">
          <thead><tr><th>合并品名</th><th>原材料名称</th><th>原材料编码</th><th>规格型号</th><th>单位</th><th className="num">单位用量</th><th>用量单位</th></tr></thead>
          <tbody>
            {aggregatedMaterials.map(m => {
              const isShared = (m.sourceProducts?.length ?? 0) > 1;
              return (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{m.mergedProductName || m.materialName}</td>
                  <td style={{ fontWeight: 600 }}>
                    {m.materialName}
                    {isShared
                      ? <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--accent)' }}><Icon n="link" size={12} /> 两品共用·已加和</span>
                      : <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-muted)' }}>（{m.sourceProducts?.[0] ?? '—'}）</span>}
                  </td>
                  <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{m.materialCode || <span style={{ color: 'var(--warn)' }}><Icon n="alert" size={12} /> 空</span>}</td>
                  <td style={{ fontSize: 11 }}>{m.spec}</td>
                  <td>{m.unit}</td>
                  <td className="num">{m.unitUsage}</td>
                  <td>{m.usageUnit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 物料量计算（档位 2 · 真算） */}
      <div className="card">
        <div className="card-title"><Icon n="calc" style={{ marginRight: 6, color: 'inherit' }} />物料量计算（真算 · {productInfo.storeCount.toLocaleString()}门店 × {calc.materials.length}物料 × W1-W4）<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
        <pre className="formula-block">{`W1物料量    = 首周日均杯量 × 区域系数 × W1占比 × 7 ÷ 应用率W1 × 备货系数
W2-W4物料量 = 月日均杯量   × 区域系数 × Wn占比 × 7 ÷ 应用率Wn × 备货系数
效期校验    = if Wn < round(7 ÷ 开封效期天数) → 取 round(7 ÷ 开封效期天数)（一周至少备 1 箱）
预测总量    = Roundup(W1 + W2 + W3 + W4)
应用率Wn    = PRD §4.2.1 基准应用率（杯/箱）× (1 − 损耗率) ÷ (1 − 基准损耗率)
仓库物料量  = Σ(该仓覆盖门店的物料量)；底表为 50 家门店样本 → 仓级按「全国平均店 × 仓覆盖门店数」放大（Σ仓 == 全国）

示例（${calc.stores[0]?.storeName} × ${calc.stores[0]?.materials[0]?.material}）：
  首周日均 ${calc.stores[0]?.firstWeekDaily.toFixed(2)} × 区域系数 ${calc.stores[0]?.regionCoeff} × W1 占比 ${calc.materials[0]?.w[0]} × 7 ÷ 应用率 ${calc.materials[0]?.app.w1.toFixed(2)} × 备货系数 ${getPageValue('备货系数', calc.materials[0]?.material ?? '', materials[0]?.stockCoefficient ?? 1)} = ${calc.stores[0]?.materials[0]?.w[0].toFixed(2)} 箱
  该门店 ${calc.stores[0]?.materials.length} 个物料预测总量合计 = ${calc.stores[0]?.totalBoxes} 箱`}</pre>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.7 }}>
          ⚠️ <b>效期下限</b>：开封效期越短，本周最小备货量越大（如效期 4 天 → 每周至少 2 箱）。小量物料会被这项顶起，
          这是「备货偏差」的三大来源之一 —— 点表格里的数字改参数后，下表与 Step 3 的偏差率会<b>立刻变</b>。
        </div>
        <table className="data-table table-fit">
          <thead><tr><th>物料</th><th className="num">应用率W1<br/><span style={{ fontSize: 10, fontWeight: 400 }}>杯/箱</span></th><th className="num">效期下限<br/><span style={{ fontSize: 10, fontWeight: 400 }}>箱/周</span></th><th className="num">单店W1</th><th className="num">单店W2</th><th className="num">单店W3</th><th className="num">单店W4</th><th className="num">单店总量<br/><span style={{ fontSize: 10, fontWeight: 400 }}>(箱)</span></th><th className="num">全国预测量</th><th className="num">全国下单量</th><th>单位</th></tr></thead>
          <tbody>
            {calc.materials.map((m, i) => {
              const st = calc.stores[0]?.materials.find(x => x.material === m.material);
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{m.material}{st?.effLifted && <span style={{ fontSize: 10, color: 'var(--warn)', marginLeft: 4 }}>效期顶起</span>}</td>
                  <td className="num">{m.app.w1.toFixed(2)}</td>
                  <td className="num">{weekMinQty(materials.find(x => x.materialName === m.material)?.shelfLifeDays ?? 7)}</td>
                  <td className="num">{st?.w[0].toFixed(2)}</td>
                  <td className="num">{st?.w[1].toFixed(2)}</td>
                  <td className="num">{st?.w[2].toFixed(2)}</td>
                  <td className="num">{st?.w[3].toFixed(2)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{st?.total}</td>
                  <td className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>{m.forecastQty.toLocaleString()}</td>
                  <td className="num">{m.orderQty.toLocaleString()}</td>
                  <td style={{ fontSize: 11 }}>{m.unit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 全国物料汇总（真算） */}
      <div className="card">
        <div className="card-title"><Icon n="chart" style={{ marginRight: 6, color: 'inherit' }} />全国物料汇总（真算）<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.7 }}>
          理论需求量 = 纯预测杯量 × 用量（<b>不带</b>区域系数、备货系数）；全国预测量 = 经系数 + 效期校验后的当前分仓计算值；
          下单量 = Σ各仓 ceil(合计 ÷ MOQ) × MOQ（MOQ 取物料份额加权值，见 Step 3 供应商分配表）
        </div>
        <table className="data-table">
          <thead><tr><th>物料</th><th className="num">理论需求量</th><th className="num">全国预测量</th><th className="num">统配量</th><th className="num">统配外</th><th className="num">合计</th><th className="num">下单量</th><th>单位</th></tr></thead>
          <tbody>
            {calc.materials.map((m, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{m.material}</td>
                <td className="num" style={{ color: 'var(--text-muted)' }}>{m.theoreticalQty.toLocaleString()}</td>
                <td className="num">{m.forecastQty.toLocaleString()}</td>
                <td className="num">{m.unifiedQty.toLocaleString()}</td>
                <td className="num">{m.unifiedExtra.toLocaleString()}</td>
                <td className="num">{m.unifiedQty + m.unifiedExtra > 0 ? (m.unifiedQty + m.unifiedExtra).toLocaleString() : m.forecastQty.toLocaleString()}</td>
                <td className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>{m.orderQty.toLocaleString()}</td>
                <td style={{ fontSize: 11 }}>{m.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== 汇总到仓扁平表组件（仓+物料一起展示，支持筛选+分页；档位 2：真算） =====
function WarehouseFlatTable() {
  // 档位 2：仓级数字来自引擎（区域系数 / 备货系数 / 损耗率 / W1-W4 / 开封效期 / MOQ 改动全部联动）
  const { calc } = useCalc();
  const [whFilter, setWhFilter] = useState('all');
  const [whPage, setWhPage] = useState(0);
  const whPageSize = 20;

  const flatRows = useMemo(() => {
    const rows: Array<{ warehouse: string; storeCount: number; material: string; materialCode: string; forecastQty: number; allocationQty: number; extraStock: number; total: number; orderQty: number; unit: string; moq: number }> = [];
    calc.warehouses.forEach(wh => {
      wh.materials.forEach(m => {
        rows.push({
          warehouse: wh.warehouseName,
          storeCount: wh.storeCount,
          material: m.material,
          materialCode: m.code,
          forecastQty: m.forecastQty,
          allocationQty: m.unifiedQty,
          extraStock: m.unifiedExtra,
          total: m.total,
          orderQty: m.orderQty,
          unit: m.unit,
          moq: m.moq,
        });
      });
    });
    return rows;
  }, [calc]);

  const filteredRows = whFilter === 'all' ? flatRows : flatRows.filter(r => r.warehouse === whFilter);
  const totalPages = Math.ceil(filteredRows.length / whPageSize);
  const pagedRows = filteredRows.slice(whPage * whPageSize, (whPage + 1) * whPageSize);

  // 合并单元格：同一仓库的仓库名和门店数
  let prevWh = '';

  return (
    <div className="card">
      <div className="card-title"><Icon n="factory" style={{ marginRight: 6, color: 'inherit' }} />汇总到仓（{calc.warehouses.length}仓 × {calc.materials.length}物料 · 真算）<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.7 }}>
        仓店映射来源：dw_store_warehouse_map（WEEK + LEVEL_ONE/LEVEL_TWO，一店一仓）；<b>仓库物料量 = Σ该仓覆盖门店的物料量</b>（底表 50 家门店样本 → 仓级按「全国平均店 × 仓覆盖门店数」放大，Σ仓 == 全国）。
        统配量＝T-30 出数的<b>外部绝对量</b>（出数后不随页面调参变化）；统配外 = IF(预测 − 统配 &lt; 0, 0, 差值)；下单量 = ceil(合计 ÷ MOQ) × MOQ。
      </p>

      {/* 筛选栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>仓库筛选：</span>
        <select value={whFilter} onChange={e => { setWhFilter(e.target.value); setWhPage(0); }} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'white', minWidth: 140 }}>
          <option value="all">全部仓库（{calc.warehouses.length}仓）</option>
          {calc.warehouses.map((wh, i) => (
            <option key={i} value={wh.warehouseName}>{wh.warehouseName}（{wh.storeCount}店 · 系数{wh.regionCoeff}）</option>
          ))}
        </select>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>共 {filteredRows.length} 行</span>
      </div>

      {/* 扁平表 */}
      <div style={{ maxHeight: 480, overflowY: 'auto' }}>
        <table className="data-table table-fit">
          <thead>
            <tr>
              <th style={{ minWidth: 100, position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>仓库</th>
              <th className="num" style={{ position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>覆盖门店</th>
              <th style={{ minWidth: 120, position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>物料</th>
              <th style={{ position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>物料编码</th>
              <th className="num" style={{ position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>预测量<br/><span style={{ fontSize: 10, fontWeight: 400 }}>(当前分仓计算值)</span></th>
              <th className="num" style={{ position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>统配量</th>
              <th className="num" style={{ position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>统配外</th>
              <th className="num" style={{ position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>合计</th>
              <th className="num" style={{ position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>MOQ</th>
              <th className="num" style={{ position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>下单量</th>
              <th style={{ position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>单位</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((r, i) => {
              const showWh = r.warehouse !== prevWh;
              prevWh = r.warehouse;
              return (
                <tr key={i} style={{ background: showWh && i > 0 ? 'rgba(79,168,224,0.04)' : undefined }}>
                  <td style={{ fontWeight: showWh ? 600 : 400, color: showWh ? 'var(--accent)' : 'var(--text-muted)', fontSize: showWh ? 12 : 11 }}>{showWh ? r.warehouse : ''}</td>
                  <td className="num" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{showWh ? r.storeCount : ''}</td>
                  <td style={{ fontWeight: 600 }}>{r.material}</td>
                  <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{r.materialCode}</td>
                  <td className="num">{r.forecastQty.toLocaleString()}</td>
                  <td className="num">{r.allocationQty.toLocaleString()}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{r.extraStock.toLocaleString()}</td>
                  <td className="num">{r.total.toLocaleString()}</td>
                  <td className="num" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.moq}</td>
                  <td className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>{r.orderQty.toLocaleString()}</td>
                  <td style={{ fontSize: 11 }}>{r.unit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, fontSize: 12 }}>
          <button onClick={() => setWhPage(0)} disabled={whPage === 0} style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'white', cursor: whPage === 0 ? 'default' : 'pointer', opacity: whPage === 0 ? 0.4 : 1 }}>首页</button>
          <button onClick={() => setWhPage(p => Math.max(0, p - 1))} disabled={whPage === 0} style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'white', cursor: whPage === 0 ? 'default' : 'pointer', opacity: whPage === 0 ? 0.4 : 1 }}>上一页</button>
          <span style={{ color: 'var(--text-muted)' }}>{whPage + 1} / {totalPages}</span>
          <button onClick={() => setWhPage(p => Math.min(totalPages - 1, p + 1))} disabled={whPage >= totalPages - 1} style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'white', cursor: whPage >= totalPages - 1 ? 'default' : 'pointer', opacity: whPage >= totalPages - 1 ? 0.4 : 1 }}>下一页</button>
          <button onClick={() => setWhPage(totalPages - 1)} disabled={whPage >= totalPages - 1} style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'white', cursor: whPage >= totalPages - 1 ? 'default' : 'pointer', opacity: whPage >= totalPages - 1 ? 0.4 : 1 }}>末页</button>
        </div>
      )}
    </div>
  );
}

// B-4：供应商份额实时合计校验（改份额后立即重算；≠100% 拒绝提交 —— 对齐 B 规格 §2.3）
// 底表定义已移到 data/mock.ts 的 supplierRoot（计算引擎 calcInput 与页面共用同一份）

function SupplierShareCheck() {
  useValueVersion();
  const items = supplierRoot.map(g => {
    const sum = g.rows.reduce((a, [gran, def]) => a + getPageValue('供应商份额', gran, def), 0);
    return { merged: g.merged, sum: Math.round(sum * 100) / 100, ok: Math.abs(sum - 100) < 0.001 };
  });
  const allOk = items.every(i => i.ok);
  return (
    <div>
      <div>约束校验：
        {items.map(i => (
          <span key={i.merged} style={{ marginRight: 12 }}>
            {i.merged} 合计 <b>{i.sum}%</b>{' '}
            {i.ok ? <span className="dot dot-pass" /> : <span className="status-tag status-fail"><span className="dot dot-fail" />差 {Math.round((100 - i.sum) * 100) / 100}%</span>}
          </span>
        ))}
        ｜ MOQ 向上取整 <span className="dot dot-pass" /> ｜ 合并品名聚合后再拆 SKU <span className="dot dot-pass" /> ｜ 周可供量覆盖需求 <span className="dot dot-pass" />
      </div>
      {!allOk && <div style={{ color: 'var(--danger)', fontWeight: 600 }}><Icon n="alert" size={12} /> 有合并品名份额合计 ≠ 100%：按 PRD §2.3 校验不通过、不能提交（请改到 100% 再提交）</div>}
    </div>
  );
}

function RightStep3WarehouseAndWarnings({ tongpeiDone, supplierDone, onTongpeiArrived }: { tongpeiDone: boolean; supplierDone: boolean; onTongpeiArrived: () => void }) {
  const safetyDays = usePageValue('安全库存天数', '全局', 7);
  /* ===== 统配数据（T-30 出数）上传 =====
   * PRD §4.2.4：「统配量＝门店提报的真实需求（T-30 出数）」；① 数据来源写明**过渡期手动上传 Excel**。
   * 所以这张卡上给业务方一个上传口：选文件 → 用她 index.html 里 vendor 的 xlsx **本地解析**
   * （与她的报表同一套解析库，不新增依赖）→ 显示文件名/大小/行数/列 + 前 3 行预览 →
   * 标记「统配数据已到」并自动展开统配比对。
   * ⚠️ 比对结果仍按内置样例（T-30 出数本身是外部数据）；上传解析是真解析，不假报行数。 */
  const [upload, setUpload] = useState<{ name: string; size: number; rows: number; cols: string[]; preview: string[][]; note: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  type XlsxLike = {
    read: (b: ArrayBuffer, o: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
    utils: { sheet_to_json: (ws: unknown, o: { header: number; raw: boolean; defval: string }) => unknown[][] };
  };
  const handleUpload = async (e: { target: HTMLInputElement }) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setUploading(true);
    const info = { name: f.name, size: f.size, rows: 0, cols: [] as string[], preview: [] as string[][], note: '' };
    try {
      const XLSX = (window as unknown as { XLSX?: XlsxLike }).XLSX;
      if (XLSX) {
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
        const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
        info.cols = (aoa[0] || []).map(c => String(c));
        info.rows = Math.max(0, aoa.length - 1);
        info.preview = aoa.slice(1, 4).map(r => (r || []).map(c => String(c)));
        info.note = '已本地解析（她的 vendor/xlsx，与她的报表同一套解析库）';
      } else if (/\.csv$/i.test(f.name)) {
        const lines = (await f.text()).split(/\r?\n/).filter(l => l.trim());
        info.cols = (lines[0] || '').split(',');
        info.rows = Math.max(0, lines.length - 1);
        info.preview = lines.slice(1, 4).map(l => l.split(','));
        info.note = '已本地解析（CSV）';
      } else {
        info.note = '页面未加载到 xlsx 解析库（她的 vendor 脚本没起来）—— 已记录文件，比对仍用内置样例数据';
      }
    } catch (err) {
      info.note = '解析失败：' + String(err);
    }
    setUpload(info);
    setUploading(false);
    onTongpeiArrived(); /* 统配数据已到 → 展开统配比对 */
    e.target.value = ''; /* 允许重复上传同一文件 */
  };
  // 档位 2：A 类计算过程检测全部来自引擎（§4.11 备货偏差 10% / §4.12 MOQ 取整 5% / §4.15 安库 N 天）
  const { calc } = useCalc();
  // 异常统配门店明细（12家）
  const abnormalStores = [
    { storeId: '44030708', storeName: '广东深圳龙岗摩尔城店', warehouse: '广东一级仓', material: '莲雾苹果汁', forecast: 82, unified: 95, diff: -13 },
    { storeId: '31011501', storeName: '上海陆家嘴店', warehouse: '上海一级仓', material: '冷冻生椰乳', forecast: 28, unified: 35, diff: -7 },
    { storeId: '51010701', storeName: '成都太古里店', warehouse: '四川一级仓', material: '安溪铁观音', forecast: 14, unified: 18, diff: -4 },
    { storeId: '42010601', storeName: '武汉光谷店', warehouse: '湖北一级仓', material: '莲雾苹果汁', forecast: 76, unified: 88, diff: -12 },
    { storeId: '33010601', storeName: '杭州武林广场店', warehouse: '浙江一级仓', material: '冷冻生椰乳', forecast: 25, unified: 30, diff: -5 },
    { storeId: '44010601', storeName: '广州珠江新城店', warehouse: '广东一级仓', material: '安溪铁观音', forecast: 15, unified: 20, diff: -5 },
    { storeId: '11010501', storeName: '北京朝阳大悦城店', warehouse: '北京二级仓', material: '莲雾苹果汁', forecast: 90, unified: 102, diff: -12 },
    { storeId: '32050101', storeName: '苏州观前街店', warehouse: '江苏一级仓', material: '冷冻生椰乳', forecast: 22, unified: 28, diff: -6 },
    { storeId: '61010401', storeName: '西安小寨店', warehouse: '陕西一级仓', material: '安溪铁观音', forecast: 13, unified: 16, diff: -3 },
    { storeId: '50010501', storeName: '重庆观音桥店', warehouse: '重庆一级仓', material: '莲雾苹果汁', forecast: 70, unified: 82, diff: -12 },
    { storeId: '43010201', storeName: '长沙芙蓉广场店', warehouse: '湖南一级仓', material: '冷冻生椰乳', forecast: 20, unified: 25, diff: -5 },
    { storeId: '35020101', storeName: '厦门中山路店', warehouse: '福建一级仓', material: '安溪铁观音', forecast: 12, unified: 15, diff: -3 },
  ];

  // 物料维度检测数据（真算）
  const warningByMaterial = calc.materials.map(m => ({
    name: m.material,
    forecastQty: m.forecastQty,
    orderQty: m.orderQty,
    theoreticalQty: m.theoreticalQty,
    stockDeviation: m.devPct,
    moqDeviation: m.moqDevPct,
    safetyDays: m.safetyDays,
    stockStatus: m.stockPass ? 'pass' : 'fail',
    moqStatus: m.moqPass ? 'pass' : 'fail',
    safetyStatus: m.safetyPass ? 'pass' : 'fail',
  }));

  const statusIcon = (s: string) => s === 'pass' ? <span className="status-tag status-pass"><span className="dot dot-pass" />通过</span> : s === 'fail' ? <span className="status-tag status-fail"><span className="dot dot-fail" />超阈值</span> : <span className="status-tag status-warn"><span className="dot dot-warn" />提醒</span>;
  const statusVal = (val: string | number, s: string) => <span className={s === 'pass' ? 'warn-pass' : s === 'fail' ? 'warn-fail' : 'warn-warn'}>{val}</span>;

  // 供应商确认后自动定位到供应商分配表（避免"表未展示"的误判）
  useEffect(() => {
    if (supplierDone) {
      const el = document.getElementById('supplier-alloc-card');
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    }
  }, [supplierDone]);

  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 3</span>汇总到仓 + 供应商 + 预警</div>

      {/* 汇总到仓 — 扁平表（仓+物料一起展示） */}
      <WarehouseFlatTable />

      {/* 供应商 */}
      {supplierDone ? (
        <div className="card" id="supplier-alloc-card" style={{ borderColor: 'var(--accent)' }}>
          <div className="card-title" style={{ color: 'var(--accent)' }}><Icon n="box" style={{ marginRight: 6, color: 'inherit' }} />供应商分配表（份额 + MOQ 取整）<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>
            份额由飞书多维表格维护（合计须＝100%）；MOQ 向上取整：各仓下单量 = ceil(仓需求量 ÷ MOQ) × MOQ；无 MOQ 时默认 = 1，不取整
          </div>
          <table className="data-table table-fit">
            <thead><tr><th>合并品名</th><th>原材料名称</th><th>供应商</th><th className="num">份额%</th><th className="num">MOQ</th><th className="num">周可供量*</th><th className="num">需求分配量<br/><span style={{ fontSize: 10, fontWeight: 400 }}>（合并品名维度）</span></th><th className="num">MOQ取整后</th></tr></thead>
            <tbody>
              {supplierRoot.flatMap(g => g.rows.map(([key, defShare]) => {
                const [matName, supplierName] = key.split(' / ');
                const row = calc.supplierRows.find(r => r.material === matName && r.supplier === supplierName);
                const isNewSupplier = key.includes('新供应商');
                return (
                  <tr key={key} style={isNewSupplier ? { background: 'rgba(96,165,250,0.06)' } : undefined}>
                    <td style={{ fontWeight: 600 }}>{g.merged}</td>
                    <td>{matName}</td>
                    <td>{isNewSupplier ? <><b>{supplierName}</b><br/><span style={{ fontSize: 11, color: 'var(--warn)' }}>SRM 无发货仓数据 → 不考虑地点</span></> : supplierName}</td>
                    <td className="num"><EditableNumber value={defShare} rule={{ min: 0, max: 100, int: true, suffix: '%' }} param="供应商份额" granularity={key} effect="Step ⑦–⑨" /></td>
                    <td className="num">
                      <EditableNumber value={MOQ_DEFAULTS[key] ?? 1} rule={{ min: 1, max: 100000, int: true }} param="MOQ" granularity={key} effect="Step ⑦–⑨" />
                      {(MOQ_DEFAULTS[key] ?? 1) <= 1 && <span style={{ fontSize: 10, display: 'block' }}>（默认 1＝不取整）</span>}
                    </td>
                    <td className="num">{SUPPLY_CAPACITY[key] ?? '—'}</td>
                    <td className="num">{row ? row.allocQty.toLocaleString() : '—'}</td>
                    <td className="num">{row ? row.moqQty.toLocaleString() : '—'}</td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
          <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.9 }}>
            <SupplierShareCheck />
            <div style={{ fontSize: 12, lineHeight: 1.9 }}>
              <div>① <b>合并品名</b>：<code>安溪铁观音-1</code> / <code>安溪铁观音-2</code> 属同一合并品名「安溪铁观音」——<b>门店→仓全链路按合并品名聚合</b>（需求分配量合计 66,285），<b>仅本步才拆到 SKU / 规格 / 箱规</b>再按 <b>{getPageValue('供应商份额', '安溪铁观音-1 / 福建安溪茶业A', 60)}% / {getPageValue('供应商份额', '安溪铁观音-2 / 云南普洱供应链B', 40)}%</b> 分给两个供应商（份额在分配表内点数字直接改）</div>
              <div>② <b>新供应商</b>（SRM 中查不到该供应商的发货仓数据）→ 分配时<b>不考虑地点（距离）因素</b>，仍按份额分配；可建虚拟项占位 <span className="dot dot-pass" /></div>
              <div style={{ color: 'var(--text-muted)' }}>* 系统<b>不配置「产能」字段</b>——业务方在定份额时已考虑产能（9/22 会议确认）；「周可供量」仅为业务侧提供的展示值，不参与系统计算。</div>
              <div style={{ color: 'var(--text-muted)' }}>数据来源：飞书多维表格（供应商信息：只需填份额）→ 湖仓 → 本体。</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ borderColor: 'var(--warn)', background: 'rgba(245,158,11,0.04)' }}>
          <div className="card-title" style={{ color: 'var(--warn)' }}><Icon n="box" style={{ marginRight: 6, color: 'inherit' }} />供应商数据（待确认）</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            供应商分配数据尚未确认，请在左侧对话中点击"供应商数据已确认"或输入"供应商已确认"。
          </p>
        </div>
      )}

      {/* AI推荐供应商 → 仓分配方案（V7.5 新增：PRD §4.10 六维度） */}
      {supplierDone && (
        <div className="card" style={{ borderColor: 'var(--accent)', background: 'var(--accent-bg)' }}>
          <div className="card-title" style={{ color: 'var(--accent)' }}><Icon n="robot" style={{ marginRight: 6, color: 'inherit' }} />AI推荐供应商 → 仓分配方案<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>
            <b>6 维度综合评估</b>：① 份额占比 ② MOQ 规则 ③ 同组仓归属（同一一级仓下的二级仓尽量给同一供应商）④ 距离远近（供应商发货地 → 仓的物流距离）⑤ 仓配优先 ⑥ 一组仓尽量一个供应商。<br/>
            30+ 仓 × 多供应商时人工分配效率低、容易漏约束，AI 一次性给出全局最优方案，用户只需<b>审核确认</b>或<b>手动调整某些仓</b>后系统重算。
          </div>
          <table className="data-table table-fit">
            <thead>
              <tr><th>仓</th><th>物料</th><th>AI 推荐供应商</th><th className="num">分配量</th><th>推荐理由（命中的维度）</th></tr>
            </thead>
            <tbody>
              <tr><td style={{ fontWeight: 600 }}>福建一级仓</td><td>安溪铁观音</td><td style={{ color: 'var(--accent)', fontWeight: 600 }}>福建安溪茶业A</td><td className="num">12,400</td><td style={{ fontSize: 11 }}>③同组仓归属 ④发货地同省（距离最近）①份额优先</td></tr>
              <tr><td style={{ fontWeight: 600 }}>广东一级仓</td><td>安溪铁观音</td><td style={{ color: 'var(--accent)', fontWeight: 600 }}>福建安溪茶业A</td><td className="num">9,800</td><td style={{ fontSize: 11 }}>④运输半径最短 ⑤仓配优先</td></tr>
              <tr><td style={{ fontWeight: 600 }}>浙江一级仓</td><td>安溪铁观音</td><td style={{ color: 'var(--accent)', fontWeight: 600 }}>福建安溪茶业A</td><td className="num">8,600</td><td style={{ fontSize: 11 }}>④距离次优 ①份额优先</td></tr>
              <tr><td style={{ fontWeight: 600 }}>上海一级仓</td><td>安溪铁观音</td><td style={{ color: 'var(--accent)', fontWeight: 600 }}>福建安溪茶业A</td><td className="num">8,971</td><td style={{ fontSize: 11 }}>①份额优先 ③同组仓归属</td></tr>
              <tr><td style={{ fontWeight: 600 }}>云南一级仓</td><td>安溪铁观音</td><td style={{ color: 'var(--accent)', fontWeight: 600 }}>云南普洱供应链B</td><td className="num">14,900</td><td style={{ fontSize: 11 }}>④发货地同省 ⑥一组仓同一供应商</td></tr>
              <tr><td style={{ fontWeight: 600 }}>四川一级仓</td><td>安溪铁观音</td><td style={{ color: 'var(--accent)', fontWeight: 600 }}>云南普洱供应链B</td><td className="num">11,614</td><td style={{ fontSize: 11 }}>④距离次优 ⑤仓配优先</td></tr>
              <tr style={{ background: 'rgba(245,158,11,0.06)' }}><td style={{ fontWeight: 600 }}>湖北一级仓</td><td>安溪铁观音（合并品名）</td><td style={{ color: 'var(--accent)', fontWeight: 600 }}>福建安溪茶业A <b>90%</b> + 云南普洱供应链B <b>10%</b>（<b>同仓拆分</b>）</td><td className="num">16,800</td><td style={{ fontSize: 11 }}>② 份额 60/40 无法整仓对齐 → <b>拆同一一级仓的部分份额</b>（避免单供应商超 MOQ / 可供量）</td></tr>
              <tr><td style={{ fontWeight: 600 }}>海南二级仓</td><td>冷冻生椰乳</td><td style={{ color: 'var(--accent)', fontWeight: 600 }}>椰树供应链D</td><td className="num">18,400</td><td style={{ fontSize: 11 }}>④发货地同省 ③二级仓随一级仓</td></tr>
              <tr><td style={{ fontWeight: 600 }}>广东一级仓</td><td>冷冻生椰乳</td><td style={{ color: 'var(--accent)', fontWeight: 600 }}>椰树供应链D</td><td className="num">22,300</td><td style={{ fontSize: 11 }}>④距离最短 ①份额优先</td></tr>
              <tr><td style={{ fontWeight: 600 }}>湖北一级仓</td><td>冷冻生椰乳</td><td style={{ color: 'var(--accent)', fontWeight: 600 }}>海南椰品E</td><td className="num">16,800</td><td style={{ fontSize: 11 }}>③同组仓剥离（避免单供应商超可供量）</td></tr>
              <tr><td style={{ fontWeight: 600 }}>辽宁一级仓</td><td>冷冻生椰乳</td><td style={{ color: 'var(--accent)', fontWeight: 600 }}>海南椰品E</td><td className="num">9,700</td><td style={{ fontSize: 11 }}>④北方仓就近 ②MOQ 规则匹配</td></tr>
              <tr style={{ background: 'rgba(96,165,250,0.06)' }}><td style={{ fontWeight: 600 }}>北京二级仓</td><td>冷冻凤梨汁（新供应商）</td><td style={{ color: 'var(--accent)', fontWeight: 600 }}>新供应商G（虚拟项）</td><td className="num">12,480</td><td style={{ fontSize: 11 }}><b>SRM 无发货仓数据</b> → <b>不考虑地点因素</b>，仅按份额 100% 分配</td></tr>
              <tr><td style={{ fontWeight: 600 }}>全部 21 仓</td><td>莲雾苹果汁 / 东方美人乌龙茶-A</td><td style={{ color: 'var(--accent)', fontWeight: 600 }}>海南果汁工厂C / 台湾茶业F</td><td className="num">363,540 / 28,655</td><td style={{ fontSize: 11 }}>⑥单一供应商（100% 份额，无拆分）</td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.9 }}>
            <div><b>约束校验</b>：份额合计 = 100% <span className="dot dot-pass" /> ｜ MOQ 向上取整 <span className="dot dot-pass" /> ｜ 同组仓同一供应商 <span className="dot dot-pass" /> ｜ 供应商可供量覆盖 <span className="dot dot-pass" /></div>
            <div><b>人工可介入</b>：确认方案直接进入下一步；或输入「调整 湖北一级仓 供应商 椰树供应链D」→ 系统重算并重新校验约束</div>
            <div style={{ color: 'var(--text-muted)' }}>输入依据：各仓需求量、各供应商份额/MOQ/发货地、仓店映射关系、仓组归属关系</div>
          </div>
        </div>
      )}

      <div className="card" style={{ borderColor: 'var(--good)', background: 'rgba(34,197,94,0.04)' }}>
        <div className="card-title" style={{ color: 'var(--good)' }}><Icon n="chart" style={{ marginRight: 6, color: 'inherit' }} />A 类计算过程检测（计算过程数值检测 · 不推送、不阻断）<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>
          备货偏差阈值：10%（分仓计算值 vs 理论需求量，不带系数） ｜ MOQ取整偏差阈值：5% ｜ 安全库存天数：<b>{safetyDays} 天</b>（可在「参数面板」改）<br/>
          此页是<b>计算过程的数值检测</b>（在流程内展示，<b>不推送首页</b>）；<b>超阈值不影响进入下一步</b>，系统仅给出数值提醒。上新后 T+1~T+28 的监控指标才走预警中心 / 首页消息。
        </div>
        <table className="data-table warning-table">
          <thead>
            <tr>
              <th>物料</th>
              <th className="num">预测量</th>
              <th className="num">下单量</th>
              <th className="num">备货偏差<br/><span style={{ fontSize: 10, fontWeight: 400 }}>（分仓计算值 vs 理论需求量）</span></th>
              <th>状态</th>
              <th className="num">MOQ取整偏差</th>
              <th>状态</th>
              <th className="num">安全库存天数<br/><span style={{ fontSize: 10, fontWeight: 400 }}>（全国加权）</span></th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {warningByMaterial.map((m, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td className="num">{m.forecastQty.toLocaleString()}</td>
                <td className="num">{m.orderQty.toLocaleString()}</td>
                <td className="num">{statusVal(m.stockDeviation + '%', m.stockStatus)}</td>
                <td>{statusIcon(m.stockStatus)}</td>
                <td className="num">{statusVal(m.moqDeviation + '%', m.moqStatus)}</td>
                <td>{statusIcon(m.moqStatus)}</td>
                <td className="num">{statusVal(m.safetyDays + '天', m.safetyStatus)}</td>
                <td>{statusIcon(m.safetyStatus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 8, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {calc.materials.filter(m => !m.stockPass).map(m => (
            <span key={m.material} style={{ color: 'var(--warn)' }}><Icon n="alert" size={12} /> <b>{m.material}</b> 备货偏差 {m.devPct}%（分仓计算值 {m.forecastQty.toLocaleString()} vs 理论需求量 {m.theoreticalQty.toLocaleString()} {m.unit}）超阈值 —— <b>可继续下一步</b>，系统仅做数值提醒（主因见下方拆解）</span>
          ))}
          {calc.totals.stockAlertCount === 0 && <span style={{ color: 'var(--good)' }}><span className="dot dot-pass" /> 全部 {calc.materials.length} 个物料备货偏差均在阈值内</span>}
          <span style={{ color: 'var(--text-muted)' }}>本页检测结果不推送，仅在上新监控阶段触发预警时才走预警中心 / 首页消息 ｜ 阈值：备货偏差 {calc.totals.stockAlertCount}/{calc.materials.length} 超阈值 · MOQ 取整 {calc.totals.moqAlertCount}/{calc.materials.length} 超阈值 · 安库（可销售天数 &lt; {safetyDays} 天）{calc.totals.safetyAlertCount}/{calc.materials.length} 超阈值</span>
        </div>
      </div>

      {/* 偏差来源拆解 + 调参建议（真算：取 |备货偏差率| 最大的物料做三因素精确分解） */}
      {calc.breakdown && (
        <div className="card" style={{ borderColor: 'var(--warn)', background: 'rgba(245,158,11,0.04)' }}>
          <div className="card-title" style={{ color: 'var(--warn)' }}><Icon n="search" style={{ marginRight: 6, color: 'inherit' }} />偏差来源拆解 + 调参建议（{calc.breakdown.material} {calc.breakdown.devPct > 0 ? '+' : ''}{calc.breakdown.devPct}%）</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>
            理论需求量（纯预测杯量 × 用量，不带任何系数）<b>{calc.breakdown.theoreticalQty.toLocaleString()}</b> {calc.breakdown.unit} ｜
            当前分仓计算值 <b>{calc.breakdown.forecastQty.toLocaleString()}</b> {calc.breakdown.unit} ｜
            Σ仓 MOQ 取整后 <b>{calc.breakdown.orderQty.toLocaleString()}</b> {calc.breakdown.unit} ｜
            总偏差 <b>{calc.breakdown.totalDelta > 0 ? '+' : ''}{calc.breakdown.totalDelta.toLocaleString()}</b> {calc.breakdown.unit}（{calc.breakdown.devPct > 0 ? '+' : ''}{calc.breakdown.devPct}%）
          </div>
          <table className="data-table">
            <thead>
              <tr><th>偏差来源</th><th className="num">贡献量</th><th className="num">占总偏差</th><th>说明</th></tr>
            </thead>
            <tbody>
              {calc.breakdown.parts.map((p, i) => (
                <tr key={p.name} style={{ background: i === 0 ? 'rgba(245,158,11,0.08)' : undefined }}>
                  <td style={{ fontWeight: i === 0 ? 700 : 600 }}>{i === 0 ? '①' : i === 1 ? '②' : '③'} {p.name}{i === 0 ? '（主因）' : ''}</td>
                  <td className="num" style={{ fontWeight: i === 0 ? 700 : 400 }}>{p.value > 0 ? '+' : ''}{Math.round(p.value).toLocaleString()}</td>
                  <td className="num" style={{ fontWeight: i === 0 ? 700 : 400 }}>{p.share}%</td>
                  <td style={{ fontSize: 11 }}>{p.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.9 }}>
            <div><b>主因判断</b>：{calc.breakdown.main}贡献 {calc.breakdown.mainSharePct}%{calc.breakdown.mainSharePct >= 50 ? ' > 50% → 该因素主导（按下方建议处理）' : '（三因素较分散，建议逐项试调）'}</div>
            {calc.breakdown.advice.map((a, i) => <div key={i}><b>调参建议</b>：{a}</div>)}
            <div style={{ color: 'var(--text-muted)' }}>说明：本卡片实时联动 —— 在表格里改任一参数，这里的三因素贡献与偏差率会立即重算。</div>
          </div>
        </div>
      )}

      {/* 仓级统配对比 */}
      <div className="card">
        <div className="card-title"><Icon n="box" style={{ marginRight: 6, color: 'inherit' }} />仓级统配对比<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>
          预测统配量（分仓计算值）vs 实际统配量（SCM下发），偏差 &gt; 10% 标记为异常<br/>
          <b>本表为外部统配数据（T-30 出数，mock），不参与本轮真算</b> —— 分仓计算侧的真算结果见上方「汇总到仓」表。
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>仓库名</th>
              <th className="num">预测统配量</th>
              <th className="num">实际统配量</th>
              <th className="num">差异（绝对值）</th>
              <th className="num">差异（%）</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {mockWarehouseDistributionCompare.map((w, i) => (
              <tr key={i} style={{ background: w.isAbnormal ? 'rgba(245,158,11,0.04)' : undefined }}>
                <td style={{ fontWeight: 600 }}>{w.warehouseName}</td>
                <td className="num">{w.forecastQty.toLocaleString()}</td>
                <td className="num">{w.actualQty.toLocaleString()}</td>
                <td className="num" style={{ color: w.isAbnormal ? 'var(--warn)' : 'var(--text-muted)' }}>{w.deviation.toLocaleString()}</td>
                <td className="num" style={{ color: w.isAbnormal ? 'var(--warn)' : 'var(--good)', fontWeight: 700 }}>{w.deviationPct}%</td>
                <td>{w.isAbnormal ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: 'var(--warn)' }}><Icon n="alert" size={12} /> 异常</span> : <span className="status-tag status-pass"><span className="dot dot-pass" />通过</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 统配数据（T-30 出数）—— 业务方可**上传 Excel**（PRD §4.2.4：过渡期手动上传） */}
      <div className="card" style={{ borderColor: 'var(--warn)', background: 'rgba(245,158,11,0.04)' }}>
        <div className="card-title" style={{ color: 'var(--warn)' }}>
          <Icon n="clock" style={{ marginRight: 6, color: 'inherit' }} />统配数据（T-30出数）
          {tongpeiDone && <span className="status-tag status-pass" style={{ marginLeft: 8 }}><span className="dot dot-pass" />已到达</span>}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 10 }}>
          {tongpeiDone
            ? <>统配数据已到达（业务方上传 / T-30 出数），已按门店 × 物料与预测量比对，统配外 = IF(预测−统配 &lt; 0, 0, 预测−统配)。</>
            : <>统配数据尚未到达 —— 等 T-30 出数，或由业务方在下面<b>直接上传 Excel</b> 后立即比对。<br/>统配外 = IF(预测−统配 &lt; 0, 0, 预测−统配)</>}
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="export-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Icon n="download" size={12} /> {uploading ? '解析中…' : '上传统配 Excel'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleUpload} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>模板列：门店编码 / 门店名称 / 仓库 / 物料 / 统配量（过渡期手工上传，线上接湖仓「统配订单」）</span>
        </div>
        {upload && (
          <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.8 }}>
            <div>
              📄 <b>{upload.name}</b> · {(upload.size / 1024).toFixed(1)} KB · 首表解析出 <b>{upload.rows}</b> 行 × {upload.cols.length} 列
              {upload.note && <span style={{ color: 'var(--text-muted)' }}>（{upload.note}）</span>}
            </div>
            {upload.cols.length > 0 && (
              <div style={{ overflowX: 'auto', marginTop: 6 }}>
                <table className="data-table table-fit">
                  <thead><tr>{upload.cols.map((c, i) => <th key={i}>{c || `列${i + 1}`}</th>)}</tr></thead>
                  <tbody>
                    {upload.preview.map((r, i) => (
                      <tr key={i}>{upload.cols.map((_, j) => <td key={j} style={{ fontSize: 11 }}>{r[j] ?? ''}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
                {upload.rows > 3 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>仅预览前 3 行，共 {upload.rows} 行</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 统配比对（统配数据到达后展开） */}
      {tongpeiDone ? (
        <>
          <div className="card">
            <div className="card-title"><Icon n="clock" style={{ marginRight: 6, color: 'inherit' }} />T-30 统配比对 — 门店1101010005<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
            <table className="data-table">
              <thead><tr><th>物料</th><th className="num">预测</th><th className="num">统配</th><th className="num">统配外</th><th className="num">合计</th><th>状态</th></tr></thead>
              <tbody>
                <tr><td style={{ fontWeight: 600 }}>安溪铁观音</td><td className="num">16</td><td className="num">6</td><td className="num">10</td><td className="num" style={{ fontWeight: 700 }}>16</td><td><span className="status-tag status-pass"><span className="dot dot-pass" />通过</span></td></tr>
                <tr><td style={{ fontWeight: 600 }}>莲雾苹果汁</td><td className="num">99</td><td className="num">35</td><td className="num">64</td><td className="num" style={{ fontWeight: 700 }}>99</td><td><span className="status-tag status-pass"><span className="dot dot-pass" />通过</span></td></tr>
                <tr><td style={{ fontWeight: 600 }}>冷冻生椰乳</td><td className="num">32</td><td className="num">12</td><td className="num">20</td><td className="num" style={{ fontWeight: 700 }}>32</td><td><span className="status-tag status-pass"><span className="dot dot-pass" />通过</span></td></tr>
                <tr><td style={{ fontWeight: 600 }}>东方美人乌龙茶-A</td><td className="num">8</td><td className="num">0</td><td className="num">8</td><td className="num" style={{ fontWeight: 700 }}>8</td><td><span className="status-tag status-pass"><span className="dot dot-pass" />通过</span></td></tr>
              </tbody>
            </table>
          </div>

          {/* 异常统配门店明细 */}
          <div className="card" style={{ borderColor: 'var(--warn)', background: 'rgba(245,158,11,0.04)' }}>
            <div className="card-title" style={{ color: 'var(--warn)' }}><Icon n="alert" style={{ marginRight: 6, color: 'inherit' }} />异常统配门店明细（统配 &gt; 预测，共12家）<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>以下门店统配量超过预测量，统配外=0，需人工确认是否追加</p>
            <table className="data-table">
              <thead><tr><th>门店编码</th><th>门店名称</th><th>仓库</th><th>物料</th><th className="num">预测</th><th className="num">统配</th><th className="num">差异</th><th>状态</th></tr></thead>
              <tbody>
                {abnormalStores.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{s.storeId}</td>
                    <td style={{ fontWeight: 600, fontSize: 11 }}>{s.storeName}</td>
                    <td style={{ fontSize: 11 }}>{s.warehouse}</td>
                    <td style={{ fontWeight: 600 }}>{s.material}</td>
                    <td className="num">{s.forecast}</td>
                    <td className="num" style={{ color: 'var(--warn)', fontWeight: 700 }}>{s.unified}</td>
                    <td className="num" style={{ color: 'var(--danger, #ef4444)' }}>{s.diff}</td>
                    <td><span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: 'var(--warn)' }}>需确认</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {/* 安全库存明细（真算：安库 = round(仓上新预测总量 ÷ 28)；可销售天数 = 统配外 ÷ 日均消耗） */}
      {(() => {
        const wh = calc.warehouses[0];
        if (!wh) return null;
        return (
          <div className="card">
            <div className="card-title"><Icon n="chart" style={{ marginRight: 6, color: 'inherit' }} />安全库存校验 — {wh.warehouseName}（系数 {wh.regionCoeff}）<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.7 }}>
              安库（日均消耗量）= round(仓维度上新预测总量 ÷ 28)；可销售天数 = 统配外 ÷ 日均消耗；&lt; 安全库存天数（当前 <b>{safetyDays} 天</b>）→ 提示补充。<b>{wh.warehouseName} 覆盖 {wh.storeCount.toLocaleString()} 家门店</b>。
            </div>
            <table className="data-table table-fit">
              <thead><tr><th>物料</th><th>物料编码</th><th className="num">统配外</th><th className="num">日均消耗</th><th className="num">可销售天数</th><th>状态</th></tr></thead>
              <tbody>
                {wh.materials.map((m, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{m.material}</td>
                    <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{m.code}</td>
                    <td className="num">{m.unifiedExtra.toLocaleString()}</td>
                    <td className="num">{m.avgDailyConsume.toLocaleString()}</td>
                    <td className="num" style={{ fontWeight: 700, color: m.safetyPass ? 'var(--good)' : 'var(--danger, #ef4444)' }}>{m.sellableDays}天</td>
                    <td>{m.safetyPass ? <span className="status-tag status-pass"><span className="dot dot-pass" />通过</span> : <span className="status-tag status-warn"><span className="dot dot-warn" />低于 {safetyDays} 天</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}

function RightStep4Output({ productInfo }: { productInfo: NewProductInfo }) {
  const safetyDays = usePageValue('安全库存天数', '全局', 7);
  // 档位 2：结果输出全部来自引擎（物料量 → 汇总到仓 → MOQ → 检测）
  const { calc } = useCalc();
  // 预警计算明细（真算，逐物料；公式串由真实数值代入生成）
  const warningDetail = calc.materials.map(m => {
    const orderTotal = m.unifiedQty + m.unifiedExtra;
    return {
      name: m.material,
      code: m.code,
      unit: m.unit,
      forecastQty: m.forecastQty,
      orderQty: m.orderQty,
      theoreticalQty: m.theoreticalQty,
      stockDeviation: m.devPct,
      stockThreshold: 10,
      stockPass: m.stockPass,
      stockCalc: `(${m.forecastQty.toLocaleString()} - ${m.theoreticalQty.toLocaleString()}) ÷ ${m.theoreticalQty.toLocaleString()} = ${m.devPct > 0 ? '+' : ''}${m.devPct}%（分仓计算值 vs 理论需求量）`,
      moqDeviation: m.moqDevPct,
      moqThreshold: 5,
      moqPass: m.moqPass,
      moqCalc: `MOQ=${m.moq}（份额加权），Σ仓合计 ${orderTotal.toLocaleString()} → 取整后 ${m.orderQty.toLocaleString()}，偏差 ${m.moqDevPct}%`,
      safetyExtra: m.unifiedExtra,
      safetyDaily: Math.round(m.forecastQty / 28),
      safetyDays: m.safetyDays,
      safetyThreshold: safetyDays,
      safetyPass: m.safetyPass,
      safetyCalc: `统配外 ${m.unifiedExtra.toLocaleString()} ÷ 日均消耗 ${Math.round(m.forecastQty / 28).toLocaleString()}（＝仓上新预测总量 ÷ 28） = ${m.safetyDays} 天`,
    };
  });

  const passIcon = (pass: boolean) => pass
    ? <span className="status-tag status-pass"><span className="dot dot-pass" />通过</span>
    : <span className="status-tag status-fail"><span className="dot dot-fail" />超阈值</span>;

  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 4</span>结果输出</div>
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi-card"><div className="kpi-label">新品</div><div className="kpi-value" style={{ fontSize: 16 }}>{productInfo.name}</div></div>
        <div className="kpi-card"><div className="kpi-label">门店数</div><div className="kpi-value">{productInfo.storeCount.toLocaleString()}</div></div>
        <div className="kpi-card"><div className="kpi-label">物料数</div><div className="kpi-value">{calc.materials.length}</div></div>
        <div className="kpi-card"><div className="kpi-label" title="A 类计算过程检测：备货偏差 10% / MOQ取整 5% / 安库 N 天，三项命中数合计">检测项命中</div><div className="kpi-value" style={{ color: calc.totals.alertCount > 0 ? 'var(--warn)' : 'var(--good)' }}>{calc.totals.alertCount}项</div></div>
      </div>

      {/* 全国物料最终方案 */}
      <div className="card">
        <div className="card-title"><Icon n="chart" style={{ marginRight: 6, color: 'inherit' }} />全国物料最终方案<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
        <table className="data-table">
          <thead><tr><th>物料</th><th>物料编码</th><th className="num">预测量</th><th className="num">统配量</th><th className="num">统配外</th><th className="num">下单量</th><th>单位</th></tr></thead>
          <tbody>
            {calc.materials.map((m, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{m.material}</td>
                <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{m.code}</td>
                <td className="num">{m.forecastQty.toLocaleString()}</td>
                <td className="num">{m.unifiedQty.toLocaleString()}</td>
                <td className="num">{m.unifiedExtra.toLocaleString()}</td>
                <td className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>{m.orderQty.toLocaleString()}</td>
                <td style={{ fontSize: 11 }}>{m.unit}</td>
              </tr>
            ))}
            <tr style={{ background: 'rgba(79,168,224,0.06)' }}>
              <td style={{ fontWeight: 700 }}>合计（{calc.materials.length} 物料）</td>
              <td />
              <td className="num" style={{ fontWeight: 700 }}>{calc.totals.totalForecast.toLocaleString()}</td>
              <td className="num" style={{ fontWeight: 700 }}>{calc.materials.reduce((a, m) => a + m.unifiedQty, 0).toLocaleString()}</td>
              <td className="num" style={{ fontWeight: 700 }}>{calc.materials.reduce((a, m) => a + m.unifiedExtra, 0).toLocaleString()}</td>
              <td className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>{calc.totals.totalOrder.toLocaleString()}</td>
              <td style={{ fontSize: 11 }}>—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 预警汇总 — 计算明细 */}
      <div className="card" style={{ borderColor: 'var(--warn)', background: 'rgba(245,158,11,0.02)' }}>
        <div className="card-title" style={{ color: 'var(--warn)' }}><Icon n="list" style={{ marginRight: 6, color: 'inherit' }} />预警汇总 — 计算明细<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
          A 类检测阈值（汇总自「汇总到仓」页检测区）：备货偏差 ≤10% ｜ MOQ取整偏差 ≤5% ｜ 安全库存 ≥{safetyDays}天（可在「参数面板」改）<br/>
          命中情况：备货偏差 {calc.totals.stockAlertCount}/{calc.materials.length} ｜ MOQ 取整 {calc.totals.moqAlertCount}/{calc.materials.length} ｜ 安全库存 {calc.totals.safetyAlertCount}/{calc.materials.length}；<b>超阈值不阻断流程</b>，只做数值提醒。
        </div>

        {warningDetail.map((m, i) => (
          <div key={i} style={{ marginBottom: i < warningDetail.length - 1 ? 20 : 0, padding: '12px 16px', borderRadius: 8, border: `1px solid ${m.stockPass ? 'var(--border)' : 'var(--warn)'}`, background: m.stockPass ? 'white' : 'rgba(245,158,11,0.04)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              {m.name}
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{m.code}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>单位：{m.unit}</span>
              {!m.stockPass && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: 'var(--danger, #ef4444)' }}><Icon n="alert" size={12} /> 备货偏差超阈值</span>}
            </div>
            <table className="data-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>预警项</th>
                  <th className="num">计算值</th>
                  <th className="num">阈值</th>
                  <th>计算公式</th>
                  <th>结果</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>备货偏差</td>
                  <td className="num" style={{ color: m.stockPass ? 'var(--good)' : 'var(--danger, #ef4444)', fontWeight: 700 }}>{m.stockDeviation > 0 ? '+' : ''}{m.stockDeviation}%</td>
                  <td className="num">≤{m.stockThreshold}%</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.stockCalc}</td>
                  <td>{passIcon(m.stockPass)}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>MOQ取整偏差</td>
                  <td className="num" style={{ color: m.moqPass ? 'var(--good)' : 'var(--danger, #ef4444)', fontWeight: 700 }}>{m.moqDeviation}%</td>
                  <td className="num">≤{m.moqThreshold}%</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.moqCalc}</td>
                  <td>{passIcon(m.moqPass)}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>安全库存</td>
                  <td className="num" style={{ color: m.safetyPass ? 'var(--good)' : 'var(--danger, #ef4444)', fontWeight: 700 }}>{m.safetyDays}天</td>
                  <td className="num">≥{safetyDays}天</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.safetyCalc}</td>
                  <td>{passIcon(m.safetyPass)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* 异常统配汇总 */}
      <div className="card">
        <div className="card-title"><Icon n="alert" style={{ marginRight: 6, color: 'inherit' }} />异常统配门店汇总<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="kpi-card">
            <div className="kpi-label">异常门店数</div>
            <div className="kpi-value" style={{ color: 'var(--warn)' }}>12</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">涉及物料</div>
            <div className="kpi-value">3种</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">最大差异</div>
            <div className="kpi-value" style={{ color: 'var(--danger, #ef4444)' }}>-13</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          异常原因：统配量 &gt; 预测量，统配外=0。建议人工确认是否需要追加备货。<br/>
          详见 Step 3 异常统配门店明细表。
        </p>
      </div>

      {/* 供应限制处理（三场景）——9/23 拍板：只出方案文案 + 表 */}
      <div className="card" style={{ borderColor: 'var(--accent)' }}>
        <div className="card-title" style={{ color: 'var(--accent)' }}><Icon n="stop" style={{ marginRight: 6, color: 'inherit' }} />供应限制处理（安全库存检测后）<button className="export-btn"><Icon n="download" size={12} /> 导出</button></div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.7 }}>
          当<b>供应商可供量</b>不足时，按以下三种场景给处理方案（口径依 PRD V7.6：系统不配置「产能」字段，判定依据＝供应商可供量／分货库存）。
        </div>
        <table className="data-table wrap-table">
          <thead>
            <tr><th>场景</th><th>判断条件</th><th>处理方式</th><th>示例</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600, color: 'var(--good)' }}>A · 够分</td>
              <td style={{ fontSize: 12 }}>全国可供总量 ≥ 各仓安全库存之和</td>
              <td style={{ fontSize: 12 }}>识别不足仓与多余仓，从多余仓调给不足仓（<b>调整采购订单，非仓间调拨</b>）</td>
              <td style={{ fontSize: 12 }}>上海仓可售 12 天 → 调 3 天量给湖北仓（7.1 天）</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600, color: 'var(--warn)' }}>B · 不够分</td>
              <td style={{ fontSize: 12 }}>全国可供总量 &lt; 各仓安全库存之和</td>
              <td style={{ fontSize: 12 }}>按各仓日均消耗比例<b>全国均分</b>，保证每仓安库天数一致</td>
              <td style={{ fontSize: 12 }}>均分后每仓安全库存天数统一降到 4.3 天</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>C · 部分可补</td>
              <td style={{ fontSize: 12 }}>供应商只能追加一部分可供量</td>
              <td style={{ fontSize: 12 }}>先补能补的部分，剩余按场景 B 处理</td>
              <td style={{ fontSize: 12 }}>先补 60%，余量按日均消耗比例均分</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
          本期交付口径：<b>只输出方案文案 + 表</b>（不含「一键应用调整」等交互确认），与 9/23 拍板一致。
        </div>
      </div>

      {/* 导出清单 */}
      <div className="card">
        <div className="card-title"><Icon n="download" style={{ marginRight: 6, color: 'inherit' }} />导出Excel（6个Sheet）</div>
        <table className="data-table">
          <thead><tr><th>Sheet</th><th>内容</th><th className="num">行数</th><th>说明</th></tr></thead>
          <tbody>
            <tr><td style={{ fontWeight: 600 }}>Sheet1</td><td>门店明细</td><td className="num">{productInfo.storeCount.toLocaleString()} × 4物料 × W1-W4</td><td style={{ fontSize: 11 }}>逐门店逐物料计算结果</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Sheet2</td><td>仓库汇总</td><td className="num">30+仓库 × 4物料</td><td style={{ fontSize: 11 }}>按仓库汇总统配+统配外</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Sheet3</td><td>供应商分配</td><td className="num">6条</td><td style={{ fontSize: 11 }}>供应商份额+MOQ取整</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Sheet4</td><td>预警清单</td><td className="num">4物料 × 3项检测</td><td style={{ fontSize: 11 }}>A 类检测（备货偏差 / MOQ取整 / 安全库存）计算明细</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Sheet5</td><td>SCM导入模板</td><td className="num">—</td><td style={{ fontSize: 11 }}>可直接导入SCM系统</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Sheet6</td><td>仓级统配对比</td><td className="num">8仓</td><td style={{ fontSize: 11 }}>预测统配 vs 实际统配，异常标记</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
