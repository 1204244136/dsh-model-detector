/**
 * dsh-model-detector — client 半区草稿逻辑回归测试（npm run verify:client）。
 *
 * 直接 import src/client/drafts.ts（纯函数、无 JSX、无 React、无 DOM），
 * 覆盖用户报告过的那个 bug：
 *
 *   「编辑现有模型」有多条改动时，点一个「保存」，所有卡片的按钮都变成「已保存」，
 *    而其余几条其实一个字节都没写进配置 —— 改动还被悄悄丢掉了。
 *
 * 成因有两处，都必须有用例守着（任一回归都会重现该现象）：
 *  ① 保存某条后用服务端返回值**整体重建** drafts → 其余卡片的未保存编辑被丢弃，
 *    而 dirty 是「草稿 vs 服务端」算出来的 → 它们的按钮一起变「已保存」。
 *     （mergeDrafts 的 syncIds 语义）
 *  ② dirty 判定把语义相同的草稿判成不同（如 efforts / input 顺序不同），
 *    或对手填的新模型（服务端还没有）返回「不脏」→ 按钮显示「已保存」且禁用。
 *
 * 运行：node scripts/verify-client.mjs（需 Node ≥ 22.6 的 TS 类型擦除；本项目要求 Node 24）
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

let D
try {
  D = await import(pathToFileURL(join(root, 'src', 'client', 'drafts.ts')).href)
} catch (e) {
  console.error(`✕ 无法 import src/client/drafts.ts（需要 Node ≥ 22.6 的 TS 类型擦除）\n  ${String(e?.message ?? e)}`)
  process.exit(1)
}

let pass = 0
let fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) } else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`) }
}
const eq = (label, got, want) => ok(label, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`)

console.log(`dsh-model-detector v${pkg.version} — client 草稿逻辑回归`)

// ── 场景搭建：三条已配置模型（模拟「编辑现有模型」读到的服务端状态） ──────────
const server = [
  { id: 'model-a', current: { id: 'model-a', name: 'A', contextWindow: 1000000, maxTokens: 384000, input: ['text'] } },
  { id: 'model-b', current: { id: 'model-b', name: 'B', contextWindow: 1000000, maxTokens: 384000, input: ['text'] } },
  { id: 'model-c', current: { id: 'model-c', name: 'C', contextWindow: 1000000, maxTokens: 384000, input: ['text'] } },
]
const TARGET = 'pi-ai'

/** 初次读入：全量建草稿。 */
let drafts = D.mergeDrafts({}, server, TARGET)
ok('初次读入建出三条草稿', Object.keys(drafts).length === 3)

console.log('\n① 三条都改了参数 → 三条都该报「未保存」')
drafts = { ...drafts, 'model-a': { ...drafts['model-a'], input: ['text', 'image'] } }
drafts = { ...drafts, 'model-b': { ...drafts['model-b'], contextWindow: '2000000' } }
drafts = { ...drafts, 'model-c': { ...drafts['model-c'], maxTokens: '128000' } }
const dirtyIds = (ds, srvList) => Object.keys(ds).filter((id) => {
  const m = srvList.find((x) => x.id === id)
  return m !== undefined && D.draftIsDirty(m, ds[id], TARGET)
})
eq('改动前三条都是「未保存」', dirtyIds(drafts, server), ['model-a', 'model-b', 'model-c'])

console.log('\n② 保存 model-a 后局部重同步（修复点）')
// host 保存成功后返回新状态：model-a 已是服务端值，b / c 保持原样
const afterSave = [
  { id: 'model-a', current: { id: 'model-a', name: 'A', contextWindow: 1000000, maxTokens: 384000, input: ['text', 'image'] } },
  { id: 'model-b', current: server[1].current },
  { id: 'model-c', current: server[2].current },
]
const synced = D.mergeDrafts(drafts, afterSave, TARGET, ['model-a'])
eq('model-a 已保存（不再脏）', D.draftIsDirty(afterSave[0], synced['model-a'], TARGET), false)
ok('model-b 的未保存编辑被保留（不被整体重建冲掉）', synced['model-b'].contextWindow === '2000000', `ctx=${synced['model-b'].contextWindow}`)
ok('model-c 的未保存编辑被保留', synced['model-c'].maxTokens === '128000', `mt=${synced['model-c'].maxTokens}`)
eq('仍报「未保存」的只剩 b / c', dirtyIds(synced, afterSave), ['model-b', 'model-c'])

console.log('\n②b 回归对照：整体重建（旧行为）确实会让三条都变「已保存」')
// 这正是用户看到的现象：一个字节都没写进去，按钮却全说「已保存」
const rebuilt = D.mergeDrafts(drafts, afterSave, TARGET)
eq('旧行为下 b / c 的按钮会一起变「已保存」（bug 复现）', dirtyIds(rebuilt, afterSave), [])

