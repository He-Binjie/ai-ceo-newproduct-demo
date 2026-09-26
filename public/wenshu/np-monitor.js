/* ============================================================================
 * 「新品监控」看板 —— 挂进朱仙问数壳的看板清单（2026-09-24 rev3 → 2026-09-26 rev4）
 *
 * 目标：在既有看板清单（#bdCatList）里**新增一条**「新品监控」，与她的看板并列；
 *       不新建技能、不新建独立看板页、不动她的任何文件（raw / generated / wenshu.js / wenshu.css）。
 *
 * 走的是她自己「保存为看板」用的那条正路（实测她的代码里就是这么干的）：
 *   BD.extra.push({...}) → bdRenderCatalog() → 条目出现在 #bdCatList；
 *   点条目 → bdOpen(id) → kind:'rpt' → renderReport(it) = **纯大宽表**
 *   （bdVhead 标题/数据源/筛选条 + 「明细数据」表卡：列配置 + 导出 Excel + 分页 + 点行看字段级来源）
 *   —— 与她的《成品销售表》《物料销售表》等报表**同一套渲染与样式**，一行 CSS 都不用自己写。
 *
 * rev4 改动（彬节 2026-09-26）：
 *   ① **一级仓库 / 二级仓库换成茶姬真实仓主数据**（数据岛 65 个在用二级仓 / 44 个一级仓；
 *      来源：茶姬 SCM 仓主数据导出《茶姬一级仓-二级仓数据.xlsx》去重 + 剔停用）——
 *      原先是自造的「广东一级仓 / 广东一级仓-常温库」。
 *   ② **列名与口径严格对齐 PRD V7.8 §5.4 六项监控指标**（仓备货预测日均杯量 / 仓实际日均杯量 /
 *      仓偏差率 / 近 7 日销售趋势 / 仓库可售天数 / 仓预计门店可售天数）+ 状态；
 *      粒度由「二级仓 × 核心物料（120 行）」收敛为**二级仓库一行（65 行）** ——
 *      PRD 六项里 4 项是仓维度定义，故按仓一行（不再是 5 物料 × 24 仓）。
 *   ③ **筛选条改成她报表式的查询条件（RPT_Q 走 bd-qbar）**：一级仓库名称 / 二级仓库名称两个下拉，
 *      选项**由数据自动带出**（正是她 bdQbarHtml 的行为）；我们只补一件事 —— 她的 opts 上限 40 个，
 *      而我们有 44 个一级仓 / 65 个二级仓 ⇒ 渲染后按数据岛**补全选项**，并做一级 → 二级的下拉级联。
 *   ④ **删掉筛选条下方那行口径/预警解释文字**（彬节：「筛选器的下方那些解释语句可以删除」）。
 *
 * ---------------------------------------------------------------------------
 * 三个必须记住的实测事实（踩过/查过，别凭直觉改）
 *
 * 1) **BD 是 `let BD = {...}`，不是 window.BD**。
 *    经典脚本顶层的 `let/const` 只建全局词法绑定，**不挂 window**（`window.BD` 恒 undefined）。
 *    所以本文件只能写裸标识符 `BD`（`typeof BD === 'undefined'` 可用）。同理 RPT_Q / BD_QF。
 *
 * 2) **筛选要走她自己的两条路之一，别自造**：
 *    · `bdBoardFiltersHtml(it)`：`RPT_Q[it.id]` 有该看板 → 走 `bdQbarHtml`（观远报表式查询条件，
 *      `[标签, 类型, 映射列名]`，类型 dr/d1/d2/sel/txt/yn）；否则走 `flt:[…]` 的通用仓/时间筛选。
 *    · 她的查询条件**按列名映射过滤**（`bfApplyTable`：cn 命中 it.gen.cols 的列标签 ⇒ 真实按值过滤并
 *      自动从数据里取下拉选项；cn=null ⇒ 退化成「按 hash 丢行」的假过滤）⇒ **cn 必须写成真实列标签**。
 *    · 过滤后的表由 `bfRefresh` 重填（`BD_TBLS['rptTbl']`），所以本文件**不需要**再自己重画表格。
 *
 * 3) **不新增 window 全局**（硬约束：我方只允许 __aiCeoSwitchSkill 一个）。
 *    幂等靠「BD.extra 里有没有本条目」，不靠 window 标记位。
 *
 * ---------------------------------------------------------------------------
 * 数据来源：数据岛 <script type="application/json" id="np-monitor-seed">，
 *   由 src/engine/monitorSeed.ts 的 writeMonitorSeedIsland() 在 main.tsx 模块求值时同步写入
 *   （从 src/data/mock.ts 的 monitorSubWarehouses 序列化 —— 茶姬真实仓清单 × PRD §5.4 六项指标口径）
 *   读不到数据岛 ⇒ 不注册看板 + 控制台告警（宁可缺，也不要拿她的随机数冒充我们的口径）。
 *
 * 加载时机：vite.config.ts 注入在她 wenshu.js / shell-bridge.js **之后**（同为 defer，按文档顺序执行）。
 * ========================================================================== */
