/* ============================================================================
 * 「新品监控」看板 —— 挂进朱仙问数壳的看板清单（2026-09-24，rev2）
 *
 * 目标：在既有看板清单（#bdCatList）里**新增一条**「新品监控」，与她的看板并列；
 *       不新建技能、不新建独立看板页、不动她的任何文件（raw / generated / wenshu.js / wenshu.css）。
 *
 * 走的是她自己「保存为看板」用的那条正路（实测她的代码里就是这么干的）：
 *   BD.extra.push({...}) → bdRenderCatalog() 重渲染 → 条目自动出现在 #bdCatList；
 *   点条目 → bdOpen(id) → kind:'rpt' → renderReport(it) = **纯大宽表**
 *   （bdVhead 标题/数据源/筛选条 + 「明细数据」表卡：列配置 + 导出 Excel + 分页 + 点行看字段级来源）
 *   —— 与她的《成品销售表》《物料销售表》等报表**同一套渲染与样式**，一行 CSS 都不用自己写。
 *
 * rev2 改动（彬节 2026-09-24）：
 *   ① 删掉 6 张 KPI 卡与 30 天趋势图 —— 只留这一个大宽表（"这些指标和图表都删除吧"）；
 *      渲染路径因此从 kind:'gen' 换成 kind:'rpt'（gen 会强制渲染 KPI 块 + bdRnd 随机图表，rpt 天然只有表）。
 *   ② 仓库从 8 个铺开到**茶姬真实仓清单 24 个**（22 一级仓 + 北京/海南/新疆/甘青宁 4 个二级仓，
 *      仓 ↔ 子公司 ↔ 省 一一对应，取自茶姬门店底表）⇒ 表也从 8 行变 24 行。
 *   ③ 指标不丢：6 项监控指标改由**表列**承载（备货预测日均杯量 / 实际日均杯量 / 偏差率 /
 *      仓库可售天数 / 门店可售天数 + 状态），不再占 KPI 卡位。
 *
 * ---------------------------------------------------------------------------
 * 三个必须记住的实测事实（踩过/查过，别凭直觉改）
 *
 * 1) **BD 是 `let BD = {...}`，不是 window.BD**。
 *    经典脚本顶层的 `let/const` 只建全局词法绑定，**不挂 window**（`window.BD` 恒 undefined）。
 *    所以本文件只能写裸标识符 `BD`（`typeof BD === 'undefined'` 可用）。同理 BD_CATALOG / WHS / BD_FLT_*。
 *
 * 2) **看板级筛选条每次渲染都重建**（bdVhead → bdBoardFiltersHtml(it)，选项来自她的 WHS
 *    ＝['成都仓','苏州仓','佛山仓','沈阳仓']，与本看板的 24 仓不是一个体系）。
 *    收益：我们只在**本看板打开时**把 #bdFWh 的选项换成「全部仓库 + 我们的 24 仓」，
 *    她下一次渲染会自动按 WHS 重建 ⇒ **不会污染她的其它看板**，不需要还原选项的逻辑。
 *    代价：必须顺手清掉我们注入的仓名 —— bdSetFilter('wh',我们的仓名) 会写进 BD.filters.wh，
 *    而她离开本看板后 BD.filters.wh 仍是我们的仓名（bdApplyBoardCfg 只在「本看板不适用 wh」时才复位）
 *    ⇒ 她的报表会按这个仓名过滤 → 0 行、看着像坏了。所以 bdOpen 包装里有一条「离开即复位」。
 *
 * 3) **不新增 window 全局**（硬约束：我方只允许 __aiCeoSwitchSkill 一个）。
 *    幂等靠「BD.extra 里有没有本条目」，不靠 window 标记位。
 *
 * ---------------------------------------------------------------------------
 * 数据来源：数据岛 <script type="application/json" id="np-monitor-seed">，
 *   由 src/engine/monitorSeed.ts 的 writeMonitorSeedIsland() 在 main.tsx 模块求值时同步写入
 *   （从 src/data/mock.ts 的 monitorWarehouses / monitorNational 序列化）
 *   ⇒ 与分仓流程内的监控 mock **同一份来源**，不会各写一套数字。
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
  var NOTE_ID = 'npMonitorNote'
  /* PRD V7.8：两条预警口径。N 类数值页面上不可修改（默认值即可，仅后端配置） */
  var DEVIATION_THRESHOLD = 20 /* |偏差| > 20% */
  var STOCK_DAYS_N = 7 /* 仓库可售天数 < N 天 */

  /* 大宽表列定义：她 bdCellHtml 支持的 type＝wh/text/num/pct2/days/status/…（第 4 位是字段级来源，点行可见） */
  var COLS = [
    ['wh', '仓', 'wh', 'SCM 仓主数据'],
    ['whtype', '仓类型', 'text', '仓主数据：一级仓 / 二级仓'],
    ['sub', '子公司', 'text', '企迈 + 湖仓 DWS（仓 ↔ 子公司 一一对应）'],
    ['prov', '省', 'prov', '企迈 + 湖仓 DWS'],
    ['stores', '覆盖门店', 'num', '门店主数据'],
    ['fc', '备货预测日均杯量', 'num', '湖仓 DWS：仓维度上新预测总量 ÷ 28'],
    ['ac', '实际日均杯量', 'num', '成品销售表：仓对应门店成品销售杯量 ÷ 售卖天数 N（默认 7、不含当日）'],
    ['dev', '偏差率', 'pct2', '（实际 − 预测）÷ 预测 × 100%；|偏差| > 20% 预警'],
    ['whd', '仓库可售天数', 'days', '物料可用库存 ÷ 仓物料订货日均（订货量 ÷ 订货天数 N）'],
    ['std', '门店可售天数', 'days', '（仓库可用库存 + 门店库存 + 门店在途）÷ 门店成品物料销量（仅展示）'],
    ['st', '状态', 'status', '规则引擎：PRD §5.4 两条预警（偏差 > 20% / 可售天数 < 7 天）'],
  ]

  function byId(id) {
    return document.getElementById(id)
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
  if (!seed || !seed.warehouses || !seed.warehouses.length || !seed.national) {
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

  var WAREHOUSES = seed.warehouses
  var BY_NAME = {}
  WAREHOUSES.forEach(function (w) {
    BY_NAME[w.n] = w
  })

  /* ---------- 2) 口径计算（全部来自数据岛，不调用她的随机数） ---------- */
  function statusOf(w) {
    var devAlert = Math.abs(w.dev) > DEVIATION_THRESHOLD
    var stockAlert = w.whd < STOCK_DAYS_N
    if (devAlert && stockAlert) return '偏差风险·库存偏紧'
    if (devAlert) return '偏差风险'
    if (stockAlert) return '库存偏紧'
    return '正常'
  }

  /* ⚠️ 两种形态别混（实测踩到：整表都是 '-'）：
       · 位置数组 [v1, v2, …]     —— 她的 gen.fixedRows 要这个（bdGenRows 按 cols 序号映射成对象）
       · 对象数组 {colKey: value} —— 她的 bdTableHtml / bdFillTable 要这个（bdCellHtml 按 col[0] 取值）
     把位置数组直接喂给 bdTableHtml ⇒ row['wh'] 恒 undefined ⇒ 全表 '-'。 */
  function cellsOf(w) {
    return [w.n, w.t, w.sub, w.prov, w.stores, w.fc, w.ac, w.dev, w.whd, w.std, statusOf(w)]
  }

  function fixedRowsOf(list) {
    return list.map(cellsOf)
  }

  function rowsOf(list) {
    return list.map(function (w) {
      var row = {}
      var cells = cellsOf(w)
      COLS.forEach(function (c, i) {
        row[c[0]] = cells[i]
      })
      return row
    })
  }

  /* 筛选范围：全部仓库 ⇒ 茶姬真实仓清单 24 行；选单仓 ⇒ 该仓 1 行 */
  function scopeList(scope) {
    if (!scope || scope === '全国' || scope === '全部仓库') return WAREHOUSES
    var hit = WAREHOUSES.filter(function (w) {
      return w.n === scope
    })
    return hit.length ? hit : WAREHOUSES
  }

  function num(v) {
    if (typeof window.bdFmt === 'function') return window.bdFmt(v, 0)
    return Number(v).toLocaleString('zh-CN')
  }

  function pct(v) {
    return (v > 0 ? '+' : '') + Number(v).toFixed(1) + '%'
  }

  /* ---------- 3) 一行「口径 + 两条预警」说明（KPI 卡删了，PRD 要求的 2 条预警得有落点） ----------
     刻意复用她的 .bd-tbl-count 排版（同字号/同灰色）⇒ 与报表其它文字一致，不引入新样式。 */
  function noteHtml(scope) {
    var devHits = WAREHOUSES.filter(function (w) {
      return Math.abs(w.dev) > DEVIATION_THRESHOLD
    })
    var stockHits = WAREHOUSES.filter(function (w) {
      return w.whd < STOCK_DAYS_N
    })
    var nat = seed.national
    var txt = function (arr, fn) {
      return arr.length
        ? arr
            .map(fn)
            .join('、')
        : '无'
    }
    var scopeTxt = !scope || scope === '全部仓库' || scope === '全国' ? '全部仓库' : scope
    return (
      '预警 2 条（PRD V7.8）：' +
      '① 销量偏差 |偏差| &gt; ' +
      DEVIATION_THRESHOLD +
      '%（仓 + 全国）—— 命中 ' +
      devHits.length +
      ' 个仓：' +
      txt(devHits, function (w) {
        return w.n + ' ' + pct(w.dev)
      }) +
      '；全国 ' +
      pct(nat.dev) +
      '（未触发）。 ' +
      '② 仓库可售天数 &lt; ' +
      STOCK_DAYS_N +
      ' 天（仅后端配置、页面不可改）—— 命中 ' +
      stockHits.length +
      ' 个仓：' +
      txt(stockHits, function (w) {
        return w.n + ' ' + w.whd + ' 天'
      }) +
      '。' +
      ' ｜ 当前视图：<b>' +
      scopeTxt +
      '</b> · 仓清单＝茶姬真实仓（' +
      WAREHOUSES.length +
      ' 个：22 一级仓 + 北京/海南/新疆/甘青宁 4 个二级仓，Σ 覆盖门店 ' +
      num(
        WAREHOUSES.reduce(function (a, w) {
          return a + w.stores
        }, 0),
      ) +
      '）；数字与分仓流程同一套 mock（非随机数）。'
    )
  }

  function injectNote(scope) {
    var main = byId('bdMain')
    if (!main) return
    var card = main.querySelector('.bd-table-card')
    if (!card) return
    var old = byId(NOTE_ID)
    if (old && old.parentNode) old.parentNode.removeChild(old)
    var d = document.createElement('div')
    d.id = NOTE_ID
    d.className = 'bd-tbl-count'
    d.style.cssText = 'display:block;padding:8px 2px 10px;line-height:1.75;text-align:left'
    d.innerHTML = noteHtml(scope)
    card.parentNode.insertBefore(d, card)
  }

  /* ---------- 4) 单仓筛选时重画表格（全部仓库时她的 renderReport 已按 fixedRows 渲染好，无需接管） ---------- */
  function rewriteTable(scope) {
    var list = scopeList(scope)
    if (list.length === WAREHOUSES.length) return /* 与初始渲染一致，跳过 */
    var rows = rowsOf(list)
    BD.rows.gen = rows
    if (typeof window.bdTableHtml !== 'function') return
    var card = document.querySelector('#bdMain .bd-table-card')
    if (!card) return
    /* 整块明细卡重建（与 renderReport 产物结构逐字一致：toolbar + bdTableHtml + bdFillTable）。
       ⚠️ 别只换 <table>：bdTableHtml 返回「列配置条 + .bd-tbl-wrap>table + .bd-pager」三段，
          只替换 table 会丢分页器（bdFillTable 要写 #rptTblPager）。 */
    card.innerHTML =
      '<div class="bd-tbl-toolbar"><span class="bd-tbl-title">明细数据</span>' +
      '<span class="bd-tbl-count">显示 ' +
      COLS.length +
      '/' +
      COLS.length +
      ' 列 · 点击行查看字段级来源</span>' +
      '<div class="bd-tbl-actions"><button class="bd-btn" onclick="bdColCfg(\'' +
      TID +
      '\')">列配置</button>' +
      '<button class="bd-btn" onclick="bdExportTbl(\'' +
      TID +
      '\',\'' +
      NAME +
      '\')">导出 Excel</button></div></div>' +
      window.bdTableHtml(TID, COLS, rows, { per: 12, click: 'bdRowDetail', noCfg: 1 })
    if (typeof window.bdFillTable === 'function') window.bdFillTable(TID)
  }

  /* 筛选条：本看板打开时把 #bdFWh 换成「全部仓库 + 茶姬真实 24 仓」。
     她的选项来自 WHS（另一套仓名），且**每次看板渲染都会按 WHS 重建** ⇒ 离开本看板自动还原。 */
  function applyWhOptions() {
    var sel = byId('bdFWh')
    if (!sel) return
    var cur = BD.filters ? BD.filters.wh : '全部仓库'
    var opts = '<option>全部仓库</option>'
    WAREHOUSES.forEach(function (w) {
      opts += '<option' + (w.n === cur ? ' selected' : '') + '>' + w.n + '</option>'
    })
    if (sel.innerHTML !== opts) sel.innerHTML = opts
  }

  /* ---------- 5) 渲染后接管 ---------- */
  function afterOpen() {
    if (BD.cur !== ID) return
    var wh = BD.filters ? BD.filters.wh : '全部仓库'
    /* 兜底：切回本看板时若 BD.filters.wh 还是她的仓名 → 视为全部 */
    var scope = wh && BY_NAME[wh] ? wh : '全部仓库'
    applyWhOptions()
    rewriteTable(scope)
    injectNote(scope)
    if (typeof window.bdAudit === 'function') window.bdAudit('新品监控：大宽表接管（' + scope + '）', NAME)
  }

  /* ---------- 6) 注册看板条目 + 包 bdOpen ---------- */
  BD.extra.push({
    id: ID,
    n: NAME,
    _g: GROUP,
    srcs: ['湖仓', '成品销售表', '订货助手'],
    rf: 'T+1',
    st: '已发布',
    v: 'v1.0',
    kind: 'rpt', /* ⚠️ 用她的报表渲染路径（renderReport）= 纯大宽表；kind:'gen' 会强制加 KPI 块 + 随机趋势图 */
    flt: ['time', 'wh'],
    gen: {
      cols: COLS,
      fixedRows: fixedRowsOf(WAREHOUSES), /* ⚠️ 位置数组（bdGenRows 按 cols 序号映射）；别换成对象数组 */
    },
  })

  var origOpen = window.bdOpen
  window.bdOpen = function (id) {
    /* 离开本看板 + BD.filters.wh 残留我们的仓名 ⇒ 先复位（否则她的报表会按无效仓名过滤成 0 行） */
    if (id !== ID && BD.filters && BY_NAME[BD.filters.wh]) BD.filters.wh = '全部仓库'
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

  /* 目录已渲染 ⇒ 立刻重渲染一次让条目出现；未渲染 ⇒ 她 init 时会带着 BD.extra 一起渲染 */
  if (byId('bdCatList')) {
    var q = byId('bdSearch')
    window.bdRenderCatalog(q ? q.value : '')
  }
  console.info(TAG + ' 已注册看板「' + NAME + '」（数据岛 ' + WAREHOUSES.length + ' 仓 · 大宽表 ' + COLS.length + ' 列）')
})()