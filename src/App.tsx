import { useState, useEffect, useRef, useCallback } from 'react';
import './styles.css';
import type { ChatMessage, NewProductInfo, BOMMaterial, RegionCoefficient, ConfirmAction } from './types';
import { mockProduct, mockMaterials, mockRegionCoefficients, historicalProducts, mockStoreSamples, nationalMaterialSummary, warehouseSummarySample, newProductList } from './data/mock';
import { parseIntent } from './engine/nlu';

// 简化为5步
const STEP_LABELS = ['选择新品', '预测杯量', '系数修正+BOM拆解', '汇总到仓+供应商', '结果输出'];

const SKILLS = [
  { id: 'newproduct', name: '新品分仓备货', icon: '📦', desc: '新品从录入到备货方案全流程' },
  { id: 'query', name: '智能问数', icon: '📊', desc: '自然语言查询供应链数据' },
  { id: 'stockout', name: '缺货归因', icon: '⚠️', desc: '缺货原因分析与补货建议' },
  { id: 'forecast', name: '销量预测', icon: '📈', desc: '基于历史数据的销量预测' },
];

type Step = 0 | 1 | 2 | 3 | 4;

// 参数调整解析器
function parseParameterAdjustment(text: string): { response: string; thinking: string[] } | null {
  const lower = text.toLowerCase();

  // 区域系数调整
  const regionMatch = text.match(/(?:调整|修改|设置)\s*区域系数\s*(\S+)\s+([\d.]+)/);
  if (regionMatch) {
    const [, subsidiary, value] = regionMatch;
    return {
      response: `✅ 已调整区域系数\n\n• **${subsidiary}**：→ **${value}**\n\n修改已记录，确认后将在下一步计算中使用新系数。\n\n💡 你还可以继续调整：\n• "调整区域系数 广东 1.05"\n• "调整备货系数 莲雾苹果汁 1.2"\n• "调整W1占比 0.06"\n• "安全库存改成7天"`,
      thinking: [`修改区域系数：${subsidiary} → ${value}`],
    };
  }

  // 备货系数调整
  const stockMatch = text.match(/(?:调整|修改|设置)\s*备货系数\s*(\S+)\s+([\d.]+)/);
  if (stockMatch) {
    const [, material, value] = stockMatch;
    return {
      response: `✅ 已调整备货系数\n\n• **${material}**：→ **${value}**\n\n修改已记录，确认后将在下一步计算中使用新系数。\n\n💡 你还可以继续调整其他参数。`,
      thinking: [`修改备货系数：${material} → ${value}`],
    };
  }

  // W1-W4占比调整
  const wMatch = text.match(/(?:调整|修改|设置)\s*(W[1-4])\s*占比\s+([\d.]+)/);
  if (wMatch) {
    const [, week, value] = wMatch;
    return {
      response: `✅ 已调整${week}占比\n\n• **${week}**：→ **${value}**\n\n⚠️ W1-W4为成品维度参数，修改后所有物料同步生效。\n\n修改已记录，确认后将在下一步计算中使用新值。`,
      thinking: [`修改${week}占比 → ${value}（成品维度，全物料生效）`],
    };
  }

  // 安全库存天数调整
  const safetyMatch = text.match(/(?:安全库存|安库)\s*(?:改成|调整为|设置为?)\s*(\d+)\s*天?/);
  if (safetyMatch) {
    const [, days] = safetyMatch;
    return {
      response: `✅ 已调整安全库存天数\n\n• 安全库存：5天 → **${days}天**\n\n修改已记录，确认后将在安全库存校验中使用新阈值。`,
      thinking: [`修改安全库存天数：5天 → ${days}天`],
    };
  }

  // 供应商设置
  const supplierMatch = text.match(/(?:设置|调整)\s*供应商\s+(\S+)\s+(\S+)\s+(\d+)%?\s*(?:MOQ\s*)?(\d+)?/i);
  if (supplierMatch) {
    const [, material, supplier, share, moq] = supplierMatch;
    return {
      response: `✅ 已设置供应商信息\n\n• **${material}**\n  - 供应商：${supplier}\n  - 份额：${share}%\n  - MOQ：${moq || '1（默认）'}\n\n💡 份额之和必须=100%，可继续添加其他供应商。`,
      thinking: [`设置供应商：${material} → ${supplier} ${share}% MOQ=${moq || 1}`],
    };
  }

  // 帮助/可调参数列表
  if (lower.includes('可调') || lower.includes('调参') || lower.includes('修改参数') || lower.includes('帮助') || lower.includes('help')) {
    return {
      response: `📋 **可调整参数清单**\n\n以下参数支持在对话中直接输入修改：\n\n**1. 区域系数**（分公司维度）\n• 格式：\`调整区域系数 湖北 1.1\`\n• 说明：修改某子公司的区域系数\n\n**2. 备货系数**（物料维度）\n• 格式：\`调整备货系数 莲雾苹果汁 1.2\`\n• 说明：修改某物料的备货系数\n\n**3. W1-W4占比**（成品维度）\n• 格式：\`调整W1占比 0.06\`\n• 说明：修改后所有物料同步生效\n\n**4. 安全库存天数**\n• 格式：\`安全库存改成7天\`\n• 说明：默认5天\n\n**5. 供应商信息**\n• 格式：\`设置供应商 莲雾苹果汁 供应商A 40% MOQ500\`\n• 说明：份额之和必须=100%`,
      thinking: ['展示可调参数清单'],
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
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [skillSelected, setSkillSelected] = useState(false);
  const [showSkillPopup, setShowSkillPopup] = useState(false);
  const [rightTab, setRightTab] = useState<Step>(1);
  const [tongpeiDone, setTongpeiDone] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-switch right tab when step changes
  useEffect(() => {
    if (step >= 1) setRightTab(step);
  }, [step]);

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
    setSelectedProduct(productId);
    setStep(1);
    triggerStepMessage(1);
  };

  const showWelcome = () => {
    setSkillSelected(true);
    setMessages([]);
    setTimeout(() => {
      addBotMessage(
        `你好！我是 **AI CEO 新品分仓助手** 📦\n\n基于历史新品数据预测新品首周/首月全国杯量，通过区域系数和备货系数修正后，经BOM拆解为物料需求，按仓库覆盖门店分配至各仓库，再匹配供应商产能生成采购建议单。\n\n请选择操作开始：`,
        [],
        [],
        ['开始新品分仓'],
      );
    }, 300);
  };

  const triggerStepMessage = (s: Step) => {
    switch (s) {
      case 0:
        simulateTyping(
          `当前有 **4** 个新品在上新周期内（前后2个月），请选择要开始分仓的新品：`,
          ['扫描上新周期：2026-06-08 ~ 2026-10-08', '筛选出4个新品（剔除已超期）'],
          [],
          newProductList.map(p => p.name),
        );
        break;
      case 1:
        simulateTyping(
          `已从飞书多维表格读取 **${productInfo.name}** 的信息 ✅\n\n📊 **预测杯量**\n• 在营门店数：**${productInfo.storeCount.toLocaleString()}** 家（滚动30天）\n• 大盘预测首周日均：**${productInfo.firstWeekDailyCups}** 杯\n• 大盘预测首月日均：**${productInfo.firstMonthDailyCups}** 杯\n• 全国首周日均总量：**${(productInfo.firstWeekDailyCups * productInfo.storeCount).toLocaleString()}** 杯\n• 全国月日均总量：**${(productInfo.firstMonthDailyCups * productInfo.storeCount).toLocaleString()}** 杯\n\n🏪 **代表性门店预测**（详见右侧）\n• 北京王府井APM店：首周日均 **1,077.92** 杯\n• 上海南京西路店：首周日均 **1,245.30** 杯\n\n⚠️ 数据一致性校验：首月日均(${productInfo.firstMonthDailyCups}) ≥ 首周日均(${productInfo.firstWeekDailyCups}) ✅`,
          ['读取飞书多维表格：新品基础信息表', '系统自动获取：滚动30天在营门店数', '抓取成品销售报表：7,188家门店', '计算门店销量占比 + 下限保护'],
          [{ label: '✅ 确认，继续', type: 'confirm' }],
        );
        break;
      case 2:
        simulateTyping(
          `系数修正 + BOM拆解完成 ✅\n\n📐 **区域系数**（${historicalProducts.length}个历史品均值）\n• 24个子公司：**8个兜底为1.0**，最高 **湖北(1.196)**\n\n💡 **AI推荐：选择以下15个历史品（相似度≥80%）可使系数更精准**\n\n| 品名 | 品类 | 相似度 | 推荐理由 |\n|------|------|--------|----------|\n| 夏梦玫珑 | 果茶 | 92% | 果茶品类最高相似，区域分布一致 |\n| 小森林柚子 | 果茶 | 91% | 果茶+夏季上新，杯量曲线高度吻合 |\n| 肉桂橙大红袍 | 特调茶 | 90% | 特调茶基底相同，区域系数分布接近 |\n| 晴天罗勒桃 | 果茶 | 89% | 果茶品类，门店覆盖度相似 |\n| 白雾红尘 | 特调茶 | 88% | 特调茶经典品，达标率稳定 |\n| 诶？橙柚康普 | 果茶 | 88% | 果茶+创新品类，区域表现参考性强 |\n| 草莓云顶大红袍 | 特调茶 | 87% | 同系列品，区域系数方差小 |\n| 芒果云顶大红袍 | 特调茶 | 86% | 同系列品，达标率均值高 |\n| 嘿！菠萝马黛 | 果茶 | 86% | 果茶品类，夏季上新节奏一致 |\n| 归云南·云漫普洱 | 特调茶 | 85% | 特调茶+茶基底相似 |\n| 蜜瓜开心果椰 | 特调茶 | 84% | 特调茶+复合风味，区域分布参考 |\n| 龙井玄米酪 | 特调茶 | 83% | 特调茶品类，达标率中位数接近 |\n| 归云南·云卷松风 | 特调茶 | 82% | 同系列品，区域表现一致 |\n| 耶～抹茶龙井 | 特调茶 | 81% | 茶基底相似，区域系数参考 |\n| 归云南 | 特调茶 | 80% | 同系列基准品，兜底参考 |\n\n排除轻因系列（4个，相似度63%-70%，品类差异大）。\n\n📦 **BOM拆解 → 物料需求**（${materials.filter(m=>m.selected).length}种核心物料）\n详见右侧面板。\n\n🧮 **物料量计算示例**（门店1101010005 × 莲雾苹果汁）\n\`\`\`\nW1 = 1077.92 × 1.2 × 0.05 × 7 ÷ 11.41 × 1.1 = 43.64\n预测总量 = Roundup(W1+W2+W3+W4) ✅\n\`\`\`\n\n全部计算公式和区域系数详见右侧面板。`,
          ['计算24个子公司区域系数（兜底<1.0→1.0）', 'BOM拆解：4种物料 × W1-W4', '核心公式：逐门店逐物料计算', 'Roundup向上取整 + 效期校验'],
          [{ label: '✅ 确认，继续', type: 'confirm' }, { label: '✏️ 使用AI推荐子集', type: 'edit' }],
        );
        break;
      case 3:
        simulateTyping(
          `汇总到仓 + 供应商匹配 + 预警检查完成 ✅\n\n🏭 **汇总到仓**（仓店映射9,708条）\n• 北京二级仓：莲雾苹果汁 **13,399** 瓶\n• 详见右侧各仓库汇总\n\n📦 **供应商分配**：默认1供应商，MOQ=1\n\n📊 **预警检查**\n• 备货偏差：**8.6%**（阈值10%）✅ 通过\n• MOQ取整偏差：**0.055%**（阈值5%）✅ 通过\n• 安全库存：全部 **>5天** ✅ 通过\n\n⏰ **统配数据（T-30出数）**\n统配数据是否已到？如果已到，我将继续进行统配比对和统配外计算。\n\n💡 **如需调整参数，可直接输入：**\n• "调整区域系数 湖北 1.1"\n• "调整备货系数 莲雾苹果汁 1.2"\n• "调整W1占比 0.06"\n• "安全库存改成7天"\n• 输入"帮助"查看完整参数清单`,
          ['读取仓店映射Sheet2：9,708条', '按仓库汇总门店物料量', '备货偏差/ MOQ取整/安全库存三道预警'],
          [{ label: '✅ 统配数据已到，继续', type: 'confirm' }, { label: '⏸️ 统配数据未到，暂停', type: 'skip' }, { label: '🔄 调参重跑', type: 'recalculate' }],
        );
        break;
      case 4:
        simulateTyping(
          `🎉 **分仓备货方案生成完成！**\n\n📊 **全国物料最终方案**\n• 安溪铁观音：66,285 箱\n• 莲雾苹果汁：363,540 瓶\n• 东方美人：28,655 袋\n• 老盐糖浆：25,032 瓶\n• 冷冻生椰乳：138,345 瓶\n• 冷冻凤梨汁：128,712 瓶\n• 椰子水：174,996 瓶\n\n📋 预警汇总：全部通过 ✅\n⚠️ 异常统配门店：12家（已标记）\n\n📥 导出Excel包含 **5个Sheet**：\n• Sheet1: 门店明细\n• Sheet2: 仓库汇总\n• Sheet3: 供应商分配\n• Sheet4: 预警清单\n• Sheet5: SCM导入模板`,
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

    const matchedProduct = newProductList.find(p => p.name === text);
    if (matchedProduct) {
      selectProduct(matchedProduct.id);
      return;
    }

    // 参数调整识别
    const paramResult = parseParameterAdjustment(text);
    if (paramResult) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addBotMessage(paramResult.response, paramResult.thinking);
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
          addBotMessage('请先选择一个新品。');
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
          `📥 Excel 导出完成！\n\n文件名：**${productInfo.name}_分仓备货预测_${productInfo.launchDate}.xlsx**\n\n包含5个Sheet：\n• Sheet1: 门店明细（${productInfo.storeCount.toLocaleString()}门店 × ${materials.filter(m=>m.selected).length}物料 × W1-W4）\n• Sheet2: 仓库汇总（30+仓库）\n• Sheet3: 供应商分配\n• Sheet4: 预警清单\n• Sheet5: SCM导入模板\n\n✅ 文件已保存到下载目录。\n✅ Sheet5可直接导入SCM系统。`,
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
      showWelcome();
    } else {
      setSkillSelected(true);
      setMessages([]);
      setTimeout(() => {
        addBotMessage(`已切换到「${skill.name}」技能。\n\n该技能正在开发中，敬请期待。`);
      }, 300);
    }
  };

  return (
    <div className="app-container">
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
          <span className="header-breadcrumb">智能洞察</span>
          <span className="header-sep">/</span>
          <span className="header-current">{activeSkill.name}</span>
        </div>
        <div className="user-info">
          <span className="clock">{new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
          <div className="user-avatar">罗</div>
        </div>
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
                      {msg.chips.map((chip, i) => (
                        <button key={i} className="chip-btn" onClick={() => handleUserInput(chip)} disabled={isTyping}>
                          {chip}
                        </button>
                      ))}
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
                            else if (action.type === 'recalculate') addBotMessage('🔄 正在使用新参数重新计算...');
                            else if (action.type === 'notify') addBotMessage('📤 已发送飞书通知 ✅');
                            else if (action.type === 'skip') {
                              if (step === 3) {
                                addBotMessage('⏸️ **统配数据未到，流程暂停**\n\n当前已完成：\n• ✅ 汇总到仓\n• ✅ 供应商分配\n• ✅ 三道预警检查\n\n等待统配数据到达后，输入"统配数据已到"或点击按钮继续。');
                              } else {
                                addBotMessage('⏭️ 已跳过，继续下一步。');
                                confirmStep(step);
                              }
                            }
                            else if (action.type === 'edit') addBotMessage(`✏️ 请在对话中输入修改指令，或输入"返回修改"。`);
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
                  <button className="skill-btn" onClick={() => setShowSkillPopup(!showSkillPopup)}>
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
                    <span className="skill-popup-icon">{skill.icon}</span>
                    <div className="skill-popup-info">
                      <div className="skill-popup-name">{skill.name}</div>
                      <div className="skill-popup-desc">{skill.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Data Display Only with Tabs */}
        <div className="right-panel">
          {!selectedProduct && <RightEmptyState />}
          {selectedProduct && (
            <>
              {/* Tab Navigation */}
              <div className="right-tabs">
                {STEP_LABELS.slice(1).map((label, i) => {
                  const tabStep = (i + 1) as Step;
                  const isActive = rightTab === tabStep;
                  const isCompleted = step > tabStep;
                  const isAccessible = step >= tabStep;
                  return (
                    <button
                      key={tabStep}
                      className={`right-tab ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${!isAccessible ? 'disabled' : ''}`}
                      onClick={() => { if (isAccessible) setRightTab(tabStep); }}
                      disabled={!isAccessible}
                    >
                      <span className="right-tab-num">{isCompleted ? '✓' : tabStep}</span>
                      <span className="right-tab-label">{label}</span>
                    </button>
                  );
                })}
              </div>
              {/* Tab Content */}
              <div className="right-tab-content">
                {rightTab === 1 && <RightStep1CupForecast productInfo={productInfo} materials={materials} />}
                {rightTab === 2 && <RightStep2CoefficientsAndBOM regions={regions} flooredCount={flooredCount} materials={materials} productInfo={productInfo} />}
                {rightTab === 3 && <RightStep3WarehouseAndWarnings tongpeiDone={tongpeiDone} />}
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
  return (
    <div className="empty-state">
      <div className="empty-whale">
        <svg viewBox="0 0 24 24" fill="#b9dcec" width="56" height="56">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </div>
      <div className="empty-t1">新品分仓备货</div>
      <div className="empty-t2">在左侧对话中选择新品开始分仓<br/>数据将在此展示</div>
    </div>
  );
}

function RightStep1CupForecast({ productInfo, materials }: { productInfo: NewProductInfo; materials: BOMMaterial[] }) {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 1</span>预测杯量</div>

      {/* 新品基础信息表（飞书多维表格） */}
      <div className="card">
        <div className="card-title">📋 新品基础信息表</div>
        <div className="data-source-tag">数据来源：飞书多维表格「新品BOM」表</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          新品名称：<strong>{productInfo.name}</strong> ｜ 上新日：<strong>{productInfo.launchDate}</strong> ｜ 共 <strong>{materials.length}</strong> 种原材料
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>新品名称</th><th>上新日</th><th>原材料名称</th><th>原材料编码</th><th>规格型号</th><th>单位</th>
                <th className="num">单位用量</th><th>用量单位</th><th className="num">开封效期</th><th className="num">备货系数</th><th className="num">损耗率</th>
                <th className="num">W1杯占</th><th className="num">W2杯占</th><th className="num">W3杯占</th><th className="num">W4杯占</th>
              </tr>
            </thead>
            <tbody>
              {materials.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.productName}</td>
                  <td style={{ fontSize: 11 }}>{m.launchDate}</td>
                  <td style={{ fontWeight: 600 }}>{m.materialName}</td>
                  <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{m.materialCode || <span style={{ color: 'var(--warn)' }}>⚠️空</span>}</td>
                  <td style={{ fontSize: 11 }}>{m.spec}</td>
                  <td>{m.unit}</td>
                  <td className="num">{m.unitUsage}</td>
                  <td>{m.usageUnit}</td>
                  <td className="num">{m.shelfLifeDays}天</td>
                  <td className="num">{m.stockCoefficient}</td>
                  <td className="num">{(m.lossRate * 100).toFixed(0)}%</td>
                  <td className="num">{m.cupRatioW1}</td>
                  <td className="num">{m.cupRatioW2}</td>
                  <td className="num">{m.cupRatioW3}</td>
                  <td className="num">{m.cupRatioW4}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 系统自动获取数据 */}
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">在营门店</div><div className="kpi-value">{productInfo.storeCount.toLocaleString()}<span className="kpi-unit">家</span></div></div>
        <div className="kpi-card"><div className="kpi-label">首周日均</div><div className="kpi-value">{productInfo.firstWeekDailyCups}<span className="kpi-unit">杯</span></div></div>
        <div className="kpi-card"><div className="kpi-label">首月日均</div><div className="kpi-value">{productInfo.firstMonthDailyCups}<span className="kpi-unit">杯</span></div></div>
        <div className="kpi-card"><div className="kpi-label">触发下限保护</div><div className="kpi-value" style={{ color: 'var(--warn)' }}>~200<span className="kpi-unit">家</span></div></div>
      </div>
      <div className="card">
        <div className="card-title">🏪 代表性门店预测明细</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>门店编码</th><th>门店名称</th><th className="num">5月销量</th><th className="num">占比</th><th className="num">首周日均</th><th className="num">月日均</th></tr></thead>
            <tbody>
              {mockStoreSamples.map((s, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{s.storeId}</td>
                  <td style={{ fontWeight: 600, fontSize: 11 }}>{s.storeName}</td>
                  <td className="num">{s.maySales.toLocaleString()}</td>
                  <td className="num">{(s.salesRatio * 100).toFixed(4)}%</td>
                  <td className="num">{s.firstWeekDaily.toFixed(2)}</td>
                  <td className="num">{s.monthDaily.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-title">🧮 计算公式</div>
        <pre className="formula-block">{`门店占比 = 门店5月销量 ÷ 全国5月总销量(${productInfo.totalSalesMay.toLocaleString()})
首周日均 = 大盘首周(${productInfo.firstWeekDailyCups}) × 门店占比 × 门店数(${productInfo.storeCount.toLocaleString()})
月日均 = 大盘首月(${productInfo.firstMonthDailyCups}) × 门店占比 × 门店数(${productInfo.storeCount.toLocaleString()})
下限保护：if 日均 < 10杯 → 取大盘均值`}</pre>
      </div>
    </div>
  );
}

function RightStep2CoefficientsAndBOM({ regions, flooredCount, materials, productInfo }: { regions: RegionCoefficient[]; flooredCount: number; materials: BOMMaterial[]; productInfo: NewProductInfo }) {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 2</span>系数修正 + BOM拆解</div>

      {/* 区域系数 */}
      <div className="card">
        <div className="card-title">📐 区域系数（24个子公司）</div>
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="kpi-card"><div className="kpi-label">参考历史品数</div><div className="kpi-value" style={{ color: 'var(--accent)' }}>{historicalProducts.length}</div></div>
          <div className="kpi-card"><div className="kpi-label">兜底为1.0</div><div className="kpi-value" style={{ color: 'var(--warn)' }}>{flooredCount}</div></div>
          <div className="kpi-card"><div className="kpi-label">最高系数</div><div className="kpi-value">{Math.max(...regions.map(r => r.coefficient)).toFixed(3)}</div></div>
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>子公司</th><th className="num">原始均值</th><th className="num">最终系数</th><th>状态</th></tr></thead>
            <tbody>
              {regions.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>{r.subsidiary}</td>
                  <td className="num" style={{ color: 'var(--text-muted)' }}>{r.rawValue.toFixed(3)}</td>
                  <td className="num" style={{ fontWeight: 700, color: r.coefficient > 1 ? 'var(--accent)' : 'var(--warn)' }}>{r.coefficient.toFixed(3)}</td>
                  <td>{r.isFloored ? <span style={{ fontSize: 10, color: 'var(--warn)', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: 4 }}>兜底</span> : <span style={{ fontSize: 10, color: 'var(--good)' }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BOM物料清单 */}
      <div className="card">
        <div className="card-title">📦 BOM物料清单（{materials.filter(m => m.selected).length}种核心物料）</div>
        <div className="data-source-tag">数据来源：飞书多维表格「新品BOM」表</div>
        <table className="data-table">
          <thead><tr><th>原材料名称</th><th>原材料编码</th><th>规格型号</th><th>单位</th><th className="num">单位用量</th><th>用量单位</th><th className="num">开封效期</th><th className="num">备货系数</th><th className="num">损耗率</th><th className="num">W1杯占</th><th className="num">W2杯占</th><th className="num">W3杯占</th><th className="num">W4杯占</th></tr></thead>
          <tbody>
            {materials.map(m => (
              <tr key={m.id} style={{ opacity: m.selected ? 1 : 0.5 }}>
                <td style={{ fontWeight: 600 }}>{m.materialName}</td>
                <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{m.materialCode || <span style={{ color: 'var(--warn)' }}>⚠️空</span>}</td>
                <td style={{ fontSize: 11 }}>{m.spec}</td>
                <td>{m.unit}</td>
                <td className="num">{m.unitUsage}</td>
                <td>{m.usageUnit}</td>
                <td className="num">{m.shelfLifeDays}天</td>
                <td className="num">{m.stockCoefficient}</td>
                <td className="num">{(m.lossRate * 100).toFixed(0)}%</td>
                <td className="num">{m.cupRatioW1}</td>
                <td className="num">{m.cupRatioW2}</td>
                <td className="num">{m.cupRatioW3}</td>
                <td className="num">{m.cupRatioW4}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 物料量计算 */}
      <div className="card">
        <div className="card-title">🧮 物料量计算（{productInfo.storeCount.toLocaleString()}门店 × {materials.filter(m=>m.selected).length}物料 × W1-W4）</div>
        <pre className="formula-block">{`核心公式：
W1物料量 = 首周日均杯量 × 区域系数 × W1占比 × 7 ÷ 应用率W1 × 备货系数
W2-W4物料量 = 月日均杯量 × 区域系数 × Wn占比 × 7 ÷ 应用率Wn × 备货系数
预测总量 = Roundup(W1 + W2 + W3 + W4)  ← 向上取整

示例：门店1101010005 × 莲雾苹果汁
参数：首周日均=1077.92, 月日均=1150.49, 区域系数=1.2, 备货系数=1.0
      应用率=11.41, W1=0.05, W2=0.035, W3=0.0224, W4=0.012544

W1 = 1077.92 × 1.2 × 0.05 × 7 ÷ 11.41 × 1.0 = 39.67
W2 = 1150.49 × 1.2 × 0.035 × 7 ÷ 11.41 × 1.0 = 29.64
W3 = 1150.49 × 1.2 × 0.0224 × 7 ÷ 11.41 × 1.0 = 18.97
W4 = 1150.49 × 1.2 × 0.012544 × 7 ÷ 11.41 × 1.0 = 10.62

预测总量 = Roundup(98.90) = 99 ✅
效期校验：开封效期7天 → 周最小量=1, W1-W4均>1 ✅`}</pre>
      </div>

      {/* 全国物料汇总 */}
      <div className="card">
        <div className="card-title">📊 全国物料汇总</div>
        <table className="data-table">
          <thead><tr><th>物料</th><th className="num">全国预测总量</th><th className="num">统配量</th><th className="num">统配外</th><th className="num">合计</th></tr></thead>
          <tbody>
            {nationalMaterialSummary.map((m, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td className="num">{m.forecastQty.toLocaleString()}</td>
                <td className="num">{m.allocationQty.toLocaleString()}</td>
                <td className="num">{m.extraStock.toLocaleString()}</td>
                <td className="num" style={{ fontWeight: 700 }}>{m.orderQty.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RightStep3WarehouseAndWarnings({ tongpeiDone }: { tongpeiDone: boolean }) {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 3</span>汇总到仓 + 供应商 + 预警</div>

      {/* 汇总到仓 */}
      <div className="card">
        <div className="card-title">🏭 汇总到仓 — 北京二级仓</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>仓店映射来源：Sheet2（9,708条）</p>
        <table className="data-table">
          <thead><tr><th>物料</th><th className="num">统配量</th><th className="num">统配外备货量</th><th className="num">合计</th><th className="num">下单量</th></tr></thead>
          <tbody>
            {warehouseSummarySample.materials.map((m, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td className="num">{m.allocationQty.toLocaleString()}</td>
                <td className="num" style={{ fontWeight: 700 }}>{m.extraStock.toLocaleString()}</td>
                <td className="num">{m.total.toLocaleString()}</td>
                <td className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>{m.orderQty.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 供应商 */}
      <div className="card">
        <div className="card-title">📦 供应商分配（默认值）</div>
        <table className="data-table">
          <thead><tr><th>物料</th><th>供应商</th><th className="num">份额%</th><th className="num">MOQ</th></tr></thead>
          <tbody>
            {['莲雾苹果汁', '安溪铁观音', '老盐糖浆', '冷冻生椰乳'].map((m, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{m}</td>
                <td style={{ color: 'var(--text-muted)' }}>默认（1供应商）</td>
                <td className="num">100%</td>
                <td className="num">1</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 预警 */}
      <div className="card" style={{ borderColor: 'var(--good)', background: 'rgba(34,197,94,0.04)' }}>
        <div className="card-title" style={{ color: 'var(--good)' }}>📊 三道预警检查</div>
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="kpi-card">
            <div className="kpi-label">备货偏差</div>
            <div className="kpi-value" style={{ color: 'var(--good)' }}>8.6%</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>阈值10% ✅</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">MOQ取整偏差</div>
            <div className="kpi-value" style={{ color: 'var(--good)' }}>0.055%</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>阈值5% ✅</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">安全库存</div>
            <div className="kpi-value" style={{ color: 'var(--good)', fontSize: 16 }}>全部&gt;5天</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>✅ 通过</div>
          </div>
        </div>
      </div>

      {/* 统配比对 - 仅在统配数据已到后展示 */}
      {tongpeiDone ? (
        <div className="card">
          <div className="card-title">⏰ T-30 统配比对 — 门店1101010005</div>
          <table className="data-table">
            <thead><tr><th>物料</th><th className="num">预测</th><th className="num">统配</th><th className="num">统配外</th><th className="num">合计</th><th>状态</th></tr></thead>
            <tbody>
              <tr><td style={{ fontWeight: 600 }}>安溪铁观音</td><td className="num">16</td><td className="num">6</td><td className="num">10</td><td className="num" style={{ fontWeight: 700 }}>16</td><td><span style={{ color: 'var(--good)' }}>✅</span></td></tr>
              <tr><td style={{ fontWeight: 600 }}>莲雾苹果汁</td><td className="num">99</td><td className="num">35</td><td className="num">64</td><td className="num" style={{ fontWeight: 700 }}>99</td><td><span style={{ color: 'var(--good)' }}>✅</span></td></tr>
              <tr><td style={{ fontWeight: 600 }}>老盐糖浆</td><td className="num">6</td><td className="num">3</td><td className="num">3</td><td className="num" style={{ fontWeight: 700 }}>6</td><td><span style={{ color: 'var(--good)' }}>✅</span></td></tr>
              <tr><td style={{ fontWeight: 600 }}>冷冻生椰乳</td><td className="num">32</td><td className="num">12</td><td className="num">20</td><td className="num" style={{ fontWeight: 700 }}>32</td><td><span style={{ color: 'var(--good)' }}>✅</span></td></tr>
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: 'var(--warn)', marginTop: 8 }}>⚠️ 发现 <strong>12</strong> 家异常统配门店（统配&gt;预测）</p>
        </div>
      ) : (
        <div className="card" style={{ borderColor: 'var(--warn)', background: 'rgba(245,158,11,0.04)' }}>
          <div className="card-title" style={{ color: 'var(--warn)' }}>⏰ 统配数据（T-30出数）</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            统配数据尚未到达，等待T-30出数后将自动进行统配比对。<br/>
            统配外 = IF(预测-统配&lt;0, 0, 预测-统配)
          </p>
        </div>
      )}

      {/* 安全库存明细 */}
      <div className="card">
        <div className="card-title">📊 安全库存校验 — 北京二级仓</div>
        <table className="data-table">
          <thead><tr><th>物料</th><th className="num">统配外</th><th className="num">日均消耗</th><th className="num">可销售天数</th><th>状态</th></tr></thead>
          <tbody>
            <tr><td style={{ fontWeight: 600 }}>安溪铁观音</td><td className="num">1,539</td><td className="num">76.0</td><td className="num" style={{ fontWeight: 700, color: 'var(--good)' }}>20.3天</td><td><span style={{ color: 'var(--good)' }}>✅</span></td></tr>
            <tr><td style={{ fontWeight: 600 }}>莲雾苹果汁</td><td className="num">8,245</td><td className="num">478.4</td><td className="num" style={{ fontWeight: 700, color: 'var(--good)' }}>17.2天</td><td><span style={{ color: 'var(--good)' }}>✅</span></td></tr>
            <tr><td style={{ fontWeight: 600 }}>老盐糖浆</td><td className="num">414</td><td className="num">32.5</td><td className="num" style={{ fontWeight: 700, color: 'var(--good)' }}>12.7天</td><td><span style={{ color: 'var(--good)' }}>✅</span></td></tr>
            <tr><td style={{ fontWeight: 600 }}>冷冻生椰乳</td><td className="num">2,035</td><td className="num">172.4</td><td className="num" style={{ fontWeight: 700, color: 'var(--good)' }}>11.8天</td><td><span style={{ color: 'var(--good)' }}>✅</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RightStep4Output({ productInfo }: { productInfo: NewProductInfo }) {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 4</span>结果输出</div>
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">新品</div><div className="kpi-value" style={{ fontSize: 16 }}>{productInfo.name}</div></div>
        <div className="kpi-card"><div className="kpi-label">门店数</div><div className="kpi-value">{productInfo.storeCount.toLocaleString()}</div></div>
        <div className="kpi-card"><div className="kpi-label">物料数</div><div className="kpi-value">7</div></div>
        <div className="kpi-card"><div className="kpi-label">预警</div><div className="kpi-value" style={{ color: 'var(--good)' }}>全部通过</div></div>
      </div>
      <div className="card">
        <div className="card-title">📊 全国物料最终方案</div>
        <table className="data-table">
          <thead><tr><th>物料</th><th className="num">预测量</th><th className="num">统配量</th><th className="num">统配外</th><th className="num">下单量</th></tr></thead>
          <tbody>
            {nationalMaterialSummary.map((m, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td className="num">{m.forecastQty.toLocaleString()}</td>
                <td className="num">{m.allocationQty.toLocaleString()}</td>
                <td className="num">{m.extraStock.toLocaleString()}</td>
                <td className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>{m.orderQty.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-title">📋 预警汇总</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: 'var(--good)' }}>✅ 备货预警 8.6%</span>
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: 'var(--good)' }}>✅ MOQ取整 0.055%</span>
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: 'var(--good)' }}>✅ 安全库存 全部&gt;5天</span>
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: 'var(--warn)' }}>⚠️ 异常统配 12家</span>
        </div>
      </div>
    </div>
  );
}

export default App;
