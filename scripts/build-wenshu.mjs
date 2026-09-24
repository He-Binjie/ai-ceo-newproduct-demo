/**
 * build-wenshu.mjs — 合并问数模块（B 方案 · 同文档挂载）构建脚本
 *
 * 唯一源：src/skills/wenshu/demo.v4.3-0921.raw.html（byte-identical 收编，她的原文件）
 * 产物：
 *   public/wenshu/wenshu.css            ← 她的 <style>，全部作用域化（prefix :is(#wenshu-root, #wenshu-header)）
 *   public/wenshu/wenshu.js             ← 她的内联 <script>，verbatim 不改一字
 *   src/skills/wenshu/generated/wenshu.markup.html   ← <div id="wenshu-root"> + 她 body 的子节点（去掉 .topbar 三块、去掉她的 <script>）
 *   src/skills/wenshu/generated/wenshu.header.html   ← 两个槽位 <div id="wenshu-header-center|right"> + 她 topbar 的 .topbar-center / .topbar-right（搬进我们 header）
 *   src/skills/wenshu/generated/wenshu.vendor.html   ← 她 <head> 的外链依赖（echarts / xlsx）→ 映射到 public/wenshu/vendor/ 本地文件
 *
 * ⚠️ 产物**不带 `hidden` 属性**：`hidden` 会被 UA 样式表解析成 `display:none`，
 *    而坑 1（echarts 在 display:none 容器 init → 0 宽高）正是靠「容器始终有真实尺寸」规避的。
 *    可见性完全交给 src/wenshu-shell.css（visibility / display 都在那儿）。
 *   src/skills/wenshu/generated/manifest.json        ← sha256 / 规则数 / 断言结果
 *
 * 铁律：断言失败 = 构建报错（她改了结构 → 构建脚本要跟着改，绝不静默放过）
 * 规格来源：work-wiki/ai-ceo/modules/新品分仓-Demo合并问数模块-B方案实施计划-20260923.md
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RAW = path.join(ROOT, 'src/skills/wenshu/demo.v4.3-0921.raw.html')
const GEN = path.join(ROOT, 'src/skills/wenshu/generated')
const PUB = path.join(ROOT, 'public/wenshu')

// 作用域前缀：
//  - #wenshu-root          = 她的整页（chat-panel + main-panel + 抽屉/遮罩/预警中心）
//  - #wenshu-header-center / #wenshu-header-right = 搬进我们 header 的 .topbar-center / .topbar-right（见规格 §3.3 方案 b）
// 规格 §3.5 只写了 #wenshu-root；搬移后她的 .topbar* 规则必须也能命中搬出去的节点，
// 故统一用 :is() 多根前缀（:is() 取最高特异性 = 单个 id，特异性与只写 #wenshu-root 一致）。
const SCOPE = ':is(#wenshu-root, #wenshu-header-center, #wenshu-header-right)'
const ROOT_SCOPE = '#wenshu-root'
const HEADER_SLOTS = [
  { id: 'wenshu-header-center', cls: 'topbar-center' },
  { id: 'wenshu-header-right', cls: 'topbar-right' },
]
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const problems = []
const assertions = []
function assert(name, ok, detail = '') {
  assertions.push({ name, ok: !!ok, detail })
  if (!ok) problems.push(`${name}${detail ? ' :: ' + detail : ''}`)
}

const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')
const fmt = (n) => n.toLocaleString('en-US')

/* ========================================================================
 * 1. CSS 作用域化（自带状态机，不引新依赖；解析无损性由「切片覆盖」断言保证）
 * ====================================================================== */

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const RAWTEXT_TAGS = new Set(['script', 'style', 'textarea', 'title'])

