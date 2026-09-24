/* ============================================================================
 * 「新品监控」看板 —— 挂进朱仙问数壳的看板清单（2026-09-24）
 *
 * 目标：在既有看板清单（#bdCatList）里**新增一条**「新品监控」，与她的看板并列；
 *       不新建技能、不新建独立看板页、不动她的任何文件（raw / generated / wenshu.js / wenshu.css）。
 *
 * 走的是她自己「保存为看板」用的那条正路（实测她的代码里就是这么干的）：
 *   BD.extra.push({...}) → bdRenderCatalog() 重渲染 → 条目自动出现在 #bdCatList；
 *   点条目 → bdOpen(id) → kind:'gen' → renderGen(it)（KPI 卡组 / 图表 / 明细表 / 分页 /
 *   点行看字段级来源 / 导出 Excel / 数据源标注 / 审计日志 —— 全部白拿，不用自己写）。
 *
 * 为什么「包一层 bdOpen」而不是改她的 renderGen：
 *   她 renderGen 的趋势图与明细表默认走 bdRnd(...)（她自己的随机数），
 *   而硬约束是「看板上的数字必须与分仓流程内的数字一致」⇒ 渲染完再接管：
 *   用同一份数据重算 KPI 卡 / 明细表，并用她的 bdChart 重绘 30 天双线（双 Y 轴）。
 *   用包装而不是打补丁：她下次更新原文件时不用重新打补丁（与 shell-bridge.js 同一手法）。
 *
 * ---------------------------------------------------------------------------
 * 三个必须记住的实测事实（踩过/查过，别凭直觉改）
 *
 * 1) **BD 是 `let BD = {...}`，不是 window.BD**。
 *    经典脚本顶层的 `let/const` 只建全局词法绑定，**不挂 window**。
 *    所以本文件只能写裸标识符 `BD`（`typeof BD === 'undefined'` 可用），
 *    `window.BD` 永远是 undefined。同理 BD_CATALOG / WHS / BD_FLT_* 都只能裸用。
 *
 * 2) **看板级筛选条每次渲染都重建**（bdVhead → bdBoardFiltersHtml(it)，选项来自她的 WHS
 *    ＝['成都仓','苏州仓','佛山仓','沈阳仓']，与本看板的 8 仓不是一个体系）。
 *    收益：我们只在**本看板打开时**把 #bdFWh 的选项换成「全部仓库 + 我们的 8 仓」，
 *    她下一次渲染会自动按 WHS 重建 ⇒ **不会污染她的其它看板**，不需要做还原逻辑。
 *    代价：必须顺手清掉我们注入的仓名 —— bdSetFilter('wh',我们的仓名) 会写进 BD.filters.wh，
 *    而她离开本看板后 BD.filters.wh 仍是我们的仓名（bdApplyBoardCfg 只在「本看板不适用 wh」时才复位）
 *    ⇒ 她的报表会按这个仓名过滤 → 0 行、看着像坏了。所以 bdOpen 包装里有一条「离开即复位」。
 *
 * 3) **不新增 window 全局**（硬约束：我方只允许 __aiCeoSwitchSkill 一个）。
 *    幂等靠「BD.extra 里有没有本条目」，不靠 window 标记位。
 *
 * ---------------------------------------------------------------------------
 * 数据来源：index.html 里的数据岛 <script type="application/json" id="np-monitor-seed">，
 *   由 vite.config.ts 的 wenshuShell 插件在构建期从 src/data/mock.ts 的 monitor* 序列化写入
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
  /* PRD V7.8：两条预警口径。N 类数值页面上不可修改（默认值即可，仅后端配置） */
  var DEVIATION_THRESHOLD = 20 /* |偏差| > 20% */
  var STOCK_DAYS_N = 7 /* 仓库可售天数 < N 天 */

  /* 明细表列定义：她 bdCellHtml 支持的 type＝num/pct/pct2/days/status/wh/…（第 4 位是字段级来源，点行可见） */
  var COLS = [
    ['wh', '仓', 'wh', 'SCM 仓主数据'],
    ['forecastDailyCups', '备货预测日均杯量', 'num', '湖仓 DWS：仓维度上新预测总量 ÷ 28'],
    ['actualDailyCups', '实际日均杯量', 'num', '成品销售表：仓对应门店成品销售杯量 ÷ 售卖天数 N'],
    ['deviationPct', '偏差率', 'pct2', '（实际 − 预测）÷ 预测 × 100%'],
    ['warehouseSellableDays', '仓库可售天数', 'days', '物料可用库存 ÷ 仓物料订货日均（订货量 ÷ 订货天数 N）'],
    ['storeSellableDays', '门店可售天数', 'days', '（仓库可用库存 + 门店库存 + 门店在途）÷ 门店成品物料销量'],
    ['coversStores', '覆盖门店', 'num', '门店主数据'],
    ['status', '状态', 'status', '规则引擎：PRD §5.4 两条预警'],
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
  if (!seed || !seed.warehouses || !seed.warehouses.length || !seed.trend) {
    console.warn(TAG + ' 没读到数据岛 #' + SEED_ID + '（本看板不注册）—— 检查 vite.config.ts 的 wenshuShell 注入')
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
  if (BD.extra.some(function (it) {
    return it && it.id === ID
  })) {
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
    var stockAlert = w.whDays < STOCK_DAYS_N
    if (devAlert && stockAlert) return '偏差风险·库存偏紧'
    if (devAlert) return '偏差风险'
    if (stockAlert) return '库存偏紧'
    return '正常'
  }

  /* 明细表是「8 仓固定行」，列按 COLS 顺序对齐。
     ⚠️ 两种形态别混（实测踩到：整表都是 '-'）：
       · 对象数组 {colKey: value} —— 她的 bdTableHtml / bdFillTable 要这个（bdCellHtml 按 col[0] 取值）
       · 位置数组 [v1, v2, …]     —— 她的 gen.fixedRows 要这个（bdGenRows 按 cols 序号映射成对象）
     我一开始把位置数组直接喂给 bdTableHtml ⇒ row['wh'] 恒 undefined ⇒ 8 行全是 '-'。 */
  function positional(scope) {
    var list = WAREHOUSES.slice()
    if (scope && scope !== '全国') {
      /* 选了单仓 ⇒ 该仓置顶（整表仍是 8 行全景，不裁剪） */
      var i = list.findIndex(function (w) {
        return w.n === scope
      })
      if (i > 0) list.unshift(list.splice(i, 1)[0])
    }
    return list
  }

  function fixedRowsOf(scope) {
    return positional(scope).map(function (w) {
      return [
        w.n,
        w.forecast,
        w.actual,
        w.dev,
        w.whDays,
        w.storeDays,
        w.coversStores,
        statusOf(w),
      ]
    })
  }

  function rowsOf(scope) {
    return positional(scope).map(function (w) {
      var row = {}
      row[COLS[0][0]] = w.n
      row[COLS[1][0]] = w.forecast
      row[COLS[2][0]] = w.actual
      row[COLS[3][0]] = w.dev
      row[COLS[4][0]] = w.whDays
      row[COLS[5][0]] = w.storeDays
      row[COLS[6][0]] = w.coversStores
      row[COLS[7][0]] = statusOf(w)
      return row
    })
  }

  /* 口径兜底：KPI 的「全国」用 national 行；单仓用该仓行 —— 两者的字段名一致，统一成一套 */
  function scopeRow(scope) {
    if (!scope || scope === '全国') return seed.national
    return BY_NAME[scope] || seed.national
  }

  function num(v, d) {
    if (typeof window.bdFmt === 'function') return window.bdFmt(v, d == null ? 0 : d)
    return Number(v).toLocaleString('zh-CN', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 })
  }

  function pct(v) {
    return (v > 0 ? '+' : '') + Number(v).toFixed(1) + '%'
  }

  /* ---------- 3) 6 张 KPI 卡（①②③⑤⑥；④ 是趋势图不是卡；③ 拆「仓 / 全国」两张） ---------- */
  function kpisFor(scope) {
    var isNational = !scope || scope === '全国'
    var w = scopeRow(scope)
    var nat = seed.national
    var devAlert = Math.abs(w.dev) > DEVIATION_THRESHOLD
    var stockAlert = w.whDays < STOCK_DAYS_N
    return [
      /* ① */
      [
        '仓备货预测日均杯量',
        num(w.forecast),
        (isNational ? '全国口径' : w.n) + ' · 上新预测总量 ÷ 28',
        'flat',
      ],
      /* ② */
      [
        '仓实际日均杯量',
        num(w.actual),
        '对应门店成品销售 ÷ 售卖天数 N（' + STOCK_DAYS_N + ' 天、不含当日）',
        'flat',
      ],
      /* ③-仓 */
      [
        '仓偏差率',
        pct(w.dev),
        devAlert ? '触发预警：|偏差| > ' + DEVIATION_THRESHOLD + '%' : '正常：|偏差| ≤ ' + DEVIATION_THRESHOLD + '%',
        devAlert ? 'down' : 'flat',
      ],
      /* ③-全国（对照片，便于「仓 + 全国」两种口径同屏） */
      [
        '全国偏差率',
        pct(nat.dev),
        Math.abs(nat.dev) > DEVIATION_THRESHOLD ? '触发预警' : '正常（全国口径对照）',
        'flat',
      ],
      /* ⑤ */
      [
        '仓库可售天数',
        w.whDays + '天',
        stockAlert ? '触发预警：< N 天（N = ' + STOCK_DAYS_N + '，后端配置）' : '阈值 N = ' + STOCK_DAYS_N + ' 天（后端配置）',
        stockAlert ? 'down' : 'flat',
      ],
      /* ⑥ */
      [
        '仓预计门店可售天数',
        w.storeDays + '天',
        '仅展示（仓库存 + 门店库存 + 在途）÷ 门店销量',
        'flat',
      ],
    ]
  }

  /* ---------- 4) 两条预警的命中汇总（承载在 AI 解读框里，状态列里逐行标） ---------- */
  function alertsHtml(scope) {
    var devHits = WAREHOUSES.filter(function (w) {
      return Math.abs(w.dev) > DEVIATION_THRESHOLD
    })
    var stockHits = WAREHOUSES.filter(function (w) {
      return w.whDays < STOCK_DAYS_N
    })
    var nat = seed.national
    var natHit = Math.abs(nat.dev) > DEVIATION_THRESHOLD
    var devTxt = devHits.length
      ? devHits
          .map(function (w) {
            return w.n + ' ' + pct(w.dev)
          })
          .join('、')
      : '无'
    var stockTxt = stockHits.length
      ? stockHits
          .map(function (w) {
            return w.n + ' ' + w.whDays + ' 天'
          })
          .join('、')
      : '无'
    return (
      '口径（PRD §5.4）：① 仓备货预测日均杯量 = 仓维度上新预测总量 ÷ 28；' +
      '② 仓实际日均杯量 = 仓对应门店成品销售杯量 ÷ 售卖天数 N；' +
      '③ 仓偏差率 =（实际 − 预测）÷ 预测；④ 每日趋势见下图；' +
      '⑤ 仓库可售天数 = 物料可用库存 ÷ 仓物料订货日均；' +
      '⑥ 仓预计门店可售天数 =（仓库存 + 门店库存 + 门店在途）÷ 门店成品物料销量（仅展示）。<br/>' +
      '<b>预警 2 条</b>（PRD V7.8）：<br/>' +
      '· ① 销量偏差 |偏差| &gt; ' +
      DEVIATION_THRESHOLD +
      '%（仓 + 全国）—— 命中 ' +
      devHits.length +
      ' 个仓：' +
      devTxt +
      '；全国 ' +
      pct(nat.dev) +
      (natHit ? '（触发）' : '（未触发）') +
      '。<br/>' +
      '· ② 仓库可售天数 &lt; N 天（N = ' +
      STOCK_DAYS_N +
      '，仅后端配置、页面不可改）—— 命中 ' +
      stockHits.length +
      ' 个仓：' +
      stockTxt +
      '。<br/>' +
      '数据源：与分仓流程同一套 mock（' +
      WAREHOUSES.length +
      ' 仓 × ' +
      seed.days.length +
      ' 天），非随机数；当前视图口径：<b>' +
      scope +
      '</b>。'
    )
  }

  /* ---------- 5) 趋势图：30 天双线（左轴销售杯量 / 右轴新品销售占比，双轴避免占比被杯量掩盖） ---------- */
  var CUP_COLOR = '#1b4d7a'
  var SHARE_COLOR = '#c2410c'

  function trendOption(scope, n) {
    var nat = !scope || scope === '全国'
    var pts = (nat ? seed.trend.national : seed.trend.byWarehouse[scope]) || seed.trend.national
    var days = seed.days.slice(-n)
    var cups = pts.slice(-n).map(function (p) {
      return p[0]
    })
    var share = pts.slice(-n).map(function (p) {
      return p[1]
    })
    var axis = typeof BD_AXIS !== 'undefined' ? BD_AXIS : {}
    return {
      tooltip: { trigger: 'axis', textStyle: { fontSize: 11 } },
      legend: { top: 0, textStyle: { fontSize: 10, color: '#64748b' }, itemWidth: 14 },
      grid: { left: 64, right: 58, top: 30, bottom: 24 },
      xAxis: Object.assign({ type: 'category', data: days, boundaryGap: false }, axis),
      yAxis: [
        Object.assign({ type: 'value', name: '杯量', nameTextStyle: { fontSize: 10, color: '#64748b' } }, axis),
        Object.assign({}, axis, {
          type: 'value',
          name: '占比',
          position: 'right',
          splitLine: { show: false },
          nameTextStyle: { fontSize: 10, color: '#64748b' },
          axisLabel: {
            color: '#64748b',
            fontSize: 10,
            formatter: function (v) {
              return v + '%'
            },
          },
        }),
      ],
      series: [
        {
          name: '销售杯量（' + scope + '）',
          type: 'line',
          smooth: true,
          symbol: 'none',
          data: cups,
          lineStyle: { width: 2, color: CUP_COLOR },
          itemStyle: { color: CUP_COLOR },
          areaStyle: { color: 'rgba(27,77,122,.10)' },
        },
        {
          name: '新品销售占比',
          type: 'line',
          smooth: true,
          symbol: 'none',
          yAxisIndex: 1,
          data: share,
          lineStyle: { width: 2, color: SHARE_COLOR, type: 'dashed' },
          itemStyle: { color: SHARE_COLOR },
        },
      ],
    }
  }

  function redrawChart(scope) {
    var el = byId('genCChart')
    if (!el || !window.echarts) return
    var n = BD.filters && BD.filters.time === '近7天' ? 7 : seed.days.length
    var opt = trendOption(scope, n)
    /* 她 renderGen 已经在这个 dom 上 init 过一次 ⇒ 复用实例 setOption，避免「同 dom 二次 init」告警与实例泄漏 */
    var inst = window.echarts.getInstanceByDom(el)
    if (inst) inst.setOption(opt, true)
    else if (typeof window.bdChart === 'function') window.bdChart('genCChart', opt)
  }

  /* ---------- 6) 接管 KPI 卡 / 明细表 / 标题 / 解读框 / 筛选条 ---------- */
  function rewriteKpis(scope) {
    var host = document.querySelector('#bdMain .bd-kpis')
    if (!host || typeof window.bdKpis !== 'function') return
    var html = window.bdKpis(kpisFor(scope))
    host.outerHTML = html
    var fresh = document.querySelector('#bdMain .bd-kpis')
    /* 6 张卡 → 3 列（她默认 4 列，6 张会落成 4+2 半空行；她的其它看板不受影响，这是本实例的内联样式） */
    if (fresh) fresh.style.gridTemplateColumns = 'repeat(3,1fr)'
  }

  function rewriteTable(scope) {
    var rows = rowsOf(scope)
    BD.rows.gen = rows
    if (typeof window.bdTableHtml !== 'function') return
    var card = document.querySelector('#bdMain .bd-table-card')
    if (!card) return
    /* 整块明细卡重建（与她 renderGen 的产物结构逐字一致：toolbar + bdTableHtml + bdFillTable）。
       ⚠️ 别只换 <table>：bdTableHtml 返回的是「列配置条 + .bd-tbl-wrap>table + .bd-pager」三段，
          只替换 table 会丢分页器（她 bdFillTable 要写 #genTblPager）。 */
    card.innerHTML =
      '<div class="bd-tbl-toolbar"><span class="bd-tbl-title">明细数据</span>' +
      '<span class="bd-tbl-count">点击行查看字段级来源</span>' +
      '<div class="bd-tbl-actions"><button class="bd-btn" onclick="bdExportTbl(\'genTbl\',\'' +
      NAME +
      '\')">导出 Excel</button></div></div>' +
      window.bdTableHtml('genTbl', COLS, rows, { per: 10, click: 'bdRowDetail' })
    if (typeof window.bdFillTable === 'function') window.bdFillTable('genTbl')
  }

  function rewriteTitles(scope) {
    var title = document.querySelector('#bdMain .bd-chart-card .bdc-title')
    if (title) {
      var n = BD.filters && BD.filters.time === '近7天' ? 7 : seed.days.length
      for (var i = 0; i < title.childNodes.length; i++) {
        var node = title.childNodes[i]
        if (node.nodeType === 3 && node.nodeValue && node.nodeValue.indexOf('趋势') >= 0) {
          node.nodeValue = NAME + ' · 近 ' + n + ' 天趋势（销售杯量 + 新品销售占比）'
          break
        }
      }
    }
    var box = byId('genCInt')
    if (box) box.innerHTML = alertsHtml(scope)
  }

  /* 筛选条：本看板打开时把 #bdFWh 换成「全部仓库 + 我们的 8 仓」。
     她的选项来自 WHS（另一套仓名），且**每次看板渲染都会按 WHS 重建** ⇒ 离开本看板自动还原，无需清理。 */
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

  /* ---------- 7) 渲染后接管 ---------- */
  function afterOpen() {
    if (BD.cur !== ID) return
    var wh = BD.filters ? BD.filters.wh : '全部仓库'
    /* 兜底：切回本看板时若 BD.filters.wh 还是她的仓名 → 视为全国 */
    var scope = wh && BY_NAME[wh] ? wh : '全国'
    applyWhOptions()
    rewriteKpis(scope)
    rewriteTable(scope)
    rewriteTitles(scope)
    redrawChart(scope)
    if (typeof window.bdAudit === 'function') window.bdAudit('新品监控：真算数据接管（' + scope + '）', NAME)
  }

  /* ---------- 8) 注册看板条目 + 包 bdOpen ---------- */
  BD.extra.push({
    id: ID,
    n: NAME,
    _g: GROUP,
    srcs: ['湖仓', '成品销售表', '订货助手'],
    rf: 'T+1',
    st: '已发布',
    v: 'v1.0',
    kind: 'gen',
    flt: ['time', 'wh'],
    gen: {
      kpis: kpisFor('全国'),
      chart: 'line',
      cols: COLS,
      fixedRows: fixedRowsOf('全国'), /* ⚠️ 位置数组（bdGenRows 按 cols 序号映射）；别换成对象数组 */
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
  console.info(TAG + ' 已注册看板「' + NAME + '」（数据岛 ' + WAREHOUSES.length + ' 仓 × ' + seed.days.length + ' 天）')
})()