(function () {
  'use strict'

  var TAG = '[np-monitor]'
  var ID = 'bd-np-monitor'
  var NAME = '新品监控'
  var GROUP = '新品'
  var SEED_ID = 'np-monitor-seed'
  var TID = 'rptTbl' /* renderReport 的表格 id（tbody=#rptTblBody、分页器=#rptTblPager） */
  var PAGE_SIZE = 12 /* ⚠️ 必须和她 renderReport 里的 per:12 一致（demo.v4.3-0921.raw.html showReport
                          路径 bdTableHtml('rptTbl',…,{per:12})）—— 她的报表渲染路径最后会按 per:12 重建
                          #rptTbl，我们这里传别的值会被覆盖。65 行 ÷ 12 = 6 页。 */
  /* PRD V7.8 §5.4：两条预警口径。N 类数值页面上不可修改（默认值即可，仅后端可配置） */
  var DEVIATION_THRESHOLD = 20 /* |偏差| > 20% */
  var STOCK_DAYS_N = 7 /* 仓库可售天数 < N 天 */
  /* ⚠️ 她 bdQbarHtml 的 opts 上限是 40（Object.keys(...).slice(0,40)）—— 我们一级仓 44 / 二级仓 65
     会被截断，所以渲染后要用数据岛里的全量清单补一遍选项（见 fillQbarOptions） */

  /* 大宽表列定义：她 bdCellHtml 支持的 type＝wh/text/num/pct2/days/status/…（第 4 位是字段级来源，点行可见）
     —— 列名严格照 PRD V7.8 §5.4 六项监控指标写，不自己造名字 */
  var COLS = [
    ['wh1', '一级仓库', 'wh', 'SCM 仓主数据 · 一级仓库名称（茶姬《一级仓-二级仓数据》仓清单）'],
    ['wh2', '二级仓库', 'text', 'SCM 仓主数据 · 二级仓库名称（二级仓 / 共配仓）'],
    ['stores', '覆盖门店', 'num', '门店主数据：该二级仓覆盖的在营门店数'],
    ['fcavg', '仓备货预测日均杯量', 'num', 'PRD §5.4 指标①：仓维度上新预测总量 ÷ 28（分仓订单计算结果）'],
    ['acavg', '仓实际日均杯量', 'num', 'PRD §5.4 指标②：仓饮品销量 ÷ 售卖天数 N（默认 7 天、不含当日）'],
    ['dev', '仓偏差率', 'pct2', 'PRD §5.4 指标③：（仓实际日均杯量 − 仓备货预测日均杯量）÷ 仓备货预测日均杯量 × 100%；|偏差| > 20% 预警（仓 + 全国维度）'],
    ['trend', '近 7 日销售趋势', 'text', 'PRD §5.4 指标④：新品销售占比趋势（上新日起 30 天）在本宽表中按近 7 日环比呈现'],
    ['whd', '仓库可售天数', 'days', 'PRD §5.4 指标⑤：物料可用库存 ÷ 仓物料订货日均（订货天数 N 默认 7）；< 7 天预警'],
    ['stdays', '仓预计门店可售天数', 'days', 'PRD §5.4 指标⑥：（仓库可用库存 + 门店库存 + 门店在途）÷ 门店成品物料销量；仅展示、不监控'],
    ['st', '状态', 'status', '规则引擎：PRD §5.4 两条预警（销量偏差 |偏差| > 20% / 仓库可售天数 < 7 天）'],
  ]

  /* 筛选条（走她的 RPT_Q + bd-qbar）：标签 / 类型 / 映射列名
     —— 映射列名必须是上面 COLS 里的**列标签原文**，她才能按值真实过滤 + 自动带出选项 */
  var QSPEC = [
    ['一级仓库名称', 'sel', '一级仓库'],
    ['二级仓库名称', 'sel', '二级仓库'],
  ]

  function byId(id) {
    return document.getElementById(id)
  }

  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  /* ---------- 1) 数据岛 ---------- */
  function readSeed() {
    var el = byId(SEED_ID)
    if (!el) return null
    try {
      return JSON.parse(el.textContent)
    } catch (e) {
      console.warn(TAG + ' 数据岛 JSON 解析失败', e)
      return null
    }
  }

  var seed = readSeed()
  if (!seed || !Array.isArray(seed.rows) || !seed.rows.length) {
    console.warn(TAG + ' 没读到数据岛 #' + SEED_ID + '（本看板不注册）—— 检查 src/engine/monitorSeed.ts + main.tsx')
    return
  }
  if (typeof BD === 'undefined' || !BD || !Array.isArray(BD.extra)) {
    console.warn(TAG + ' 没找到她的 BD（她改了全局结构？）—— 本看板不注册')
    return
  }
  if (typeof window.bdOpen !== 'function' || typeof window.bdRenderCatalog !== 'function') {
    console.warn(TAG + ' 没找到 bdOpen / bdRenderCatalog —— 本看板不注册')
    return
  }
  if (
    BD.extra.some(function (it) {
      return it && it.id === ID
    })
  ) {
    return /* 幂等：已注册过（不新增 window 全局，靠条目自身判定） */
  }

  var ROWS = seed.rows
  /* 一级仓库 / 二级仓库清单（筛选条用）—— 保持数据岛里的出现顺序 */
  var WH1S = []
  var WH2S = []
  ROWS.forEach(function (r) {
    if (WH1S.indexOf(r.wh1) < 0) WH1S.push(r.wh1)
    if (WH2S.indexOf(r.wh2) < 0) WH2S.push(r.wh2)
  })

  /* ---------- 2) 口径计算（全部来自数据岛，不调用她的随机数） ---------- */
  function statusOf(r) {
    var devAlert = Math.abs(r.dev) > DEVIATION_THRESHOLD
    var stockAlert = r.whd < STOCK_DAYS_N
    if (devAlert && stockAlert) return '偏差风险·库存偏紧'
    if (devAlert) return '偏差风险'
    if (stockAlert) return '库存偏紧'
    return '正常'
  }

  /* 趋势列：环比 % 加方向箭头 —— 表里一眼看出「在涨还是在跌」（PRD 指标④ 的宽表形态） */
  function trendText(v) {
    var n = Number(v) || 0
    var arrow = n > 0.5 ? '↑' : n < -0.5 ? '↓' : '→'
    return arrow + ' ' + (n > 0 ? '+' : '') + n.toFixed(1) + '%'
  }

  /* 行 → 位置数组（她的 gen.fixedRows 要这个形态；renderReport 的 bdGenRows 会按 cols 序号映射成对象行） */
  function cellsOf(r) {
    return [r.wh1, r.wh2, r.stores, r.fcavg, r.acavg, r.dev, trendText(r.trend), r.whd, r.stdays, statusOf(r)]
  }

  function fixedRowsOf(list) {
    return list.map(cellsOf)
  }

  /* ---------- 3) 筛选条补全（她的 opts 上限 40，我们有 44 / 65） ---------- */
  function qbarState() {
    return (typeof BD_QF !== 'undefined' && BD_QF && BD_QF[ID]) || {}
  }

  function childWh2Of(wh1) {
    var out = []
    ROWS.forEach(function (r) {
      if (r.wh1 === wh1 && out.indexOf(r.wh2) < 0) out.push(r.wh2)
    })
    return out
  }

  /** 渲染后：按数据岛补全两个下拉的选项，并做「一级仓库 → 二级仓库」级联 */
  function fillQbarOptions() {
    var bar = document.querySelector('#bdMain .bd-qbar')
    if (!bar) return
    var st = qbarState()
    var pickedWh1 = st['一级仓库名称'] || ''
    var lists = {
      一级仓库名称: WH1S,
      二级仓库名称: pickedWh1 ? childWh2Of(pickedWh1) : WH2S,
    }
    var fields = bar.querySelectorAll('.bq-fld')
    Array.prototype.forEach.call(fields, function (f) {
      var lab = f.querySelector('label')
      var sel = f.querySelector('select')
      if (!lab || !sel) return
      var name = (lab.textContent || '').trim()
      var list = lists[name]
      if (!list) return
      var cur = st[name] || ''
      /* 级联后当前选中的二级仓不属于该一级仓 ⇒ 清掉（否则表格会按无效组合过滤成 0 行） */
      if (cur && list.indexOf(cur) < 0) {
        cur = ''
        if (typeof BD_QF !== 'undefined' && BD_QF && BD_QF[ID]) BD_QF[ID][name] = ''
      }
      var opts = '<option value="">全部</option>'
      list.forEach(function (v) {
        opts += '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>'
      })
      if (sel.innerHTML !== opts) sel.innerHTML = opts
    })
  }

  /* ---------- 4) 渲染后接管 ---------- */
  function afterOpen() {
    if (BD.cur !== ID) return
    fillQbarOptions()
    if (typeof window.bdAudit === 'function') {
      window.bdAudit('新品监控：二级仓库 × PRD §5.4 六项监控指标宽表（' + ROWS.length + ' 行）', NAME)
    }
  }

  /* ---------- 5) 注册看板条目 + 挂筛选条 + 包 bdOpen ---------- */
  /* 她的查询条件表：挂上之后 bdBoardFiltersHtml 会走 bdQbarHtml（观远报表式筛选条） */
  if (typeof RPT_Q !== 'undefined' && RPT_Q && !RPT_Q[ID]) {
    RPT_Q[ID] = QSPEC
  } else if (typeof RPT_Q === 'undefined' || !RPT_Q) {
    console.warn(TAG + ' 没找到她的 RPT_Q —— 筛选条会退化成通用仓筛选')
  }

  BD.extra.push({
    id: ID,
    n: NAME,
    _g: GROUP,
    srcs: ['湖仓', '成品销售表', '分仓订单计算结果'],
    rf: 'T+1',
    st: '已发布',
    v: 'v1.2',
    kind: 'rpt', /* ⚠️ 用她的报表渲染路径（renderReport）= 纯大宽表；kind:'gen' 会强制加 KPI 块 + 随机趋势图 */
    flt: ['time', 'wh'],
    gen: {
      cols: COLS,
      fixedRows: fixedRowsOf(ROWS), /* ⚠️ 位置数组（bdGenRows 按 cols 序号映射）；别换成对象数组 */
    },
  })

  var origOpen = window.bdOpen
  window.bdOpen = function (id) {
    var out = origOpen.apply(this, arguments)
    if (id === ID) {
      try {
        afterOpen()
      } catch (e) {
        console.warn(TAG + ' 渲染后接管失败（看板仍会以固定行渲染）', e)
      }
    }
    return out
  }

  /* 筛选条件变化时（bfSet）重建选项：一级仓库变了 ⇒ 二级仓库下拉跟着收敛 */
  if (typeof window.bfSet === 'function') {
    var origBfSet = window.bfSet
    window.bfSet = function (bid) {
      var out = origBfSet.apply(this, arguments)
      if (bid === ID) {
        try {
          fillQbarOptions()
        } catch (e) {
          console.warn(TAG + ' 筛选条级联失败（不影响过滤本身）', e)
        }
      }
      return out
    }
  }

  /* 目录已渲染 ⇒ 立刻重渲染一次让条目出现；未渲染 ⇒ 她 init 时会带着 BD.extra 一起渲染 */
  if (byId('bdCatList')) {
    var q = byId('bdSearch')
    window.bdRenderCatalog(q ? q.value : '')
  }
  console.info(
    TAG +
      ' 已注册看板「' +
      NAME +
      '」（数据岛 ' +
      ROWS.length +
      ' 行 = 二级仓库 × PRD §5.4 六项监控指标 · ' +
      WH1S.length +
      ' 个一级仓库 / ' +
      WH2S.length +
      ' 个二级仓库 · 覆盖门店 ' +
      seed.note.stores +
      ' · 大宽表 ' +
      COLS.length +
      ' 列，筛选条走她的 RPT_Q/bd-qbar）',
  )
})()