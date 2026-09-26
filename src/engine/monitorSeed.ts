import type { MonitorSubWhRow } from '../types'
import { monitorSubWarehouses } from '../data/mock'

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
 * 2026-09-26 改版（彬节）：
 *   ① 粒度由「二级仓 × 核心物料（120 行）」收敛为**二级仓库一行**（65 行）——
 *      一级仓库 / 二级仓库 换成茶姬 SCM 仓主数据（她报表「一级仓库名称 + 二级仓库名称」同一口径）
 *   ② 指标名与口径严格对齐 PRD V7.8 §5.4 六项监控指标（①②③④⑤⑥），不再用「备货预测量 / 实际消耗」
 *      这类自造列名；PRD 六项里 4 项是仓维度定义，故按仓一行。
 */

const row = (w: MonitorSubWhRow) => ({
  /** 一级仓库名称 */
  wh1: w.wh1,
  /** 二级仓库名称 */
  wh2: w.wh2,
  /** 覆盖门店 */
  stores: w.coversStores,
  /** ① 仓备货预测日均杯量 */
  fcavg: w.forecastCupsDaily,
  /** ② 仓实际日均杯量 */
  acavg: w.actualCupsDaily,
  /** ③ 仓偏差率（%） */
  dev: w.deviationPct,
  /** ④ 近 7 日销售趋势（环比 %） */
  trend: w.trendPct,
  /** ⑤ 仓库可售天数 */
  whd: w.sellableDays,
  /** ⑥ 仓预计门店可售天数（仅展示、不监控） */
  stdays: w.estStoreSellableDays,
})

export interface MonitorSeed {
  source: string
  /** 口径说明（看板侧读它做 console 自检；页面上不再渲染解释文字） */
  note: {
    /** 一级仓库个数 */
    primaryWarehouses: number
    /** 二级仓库个数 */
    subWarehouses: number
    rows: number
    /** 覆盖门店合计（口径自检用：应 = 7,188） */
    stores: number
  }
  rows: Array<ReturnType<typeof row>>
}

export function buildMonitorSeed(): MonitorSeed {
  return {
    source: 'src/data/mock.ts · monitorSubWarehouses（茶姬 SCM 仓主数据：二级仓库 × PRD §5.4 六项监控指标）',
    note: {
      primaryWarehouses: Array.from(new Set(monitorSubWarehouses.map(r => r.wh1))).length,
      subWarehouses: Array.from(new Set(monitorSubWarehouses.map(r => r.wh2))).length,
      rows: monitorSubWarehouses.length,
      stores: monitorSubWarehouses.reduce((a, r) => a + r.coversStores, 0),
    },
    rows: monitorSubWarehouses.map(row),
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