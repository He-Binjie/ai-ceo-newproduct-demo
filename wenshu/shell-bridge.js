/* ============================================================================
 * 合并问数模块（朱仙 V4.3）桥接脚本 —— 手写文件，**不是**构建产物
 *
 * 职责（规格 §3.4 双向技能路由）：
 *   她 → 我们：她那边**任何**「进入新品分仓流程」的入口，一律切回我们的新品分仓页
 *   我们 → 她：React 侧只切可见性（见 src/App.tsx 的 html[data-skill]）
 *
 * 为什么用「包装」而不是「改她的文件」：
 *   规格 §3.2 定的铁律是「她的原文件＝唯一源，JS verbatim 不改一字」。
 *   包装 window 上的入口函数能达到同样效果，且她下次更新原文件时不用重新打补丁。
 *
 * ---------------------------------------------------------------------------
 * 收口点 = startNewProductFlow（2026-09-24 第二轮改）
 *   她那边通向 np* 流程的入口有 3 条，**全部落到这同一个函数**：
 *     ① 技能弹层「新品分货」→ pickSkill('new')                 wenshu.js:1223
 *     ② 欢迎语 chip「新品分仓备货（AI CEO）」→ demoAsk()        wenshu.js:1284 → 1290
 *     ③ 聊天里直接打「新品分仓 / 分仓备货 / 开始新品分仓」        wenshu.js:924（她的发送处理）
 *   只要包住这个汇总点，3 条入口自动全覆盖。
 *
 *   ⚠️ 上一版只包 pickSkill ⇒ **② ③ 是漏网的**：用户在自助取数里点
 *      「新品分仓备货（AI CEO）」chip，会静默进她自己的 np* 流程，永远跳不回我们页面
 *      （DOM 实测：NP.active=true、她聊天出现「我是 AI CEO 新品分仓助手」，data-skill 仍是 wenshu）。
 *   不要改回「只包 pickSkill」——那样等于只堵了 3 条路里的 1 条。
 *
 * ---------------------------------------------------------------------------
 * 副作用复刻（包装 guest 函数时必须做这一层，逐行过一遍被跳过的那几句）
 *   startNewProductFlow 原体 5 句，我们拦下后要这样处理：
 *     · npReset()                  → ✅ 补：清她 np* 的残留态并把她的左侧分货导航藏掉
 *     · NP.active = true           → ❌ **绝对不能补**！她的发送处理第一行是
 *                                     `if(NP.active){…npHandleSend…}`，一旦置 true，
 *                                     她聊天里之后所有输入都会被 np* 接管（她整个模块变砖）
 *     · npRenderLeftNav()          → ❌ 不补（那是 np* 流程自己的左侧步骤栏）
 *     · pushHistory('新品分仓备货') → ✅ 补：她的「历史记录」抽屉要保持连贯
 *     · npPhase0()                 → ❌ 不补（那是 np* 流程本身，正是我们要绕开的）
 *   另外补一条她原本没有的动作：在她聊天里留一张「已切到新品分仓」卡片。
 *   否则走 demoAsk 那条路时，她聊天里会挂着一句用户提问、后面什么都没有
 *   （下次切回她的模块看起来像坏了）。
 *
 * 加载时机：由 vite.config.ts 注入在她 wenshu.js **之后**（同为 defer，按文档顺序执行）。
 * ========================================================================== */
(function () {
  var BRIDGE = '[wenshu-bridge]'
  if (window.__wenshuBridgeInstalled) {
    console.warn(BRIDGE + ' 已经装过一次，跳过（避免重复包装）')
    return
  }

  function routerReady() {
    return typeof window.__aiCeoSwitchSkill === 'function'
  }

  /* 在她聊天里留一张交接卡片（用她的 addBotCard/setStatus，不改她的文件；缺函数就静默跳过） */
  function noteHandOff() {
    if (typeof window.addBotCard !== 'function') return
    try {
      var card = window.addBotCard()
      if (typeof window.setStatus === 'function') setStatus(card, 'done', '已切换到新品分仓备货')
      card.body.innerHTML =
        '已切换到 <b>AI CEO · 新品分仓备货</b> 技能：它有自己的页面与 5 步分仓链路，' +
        '已为你打开。要回到本页（智能问数 / 自助取数），点左下角「+ 选择技能」选「智能问数」即可。'
      if (typeof window.scrollChat === 'function') window.scrollChat()
    } catch (e) {
      console.warn(BRIDGE + ' 交接卡片没写成功（她的 addBotCard 结构可能变了）', e)
    }
  }

  /* 交给我们。返回 true＝已交出去（调用方必须 return）；false＝React 侧没就绪，按她原流程走 */
  function handOff(entry) {
    if (!routerReady()) {
      console.warn(BRIDGE + ' React 侧还没挂 __aiCeoSwitchSkill → ' + entry + ' 交不过去，暂按她原流程执行')
      return false
    }
    try { if (typeof window.npReset === 'function') window.npReset() } catch (e) { console.warn(BRIDGE + ' npReset 失败', e) }
    try { if (typeof window.pushHistory === 'function') window.pushHistory('新品分仓备货') } catch (e) { console.warn(BRIDGE + ' pushHistory 失败', e) }
    noteHandOff()
    window.__aiCeoSwitchSkill('newproduct')
    return true
  }

  window.__wenshuBridgeInstalled = true

  /* 主路径：只包汇总点 startNewProductFlow（顶层 function 声明 → 天然挂在 window 上） */
  var origStart = window.startNewProductFlow
  if (typeof origStart === 'function') {
    window.startNewProductFlow = function () {
      if (handOff('startNewProductFlow')) return
      return origStart.apply(this, arguments)
    }
    return
  }

  /* 退化路径：她改名了 → 至少还在技能弹层那条路上兜住 */
  console.warn(BRIDGE + ' 没找到 window.startNewProductFlow（她改了入口函数名？）→ 退化为只包 pickSkill')
  var origPick = window.pickSkill
  if (typeof origPick !== 'function') {
    console.warn(BRIDGE + ' 也没找到 window.pickSkill，桥接放弃（她的 np* 会留在她的模块里跑）')
    return
  }
  window.pickSkill = function (k) {
    if (k === 'new') {
      // 她的 pickSkill 第一行就是 skillPop.classList.remove('open')；
      // 这里提前 return 会跳过它 → 她的技能弹层残留 open，下次进她模块时自己弹着。补上同一动作。
      var pop = document.getElementById('skillPop')
      if (pop) pop.classList.remove('open')
      if (handOff('pickSkill')) return
    }
    return origPick.apply(this, arguments)
  }
})()