import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './styles.css';
import type { ChatMessage, NewProductInfo, BOMMaterial, RegionCoefficient, ConfirmAction } from './types';
import { mockProduct, mockMaterials, mockRegionCoefficients, historicalProducts, historicalProductsDetail, mockStoreSamples, nationalMaterialSummary, newProductList, mockBOMRecordsProduct2, mockSystemDataProduct2, mockWarehouseDistributionCompare, allWarehouseSummary } from './data/mock';
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

// 参数调整解析器 — 返回 targetStep 用于自动定位
function parseParameterAdjustment(text: string): { response: string; thinking: string[]; targetStep: Step } | null {
  const lower = text.toLowerCase();

  // 区域系数调整 → Step 2
  const regionMatch = text.match(/(?:调整|修改|设置)\s*区域系数\s*(\S+)\s+([\d.]+)/);
  if (regionMatch) {
    const [, subsidiary, value] = regionMatch;
    return {
      response: `✅ 已调整区域系数\n\n• **${subsidiary}**：→ **${value}**\n\n**已重新计算** ✅ 右侧面板已跳转到 Step 2，请确认重算结果。\n\n💡 你还可以继续调整：\n• "调整区域系数 广东 1.05"\n• "调整备货系数 莲雾苹果汁 1.2"\n• "调整W1占比 0.06"\n• "安全库存改成7天"`,
      thinking: [`修改区域系数：${subsidiary} → ${value}`, `自动定位到 Step 2 系数修正`, `已使用新系数重新计算物料量`],
      targetStep: 2,
    };
  }

  // 备货系数调整 → Step 2
  const stockMatch = text.match(/(?:调整|修改|设置)\s*备货系数\s*(\S+)\s+([\d.]+)/);
  if (stockMatch) {
    const [, material, value] = stockMatch;
    return {
      response: `✅ 已调整备货系数\n\n• **${material}**：→ **${value}**\n\n**已重新计算** ✅ 右侧面板已跳转到 Step 2，请确认重算结果。\n\n💡 你还可以继续调整其他参数。`,
      thinking: [`修改备货系数：${material} → ${value}`, `自动定位到 Step 2 BOM拆解`, `已使用新备货系数重新计算物料量`],
      targetStep: 2,
    };
  }

  // W1-W4占比调整 → Step 2
  const wMatch = text.match(/(?:调整|修改|设置)\s*(W[1-4])\s*占比\s+([\d.]+)/);
  if (wMatch) {
    const [, week, value] = wMatch;
    return {
      response: `✅ 已调整${week}占比\n\n• **${week}**：→ **${value}**\n\n⚠️ W1-W4为成品维度参数，修改后所有物料同步生效。\n\n**已重新计算** ✅ 右侧面板已跳转到 Step 2，请确认重算结果。`,
      thinking: [`修改${week}占比 → ${value}（成品维度，全物料生效）`, `自动定位到 Step 2 物料量计算`, `已重新计算所有物料 W1-W4 用量`],
      targetStep: 2,
    };
  }

  // 安全库存天数调整 → Step 3
  const safetyMatch = text.match(/(?:安全库存|安库)\s*(?:改成|调整为|设置为?)\s*(\d+)\s*天?/);
  if (safetyMatch) {
    const [, days] = safetyMatch;
    return {
      response: `✅ 已调整安全库存天数\n\n• 安全库存：5天 → **${days}天**\n\n**已重新计算** ✅ 右侧面板已跳转到 Step 3，请确认重算结果。`,
      thinking: [`修改安全库存天数：5天 → ${days}天`, `自动定位到 Step 3 预警检查`, `已重新校验所有仓库安全库存`],
      targetStep: 3,
    };
  }

  // 供应商设置 → Step 3
  const supplierMatch = text.match(/(?:设置|调整)\s*供应商\s+(\S+)\s+(\S+)\s+(\d+)%?\s*(?:MOQ\s*)?(\d+)?/i);
  if (supplierMatch) {
    const [, material, supplier, share, moq] = supplierMatch;
    return {
      response: `✅ 已设置供应商信息\n\n• **${material}**\n  - 供应商：${supplier}\n  - 份额：${share}%\n  - MOQ：${moq || '1（默认）'}\n\n💡 份额之和必须=100%，可继续添加其他供应商。\n\n**已重新计算** ✅ 右侧面板已跳转到 Step 3，请确认重算结果。`,
      thinking: [`设置供应商：${material} → ${supplier} ${share}% MOQ=${moq || 1}`, `自动定位到 Step 3 供应商分配`, `已重新计算供应商份额与MOQ取整`],
      targetStep: 3,
    };
  }

  // 帮助/可调参数列表 — 不跳转
  if (lower.includes('可调') || lower.includes('调参') || lower.includes('修改参数') || lower.includes('帮助') || lower.includes('help')) {
    return {
      response: `📋 **可调整参数清单**\n\n以下参数支持在对话中直接输入修改：\n\n**1. 区域系数**（分公司维度）→ 影响 Step 2\n• 格式：\`调整区域系数 湖北 1.1\`\n• 说明：修改某子公司的区域系数\n\n**2. 备货系数**（物料维度）→ 影响 Step 2\n• 格式：\`调整备货系数 莲雾苹果汁 1.2\`\n• 说明：修改某物料的备货系数\n\n**3. W1-W4占比**（成品维度）→ 影响 Step 2\n• 格式：\`调整W1占比 0.06\`\n• 说明：修改后所有物料同步生效\n\n**4. 安全库存天数** → 影响 Step 3\n• 格式：\`安全库存改成7天\`\n• 说明：默认5天\n\n**5. 供应商信息** → 影响 Step 3\n• 格式：\`设置供应商 莲雾苹果汁 供应商A 40% MOQ500\`\n• 说明：份额之和必须=100%`,
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
  const [selectedProduct, setSelectedProduct] = useState<string[]>([]);
  const [activeBOMTab, setActiveBOMTab] = useState(0);
  const [skillSelected, setSkillSelected] = useState(false);
  const [showSkillPopup, setShowSkillPopup] = useState(false);
  const [rightTab, setRightTab] = useState<Step>(1);
  const [tongpeiDone, setTongpeiDone] = useState(false);
  const [supplierDone, setSupplierDone] = useState(false);
  const [selectedHistoricalProducts, setSelectedHistoricalProducts] = useState<Set<string>>(
    () => new Set(historicalProductsDetail.map(p => p.name))
  );
  const [jumpedTab, setJumpedTab] = useState<Step | null>(null);
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
          `汇总到仓 + 预警检查完成 ✅\n\n🏭 **汇总到仓**（仓店映射9,708条）\n• 北京二级仓：莲雾苹果汁 **13,399** 瓶\n• 详见右侧各仓库汇总\n\n📊 **预警检查（物料维度）**\n• 安溪铁观音：备货偏差 5.2%（分仓计算值 vs 理论需求量） ✅ ｜ MOQ 0.03% ✅ ｜ 安库 20.3天 ✅\n• 莲雾苹果汁：备货偏差 8.6%（分仓计算值 vs 理论需求量） ✅ ｜ MOQ 0.055% ✅ ｜ 安库 17.2天 ✅\n• 冷冻生椰乳：备货偏差 **12.1%**（分仓计算值 vs 理论需求量） ❌ 超阈值 ｜ MOQ 0.18% ✅ ｜ 安库 11.8天 ✅\n• 东方美人乌龙茶-A：备货偏差 3.8%（分仓计算值 vs 理论需求量） ✅ ｜ MOQ 0.24% ✅ ｜ 安库 20.0天 ✅\n\n📦 **仓级统配对比**\n• 湖北一级仓：偏差 12.6% ⚠️ 异常\n• 浙江一级仓：偏差 14.1% ⚠️ 异常\n• 其余6仓均在10%以内 ✅\n\n📦 **供应商数据**\n供应商分配数据是否已确认？确认后我将进行份额分配与MOQ取整。\n\n💡 **如需调整参数，可直接输入：**\n• "调整区域系数 湖北 1.1"\n• "调整备货系数 莲雾苹果汁 1.2"\n• "调整W1占比 0.06"\n• "安全库存改成7天"\n• 输入"帮助"查看完整参数清单`,
          ['读取仓店映射Sheet2：9,708条', '按仓库汇总门店物料量', '备货偏差/ MOQ取整/安全库存三道预警（物料维度）'],
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
          `📦 **供应商数据已确认** ✅\n\n已完成份额分配与MOQ取整：\n• 安溪铁观音：福建安溪茶业A(60%) + 云南普洱供应链B(40%)\n• 莲雾苹果汁：海南果汁工厂C(100%)\n• 冷冻生椰乳：椰树供应链D(70%) + 海南椰品E(30%)\n• 东方美人乌龙茶-A：台湾茶业F(100%)\n\n详见右侧供应商分配表。\n\n⏰ **统配数据（T-30出数）**\n统配数据是否已到？如果已到，我将继续进行统配比对和统配外计算。`,
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
      // 自动定位到对应step的右侧面板 + 跳转动画
      if (paramResult.targetStep > 0 && step >= paramResult.targetStep) {
        setRightTab(paramResult.targetStep);
        setJumpedTab(paramResult.targetStep);
        setTimeout(() => setJumpedTab(null), 2000);
      }
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addBotMessage(paramResult.response, paramResult.thinking, 
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
                          🚀 开始分仓（已选{selectedProduct.length}品）
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
                              addBotMessage('🔄 正在使用新参数重新计算...');
                              setTimeout(() => triggerStepMessage(step), 800);
                            }
                            else if (action.type === 'notify') addBotMessage('📤 已发送飞书通知 ✅');
                            else if (action.type === 'skip') {
                              if (step === 3 && !tongpeiDone) {
                                addBotMessage('⏸️ **统配数据未到，流程暂停**\n\n当前已完成：\n• ✅ 汇总到仓\n• ✅ 供应商分配\n• ✅ 三道预警检查\n\n等待统配数据到达后，输入"统配数据已到"或点击按钮继续。');
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
                                  `✅ 已切换为 **AI推荐子集**（${aiSubset.size}个历史品，相似度≥80%）\n\n区域系数已重新计算，详见右侧面板。\n\n你可以在右侧面板中逐个勾选/取消历史品，进一步微调选择。`,
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
                                `📦 **供应商数据已确认** ✅\n\n已完成份额分配与MOQ取整：\n• 安溪铁观音：福建安溪茶业A(60%) + 云南普洱供应链B(40%)\n• 莲雾苹果汁：海南果汁工厂C(100%)\n• 冷冻生椰乳：椰树供应链D(70%) + 海南椰品E(30%)\n• 东方美人乌龙茶-A：台湾茶业F(100%)\n\n详见右侧供应商分配表。\n\n⏰ **统配数据（T-30出数）**\n统配数据是否已到？如果已到，我将继续进行统配比对和统配外计算。`,
                                ['读取供应商主数据', '按份额分配采购量', 'MOQ取整校验'],
                                [{ label: '✅ 统配数据已到，继续', type: 'confirm' }, { label: '⏸️ 统配数据未到，暂停', type: 'skip' }],
                              );
                            }
                            else if (action.type === 'supplier_skip') {
                              addBotMessage('⏸️ **供应商数据未到，流程暂停**\n\n当前已完成：\n• ✅ 汇总到仓\n• ✅ 三道预警检查（物料维度）\n\n等待供应商数据确认后，输入"供应商数据已确认"或点击按钮继续。\n\n⏰ 统配数据也请同步关注。');
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
          {selectedProduct.length === 0 && <RightEmptyState />}
          {selectedProduct.length > 0 && (
            <>
              {/* Tab Navigation */}
              <div className="right-tabs">
                {STEP_LABELS.slice(1).map((label, i) => {
                  const tabStep = (i + 1) as Step;
                  const isActive = rightTab === tabStep;
                  const isCompleted = step > tabStep;
                  const isAccessible = step >= tabStep;
                  const isJumped = jumpedTab === tabStep;
                  return (
                    <button
                      key={tabStep}
                      className={`right-tab ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${!isAccessible ? 'disabled' : ''} ${isJumped ? 'jumped' : ''}`}
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
                {rightTab === 1 && <RightStep1CupForecast productInfo={productInfo} materials={materials} selectedProduct={selectedProduct} activeBOMTab={activeBOMTab} setActiveBOMTab={setActiveBOMTab} />}
                {rightTab === 2 && <RightStep2CoefficientsAndBOM regions={regions} flooredCount={flooredCount} materials={materials} productInfo={productInfo} selectedHistoricalProducts={selectedHistoricalProducts} setSelectedHistoricalProducts={setSelectedHistoricalProducts} selectedProduct={selectedProduct} />}
                {rightTab === 3 && <RightStep3WarehouseAndWarnings tongpeiDone={tongpeiDone} supplierDone={supplierDone} />}
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

function RightStep1CupForecast({ productInfo, materials, selectedProduct, activeBOMTab, setActiveBOMTab }: { productInfo: NewProductInfo; materials: BOMMaterial[]; selectedProduct: string[]; activeBOMTab: number; setActiveBOMTab: (n: number) => void }) {
  const [storePage, setStorePage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalStores = mockStoreSamples.length;
  const totalPages = Math.ceil(totalStores / pageSize);
  const startIdx = (storePage - 1) * pageSize;
  const pageStores = mockStoreSamples.slice(startIdx, startIdx + pageSize);

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

      {/* 新品基础信息表（飞书多维表格） */}
      <div className="card">
        <div className="card-title">📋 新品基础信息表<button className="export-btn">📥 导出</button></div>
        <div className="data-source-tag">数据来源：飞书多维表格「新品BOM」表</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          新品名称：<strong>{currentProduct.name}</strong> ｜ 上新日：<strong>{currentProduct.launchDate}</strong> ｜ 共 <strong>{currentBOM.length}</strong> 种原材料
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
              {currentBOM.map(m => (
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
        <div className="kpi-card"><div className="kpi-label">在营门店</div><div className="kpi-value">{currentProduct.storeCount.toLocaleString()}<span className="kpi-unit">家</span></div></div>
        <div className="kpi-card"><div className="kpi-label">首周日均</div><div className="kpi-value">{currentProduct.firstWeekDailyCups}<span className="kpi-unit">杯</span></div></div>
        <div className="kpi-card"><div className="kpi-label">首月日均</div><div className="kpi-value">{currentProduct.firstMonthDailyCups}<span className="kpi-unit">杯</span></div></div>
        <div className="kpi-card"><div className="kpi-label">触发下限保护</div><div className="kpi-value" style={{ color: 'var(--warn)' }}>~200<span className="kpi-unit">家</span></div></div>
      </div>
      <div className="card">
        <div className="card-title">🏪 全部门店预测明细<button className="export-btn">📥 导出</button></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>门店编码</th><th>门店名称</th><th>子公司</th><th className="num">5月销量</th><th className="num">占比</th><th className="num">首周日均</th><th className="num">月日均</th></tr></thead>
            <tbody>
              {pageStores.map((s, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{s.storeId}</td>
                  <td style={{ fontWeight: 600, fontSize: 11 }}>{s.storeName}</td>
                  <td style={{ fontSize: 11 }}>{s.subsidiary}</td>
                  <td className="num">{s.maySales.toLocaleString()}</td>
                  <td className="num">{(s.salesRatio * 100).toFixed(4)}%</td>
                  <td className="num">{s.firstWeekDaily.toFixed(2)}</td>
                  <td className="num">{s.monthDaily.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        <div className="card-title">🧮 计算公式</div>
        <pre className="formula-block">{`门店占比 = 门店5月销量 ÷ 全国5月总销量(${productInfo.totalSalesMay.toLocaleString()})
首周日均 = 大盘首周(${productInfo.firstWeekDailyCups}) × 门店占比 × 门店数(${productInfo.storeCount.toLocaleString()})
月日均 = 大盘首月(${productInfo.firstMonthDailyCups}) × 门店占比 × 门店数(${productInfo.storeCount.toLocaleString()})
下限保护：if 日均 < 10杯 → 取大盘均值`}</pre>
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

  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 2</span>系数修正 + BOM拆解</div>

      {/* 区域系数 */}
      <div className="card">
        <div className="card-title">
          📐 区域系数（{filteredProducts.length}个历史品上新前两周实际销量占比比值）
          {isAISubset && <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 8, background: 'var(--accent-light)', padding: '2px 8px', borderRadius: 4 }}>AI推荐子集</span>}
          {!isAllSelected && !isAISubset && <span style={{ fontSize: 11, color: 'var(--warn)', marginLeft: 8, background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 4 }}>自定义选择</span>}
          <button className="export-btn">📥 导出</button>
        </div>
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="kpi-card"><div className="kpi-label">参考历史品数</div><div className="kpi-value" style={{ color: 'var(--accent)' }}>{filteredProducts.length}</div></div>
          <div className="kpi-card"><div className="kpi-label">兜底为1.0</div><div className="kpi-value" style={{ color: 'var(--warn)' }}>{currentFlooredCount}</div></div>
          <div className="kpi-card"><div className="kpi-label">最高系数</div><div className="kpi-value">{Math.max(...regions.map(r => floored[r.subsidiary])).toFixed(3)}</div></div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>
          <strong>计算公式：</strong>区域系数 = AVG(历史品上新前两周实际销量占比比值) = AVG(子公司新品占比 ÷ 全国新品占比)<br/>
          <strong>数据来源：</strong>基于上新前两周实际销售数据（不用预估数据）<br/>
          <strong>兜底规则：</strong>若均值 &lt; 1.0 → 取 1.0（防止低估）
        </div>

        {/* 历史品选择器 */}
        <div style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--bg-subtle, #f8fafc)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>🔍 历史品选择（已选 {selectedHistoricalProducts.size}/{historicalProductsDetail.length}）</span>
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
                <td>兜底后系数</td>
                {regions.map(r => (
                  <td key={r.subsidiary} className="num" style={{ color: 'var(--good)' }}>
                    {floored[r.subsidiary].toFixed(3)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* BOM物料清单 */}
      <div className="card">
        <div className="card-title">📦 BOM物料清单（{materials.filter(m => m.selected).length}种核心物料）<button className="export-btn">📥 导出</button></div>
        <div className="data-source-tag">数据来源：飞书多维表格「新品BOM」表</div>
        {selectedProduct.length > 1 && (
          <div style={{ fontSize: 12, color: 'var(--warn)', marginBottom: 8, padding: '6px 10px', background: 'rgba(245,158,11,0.06)', borderRadius: 6, lineHeight: 1.6 }}>
            ⚠️ 以下物料由 {selectedProduct.map(id => `[${newProductList.find(p => p.id === id)?.name || id}]`).join(' ')} {selectedProduct.length}个新品聚合计算，共用物料已合并
          </div>
        )}
        <table className="data-table">
          <thead><tr><th>原材料名称</th><th>原材料编码</th><th>规格型号</th><th>单位</th><th className="num">单位用量</th><th>用量单位</th><th className="num">开封效期</th><th className="num">备货系数</th><th className="num">损耗率</th><th className="num">W1杯占</th><th className="num">W2杯占</th><th className="num">W3杯占</th><th className="num">W4杯占</th></tr></thead>
          <tbody>
            {materials.map(m => {
              const isShared = selectedProduct.length > 1 && mockBOMRecordsProduct2.some(p2 => p2.materialCode === m.materialCode);
              return (
              <tr key={m.id} style={{ opacity: m.selected ? 1 : 0.5 }}>
                <td style={{ fontWeight: 600 }}>{m.materialName}{isShared && <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--accent)' }}>🔗共用</span>}</td>
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
              );
            })}
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
        <div className="card-title">📊 全国物料汇总<button className="export-btn">📥 导出</button></div>
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

// ===== 汇总到仓扁平表组件（仓+物料一起展示，支持筛选+分页） =====
function WarehouseFlatTable() {
  const [whFilter, setWhFilter] = useState('all');
  const [whPage, setWhPage] = useState(0);
  const whPageSize = 20;

  // 展开为扁平行
  const flatRows = useMemo(() => {
    const rows: Array<{ warehouse: string; storeCount: number; material: string; materialCode: string; allocationQty: number; extraStock: number; total: number; orderQty: number; unit: string }> = [];
    allWarehouseSummary.forEach(wh => {
      wh.materials.forEach((m, mi) => {
        rows.push({
          warehouse: wh.warehouseName,
          storeCount: wh.storeCount,
          material: m.name,
          materialCode: ['20260901-001','20260902-002','20260903-003','0260815-004'][mi] || '',
          allocationQty: m.allocationQty,
          extraStock: m.extraStock,
          total: m.total,
          orderQty: m.orderQty,
          unit: m.unit,
        });
      });
    });
    return rows;
  }, []);

  const filteredRows = whFilter === 'all' ? flatRows : flatRows.filter(r => r.warehouse === whFilter);
  const totalPages = Math.ceil(filteredRows.length / whPageSize);
  const pagedRows = filteredRows.slice(whPage * whPageSize, (whPage + 1) * whPageSize);

  // 合并单元格：同一仓库的仓库名和门店数
  let prevWh = '';

  return (
    <div className="card">
      <div className="card-title">🏭 汇总到仓（{allWarehouseSummary.length}仓 × 物料）<button className="export-btn">📥 导出</button></div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>仓店映射来源：dw_store_warehouse_map（WEEK + LEVEL_ONE/LEVEL_TWO，一店一仓）</p>
      
      {/* 筛选栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>仓库筛选：</span>
        <select value={whFilter} onChange={e => { setWhFilter(e.target.value); setWhPage(0); }} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'white', minWidth: 140 }}>
          <option value="all">全部仓库（{allWarehouseSummary.length}仓）</option>
          {allWarehouseSummary.map((wh, i) => (
            <option key={i} value={wh.warehouseName}>{wh.warehouseName}（{wh.storeCount}店）</option>
          ))}
        </select>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>共 {filteredRows.length} 行</span>
      </div>

      {/* 扁平表 */}
      <div style={{ maxHeight: 480, overflowY: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ minWidth: 100, position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>仓库</th>
              <th className="num" style={{ position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>覆盖门店</th>
              <th style={{ minWidth: 120, position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>物料</th>
              <th style={{ position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>物料编码</th>
              <th className="num" style={{ position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>统配量</th>
              <th className="num" style={{ position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>统配外</th>
              <th className="num" style={{ position: 'sticky', top: 0, background: 'var(--bg, white)', zIndex: 2 }}>合计</th>
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
                  <td className="num">{r.allocationQty.toLocaleString()}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{r.extraStock.toLocaleString()}</td>
                  <td className="num">{r.total.toLocaleString()}</td>
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

function RightStep3WarehouseAndWarnings({ tongpeiDone, supplierDone }: { tongpeiDone: boolean; supplierDone: boolean }) {
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

  // 物料维度预警数据
  const warningByMaterial = [
    { name: '安溪铁观音', forecastQty: 66285, orderQty: 66285, stockDeviation: 5.2, moqDeviation: 0.03, safetyDays: 20.3, stockStatus: 'pass', moqStatus: 'pass', safetyStatus: 'pass' },
    { name: '莲雾苹果汁', forecastQty: 363340, orderQty: 363540, stockDeviation: 8.6, moqDeviation: 0.055, safetyDays: 17.2, stockStatus: 'pass', moqStatus: 'pass', safetyStatus: 'pass' },
    { name: '冷冻生椰乳', forecastQty: 138095, orderQty: 138345, stockDeviation: 12.1, moqDeviation: 0.18, safetyDays: 11.8, stockStatus: 'fail', moqStatus: 'pass', safetyStatus: 'pass' },
    { name: '东方美人乌龙茶-A', forecastQty: 28585, orderQty: 28655, stockDeviation: 3.8, moqDeviation: 0.24, safetyDays: 20.0, stockStatus: 'pass', moqStatus: 'pass', safetyStatus: 'pass' },
  ];

  const statusIcon = (s: string) => s === 'pass' ? <span className="warn-pass">✅</span> : s === 'fail' ? <span className="warn-fail">❌</span> : <span className="warn-warn">⚠️</span>;
  const statusVal = (val: string | number, s: string) => <span className={s === 'pass' ? 'warn-pass' : s === 'fail' ? 'warn-fail' : 'warn-warn'}>{val}</span>;

  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 3</span>汇总到仓 + 供应商 + 预警</div>

      {/* 汇总到仓 — 扁平表（仓+物料一起展示） */}
      <WarehouseFlatTable />

      {/* 供应商 */}
      {supplierDone ? (
        <div className="card">
          <div className="card-title">📦 供应商分配<button className="export-btn">📥 导出</button></div>
          <table className="data-table">
            <thead><tr><th>物料</th><th>供应商</th><th>供应商编码</th><th className="num">份额%</th><th className="num">MOQ</th><th className="num">产能/周</th></tr></thead>
            <tbody>
              <tr><td style={{ fontWeight: 600 }}>安溪铁观音</td><td>福建安溪茶业A</td><td style={{ fontSize: 11 }}>SUP-001</td><td className="num">60%</td><td className="num">500</td><td className="num">50,000</td></tr>
              <tr><td style={{ fontWeight: 600 }}>安溪铁观音</td><td>云南普洱供应链B</td><td style={{ fontSize: 11 }}>SUP-002</td><td className="num">40%</td><td className="num">300</td><td className="num">30,000</td></tr>
              <tr><td style={{ fontWeight: 600 }}>莲雾苹果汁</td><td>海南果汁工厂C</td><td style={{ fontSize: 11 }}>SUP-003</td><td className="num">100%</td><td className="num">200</td><td className="num">400,000</td></tr>
              <tr><td style={{ fontWeight: 600 }}>冷冻生椰乳</td><td>椰树供应链D</td><td style={{ fontSize: 11 }}>SUP-004</td><td className="num">70%</td><td className="num">100</td><td className="num">120,000</td></tr>
              <tr><td style={{ fontWeight: 600 }}>冷冻生椰乳</td><td>海南椰品E</td><td style={{ fontSize: 11 }}>SUP-005</td><td className="num">30%</td><td className="num">100</td><td className="num">60,000</td></tr>
              <tr><td style={{ fontWeight: 600 }}>东方美人乌龙茶-A</td><td>台湾茶业F</td><td style={{ fontSize: 11 }}>SUP-006</td><td className="num">100%</td><td className="num">200</td><td className="num">35,000</td></tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ borderColor: 'var(--warn)', background: 'rgba(245,158,11,0.04)' }}>
          <div className="card-title" style={{ color: 'var(--warn)' }}>📦 供应商数据（待确认）</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            供应商分配数据尚未确认，请在左侧对话中点击"供应商数据已确认"或输入"供应商已确认"。
          </p>
        </div>
      )}

      {/* 预警 — 按物料维度 */}
      <div className="card" style={{ borderColor: 'var(--good)', background: 'rgba(34,197,94,0.04)' }}>
        <div className="card-title" style={{ color: 'var(--good)' }}>📊 三道预警检查（物料维度）<button className="export-btn">📥 导出</button></div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>
          备货偏差阈值：10%（分仓计算值 vs 理论需求量，不带系数） ｜ MOQ取整偏差阈值：5% ｜ 安全库存阈值：≥5天
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
              <th className="num">安全库存天数</th>
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
        <div style={{ marginTop: 8, fontSize: 12, display: 'flex', gap: 16 }}>
          <span style={{ color: 'var(--warn)' }}>⚠️ 冷冻生椰乳备货偏差 12.1%（分仓计算值 vs 理论需求量）超阈值，建议关注</span>
        </div>
      </div>

      {/* 仓级统配对比 */}
      <div className="card">
        <div className="card-title">📦 仓级统配对比<button className="export-btn">📥 导出</button></div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>
          预测统配量（分仓计算值）vs 实际统配量（SCM下发），偏差 &gt; 10% 标记为异常
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
                <td>{w.isAbnormal ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: 'var(--warn)' }}>⚠️ 异常</span> : <span style={{ color: 'var(--good)' }}>✅</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 统配比对 */}
      {tongpeiDone ? (
        <>
          <div className="card">
            <div className="card-title">⏰ T-30 统配比对 — 门店1101010005<button className="export-btn">📥 导出</button></div>
            <table className="data-table">
              <thead><tr><th>物料</th><th className="num">预测</th><th className="num">统配</th><th className="num">统配外</th><th className="num">合计</th><th>状态</th></tr></thead>
              <tbody>
                <tr><td style={{ fontWeight: 600 }}>安溪铁观音</td><td className="num">16</td><td className="num">6</td><td className="num">10</td><td className="num" style={{ fontWeight: 700 }}>16</td><td><span style={{ color: 'var(--good)' }}>✅</span></td></tr>
                <tr><td style={{ fontWeight: 600 }}>莲雾苹果汁</td><td className="num">99</td><td className="num">35</td><td className="num">64</td><td className="num" style={{ fontWeight: 700 }}>99</td><td><span style={{ color: 'var(--good)' }}>✅</span></td></tr>
                <tr><td style={{ fontWeight: 600 }}>冷冻生椰乳</td><td className="num">32</td><td className="num">12</td><td className="num">20</td><td className="num" style={{ fontWeight: 700 }}>32</td><td><span style={{ color: 'var(--good)' }}>✅</span></td></tr>
                <tr><td style={{ fontWeight: 600 }}>东方美人乌龙茶-A</td><td className="num">8</td><td className="num">0</td><td className="num">8</td><td className="num" style={{ fontWeight: 700 }}>8</td><td><span style={{ color: 'var(--good)' }}>✅</span></td></tr>
              </tbody>
            </table>
          </div>

          {/* 异常统配门店明细 */}
          <div className="card" style={{ borderColor: 'var(--warn)', background: 'rgba(245,158,11,0.04)' }}>
            <div className="card-title" style={{ color: 'var(--warn)' }}>⚠️ 异常统配门店明细（统配 &gt; 预测，共12家）<button className="export-btn">📥 导出</button></div>
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
        <div className="card-title">📊 安全库存校验 — 北京二级仓<button className="export-btn">📥 导出</button></div>
        <table className="data-table">
          <thead><tr><th>物料</th><th>物料编码</th><th className="num">统配外</th><th className="num">日均消耗</th><th className="num">可销售天数</th><th>状态</th></tr></thead>
          <tbody>
            <tr><td style={{ fontWeight: 600 }}>安溪铁观音</td><td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>20260901-001</td><td className="num">1,539</td><td className="num">76.0</td><td className="num" style={{ fontWeight: 700, color: 'var(--good)' }}>20.3天</td><td><span style={{ color: 'var(--good)' }}>✅</span></td></tr>
            <tr><td style={{ fontWeight: 600 }}>莲雾苹果汁</td><td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>20260902-002</td><td className="num">8,245</td><td className="num">478.4</td><td className="num" style={{ fontWeight: 700, color: 'var(--good)' }}>17.2天</td><td><span style={{ color: 'var(--good)' }}>✅</span></td></tr>
            <tr><td style={{ fontWeight: 600 }}>冷冻生椰乳</td><td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>20260903-003</td><td className="num">2,035</td><td className="num">172.4</td><td className="num" style={{ fontWeight: 700, color: 'var(--good)' }}>11.8天</td><td><span style={{ color: 'var(--good)' }}>✅</span></td></tr>
            <tr><td style={{ fontWeight: 600 }}>东方美人乌龙茶-A</td><td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>0260815-004</td><td className="num">823</td><td className="num">41.2</td><td className="num" style={{ fontWeight: 700, color: 'var(--good)' }}>20.0天</td><td><span style={{ color: 'var(--good)' }}>✅</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RightStep4Output({ productInfo }: { productInfo: NewProductInfo }) {
  // 预警计算明细数据
  const warningDetail = [
    {
      name: '安溪铁观音', code: '20260901-001',
      forecastQty: 66285, orderQty: 66285,
      stockDeviation: 5.2, stockThreshold: 10, stockPass: true,
      stockCalc: '|66,285 - 66,285| ÷ 66,285 = 0%（含MOQ取整后5.2%）',
      moqDeviation: 0.03, moqThreshold: 5, moqPass: true,
      moqCalc: 'MOQ=500, 原始量39,771 → 取整39,500, 偏差=271÷39,771=0.68%（加权均值0.03%）',
      safetyExtra: 42920, safetyDaily: 3800, safetyDays: 20.3, safetyThreshold: 5, safetyPass: true,
      safetyCalc: '统配外42,920 ÷ 日均消耗3,800 = 11.3天（全国加权均值20.3天）',
    },
    {
      name: '莲雾苹果汁', code: '20260902-002',
      forecastQty: 363340, orderQty: 363540,
      stockDeviation: 8.6, stockThreshold: 10, stockPass: true,
      stockCalc: '|363,340 - 363,540| ÷ 363,340 = 0.055%（含MOQ取整后8.6%）',
      moqDeviation: 0.055, moqThreshold: 5, moqPass: true,
      moqCalc: 'MOQ=200, 原始量224,554 → 取整224,600, 偏差=46÷224,554=0.02%（加权均值0.055%）',
      safetyExtra: 224554, safetyDaily: 20800, safetyDays: 17.2, safetyThreshold: 5, safetyPass: true,
      safetyCalc: '统配外224,554 ÷ 日均消耗20,800 = 10.8天（全国加权均值17.2天）',
    },
    {
      name: '冷冻生椰乳', code: '20260903-003',
      forecastQty: 138095, orderQty: 138345,
      stockDeviation: 12.1, stockThreshold: 10, stockPass: false,
      stockCalc: '|138,095 - 138,345| ÷ 138,095 = 0.18%（含MOQ取整后12.1%）',
      moqDeviation: 0.18, moqThreshold: 5, moqPass: true,
      moqCalc: 'MOQ=100, 原始量78,316 → 取整78,400, 偏差=84÷78,316=0.11%（加权均值0.18%）',
      safetyExtra: 78316, safetyDaily: 10000, safetyDays: 11.8, safetyThreshold: 5, safetyPass: true,
      safetyCalc: '统配外78,316 ÷ 日均消耗10,000 = 7.8天（全国加权均值11.8天）',
    },
    {
      name: '东方美人乌龙茶-A', code: '0260815-004',
      forecastQty: 28585, orderQty: 28655,
      stockDeviation: 3.8, stockThreshold: 10, stockPass: true,
      stockCalc: '|28,585 - 28,655| ÷ 28,585 = 0.24%（含MOQ取整后3.8%）',
      moqDeviation: 0.24, moqThreshold: 5, moqPass: true,
      moqCalc: 'MOQ=200, 原始量28,585 → 取整28,600, 偏差=15÷28,585=0.05%（加权均值0.24%）',
      safetyExtra: 28585, safetyDaily: 2200, safetyDays: 20.0, safetyThreshold: 5, safetyPass: true,
      safetyCalc: '统配外28,585 ÷ 日均消耗2,200 = 13.0天（全国加权均值20.0天）',
    },
  ];

  const passIcon = (pass: boolean) => pass
    ? <span style={{ color: 'var(--good)', fontWeight: 600 }}>✅ 通过</span>
    : <span style={{ color: 'var(--danger, #ef4444)', fontWeight: 600 }}>❌ 超阈值</span>;

  return (
    <div className="animate-in">
      <div className="panel-title"><span className="step-badge">Step 4</span>结果输出</div>
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">新品</div><div className="kpi-value" style={{ fontSize: 16 }}>{productInfo.name}</div></div>
        <div className="kpi-card"><div className="kpi-label">门店数</div><div className="kpi-value">{productInfo.storeCount.toLocaleString()}</div></div>
        <div className="kpi-card"><div className="kpi-label">物料数</div><div className="kpi-value">4</div></div>
        <div className="kpi-card"><div className="kpi-label">预警</div><div className="kpi-value" style={{ color: 'var(--warn)' }}>1项超阈值</div></div>
      </div>

      {/* 全国物料最终方案 */}
      <div className="card">
        <div className="card-title">📊 全国物料最终方案<button className="export-btn">📥 导出</button></div>
        <table className="data-table">
          <thead><tr><th>物料</th><th>物料编码</th><th className="num">预测量</th><th className="num">统配量</th><th className="num">统配外</th><th className="num">下单量</th><th>单位</th></tr></thead>
          <tbody>
            {nationalMaterialSummary.map((m, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{['20260901-001','20260902-002','20260903-003','0260815-004'][i]}</td>
                <td className="num">{m.forecastQty.toLocaleString()}</td>
                <td className="num">{m.allocationQty.toLocaleString()}</td>
                <td className="num">{m.extraStock.toLocaleString()}</td>
                <td className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>{m.orderQty.toLocaleString()}</td>
                <td style={{ fontSize: 11 }}>{['箱','箱','瓶','箱'][i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 预警汇总 — 计算明细 */}
      <div className="card" style={{ borderColor: 'var(--warn)', background: 'rgba(245,158,11,0.02)' }}>
        <div className="card-title" style={{ color: 'var(--warn)' }}>📋 预警汇总 — 计算明细<button className="export-btn">📥 导出</button></div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
          三道预警阈值：备货偏差 ≤10% ｜ MOQ取整偏差 ≤5% ｜ 安全库存 ≥5天
        </div>

        {warningDetail.map((m, i) => (
          <div key={i} style={{ marginBottom: i < warningDetail.length - 1 ? 20 : 0, padding: '12px 16px', borderRadius: 8, border: `1px solid ${m.stockPass ? 'var(--border)' : 'var(--warn)'}`, background: m.stockPass ? 'white' : 'rgba(245,158,11,0.04)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              {m.name}
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{m.code}</span>
              {!m.stockPass && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: 'var(--danger, #ef4444)' }}>⚠️ 备货偏差超阈值</span>}
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
                  <td className="num" style={{ color: m.stockPass ? 'var(--good)' : 'var(--danger, #ef4444)', fontWeight: 700 }}>{m.stockDeviation}%</td>
                  <td className="num">≤{m.stockThreshold}%</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.stockCalc}</td>
                  <td>{passIcon(m.stockPass)}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>MOQ取整偏差</td>
                  <td className="num" style={{ color: 'var(--good)', fontWeight: 700 }}>{m.moqDeviation}%</td>
                  <td className="num">≤{m.moqThreshold}%</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.moqCalc}</td>
                  <td>{passIcon(m.moqPass)}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>安全库存</td>
                  <td className="num" style={{ color: 'var(--good)', fontWeight: 700 }}>{m.safetyDays}天</td>
                  <td className="num">≥{m.safetyThreshold}天</td>
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
        <div className="card-title">⚠️ 异常统配门店汇总<button className="export-btn">📥 导出</button></div>
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

      {/* 导出清单 */}
      <div className="card">
        <div className="card-title">📥 导出Excel（6个Sheet）</div>
        <table className="data-table">
          <thead><tr><th>Sheet</th><th>内容</th><th className="num">行数</th><th>说明</th></tr></thead>
          <tbody>
            <tr><td style={{ fontWeight: 600 }}>Sheet1</td><td>门店明细</td><td className="num">{productInfo.storeCount.toLocaleString()} × 4物料 × W1-W4</td><td style={{ fontSize: 11 }}>逐门店逐物料计算结果</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Sheet2</td><td>仓库汇总</td><td className="num">30+仓库 × 4物料</td><td style={{ fontSize: 11 }}>按仓库汇总统配+统配外</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Sheet3</td><td>供应商分配</td><td className="num">6条</td><td style={{ fontSize: 11 }}>供应商份额+MOQ取整</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Sheet4</td><td>预警清单</td><td className="num">4物料 × 3预警</td><td style={{ fontSize: 11 }}>三道预警计算明细</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Sheet5</td><td>SCM导入模板</td><td className="num">—</td><td style={{ fontSize: 11 }}>可直接导入SCM系统</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Sheet6</td><td>仓级统配对比</td><td className="num">8仓</td><td style={{ fontSize: 11 }}>预测统配 vs 实际统配，异常标记</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
