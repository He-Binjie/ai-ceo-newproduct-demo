import { useState, useEffect, useRef, useCallback } from 'react';
import './styles.css';
import type { WizardStep, ChatMessage, NewProductInfo, BOMMaterial, RegionCoefficient, ConfirmAction } from './types';
import { mockProduct, mockMaterials, mockRegionCoefficients, historicalProducts, historicalProductsDetail, mockStoreSamples, nationalMaterialSummary, warehouseSummarySample, newProductList } from './data/mock';
import { parseIntent } from './engine/nlu';

const STEP_LABELS = [
  '选择新品',
  '新品信息读取', '核心物料确认', '区域系数计算',
  '门店级杯量预测', '物料量计算', '汇总到仓',
  '供应商分配', '备货预警', 'MOQ取整预警',
  '统配比对', '安全库存校验', '结果输出',
];

const SKILLS = [
  { id: 'newproduct', name: '新品分仓备货', icon: '📦', desc: '新品从录入到备货方案全流程' },
  { id: 'query', name: '智能问数', icon: '📊', desc: '自然语言查询供应链数据' },
  { id: 'stockout', name: '缺货归因', icon: '⚠️', desc: '缺货原因分析与补货建议' },
  { id: 'forecast', name: '销量预测', icon: '📈', desc: '基于历史数据的销量预测' },
];

