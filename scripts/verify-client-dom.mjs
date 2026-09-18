/**
 * dsh-model-detector — client 半区**真实渲染**回归（npm run verify:client-dom）。
 *
 * 用 jsdom + 真实 React 渲染**已构建产物 lib/client.js 里的 ModelCatalogPage**，
 * 打桩 fetch 模拟 host，复现用户报告过的操作序列：
 *
 *   读取现有模型 → 改三条 → 点第一条的「保存」
 *
 * 修复前实测（同一脚本、同一序列）：
 *   ✗ 保存后三条按钮全变「已保存」（用户看到的正是这个）
 *   ✗ model-b / model-c 的编辑被**悄悄丢弃**（值回退成服务端旧值）
 * 修复后：只有被保存那条变「已保存」，其余仍是「保存」，编辑原样保留。
 *
 * 这是 verify-client.mjs（纯函数）的补充：那边证明算法对，这边证明**接进 React、
 * 走完 fetch 往返之后**界面真的对。需要先 npm run build（读 lib/client.js）。
 *
 * 依赖来自 DSH checkout（jsdom / react / react-dom）：设 DSH_CHECKOUT 或默认
 * ~/Documents/GitHub/deepseek-harness。跑不了时**跳过**（不算失败），不阻塞打包。
 */
import { createRequire } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const co = process.env.DSH_CHECKOUT ?? join(process.env.USERPROFILE ?? '', 'Documents', 'GitHub', 'deepseek-harness')
/** checkout 的 node_modules（pnpm：jsdom 被提升，react/react-dom 在 .pnpm/node_modules）。 */
const coNm = join(co, 'node_modules')
const hoisted = join(coNm, '.pnpm', 'node_modules')
const require = createRequire(join(root, 'package.json'))

const reqFrom = (dir, id) => createRequire(join(dir, 'noop.js'))(id)
const resolveFrom = (dir, id) => createRequire(join(dir, 'noop.js')).resolve(id)

/** 依赖/产物缺失 → 跳过（本脚本是"锦上添花"的界面回归，不该让 prepack 挂掉）。 */
const skip = (why) => { console.log(`· 跳过真实渲染回归：${why}`); process.exit(0) }
if (!existsSync(join(root, 'lib', 'client.js'))) skip('lib/client.js 不存在（先 npm run build）')
if (!existsSync(join(coNm, 'jsdom'))) skip(`找不到 jsdom（DSH checkout: ${co}）`)

const { JSDOM } = reqFrom(coNm, 'jsdom')

// 先算好路径再装 hook —— hook 里不能再调 require.resolve（会递归回自己）
const REACT_PATH = resolveFrom(hoisted, 'react')
const REACT_JSX_PATH = resolveFrom(hoisted, 'react/jsx-runtime')
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
// Node 24 的 globalThis.navigator 是 getter-only，用 defineProperty 覆盖
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Element = dom.window.Element
globalThis.Node = dom.window.Node
globalThis.Event = dom.window.Event
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = reqFrom(hoisted, 'react')
const ReactDOMClient = reqFrom(hoisted, 'react-dom/client')
const { act } = reqFrom(hoisted, 'react-dom/test-utils')

// ── host 打桩 ───────────────────────────────────────────────────────────────
let serverModels = [
  { id: 'model-a', current: { id: 'model-a', name: 'A', contextWindow: 1000000, maxTokens: 384000, input: ['text'] } },
  { id: 'model-b', current: { id: 'model-b', name: 'B', contextWindow: 1000000, maxTokens: 384000, input: ['text'] } },
  { id: 'model-c', current: { id: 'model-c', name: 'C', contextWindow: 1000000, maxTokens: 384000, input: ['text'] } },
]
const saveCalls = []
const currentBody = () => ({
  ok: true, route: 'stub', ns: 'llm-pi-ai', target: 'pi-ai', hasModelsList: true,
  reasoningLevels: [], writable: true, declaredCount: 0,
  models: serverModels.map((m) => ({ ...m, suggested: {}, suggestedSource: '', configured: true })),
})
globalThis.fetch = async (url, init = {}) => {
  const path = String(url)
  if (path.endsWith('/providers')) {
    return { json: async () => ({ ok: true, providers: [{ route: 'stub', displayName: 'Stub', api: 'openai-completions', baseURL: 'http://x', modelCount: serverModels.length, inManifest: true }] }) }
  }
  if (path.endsWith('/current')) return { json: async () => currentBody() }
  if (path.endsWith('/save-model')) {
    const body = JSON.parse(init.body)
    saveCalls.push(body.model.id)
    const i = serverModels.findIndex((m) => m.id === body.model.id)
    if (i >= 0) serverModels[i] = { id: body.model.id, current: { ...body.model } }
    return { json: async () => ({ ok: true, id: body.model.id, ns: 'llm-pi-ai', key: 'models' }) }
  }
  return { json: async () => ({ ok: false, error: `unexpected ${path}` }) }
}

// ── 加载已构建产物 ──────────────────────────────────────────────────────────
const Module = require('module')
const bundlePath = join(root, 'lib', 'client.js')
let captured = null
globalThis.window.__ModuleLoader__ = { load: (entry) => { captured = entry } }
const origResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
  // 必须返回**路径**（不是模块对象）；且不能在这里调 require.resolve（会递归回本 hook）
  if (request === 'react') return REACT_PATH
  if (request === 'react/jsx-runtime') return REACT_JSX_PATH
  return origResolve.call(this, request, ...rest)
}
const mod = new Module(bundlePath)
mod.filename = bundlePath
mod.paths = Module._nodeModulePaths(root)
mod._compile(readFileSync(bundlePath, 'utf8'), bundlePath)
if (captured === null) { console.error('✕ 没捕获到 ModuleLoader 条目'); process.exit(1) }
const plugin = captured.factory((id) => require(id))

