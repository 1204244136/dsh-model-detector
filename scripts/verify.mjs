/**
 * dsh-model-detector — host 半区回归测试（无框架、无网络依赖可跑）。
 *
 * 覆盖三条最容易回归的链路：
 *  ① 命名空间识别（deepseek-official → llm-deepseek / 其它 → llm-pi-ai）
 *  ② 名字级匹配：手填内测模型号必须拿到多模态（本项目修复过的关键 bug）
 *  ③ 手动编辑：/current → writeModel → removeModel 往返（两套 schema）
 *
 * 运行：npm run verify（需先 npm run build 产出 lib/）
 * 说明：用假的 settings 服务驱动**已构建产物**，不启动 DSH、不写真实配置。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const API = pathToFileURL(join(root, 'lib', 'api.js')).href

let M
try {
  M = await import(API)
} catch (e) {
  console.error(`✕ 无法加载 ${API}\n  先跑 npm run build（${String(e?.message ?? e)}）`)
  process.exit(1)
}

let pass = 0
let fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) } else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`) }
}
const eq = (label, got, want) => ok(label, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`)

/** 假 settings 服务：只实现插件用到的四个方法（get/describe/replace/writable）。 */
function makeSettings(seed) {
  const doc = structuredClone(seed)
  const revisions = {}
  return {
    writable: true,
    get: (ns) => doc[ns],
    describe: () => Object.keys(doc).map((ns) => ({ ns, revision: revisions[ns] ?? 0, user: doc[ns] })),
    replace: async (ns, section) => { revisions[ns] = (revisions[ns] ?? 0) + 1; doc[ns] = section },
    _doc: doc,
  }
}

const st = makeSettings({
  'llm-pi-ai': {
    providers: {
      'opencode-go': {
        displayName: 'OpenCode Go', api: 'openai-completions', baseURL: 'https://opencode.ai/zen/go/v1',
        models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', contextWindow: 1000000, maxTokens: 384000, input: ['text'] }],
      },
      // 目录路由 + 无 models 列表：编辑应走 modelOverrides
      'deepseek': { displayName: 'DeepSeek (pi-ai)', apiKeyEnv: 'DEEPSEEK_API_KEY' },
    },
  },
  'llm-deepseek': {
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    models: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek-V4-Flash', contextWindow: 1000000, inputModalities: ['text'] },
      { id: 'deepseek-v4.1-flash-expires-on-0910', name: 'deepseek-v4.1-flash-expires-on-0910' },
    ],
  },
})

console.log(`dsh-model-detector v${pkg.version} — host 回归`)

console.log('\n① 命名空间识别')
eq('deepseek-official → llm-deepseek', M.resolveNamespace('deepseek-official', st), 'llm-deepseek')
eq('opencode-go → llm-pi-ai', M.resolveNamespace('opencode-go', st), 'llm-pi-ai')
eq('deepseek（pi-ai 目录路由）→ llm-pi-ai', M.resolveNamespace('deepseek', st), 'llm-pi-ai')
ok('DeepSeek 官方路由默认 apiKeyEnv', M.resolveTarget('deepseek-official', st)?.apiKeyEnv === 'DEEPSEEK_API_KEY')

console.log('\n② 名字级匹配（内测模型号的模态）')
const ids = ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-v4-flash-vision-exp', 'deepseek-v4.1-flash-expires-on-0910']
const merged = M.mergeDiscovered('deepseek-official', ids, { baseURL: 'https://api.deepseek.com' }, {})
const v41 = merged.find((m) => m.id === 'deepseek-v4.1-flash-expires-on-0910')
ok('内测模型号命中清单（非纯默认）', v41?.source === 'manifest', `source=${v41?.source}`)
eq('内测模型号模态 = text+image（bug 修复点）', v41?.input, ['text', 'image'])
ok('内测模型号带容量', v41?.contextWindow === 1000000 && v41?.maxTokens === 384000)
eq('vision-exp 仍多模态', merged.find((m) => m.id === 'deepseek-v4-flash-vision-exp')?.input, ['text', 'image'])
eq('纯文本 flash 不被误升级', merged.find((m) => m.id === 'deepseek-v4-flash')?.input, ['text'])
const fam = M.mergeDiscovered('deepseek-official', ['deepseek-v4.9-flash-experimental'], { baseURL: 'x' }, {})
eq('同族推断继承图像模态', fam[0].input, ['text', 'image'])
eq('无同族依据 → 保守纯文本', M.mergeDiscovered('bailian', ['totally-unknown'], { baseURL: 'x' }, {})[0].input, ['text'])

