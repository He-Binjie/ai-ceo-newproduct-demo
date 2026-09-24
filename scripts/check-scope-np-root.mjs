/**
 * P5 产物自检 —— 用 postcss 真正解析我们构建出来的 CSS（不靠 grep 猜）
 *
 *   node scripts/check-scope-np-root.mjs [dist/assets/index-xxx.css]
 *   不带参数 → 自动取 dist/assets/ 里唯一的 index-*.css
 *
 * 构建产物是 styles.css（应全部作用域化）+ wenshu-shell.css（按设计豁免作用域化）合并后的结果，
 * 所以「不在 #np-root 里的选择器」不能一律当失败 —— 用下面的 STANDALONE_WHITELIST 冻结豁免集合：
 *   · **白名单之外**出现未作用域选择器 = 我们的样式漏出去（真错，必须修）
 *   · 白名单里少了一条 = 只是清单过期（提示，不阻断）
 * 断言：① 无白名单之外的未作用域选择器 ② 关键选择器确实带前缀 ③ 没有裸 html/body（除豁免重置）
 *      ④ @keyframes 步进没被前缀 ⑤ :root 没被前缀（=2 条：styles.css 令牌 + shell 的 --shell-header-h）
 *      ⑥ postcss.parse 不抛 ⇒ 花括号配平
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const postcss = require('postcss')

/* src/wenshu-shell.css 的选择器（豁免作用域化的那一份）—— 它管的是两个顶层容器的可见性。
   新增/修改这个文件时要同步这里；多出未列出的全局选择器会让本脚本报错（= 防串味的闸门）。 */
const STANDALONE_WHITELIST = [
  'html',
  'body',
  'html[data-skill=wenshu] #np-root .main-content',
  'html[data-skill=wenshu] #np-root .app-header > .user-info > .clock',
  'html[data-skill=wenshu] #wenshu-header-center',
  'html[data-skill=wenshu] #wenshu-header-right',
  'html[data-skill=wenshu] #wenshu-root',
  'html[data-skill=wenshu] .header-center',
  '#wenshu-header-center',
  '#wenshu-header-right',
  '#wenshu-root',
]

const arg = process.argv[2]
const file = arg
  ? path.resolve(arg)
  : path.resolve(
      'dist/assets',
      fs.readdirSync('dist/assets').filter((f) => /^index-.*\.css$/.test(f)).sort().pop() ?? '',
    )
const css = fs.readFileSync(file, 'utf8')
const root = postcss.parse(css)

let rules = 0
let keyframeSteps = 0
const standalone = []
const globalKept = []
root.walkRules((r) => {
  const p = r.parent
  if (p && p.type === 'atrule' && /keyframes$/i.test(p.name)) {
    keyframeSteps++
    return
  }
  rules++
  for (const raw of r.selectors) {
    const s = raw.trim()
    if (s === ':root') globalKept.push(s)
    else if (!s.startsWith('#np-root')) standalone.push(s)
  }
})

const mustScope = ['.app-header', '.main-content', '.chat-panel', '.right-panel', '.card', '.data-table', '.table-fit', '*']
const missScope = mustScope.filter((sel) => !css.includes(sel === '*' ? '#np-root *' : `#np-root ${sel}`))

const norm = (a) => [...new Set(a.map((s) => s.replace(/\s*>\s*/g, ' > ')))].sort()
const found = norm(standalone)
const allowed = norm(STANDALONE_WHITELIST)
const leaked = found.filter((s) => !allowed.includes(s))
const staleWhitelist = allowed.filter((s) => !found.includes(s))

const out = {
  file: path.basename(file),
  bytes: Buffer.byteLength(css),
  parsed_rules: rules,
  keyframe_steps_untouched: keyframeSteps,
  global_root_kept: globalKept.length,
  standalone_selectors_found: found,
  leaked_outside_whitelist: leaked,
  stale_whitelist_entries: staleWhitelist,
  missing_scope_probe: missScope,
  prefixed_keyframe_step: /#np-root (0%|100%|from|to)\b/.test(css),
  prefixed_root: /#np-root :root|#np-root:root/.test(css),
}
out.PASS =
  out.leaked_outside_whitelist.length === 0 &&
  out.missing_scope_probe.length === 0 &&
  !out.prefixed_keyframe_step &&
  !out.prefixed_root &&
  out.global_root_kept === 2 &&
  out.keyframe_steps_untouched > 0
console.log(JSON.stringify(out, null, 2))
process.exit(out.PASS ? 0 : 1)