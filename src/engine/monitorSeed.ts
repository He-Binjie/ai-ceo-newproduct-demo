import type { MonitorTrend, MonitorWarehouseRow, TrendPoint } from '../types'
import { monitorNational, monitorTrend, monitorWarehouses } from '../data/mock'

/**
 * 「新品监控」看板（朱仙问数壳里的看板清单条目）的数据岛 —— 写入当前文档的 DOM。
 *
 * 为什么要这一层：
 *   看板由 public/wenshu/np-monitor.js（她的壳里跑的经典脚本）渲染，而数字必须与分仓流程内一致
 *   （硬约束：不能用她 renderGen 默认的 bdRnd 随机数）。她的脚本读不到我们 React 模块里的 mock 对象，
 *   所以把同一份 mock 序列化成 <script type="application/json" id="np-monitor-seed"> 数据岛，
 *   由 np-monitor.js 在运行时读。
 *
 * 为什么不在 index.html / vite.config.ts 里构建期注入：
 *   tsconfig.node.json 是 module=nodenext，从 vite.config.ts 静态 import 本仓 app 侧文件会连带
 *   把 mock.ts 拉进 nodenext 项目 → mock.ts 里的 `from '../types'`（无后缀）直接 TS2835 报错；
 *   要么改 mock.ts 的 import 写法，要么改 tsconfig —— 都不如让「数据的所有者」（React 侧）自己写。
 *
 * 为什么由 main.tsx 顶层同步调用而不是 React 组件里写：
 *   她注入的 <script defer>（wenshu.js → shell-bridge.js → np-monitor.js）与我们的
 *   <script type="module" src="/src/main.tsx"> 都是 defer，**按文档顺序执行**，main.tsx 在前
 *   ⇒ 模块求值时就写好数据岛，np-monitor.js 执行时一定读得到（放进组件里则要等 React 提交，会有竞态）。
 */

/** 趋势压缩成 [[杯量, 占比], ...]，30 天 × 9 条 ≈ 4KB（原对象形态要 3 倍） */
const compact = (pts: TrendPoint[]): [number, number][] => pts.map((p) => [p.cups, p.share])

const row = (w: MonitorWarehouseRow) => ({
  n: w.warehouseName,
  t: w.warehouseType,
  coversStores: w.coversStores,
  forecast: w.forecastDailyCups,
  actual: w.actualDailyCups,
  dev: w.deviationPct,
  whDays: w.warehouseSellableDays,
  storeDays: w.storeSellableDays,
})

export interface MonitorSeed {
  source: string
  days: string[]
  national: ReturnType<typeof row>
  warehouses: Array<ReturnType<typeof row>>
  trend: { national: [number, number][]; byWarehouse: Record<string, [number, number][]> }
}

export function buildMonitorSeed(trend: MonitorTrend = monitorTrend): MonitorSeed {
  const byWarehouse: Record<string, [number, number][]> = {}
  Object.keys(trend.byWarehouse).forEach((k) => {
    byWarehouse[k] = compact(trend.byWarehouse[k])
  })
  return {
    source: 'src/data/mock.ts · monitorWarehouses / monitorNational / monitorTrend',
    days: trend.national.map((p) => p.date),
    national: row(monitorNational),
    warehouses: monitorWarehouses.map(row),
    trend: { national: compact(trend.national), byWarehouse },
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