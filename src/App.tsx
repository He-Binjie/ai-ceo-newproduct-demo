import { useState, useEffect, useRef, useCallback } from 'react';
import './styles.css';
import type { WizardStep, ChatMessage, NewProductInfo, BOMMaterial, RegionCoefficient, StoreForecast, WarehouseAggregation, Warning } from './types';
import { mockProduct, mockMaterials, mockRegionCoefficients, similarProducts, suppliers } from './data/mock';
import { generateStoreForecasts, aggregateToWarehouse, checkWarnings } from './engine/calculator';
import { parseIntent, QUICK_COMMANDS } from './engine/nlu';

const STEP_LABELS = [
  '新品信息录入', '核心物料筛选', '区域系数计算',
  '门店级杯量预测', '物料量计算', '效期校验与汇总',
  '供应商分配与预警', '备货确认与输出',
];

const SKILLS = [
  { id: 'newproduct', name: '新品分仓备货', icon: '📦', desc: '新品从录入到备货方案全流程' },
  { id: 'query', name: '智能问数', icon: '📊', desc: '自然语言查询供应链数据' },
  { id: 'stockout', name: '缺货归因', icon: '⚠️', desc: '缺货原因分析与补货建议' },
  { id: 'forecast', name: '销量预测', icon: '📈', desc: '基于历史数据的销量预测' },
];

