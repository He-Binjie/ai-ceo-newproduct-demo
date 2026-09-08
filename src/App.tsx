import { useState, useEffect, useRef, useCallback } from 'react';
import './styles.css';
import type { ChatMessage, NewProductInfo, BOMMaterial, RegionCoefficient, ConfirmAction } from './types';
import { mockProduct, mockMaterials, mockRegionCoefficients, historicalProducts, historicalProductsDetail, mockStoreSamples, nationalMaterialSummary, warehouseSummarySample, newProductList } from './data/mock';
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
  const chatEndRef = useRef<HTMLDivElement>(null);

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
        ['开始新品分仓', '查看当前上新周期新品', '查看历史分仓记录'],
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
          `系数修正 + BOM拆解完成 ✅\n\n📐 **区域系数**（${historicalProducts.length}个历史品均值）\n• 24个子公司：**8个兜底为1.0**，最高 **湖北(1.196)**\n• 💡 AI建议：选择相似度≥80%的 **${historicalProductsDetail.filter(p => p.similarity >= 0.80).length}个历史品** 可使系数更精准\n\n📦 **BOM拆解 → 物料需求**（${materials.filter(m=>m.selected).length}种核心物料）\n• 安溪铁观音、莲雾苹果汁、冷冻生椰乳 等\n• ⚠️ 东方美人乌龙茶-A 编码为空（新品建档未完成）\n\n🧮 **物料量计算示例**（门店1101010005 × 莲雾苹果汁）\n\`\`\`\nW1 = 1077.92 × 1.2 × 0.05 × 7 ÷ 11.41 × 1.0 = 39.67\n预测总量 = Roundup(W1+W2+W3+W4) = 99 ✅\n\`\`\`\n\n全部计算公式和区域系数详见右侧面板。`,
          ['计算24个子公司区域系数（兜底<1.0→1.0）', 'BOM拆解：7种物料 × W1-W4', '核心公式：逐门店逐物料计算', 'Roundup向上取整 + 效期校验'],
          [{ label: '✅ 确认，继续', type: 'confirm' }, { label: '✏️ 使用AI推荐子集', type: 'edit' }],
        );
        break;
      case 3:
        simulateTyping(
          `汇总到仓 + 供应商匹配 + 预警检查完成 ✅\n\n🏭 **汇总到仓**（仓店映射9,708条）\n• 北京二级仓：莲雾苹果汁 **13,399** 瓶\n• 详见右侧各仓库汇总\n\n📦 **供应商分配**：默认1供应商，MOQ=1\n\n📊 **预警检查**\n• 备货偏差：**8.6%**（阈值10%）✅ 通过\n• MOQ取整偏差：**0.055%**（阈值5%）✅ 通过\n• 安全库存：全部 **>5天** ✅ 通过\n\n⏰ **T-30 统配比对**\n• 异常统配门店：**12家**（统配>预测）\n• 详见右侧异常清单`,
          ['读取仓店映射Sheet2：9,708条', '按仓库汇总门店物料量', '备货偏差/ MOQ取整/安全库存三道预警', '统配比对：IF(预测-统配<0, 0, 预测-统配)'],
          [{ label: '✅ 确认，生成方案', type: 'confirm' }, { label: '🔄 调参重跑', type: 'recalculate' }],
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

    const matchedProduct = newProductList.find(p => p.name === text);
    if (matchedProduct) {
      selectProduct(matchedProduct.id);
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
                            if (action.type === 'confirm') confirmStep(step);
                            else if (action.type === 'export') handleUserInput('导出Excel');
                            else if (action.type === 'recalculate') addBotMessage('🔄 正在使用新参数重新计算...');
                            else if (action.type === 'notify') addBotMessage('📤 已发送飞书通知 ✅');
                            else if (action.type === 'skip') { addBotMessage('⏭️ 已跳过，继续下一步。'); confirmStep(step); }
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

        {/* Right: Data Display Only */}
        <div className="right-panel">
          {!selectedProduct && <RightEmptyState />}
          {selectedProduct && step === 0 && <RightStep0ProductInfo productInfo={productInfo} />}
          {step === 1 && <RightStep1CupForecast productInfo={productInfo} />}
          {step === 2 && <RightStep2CoefficientsAndBOM regions={regions} flooredCount={flooredCount} materials={materials} productInfo={productInfo} />}
          {step === 3 && <RightStep3WarehouseAndWarnings />}
          {step === 4 && <RightStep4Output productInfo={productInfo} />}
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

function RightStep0ProductInfo({ productInfo }: { productInfo: NewProductInfo }) {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">已选择</span>{productInfo.name}</div>
      <div className="card">
        <div className="card-title">📋 新品基础信息</div>
        <div className="data-source-tag">数据来源：飞书多维表格</div>
        <div className="info-grid">
          <div className="info-item"><span className="info-label">新品名称</span><span className="info-value">{productInfo.name}</span></div>
          <div className="info-item"><span className="info-label">上市日期</span><span className="info-value">{productInfo.launchDate}</span></div>
          <div className="info-item"><span className="info-label">上新范围</span><span className="info-value">{productInfo.scope}</span></div>
          <div className="info-item"><span className="info-label">产品等级</span><span className="info-value">A级</span></div>
        </div>
      </div>
    </div>
  );
}

function RightStep1CupForecast({ productInfo }: { productInfo: NewProductInfo }) {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 1</span>预测杯量</div>
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
          <thead><tr><th>原材料名称</th><th>编码</th><th>规格</th><th className="num">单位用量</th><th className="num">备货系数</th><th className="num">效期</th><th className="num">W1杯占</th><th className="num">W2杯占</th></tr></thead>
          <tbody>
            {materials.map(m => (
              <tr key={m.id} style={{ opacity: m.selected ? 1 : 0.5 }}>
                <td style={{ fontWeight: 600 }}>{m.materialName}</td>
                <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{m.materialCode || <span style={{ color: 'var(--warn)' }}>⚠️空</span>}</td>
                <td style={{ fontSize: 11 }}>{m.spec}</td>
                <td className="num">{m.unitUsage}{m.usageUnit}</td>
                <td className="num">{m.stockCoefficient}</td>
                <td className="num">{m.shelfLifeDays}天</td>
                <td className="num">{m.cupRatioW1}</td>
                <td className="num">{m.cupRatioW2}</td>
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

function RightStep3WarehouseAndWarnings() {
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

      {/* 统配比对 */}
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
