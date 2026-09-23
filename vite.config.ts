import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const WENSHU_GEN = path.resolve('src/skills/wenshu/generated')

/**
 * 合并问数模块（朱仙 V4.3）外壳注入 —— B 方案：同文档挂载 + 双向 CSS 作用域
 *
 * 为什么注入而不是手写 index.html：
 *   她的 markup（13KB）+ header 槽位（1.4KB）由 scripts/build-wenshu.mjs 生成，属于「她改了要跟着变」的产物；
 *   手写进 index.html 会形成第二份手维护的副本。
 *
 * 为什么她的 JS 用 classic + defer：
 *   她尾部有裸调用 opening(); initNews(); 且顶层有 addEventListener → 脚本只能执行一次；
 *   defer 保证「DOM 已解析完」才跑（等于她原来「放在 body 末尾」的时序），React 也拿不到重复执行的入口。
 */
function wenshuShell(): Plugin {
  let base = '/'
  return {
    name: 'ai-ceo-wenshu-shell',
    configResolved(cfg) {
      base = cfg.base
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html: string) {
        const read = (f: string) => {
          const p = path.join(WENSHU_GEN, f)
          if (!fs.existsSync(p)) {
            throw new Error(`[wenshu-shell] 缺少 ${p} —— 先跑 \`npm run build:wenshu\`（predev/prebuild 会自动跑）`)
          }
          return fs.readFileSync(p, 'utf8')
        }
        const markup = read('wenshu.markup.html')
        const header = read('wenshu.header.html')
        // 她的 <head> CDN 依赖（echarts / xlsx）→ 本地文件；`__BASE__` 由构建脚本留的占位符
        const vendor = read('wenshu.vendor.html').replaceAll('__BASE__', base.replace(/\/+$/, ''))
        const url = (p: string) => `${base.replace(/\/+$/, '')}/${p}`
        if (!html.includes('</head>') || !html.includes('</body>')) {
          throw new Error('[wenshu-shell] index.html 缺 </head> 或 </body>，注入位置找不到')
        }
        // 她的 CSS 用 <link>（不进 Vite 的 CSS 管线，避免被我们的 PostCSS 作用域插件再处理一遍）
        // 她的 JS 用 <script defer>（classic，非 module：她的代码依赖 window 全局，见 209 处 onclick）
        // 依赖顺序 = vendor（echarts/xlsx）→ wenshu.js → shell-bridge.js；都是 defer ⇒ 按文档顺序执行
        return html
          .replace('</head>', `    <link rel="stylesheet" href="${url('wenshu/wenshu.css')}" />\n  </head>`)
          .replace(
            '</body>',
            `${markup}${header}${vendor}\n` +
              `    <script src="${url('wenshu/wenshu.js')}" defer></script>\n` +
              `    <script src="${url('wenshu/shell-bridge.js')}" defer></script>\n  </body>`,
          )
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wenshuShell()],
  base: '/ai-ceo-newproduct-demo/',
  server: {
    port: 3003,
  },
})