function skipString(css, i) {
  const q = css[i]
  i++
  while (i < css.length) {
    if (css[i] === '\\') { i += 2; continue }
    if (css[i] === q) return i + 1
    i++
  }
  return i
}
function skipComment(css, i) {
  const j = css.indexOf('*/', i + 2)
  return j < 0 ? css.length : j + 2
}
function readToBraceOrSemi(css, i, stopAt) {
  let pd = 0
  while (i < stopAt) {
    const c = css[i]
    if (c === '/' && css[i + 1] === '*') { i = skipComment(css, i); continue }
    if (c === '"' || c === "'") { i = skipString(css, i); continue }
    if (c === '(') pd++
    else if (c === ')') pd--
    else if (pd <= 0 && (c === '{' || c === ';')) return i
    i++
  }
  return i
}
/** i 指向 '{'，返回匹配 '}' 之后的下标（处理字符串/注释/嵌套花括号） */
function matchBlock(css, i, stopAt) {
  let d = 0
  while (i < stopAt) {
    const c = css[i]
    if (c === '/' && css[i + 1] === '*') { i = skipComment(css, i); continue }
    if (c === '"' || c === "'") { i = skipString(css, i); continue }
    if (c === '{') d++
    else if (c === '}') { d--; if (d === 0) return i + 1 }
    i++
  }
  return i
}
function splitTopLevelCommas(sel) {
  const parts = []
  let pd = 0, sd = 0, start = 0
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i]
    if (c === '"' || c === "'") { i = skipString(sel, i) - 1; continue }
    if (c === '(') pd++
    else if (c === ')') pd--
    else if (c === '[') sd++
    else if (c === ']') sd--
    else if (c === ',' && pd === 0 && sd === 0) { parts.push(sel.slice(start, i)); start = i + 1 }
  }
  parts.push(sel.slice(start))
  return parts
}

const stats = { atRules: 0, rules: 0, selectors: 0, keyframes: 0, passthrough: 0, bodyGated: 0, droppedBodyPrefix: 0, rootRules: 0 }
const pieces = [] // 覆盖校验：每段 [a,b) 必须无重叠、无遗漏拼回原文

function record(a, b) {
  const last = pieces[pieces.length - 1]
  if (last && last[1] !== a) throw new Error(`CSS 切片不连续：${last[1]} → ${a}`)
  pieces.push([a, b])
}

function scopeSelectorList(prelude, st) {
  const parts = splitTopLevelCommas(prelude)
  const out = parts.map((raw) => {
    const core = raw.trim()
    if (!core) return raw
    const preWs = raw.slice(0, raw.indexOf(core))
    const postWs = raw.slice(preWs.length + core.length)
    st.selectors++
    return preWs + scopeOneSelector(core, st) + postWs
  })
  return out.join(',')
}

function scopeOneSelector(sel, st) {
  if (sel === '*') return `${SCOPE} *`
  if (/^:root\b/.test(sel)) { st.rootRules++; return sel } // 设计令牌：双方逐项一致，保持全局（规格 §3.5）
  if (/^[>+~]/.test(sel)) throw new Error(`相对选择器（以组合器开头）未支持：${sel.slice(0, 80)}`)

  const m = /^(html|body)\b([^\s>+~]*)([\s\S]*)$/.exec(sel)
  if (m) {
    const lead = m[1].toLowerCase()
    const compounds = m[2] || ''
    const rest = (m[3] || '').trim()
    if (lead === 'html') {
      st.droppedBodyPrefix++
      if (!rest) return ROOT_SCOPE
      return `${SCOPE} ${rest}`
    }
    // body
    if (!compounds) {
      st.droppedBodyPrefix++
      return rest ? `${SCOPE} ${rest}` : ROOT_SCOPE
    }
    // body.<classes> —— 保留 body 类语义（她 JS 一行不改）
    st.bodyGated++
    return rest ? `body${compounds} ${SCOPE} ${rest}` : `body${compounds} ${ROOT_SCOPE}`
  }
  return `${SCOPE} ${sel}`
}

