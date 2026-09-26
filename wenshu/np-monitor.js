/* ============================================================================
 * 「新品监控」看板 —— 挂进宿主问数壳的看板清单（rev4 2026-09-26 → rev5 2026-09-26 V7.9）
 *
 * rev5 改动（彬节 2026-09-26·第二改；口径来源＝茶姬 PRD V7.9 §5.4「五、数据表结构」）：
 *   **一张二级仓宽表 → 两张事实表 / 两个看板条目**（6 项监控指标分属两个行粒度，一张表只能有一个粒度）：
 *     · 表 A「新品销售监控」＝ 一级仓库（分组）× 二级仓库 × **新品**  → ①②③④ + 状态   130 行
 *       （两个新品共用同一物料时，物料级库存会被重复计算；①–④ 才是新品粒度能回答的「卖得准不准」）
 *     · 表 B「物料库存监控」＝ 一级仓库（分组）× 二级仓库 × **物料（合并品名）** → ⑤⑥ + 状态  325 行
 *       （物料可用库存是物理共享总量，无法按新品拆；共用物料**只出现一行**，不按新品拆、不打共用标）
 *   全国维度（PRD ③「仓维度 + 全国维度都做」）：按 PRD V7.9 ＝ **表 A 同表冗余列**
 *     （全国实际日均杯量 / 全国偏差率）—— PRD 明确「不再单列『仓＝全国』的行」。
 *   筛选条：两张表各三个下拉（一级仓库名称 / 二级仓库名称 / 新品名称｜物料（合并品名）），
 *     仍走她自己的 `RPT_Q` 查询条件（`bd-qbar`）；一级 → 二级、一级 → 第三维 级联。
 *   不建 KPI 卡 / 不建图表 / 不加筛选条下方解释文字（此前已按彬节要求删除，别回来）。
 *
 * 两个看板都走她自己「保存为看板」的那条正路（实测她代码里就是这条）：
 *   BD.extra.push({...}) → bdRenderCatalog() → 条目出现在 #bdCatList；
 *   点条目 → bdOpen(id) → kind:'rpt' → renderReport(it) = **纯大宽表**
 *   （bdVhead 标题/数据源/筛选条 + 「明细数据」表卡：列配置 + 导出 Excel + 分页 + 点行看字段级来源）
 *   —— 与她的《成品销售表》《物料销售表》同一套渲染与样式，一行 CSS 都不用自己写。
 *
 * ---------------------------------------------------------------------------
 * 三个必须记住的实测事实（踩过/查过，别凭直觉改）
 *
 * 1) **BD 是 `let BD = {...}`，不是 window.BD**。
 *    经典脚本顶层的 `let/const` 只建全局词法绑定，**不挂 window**（`window.BD` 恒 undefined）；
 *    但 `function` 声明（bdOpen / bfSet / bdQbarHtml / bdRenderCatalog…）在 window 上，可以包装。
 *    同理 RPT_Q / BD_QF 只能裸标识符访问。
 *
 * 2) **筛选要走她自己的两条路之一，别自造**：
 *    · `bdBoardFiltersHtml(it)`：`RPT_Q[it.id]` 有该看板 → 走 `bdQbarHtml`（观远报表式查询条件，
 *      `[标签, 类型, 映射列名]`）；否则走 `flt:[…]` 的通用仓/时间筛选。
 *    · 她的查询条件**按列名映射过滤**（`bfApplyTable`：cn 必须命中 it.gen.cols 的列标签原文 ⇒ 真实按值过滤
 *      并自动从数据里取下拉选项；cn=null ⇒ 退化成「按 hash 丢行」的假过滤）。
 *    · 过滤后的表由 `bfRefresh` 重填（`BD_TBLS['rptTbl']`），所以本文件**不需要**再自己重画表格。
 *    · ⚠️ 两张看板的表 id 都是 `rptTbl`（她 renderReport 写死的）⇒ 一次只渲染一个看板，互不干扰。
 *
 * 3) **不新增 window 全局**（硬约束：我方只允许 __aiCeoSwitchSkill 一个）。
 *    幂等靠「BD.extra 里有没有本条目」，不靠 window 标记位。
 *
 * ---------------------------------------------------------------------------
 * 数据来源：数据岛 <script type="application/json" id="np-monitor-seed">，
 *   由 src/engine/monitorSeed.ts 的 writeMonitorSeedIsland() 在 main.tsx 模块求值时同步写入
 *   （从 src/data/mock.ts 的 monitorSalesRows / monitorStockRows 序列化 —— 茶姬真实仓清单 × PRD 两张事实表口径）
 *   读不到数据岛 ⇒ 不注册看板 + 控制台告警（宁可缺，也不要拿她的随机数冒充我们的口径）。
 *
 * 加载时机：vite.config.ts 注入在她 wenshu.js / shell-bridge.js **之后**（同为 defer，按文档顺序执行）。
 * ========================================================================== */