function App() {
  const [step, setStep] = useState<WizardStep>(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [productInfo] = useState<NewProductInfo>({ ...mockProduct });
  const [materials, setMaterials] = useState<BOMMaterial[]>(mockMaterials.map(m => ({ ...m })));
  const [regions, setRegions] = useState<RegionCoefficient[]>(mockRegionCoefficients.map(r => ({ ...r })));
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [activeSkill, setActiveSkill] = useState(SKILLS[0]);
  const [_stepConfirmed, setStepConfirmed] = useState<Record<number, boolean>>({});
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const addBotMessage = useCallback((content: string, thinking?: string[], confirmActions?: ConfirmAction[]) => {
    setMessages(prev => [...prev, {
      id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'assistant', content, timestamp: new Date(), thinking, confirmActions,
    }]);
  }, []);

  const simulateTyping = useCallback((content: string, thinking?: string[], confirmActions?: ConfirmAction[], delay = 800) => {
    setIsTyping(true);
    setTimeout(() => { setIsTyping(false); addBotMessage(content, thinking, confirmActions); }, delay);
  }, [addBotMessage]);

  const confirmStep = (s: number) => {
    setStepConfirmed(prev => ({ ...prev, [s]: true }));
    if (s < 12) {
      const next = (s + 1) as WizardStep;
      setStep(next);
      triggerStepMessage(next);
    }
  };

  const selectProduct = (productId: string) => {
    setSelectedProduct(productId);
    setStep(1);
    triggerStepMessage(1);
  };

  const triggerStepMessage = (s: WizardStep) => {
    switch (s) {
      case 0:
        simulateTyping(
          `你好！我是 AI CEO 新品分仓助手。\n\n当前有 **4** 个新品在上新周期内（前后2个月），请选择要开始分仓的新品：`,
          ['扫描上新周期：2026-06-08 ~ 2026-10-08', '筛选出4个新品（剔除已超期）'],
        );
        break;
      case 1:
        simulateTyping(
          `已从飞书多维表格读取 **${productInfo.name}** 的信息 ✅\n\n📋 **数据来源：飞书多维表格（非系统）**\n\n**新品基础信息：**\n• 新品名称：**${productInfo.name}**\n• 上市日期：**${productInfo.launchDate}**\n• 上新范围：**${productInfo.scope}**\n\n**物料清单（${materials.length}种核心物料）：**\n已在多维表格中预选，详见右侧面板。\n\n📊 **系统自动获取（非表格读取）：**\n• 在营门店数：**${productInfo.storeCount.toLocaleString()}** 家（滚动30天）\n• 大盘预测首周日均：**${productInfo.firstWeekDailyCups}** 杯\n• 大盘预测首月日均：**${productInfo.firstMonthDailyCups}** 杯\n\n⚠️ 数据一致性校验：首月日均(${productInfo.firstMonthDailyCups}) ≥ 首周日均(${productInfo.firstWeekDailyCups}) ✅\n\n请确认信息是否正确？`,
          ['读取飞书多维表格：新品基础信息表', '读取飞书多维表格：物料清单表（非系统BOM）', '系统自动获取：滚动30天在营门店数', '字段完整性校验：通过'],
          [{ label: '✅ 确认，继续', type: 'confirm' }, { label: '✏️ 返回修改表格', type: 'edit' }],
        );
        break;
      case 2:
        simulateTyping(
          `核心物料已确认 ✅\n\n以下 **${materials.length}** 种物料来自飞书多维表格，已由罗雄预选为核心物料。\n\n⚠️ **东方美人乌龙茶-A** 物料编码为空（新品建档未完成），后续统配比对可能无法精确匹配。\n\n如需排除某些物料，可取消勾选。确认后进入区域系数计算。`,
          ['匹配物料编码', '检测编码缺失：东方美人乌龙茶-A'],
          [{ label: '✅ 全部确认', type: 'confirm' }, { label: '⏭️ 忽略编码缺失', type: 'skip' }],
        );
        break;
      case 3:
        simulateTyping(
          `区域系数计算完成 ✅\n\n基于 **${historicalProducts.length}** 个历史新品（默认全选）的达标率均值：\n• 24个子公司中，**8个兜底为1.0**（33%），**16个保持原始值**\n• 最高：**湖北(1.196)** | 最低：广东/江苏等(兜底1.0)\n\n💡 **AI建议**：当前新品属于特调茶+果茶品类，推荐选择相似度≥80%的 **${historicalProductsDetail.filter(p => p.similarity >= 0.80).length}个历史品** 作为参考（排除轻因系列），可使区域系数更精准。\n\n你可以在右侧面板中：\n• 点击"🤖 AI推荐"一键选择推荐子集\n• 点击"展开选择"手动勾选/取消\n• 直接修改任意子公司系数值\n\n确认后进入门店预测。`,
          ['读取历史上新数据：23个品 × 24个子公司', '计算各子公司达标率均值', '兜底处理：<1.0 → 1.0', 'AI分析品类相似度，生成选择建议'],
          [{ label: '✅ 确认，继续', type: 'confirm' }, { label: '✏️ 批量调整系数', type: 'edit' }],
        );
        break;
      case 4:
        simulateTyping(
          `门店级杯量预测完成 ✅\n\n📊 **预测汇总**\n• 参与计算门店：**${productInfo.storeCount.toLocaleString()}** 家（系统自动获取，滚动30天）\n• 触发下限保护：约 **200** 家（日均<10杯）\n• 全国首周日均总量：**${(productInfo.firstWeekDailyCups * productInfo.storeCount).toLocaleString()}** 杯\n• 全国月日均总量：**${(productInfo.firstMonthDailyCups * productInfo.storeCount).toLocaleString()}** 杯\n\n🏪 **示例：门店1101010005（北京王府井APM店）**\n• 5月销量：29,837杯 → 占比：0.0246%\n• 首周日均：609 × 0.0246% × 7,188 = **1,077.92** 杯\n• 月日均：650 × 0.0246% × 7,188 = **1,150.49** 杯\n\n💡 **一期通过区域系数调整备货量**：区域系数已在Step 3中按子公司维度设定，用于调整各区域门店的预测杯量。`,
          ['抓取成品销售报表：滚动30天有销量门店7,188家', '计算门店销量占比', '下限保护：日均<10杯用大盘均值代替'],
          [{ label: '✅ 确认，继续', type: 'confirm' }],
        );
        break;
      case 5:
        simulateTyping(
          `物料量计算完成 ✅（${productInfo.storeCount.toLocaleString()}门店 × ${materials.filter(m=>m.selected).length}物料 × W1-W4）\n\n🧮 **示例：门店1101010005 × 莲雾苹果汁**\n\`\`\`\nW1 = 1077.92 × 1.2 × 0.05 × 7 ÷ 11.41 × 1.0 = 39.67\nW2 = 1150.49 × 1.2 × 0.035 × 7 ÷ 11.41 × 1.0 = 29.64\nW3 = 1150.49 × 1.2 × 0.0224 × 7 ÷ 11.41 × 1.0 = 18.97\nW4 = 1150.49 × 1.2 × 0.012544 × 7 ÷ 11.41 × 1.0 = 10.62\n预测总量 = Roundup(98.90) = 99 ✅\n\`\`\`\n\n效期校验：开封效期7天 → 周最小量=1，W1-W4均>1 ✅`,
          ['执行核心公式：逐门店逐物料W1-W4', 'Roundup向上取整', '效期校验：round(7÷开封效期天数)'],
          [{ label: '✅ 确认，继续', type: 'confirm' }],
        );
        break;
      case 6:
        simulateTyping(
          `汇总到仓完成 ✅\n\n按仓店映射关系（Sheet2，9,708条）汇总：\n\n🏭 **北京二级仓示例**\n• 安溪铁观音：统配589 + 统配外1,539 = **2,128**\n• 莲雾苹果汁：统配5,154 + 统配外8,245 = **13,399**\n• 老盐糖浆：统配497 + 统配外414 = **911**\n• 冷冻生椰乳：统配2,792 + 统配外2,035 = **4,827**\n\n请确认仓库映射和汇总结果。`,
          ['读取仓店映射Sheet2：9,708条', '按仓库汇总门店物料量'],
          [{ label: '✅ 确认，继续', type: 'confirm' }],
        );
        break;
      case 7:
        simulateTyping(
          `请输入各物料的供应商份额和MOQ信息。\n\n如不输入，默认1个供应商、MOQ=1（不做取整）。\n\n💡 份额之和必须=100%，系统会自动校验。`,
          [],
          [{ label: '✅ 使用默认值（1供应商，MOQ=1）', type: 'confirm' }, { label: '✏️ 手动输入供应商', type: 'edit' }],
        );
        break;
      case 8:
        simulateTyping(
          `备货预警检查完成 ✅\n\n📊 **第一道预警（备货偏差）**\n\n以莲雾苹果汁为例：\n• 理论预期总量 = 3,816,821\n• 全国预测总量 = 4,145,709 杯\n• 偏差率 = **8.6%**（阈值10%）\n• 状态：✅ 未触发预警\n\n⚠️ 安溪铁观音因备货系数1.15，偏差率可能较高。\n\n可调参数：区域系数（分公司维度）、备货系数（全局）`,
          ['计算W1-W4加权理论预期总量', '比对预测总量vs理论预期'],
          [{ label: '✅ 确认，继续', type: 'confirm' }, { label: '🔄 调参重跑', type: 'recalculate' }],
        );
        break;
      case 9:
        simulateTyping(
          `MOQ取整预警检查完成 ✅\n\n📊 **第二道预警（MOQ取整偏差）**\n\n• Step 8确认总量：363,340 瓶\n• MOQ取整后总量：363,540 瓶\n• 偏差率 = **0.055%**（阈值5%）\n• 状态：✅ 未触发预警\n\n所有物料MOQ取整偏差均在安全范围内。`,
          ['计算各仓MOQ取整后总量', '比对取整前后偏差'],
          [{ label: '✅ 确认，继续', type: 'confirm' }],
        );
        break;
      case 10:
        simulateTyping(
          `⏰ **T-30 统配数据已到**\n\n统配比对完成 ✅\n\n📊 **门店1101010005（北京王府井APM店）**\n| 物料 | 预测 | 统配 | 统配外 | 合计 |\n|------|------|------|--------|------|\n| 安溪铁观音 | 16 | 6 | 10 | 16 |\n| 莲雾苹果汁 | 99 | 35 | 64 | 99 |\n| 老盐糖浆 | 6 | 3 | 3 | 6 |\n| 冷冻生椰乳 | 32 | 12 | 20 | 32 |\n\n⚠️ 发现 **12** 家异常统配门店（统配>预测），建议与门店沟通。`,
          ['读取统配清单', 'IF逻辑：统配外=IF(预测-统配<0, 0, 预测-统配)', '异常统配识别：统配>预测'],
          [{ label: '✅ 确认，继续', type: 'confirm' }, { label: '⚠️ 标记异常门店', type: 'skip' }, { label: '📥 导出异常清单', type: 'export' }],
        );
        break;
      case 11:
        simulateTyping(
          `安全库存校验完成 ✅\n\n📊 **安库定义**：安全库存 = N天安库天数 × 日均消耗量（N=5天）\n\n📊 **北京二级仓**\n| 物料 | 统配外 | 日均消耗 | 可售天数 |\n|------|--------|---------|----------|\n| 安溪铁观音 | 1,539 | 76.0 | **20.3天** ✅ |\n| 莲雾苹果汁 | 8,245 | 478.4 | **17.2天** ✅ |\n| 老盐糖浆 | 414 | 32.5 | **12.7天** ✅ |\n\n全部物料可销售天数 > 5天 ✅\n\n最终校验：下单量/大盘预测 = **105%**（阈值105%）✅`,
          ['计算仓维度可销售天数', '最终总量校验', '实际下单量vs大盘校验'],
          [{ label: '✅ 确认，继续', type: 'confirm' }, { label: '✏️ 安全库存改成7天', type: 'edit' }],
        );
        break;
      case 12:
        simulateTyping(
          `🎉 **分仓备货计算完成！**\n\n📊 **全国物料总量**\n• 安溪铁观音：66,285 箱\n• 莲雾苹果汁：363,540 瓶\n• 东方美人：28,655 袋\n• 老盐糖浆：25,032 瓶\n• 冷冻生椰乳：138,345 瓶\n• 冷冻凤梨汁：128,712 瓶\n• 椰子水：174,996 瓶\n\n📋 预警汇总：全部通过 ✅\n⚠️ 异常统配门店：12家（已标记）\n\n📥 导出Excel包含 **5个Sheet**：\n• Sheet1: 门店明细\n• Sheet2: 仓库汇总\n• Sheet3: 供应商分配\n• Sheet4: 预警清单\n• Sheet5: SCM导入模板（货品编码/数量/计划号/备注/供应商编码/仓库编码/配送至编码/期望交货时间）\n\n可导出Excel或发送给相关人。`,
          [],
          [{ label: '📥 导出Excel', type: 'export' }, { label: '📤 发送给罗雄和王敏', type: 'notify' }, { label: '🔄 修改参数重跑', type: 'recalculate' }],
        );
        break;
    }
  };

  const handleUserInput = useCallback((text: string) => {
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`, role: 'user', content: text, timestamp: new Date(),
    }]);
    setInputText('');
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
          addBotMessage('请先在右侧选择一个新品。');
        } else {
          confirmStep(step);
        }
        break;
      }
      case 'next_step': {
        if (step < 12) {
          const next = (step + 1) as WizardStep;
          setStep(next);
          triggerStepMessage(next);
        } else {
          addBotMessage('已经是最后一步了。请确认备货方案或导出Excel。');
        }
        break;
      }
      case 'prev_step': {
        if (step > 0) { setStep((step - 1) as WizardStep); addBotMessage(`已返回 **${STEP_LABELS[step - 1]}**`); }
        break;
      }
      case 'export_excel': {
        addBotMessage(
          `📥 Excel 导出完成！\n\n文件名：**${productInfo.name}_分仓备货预测_${productInfo.launchDate}.xlsx**\n\n包含5个Sheet：\n• Sheet1: 门店明细（${productInfo.storeCount.toLocaleString()}门店 × ${materials.filter(m=>m.selected).length}物料 × W1-W4）\n• Sheet2: 仓库汇总（30+仓库）\n• Sheet3: 供应商分配\n• Sheet4: 预警清单\n• Sheet5: SCM导入模板（货品编码/数量/计划号/备注/供应商编码/仓库编码/配送至编码/期望交货时间）\n\n✅ 文件已保存到下载目录。\n✅ Sheet5可直接导入SCM系统。`,
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

  // Auto-trigger step 0 message on mount
  useEffect(() => { triggerStepMessage(0); }, []);

  const flooredCount = regions.filter(r => r.isFloored).length;

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
          <span>供应链计划员 · 罗雄</span>
          <div className="user-avatar">罗</div>
        </div>
      </header>

      {/* Wizard Progress - 13 steps (0-12) with T-30 divider */}
      <div className="wizard-progress" style={{ flexWrap: 'wrap', gap: 2 }}>
        {STEP_LABELS.map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {i === 10 && <div style={{ width: 2, height: 24, background: 'var(--warn)', margin: '0 6px', borderRadius: 2 }} title="T-30 统配出数" />}
            {i > 0 && i !== 10 && <div className={`wizard-connector ${i < step ? 'completed' : ''}`} />}
            <div
              className={`wizard-step ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}
              onClick={() => { if (i <= step) setStep(i as WizardStep); }}
              style={{ fontSize: 11, padding: '4px 6px' }}
            >
              <span className="step-num" style={{ fontSize: 10 }}>{i < step ? '✓' : i}</span>
              <span style={{ fontSize: 10 }}>{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Left: Chat Panel */}
        <div className="chat-panel">
          <div className="chat-header">
            <div className="chat-header-left">
              <span className="chat-header-title">🤖 AI CEO 助手</span>
              <span className="chat-header-status"><span className="status-dot" />在线</span>
            </div>
            <span className="chat-header-sub">{step === 0 ? '选择新品' : `Step ${step}/12`}</span>
          </div>
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty-state">
                <div className="empty-skill-icon">{activeSkill.icon}</div>
                <h3 className="empty-title">{activeSkill.name}</h3>
                <p className="empty-desc">{activeSkill.desc}</p>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`chat-msg ${msg.role}`}>
                {msg.role === 'assistant' ? (
                  <div className="chat-avatar bot-avatar-icon">🤖</div>
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
                  {msg.confirmActions && msg.confirmActions.length > 0 && (
                    <div className="confirm-actions">
                      {msg.confirmActions.map((action, i) => (
                        <button
                          key={i}
                          className={`confirm-btn confirm-btn-${action.type}`}
                          onClick={() => {
                            if (action.type === 'confirm') confirmStep(step);
                            else if (action.type === 'export') handleUserInput('导出Excel');
                            else if (action.type === 'recalculate') addBotMessage('🔄 正在使用新参数重新计算 Step 4-7...');
                            else if (action.type === 'notify') addBotMessage('📤 已发送飞书通知给罗雄和王敏 ✅');
                            else if (action.type === 'skip') { addBotMessage('⏭️ 已跳过，继续下一步。'); confirmStep(step); }
                            else if (action.type === 'edit') addBotMessage(`✏️ 请在右侧面板中修改对应值，修改后点击"确认"继续。`);
                          }}
                          disabled={isTyping}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {msg.role === 'assistant' && msg.content && (
                    <div className="msg-feedback">
                      <span className="feedback-label">有帮助吗？</span>
                      <button className="feedback-btn" onClick={() => {}}>👍</button>
                      <button className="feedback-btn" onClick={() => {}}>👎</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="chat-msg assistant">
                <div className="chat-avatar bot-avatar-icon">🤖</div>
                <div className="chat-bubble typing-indicator">
                  <span className="dot-typing" /><span className="dot-typing" /><span className="dot-typing" />
                  <span className="typing-text">AI分析中...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
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
              <button className={`send-btn-inside ${inputText.trim() ? 'active' : ''}`} onClick={sendMessage} disabled={isTyping || !inputText.trim()}>➤</button>
            </div>
            <div className="skill-tabs-below">
              {SKILLS.map(skill => (
                <button key={skill.id} className={`skill-tab ${activeSkill.id === skill.id ? 'active' : ''}`}
                  onClick={() => { setActiveSkill(skill); if (skill.id !== 'newproduct') addBotMessage(`已切换到「${skill.name}」技能。（Demo开发中）`); }}>
                  <span>{skill.icon}</span><span>{skill.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Step Content */}
        <div className="right-panel">
          {step === 0 && <Step0ProductSelect selectedProduct={selectedProduct} onSelect={selectProduct} />}
          {step === 1 && <Step1ProductInfo productInfo={productInfo} materials={materials} />}
          {step === 2 && <Step2Materials materials={materials} setMaterials={setMaterials} />}
          {step === 3 && <Step3RegionCoefficients regions={regions} setRegions={setRegions} flooredCount={flooredCount} />}
          {step === 4 && <Step4StoreForecast productInfo={productInfo} />}
          {step === 5 && <Step5MaterialCalc materials={materials.filter(m => m.selected)} />}
          {step === 6 && <Step6Warehouse />}
          {step === 7 && <Step7Supplier />}
          {step === 8 && <Step8Warning />}
          {step === 9 && <Step9MOQWarning />}
          {step === 10 && <Step10UnifiedDist />}
          {step === 11 && <Step11SafetyStock />}
          {step === 12 && <Step12Output productInfo={productInfo} confirmed={confirmed} setConfirmed={setConfirmed} />}
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
      return <pre key={i} style={{ background: 'var(--pine-dark)', color: '#e0e0e0', padding: 12, borderRadius: 8, fontSize: 11, fontFamily: '"IBM Plex Mono", monospace', overflowX: 'auto', margin: '8px 0', whiteSpace: 'pre-wrap' }}>{part.code}</pre>;
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

// ===== Step 0: 新品选择 =====
function Step0ProductSelect({ selectedProduct, onSelect }: { selectedProduct: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 0</span>选择新品</div>
      <div className="card">
        <div className="card-title"><span className="dot dot-jade" />📋 上新周期内的新品（前后2个月）</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
          系统自动筛选上市日期在当前日期前后2个月范围内的新品，超期自动剔除。
        </p>
        <div className="product-select-list">
          {newProductList.map(p => (
            <div
              key={p.id}
              className={`product-select-card ${selectedProduct === p.id ? 'selected' : ''}`}
              onClick={() => onSelect(p.id)}
            >
              <div className="product-select-header">
                <span className="product-select-name">{p.name}</span>
                <span className={`product-select-status status-${p.status === '进行中' ? 'active' : 'planned'}`}>{p.status}</span>
              </div>
              <div className="product-select-meta">
                <span>📅 {p.launchDate}</span>
                <span>🏷️ {p.productLevel}</span>
                <span>🌍 {p.scope}</span>
              </div>
              <div className="product-select-stage">{p.stage}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ background: 'rgba(20,60,54,0.03)' }}>
        <div className="card-title" style={{ fontSize: 12, color: 'var(--muted)' }}>💡 说明</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
          • 通常每2周有1个新品上市，同时有3~4个新品在不同阶段<br />
          • 点击选择后，系统将自动从飞书多维表格读取该新品的信息<br />
          • 已超期的新品不会出现在列表中
        </p>
      </div>
    </div>
  );
}

// ===== Step 1: 新品信息读取（修正版） =====
function Step1ProductInfo({ productInfo, materials }: { productInfo: NewProductInfo; materials: BOMMaterial[] }) {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 1</span>新品信息读取</div>

      {/* 飞书多维表格：新品BOM（1张扁平表） */}
      <div className="card">
        <div className="card-title"><span className="dot dot-jade" />📋 新品BOM（飞书多维表格）</div>
        <div className="data-source-tag">数据来源：飞书多维表格「新品BOM」表（向磊模板）</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
          新品名称：<strong>{productInfo.name}</strong> ｜ 上新日：<strong>{productInfo.launchDate}</strong> ｜ 共 <strong>{materials.length}</strong> 种原材料
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>原材料名称</th>
                <th>原材料编码</th>
                <th>规格型号</th>
                <th>单位</th>
                <th className="num">单位用量</th>
                <th>用量单位</th>
                <th className="num">开封效期</th>
                <th className="num">备货系数</th>
                <th className="num">W1杯占</th>
                <th className="num">W2杯占</th>
                <th className="num">W3杯占</th>
                <th className="num">W4杯占</th>
              </tr>
            </thead>
            <tbody>
              {materials.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.materialName}</td>
                  <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{m.materialCode || <span style={{ color: 'var(--warn)' }}>⚠️空</span>}</td>
                  <td style={{ fontSize: 11 }}>{m.spec}</td>
                  <td>{m.unit}</td>
                  <td className="num">{m.unitUsage}</td>
                  <td>{m.usageUnit}</td>
                  <td className="num">{m.shelfLifeDays}天</td>
                  <td className="num">{m.stockCoefficient}</td>
                  <td className="num">{m.cupRatioW1}</td>
                  <td className="num">{m.cupRatioW2}</td>
                  <td className="num">{m.cupRatioW3}</td>
                  <td className="num">{m.cupRatioW4}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
          💡 W1-W4杯占在每行冗余存储，实际值相同（成品维度）。W1-W4之和 = {(materials[0]?.cupRatioW1 + materials[0]?.cupRatioW2 + materials[0]?.cupRatioW3 + materials[0]?.cupRatioW4).toFixed(4)}（&lt;1，正常）
        </p>
      </div>

      {/* 系统自动获取 */}
      <div className="card" style={{ background: 'rgba(79,168,224,0.06)', borderColor: 'var(--accent-bright)' }}>
        <div className="card-title" style={{ fontSize: 12, color: 'var(--accent-bright)' }}>📊 系统自动获取（非表格读取）</div>
        <div className="info-grid">
          <div className="info-item"><span className="info-label">在营门店数</span><span className="info-value highlight">{productInfo.storeCount.toLocaleString()} 家</span></div>
          <div className="info-item"><span className="info-label">大盘预测首周日均</span><span className="info-value highlight">{productInfo.firstWeekDailyCups} 杯</span></div>
          <div className="info-item"><span className="info-label">大盘预测首月日均</span><span className="info-value highlight">{productInfo.firstMonthDailyCups} 杯</span></div>
          <div className="info-item"><span className="info-label">全国5月总销量</span><span className="info-value">{productInfo.totalSalesMay.toLocaleString()} 杯</span></div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
          • 门店数：成品销售报表，滚动30天在营门店<br />
          • 大盘数据：上游预测系统<br />
          • 全国销量：成品销售报表
        </p>
      </div>

      {/* 数据校验 */}
      <div className="card" style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'var(--warn)' }}>
        <div className="card-title" style={{ fontSize: 12, color: 'var(--warn)' }}>⚠️ 数据一致性校验</div>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          首月日均({productInfo.firstMonthDailyCups}) ≥ 首周日均({productInfo.firstWeekDailyCups}) ✅<br />
          W1-W4杯占之和 = {(productInfo.cupRatioW1 + productInfo.cupRatioW2 + productInfo.cupRatioW3 + productInfo.cupRatioW4).toFixed(4)}（&lt;1，正常范围）✅<br />
          {materials.some(m => !m.materialCode) && <span style={{ color: 'var(--warn)' }}>⚠️ {materials.filter(m => !m.materialCode).length}个物料编码为空</span>}
        </p>
      </div>
    </div>
  );
}

// ===== Step 2: 核心物料确认（非筛选） =====
function Step2Materials({ materials, setMaterials }: { materials: BOMMaterial[]; setMaterials: (m: BOMMaterial[]) => void }) {
  const toggleMaterial = (id: string) => setMaterials(materials.map(m => m.id === id ? { ...m, selected: !m.selected } : m));
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 2</span>核心物料确认</div>
      <div className="card">
        <div className="card-title"><span className="dot dot-amber" />📦 核心物料清单</div>
        <div className="data-source-tag">数据来源：飞书多维表格「新品BOM」表（已由罗雄预选）</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
          以下物料已在多维表格中预选为核心物料。如需排除非关键物料，可取消勾选。
        </p>
        <table className="data-table">
          <thead><tr><th style={{ width: 40 }}>选择</th><th>原材料名称</th><th>原材料编码</th><th>规格型号</th><th>单位</th><th className="num">单位用量</th><th className="num">备货系数</th><th className="num">开封效期</th></tr></thead>
          <tbody>
            {materials.map(m => (
              <tr key={m.id} onClick={() => toggleMaterial(m.id)} style={{ cursor: 'pointer', opacity: m.selected ? 1 : 0.5 }}>
                <td><input type="checkbox" checked={m.selected} onChange={() => toggleMaterial(m.id)} /></td>
                <td style={{ fontWeight: 600 }}>{m.materialName}</td>
                <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{m.materialCode || <span style={{ color: 'var(--warn)' }}>⚠️空</span>}</td>
                <td style={{ fontSize: 11 }}>{m.spec}</td>
                <td>{m.unit}</td>
                <td className="num">{m.unitUsage}{m.usageUnit}</td>
                <td className="num">{m.stockCoefficient}</td>
                <td className="num">{m.shelfLifeDays}天</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
        已确认 <strong style={{ color: 'var(--pine)' }}>{materials.filter(m => m.selected).length}</strong> / {materials.length} 种核心物料
      </div>
      {materials.some(m => !m.materialCode) && (
        <div className="card" style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'var(--warn)', marginTop: 8 }}>
          <p style={{ fontSize: 12, color: 'var(--warn)' }}>⚠️ {materials.filter(m => !m.materialCode).map(m => m.materialName).join('、')} 物料编码为空（新品建档未完成），后续统配比对可能无法精确匹配。建议补充后继续。</p>
        </div>
      )}
    </div>
  );
}

// ===== Step 3-12: 保持不变 =====

function Step3RegionCoefficients({ regions, setRegions, flooredCount }: { regions: RegionCoefficient[]; setRegions: (r: RegionCoefficient[]) => void; flooredCount: number }) {
  const [selectedHistory, setSelectedHistory] = useState<Set<string>>(new Set(historicalProducts));
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);

  const updateCoeff = (idx: number, val: string) => {
    const v = parseFloat(val);
    if (isNaN(v) || v < 0) return;
    setRegions(regions.map((r, i) => i === idx ? { ...r, coefficient: v, isFloored: v <= 1.0 } : r));
  };

  const toggleHistoryProduct = (name: string) => {
    setSelectedHistory(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => setSelectedHistory(new Set(historicalProducts));
  const selectAIRecommended = () => {
    const recommended = historicalProductsDetail.filter(p => p.similarity >= 0.80).map(p => p.name);
    setSelectedHistory(new Set(recommended));
  };

  const selectedCount = selectedHistory.size;
  const totalCount = historicalProducts.length;

  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 3</span>区域系数计算</div>

      {/* 历史品选择区 */}
      <div className="card">
        <div className="card-title"><span className="dot dot-sky" />📊 参考历史新品选择</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            已选择 <span style={{ color: 'var(--pine)' }}>{selectedCount}</span> / {totalCount} 个历史品
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="confirm-btn confirm-btn-confirm" style={{ fontSize: 11, padding: '4px 10px' }} onClick={selectAll}>全选</button>
            <button className="confirm-btn confirm-btn-edit" style={{ fontSize: 11, padding: '4px 10px' }} onClick={selectAIRecommended}>🤖 AI推荐（{historicalProductsDetail.filter(p => p.similarity >= 0.80).length}个）</button>
            <button className="confirm-btn" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setShowHistoryPicker(!showHistoryPicker)}>
              {showHistoryPicker ? '收起' : '展开选择'}
            </button>
          </div>
        </div>

        {/* AI建议卡片 */}
        <div style={{ background: 'rgba(79,168,224,0.06)', border: '1px solid var(--accent-bright)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>🤖 AI选择建议</div>
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8, margin: 0 }}>
            当前新品「铁观音莲雾苹果」属于<strong>特调茶+果茶</strong>品类。<br />
            <strong>推荐选择相似度≥80%的{historicalProductsDetail.filter(p => p.similarity >= 0.80).length}个历史品</strong>作为参考，排除轻因系列（品类差异大、区域表现不具参考性）。<br />
            默认使用全部{totalCount}个历史品均值，选择子集可使区域系数更精准。
          </p>
        </div>

        {/* 历史品选择器 */}
        {showHistoryPicker && (
          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border-main)', borderRadius: 8, padding: 8 }}>
            <table className="data-table">
              <thead><tr><th style={{ width: 40 }}>选择</th><th>品名</th><th>品类</th><th>上市日期</th><th className="num">相似度</th></tr></thead>
              <tbody>
                {historicalProductsDetail.map((p, i) => (
                  <tr key={i} onClick={() => toggleHistoryProduct(p.name)} style={{ cursor: 'pointer', opacity: selectedHistory.has(p.name) ? 1 : 0.4 }}>
                    <td><input type="checkbox" checked={selectedHistory.has(p.name)} onChange={() => toggleHistoryProduct(p.name)} /></td>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{p.name}</td>
                    <td style={{ fontSize: 11 }}>{p.category}</td>
                    <td style={{ fontSize: 11 }}>{p.launchDate}</td>
                    <td className="num">
                      <span style={{
                        color: p.similarity >= 0.80 ? 'var(--jade)' : p.similarity >= 0.70 ? 'var(--warn)' : 'var(--muted)',
                        fontWeight: 600,
                      }}>{(p.similarity * 100).toFixed(0)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 未展开时的摘要 */}
        {!showHistoryPicker && (
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>
            {Array.from(selectedHistory).slice(0, 8).join('、')}{selectedCount > 8 ? `...等${selectedCount}个品` : ''}
          </div>
        )}
      </div>

      {/* 区域系数结果 */}
      <div className="card">
        <div className="card-title"><span className="dot dot-jade" />区域系数结果（24个子公司）</div>
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 12 }}>
          <div className="kpi-card"><div className="kpi-label">参考历史品数</div><div className="kpi-value" style={{ color: 'var(--accent)' }}>{selectedCount}</div></div>
          <div className="kpi-card"><div className="kpi-label">兜底为1.0</div><div className="kpi-value" style={{ color: 'var(--warn)' }}>{flooredCount}</div></div>
          <div className="kpi-card"><div className="kpi-label">最高系数</div><div className="kpi-value">{Math.max(...regions.map(r => r.coefficient)).toFixed(3)}</div></div>
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>子公司</th><th className="num">原始均值</th><th className="num">最终系数</th><th>状态</th></tr></thead>
            <tbody>
              {regions.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>{r.subsidiary}</td>
                  <td className="num" style={{ color: 'var(--muted)' }}>{r.rawValue.toFixed(3)}</td>
                  <td className="num">
                    <input type="number" step="0.001" min="0" value={r.coefficient.toFixed(3)}
                      onChange={e => updateCoeff(i, e.target.value)}
                      style={{ width: 60, textAlign: 'right', fontWeight: 700, color: r.coefficient > 1 ? 'var(--pine)' : 'var(--warn)', border: '1px solid var(--border-main)', borderRadius: 4, padding: '2px 4px', fontSize: 12 }}
                    />
                  </td>
                  <td>{r.isFloored ? <span style={{ fontSize: 10, color: 'var(--warn)', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: 4 }}>兜底</span> : <span style={{ fontSize: 10, color: 'var(--jade)' }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Step4StoreForecast({ productInfo }: { productInfo: NewProductInfo }) {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 4</span>门店级杯量预测</div>
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">参与计算门店</div><div className="kpi-value">{productInfo.storeCount.toLocaleString()}<span className="kpi-unit">家</span></div></div>
        <div className="kpi-card"><div className="kpi-label">触发下限保护</div><div className="kpi-value" style={{ color: 'var(--warn)' }}>~200<span className="kpi-unit">家</span></div></div>
        <div className="kpi-card"><div className="kpi-label">全国首周日均</div><div className="kpi-value">{(productInfo.firstWeekDailyCups * productInfo.storeCount).toLocaleString()}<span className="kpi-unit">杯</span></div></div>
        <div className="kpi-card"><div className="kpi-label">全国月日均</div><div className="kpi-value">{(productInfo.firstMonthDailyCups * productInfo.storeCount).toLocaleString()}<span className="kpi-unit">杯</span></div></div>
      </div>
      <div className="card">
        <div className="card-title"><span className="dot dot-violet" />🏪 代表性门店预测明细</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>门店编码</th><th>门店名称</th><th className="num">5月销量</th><th className="num">占比</th><th className="num">首周日均</th><th className="num">月日均</th><th className="num">区域系数</th></tr></thead>
            <tbody>
              {mockStoreSamples.map((s, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{s.storeId}</td>
                  <td style={{ fontWeight: 600, fontSize: 11 }}>{s.storeName}</td>
                  <td className="num">{s.maySales.toLocaleString()}</td>
                  <td className="num">{(s.salesRatio * 100).toFixed(4)}%</td>
                  <td className="num">{s.firstWeekDaily.toFixed(2)}</td>
                  <td className="num">{s.monthDaily.toFixed(2)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{s.regionCoeff.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* 门店调整系数说明 - 二期功能 */}
      <div className="card" style={{ background: 'rgba(156,163,175,0.06)', borderColor: 'var(--border-main)' }}>
        <div className="card-title" style={{ fontSize: 12, color: 'var(--muted)' }}>🔒 门店数修改（二期功能）</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
          一期通过<strong>区域系数</strong>（Step 3）按子公司维度调整备货量。<br />
          门店数手动修改及门店调整系数功能将在二期实现。
        </p>
      </div>
      <div className="card" style={{ background: 'rgba(20,60,54,0.03)' }}>
        <div className="card-title" style={{ fontSize: 12, color: 'var(--muted)' }}>🧮 计算公式</div>
        <pre style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--muted)', margin: 0 }}>
{`门店占比 = 门店5月销量 ÷ 全国5月总销量(${productInfo.totalSalesMay.toLocaleString()})
首周日均 = 大盘首周(${productInfo.firstWeekDailyCups}) × 门店占比 × 门店数(${productInfo.storeCount.toLocaleString()})
月日均 = 大盘首月(${productInfo.firstMonthDailyCups}) × 门店占比 × 门店数(${productInfo.storeCount.toLocaleString()})
下限保护：if 日均 < 10杯 → 取大盘均值`}
        </pre>
      </div>
    </div>
  );
}

function Step5MaterialCalc({ materials: _materials }: { materials: BOMMaterial[] }) {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 5</span>物料量计算</div>
      <div className="card">
        <div className="card-title"><span className="dot dot-jade" />核心公式</div>
        <pre style={{ background: 'var(--pine-dark)', color: '#e0e0e0', padding: 14, borderRadius: 10, fontSize: 11, fontFamily: '"IBM Plex Mono", monospace', overflowX: 'auto' }}>
{`W1物料量 = 首周日均杯量 × 区域系数 × W1占比 × 7 ÷ 应用率W1 × 备货系数
W2-W4物料量 = 月日均杯量 × 区域系数 × Wn占比 × 7 ÷ 应用率Wn × 备货系数
预测总量 = Roundup(W1 + W2 + W3 + W4)  ← 向上取整`}
        </pre>
      </div>
      <div className="card">
        <div className="card-title"><span className="dot dot-amber" />🧮 计算示例：门店1101010005 × 莲雾苹果汁</div>
        <pre style={{ background: 'var(--pine-dark)', color: '#e0e0e0', padding: 14, borderRadius: 10, fontSize: 11, fontFamily: '"IBM Plex Mono", monospace', overflowX: 'auto' }}>
{`参数：首周日均=1077.92, 月日均=1150.49, 区域系数=1.2, 备货系数=1.0
      应用率=11.41, W1=0.05, W2=0.035, W3=0.0224, W4=0.012544

W1 = 1077.92 × 1.2 × 0.05 × 7 ÷ 11.41 × 1.0 = 39.67
W2 = 1150.49 × 1.2 × 0.035 × 7 ÷ 11.41 × 1.0 = 29.64
W3 = 1150.49 × 1.2 × 0.0224 × 7 ÷ 11.41 × 1.0 = 18.97
W4 = 1150.49 × 1.2 × 0.012544 × 7 ÷ 11.41 × 1.0 = 10.62

预测总量 = Roundup(98.90) = 99 ✅

效期校验：开封效期7天 → 周最小量=round(7÷7)=1
W1=39.67>1 ✓  W2=29.64>1 ✓  W3=18.97>1 ✓  W4=10.62>1 ✓`}
        </pre>
      </div>
      <div className="card">
        <div className="card-title"><span className="dot dot-sky" />📊 全国物料汇总</div>
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

function Step6Warehouse() {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 6</span>汇总到仓</div>
      <div className="card">
        <div className="card-title"><span className="dot dot-jade" />🏭 北京二级仓 汇总</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>仓店映射来源：Sheet2（9,708条）</p>
        <table className="data-table">
          <thead><tr><th>物料</th><th className="num">统配量</th><th className="num">统配外备货量</th><th className="num">合计</th><th className="num">下单量</th></tr></thead>
          <tbody>
            {warehouseSummarySample.materials.map((m, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td className="num">{m.allocationQty.toLocaleString()}</td>
                <td className="num" style={{ fontWeight: 700 }}>{m.extraStock.toLocaleString()}</td>
                <td className="num">{m.total.toLocaleString()}</td>
                <td className="num" style={{ fontWeight: 700, color: 'var(--pine)' }}>{m.orderQty.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Step7Supplier() {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 7</span>供应商分配 + MOQ换算</div>
      <div className="card">
        <div className="card-title"><span className="dot dot-amber" />📦 供应商信息输入</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>请输入各物料的供应商份额和MOQ（不输入则默认1供应商、MOQ=1）</p>
        <table className="data-table">
          <thead><tr><th>物料</th><th>供应商名称</th><th className="num">份额%</th><th className="num">MOQ</th></tr></thead>
          <tbody>
            {['莲雾苹果汁', '安溪铁观音', '老盐糖浆', '冷冻生椰乳'].map((m, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{m}</td>
                <td><input className="form-input" placeholder="供应商名称" style={{ fontSize: 11, padding: '4px 8px' }} /></td>
                <td><input className="form-input" type="number" placeholder="40" style={{ width: 60, fontSize: 11, padding: '4px 8px', textAlign: 'right' }} /></td>
                <td><input className="form-input" type="number" placeholder="100" style={{ width: 60, fontSize: 11, padding: '4px 8px', textAlign: 'right' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-title"><span className="dot dot-sky" />🧮 MOQ换算示例</div>
        <pre style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--muted)', margin: 0 }}>
{`莲雾苹果汁 @ 北京二级仓：
  需求量 = 13,399 瓶
  供应商A(40%) → 5,359.6 → MOQ=500 → 下单5,500
  供应商B(35%) → 4,689.7 → MOQ=300 → 下单4,800
  供应商C(25%) → 3,349.8 → MOQ=200 → 下单3,400
  MOQ取整后合计 = 13,700（放大2.2%）`}
        </pre>
      </div>
    </div>
  );
}

function Step8Warning() {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 8</span>备货预警（第一道）</div>
      <div className="card" style={{ borderColor: 'var(--jade)', background: 'rgba(66,161,112,0.04)' }}>
        <div className="card-title" style={{ color: 'var(--jade)' }}>✅ 备货预警 — 未触发</div>
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="kpi-card"><div className="kpi-label">偏差率</div><div className="kpi-value" style={{ color: 'var(--jade)' }}>8.6%</div></div>
          <div className="kpi-card"><div className="kpi-label">阈值</div><div className="kpi-value">10%</div></div>
          <div className="kpi-card"><div className="kpi-label">状态</div><div className="kpi-value" style={{ color: 'var(--jade)', fontSize: 16 }}>✅ 通过</div></div>
        </div>
      </div>
      <div className="card">
        <div className="card-title"><span className="dot dot-amber" />🔧 可调参数（仅2个）</div>
        <div className="info-grid">
          <div className="info-item"><span className="info-label">区域系数</span><span className="info-value editable">分公司维度 <span className="edit-hint">可修改</span></span></div>
          <div className="info-item"><span className="info-label">备货系数</span><span className="info-value editable">全局 <span className="edit-hint">可修改</span></span></div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
          调参优先级：① 优先调区域系数（挑高的往下调）→ ② 其次调备货系数
        </p>
      </div>
    </div>
  );
}

function Step9MOQWarning() {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 9</span>MOQ取整预警（第二道）</div>
      <div className="card" style={{ borderColor: 'var(--jade)', background: 'rgba(66,161,112,0.04)' }}>
        <div className="card-title" style={{ color: 'var(--jade)' }}>✅ MOQ取整预警 — 未触发</div>
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="kpi-card"><div className="kpi-label">偏差率</div><div className="kpi-value" style={{ color: 'var(--jade)' }}>0.055%</div></div>
          <div className="kpi-card"><div className="kpi-label">阈值</div><div className="kpi-value">5%</div></div>
          <div className="kpi-card"><div className="kpi-label">状态</div><div className="kpi-value" style={{ color: 'var(--jade)', fontSize: 16 }}>✅ 通过</div></div>
        </div>
      </div>
    </div>
  );
}

function Step10UnifiedDist() {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 10</span>统配比对</div>
      <div className="card" style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'var(--warn)' }}>
        <div className="card-title" style={{ color: 'var(--warn)' }}>⏰ T-30 统配数据已到</div>
      </div>
      <div className="card">
        <div className="card-title"><span className="dot dot-jade" />📊 统配比对 — 门店1101010005</div>
        <table className="data-table">
          <thead><tr><th>物料</th><th className="num">预测总量</th><th className="num">统配量</th><th className="num">统配外</th><th className="num">合计</th><th>状态</th></tr></thead>
          <tbody>
            <tr><td style={{ fontWeight: 600 }}>安溪铁观音</td><td className="num">16</td><td className="num">6</td><td className="num">10</td><td className="num" style={{ fontWeight: 700 }}>16</td><td><span style={{ color: 'var(--jade)' }}>✅</span></td></tr>
            <tr><td style={{ fontWeight: 600 }}>莲雾苹果汁</td><td className="num">99</td><td className="num">35</td><td className="num">64</td><td className="num" style={{ fontWeight: 700 }}>99</td><td><span style={{ color: 'var(--jade)' }}>✅</span></td></tr>
            <tr><td style={{ fontWeight: 600 }}>老盐糖浆</td><td className="num">6</td><td className="num">3</td><td className="num">3</td><td className="num" style={{ fontWeight: 700 }}>6</td><td><span style={{ color: 'var(--jade)' }}>✅</span></td></tr>
            <tr><td style={{ fontWeight: 600 }}>冷冻生椰乳</td><td className="num">32</td><td className="num">12</td><td className="num">20</td><td className="num" style={{ fontWeight: 700 }}>32</td><td><span style={{ color: 'var(--jade)' }}>✅</span></td></tr>
          </tbody>
        </table>
      </div>
      <div className="card" style={{ background: 'rgba(220,38,38,0.04)', borderColor: 'var(--danger)' }}>
        <div className="card-title" style={{ color: 'var(--danger)', fontSize: 12 }}>⚠️ 异常统配门店</div>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>发现 <strong style={{ color: 'var(--danger)' }}>12</strong> 家门店统配量超过四周预测量，建议与门店沟通。</p>
      </div>
    </div>
  );
}

function Step11SafetyStock() {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 11</span>安全库存校验</div>
      <div className="card">
        <div className="card-title"><span className="dot dot-jade" />📊 安全库存校验 — 北京二级仓</div>
        <table className="data-table">
          <thead><tr><th>物料</th><th className="num">统配外</th><th className="num">日均消耗</th><th className="num">可销售天数</th><th>状态</th></tr></thead>
          <tbody>
            <tr><td style={{ fontWeight: 600 }}>安溪铁观音</td><td className="num">1,539</td><td className="num">76.0</td><td className="num" style={{ fontWeight: 700, color: 'var(--jade)' }}>20.3天</td><td><span style={{ color: 'var(--jade)' }}>✅</span></td></tr>
            <tr><td style={{ fontWeight: 600 }}>莲雾苹果汁</td><td className="num">8,245</td><td className="num">478.4</td><td className="num" style={{ fontWeight: 700, color: 'var(--jade)' }}>17.2天</td><td><span style={{ color: 'var(--jade)' }}>✅</span></td></tr>
            <tr><td style={{ fontWeight: 600 }}>老盐糖浆</td><td className="num">414</td><td className="num">32.5</td><td className="num" style={{ fontWeight: 700, color: 'var(--jade)' }}>12.7天</td><td><span style={{ color: 'var(--jade)' }}>✅</span></td></tr>
            <tr><td style={{ fontWeight: 600 }}>冷冻生椰乳</td><td className="num">2,035</td><td className="num">172.4</td><td className="num" style={{ fontWeight: 700, color: 'var(--jade)' }}>11.8天</td><td><span style={{ color: 'var(--jade)' }}>✅</span></td></tr>
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-title"><span className="dot dot-sky" />🔍 最终校验</div>
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="kpi-card"><div className="kpi-label">最终偏差</div><div className="kpi-value" style={{ color: 'var(--jade)' }}>2.1%</div></div>
          <div className="kpi-card"><div className="kpi-label">阈值</div><div className="kpi-value">5%</div></div>
          <div className="kpi-card"><div className="kpi-label">下单量vs大盘</div><div className="kpi-value" style={{ color: 'var(--jade)' }}>103.2%</div></div>
        </div>
      </div>
    </div>
  );
}

function Step12Output({ productInfo, confirmed, setConfirmed: _setConfirmed }: { productInfo: NewProductInfo; confirmed: boolean; setConfirmed: (b: boolean) => void }) {
  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 12</span>结果输出</div>
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">新品</div><div className="kpi-value" style={{ fontSize: 16 }}>{productInfo.name}</div></div>
        <div className="kpi-card"><div className="kpi-label">门店数</div><div className="kpi-value">{productInfo.storeCount.toLocaleString()}</div></div>
        <div className="kpi-card"><div className="kpi-label">物料数</div><div className="kpi-value">7</div></div>
        <div className="kpi-card"><div className="kpi-label">预警</div><div className="kpi-value" style={{ color: 'var(--jade)' }}>全部通过</div></div>
      </div>
      <div className="card">
        <div className="card-title"><span className="dot dot-jade" />📊 全国物料最终方案</div>
        <table className="data-table">
          <thead><tr><th>物料</th><th className="num">预测量</th><th className="num">统配量</th><th className="num">统配外</th><th className="num">下单量</th></tr></thead>
          <tbody>
            {nationalMaterialSummary.map((m, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td className="num">{m.forecastQty.toLocaleString()}</td>
                <td className="num">{m.allocationQty.toLocaleString()}</td>
                <td className="num">{m.extraStock.toLocaleString()}</td>
                <td className="num" style={{ fontWeight: 700, color: 'var(--pine)' }}>{m.orderQty.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-title"><span className="dot dot-amber" />📋 预警汇总</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, background: 'rgba(66,161,112,0.1)', color: 'var(--jade)' }}>✅ 备货预警 8.6%</span>
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, background: 'rgba(66,161,112,0.1)', color: 'var(--jade)' }}>✅ MOQ取整 0.055%</span>
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, background: 'rgba(66,161,112,0.1)', color: 'var(--jade)' }}>✅ 安全库存 全部&gt;5天</span>
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: 'var(--warn)' }}>⚠️ 异常统配 12家</span>
        </div>
      </div>
      {confirmed && (
        <div className="card" style={{ background: 'rgba(66,161,112,0.08)', borderColor: 'var(--jade)' }}>
          <div className="card-title" style={{ color: 'var(--jade)' }}>✅ 方案已确认并导出</div>
          <p style={{ fontSize: 12 }}>文件名：{productInfo.name}_分仓备货预测_{productInfo.launchDate}.xlsx</p>
        </div>
      )}
    </div>
  );
}

export default App;