console.log('\n③ 手填的新模型（服务端还没有）必须是「未保存」')
const manual = D.mergeDrafts(drafts, server, TARGET, [])
const manualDraft = D.toDraft('brand-new-model', {}, TARGET)
manual['brand-new-model'] = manualDraft
const manualModel = { id: 'brand-new-model', current: {}, suggested: {}, suggestedSource: '', configured: false, draftOnly: true }
ok('draftOnly 条目报「未保存」（否则按钮「已保存」且禁用，根本存不下去）', D.draftIsDirty(manualModel, manualDraft, TARGET) === true)
ok('未打 draftOnly 的同一草稿会误判成「已保存」', D.draftIsDirty({ ...manualModel, draftOnly: false }, manualDraft, TARGET) === false)

console.log('\n④ 删除后草稿表不残留')
const afterDelete = [server[0], server[1]]
const syncedDel = D.mergeDrafts(drafts, afterDelete, TARGET, ['model-c'])
ok('被删的 model-c 从草稿表移除', syncedDel['model-c'] === undefined)
ok('其余草稿仍在且保留未保存编辑', syncedDel['model-b']?.contextWindow === '2000000')
ok('手填的新模型不会因删除操作被清掉', (() => {
  const withManual = { ...drafts, 'manual-x': D.toDraft('manual-x', {}, TARGET) }
  return D.mergeDrafts(withManual, afterDelete, TARGET, ['model-c'])['manual-x'] !== undefined
})())

console.log('\n⑤ dirty 判定必须与「用户操作顺序」无关')
const base = D.toDraft('model-a', server[0].current, TARGET)
const effA = { ...base, efforts: { high: 'high', low: 'low' } }
const effB = { ...base, efforts: { low: 'low', high: 'high' } }
ok('efforts 键序不同不算脏', D.sameDraft(effA, effB))
const inA = { ...base, input: ['image', 'text'] }
const inB = { ...base, input: ['text', 'image'] }
ok('input 顺序不同不算脏', D.sameDraft(inA, inB))
// 真的改了才算脏
ok('真的改了 contextWindow 算脏', !D.sameDraft({ ...base, contextWindow: '123' }, base))
// 点 high 再点 low（顺序与 toDraft 产出的规范序不同）→ 保存后必须不再报脏
const srvBoth = [{ id: 'model-a', current: { id: 'model-a', name: 'A', contextWindow: 1000000, maxTokens: 384000, input: ['text'], reasoningEfforts: { low: 'low', high: 'high' } } }]
const dBoth = D.mergeDrafts({}, srvBoth, TARGET)
ok('服务端返回的档位与自己点出来的顺序不同 → 不误报「未保存」', D.draftIsDirty(srvBoth[0], dBoth['model-a'], TARGET) === false)

console.log('\n⑥ 草稿 → 提交对象（守住两套 schema 的形状）')
const dm = D.draftToModel(D.toDraft('x', { id: 'x', input: ['text', 'image'], contextWindow: 1000, reasoningEfforts: { high: 'high' } }, TARGET), TARGET)
eq('pi-ai 用 input', dm.input, ['text', 'image'])
ok('pi-ai 不带 inputModalities', dm.inputModalities === undefined)
const dd = D.draftToModel(D.toDraft('x', { id: 'x', inputModalities: ['text', 'image'] }, 'deepseek'), 'deepseek')
eq('deepseek 用 inputModalities', dd.inputModalities, ['text', 'image'])
ok('deepseek 不带 input / reasoningEfforts', dd.input === undefined && dd.reasoningEfforts === undefined)
// ⚠️ llm-deepseek 的 inputModalities 是 min(1)：清空模态必须兜底成 ['text']，不能写空数组
eq('deepseek 清空模态 → 兜底 text（schema 不接受空数组）', D.draftToModel({ ...D.toDraft('x', {}, 'deepseek'), input: [] }, 'deepseek').inputModalities, ['text'])

console.log('\n⑦ 未保存条数（顶部常驻提示）')
const asModels = (srvList) => srvList.map((s) => ({ ...s, suggested: {}, suggestedSource: '', configured: true }))
eq('三条都脏 → 3', D.countDirty(asModels(server), drafts, TARGET), 3)
eq('同步掉 model-a 后 → 2', D.countDirty(asModels(afterSave), synced, TARGET), 2)
// ⚠️ 这个数字是"还有东西没存"的兜底提醒，必须按**全部**条目算：
// 搜索过滤后只统计可见行的话，被过滤掉的那几条就再也提醒不到了。
const searched = asModels(afterSave).filter((m) => m.id === 'model-b')
eq('搜索只显示 1 行时，提示仍是全部未保存数（2）而不是 1', D.countDirty(asModels(afterSave), synced, TARGET), 2)
eq('（对照）若按过滤后统计就会少报', D.countDirty(searched, synced, TARGET), 1)
// 手填条目也要算进去（对应 Page.tsx 里 allEditModels 会把 extra 草稿补入模型列表）
const withManualDrafts = { ...synced, 'manual-x': D.toDraft('manual-x', {}, TARGET) }
const allModelsWithManual = [
  ...asModels(afterSave),
  { id: 'manual-x', current: {}, suggested: {}, suggestedSource: '', configured: false, draftOnly: true },
]
eq('手填条目计入未保存数', D.countDirty(allModelsWithManual, withManualDrafts, TARGET), 3)

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
