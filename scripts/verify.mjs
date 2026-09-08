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
