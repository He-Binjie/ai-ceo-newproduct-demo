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
  let isBuild = false
  return {
    name: 'ai-ceo-wenshu-shell',
    configResolved(cfg) {
      base = cfg.base
      isBuild = cfg.command === 'build'
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
        /**
         * ⚠️ base 只能补一次（2026-09-24 实测踩到，别改回去）：
         *   build —— vite 的 buildHtmlPlugin 不会给 index.html 里的绝对路径补 base，必须我们自己补（否则线上 404）。
         *   dev   —— vite dev 的 html 中间件**会**给绝对路径补 base，我们再补一次就成了
         *            `/ai-ceo-newproduct-demo/ai-ceo-newproduct-demo/wenshu/wenshu.js`；
         *            dev 的 SPA fallback 把 index.html（text/html）当脚本/CSS 返回 —— **HTTP 200、控制台不报错**，
         *            但她的 CSS/JS 一行都不生效 ⇒ 本地 dev 下她整个模块「只有壳、没样式、没交互」。
         * 判定口径：产物里 wenshu 的 src/href 必须是**单个** base 前缀（dev/build 都是）。
         */
        const rootBase = isBuild ? base.replace(/\/+$/, '') : ''
        const markup = read('wenshu.markup.html')
        const header = read('wenshu.header.html')
        // 她的 <head> CDN 依赖（echarts / xlsx）→ 本地文件；`__BASE__` 由构建脚本留的占位符
        const vendor = read('wenshu.vendor.html').replaceAll('__BASE__', rootBase)
        const url = (p: string) => `${rootBase}/${p}`
        if (!html.includes('</head>') || !html.includes('</body>')) {
          throw new Error('[wenshu-shell] index.html 缺 </head> 或 </body>，注入位置找不到')
        }
        // 她的 CSS 用 <link>（不进 Vite 的 CSS 管线，避免被我们的 PostCSS 作用域插件再处理一遍）
        // 她的 JS 用 <script defer>（classic，非 module：她的代码依赖 window 全局，见 209 处 onclick）
        // 依赖顺序 = vendor（echarts/xlsx）→ wenshu.js → shell-bridge.js → np-monitor.js；都是 defer ⇒ 按文档顺序执行
        // 数据岛 <script type="application/json" id="np-monitor-seed"> 由 src/main.tsx 在模块求值时同步写入
        //   （不在这里构建期生成：tsconfig.node.json 是 module=nodenext，从本文件 import app 侧 mock.ts 会连带
        //    把 mock.ts 拉进 nodenext 项目 → 它里面无后缀的 `from '../types'` 直接 TS2835。详见 src/engine/monitorSeed.ts）
        return html
          .replace('</head>', `    <link rel="stylesheet" href="${url('wenshu/wenshu.css')}" />\n  </head>`)
          .replace(
            '</body>',
            `${markup}${header}${vendor}\n` +
              `    <script src="${url('wenshu/wenshu.js')}" defer></script>\n` +
              `    <script src="${url('wenshu/shell-bridge.js')}" defer></script>\n` +
              `    <script src="${url('wenshu/np-monitor.js')}" defer></script>\n  </body>`,
          )
      },
    },
  }
}

/**
 * 自写 PostCSS 插件：给我们自己的 CSS 加 `#np-root ` 作用域前缀（B 方案 §3.5 · P5）
 *
 * 为什么自写而不是装 postcss-prefix-selector / postcss-prefixwrap：不引新依赖（her 侧作用域化也是自写状态机）。
 * 为什么不引 postcss 的类型：postcss 只是 vite 的传递依赖（hoist 在 node_modules 里），
 *   为了「哪 npm 不再提升它就静默挂掉」这种事，这里刻意不 import 它的类型，参数用 any 标注。
 *
 * 三条豁免 / 改写规则（都有理由，改动前先读注释）：
 *   ① `:root` 保持全局 —— 设计令牌与她的 wenshu.css 逐项一致（规格 §2），加前缀会打断两个子树共用同一套变量。
 *   ② `html` / `body` 元素选择器改写成 `#np-root` —— 与她对 her `html,body{}` 的处理对称。
 *      必须改，不能留全局：我们的 `body{line-height:1.6}` 若保持全局，会**继承进她的子树**（她 #wenshu-root
 *      规则里只声明了 font-family/background/color/font-size，没有 line-height）→ 正是 P5 要消除的串味。
 *      代价：真实 html/body 丢掉 UA margin 重置，见 src/wenshu-shell.css 里的全局兜底（那个文件豁免作用域化）。
 *   ③ `@keyframes` 内部的 `0%/from/to` 不前缀 —— 前缀会让动画整条失效。
 *   豁免文件：src/wenshu-shell.css（它的职责就是管两个顶层容器 #np-root / #wenshu-root 的可见性，加前缀立刻失效）
 *            + 任何 public/wenshu/**（她的产物走 <link>，本来不进 vite 的 CSS 管线，这里是纵深防御）。
 */
function scopeNpRoot(): any {
  const EXEMPT = ['/wenshu-shell.css', '/public/wenshu/']
  const GLOBAL_SELECTOR = /^:root$/
  const ROOT_ELEMENT = /^(html|body)$/
  const stats = { prefixed: 0, kept: 0, rewritten: 0 }
  return {
    postcssPlugin: 'ai-ceo-scope-np-root',
    Once(root: any, { result }: any) {
      const file = String(result.opts.from ?? '').replace(/\\/g, '/')
      if (EXEMPT.some((p) => file.includes(p))) {
        console.log(`[scope-np-root] 豁免（不加前缀）：${file}`)
        return
      }
      root.walkRules((rule: any) => {
        const parent = rule.parent
        if (parent && parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return
        rule.selectors = rule.selectors.map((sel: string) => {
          const s = sel.trim()
          if (GLOBAL_SELECTOR.test(s)) {
            stats.kept++
            return s
          }
          if (ROOT_ELEMENT.test(s)) {
            stats.rewritten++
            return '#np-root'
          }
          stats.prefixed++
          return `#np-root ${s}`
        })
      })
      if (file.includes('styles.css')) {
        console.log(
          `[scope-np-root] ${file.split('/').pop()}：前缀 ${stats.prefixed} 个选择器 / html,body 改写 ${stats.rewritten} / :root 保持全局 ${stats.kept}`,
        )
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wenshuShell()],
  base: '/ai-ceo-newproduct-demo/',
  css: {
    // 我们的 CSS 一律加 #np-root 作用域（P5）；她的 wenshu.css 走 <link>，不进这条管线
    postcss: { plugins: [scopeNpRoot()] },
  },
  server: {
    port: 3003,
  },
})