function scopeCss(css, dry = false) {
  let i = 0
  const n = css.length

  function walk() {
    let out = ''
    const emit = (a, b) => { out += css.slice(a, b); record(a, b) }
    while (i < n) {
      const c = css[i]
      if (c === '}') return out
      if (c === '/' && css[i + 1] === '*') { const s = i; i = skipComment(css, i); emit(s, i); continue }
      if (c === ';' || /\s/.test(c)) { emit(i, i + 1); i++; continue }

      const selStart = i
      i = readToBraceOrSemi(css, i, n)
      const prelude = css.slice(selStart, i)
      if (i >= n) { emit(selStart, i); return out }
      if (css[i] === ';') { emit(selStart, i + 1); i++; continue }

      // 到这里 css[i] === '{'
      const at = /^\s*@([\w-]+)/.exec(prelude)
      if (at) {
        const name = at[1].toLowerCase()
        stats.atRules++
        if (['media', 'supports', 'layer', 'container'].includes(name)) {
          emit(selStart, i + 1) // prelude + '{' 原样
          i++
          out += walk()
          if (css[i] === '}') { emit(i, i + 1); i++ } else throw new Error(`@${name} 未闭合`)
        } else {
          // @keyframes / @font-face / @page … 整块原样（不动内部百分比选择器）
          if (name === 'keyframes') stats.keyframes++
          else stats.passthrough++
          const bodyEnd = matchBlock(css, i, n)
          emit(selStart, bodyEnd)
          i = bodyEnd
        }
        continue
      }
      // 普通规则：选择器改写 + 声明块（含 '{'）原样
      const bodyEnd = matchBlock(css, i, n)
      out += dry ? prelude : scopeSelectorList(prelude, stats)
      record(selStart, i) // 选择器原文（覆盖校验用；输出里已被改写）
      emit(i, bodyEnd)
      stats.rules++
      i = bodyEnd
    }
    return out
  }

  const out = walk()
  if (i < n) throw new Error(`CSS 解析提前结束于 ${i}/${n}`)
  if (dry) return out
  // 覆盖断言：切片必须完整、无缝、有序地拼回原文
  const joined = pieces.map(([a, b]) => css.slice(a, b)).join('')
  assert('CSS 解析无损（切片拼回 == 原文）', joined === css, `len ${joined.length} vs ${css.length}`)
  // 括号平衡（防「丢掉 { / }」这类输出缺件）
  const open = (out.match(/\{/g) || []).length
  const close = (out.match(/\}/g) || []).length
  assert('CSS 输出花括号平衡', open === close && open > 0, `{ ${open} vs } ${close}`)
  return out
}

/** 统一入口：重置累积状态后跑一遍（dry=true 为 identity 模式：不发前缀，逐字复刻） */
function runTransform(css, dry = false) {
  pieces.length = 0
  for (const k of Object.keys(stats)) stats[k] = 0
  const out = scopeCss(css, dry)
  return { out, stats: { ...stats } }
}

/* ========================================================================
 * 2. HTML 拆分（自己扫 depth-0 子节点，无第三方 HTML 解析器）
 * ====================================================================== */

function findTagEnd(html, i) {
  let j = i
  while (j < html.length) {
    const c = html[j]
    if (c === '"' || c === "'") { j = skipString(html, j); continue }
    if (c === '>') return j
    j++
  }
  return html.length - 1
}
function scanTag(html, i) {
  const m = /^<(\/?)([a-zA-Z][\w-]*)/.exec(html.slice(i, i + 100))
  if (!m) return null
  return { closing: m[1] === '/', name: m[2].toLowerCase() }
}
/** 返回 body 内容里 depth-0 的元素/注释块列表（用标签名栈做深度跟踪） */
function topLevelChildren(html, start, end) {
  const items = []
  let i = start
  while (i < end) {
    if (html[i] !== '<') { i++; continue }
    if (html.startsWith('<!--', i)) {
      const j = html.indexOf('-->', i + 4)
      const stop = j < 0 ? end : j + 3
      items.push({ kind: 'comment', start: i, end: stop })
      i = stop
      continue
    }
    const t = scanTag(html, i)
    if (!t || t.closing) { i++; continue }
    const gt = findTagEnd(html, i)
    const selfClosing = html[gt - 1] === '/'
    if (selfClosing || VOID_TAGS.has(t.name)) {
      items.push({ kind: 'el', name: t.name, start: i, end: gt + 1, selfClosing: true })
      i = gt + 1
      continue
    }
    const stack = [t.name]
    let j = gt + 1
    while (j < end && stack.length) {
      const k = html.indexOf('<', j)
      if (k < 0) break
      if (html.startsWith('<!--', k)) { const c = html.indexOf('-->', k + 4); j = c < 0 ? end : c + 3; continue }
      const top = stack[stack.length - 1]
      if (RAWTEXT_TAGS.has(top)) {
        const closeIdx = html.toLowerCase().indexOf('</' + top, k)
        if (closeIdx < 0) { j = end; break }
        stack.pop()
        j = findTagEnd(html, closeIdx) + 1
        continue
      }
      const t2 = scanTag(html, k)
      if (!t2) { j = k + 1; continue }
      const gt2 = findTagEnd(html, k)
      if (t2.closing) {
        const at = stack.lastIndexOf(t2.name)
        if (at >= 0) stack.length = at
        else if (stack.length > 1) stack.pop()
        j = gt2 + 1
        continue
      }
      if (!VOID_TAGS.has(t2.name) && html[gt2 - 1] !== '/') stack.push(t2.name)
      j = gt2 + 1
    }
    items.push({ kind: 'el', name: t.name, start: i, end: j })
    i = j
  }
  return items
}
function attrsOf(html, start, end) {
  const gt = findTagEnd(html, start)
  const open = html.slice(start, gt + 1)
  const attrs = {}
  for (const m of open.matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)) attrs[m[1].toLowerCase()] = m[2]
  return attrs
}
const idsIn = (s) => [...s.matchAll(/\sid\s*=\s*"([^"]+)"/g)].map((m) => m[1])