(function () {
  'use strict'

  var TAG = '[np-monitor]'
  var SEED_ID = 'np-monitor-seed'
  var GROUP = '新品'
  var TID = 'rptTbl' /* renderReport 的表格 id（tbody=#rptTblBody、分页器=#rptTblPager） */
  var PAGE_SIZE = 12 /* ⚠️ 必须和她 renderReport 里的 per:12 一致（bdTableHtml('rptTbl',…,{per:12})）——
                          她的报表渲染路径最后会按 per:12 重建 #rptTbl，传别的值会被覆盖。 */

  /* PRD §5.4：两条预警口径。N 类数值页面上不可修改（默认值即可，仅后端可配置） */
  var DEVIATION_THRESHOLD = 20 /* ① 销量偏差预警：|偏差| > 20% */
  var STOCK_DAYS_N = 7 /* ② 库存预警：仓库可售天数 < N 天 */

  /* ⚠️ 她 bdQbarHtml 的 opts 上限是 40（Object.keys(...).slice(0,40)）—— 一级仓 44 / 二级仓 65
     会被截断，所以渲染后要用数据岛里的全量清单补一遍选项（见 fillQbarOptions） */

  /* 大宽表列定义：她 bdCellHtml 支持的 type＝wh/text/num/pct2/days/status/…（第 4 位是字段级来源，点行可见） */
  /* 表 A · 新品销售监控表：列名严格照 PRD §5.4「五、数据表结构」＋ 一、六项监控指标（含 ③ 的全国冗余列） */
  var COLS_SALES = [
    ['wh1', '一级仓库', 'wh', 'SCM 仓主数据 · 一级仓库名称（**仅作分组展示，不参与任何计算/聚合**）'],
    ['wh2', '二级仓库', 'text', 'SCM 仓主数据 · 二级仓库名称（指标计算粒度；仓店映射 WEEK + LEVEL_ONE/LEVEL_TWO，一店一仓）'],
    ['np', '新品名称', 'text', 'Step 0 选品 · 同系列多品（表 A 行粒度＝仓 × 新品）'],
    ['fcavg', '仓备货预测日均杯量', 'num', 'PRD §5.4 指标①：仓维度上新预测总量 ÷ 28（数据来源：分仓订单计算结果）'],
    ['acavg', '仓实际日均杯量', 'num', 'PRD §5.4 指标②：仓饮品销量 ÷ 售卖天数 N（默认 7 天、不含当日）'],
    ['dev', '仓偏差率', 'pct2', 'PRD §5.4 指标③：（仓实际日均杯量 − 仓备货预测日均杯量）÷ 仓备货预测日均杯量 × 100%；|偏差| > 20% 触发销量偏差预警'],
    ['natacavg', '全国实际日均杯量', 'num', 'PRD §5.4 指标③ 的**全国维度**（同表冗余列·按新品汇总，PRD V7.9 不单列「仓＝全国」的行）'],
    ['natdev', '全国偏差率', 'pct2', 'PRD §5.4 指标③ 的**全国维度**：（全国实际 − 全国预测）÷ 全国预测 × 100%；|偏差| > 20% 触发全国销量偏差预警'],
    ['trend', '近 7 日销售趋势', 'text', 'PRD §5.4 指标④：新品销售占比趋势（上新起 30 天）在本宽表中按近 7 日环比呈现'],
    ['st', '状态', 'status', '规则引擎：PRD §5.4 预警① 销量偏差 |偏差率| > 20% ⇒ 偏差风险'],
  ]

  /* 表 B · 物料库存监控表：物料主键＝合并品名；物料范围＝需监控的核心物料（桥表「新品信息表」圈定） */
  var COLS_STOCK = [
    ['wh1', '一级仓库', 'wh', 'SCM 仓主数据 · 一级仓库名称（**仅作分组展示，不参与任何计算/聚合**）'],
    ['wh2', '二级仓库', 'text', 'SCM 仓主数据 · 二级仓库名称（指标计算粒度）'],
    ['mat', '物料（合并品名）', 'text', '桥表「新品信息表」· 物料（合并品名）主键；共用物料只出现一行，不按新品拆、不打共用标'],
    ['whd', '仓库可售天数', 'days', 'PRD §5.4 指标⑤：物料可用库存 ÷ 仓物料订货日均（订货天数 N 默认 7）；< 7 天触发库存预警'],
    ['stdays', '仓预计门店可售天数', 'days', 'PRD §5.4 指标⑥：（仓库可用库存 + 门店库存 + 门店在途）÷ 门店成品物料销量；仅展示、不监控'],
    ['st', '状态', 'status', '规则引擎：PRD §5.4 预警② 库存 仓库可售天数 < 7 天 ⇒ 库存偏紧'],
  ]

  /* 两个视图（两个看板条目）。third＝第三维字段（表 A＝新品 / 表 B＝物料） */
  var BOARDS = [
    {
      id: 'bd-np-sales',
      name: '新品销售监控',
      grain: '仓 × 新品',
      kindOf: 'sales',
      cols: COLS_SALES,
      third: '新品名称',
      thirdKey: 'np',
      qspec: [
        ['一级仓库名称', 'sel', '一级仓库'],
        ['二级仓库名称', 'sel', '二级仓库'],
        ['新品名称', 'sel', '新品名称'],
      ],
      srcs: ['湖仓', '成品销售表', '分仓订单计算结果'],
      v: 'v1.3',
    },
    {
      id: 'bd-np-stock',
      name: '物料库存监控',
      grain: '仓 × 物料',
      kindOf: 'stock',
      cols: COLS_STOCK,
      third: '物料（合并品名）',
      thirdKey: 'mat',
      qspec: [
        ['一级仓库名称', 'sel', '一级仓库'],
        ['二级仓库名称', 'sel', '二级仓库'],
        ['物料（合并品名）', 'sel', '物料（合并品名）'],
      ],
      srcs: ['湖仓', '成品销售表', '物料销售出库表'],
      v: 'v1.3',
    },
  ]

  function byId(id) {
    return document.getElementById(id)
  }

  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function uniq(list) {
    var out = []
    list.forEach(function (v) {
      if (out.indexOf(v) < 0) out.push(v)
    })
    return out
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
  var missing = !seed || !Array.isArray(seed.sales) || !Array.isArray(seed.stock) || !seed.sales.length || !seed.stock.length
  if (missing) {
    console.warn(TAG + ' 没读到数据岛 #' + SEED_ID + '（两张表的 sales / stock 都要有）—— 检查 src/engine/monitorSeed.ts + main.tsx')
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

  /* 把数据岛行挂到各看板上（幂等：BD.extra 里已有条目就整体退出） */
  BOARDS.forEach(function (b) {
    b.rows = b.kindOf === 'sales' ? seed.sales : seed.stock
    b.statusOf = function (r) {
      if (b.kindOf === 'sales') return r.alert ? '偏差风险' : '正常'
      return r.alert ? '库存偏紧' : '正常'
    }
    b.cellsOf = function (r) {
      if (b.kindOf === 'sales') {
        return [r.wh1, r.wh2, r.np, r.fcavg, r.acavg, r.dev, r.natacavg, r.natdev, trendText(r.trend), b.statusOf(r)]
      }
      return [r.wh1, r.wh2, r.mat, r.whd, r.stdays, b.statusOf(r)]
    }
  })

  if (
    BD.extra.some(function (it) {
      return it && BOARDS.some(function (b) {
        return b.id === it.id
      })
    })
  ) {
    return /* 已注册过（不新增 window 全局，靠条目自身判定） */
  }

  /* 趋势列：环比 % 加方向箭头 —— 表里一眼看出「在涨还是在跌」（PRD 指标④ 的宽表形态） */
  function trendText(v) {
    var n = Number(v) || 0
    var arrow = n > 0.5 ? '↑' : n < -0.5 ? '↓' : '→'
    return arrow + ' ' + (n > 0 ? '+' : '') + n.toFixed(1) + '%'
  }

  /* ---------- 2) 筛选条（选项补全 + 级联） ---------- */
  function qbarState(id) {
    return (typeof BD_QF !== 'undefined' && BD_QF && BD_QF[id]) || {}
  }

  /** 每个下拉的选项：全部由**数据自动带出**（一级全量；二级随一级收敛；第三维随一级+二级收敛） */
  function optionLists(b) {
    var st = qbarState(b.id)
    var wh1 = st['一级仓库名称'] || ''
    var wh2 = st['二级仓库名称'] || ''
    var lists = {}
    lists['一级仓库名称'] = uniq(b.rows.map(function (r) {
      return r.wh1
    }))
    lists['二级仓库名称'] = uniq(
      b.rows
        .filter(function (r) {
          return !wh1 || r.wh1 === wh1
        })
        .map(function (r) {
          return r.wh2
        }),
    )
    lists[b.third] = uniq(
      b.rows
        .filter(function (r) {
          return (!wh1 || r.wh1 === wh1) && (!wh2 || r.wh2 === wh2)
        })
        .map(function (r) {
          return r[b.thirdKey]
        }),
    )
    return lists
  }

  /** 渲染后：按数据岛补全三个下拉的选项（她原生上限 40），并做级联；失效的选中值就地清空 */
  function fillQbarOptions(b) {
    var bar = document.querySelector('#bdMain .bd-qbar')
    if (!bar) return
    var st = qbarState(b.id)
    var lists = optionLists(b)
    var fields = bar.querySelectorAll('.bq-fld')
    Array.prototype.forEach.call(fields, function (f) {
      var lab = f.querySelector('label')
      var sel = f.querySelector('select')
      if (!lab || !sel) return
      var name = (lab.textContent || '').trim()
      var list = lists[name]
      if (!list) return
      var cur = st[name] || ''
      if (cur && list.indexOf(cur) < 0) {
        /* 级联后当前选中值不在新选项里 ⇒ 清掉（否则表格会按无效组合过滤成 0 行） */
        cur = ''
        if (typeof BD_QF !== 'undefined' && BD_QF && BD_QF[b.id]) BD_QF[b.id][name] = ''
      }
      var opts = '<option value="">全部</option>'
      list.forEach(function (v) {
        opts += '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>'
      })
      if (sel.innerHTML !== opts) sel.innerHTML = opts
    })
  }

  function boardOf(id) {
    var hit = null
    BOARDS.forEach(function (b) {
      if (b.id === id) hit = b
    })
    return hit
  }

  /* ---------- 3) 渲染后接管 ---------- */
  function afterOpen() {
    var b = boardOf(BD.cur)
    if (!b) return
    fillQbarOptions(b)
    if (typeof window.bdAudit === 'function') {
      window.bdAudit('新品监控 · ' + b.name + '（' + b.grain + '，' + b.rows.length + ' 行 · 演示态数据）', b.name)
    }
  }

  /* ---------- 4) 注册两个看板条目 + 挂筛选条 + 包 bdOpen / bfSet ---------- */
  BOARDS.forEach(function (b) {
    /* 她的查询条件表：挂上之后 bdBoardFiltersHtml 会走 bdQbarHtml（观远报表式筛选条） */
    if (typeof RPT_Q !== 'undefined' && RPT_Q && !RPT_Q[b.id]) {
      RPT_Q[b.id] = b.qspec
    } else if (typeof RPT_Q === 'undefined' || !RPT_Q) {
      console.warn(TAG + ' 没找到她的 RPT_Q —— 筛选条会退化成通用仓筛选')
    }
    BD.extra.push({
      id: b.id,
      n: b.name,
      _g: GROUP,
      srcs: b.srcs,
      rf: 'T+1',
      st: '已发布',
      v: b.v,
      kind: 'rpt', /* ⚠️ 用她的报表渲染路径（renderReport）= 纯大宽表；kind:'gen' 会强制加 KPI 块 + 随机趋势图 */
      flt: ['time', 'wh'],
      gen: {
        cols: b.cols,
        fixedRows: b.rows.map(function (r) {
          return b.cellsOf(r)
        }), /* ⚠️ 位置数组（bdGenRows 按 cols 序号映射）；别换成对象数组 */
      },
    })
  })

  var origOpen = window.bdOpen
  window.bdOpen = function (id) {
    var out = origOpen.apply(this, arguments)
    if (boardOf(id)) {
      try {
        afterOpen()
      } catch (e) {
        console.warn(TAG + ' 渲染后接管失败（看板仍会以固定行渲染）', e)
      }
    }
    return out
  }

  /* 筛选条件变化时（bfSet）重建选项：一级仓库变了 ⇒ 二级 / 第三维下拉跟着收敛 */
  if (typeof window.bfSet === 'function') {
    var origBfSet = window.bfSet
    window.bfSet = function (bid) {
      var out = origBfSet.apply(this, arguments)
      if (boardOf(bid)) {
        try {
          fillQbarOptions(boardOf(bid))
        } catch (e) {
          console.warn(TAG + ' 筛选条级联失败（不影响过滤本身）', e)
        }
      }
      return out
    }
  }

  /* 目录已渲染 ⇒ 立刻重渲染一次让两条条目出现；未渲染 ⇒ 她 init 时会带着 BD.extra 一起渲染 */
  if (byId('bdCatList')) {
    var q = byId('bdSearch')
    window.bdRenderCatalog(q ? q.value : '')
  }
  console.info(
    TAG +
      ' 已注册两个看板：' +
      BOARDS.map(function (b) {
        return '「' + b.name + '」' + b.rows.length + ' 行/ ' + b.cols.length + ' 列'
      }).join(' ｜ ') +
      '（表 A 仓×新品 · 表 B 仓×物料 · ' +
      seed.note.primaryWarehouses +
      ' 一级仓 / ' +
      seed.note.subWarehouses +
      ' 二级仓 / ' +
      seed.note.products +
      ' 新品 / ' +
      seed.note.materials +
      ' 物料 / 覆盖门店 ' +
      seed.note.stores +
      ' · PRD V7.9 §5.4「五、数据表结构」· 演示态数据）',
  )
})()