console.log('\n②b 线上清单端点 + 档位后缀等效（antigravity 回归）')
// Anthropic 协议路由的 baseURL 不能带 /v1（SDK 自己拼 /v1/messages），而这类代理的
// 清单恰恰只在 /v1/models —— 只试 /models 会永远 404、发现拿不到任何 id。
eq('候选端点含 /v1/models 兜底', M.liveModelsUrls('http://127.0.0.1:8045'), ['http://127.0.0.1:8045/models', 'http://127.0.0.1:8045/v1/models'])
eq('baseURL 已带 /v1 时不重复拼', M.liveModelsUrls('https://opencode.ai/zen/go/v1/'), ['https://opencode.ai/zen/go/v1/models'])
ok('档位后缀等效：-high / -low / -tiered', ['high', 'low', 'tiered'].every((s) => M.modelNameEquivalent(`gemini-3.8-flash-${s}`, 'gemini-3.8-flash')))
ok('-thinking 等效（kimi-k2-thinking ↔ kimi-k2）', M.modelNameEquivalent('kimi-k2-thinking', 'kimi-k2'))
ok('-max 不当作档位（避免 codex-max ↔ codex、qwen3.6-max ↔ qwen3.6 误命中）', !M.modelNameEquivalent('gpt-5.1-codex-max', 'gpt-5.1-codex') && !M.modelNameEquivalent('qwen3.6-max', 'qwen3.6'))
ok('无关模型不误判', !M.modelNameEquivalent('gemini-3.8-flash', 'gemini-3.5-flash'))
const mdFake = {
  google: {
    models: {
      'gemini-3.8-flash': {
        name: 'Gemini 3.8 Flash', reasoning: true,
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high'] }],
        modalities: { input: ['text', 'image', 'video', 'audio', 'pdf'] },
        limit: { context: 1048576, output: 65536 },
      },
    },
  },
}
const gw = M.mergeDiscovered('antigravity', ['gemini-3.8-flash-high'], { baseURL: 'http://127.0.0.1:8045' }, mdFake)[0]
eq('档位变体走全局 models.dev 富化（不再落默认）', gw.source, 'models-dev')
ok('拿到 1M 上下文 / 65536 输出', gw.contextWindow === 1048576 && gw.maxTokens === 65536)
eq('模态归一到 text+image', gw.input, ['text', 'image'])
eq('思考档位来自 models.dev', gw.reasoningEfforts, { low: 'low', medium: 'medium', high: 'high' })
// 全局扫描在等效候选同分时按 provider 遍历顺序决出（实测会取到 vivgrid 的 128000），
// 清单 upstream 必须把路由钉到真正厂商（google 65536），否则会写出超限的 maxTokens。
ok('清单已声明 antigravity', M.manifestKeys().includes('antigravity'))
const mdUpstream = {
  vivgrid: { models: { 'gemini-3.8-flash': { modalities: { input: ['text', 'image'] }, limit: { context: 1048576, output: 128000 }, reasoning: true } } },
  google: { models: { 'gemini-3.8-flash': { modalities: { input: ['text', 'image'] }, limit: { context: 1048576, output: 65536 }, reasoning: true, reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high'] }] } } },
}
const up = M.mergeDiscovered('antigravity', ['gemini-3.8-flash-high'], { baseURL: 'x' }, mdUpstream)[0]
ok('upstream 优先于全局扫描（取 google 65536，非网关 128000）', up.maxTokens === 65536 && up.contextWindow === 1048576, `maxTokens=${up.maxTokens}`)
eq('upstream 命中同样带档位', up.reasoningEfforts, { low: 'low', medium: 'medium', high: 'high' })

console.log('\n②c 区域命名空间前缀 + 同名优先 + 多数派（WorkBuddy 回归）')
// 网关把同一模型按区域挂成 `cn:x` / `global:x`：不剥前缀时 WorkBuddy 的 65 条命中率 0%。
ok('cn: 前缀等效', M.modelNameEquivalent('cn:deepseek-v4.1-flash', 'deepseek-v4.1-flash'))
ok('global: 前缀等效', M.modelNameEquivalent('global:glm-5.3', 'glm-5.3'))
ok('vendor/ 前缀等效（含大写）', M.modelNameEquivalent('hf:deepseek-ai/DeepSeek-V4-Pro', 'deepseek-v4-pro'))
ok('区域后缀 -sg / @eu 等效', M.modelNameEquivalent('deepseek-v4.1-flash-sg', 'deepseek-v4.1-flash') && M.modelNameEquivalent('deepseek-v4.1-flash@eu', 'deepseek-v4.1-flash'))
// 收窄规则的非回归：冒号只在"显式区域词"后才算命名空间，否则会把 ollama tag / Bedrock id 削成垃圾键
eq('ollama tag 不被削', M.normalizeModelId('gpt-oss:20b'), 'gpt-oss:20b')
ok('Bedrock id 不被削成 "0"', !M.modelNameEquivalent('global.anthropic.claude-haiku-4-5-20251001-v1:0', '0') && !M.modelNameEquivalent('eu.amazon.nova-pro-v1:0', 'us.writer.palmyra-x4-v1:0'))
// 归一化同名优先于"上一代更丰富"候选（glm-5.3 不能被容量更大的 glm-5 抢走）
const mdSame = {
  zai: {
    models: {
      'glm-5': { modalities: { input: ['text', 'image'] }, limit: { context: 1048576, output: 262144 } },
      'glm-5.3': { modalities: { input: ['text'] }, limit: { context: 1000000, output: 131072 } },
    },
  },
}
const sm = M.mergeDiscovered('wb', ['cn:glm-5.3'], { baseURL: 'x' }, mdSame)[0]
ok('归一化同名优先（不被上一代 glm-5 抢走）', sm.contextWindow === 1000000 && sm.maxTokens === 131072, `ctx=${sm.contextWindow} out=${sm.maxTokens}`)
// 全局扫描取多数派：1 家写 1050000/393216、2 家写 1048576/384000 → 取后者
const mdConsensus = {
  g1: { models: { 'foo-9': { modalities: { input: ['text', 'image'] }, limit: { context: 1050000, output: 393216 } } } },
  g2: { models: { 'foo-9': { modalities: { input: ['text', 'image'] }, limit: { context: 1048576, output: 384000 } } } },
  g3: { models: { 'foo-9': { modalities: { input: ['text', 'image'] }, limit: { context: 1048576, output: 384000 } } } },
}
const cs = M.mergeDiscovered('volcengine', ['foo-9'], { baseURL: 'x' }, mdConsensus)[0]
ok('全局扫描取多数派（不取单家乐观值）', cs.contextWindow === 1048576 && cs.maxTokens === 384000, `ctx=${cs.contextWindow} out=${cs.maxTokens}`)
ok('清单已声明 wb', M.manifestKeys().includes('wb'))

console.log('\n②d 线上声明优先（hy4-preview-f 回归）')
// 端点自己在 /v1/models 里声明了容量/输出上限/是否收图/档位 —— 它比 models.dev 快照权威：
// 实测 cn:deepseek-v4-flash 被 models.dev 写成 maxTokens=384000，而端点声明 max_output_tokens=50000。
const mdDecl = { google: { models: { 'gemini-3.8-flash': { modalities: { input: ['text', 'image'] }, limit: { context: 1048576, output: 65536 }, reasoning: true } } } }
const decl = M.mergeDiscovered('antigravity', [{ id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (proxy)', contextWindow: 1000000, maxTokens: 50000, input: ['text'], reasoningEfforts: { high: 'high' } }], { baseURL: 'x' }, mdDecl)[0]
eq('线上声明压过 models.dev（容量/输出/模态）', [decl.contextWindow, decl.maxTokens, decl.input], [1000000, 50000, ['text']])
eq('来源标注为 provider', decl.source, 'provider')
eq('名称用端点声明的 label', decl.name, 'Gemini 3.8 Flash (proxy)')
const partial = M.mergeDiscovered('antigravity', [{ id: 'gemini-3.8-flash', contextWindow: 999999 }], { baseURL: 'x' }, mdDecl)[0]
ok('逐字段兜底（未声明的字段仍取 models.dev）', partial.contextWindow === 999999 && partial.maxTokens === 65536 && partial.input.join() === 'text,image', JSON.stringify([partial.contextWindow, partial.maxTokens, partial.input]))
// 字段名解析：WorkBuddy 用 context_length / max_output_tokens / supports_images / reasoning_supported_efforts
const rawDecl = M.declaredFromRaw({ id: 'cn:hy4-preview-f', name: 'Hy4 preview', context_length: 1000000, max_allowed_size: 1000000, max_output_tokens: 64000, supports_images: true, supports_reasoning: true, reasoning_supported_efforts: ['high'] })
eq('端点字段名解析', [rawDecl.contextWindow, rawDecl.maxTokens, rawDecl.input, rawDecl.reasoningEfforts], [1000000, 64000, ['text', 'image'], { high: 'high' }])
eq('supports_images=false 是「本端点不收图」的声明', M.declaredFromRaw({ id: 'x', supports_images: false }).input, ['text'])
ok('name 与 id 相同则不伪造 name', M.declaredFromRaw({ id: 'y', name: 'y' }).name === undefined)
const hy = M.mergeDiscovered('wb', [{ id: 'cn:hy4-preview-f', contextWindow: 1000000, maxTokens: 64000, input: ['text', 'image'], reasoningEfforts: { high: 'high' } }], { baseURL: 'x' }, {})[0]
ok('models.dev 无条目也能靠线上声明富化（hy4-preview-f）', hy.source === 'provider' && hy.contextWindow === 1000000 && hy.maxTokens === 64000 && hy.input.join() === 'text,image', JSON.stringify(hy))

console.log('\n②e 编辑页建议值也必须用线上声明（且按精确 id 区分变体）')
// 真实场景：WorkBuddy 的 cn:/global: 是不同部署，声明不同；models.dev 会把两者都写成
// 384000/{off,low,medium,high,max}，点「采纳」就超出端点真实上限（128000）。
const declEdit = [
  { id: 'cn:deepseek-v4.1-flash', contextWindow: 1000000, maxTokens: 128000, input: ['text', 'image'], reasoningEfforts: { low: 'low', high: 'high', max: 'max' } },
  { id: 'global:deepseek-v4.1-flash', contextWindow: 1000000, maxTokens: 128000, input: ['text', 'image'], reasoningEfforts: { high: 'high' } },
]
const mdEdit = {
  wb: { models: {} },
  tee: { models: { 'deepseek-v4.1-flash': { name: 'DeepSeek V4.1 Flash TEE', modalities: { input: ['text', 'image'] }, limit: { context: 1048576, output: 384000 }, reasoning: true, reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'high', 'max'] }] } } },
}
const stEdit = makeSettings({
  'llm-pi-ai': {
    providers: {
      wb: {
        api: 'openai-completions', baseURL: 'http://127.0.0.1:7863/v1',
        models: [{ id: 'cn:deepseek-v4.1-flash' }, { id: 'global:deepseek-v4.1-flash' }],
      },
    },
  },
})
const curD = await M.currentModels(stEdit, 'wb', mdEdit, declEdit)
const cnD = curD.models.find((m) => m.id === 'cn:deepseek-v4.1-flash')
const glD = curD.models.find((m) => m.id === 'global:deepseek-v4.1-flash')
eq('建议值来源 = provider', cnD?.suggestedSource, 'provider')
eq('建议输出上限用端点声明（128000，不是 models.dev 的 384000）', cnD?.suggested.maxTokens, 128000)
eq('cn 变体拿到三档', cnD?.suggested.reasoningEfforts, { low: 'low', high: 'high', max: 'max' })
eq('global 变体只拿到一档（按精确 id，不被 cn 污染）', glD?.suggested.reasoningEfforts, { high: 'high' })
ok('两个变体的建议值确实不同', JSON.stringify(cnD?.suggested.reasoningEfforts) !== JSON.stringify(glD?.suggested.reasoningEfforts))
// 不传声明 → 回落 models.dev（旧行为），证明新参数是可选、向后兼容的
const curNoD = await M.currentModels(stEdit, 'wb', mdEdit)
eq('不传声明时回落 models.dev', curNoD.models.find((m) => m.id === 'cn:deepseek-v4.1-flash')?.suggestedSource, 'models-dev')

// 挂住的端点必须有超时：编辑页会调它，没超时就会卡在「正在读取现有模型…」
const { createServer } = await import('node:http')
const hangSrv = createServer(() => { /* 故意不响应 */ })
await new Promise((r) => hangSrv.listen(0, '127.0.0.1', r))
const hangPort = hangSrv.address().port
const t0 = Date.now()
let hangMsg = ''
try { await M.fetchLiveModels(`http://127.0.0.1:${hangPort}`, 'k', 300) } catch (e) { hangMsg = String(e?.message ?? e) }
const hangMs = Date.now() - t0
hangSrv.close()
ok('挂住的端点会超时而不是一直等', hangMs < 3000, `${hangMs}ms`)
ok('超时错误信息可读', hangMsg.includes('超时'), hangMsg)

console.log('\n②f 端点计费标注（credits）：只在发现页展示，绝不写进配置')
eq('字符串 credits 原样保留', M.declaredFromRaw({ id: 'x', credits: 'x0.03' }).credits, 'x0.03')
eq('数字 credits 补 x 前缀', M.declaredFromRaw({ id: 'x', credits: 0.05 }).credits, 'x0.05')
// 实测同一端点混用两种写法：`x0.21` 与 `x0.34 credits` —— 归一化后才不会显示成两种样式
eq('带 credits 后缀的写法被归一', M.declaredFromRaw({ id: 'x', credits: 'x0.34 credits' }).credits, 'x0.34')
eq('纯数字字符串也补 x 前缀', M.declaredFromRaw({ id: 'x', credits: '0.5' }).credits, 'x0.5')
ok('无 credits 时不伪造字段', M.declaredFromRaw({ id: 'x' }).credits === undefined)
const cred = M.mergeDiscovered('wb', [{ id: 'cn:hy4-preview-f', contextWindow: 1000000, maxTokens: 64000, credits: 'x0.00' }], { baseURL: 'x' }, {})[0]
eq('发现结果带上 credits（供 UI 展示）', cred.credits, 'x0.00')
// 关键：apply 走 cleanForTarget 白名单，credits 必须被丢弃（DSH schema 不认这个字段）
const credSt = makeSettings({ 'llm-pi-ai': { providers: { wb: { api: 'openai-completions', baseURL: 'http://127.0.0.1:7863/v1', models: [] } } } })
await M.applyModels(credSt, 'wb', [cred])
const credSaved = credSt._doc['llm-pi-ai'].providers.wb.models[0]
ok('credits 不会写进 pi-ai 配置', credSaved.credits === undefined, JSON.stringify(credSaved))
ok('其它字段正常写入', credSaved.contextWindow === 1000000 && credSaved.maxTokens === 64000)

console.log('\n③ 目标形状转换')
const shaped = merged.map((m) => M.toTargetModel('llm-deepseek', m)).find((m) => m.id === 'deepseek-v4.1-flash-expires-on-0910')
eq('deepseek 形状用 inputModalities', shaped?.inputModalities, ['text', 'image'])
ok('deepseek 形状不含 input / reasoningEfforts', shaped.input === undefined && shaped.reasoningEfforts === undefined)
ok('pi-ai 形状保留 reasoningEfforts', M.toTargetModel('llm-pi-ai', { id: 'x', input: ['text'], reasoningEfforts: { max: 'max' } }).reasoningEfforts?.max === 'max')

const modelsDev = await M.loadModelsDev()
const mdStatus = M.modelsDevStatus()
console.log(`  （models.dev: loaded=${mdStatus.loaded} providers=${mdStatus.providers}${mdStatus.error ? ' err=' + mdStatus.error : ''}）`)

console.log('\n④ 手动编辑：DeepSeek 官方（llm-deepseek）')
const cur = await M.currentModels(st, 'deepseek-official', modelsDev)
eq('目标命名空间', cur.target.ns, 'llm-deepseek')
eq('路由级档位默认 high', cur.reasoningEffort, 'high')
const curV41 = cur.models.find((m) => m.id === 'deepseek-v4.1-flash-expires-on-0910')
ok('现有模型在列表里且标记已配置', curV41?.configured === true)
ok('给出含图像的建议值', (curV41?.suggested?.input ?? []).includes('image'), JSON.stringify(curV41?.suggested?.input))
await M.writeModel(st, 'deepseek-official', { id: 'deepseek-v4.1-flash-expires-on-0910', name: 'V4.1 内测', contextWindow: 1000000, maxTokens: 384000, inputModalities: ['text', 'image'] })
const saved = st._doc['llm-deepseek'].models.find((m) => m.id === 'deepseek-v4.1-flash-expires-on-0910')
eq('写入后模态含图像', saved.inputModalities, ['text', 'image'])
eq('写入保留展示名', saved.name, 'V4.1 内测')
ok('其它模型未被破坏', st._doc['llm-deepseek'].models.some((m) => m.id === 'deepseek-v4-flash'))
ok('写出的字段都在 catalogModel 白名单内', Object.keys(saved).every((k) => ['id', 'name', 'description', 'contextWindow', 'maxTokens', 'inputModalities', 'imagePixelBudget', 'imageMaxBytes'].includes(k)), Object.keys(saved).join(','))
await M.writeModel(st, 'deepseek-official', { id: 'deepseek-v4-flash', inputModalities: ['text'] })
const noImage = st._doc['llm-deepseek'].models.find((m) => m.id === 'deepseek-v4-flash')
ok('纯文本模型不残留 image* 参数', noImage.imagePixelBudget === undefined && noImage.imageMaxBytes === undefined)
await M.writeRouteReasoning(st, 'deepseek-official', { reasoningEffort: 'max' })
eq('路由级档位写入', st._doc['llm-deepseek'].reasoningEffort, 'max')
let rejected = false
try { await M.writeRouteReasoning(st, 'deepseek-official', { reasoningEffort: 'ultra' }) } catch { rejected = true }
ok('非法档位被拒', rejected)
const rmMiss = await M.removeModel(st, 'deepseek-official', 'deepseek-v4-pro')
ok('删除不存在的模型 → removed=false', rmMiss.removed === false)
const rmHit = await M.removeModel(st, 'deepseek-official', 'deepseek-v4.1-flash-expires-on-0910')
ok('删除已配置模型 → removed=true', rmHit.removed === true && rmHit.from === 'models')

console.log('\n⑤ 手动编辑：pi-ai（llm-pi-ai）')
const cur2 = await M.currentModels(st, 'opencode-go', modelsDev)
eq('pi-ai 目标', cur2.target.ns, 'llm-pi-ai')
ok('返回现有模型', cur2.models.some((m) => m.id === 'deepseek-v4-flash'))
await M.writeModel(st, 'opencode-go', { id: 'deepseek-v4-flash', input: ['text', 'image'] })
const piFlash = st._doc['llm-pi-ai'].providers['opencode-go'].models.find((m) => m.id === 'deepseek-v4-flash')
eq('已有 models 列表 → 就地更新', piFlash.input, ['text', 'image'])
ok('未走 modelOverrides', st._doc['llm-pi-ai'].providers['opencode-go'].modelOverrides === undefined)

const cat = await M.piAiCatalogStatus()
console.log(`  （pi-ai 目录: loaded=${cat.loaded} providers=${cat.providers}${cat.error ? ' err=' + cat.error : ''}）`)
if (cat.loaded) {
  const w = await M.writeModel(st, 'deepseek', { id: 'deepseek-v4-flash', input: ['text', 'image'] })
  eq('目录路由无 models 列表 → 写 modelOverrides', w.key, 'modelOverrides')
  ok('modelOverrides 生效', st._doc['llm-pi-ai'].providers['deepseek'].modelOverrides?.['deepseek-v4-flash']?.input?.join(',') === 'text,image')
  ok('未创建 models 列表', st._doc['llm-pi-ai'].providers['deepseek'].models === undefined)
  const rmOv = await M.removeModel(st, 'deepseek', 'deepseek-v4-flash')
  ok('删除 override', rmOv.removed === true && rmOv.from === 'modelOverrides')
} else {
  console.log('  · 跳过 modelOverrides 用例（本机读不到 pi-ai 目录数据）')
}

console.log('\n⑥ 批量应用（/apply 的 host 侧）')
const r = await M.applyModels(st, 'opencode-go', [{ id: 'kimi-k3', name: 'Kimi K3', contextWindow: 1048576, maxTokens: 131072, input: ['text', 'image'], reasoningEfforts: { max: 'max' } }])
ok('applyModels 写入 pi-ai', r.ns === 'llm-pi-ai' && r.count === 1)
const kimi = st._doc['llm-pi-ai'].providers['opencode-go'].models.find((m) => m.id === 'kimi-k3')
eq('字段完整', [kimi.contextWindow, kimi.maxTokens, kimi.input, kimi.reasoningEfforts], [1048576, 131072, ['text', 'image'], { max: 'max' }])
let unknownRejected = false
try { await M.applyModels(st, 'no-such-route', []) } catch { unknownRejected = true }
ok('未知路由被拒（不静默新建提供方）', unknownRejected)

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
