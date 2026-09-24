import type { MonitorWarehouseRow } from '../types'
import { monitorNational, monitorWarehouses } from '../data/mock'

/**
 * 「新品监控」看板（朱仙问数壳里的看板清单条目）的数据岛 —— 写入当前文档的 DOM。
 *
 * 为什么要这一层：
 *   看板由 public/wenshu/np-monitor.js（她的壳里跑的经典脚本）渲染，而数字必须与分仓流程内一致
 *   （硬约束：不能用她 bdRnd 随机数）。她的脚本读不到我们 React 模块里的 mock 对象，
 *   所以把同一份 mock 序列化成 <script type="application/json" id="np-monitor-seed"> 数据岛，
 *   由 np-monitor.js 在运行时读。
 *
 * 为什么不在 index.html / vite.config.ts 里构建期注入：
 *   tsconfig.node.json 是 module=nodenext，从 vite.config.ts 静态 import 本仓 app 侧文件会连带
 *   把 mock.ts 拉进 nodenext 项目 → mock.ts 里的 `from '../types'`（无后缀）直接 TS2835 报错；
 *   要么改 mock.ts 的 import 写法，要么改 tsconfig —— 都不如让「数据的所有者」（React 侧）自己写。
 *
 * 为什么由 main.tsx 顶层同步调用：
 *   她注入的 <script defer>（wenshu.js → shell-bridge.js → np-monitor.js）与我们的
 *   <script type="module" src="/src/main.tsx"> 都是 defer，**按文档顺序执行**，main.tsx 在前
 *   ⇒ 模块求值时就写好数据岛，np-monitor.js 执行时一定读得到。
 *
 * 2026-09-24 改版：看板收敛成「一个大宽表」（彬节：删掉 KPI 卡与趋势图、仓库要按茶姬真实清单铺开）
 *   ⇒ 数据岛只剩 24 仓明细 + 全国合计，**不再带 30 天趋势**（趋势图已删）。
 */

const row = (w: MonitorWarehouseRow) => ({
  n: w.warehouseName,
  t: w.warehouseType,
  sub: w.subsidiary || '',
  prov: w.province || '',
  stores: w.coversStores,
  fc: w.forecastDailyCups,
  ac: w.actualDailyCups,
  dev: w.deviationPct,
  whd: w.warehouseSellableDays,
  std: w.storeSellableDays,
})

export interface MonitorSeed {
  source: string
  national: ReturnType<typeof row>
  warehouses: Array<ReturnType<typeof row>>
}

export function buildMonitorSeed(): MonitorSeed {
  return {
    source: 'src/data/mock.ts · monitorWarehouses / monitorNational',
    national: row(monitorNational),
    warehouses: monitorWarehouses.map(row),
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