/* ========================================================================
 * 3. 主流程
 * ====================================================================== */

if (!fs.existsSync(RAW)) {
  console.error(`✗ 找不到唯一源：${RAW}`)
  process.exit(1)
}
const raw = fs.readFileSync(RAW, 'utf8')
const rawSha = sha256(raw)

// --- 3.1 抓 <style> / 内联 <script> ---
const styleOpen = raw.indexOf('<style')
const styleStart = raw.indexOf('>', styleOpen) + 1
const styleEnd = raw.indexOf('</style>', styleStart)
if (styleOpen < 0 || styleEnd < 0) throw new Error('找不到 <style> 块')
const cssSource = raw.slice(styleStart, styleEnd)

const scriptRx = /<script(?![^>]*\ssrc=)[^>]*>/i
const sm = scriptRx.exec(raw)
if (!sm) throw new Error('找不到内联 <script> 块')
const jsStart = sm.index + sm[0].length
const jsEnd = raw.indexOf('</script>', jsStart)
const jsSource = raw.slice(jsStart, jsEnd)

// --- 3.1b <head> 里的外链依赖（echarts / xlsx）---
// 她的两个 CDN <script> 在 <head>：只抽 <body> 会把它们整块丢掉 →
// 问数模式的图表（echarts）与导出（xlsx）全废（她只能退化成「图表组件加载失败」文字）。
// 处理：按下表把 CDN 地址映射到仓库内本地文件（即规格 §6/§7 的「CDN 本地化」）。
// 为何提到 P2 而不留到 P7：P4 的硬验收指标「#trendChart/#invChart 的 canvas 宽高非 0」
// 要求 echarts 真的加载；而且对外演示现场断网 = CDN 白屏。
const VENDOR = [
  { match: /cdn\.jsdelivr\.net\/npm\/echarts@5\.5\.0\//, local: 'wenshu/vendor/echarts.min.js' },
  { match: /cdn\.jsdelivr\.net\/npm\/xlsx@0\.18\.5\//, local: 'wenshu/vendor/xlsx.full.min.js' },
]
const headInner = raw.slice(raw.indexOf('<head'), raw.indexOf('</head>'))
// ⚠️ 必须连结束标签一起抓：她写的是 `<script src=...></script>`（两个标签紧邻），
//    只抓开标签会把产物变成未闭合的 <script> → HTML 解析器会把它后面的 script 标签当成
//    它的文本内容吞掉（实测症状：xlsx 与 wenshu.js 整条不再加载，her 的函数全 undefined）。
const headScripts = [...headInner.matchAll(/<script\b[^>]*\ssrc\s*=\s*"([^"]+)"[^>]*>\s*<\/script\s*>/gi)].map((m) => ({ tag: m[0], src: m[1] }))
assert('她 <head> 里的外链依赖数 == 2（新增依赖要先补 VENDOR 表）', headScripts.length === 2, `实测 ${headScripts.length} 个`)
const vendorDeps = []
for (const hs of headScripts) {
  const hit = VENDOR.find((v) => v.match.test(hs.src))
  assert(`外链依赖已登记（${hs.src.slice(0, 56)}）`, !!hit, hit ? hit.local : '未登记 → 她加了新依赖，先补 VENDOR 表 + 下载到 public/wenshu/vendor/')
  if (!hit) continue
  const abs = path.join(ROOT, 'public', hit.local)
  assert(`本地依赖文件存在（${hit.local}）`, fs.existsSync(abs), '缺失 → 用 scripts/fetch-wenshu-vendor.sh 下载')
  const vjs = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : ''
  vendorDeps.push({ cdn: hs.src, local: hit.local, bytes: Buffer.byteLength(vjs), sha256: sha256(vjs), tag: hs.tag })
}
// 产物：`__BASE__` 由 vite.config.ts 的 wenshuShell 插件替换成 base；保留她原有的 onerror（她靠 __echarts_failed / __xlsx_failed 做缺依赖降级）。
const vendorInner = vendorDeps
  .map((d) => d.tag
    .replace(/<script\b/i, '<script defer')
    .replace(/src\s*=\s*"[^"]*"/i, 'src="__BASE__/' + d.local + '"')
    .replace(/\s*<\/script\s*>\s*$/i, '</script>'))
  .join('\n')
// 产物自检：script 开闭标签必须配平（不配平 = 解析器吞后面的标签，见上面的注释）
{
  const o = (vendorInner.match(/<script\b/g) || []).length
  const c = (vendorInner.match(/<\/script\s*>/g) || []).length
  assert('vendor 产物 <script> 开闭标签配平', o === c && o === vendorDeps.length, `开 ${o} / 闭 ${c}`)
}

// --- 3.2 CSS 作用域化 ---
// 先跑 identity（不发前缀）验证改写器逐字复刻，再跑真作用域化
const identity = runTransform(cssSource, true)
assert('CSS 改写器 identity 模式 == 原文（证明无丢件）', identity.out === cssSource,
  `len ${identity.out.length} vs ${cssSource.length}`)
const { out: cssScoped, stats: cssStats } = runTransform(cssSource, false)
// 输出侧自检：每条选择器都必须带作用域前缀（在 @media 内也要扫）
{
  // 去掉注释块与 @keyframes 整块，避免注释文本被当成选择器
  const cssForCheck = cssScoped
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@keyframes[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, '')
  const bad = []
  const selRe = /(^|\})(\s*)([^{}@;]+?)\s*\{/g
  let m
  while ((m = selRe.exec(cssForCheck))) {
    const sel = m[3].trim()
    if (!sel) continue
    for (const one of splitTopLevelCommas(sel)) {
      const s = one.trim()
      if (!s) continue
      if (s === ':root') continue
      const okScoped =
        s.startsWith(`${SCOPE} `) ||
        s.startsWith(`${SCOPE}*`) ||
        s.startsWith(`${ROOT_SCOPE}`) ||
        new RegExp(`^body(\\.[\\w-]+)+(:[\\w-]+(\\([^)]*\\))?)*\\s+(${escapeRe(SCOPE)}|${ROOT_SCOPE})`).test(s)
      if (!okScoped) bad.push(s.slice(0, 120))
    }
  }
  assert('CSS 输出无未作用域选择器', bad.length === 0, bad.slice(0, 8).join(' | '))
}

// --- 3.3 HTML 拆分 ---
const bodyOpen = raw.indexOf('<body')
const bodyTagEnd = raw.indexOf('>', bodyOpen)
const bodyClose = raw.indexOf('</body>')
assert('<body> 定位成功', bodyOpen > 0 && bodyClose > bodyTagEnd)
const bodyInner = raw.slice(bodyTagEnd + 1, bodyClose)
const bodyAttrs = attrsOf(raw, bodyOpen, bodyTagEnd + 1)

const children = topLevelChildren(bodyInner, 0, bodyInner.length)
const absRange = (it) => [bodyTagEnd + 1 + it.start, bodyTagEnd + 1 + it.end]
const sliceOf = (it) => { const [a, b] = absRange(it); return raw.slice(a, b) }

const topbar = children.find((it) => it.kind === 'el' && (attrsOf(bodyInner, it.start, it.end)['class'] || '').split(/\s+/).includes('topbar'))
assert('找到 .topbar 顶层块', !!topbar)
const topbarInner = topbar ? bodyInner.slice(topbar.start, topbar.end) : ''
const tbOpenEnd = findTagEnd(topbarInner, 0)
const tbChildren = topLevelChildren(topbarInner, tbOpenEnd + 1, topbarInner.length - 1)
const findTb = (cls) =>
  tbChildren.find((it) => it.kind === 'el' && (attrsOf(topbarInner, it.start, it.end)['class'] || '').split(/\s+/).includes(cls))
const tbCenter = findTb('topbar-center')
const tbRight = findTb('topbar-right')
const tbBrand = findTb('brand')
assert('找到 .topbar-center', !!tbCenter)
assert('找到 .topbar-right', !!tbRight)
assert('找到 .brand（将被丢弃）', !!tbBrand)
assert('.topbar 顶层子块数 == 3', tbChildren.filter((c) => c.kind === 'el').length === 3,
  tbChildren.filter((c) => c.kind === 'el').map((c) => (attrsOf(topbarInner, c.start, c.end)['class'] || '?')).join(','))

const headerInner = HEADER_SLOTS.map(({ id, cls }) => {
  const blk = findTb(cls)
  return `<div id="${id}">${blk ? topbarInner.slice(blk.start, blk.end) : ''}</div>`
}).join('\n')

// markup = body 子节点，去掉 .topbar（三块）与她的内联 <script>
const scriptItem = children.find((it) => it.kind === 'el' && it.name === 'script')
assert('body 内找到她的内联 <script>（应被抽走）', !!scriptItem)
const markupChildren = children.filter((it) => it !== topbar && it !== scriptItem)
const markupInner = markupChildren.map(sliceOf).join('')
const markup = '<!-- AUTO-GENERATED by scripts/build-wenshu.mjs — 不要手改；改她的原文件后 npm run build -->\n' +
  '<div id="wenshu-root">\n' + markupInner + '\n</div>\n'

// --- 3.4 id 账本 ---
const bodyMarkupOnly = children.filter((it) => it !== scriptItem).map((it) => bodyInner.slice(it.start, it.end)).join('')
const rawIds = idsIn(bodyMarkupOnly)
const markupIds = new Set(idsIn(markup))
const headerIds = new Set(idsIn(headerInner))
const brandBlock = tbBrand ? topbarInner.slice(tbBrand.start, tbBrand.end) : ''
const droppedIds = idsIn(brandBlock).filter((x) => !markupIds.has(x) && !headerIds.has(x))
const unaccounted = rawIds.filter((x) => !markupIds.has(x) && !headerIds.has(x) && !droppedIds.includes(x))
assert('所有 id 都有归属（markup/header/已丢弃）', unaccounted.length === 0, unaccounted.join(','))

// 她 JS 引用的 id 必须都能在最终 DOM 里找到
const jsIds = new Set([
  ...[...jsSource.matchAll(/getElementById\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
  ...[...jsSource.matchAll(/bdEl\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
])
// 运行时由 JS 的模板字符串生成的 id（实测：这些 id 只出现在她的 JS 片段里，不在静态 markup 中）
// 动态 id 由「静态 markup 里查不到」自动判定（见下面的断言），基线落在 scripts/wenshu-dynamic-ids.baseline.json
// 基线变化 = 她改了运行时生成逻辑 → 复核后用 `--update-baseline` 刷新
const dynamicIds = [...jsIds].filter((x) => !markupIds.has(x) && !headerIds.has(x)).sort()
const BASELINE_FILE = path.join(__dirname, 'wenshu-dynamic-ids.baseline.json')
if (process.argv.includes('--update-baseline')) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(dynamicIds, null, 2) + '\n', 'utf8')
  console.log(`[build-wenshu] 已刷新动态 id 基线：${dynamicIds.length} 条 → ${path.relative(ROOT, BASELINE_FILE)}`)
}
const DYNAMIC_BASELINE = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) : []
assert('动态 id 集合 == 基线（她改了运行时生成逻辑要复核）', DYNAMIC_BASELINE.length > 0 && dynamicIds.join('|') === [...DYNAMIC_BASELINE].sort().join('|'),
  dynamicIds.filter((x) => !DYNAMIC_BASELINE.includes(x)).concat(DYNAMIC_BASELINE.filter((x) => !dynamicIds.includes(x))).join(','))
// 真正的铁律：凡是**静态 markup 里有定义**的 id，她 JS 引用时必须在我们的产物里能找到
const staticMissing = dynamicIds.filter((x) => idsIn(bodyMarkupOnly).includes(x))
assert('她 JS 引用的静态 id 全在 markup/header 中', staticMissing.length === 0, staticMissing.join(','))

// --- 3.4b 宿主侧类名撞名闸门（2026-09-24 新增：实测踩过一次，代价是「她的按钮彻底失效」） ---
// 她的 JS 有 5 处 `document.querySelector[All](...)`，取的是**全文档**匹配；
// 而我们的 #root 在 DOM 顺序里排在她的 #wenshu-root 之前 ⇒ 宿主一旦用了同名 class，
// 她那行就会绑到**我们的**节点（实测：`document.querySelector('.skill-btn')` 绑到我们的按钮 →
// ① 她的「选择技能」按钮点不开弹层，永远选不到「新品分货」，跳不回我们页面
// ② 我们点自己的按钮反而会把她的弹层打开）。
// 对策：宿主侧禁用她 querySelector 用到的 class（我们已把 skill-btn 改名 np-skill-btn）＋ 这条闸门兜住复发。
// 判定细则：
//   · 带 `#id` 限定或属性选择器的选择器**不计**（如 `#dash .colmenu` —— 跨不了子树）
//   · 多 class 选择器（如 `.colmenu.open`）要求**每个 class 都命中宿主**才算撞（只命中一个不构成真实风险）
const herClassQueries = []
for (const m of jsSource.matchAll(/document\.querySelector(?:All)?\(\s*['"]([^'"]+)['"]\s*\)/g)) {
  const sel = m[1]
  if (sel.includes('#') || sel.includes('[')) continue
  const classes = [...sel.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((c) => c[1])
  if (classes.length) herClassQueries.push({ sel, classes })
}
const HOST_FILES = ['src/App.tsx', 'src/styles.css', 'src/index.css', 'src/App.css', 'src/wenshu-shell.css', 'index.html']
const hostPath = (f) => path.join(ROOT, f)
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, '$1 ')
const hostFiles = HOST_FILES.filter((f) => fs.existsSync(hostPath(f)))
const hostSrc = hostFiles.map((f) => stripComments(fs.readFileSync(hostPath(f), 'utf8'))).join('\n')
const classRe = (c) => new RegExp(`(^|[^\\w-])\\.?${escapeRe(c)}(?![\\w-])`)
const hasClass = (c) => classRe(c).test(hostSrc)
const classFiles = (c) => hostFiles.filter((f) => classRe(c).test(stripComments(fs.readFileSync(hostPath(f), 'utf8'))))
const classCollisions = herClassQueries.filter((q) => q.classes.every(hasClass))
assert('宿主侧未使用她 document.querySelector 用到的 class（撞名会静默劫走她的绑定）',
  classCollisions.length === 0,
  classCollisions.map((q) => `${q.sel} @ ${[...new Set(q.classes.flatMap(classFiles))].join(',')}`).join(' | ') +
  `（她 query 的选择器：${herClassQueries.map((q) => q.sel).join(' ')}）`)

// 关键 id 显式点名（规格 §7 P1 / 必做 2）
for (const must of ['bellPop', 'bcCur', 'navHome', 'navBoard', 'meMask', 'chatMsgs', 'alertBadge', 'wenshu-header-center', 'wenshu-header-right']) {
  const where = markupIds.has(must) ? 'root' : headerIds.has(must) ? 'header' : null
  assert(`关键 id #${must} 落位`, !!where, where || '缺失')
}

// --- 3.5 写产物 ---
fs.mkdirSync(PUB, { recursive: true })
fs.mkdirSync(GEN, { recursive: true })
fs.writeFileSync(path.join(PUB, 'wenshu.css'), cssScoped, 'utf8')
fs.writeFileSync(path.join(PUB, 'wenshu.js'), jsSource, 'utf8')
fs.writeFileSync(path.join(GEN, 'wenshu.markup.html'), markup, 'utf8')
fs.writeFileSync(path.join(GEN, 'wenshu.header.html'), '<!-- AUTO-GENERATED by scripts/build-wenshu.mjs — 不要手改 -->\n' + headerInner + '\n', 'utf8')
fs.writeFileSync(path.join(GEN, 'wenshu.vendor.html'), '<!-- AUTO-GENERATED by scripts/build-wenshu.mjs — 不要手改 -->\n' + vendorInner + '\n', 'utf8')
// 坑 1 的纹丝：产物里不能出现 hidden 属性（它 = display:none = echarts 量到 0×0）
assert('产物不含 hidden 属性（可见性只由 wenshu-shell.css 决定）',
  !/\shidden[\s>]/.test(markup) && !/\shidden[\s>]/.test(headerInner), '命中 hidden 属性')

const manifest = {
  generatedAt: new Date().toISOString(),
  source: { file: path.relative(ROOT, RAW), chars: raw.length, bytes: Buffer.byteLength(raw), sha256: rawSha },
  artifacts: {
    css: { file: 'public/wenshu/wenshu.css', chars: cssScoped.length, bytes: Buffer.byteLength(cssScoped), sourceChars: cssSource.length, sourceBytes: Buffer.byteLength(cssSource) },
    js: { file: 'public/wenshu/wenshu.js', chars: jsSource.length, bytes: Buffer.byteLength(jsSource), sha256: sha256(jsSource), verbatim: sha256(jsSource) === sha256(raw.slice(jsStart, jsEnd)) },
    markup: { file: 'src/skills/wenshu/generated/wenshu.markup.html', chars: markup.length, bytes: Buffer.byteLength(markup), topLevelChildren: markupChildren.filter((c) => c.kind === 'el').length },
    header: { file: 'src/skills/wenshu/generated/wenshu.header.html', chars: headerInner.length, bytes: Buffer.byteLength(headerInner), ids: [...headerIds] },
    vendor: { file: 'src/skills/wenshu/generated/wenshu.vendor.html', chars: vendorInner.length, deps: vendorDeps.map((d) => ({ cdn: d.cdn, local: d.local, bytes: d.bytes, sha256: d.sha256 })) },
  },
  css: {
    scopePrefix: SCOPE,
    rootScope: ROOT_SCOPE,
    rules: stats.rules,
    selectors: stats.selectors,
    atRules: stats.atRules,
    keyframesPassthrough: stats.keyframes,
    otherAtPassthrough: stats.passthrough,
    bodyGatedRules: stats.bodyGated,
    droppedBodyPrefix: stats.droppedBodyPrefix,
    rootTokenRules: stats.rootRules,
    important: (cssScoped.match(/!important/g) || []).length,
    mediaQueries: (cssScoped.match(/@media/g) || []).length,
  },
  js: {
    idsReferenced: jsIds.size,
    inlineOnclickAttr: (markup.match(/onclick=/g) || []).length,
    bodyClassNameWrites: (jsSource.match(/document\.body\.className\s*=/g) || []).length,
    bodyClassListOps: (jsSource.match(/document\.body\.classList\./g) || []).length,
  },
  ids: { bodyTotal: rawIds.length, inMarkup: markupIds.size, inHeader: headerIds.size, droppedWithBrand: droppedIds },
  hostClassGate: { herQuerySelectors: herClassQueries.map((q) => q.sel), hostFiles: HOST_FILES.filter((f) => fs.existsSync(hostPath(f))), collisions: classCollisions.map((q) => q.sel) },
  bodyAttrs,
  assertions,
}

assert('JS 产物 verbatim（sha256 与源切片一致）', manifest.artifacts.js.verbatim)
fs.writeFileSync(path.join(GEN, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

// --- 3.6 报告 ---
console.log('\n[build-wenshu] 朱仙 V4.3-0921 → 合并问数模块产物')
console.log(`  源        ${path.relative(ROOT, RAW)}  ${fmt(raw.length)} B  sha256 ${rawSha.slice(0, 12)}…`)
console.log(`  CSS       ${fmt(cssSource.length)} B → ${fmt(cssScoped.length)} B ｜ ${stats.rules} 规则 / ${stats.selectors} 选择器 / ${stats.atRules} at-rule / ${stats.keyframes} keyframes 原样`)
console.log(`            作用域前缀 ${SCOPE}；body 门控 ${stats.bodyGated} 条；丢 body/html 前缀 ${stats.droppedBodyPrefix} 条；:root 令牌保持全局 ${stats.rootRules} 条`)
console.log(`  JS        ${fmt(jsSource.length)} B verbatim  sha256 ${manifest.artifacts.js.sha256.slice(0, 12)}…`)
console.log(`  markup    ${fmt(markup.length)} 字符 / ${fmt(Buffer.byteLength(markup))} B ｜ 顶层子节点 ${manifest.artifacts.markup.topLevelChildren} ｜ id ${markupIds.size}`)
console.log(`  vendor    本地化 ${vendorDeps.length} 个依赖 ｜ ${vendorDeps.map((d) => d.local.split('/').pop() + ' ' + fmt(d.bytes) + 'B').join(' ｜ ')}`)
console.log(`  header    ${fmt(headerInner.length)} B ｜ id ${headerIds.size}（${[...headerIds].join(', ')}）`)
console.log(`  丢弃      .brand 块 ${brandBlock.length} B${droppedIds.length ? '（id: ' + droppedIds.join(', ') + '）' : '（无 id）'}`)
console.log(`  断言      ${assertions.filter((a) => a.ok).length}/${assertions.length} 通过`)
if (problems.length) {
  console.error('\n✗ [build-wenshu] 断言失败（她可能改了结构 → 先看下面的断言，再改构建脚本）：')
  for (const p of problems) console.error('   - ' + p)
  process.exit(1)
}
console.log('✓ [build-wenshu] 全部断言通过\n')