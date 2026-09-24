import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
// 合并问数模块外壳（可见性切换）：故意不参与 #np-root 作用域化，见文件头注释
import './wenshu-shell.css'
import { writeMonitorSeedIsland } from './engine/monitorSeed'

/**
 * 数据岛必须在 React 渲染前**同步**写好（2026-09-24）：
 *   「新品监控」看板跑在朱仙的壳里（public/wenshu/np-monitor.js），它靠
 *   <script type="application/json" id="np-monitor-seed"> 读我们的监控 mock，
 *   以保证看板数字与分仓流程内一致（不能用她 renderGen 的随机数）。
 *   我们的 <script type="module" src="/src/main.tsx"> 与她注入的三条 <script defer> 都是 defer、
 *   按文档顺序执行 —— 这里位于模块求值阶段，一定早于 np-monitor.js。
 *   ⚠️ 不要挪进 React 组件：组件要等提交，np-monitor.js 可能先跑（竞态后看板注册不上）。
 */
writeMonitorSeedIsland()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)