/* ============================================================================
 * 合并问数模块（朱仙 V4.3）桥接脚本 —— 手写文件，**不是**构建产物
 *
 * 职责（规格 §3.4 双向技能路由）：
 *   她 → 我们：包住她的 pickSkill()，选「新品分货(new)」时切回我们的新品分仓
 *   我们 → 她：React 侧只切可见性（见 src/App.tsx 的 data-skill）
 *
 * 为什么用「包装」而不是「改她的文件」：
 *   规格 §3.2 定的铁律是「她的原文件＝唯一源，JS verbatim 不改一字」。
 *   包装 window.pickSkill 能达到同样效果，且她下次更新原文件时不用重新打补丁。
 *   她的 pickSkill 是顶层 function 声明 → 会自动挂到 window，可被包装。
 *
 * 加载时机：由 vite.config.ts 注入在她 wenshu.js **之后**（同为 defer，按文档顺序执行）。
 * ========================================================================== */
(function () {
  var orig = window.pickSkill
  if (typeof orig !== 'function') {
    console.warn('[wenshu-bridge] 没找到 window.pickSkill，她的技能弹层可能改了结构')
    return
  }
  window.pickSkill = function (k) {
    // 她技能弹层里的「新品分货」→ 交给我们（她的 np* 那套按规格保留代码、不给入口）
    if (k === 'new') {
      if (typeof window.__aiCeoSwitchSkill === 'function') {
        window.__aiCeoSwitchSkill('newproduct')
        return
      }
      console.warn('[wenshu-bridge] React 侧还没挂 __aiCeoSwitchSkill')
    }
    return orig.apply(this, arguments)
  }
})()