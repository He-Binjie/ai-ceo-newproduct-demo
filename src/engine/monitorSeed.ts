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
 * 2026-09-24 改版：
 *   ① 看板收敛成「一个大宽表」（彬节：删掉 KPI 卡与趋势图、仓库按茶姬真实清单铺开）
 *   ② 粒度改为**二级仓 × 核心物料**（彬节：「要按照二级仓的数据展示，二级仓的数量应该够多，
 *      每一种物料都有很多个二级仓，核心物料大概四五种」）→ 数据岛 = 120 行
 *      （5 种物料 × 24 个一级仓下的二级仓），不再带 30 天趋势。
 */

const row = (w: MonitorSubWhRow) => ({
  wh1: w.wh1,
  wh2: w.wh2,
  sub: w.subsidiary,
  /** 合并品名 */
  mat: w.material,
  unit: w.unit,
  stores: w.coversStores,
  /** 备货预测量（该二级仓该物料） */
  fc: w.forecastQty,
  /** 实际消耗 */
  ac: w.actualQty,
  dev: w.deviationPct,
  /** 仓库可售天数 */
  whd: w.sellableDays,
})

export interface MonitorSeed {
  source: string
  /** 口径说明（渲染在看板脚注里，避免「数据哪来的」被追问） */
  note: {
    materials: string[]
    subWarehouses: number
    primaryWarehouses: number
    rows: number
  }
  rows: Array<ReturnType<typeof row>>
}

export function buildMonitorSeed(): MonitorSeed {
  return {
    source: 'src/data/mock.ts · monitorSubWarehouses（二级仓 × 核心物料）',
    note: {
      materials: Array.from(new Set(monitorSubWarehouses.map(r => r.material))),
      subWarehouses: Array.from(new Set(monitorSubWarehouses.map(r => r.wh2))).length,
      primaryWarehouses: Array.from(new Set(monitorSubWarehouses.map(r => r.wh1))).length,
      rows: monitorSubWarehouses.length,
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