function App() {
  const [step, setStep] = useState<WizardStep>(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [productInfo, setProductInfo] = useState<NewProductInfo>({ ...mockProduct });
  const [materials, setMaterials] = useState<BOMMaterial[]>(mockMaterials.map(m => ({ ...m })));
  const [regions] = useState<RegionCoefficient[]>(mockRegionCoefficients);
  const [storeForecasts, setStoreForecasts] = useState<StoreForecast[]>([]);
  const [warehouseAggs, setWarehouseAggs] = useState<WarehouseAggregation[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [activeSkill, setActiveSkill] = useState(SKILLS[0]);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Welcome message
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    addBotMessage('你好！我是 AI CEO 新品分仓助手 🤖\n\n我可以帮你完成新品从录入到备货方案输出的全流程。\n\n你可以用自然语言告诉我你想做什么，比如：\n• "帮我创建新品苹果莲雾汁，首周日均15000杯"\n• "选择全部核心物料"\n• "调整华东区域系数为1.8"\n• "确认备货方案"\n\n也可以点击下方快捷指令快速操作。\n\n现在，请告诉我新品的信息吧！');
  }, []);

  const addBotMessage = useCallback((content: string, thinking?: string[]) => {
    setMessages(prev => [...prev, {
      id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'assistant',
      content,
      timestamp: new Date(),
      thinking,
    }]);
  }, []);

  const simulateTyping = useCallback((content: string, thinking?: string[], delay = 800) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      addBotMessage(content, thinking);
    }, delay);
  }, [addBotMessage]);

  // Core: handle user input via NLU
  const handleUserInput = useCallback((text: string) => {
    // Add user message
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    }]);
    setInputText('');

    // Parse intent
    const intent = parseIntent(text);

    // Show thinking chain then respond
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      processIntent(intent, text);
    }, 600 + Math.random() * 400);
  }, [step, productInfo, materials, storeForecasts, warehouseAggs]);

  const processIntent = (intent: ReturnType<typeof parseIntent>, rawText: string) => {
    const { type, entities, thinking } = intent;

    switch (type) {
      case 'create_product_full': {
        const updated = {
          ...productInfo,
          name: entities.name || productInfo.name,
          firstWeekDailyCups: entities.firstWeekDailyCups || productInfo.firstWeekDailyCups,
          firstMonthDailyCups: entities.firstMonthDailyCups || productInfo.firstMonthDailyCups,
        };
        setProductInfo(updated);
        addBotMessage(
          `新品信息已录入 ✅\n\n• 名称：**${updated.name}**\n• 首周日均：**${updated.firstWeekDailyCups.toLocaleString()}** 杯\n• 首月日均：**${updated.firstMonthDailyCups.toLocaleString()}** 杯\n\n还需要设置上市日期和上新范围吗？还是直接进入下一步？`,
          thinking,
        );
        break;
      }
      case 'create_product': {
        setProductInfo(prev => ({ ...prev, name: entities.name }));
        addBotMessage(`好的，新品名称已设为 **${entities.name}**。\n\n请继续告诉我首周和首月的日均杯量预测。`, thinking);
        break;
      }
      case 'set_first_week_cups': {
        setProductInfo(prev => ({ ...prev, firstWeekDailyCups: entities.firstWeekDailyCups }));
        addBotMessage(`首周日均杯量已设为 **${entities.firstWeekDailyCups.toLocaleString()}** 杯 ✅`, thinking);
        break;
      }
      case 'set_first_month_cups': {
        setProductInfo(prev => ({ ...prev, firstMonthDailyCups: entities.firstMonthDailyCups }));
        addBotMessage(`首月日均杯量已设为 **${entities.firstMonthDailyCups.toLocaleString()}** 杯 ✅`, thinking);
        break;
      }
      case 'set_launch_date': {
        setProductInfo(prev => ({ ...prev, launchDate: entities.launchDate }));
        addBotMessage(`上市日期已设为 **${entities.launchDate}** ✅`, thinking);
        break;
      }
      case 'set_scope': {
        setProductInfo(prev => ({ ...prev, scope: entities.scope }));
        addBotMessage(`上新范围已设为 **${entities.scope}** ✅\n\n新品信息录入完成，可以进入下一步筛选核心物料了。`, thinking);
        break;
      }
      case 'select_all_materials': {
        setMaterials(prev => prev.map(m => ({ ...m, selected: true })));
        const count = materials.length;
        addBotMessage(`已选择全部 **${count}** 种物料 ✅\n\n包括：${materials.map(m => m.name).join('、')}\n\n确认后可以进入区域系数计算。`, thinking);
        break;
      }
      case 'deselect_material': {
        const name = entities.materialName;
        const found = materials.find(m => m.name.includes(name));
        if (found) {
          setMaterials(prev => prev.map(m => m.id === found.id ? { ...m, selected: false } : m));
          addBotMessage(`已取消选择 **${found.name}** ✅\n\n当前选中 ${materials.filter(m => m.selected && m.id !== found.id).length} 种核心物料。`, thinking);
        } else {
          addBotMessage(`未找到名称包含"${name}"的物料，请确认名称。`, thinking);
        }
        break;
      }
      case 'select_only': {
        const name = entities.materialName;
        const found = materials.find(m => m.name.includes(name));
        if (found) {
          setMaterials(prev => prev.map(m => ({ ...m, selected: m.id === found.id })));
          addBotMessage(`已仅选择 **${found.name}** ✅`, thinking);
        } else {
          addBotMessage(`未找到名称包含"${name}"的物料。`, thinking);
        }
        break;
      }
      case 'show_similar_products': {
        const list = similarProducts.map(p => `• ${p.name}（${p.launchDate}，首月${p.firstMonthCups.toLocaleString()}杯，匹配度${(p.regionMatch * 100).toFixed(0)}%）`).join('\n');
        addBotMessage(`以下是系统推荐的5个相似历史新品：\n\n${list}\n\n基于这些产品的区域销售数据，已自动计算各区域系数。华东系数最高（2.0），华中/东北/西北触发下限保护（1.0）。\n\n需要调整某个区域的系数吗？`, thinking);
        break;
      }
      case 'adjust_region_coeff': {
        const { region, coefficient } = entities;
        addBotMessage(
          `已将 **${region}** 区域系数从 2.0 调整为 **${coefficient}** ✅\n\n⚠️ 注意：调低华东系数会减少华东区域的备货量，可能影响首周供应充足度。\n\n需要重新计算吗？`,
          thinking,
        );
        break;
      }
      case 'run_calculation':
      case 'recalculate': {
        // Run full calculation pipeline
        const selectedMats = materials.filter(m => m.selected);
        if (selectedMats.length === 0) {
          addBotMessage('⚠️ 请先选择至少一种核心物料。', thinking);
          break;
        }
        const forecasts = generateStoreForecasts(
          productInfo.firstWeekDailyCups,
          productInfo.firstMonthDailyCups,
          regions,
          selectedMats,
        );
        setStoreForecasts(forecasts);

        const aggs = aggregateToWarehouse(forecasts, selectedMats);
        setWarehouseAggs(aggs);

        const totalCups = forecasts.reduce((s, f) => s + f.totalCups, 0);
        const gmvTarget = productInfo.firstMonthDailyCups * 28;
        const ws = checkWarnings(totalCups, gmvTarget, aggs, materials);
        setWarnings(ws);

        const totalMaterial = selectedMats.reduce((s, m) => {
          return s + forecasts.reduce((fs, f) => fs + f.totalMaterial, 0);
        }, 0);

        addBotMessage(
          `计算完成 ✅\n\n📊 **计算摘要**\n• 预测门店：${forecasts.length} 家（代表性门店）\n• 核心物料：${selectedMats.length} 种\n• 四周总预测杯量：${totalCups.toLocaleString()} 杯\n• 7仓汇总备货量：${aggs.reduce((s, w) => s + w.moqRounded, 0).toLocaleString()} 单位\n\n⚠️ 发现 ${ws.filter(w => w.level !== 'green').length} 条预警，请查看详情。\n\n需要调整参数重新计算，还是确认方案？`,
          thinking,
        );
        // Auto advance to step 7 if on step 4-6
        if (step >= 4 && step <= 6) setStep(7);
        break;
      }
      case 'adjust_coefficient': {
        addBotMessage(
          `已将备货系数调整为 **${entities.newValue}** ✅\n\n正在重新计算...\n\n`,
          thinking,
        );
        // Trigger recalculation after a delay
        setTimeout(() => {
          const selectedMats = materials.filter(m => m.selected);
          const forecasts = generateStoreForecasts(
            productInfo.firstWeekDailyCups,
            productInfo.firstMonthDailyCups,
            regions,
            selectedMats,
          );
          setStoreForecasts(forecasts);
          const aggs = aggregateToWarehouse(forecasts, selectedMats);
          setWarehouseAggs(aggs);
          const totalCups = forecasts.reduce((s, f) => s + f.totalCups, 0);
          const gmvTarget = productInfo.firstMonthDailyCups * 28;
          const ws = checkWarnings(totalCups, gmvTarget, aggs, materials);
          setWarnings(ws);
          addBotMessage(`重新计算完成 ✅\n\n调整后总备货量：${aggs.reduce((s, w) => s + w.moqRounded, 0).toLocaleString()} 单位\n预警数量：${ws.filter(w => w.level !== 'green').length} 条`);
        }, 1000);
        break;
      }
      case 'negotiate_moq': {
        addBotMessage(
          `已将莲雾浓缩汁 MOQ 从 50 调整为 **${entities.newMoq}** ✅\n\nMOQ取整偏差预计降至 3% 以内，预警解除。\n\n需要重新计算确认吗？`,
          thinking,
        );
        break;
      }
      case 'confirm': {
        setConfirmed(true);
        addBotMessage(
          `🎉 备货方案已确认！\n\n**${productInfo.name}** 分仓备货方案：\n• 7个仓库 × ${materials.filter(m => m.selected).length}种物料\n• 总备货量：${warehouseAggs.reduce((s, w) => s + w.moqRounded, 0).toLocaleString()} 单位\n• 方案已锁定，可导出Excel发送给供应商\n\n需要导出吗？`,
          thinking,
        );
        setStep(8);
        break;
      }
      case 'export_excel': {
        addBotMessage(
          `📥 Excel 导出中...\n\n文件名：${productInfo.name}_分仓备货方案_${new Date().toISOString().slice(0, 10)}.xlsx\n\n包含：\n• Sheet1: 门店级预测明细\n• Sheet2: 仓库汇总\n• Sheet3: 供应商分配\n• Sheet4: 预警记录\n\n✅ 导出完成！文件已保存到下载目录。`,
          thinking,
        );
        break;
      }
      case 'next_step': {
        if (step < 8) {
          const nextStep = (step + 1) as WizardStep;
          setStep(nextStep);
          // Trigger calculations when entering certain steps
          if (nextStep === 4 && storeForecasts.length === 0) {
            const selectedMats = materials.filter(m => m.selected);
            const forecasts = generateStoreForecasts(
              productInfo.firstWeekDailyCups,
              productInfo.firstMonthDailyCups,
              regions,
              selectedMats,
            );
            setStoreForecasts(forecasts);
          }
          if (nextStep >= 6 && warehouseAggs.length === 0 && storeForecasts.length > 0) {
            const selectedMats = materials.filter(m => m.selected);
            const aggs = aggregateToWarehouse(storeForecasts, selectedMats);
            setWarehouseAggs(aggs);
          }
          if (nextStep === 7 && warnings.length === 0 && warehouseAggs.length > 0) {
            const totalCups = storeForecasts.reduce((s, f) => s + f.totalCups, 0);
            const gmvTarget = productInfo.firstMonthDailyCups * 28;
            const ws = checkWarnings(totalCups, gmvTarget, warehouseAggs, materials);
            setWarnings(ws);
          }
          addBotMessage(`已进入 **Step ${nextStep}：${STEP_LABELS[nextStep - 1]}**\n\n${getStepGuidance(nextStep)}`, thinking);
        } else {
          addBotMessage('已经是最后一步了。请确认备货方案或导出Excel。', thinking);
        }
        break;
      }
      case 'prev_step': {
        if (step > 1) {
          setStep((step - 1) as WizardStep);
          addBotMessage(`已返回 **Step ${step - 1}：${STEP_LABELS[step - 2]}**`, thinking);
        } else {
          addBotMessage('已经是第一步了。', thinking);
        }
        break;
      }
      case 'help': {
        addBotMessage(
          `我可以帮你完成以下操作：\n\n**Step 1 新品信息**\n• "创建新品XX，首周日均XX杯，首月日均XX杯"\n• "上市日期是YYYY-MM-DD"\n\n**Step 2 物料筛选**\n• "选择全部核心物料"\n• "去掉XX物料"\n\n**Step 3 区域系数**\n• "看看相似历史新品"\n• "调整华东区域系数为1.8"\n\n**Step 4-6 计算**\n• "开始计算" / "重新计算"\n\n**Step 7 预警处理**\n• "调低区域系数为1.8"\n• "协商MOQ降到30"\n\n**Step 8 确认输出**\n• "确认备货方案"\n• "导出Excel"\n\n**通用**\n• "下一步" / "上一步"`,
          thinking,
        );
        break;
      }
      default: {
        addBotMessage(
          `抱歉，我没有理解你的意思 😅\n\n你可以试试：\n• 更具体地描述你想做什么\n• 点击下方的快捷指令\n• 输入"帮助"查看所有可用指令`,
          thinking,
        );
      }
    }
  };

  const getStepGuidance = (s: number): string => {
    switch (s) {
      case 1: return '请告诉我新品的名称、预测杯量等信息。';
      case 2: return '请从BOM清单中筛选核心物料。';
      case 3: return '查看相似历史新品和区域系数，需要调整吗？';
      case 4: return '门店级预测数据已生成，查看右侧面板。';
      case 5: return '物料量计算结果已展示。';
      case 6: return '效期校验和仓库汇总已完成。';
      case 7: return '发现预警信息，需要调整参数吗？';
      case 8: return '请确认备货方案或导出Excel。';
      default: return '';
    }
  };

  const sendMessage = () => {
    if (!inputText.trim() || isTyping) return;
    handleUserInput(inputText.trim());
  };

  const sendQuickCommand = (text: string) => {
    if (isTyping) return;
    handleUserInput(text);
  };

  const quickCmds = QUICK_COMMANDS[step] || [];

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">SC</div>
          <span className="logo-text">AI CEO</span>
          <span className="logo-sub">新品分仓备货</span>
        </div>
        <div className="user-info">
          <span>供应链计划员 · 小王</span>
          <div className="user-avatar">王</div>
        </div>
      </header>

      {/* Wizard Progress */}
      <div className="wizard-progress">
        {STEP_LABELS.map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <div className={`wizard-connector ${i + 1 < step ? 'completed' : ''}`} />}
            <div
              className={`wizard-step ${i + 1 === step ? 'active' : ''} ${i + 1 < step ? 'completed' : ''}`}
              onClick={() => { if (i + 1 <= step) setStep((i + 1) as WizardStep); }}
            >
              <span className="step-num">{i + 1 < step ? '✓' : i + 1}</span>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Left: Chat Panel */}
        <div className="chat-panel">
          <div className="chat-header">
            <span>🤖</span> AI CEO 助手
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>
              自然语言驱动
            </span>
          </div>
          <div className="chat-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`chat-msg ${msg.role}`}>
                <div className="chat-avatar">{msg.role === 'assistant' ? 'AI' : '王'}</div>
                <div className="chat-bubble-wrapper">
                  {msg.thinking && msg.thinking.length > 0 && (
                    <div className="thinking-chain">
                      {msg.thinking.map((t, i) => (
                        <div key={i} className="thinking-step">
                          <span className="step-icon">{i + 1}</span>
                          <span>{t}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="chat-bubble">{formatMessage(msg.content)}</div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="chat-msg assistant">
                <div className="chat-avatar">AI</div>
                <div className="chat-bubble typing-indicator">
                  <span className="dot-typing" /><span className="dot-typing" /><span className="dot-typing" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Commands */}
          {quickCmds.length > 0 && (
            <div className="quick-commands">
              {quickCmds.map((cmd, i) => (
                <button
                  key={i}
                  className="quick-cmd"
                  onClick={() => sendQuickCommand(cmd.text)}
                  disabled={isTyping}
                >
                  {cmd.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="chat-input-area">
            <div className="input-toolbar">
              <button
                className="skill-btn"
                onClick={() => setShowSkillPicker(!showSkillPicker)}
              >
                <span className="skill-btn-icon">+</span>
                <span>选择技能</span>
                {activeSkill && <span className="skill-btn-active">{activeSkill.icon} {activeSkill.name}</span>}
              </button>
            </div>
            {showSkillPicker && (
              <div className="skill-picker">
                <div className="skill-picker-title">选择技能</div>
                <div className="skill-picker-list">
                  {SKILLS.map(skill => (
                    <button
                      key={skill.id}
                      className={`skill-picker-item ${activeSkill.id === skill.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveSkill(skill);
                        setShowSkillPicker(false);
                        if (skill.id !== 'newproduct') {
                          addBotMessage(`已切换到「${skill.name}」技能。\n\n${skill.desc}\n\n（该技能 Demo 开发中，敬请期待）`);
                        }
                      }}
                    >
                      <span className="skill-picker-icon">{skill.icon}</span>
                      <div className="skill-picker-info">
                        <div className="skill-picker-name">{skill.name}</div>
                        <div className="skill-picker-desc">{skill.desc}</div>
                      </div>
                      {activeSkill.id === skill.id && <span className="skill-picker-check">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="input-row">
              <input
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder={`输入自然语言指令，如"创建新品苹果莲雾汁"...`}
                disabled={isTyping}
              />
              <button onClick={sendMessage} disabled={isTyping || !inputText.trim()}>发送</button>
            </div>
          </div>
        </div>

        {/* Right: Step Content */}
        <div className="right-panel">
          {step === 1 && <Step1ProductInfo productInfo={productInfo} setProductInfo={setProductInfo} />}
          {step === 2 && <Step2Materials materials={materials} setMaterials={setMaterials} />}
          {step === 3 && <Step3RegionCoefficients regions={regions} />}
          {step === 4 && <Step4StoreForecast forecasts={storeForecasts} />}
          {step === 5 && <Step5MaterialCalc forecasts={storeForecasts} materials={materials.filter(m => m.selected)} />}
          {step === 6 && <Step6Validation warehouseAggs={warehouseAggs} materials={materials.filter(m => m.selected)} />}
          {step === 7 && <Step7Warnings warnings={warnings} warehouseAggs={warehouseAggs} />}
          {step === 8 && <Step8Confirm warehouseAggs={warehouseAggs} warnings={warnings} productInfo={productInfo} confirmed={confirmed} />}
        </div>
      </div>
    </div>
  );
}

// Format message with bold and code blocks
function formatMessage(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ===== Step Components =====

function Step1ProductInfo({ productInfo, setProductInfo }: { productInfo: NewProductInfo; setProductInfo: (p: NewProductInfo) => void }) {
  return (
    <div className="animate-in">
      <div className="panel-title">
        <span className="step-badge">Step 1</span>
        新品信息录入
      </div>
      <div className="card">
        <div className="card-title"><span className="dot dot-jade" />基本信息</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">新品名称<span className="required">*</span></label>
            <input className="form-input" value={productInfo.name} onChange={e => setProductInfo({ ...productInfo, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">计划上市日期<span className="required">*</span></label>
            <input className="form-input" type="date" value={productInfo.launchDate} onChange={e => setProductInfo({ ...productInfo, launchDate: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">大盘预测首周日均杯量<span className="required">*</span></label>
            <input className="form-input" type="number" value={productInfo.firstWeekDailyCups} onChange={e => setProductInfo({ ...productInfo, firstWeekDailyCups: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label className="form-label">大盘预测首月日均杯量<span className="required">*</span></label>
            <input className="form-input" type="number" value={productInfo.firstMonthDailyCups} onChange={e => setProductInfo({ ...productInfo, firstMonthDailyCups: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label className="form-label">上新范围</label>
            <select className="form-select" value={productInfo.scope} onChange={e => setProductInfo({ ...productInfo, scope: e.target.value as '全国' | '区域' })}>
              <option value="全国">全国</option>
              <option value="区域">区域</option>
            </select>
          </div>
        </div>
      </div>
      <div className="card" style={{ background: 'rgba(20,60,54,0.03)' }}>
        <div className="card-title" style={{ fontSize: 12, color: 'var(--muted)' }}>💡 试试这样说</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
          "帮我创建新品苹果莲雾汁，首周日均15000杯，首月日均16000杯"<br />
          "上市日期是2026-07-24"<br />
          "上新范围是全国"
        </p>
      </div>
    </div>
  );
}

function Step2Materials({ materials, setMaterials }: { materials: BOMMaterial[]; setMaterials: (m: BOMMaterial[]) => void }) {
  const toggleMaterial = (id: string) => {
    setMaterials(materials.map(m => m.id === id ? { ...m, selected: !m.selected } : m));
  };
  return (
    <div className="animate-in">
      <div className="panel-title">
        <span className="step-badge">Step 2</span>
        核心物料筛选
      </div>
      <div className="card">
        <div className="card-title"><span className="dot dot-amber" />BOM 物料清单</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
          勾选核心物料，或在左侧对话中说"选择全部核心物料"、"去掉XX"
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>选择</th>
              <th>物料名称</th>
              <th>规格</th>
              <th>采购单位</th>
              <th className="num">应用率W1</th>
              <th className="num">MOQ</th>
              <th className="num">效期(周)</th>
            </tr>
          </thead>
          <tbody>
            {materials.map(m => (
              <tr key={m.id} onClick={() => toggleMaterial(m.id)} style={{ cursor: 'pointer', opacity: m.selected ? 1 : 0.5 }}>
                <td><input type="checkbox" checked={m.selected} onChange={() => toggleMaterial(m.id)} /></td>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td>{m.spec}</td>
                <td>{m.purchaseUnit}</td>
                <td className="num">{m.applicationRateW1}</td>
                <td className="num">{m.moq}</td>
                <td className="num">{m.shelfLifeMinWeeks || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
        已选择 <strong style={{ color: 'var(--pine)' }}>{materials.filter(m => m.selected).length}</strong> / {materials.length} 种物料
      </div>
    </div>
  );
}

function Step3RegionCoefficients({ regions }: { regions: RegionCoefficient[] }) {
  return (
    <div className="animate-in">
      <div className="panel-title">
        <span className="step-badge">Step 3</span>
        区域系数计算
      </div>
      <div className="card">
        <div className="card-title"><span className="dot dot-sky" />相似历史新品</div>
        <table className="data-table">
          <thead>
            <tr><th>历史新品</th><th>上市日期</th><th className="num">首月日均杯量</th><th className="num">区域匹配度</th></tr>
          </thead>
          <tbody>
            {similarProducts.map((p, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td>{p.launchDate}</td>
                <td className="num">{p.firstMonthCups.toLocaleString()}</td>
                <td className="num">{(p.regionMatch * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-title"><span className="dot dot-jade" />区域系数结果</div>
        <table className="data-table">
          <thead>
            <tr><th>区域</th><th>分公司</th><th className="num">门店数</th><th className="num">销售占比</th><th className="num">区域系数</th></tr>
          </thead>
          <tbody>
            {regions.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{r.region}</td>
                <td>{r.subsidiary}</td>
                <td className="num">{r.storeCount.toLocaleString()}</td>
                <td className="num">{(r.salesRatio * 100).toFixed(1)}%</td>
                <td className="num" style={{ fontWeight: 700, color: r.coefficient > 1 ? 'var(--pine)' : 'var(--muted)' }}>
                  {r.coefficient.toFixed(2)}
                  {r.coefficient === 1 && <span style={{ fontSize: 10, color: 'var(--amber)', marginLeft: 4 }}>下限保护</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Step4StoreForecast({ forecasts }: { forecasts: StoreForecast[] }) {
  if (forecasts.length === 0) return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 4</span>门店级杯量预测</div>
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: 'var(--muted)' }}>等待计算... 请在左侧说"开始预测"或"下一步"</p>
      </div>
    </div>
  );
  const totalCups = forecasts.reduce((s, f) => s + f.totalCups, 0);
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 4</span>门店级杯量预测</div>
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">预测门店数</div><div className="kpi-value">{forecasts.length}<span className="kpi-unit">家</span></div></div>
        <div className="kpi-card"><div className="kpi-label">四周总预测杯量</div><div className="kpi-value">{totalCups.toLocaleString()}<span className="kpi-unit">杯</span></div></div>
      </div>
      <div className="card">
        <div className="card-title"><span className="dot dot-violet" />代表性门店预测明细</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>门店</th><th>区域</th><th className="num">区域系数</th><th className="num">W1</th><th className="num">W2</th><th className="num">W3</th><th className="num">W4</th><th className="num">合计</th></tr></thead>
            <tbody>
              {forecasts.slice(0, 12).map((f, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>{f.storeName}</td>
                  <td>{f.region}</td>
                  <td className="num">{f.regionCoeff.toFixed(2)}</td>
                  <td className="num">{f.w1Cups.toLocaleString()}</td>
                  <td className="num">{f.w2Cups.toLocaleString()}</td>
                  <td className="num">{f.w3Cups.toLocaleString()}</td>
                  <td className="num">{f.w4Cups.toLocaleString()}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{f.totalCups.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Step5MaterialCalc({ forecasts, materials }: { forecasts: StoreForecast[]; materials: BOMMaterial[] }) {
  if (forecasts.length === 0) return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 5</span>物料量计算</div>
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: 'var(--muted)' }}>等待计算... 请在左侧说"执行计算"</p>
      </div>
    </div>
  );
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 5</span>物料量计算</div>
      <div className="card">
        <div className="card-title"><span className="dot dot-jade" />核心公式</div>
        <pre style={{ background: 'var(--pine-dark)', color: '#e0e0e0', padding: 14, borderRadius: 10, fontSize: 12, fontFamily: '"IBM Plex Mono", monospace', overflowX: 'auto' }}>
{`W1物料量 = 首周日均杯量 × 区域系数 × W1占比 × 7 ÷ 应用率W1 × 备货系数
W2-W4物料量 = 月日均杯量 × 区域系数 × Wn占比 × 7 ÷ 应用率Wn × 备货系数
预测总量 = round(W1 + W2 + W3 + W4)`}
        </pre>
      </div>
      {materials.map(mat => {
        const totalMat = forecasts.reduce((s, f) => {
          const w1 = f.w1Cups * mat.ratioW1 * 7 / mat.applicationRateW1 * mat.stockCoefficient;
          const w2 = f.w2Cups * mat.ratioW2 * 7 / mat.applicationRateW2 * mat.stockCoefficient;
          const w3 = f.w3Cups * mat.ratioW3 * 7 / mat.applicationRateW3 * mat.stockCoefficient;
          const w4 = f.w4Cups * mat.ratioW4 * 7 / mat.applicationRateW4 * mat.stockCoefficient;
          return s + Math.round(w1 + w2 + w3 + w4);
        }, 0);
        return (
          <div className="card" key={mat.id}>
            <div className="card-title"><span className="dot dot-amber" />{mat.name}（{mat.spec}）</div>
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="kpi-card"><div className="kpi-label">全国总需求</div><div className="kpi-value">{totalMat.toLocaleString()}<span className="kpi-unit">{mat.purchaseUnit}</span></div></div>
              <div className="kpi-card"><div className="kpi-label">应用率</div><div className="kpi-value">{mat.applicationRateW1}</div></div>
              <div className="kpi-card"><div className="kpi-label">MOQ</div><div className="kpi-value">{mat.moq}<span className="kpi-unit">{mat.purchaseUnit}</span></div></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Step6Validation({ warehouseAggs, materials }: { warehouseAggs: WarehouseAggregation[]; materials: BOMMaterial[] }) {
  if (warehouseAggs.length === 0) return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 6</span>效期校验与汇总到仓</div>
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: 'var(--muted)' }}>等待计算... 请在左侧说"汇总到仓"</p>
      </div>
    </div>
  );
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 6</span>效期校验与汇总到仓</div>
      <div className="card">
        <div className="card-title"><span className="dot dot-jade" />效期校验结果</div>
        <table className="data-table">
          <thead><tr><th>物料</th><th className="num">效期(周)</th><th>状态</th></tr></thead>
          <tbody>
            {materials.map(m => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td className="num">{m.shelfLifeMinWeeks || '—'}</td>
                <td><span style={{ color: 'var(--jade)', fontWeight: 600 }}>✓ 通过</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-title"><span className="dot dot-sky" />仓库汇总</div>
        <table className="data-table">
          <thead><tr><th>仓库</th><th className="num">覆盖门店</th><th className="num">预测总量</th><th className="num">统配量</th><th className="num">统配外备货</th><th className="num">可售天数</th></tr></thead>
          <tbody>
            {warehouseAggs.map((w, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{w.warehouseName}</td>
                <td className="num">{w.coveredStores.toLocaleString()}</td>
                <td className="num">{w.totalForecast.toLocaleString()}</td>
                <td className="num">{w.allocationQty.toLocaleString()}</td>
                <td className="num" style={{ fontWeight: 700 }}>{w.extraStock.toLocaleString()}</td>
                <td className="num">{w.sellableDays}天</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Step7Warnings({ warnings, warehouseAggs }: { warnings: Warning[]; warehouseAggs: WarehouseAggregation[] }) {
  if (warnings.length === 0) return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 7</span>供应商分配与预警</div>
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: 'var(--muted)' }}>等待计算... 请在左侧说"执行计算"</p>
      </div>
    </div>
  );
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 7</span>供应商分配与预警</div>
      <div className="card">
        <div className="card-title"><span className="dot dot-coral" />预警信息</div>
        {warnings.map((w, i) => (
          <div key={i} className={`warning-card ${w.level}`}>
            <span className="warning-icon">{w.level === 'red' ? '🔴' : w.level === 'yellow' ? '🟡' : '🟢'}</span>
            <div className="warning-content">
              <div className="warning-title">{w.type}</div>
              <div className="warning-msg">{w.message}</div>
              <div className="warning-suggestion">💡 {w.suggestion}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-title"><span className="dot dot-violet" />供应商分配</div>
        <table className="data-table">
          <thead><tr><th>供应商</th><th>物料</th><th className="num">产能</th><th className="num">份额</th></tr></thead>
          <tbody>
            {suppliers.map((s, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td>{s.material}</td>
                <td className="num">{s.capacity.toLocaleString()}</td>
                <td className="num">{(s.share * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Step8Confirm({ warehouseAggs, warnings, productInfo, confirmed }: { warehouseAggs: WarehouseAggregation[]; warnings: Warning[]; productInfo: NewProductInfo; confirmed: boolean }) {
  const totalStock = warehouseAggs.reduce((s, w) => s + w.moqRounded, 0);
  const redWarnings = warnings.filter(w => w.level === 'red').length;
  const yellowWarnings = warnings.filter(w => w.level === 'yellow').length;
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 8</span>备货确认与结果输出</div>
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">新品名称</div><div className="kpi-value" style={{ fontSize: 18 }}>{productInfo.name}</div></div>
        <div className="kpi-card"><div className="kpi-label">总备货量</div><div className="kpi-value">{totalStock.toLocaleString()}<span className="kpi-unit">单位</span></div></div>
        <div className="kpi-card"><div className="kpi-label">🔴 红色预警</div><div className="kpi-value" style={{ color: redWarnings > 0 ? 'var(--coral)' : 'var(--jade)' }}>{redWarnings}</div></div>
        <div className="kpi-card"><div className="kpi-label">🟡 黄色预警</div><div className="kpi-value" style={{ color: yellowWarnings > 0 ? 'var(--amber)' : 'var(--jade)' }}>{yellowWarnings}</div></div>
      </div>
      {confirmed && (
        <div className="card" style={{ background: 'rgba(66,161,112,0.08)', borderColor: 'var(--jade)' }}>
          <div className="card-title" style={{ color: 'var(--jade)' }}>✅ 方案已确认</div>
          <p style={{ fontSize: 13 }}>备货方案已锁定，可导出Excel发送给供应商。</p>
        </div>
      )}
      <div className="card">
        <div className="card-title"><span className="dot dot-jade" />最终备货方案</div>
        <table className="data-table">
          <thead><tr><th>仓库</th><th className="num">预测量</th><th className="num">统配量</th><th className="num">统配外备货</th><th className="num">MOQ取整</th><th className="num">可售天数</th></tr></thead>
          <tbody>
            {warehouseAggs.map((w, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{w.warehouseName}</td>
                <td className="num">{w.totalForecast.toLocaleString()}</td>
                <td className="num">{w.allocationQty.toLocaleString()}</td>
                <td className="num">{w.extraStock.toLocaleString()}</td>
                <td className="num" style={{ fontWeight: 700, color: 'var(--pine)' }}>{w.moqRounded.toLocaleString()}</td>
                <td className="num">{w.sellableDays}天</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
