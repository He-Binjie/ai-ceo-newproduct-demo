import type { MonitorSalesRow, MonitorStockRow } from '../types'
import { monitorSalesRows, monitorStockRows } from '../data/mock'

/**
 * 「新品监控」看板（宿主问数壳里的看板清单条目）的数据岛 —— 写入当前文档的 DOM。
 *
 * 为什么要这一层：
 *   看板由 public/wenshu/np-monitor.js（她壳里跑的经典脚本）渲染，而数字必须来自我们的口径
 *   （硬约束：不能用她 bdRnd 随机数）。她的脚本读不到我们 React 模块里的 mock 对象，
 *   所以把同一份 mock 序列化成 <script type="application/json" id="np-monitor-seed"> 数据岛，
 *   由 np-monitor.js 在运行时读。
 *
 * 为什么不在 index.html / vite.config.ts 里构建期注入：
 *   tsconfig.node.json 是 module=nodenext，从 vite.config.ts 静态 import 本仓 app 侧文件会连带
 *   把 mock.ts 拉进 nodenext 项目 → mock.ts 里的 `from '../types'`（无后缀）直接 TS2835 报错。
 *
 * 为什么由 main.tsx 顶层同步调用：
 *   她注入的 <script defer>（wenshu.js → shell-bridge.js → np-monitor.js）与我们的
 *   <script type="module" src="/src/main.tsx"> 都是 defer，**按文档顺序执行**，main.tsx 在前
 *   ⇒ 模块求值时就写好数据岛，np-monitor.js 执行时一定读得到。
 *
 * ⚠️ 全部为**演示态数据**，不是业务定稿值。口径来源＝茶姬 PRD §5.4「五、数据表结构」（V7.9）：
 *   2026-09-26 rev5：**一张二级仓宽表 → 两张事实表**（6 项监控指标分属两个行粒度）
 *     · sales = 表 A · 新品销售监控表（仓 × 新品，①②③④ + 状态）130 行
 *     · stock = 表 B · 物料库存监控表（仓 × 物料（合并品名），⑤⑥ + 状态）325 行
 *   一级仓仅作分组列；禁止跨粒度聚合（表 B 不按新品上卷，共用物料只出现一行）。
 */

/** 表 A 行 → 数据岛行（键＝np-monitor.js 的 COLS 字段名） */
const salesRow = (r: MonitorSalesRow) => ({
  /** 一级仓库（分组列） */
  wh1: r.wh1,
  /** 二级仓库 */
  wh2: r.wh2,
  /** 新品名称 */
  np: r.product,
  /** ① 仓备货预测日均杯量 */
  fcavg: r.forecastCupsDaily,
  /** ② 仓实际日均杯量 */
  acavg: r.actualCupsDaily,
  /** ③ 仓偏差率（%） */
  dev: r.deviationPct,
  /** ③ 全国实际日均杯量（冗余列） */
  natacavg: r.nationalActualCupsDaily,
  /** ③ 全国偏差率（冗余列） */
  natdev: r.nationalDeviationPct,
  /** ④ 近 7 日销售趋势（环比 %） */
  trend: r.trendPct,
  /** 销量偏差预警：|偏差率| > 20% */
  alert: r.isDeviationAlert,
})

/** 表 B 行 → 数据岛行 */
const stockRow = (r: MonitorStockRow) => ({
  /** 一级仓库（分组列） */
  wh1: r.wh1,
  /** 二级仓库 */
  wh2: r.wh2,
  /** 物料（合并品名） */
  mat: r.material,
  /** ⑤ 仓库可售天数 */
  whd: r.sellableDays,
  /** ⑥ 仓预计门店可售天数（仅展示） */
  stdays: r.estStoreSellableDays,
  /** 库存预警：仓库可售天数 < 7 天 */
  alert: r.isStockAlert,
})

export interface MonitorSeed {
  source: string
  /** 口径说明（看板侧读它做 console 自检；页面上不再渲染解释文字） */
  note: {
    /** 一级仓库个数（仅分组列） */
    primaryWarehouses: number
    /** 二级仓库个数（指标计算粒度） */
    subWarehouses: number
    /** 覆盖门店合计（口径自检用：应 = 7,188；按二级仓去重，不按新品/物料重复计） */
    stores: number
    /** 新品个数（表 A） */
    products: number
    /** 物料（合并品名）个数（表 B） */
    materials: number
    /** 表 A 行数 */
    salesRows: number
    /** 表 B 行数 */
    stockRows: number
    /** 事实表粒度的「日期」维度在演示态按 T+1 快照呈现 */
    dataDate: string
  }
  /** 表 A · 新品销售监控表（仓 × 新品） */
  sales: Array<ReturnType<typeof salesRow>>
  /** 表 B · 物料库存监控表（仓 × 物料） */
  stock: Array<ReturnType<typeof stockRow>>
}

/** 演示态数据日期＝T+1 快照（updateDate 为「今天」） */
function snapshotDate(): string {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export function buildMonitorSeed(): MonitorSeed {
  return {
    source: 'src/data/mock.ts · monitorSalesRows / monitorStockRows（PRD §5.4「五、数据表结构」两张事实表：仓×新品 / 仓×物料）',
    note: {
      primaryWarehouses: Array.from(new Set(monitorSalesRows.map(r => r.wh1))).length,
      subWarehouses: Array.from(new Set(monitorSalesRows.map(r => r.wh2))).length,
      stores: monitorSalesRows
        .filter(r => r.product === monitorSalesRows[0].product)
        .reduce((a, r) => a + r.coversStores, 0),
      products: Array.from(new Set(monitorSalesRows.map(r => r.product))).length,
      materials: Array.from(new Set(monitorStockRows.map(r => r.material))).length,
      salesRows: monitorSalesRows.length,
      stockRows: monitorStockRows.length,
      dataDate: snapshotDate(),
    },
    sales: monitorSalesRows.map(salesRow),
    stock: monitorStockRows.map(stockRow),
  }
}

export const MONITOR_SEED_ID = 'np-monitor-seed'

/** 幂等写入（重复调用只是覆盖同一份内容）；解析失败的一方（np-monitor.js）会告警并放弃注册看板 */
export function writeMonitorSeedIsland(): MonitorSeed {
  const seed = buildMonitorSeed()
  let el = document.getElementById(MONITOR_SEED_ID) as HTMLScriptElement | null
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/json'
    el.id = MONITOR_SEED_ID
    document.body.appendChild(el)
  }
  el.textContent = JSON.stringify(seed) // textContent 不做 HTML 解析，天然避免 `</script>` 截断
  return seed
}