let Page = null
const slots = { inject: (_n, fn) => fn(), register: (_meta, render) => { Page = render } }
plugin.apply({ get: () => slots, slots, effect: (fn) => fn() })
if (Page === null) { console.error('✕ 没拿到页面组件'); process.exit(1) }

let pass = 0, fail = 0
const ok = (label, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${label}`) } else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`) } }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const flush = async (ms = 60) => { await act(async () => { await sleep(ms) }) }

/** 页面上每张编辑卡片的 [模型号, 主按钮文案, 是否禁用]。 */
const readCards = () => [...document.querySelectorAll('.mc-entry')].map((el) => {
  const id = el.querySelector('.mc-id')?.textContent ?? ''
  const btn = el.querySelector('.mc-entryActions .mc-btnPrimary')
  return { id, label: btn?.textContent ?? '', disabled: btn?.disabled ?? null }
})

const container = document.getElementById('root')
const reactRoot = ReactDOMClient.createRoot(container)

console.log('dsh-model-detector — 真实组件行为验证（jsdom + lib/client.js）\n')

await act(async () => { reactRoot.render(React.createElement(Page)) })
await flush()
ok('提供方已加载', document.querySelector('.mc-select')?.options.length > 0)

// 切到「编辑现有模型」
const segEdit = [...document.querySelectorAll('.mc-seg')].find((b) => b.textContent?.includes('编辑现有模型'))
await act(async () => { segEdit.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
await flush()

// 「读取现有模型」
const readBtn = [...document.querySelectorAll('.mc-btn')].find((b) => b.textContent?.includes('读取现有模型'))
await act(async () => { readBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
await flush()
let cards = readCards()
ok('读到三条模型', cards.length === 3, JSON.stringify(cards.map((c) => c.id)))
ok('初始全部「已保存」', cards.every((c) => c.label.includes('已保存')), JSON.stringify(cards))

// ── 改三条：a 换模态、b 改上下文、c 改输出上限 ────────────────────────────
const cardEl = (id) => [...document.querySelectorAll('.mc-entry')].find((el) => el.querySelector('.mc-id')?.textContent === id)
const clickIn = async (id, selector, text) => {
  const el = cardEl(id)
  const target = text === undefined
    ? el.querySelector(selector)
    : [...el.querySelectorAll(selector)].find((b) => b.textContent?.trim() === text)
  if (!target) throw new Error(`${id} 找不到 ${selector} ${text ?? ''}`)
  await act(async () => { target.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await flush(20)
}
const typeIn = async (id, index, value) => {
  const el = cardEl(id)
  const input = el.querySelectorAll('.mc-input')[index]
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set
  await act(async () => {
    setter.call(input, value)
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
  await flush(20)
}

await clickIn('model-a', '.mc-seg', '图像')      // 勾上图像模态
await typeIn('model-b', 1, '2000000')            // 上下文
await typeIn('model-c', 2, '128000')             // 输出上限

cards = readCards()
ok('三条都显示「保存」（未保存）', cards.every((c) => c.label.trim() === '保存'), JSON.stringify(cards))
const unsavedBadge = document.querySelector('.mc-unsaved')
ok('顶部提示「未保存 3 条」', unsavedBadge?.textContent?.includes('3'), unsavedBadge?.textContent ?? '(无)')

// ── 关键一步：只点 model-a 的「保存」 ──────────────────────────────────────
await act(async () => {
  cardEl('model-a').querySelector('.mc-entryActions .mc-btnPrimary')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
await flush(120)

ok('只发出了 1 次保存请求', saveCalls.length === 1, JSON.stringify(saveCalls))
ok('保存的是 model-a', saveCalls[0] === 'model-a', String(saveCalls[0]))

cards = readCards()
console.log(`    保存后按钮文案：${JSON.stringify(cards.map((c) => `${c.id}=${c.label.trim()}`))}`)
ok('model-a 变「已保存」', cards.find((c) => c.id === 'model-a')?.label.includes('已保存'))
ok('model-b 仍显示「保存」（未被误报已保存）', cards.find((c) => c.id === 'model-b')?.label.trim() === '保存', cards.find((c) => c.id === 'model-b')?.label)
ok('model-c 仍显示「保存」（未被误报已保存）', cards.find((c) => c.id === 'model-c')?.label.trim() === '保存', cards.find((c) => c.id === 'model-c')?.label)
ok('model-b 的未保存编辑还在（值没被重建冲掉）', cardEl('model-b').querySelectorAll('.mc-input')[1].value === '2000000', cardEl('model-b').querySelectorAll('.mc-input')[1].value)
ok('model-c 的未保存编辑还在', cardEl('model-c').querySelectorAll('.mc-input')[2].value === '128000', cardEl('model-c').querySelectorAll('.mc-input')[2].value)

// ── 再保存 model-b：只剩 model-c 未保存 ───────────────────────────────────
await act(async () => {
  cardEl('model-b').querySelector('.mc-entryActions .mc-btnPrimary')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
await flush(120)
cards = readCards()
ok('保存 model-b 后只剩 model-c 未保存',
  cards.find((c) => c.id === 'model-a')?.label.includes('已保存')
  && cards.find((c) => c.id === 'model-b')?.label.includes('已保存')
  && cards.find((c) => c.id === 'model-c')?.label.trim() === '保存',
  JSON.stringify(cards.map((c) => `${c.id}=${c.label.trim()}`)))
ok('顶部提示更新为「未保存 1 条」', document.querySelector('.mc-unsaved')?.textContent?.includes('1'), document.querySelector('.mc-unsaved')?.textContent ?? '(无)')

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
