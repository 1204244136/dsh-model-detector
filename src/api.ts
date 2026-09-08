/**
 * dsh-model-detector — Host 半区业务逻辑（清单列举 / 发现合并 / 应用写入 / 手动编辑）。
 *
 * 元数据来源（四级优先级，无需人工逐模型维护）：
 *  1. models.dev（自动，社区维护，含模态/容量/推理）——主源
 *  2. 内置 manifest（薄覆盖层，仅覆盖 models.dev 缺/错的模型）
 *  3. 名字级匹配（精确命中失败时，按归一化名字等效命中 models.dev/manifest 条目，
 *     或以模型名里的容量/模态 token 推导：如 128k/256k/4k/1.5m、vision/vl/image）
 *  4. 保守默认（text + 262144/32768）
 *
 * 写入目标（两套 schema，见 PROVIDERS）：
 *  - `llm-pi-ai`：pi-ai 适配器，模型级字段 id/name/contextWindow/maxTokens/
 *    input/reasoningEfforts/compat；catalog 路由可写 modelOverrides。
 *  - `llm-deepseek`：DeepSeek 官方 API 内置适配器（路由 deepseek-official），
 *    模型级字段 id/name/description/contextWindow/maxTokens/inputModalities/
 *    imagePixelBudget/imageMaxBytes；推理档位是**路由级** reasoningEffort。
 *
 * 与 dsh-model-pro 相同的跨 realm 约定：静态 bundle 运行在宿主 sandbox
 * realm，settings 解析值是深冻结对象；写入用 makeHostPlain 重建以通过
 * isPlainObject 检查。
 */

import { manifestProvider, inferFamilyInput, MANIFEST, type ManifestModel, type ManifestProvider } from './manifest.js'

/** models.dev 元数据端点（自动更新、覆盖几乎所有提供方）。 */
export const MODELS_DEV_URL = 'https://models.dev/api.json'

/** 归一化后：DSH 只支持 text/image，把 models.dev 的完整模态列表映射过来。 */
export function normalizeInput(modalities?: unknown): Array<'text' | 'image'> | undefined {
  if (typeof modalities === 'string') return modalities === 'image' ? ['text', 'image'] : ['text']
  if (!Array.isArray(modalities)) return undefined
  const set = new Set(modalities)
  return set.has('image') ? ['text', 'image'] : ['text']
}

/**
 * pi-ai 思考档位（DSH profile 层 reasoningEfforts 的合法键，升序）。
 * 与 @earendil-works/pi-ai 的 ThinkingLevel 对齐：off/minimal/low/medium/high/xhigh/max。
 */
export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
export type ThinkingLevel = (typeof THINKING_LEVELS)[number]
/** DSH 的 reasoningEfforts：档位 → wire 值；null 仅对 off 合法（= 参数缺席）。 */
export type ReasoningEfforts = Partial<Record<ThinkingLevel, string | null>>

/** 提取 models.dev 一条模型记录声明的档位集合（type=effort 的 values 数组）。 */
function modelsDevEffortValues(md: unknown): string[] | undefined {
  const opt = (md as any)?.reasoning_options
  const arr = Array.isArray(opt) ? opt : opt ? [opt] : []
  const effort = arr.find((o: any) => o && typeof o === 'object' && o.type === 'effort' && Array.isArray(o.values))
  if (!effort || !Array.isArray(effort.values)) return undefined
  const values = effort.values.map((v: unknown) => String(v))
  return values.length > 0 ? values : undefined
}

/**
 * models.dev reasoning_options → DSH reasoningEfforts。
 *
 * 不同模型声明的档位不同（如 muse-spark 是 minimal/low/medium/high/xhigh，
 * qwen3.8-flash 是 low/medium/xhigh，kimi-k3 只有 max），因此逐模型读取，绝不
 * 套用统一档位。wire 值 = 档位名本身（openai/deepseek/openrouter 等 effort 型
 * 格式通用）；`none` → `off`（缺席参数）。只保留 pi-ai 认识的档位，未知档位
 * 跳过（否则 DSH schema 会拒绝整个 profile）；若去掉 off 后没有任何档位
 * （纯开关模型）→ undefined（不写，交给 catalog 兜底，避免 DSH 校验拒绝）。
 */
export function reasoningEffortsFromModelsDev(md: unknown): ReasoningEfforts | undefined {
  const values = modelsDevEffortValues(md)
  if (!values) return undefined
  const out: ReasoningEfforts = {}
  let hasThinking = false
  for (const v of values) {
    const level = v === 'none' ? 'off' : v
    if (!(THINKING_LEVELS as readonly string[]).includes(level)) continue
    if (level === 'off') { out.off = null; continue }
    out[level as ThinkingLevel] = level
    hasThinking = true
  }
  return hasThinking ? out : undefined
}

/**
 * manifest thinkingLevelMap → DSH reasoningEfforts（人工 wire 值优先）。
 * 非 off 档位为 null = 该档位不支持 → 跳过（DSH 只允许 off 留空值）；
 * off 的 null → 保留（缺席参数）。只保留 pi-ai 认识的档位；
 * 去掉 off 后没有档位 → undefined（不写）。
 */
export function reasoningEffortsFromManifest(tlm: Record<string, string | null> | undefined): ReasoningEfforts | undefined {
  if (!tlm) return undefined
  const out: ReasoningEfforts = {}
  let hasThinking = false
  for (const [level, wire] of Object.entries(tlm)) {
    if (!(THINKING_LEVELS as readonly string[]).includes(level)) continue
    if (level === 'off') {
      if (wire === null || wire === undefined || wire === '') out.off = null
      continue
    }
    if (wire === null || wire === undefined || wire === '') continue
    out[level as ThinkingLevel] = wire
    hasThinking = true
  }
  return hasThinking ? out : undefined
}

// ── 命名空间与写入目标 ──────────────────────────────────────────────────────

/** 插件认得的 settings 命名空间（写入目标）。 */
export type Namespace = 'llm-pi-ai' | 'llm-deepseek'

/** 内置 DeepSeek 官方适配器唯一拥有的路由键。 */
export const DEEPSEEK_PROVIDER = 'deepseek-official'

/** settings 服务子集（与 dsh-model-pro 相同，另加 describe 以读原始 user 层）。 */
export interface SettingsService {
  get(ns: string): Record<string, unknown> | undefined
  readonly writable: boolean
  replace(ns: string, section: unknown, expectedRevision?: number): Promise<void>
  describe?(options?: { redactSecrets?: boolean }): Array<{ ns: string; revision: number; user?: unknown }>
}

/** HostCtx 子集。 */
export interface HostCtx {
  get(name: 'settings'): SettingsService | undefined
  get(name: string): unknown
  logger: { warn(...a: unknown[]): void; error(...a: unknown[]): void }
}

/** 递归重建为 null-proto 对象，通过宿主 settings 的 isPlainObject 检查。 */
function makeHostPlain<T>(obj: T): any {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const out = Object.create(null) as Record<string, unknown>
  for (const k of Object.keys(obj as Record<string, unknown>)) {
    const v = (obj as Record<string, unknown>)[k]
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) out[k] = makeHostPlain(v)
    else if (Array.isArray(v)) out[k] = v.map((item) => makeHostPlain(item))
    else out[k] = v
  }
  return out
}

/** 该命名空间是否已在宿主注册（未注册时写入必失败，提前判掉）。 */
export function namespaceRegistered(st: SettingsService | undefined, ns: Namespace): boolean {
  if (st === undefined) return false
  try { return st.get(ns) !== undefined } catch { return false }
}

/** 读取一个命名空间的已解析值（未注册 → undefined）。 */
function readSection(st: SettingsService | undefined, ns: Namespace): Record<string, any> | undefined {
  if (st === undefined) return undefined
  try {
    const v = st.get(ns)
    return v && typeof v === 'object' ? (v as Record<string, any>) : undefined
  } catch { return undefined }
}

/** 读取一个命名空间的原始 user 层（用于"只改我改过的"写入，避免把默认值固化成用户配置）。 */
function readUserLayer(st: SettingsService | undefined, ns: Namespace): Record<string, any> | undefined {
  if (st === undefined || typeof st.describe !== 'function') return undefined
  try {
    const d = st.describe({ redactSecrets: false }).find((x) => x.ns === ns)
    const user = d?.user
    return user && typeof user === 'object' && !Array.isArray(user) ? (user as Record<string, any>) : undefined
  } catch { return undefined }
}

/** 读取命名空间当前的 revision（写冲突检测用；不可得 → undefined）。 */
function readRevision(st: SettingsService | undefined, ns: Namespace): number | undefined {
  if (st === undefined || typeof st.describe !== 'function') return undefined
  try { return st.describe({ redactSecrets: false }).find((x) => x.ns === ns)?.revision } catch { return undefined }
}

/** 归一化路由键（大小写/下划线/空格 → 连字符）。 */
const normalizeRouteKey = (s: string): string => s.trim().toLowerCase().replace(/[\s_]+/g, '-')

/**
 * 路由 → 该路由所属的 settings 命名空间。
 *
 * 判定顺序（前两条是"已配置即权威"）：
 *  1. llm-pi-ai.providers 里有这个 route → llm-pi-ai
 *  2. route 是内置 DeepSeek 适配器唯一拥有的 `deepseek-official` → llm-deepseek
 *     （该插件注册了段就认，未注册时也认——它的默认目录本来就在服务）
 *  3. 清单 target 提示（profile 里还没写该路由时）
 *  4. 缺省 llm-pi-ai（pi-ai 是"任意提供方"的通用入口）
 */
export function resolveNamespace(route: string, st: SettingsService | undefined): Namespace | undefined {
  const key = normalizeRouteKey(route)
  const pi = readSection(st, 'llm-pi-ai')
  const hasPiRoute = !!(pi?.providers && typeof pi.providers === 'object' && (pi.providers as any)[route])
  if (hasPiRoute) return 'llm-pi-ai'
  if (key === DEEPSEEK_PROVIDER) return 'llm-deepseek'
  const hint = manifestProvider(route)?.target
  if (hint === 'deepseek') return 'llm-deepseek'
  if (hint === 'pi-ai') return 'llm-pi-ai'
  return 'llm-pi-ai'
}

/** 一个路由的完整写入上下文。 */
export interface RouteTarget {
  route: string
  ns: Namespace
  /** 该命名空间下的提供方/连接对象（pi-ai 是 providers[route]，deepseek 是整段）。 */
  profile: Record<string, any>
  mp?: ManifestProvider
  /** 模型 id 在 profile 中的所在键：pi-ai = models；deepseek = models。 */
  apiKeyEnv: string
  baseURL: string
  hasModelsList: boolean
}

/** 解析路由 → 写入目标（含 apiKeyEnv / baseURL 兜底）。 */
export function resolveTarget(route: string, st: SettingsService | undefined): RouteTarget | undefined {
  const ns = resolveNamespace(route, st)
  if (ns === undefined) return undefined
  const mp = manifestProvider(route)
  if (ns === 'llm-deepseek') {
    const section = readSection(st, 'llm-deepseek') ?? {}
    return {
      route,
      ns,
      profile: section,
      mp,
      apiKeyEnv: typeof section.apiKeyEnv === 'string' && section.apiKeyEnv ? section.apiKeyEnv : 'DEEPSEEK_API_KEY',
      baseURL: typeof section.baseURL === 'string' && section.baseURL ? section.baseURL : (mp?.baseURL ?? 'https://api.deepseek.com'),
      hasModelsList: Array.isArray(section.models),
    }
  }
  const providers = readProviders(st)
  const p = (providers[route] ?? {}) as Record<string, any>
  return {
    route,
    ns,
    profile: p,
    mp,
    apiKeyEnv: typeof p.apiKeyEnv === 'string' ? p.apiKeyEnv : '',
    baseURL: typeof p.baseURL === 'string' && p.baseURL ? p.baseURL : (mp?.baseURL ?? ''),
    hasModelsList: Array.isArray(p.models),
  }
}

/** 读取 llm-pi-ai 提供方表。 */
export function readProviders(st: SettingsService | undefined): Record<string, any> {
  const section = readSection(st, 'llm-pi-ai')
  if (section?.providers && typeof section.providers === 'object') return section.providers
  return {}
}

/**
 * 列出所有可检测/可编辑的提供方：llm-pi-ai 已配置路由 + DeepSeek 官方适配器
 * （后者即使 settings 里没有 `llm-deepseek` 段也存在——插件默认就注册
 * `deepseek-official` 路由并服务内置目录）。
 */
export function listConfiguredProviders(st: SettingsService | undefined) {
  const out: Array<Record<string, unknown>> = []
  for (const [route, p] of Object.entries(readProviders(st)) as Array<[string, any]>) {
    const t = resolveTarget(route, st)
    out.push({
      route,
      displayName: (p && typeof p.displayName === 'string' && p.displayName) || route,
      api: p?.api || manifestProvider(route)?.api || '',
      baseURL: p?.baseURL || manifestProvider(route)?.baseURL || '',
      modelCount: Array.isArray(p?.models) ? p.models.length : 0,
      inManifest: manifestProvider(route) !== undefined,
      ns: t?.ns ?? 'llm-pi-ai',
      target: t?.ns === 'llm-deepseek' ? 'deepseek' : 'pi-ai',
    })
  }
  if (namespaceRegistered(st, 'llm-deepseek') && !out.some((x) => x.route === DEEPSEEK_PROVIDER)) {
    const section = readSection(st, 'llm-deepseek') ?? {}
    const mp = manifestProvider(DEEPSEEK_PROVIDER)
    out.unshift({
      route: DEEPSEEK_PROVIDER,
      displayName: 'DeepSeek（官方 API）',
      api: 'openai-completions',
      baseURL: (typeof section.baseURL === 'string' && section.baseURL) || mp?.baseURL || 'https://api.deepseek.com',
      modelCount: Array.isArray(section.models) ? section.models.length : 0,
      inManifest: mp !== undefined,
      ns: 'llm-deepseek',
      target: 'deepseek',
      builtin: true,
    })
  }
  return out
}

/** 读请求体（webServer 传原始 Node req）。 */
export async function readJsonBody(req: any): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => { raw += chunk.toString('utf8') })
    req.on('end', () => {
      if (!raw.trim()) return resolve({})
      try { resolve(JSON.parse(raw)) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

/** 解析 webServer 前缀 handler 收到的子路径（去掉前缀）。 */
export function subPath(req: any, prefix: string): string {
  const pathname = new URL(req.url ?? '/', 'http://x').pathname
  return pathname.slice(prefix.length).replace(/^\/+/, '').replace(/\/+$/, '')
}

/** 用提供方 baseURL + apiKey 拉线上模型列表（OpenAI-compatible GET /models）。 */
export async function fetchLiveModels(baseURL: string, apiKey?: string): Promise<Array<{ id: string }>> {
  const url = `${baseURL.replace(/\/+$/, '')}/models`
  const headers: Record<string, string> = { accept: 'application/json' }
  if (apiKey && apiKey.length > 0) headers.authorization = `Bearer ${apiKey}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`GET ${url} 失败: HTTP ${res.status}`)
  const json: any = await res.json()
  const data = Array.isArray(json?.data) ? json.data : []
  return data
    .map((e: any) => ({ id: typeof e?.id === 'string' ? e.id : '' }))
    .filter((e: any) => e.id.length > 0)
}

/** models.dev 缓存：{ providerId: { models: { modelId: { modalities, limit, reasoning, ... } } } }。 */
let cachedModelsDev: Record<string, any> | undefined
/** 最近一次 models.dev 加载的错误信息（无错为 undefined），用于诊断/审计。 */
let cachedModelsDevError: string | undefined

/** 拉取并缓存 models.dev（一次/会话，15s 超时），失败返回 {} 并记录原因。 */
export async function loadModelsDev(): Promise<Record<string, any>> {
  if (cachedModelsDev !== undefined) return cachedModelsDev
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(MODELS_DEV_URL, { headers: { accept: 'application/json' }, signal: ctrl.signal })
    if (!res.ok) {
      cachedModelsDevError = `HTTP ${res.status}`
      cachedModelsDev = {}
      return cachedModelsDev
    }
    const json: any = await res.json()
    if (json && typeof json === 'object') {
      cachedModelsDev = json
      cachedModelsDevError = undefined
      return json
    }
    cachedModelsDevError = '响应不是对象'
  } catch (e: any) {
    cachedModelsDevError = String(e?.message ?? e)
  } finally {
    clearTimeout(timer)
  }
  cachedModelsDev = {}
  return cachedModelsDev
}

/** models.dev 加载状态（供 /discover 诊断，失败时对用户/日志可见，而非静默降级成全默认）。 */
export function modelsDevStatus() {
  return {
    loaded: !!cachedModelsDev && Object.keys(cachedModelsDev).length > 0,
    providers: cachedModelsDev ? Object.keys(cachedModelsDev).length : 0,
    error: cachedModelsDevError,
  }
}

/**
 * 归一化模型 id 用于名字级匹配：小写、去尾部日期/版本/后缀段。
 * 注意 `-expires-on-0910`（内测模型的到期标记）也属于"版本/日期噪声"，必须剥掉，
 * 否则 `deepseek-v4.1-flash-expires-on-0910` 无法与 `deepseek-v4-flash` 等效命中。
 */
function normalizeModelId(id: string): string {
  return id
    .toLowerCase()
    // 去掉尾部日期段（YYMMDD=6位 / YYYYMMDD=8位）及 latest/beta/rc/dev/preview/ga/stable 后缀
    .replace(/(?:[-_.])?(?:[12]\d{7}|\d{6})\s*$/g, '')
    .replace(/[-_.](?:latest|beta|rc|dev|preview|ga|stable)\b(?:[-_.]|\b)/g, '')
    // 内测模型的到期标记：-expires-on-0910 / -expires-0910
    .replace(/(?:[-_.])expires(?:[-_.])on(?:[-_.])?\d{0,8}\s*$/g, '')
    .replace(/[-_.]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** 名字级等效判断：归一化后相等，或一侧是另一侧前缀且多出部分仅版本/数字段。 */
function modelNameEquivalent(a: string, b: string): boolean {
  const na = normalizeModelId(a)
  const nb = normalizeModelId(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.startsWith(nb) || nb.startsWith(na)) {
    const rest = na.length > nb.length ? na.slice(nb.length) : nb.slice(na.length)
    return /^[-.\d]*$/.test(rest)
  }
  return false
}

/** 一个候选条目的能力评分（越大越"丰富"）：含 image 的模态优先，其次容量。 */
function entryScore(entry: any): number {
  const input = normalizeInput(entry?.modalities?.input) ?? entry?.input
  const hasImage = Array.isArray(input) && input.includes('image')
  const ctx = Number(entry?.limit?.context ?? entry?.contextWindow ?? 0) || 0
  return (hasImage ? 1e9 : 0) + Math.min(ctx, 1e8)
}

/**
 * 在模型表里按名字级等效命中，并在多个等效候选里挑**能力最丰富**的一个。
 *
 * 为什么不能取第一个命中：同一系列常有纯文本与多模态两条线
 * （`deepseek-v4-flash` vs `deepseek-v4-flash-vision-exp`），而手填的模型号
 * （如 `deepseek-v4.1-flash-expires-on-0910`）与两者都"版本级等效"。取第一个会
 * 命中纯文本条目，导致新模型永远拿不到图像模态——正是本插件要修的问题。
 * 精确同名命中永远优先（不引入猜测）。
 */
function pickBestMatch<T>(entries: Record<string, T> | undefined, id: string): T | undefined {
  if (!entries) return undefined
  if (entries[id] !== undefined) return entries[id]
  let best: T | undefined
  let bestScore = -1
  for (const key in entries) {
    if (!modelNameEquivalent(key, id)) continue
    const score = entryScore(entries[key])
    if (score > bestScore) { bestScore = score; best = entries[key] }
  }
  return best
}

/** 在 models.dev / manifest 的模型记录里按名字级等效命中（未命中返回 undefined）。 */
function findByName<T>(entries: Record<string, T> | undefined, id: string): T | undefined {
  return pickBestMatch(entries, id)
}

/**
 * 全局 models.dev 回退：当前提供方未收录时，按名字级等效在 models.dev 的其它
 * 提供方里命中。聚合/网关路由（如 opencode-go、volcengine）常把模型挂在各自
 * 上游厂商 slug（如 minimax、deepseek）下，而非当前路由键，需跨提供方扫一遍。
 */
function globalModelsDevModel(modelsDev: Record<string, any>, id: string): any | undefined {
  let best: any
  let bestScore = -1
  for (const providerId in modelsDev) {
    const hit = findByName(modelsDev[providerId]?.models, id)
    if (!hit) continue
    const score = entryScore(hit)
    if (score > bestScore) { bestScore = score; best = hit }
  }
  return best
}

/**
 * 合并：线上最新 id + models.dev（权威能力源）+ 内置 manifest（薄覆盖）→ 元数据。
 * 能力（上下文/容量/模态/推理）以 models.dev 为准；manifest 仅覆盖 dsh 专属字段
 * （name/thinkingLevelMap/compat）与 models.dev 缺口；两者都没有 → 保守默认。
 * 优先级：当前提供方 models.dev > 全局 models.dev > 当前提供方 manifest > 保守默认。
 */
export function mergeDiscovered(
  provider: string,
  liveIds: string[],
  providerDefault: { api?: string; baseURL?: string; contextWindow?: number; maxTokens?: number; input?: Array<'text' | 'image'> },
  modelsDev: Record<string, any>,
): Array<Record<string, unknown>> {
  const mp = manifestProvider(provider)
  const provDev = modelsDev?.[provider]
  const defInput = (providerDefault.input && providerDefault.input.length > 0)
    ? providerDefault.input
    : (['text'] as Array<'text' | 'image'>)
  return liveIds.map(id => {
    // 权威能力源：models.dev（当前提供方，精确 + 名字级等效）。注意 models.dev 结构为
    // provider.models[modelId]，需经 .models 取模型表，而非 provider[modelId]。
    let md = provDev?.models?.[id] ?? findByName(provDev?.models, id)
    // 当前提供方未收录 → 跨厂商在 models.dev 里名字级回退（仍来自 models.dev，权威）
    if (!md) md = globalModelsDevModel(modelsDev, id)
    // 薄覆盖：内置 manifest（当前提供方），补 dsh 专属字段与 models.dev 缺口
    let mf: ManifestModel | undefined = mp?.models[id]
    if (!mf && mp) mf = findByName(mp.models, id)
    // manifest 目录（适配器默认就服务的模型）也参与兜底：手填的新模型常与目录条目同族
    if (!mf && mp?.catalog) mf = mp.catalog[id] ?? findByName(mp.catalog, id)
    const contextWindow = md?.limit?.context ?? mf?.contextWindow ?? providerDefault.contextWindow
    const maxTokens = md?.limit?.output ?? mf?.maxTokens ?? providerDefault.maxTokens
    const input = normalizeInput(md?.modalities?.input) ?? mf?.input ?? inferFamilyInput(mp, id) ?? defInput
    // 思考档位：manifest 人工覆盖（thinkingLevelMap，含精确 wire 值）优先 → models.dev
    // 自动声明（reasoning_options）。两者都没有 → 不写，交给 pi-ai catalog 兜底。
    const reasoningEfforts = reasoningEffortsFromManifest(mf?.thinkingLevelMap) ?? reasoningEffortsFromModelsDev(md)
    // 是否推理（仅 UI 展示用；apply 时不写入——DSH 模型级 schema 无 reasoning 布尔字段，
    // 推理能力由 reasoningEfforts 表达）。
    const reasoning = reasoningEfforts !== undefined ? true : (md?.reasoning ?? mf?.reasoning ?? false)
    // 来源：models.dev > manifest > 保守默认（供 UI 区分"查得"与"兜底"）
    const source = md ? 'models-dev' : mf ? 'manifest' : 'default'
    return {
      id,
      name: (md?.name || mf?.name || id) as string,
      ...(mf?.note ? { note: mf.note } : {}),
      ...(contextWindow ? { contextWindow } : {}),
      ...(maxTokens ? { maxTokens } : {}),
      input: [...input],
      ...(reasoning ? { reasoning } : {}),
      ...(reasoningEfforts ? { reasoningEfforts } : {}),
      ...(mf?.compat ? { compat: mf.compat } : {}),
      source,
    }
  })
}

/** 纯清单合并（不依赖 models.dev）——用于发现失败时的兜底。 */
export function mergeManifest(
  provider: string,
  liveIds: string[],
  providerDefault: { api?: string; baseURL?: string; contextWindow?: number; maxTokens?: number; input?: Array<'text' | 'image'> },
): Array<Record<string, unknown>> {
  const mp = manifestProvider(provider)
  const defInput = (providerDefault.input && providerDefault.input.length > 0)
    ? providerDefault.input
    : (['text'] as Array<'text' | 'image'>)
  return liveIds.map(id => {
    let mf: ManifestModel | undefined = mp?.models[id]
    if (!mf && mp) mf = findByName(mp.models, id)
    const contextWindow = (mf?.contextWindow ?? providerDefault.contextWindow)
    const maxTokens = (mf?.maxTokens ?? providerDefault.maxTokens)
    const input = (mf?.input ?? inferFamilyInput(mp, id) ?? defInput)
    const reasoningEfforts = reasoningEffortsFromManifest(mf?.thinkingLevelMap)
    const reasoning = reasoningEfforts !== undefined ? true : (mf?.reasoning ?? false)
    const source = mf ? 'manifest' : 'default'
    return {
      id,
      name: (mf?.name || id) as string,
      ...(mf?.note ? { note: mf.note } : {}),
      ...(contextWindow ? { contextWindow } : {}),
      ...(maxTokens ? { maxTokens } : {}),
      input: [...input],
      ...(reasoning ? { reasoning } : {}),
      ...(reasoningEfforts ? { reasoningEfforts } : {}),
      ...(mf?.compat ? { compat: mf.compat } : {}),
      source,
    }
  })
}

// ── 写入目标适配器（两套 schema）────────────────────────────────────────────

/** pi-ai modelProfile 认识、可写入的模型字段（白名单，防止无效字段污染配置）。 */
const PI_AI_MODEL_FIELDS = new Set(['id', 'name', 'contextWindow', 'maxTokens', 'input', 'reasoningEfforts', 'compat'])

/** llm-deepseek catalogModel 认识、可写入的字段（见 packages/llm/llm-deepseek/src/index.ts）。 */
const DEEPSEEK_MODEL_FIELDS = new Set(['id', 'name', 'description', 'contextWindow', 'maxTokens', 'inputModalities', 'imagePixelBudget', 'imageMaxBytes'])

/** DSH compatProfile 认识的字段（过滤 manifest 之外的未知键，防 schema 漂移）。 */
const COMPAT_FIELDS = new Set([
  'supportsStore', 'supportsDeveloperRole', 'supportsReasoningEffort', 'supportsUsageInStreaming',
  'supportsFinishReason', 'maxTokensField', 'requiresToolResultName', 'requiresAssistantAfterToolResult',
  'requiresThinkingAsText', 'requiresReasoningContentOnAssistantMessages', 'thinkingFormat',
  'chatTemplateKwargs', 'chatTemplateArgs', 'supportsThinkingTokenBudget', 'supportsStrictMode',
  'cacheControlFormat', 'supportsLongCacheRetention', 'supportsEagerToolInputStreaming',
  'supportsCacheControlOnTools', 'supportsTemperature', 'forceAdaptiveThinking', 'allowEmptySignature',
  'supportsStrictTools',
])

/** llm-deepseek 的模型级字段是否参与「同 id 目录条目」的覆盖。 */
const DEEPSEEK_PASSTHROUGH = new Set(['description', 'imagePixelBudget', 'imageMaxBytes'])

/** 统一清掉 undefined/null 的浅层对象。 */
function dropEmpty(obj: Record<string, unknown>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** 清洗 compat：按 compatProfile 白名单过滤（空 → undefined）。 */
function cleanCompat(v: unknown): Record<string, unknown> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const c: Record<string, unknown> = {}
  for (const k of Object.keys(v as Record<string, unknown>)) {
    if (COMPAT_FIELDS.has(k)) c[k] = (v as Record<string, unknown>)[k]
  }
  return dropEmpty(c)
}

/** 清洗 reasoningEfforts：仅接受 false 或「含至少一个非 off 档位」的 dict。 */
function cleanReasoningEfforts(v: unknown): false | Record<string, unknown> | undefined {
  if (v === false) return false
  if (typeof v === 'object' && !Array.isArray(v) && v !== null) {
    const dict = v as Record<string, unknown>
    const hasThinking = Object.entries(dict).some(([k, w]) => k !== 'off' && typeof w === 'string' && w.length > 0)
    if (hasThinking) return dict
  }
  return undefined
}

/** 清洗为 pi-ai modelProfile 接受的形状（无 id 或非法 → null）。 */
function cleanPiAiModel(m: unknown, withId: boolean): Record<string, unknown> | null {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null
  const src = m as Record<string, unknown>
  const out: Record<string, unknown> = {}
  if (withId) {
    const id = typeof src.id === 'string' ? src.id.trim() : ''
    if (!id) return null
    out.id = id
  }
  for (const field of ['name', 'contextWindow', 'maxTokens']) {
    const v = src[field]
    if (v === undefined || v === null || v === '') continue
    if (field === 'name') { if (typeof v === 'string') out.name = v }
    else if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[field] = v
  }
  if (Array.isArray(src.input)) {
    const input = src.input.filter((x) => x === 'text' || x === 'image')
    // input 允许空数组（= 不声明，继承目录），但不写空数组（避免无意义覆盖）
    if (input.length > 0) out.input = input
  }
  const efforts = cleanReasoningEfforts(src.reasoningEfforts)
  if (efforts !== undefined) out.reasoningEfforts = makeHostPlain(efforts)
  const compat = cleanCompat(src.compat)
  if (compat) out.compat = makeHostPlain(compat)
  return Object.keys(out).length > 0 ? out : null
}

/** 清洗为 llm-deepseek catalogModel 接受的形状（无 id 或非法 → null）。 */
function cleanDeepSeekModel(m: unknown, withId: boolean): Record<string, unknown> | null {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null
  const src = m as Record<string, unknown>
  const out: Record<string, unknown> = {}
  if (withId) {
    const id = typeof src.id === 'string' ? src.id.trim() : ''
    if (!id) return null
    out.id = id
  }
  if (typeof src.name === 'string' && src.name) out.name = src.name
  if (typeof src.description === 'string' && src.description) out.description = src.description
  for (const field of ['contextWindow', 'maxTokens', 'imageMaxBytes']) {
    const v = src[field]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[field] = v
  }
  const budget = src.imagePixelBudget
  if (budget === 'low' || (typeof budget === 'number' && Number.isFinite(budget) && budget > 0)) out.imagePixelBudget = budget
  // inputModalities：schema 要求 min(1) 且只含 text/image
  const raw = src.inputModalities
  if (Array.isArray(raw)) {
    const mods = [...new Set(raw.filter((x) => x === 'text' || x === 'image'))]
    if (mods.length > 0) out.inputModalities = mods
  }
  // 无图模型不得带 image* 参数（llm-deepseek 会拒绝）
  if (Array.isArray(out.inputModalities) && !(out.inputModalities as string[]).includes('image')) {
    delete out.imagePixelBudget
    delete out.imageMaxBytes
  }
  return Object.keys(out).length > 0 ? out : null
}

/** 按命名空间清洗一条模型（pi-ai / deepseek 两套 schema）。 */
export function cleanForTarget(ns: Namespace, m: unknown, withId = true): Record<string, unknown> | null {
  return ns === 'llm-deepseek' ? cleanDeepSeekModel(m, withId) : cleanPiAiModel(m, withId)
}

/**
 * 把「统一发现结果」（id/name/contextWindow/maxTokens/input/reasoningEfforts/source）
 * 转换成目标命名空间能接受的模型对象。
 */
export function toTargetModel(ns: Namespace, m: Record<string, unknown>): Record<string, unknown> {
  if (ns === 'llm-deepseek') {
    return {
      id: m.id,
      ...(m.name ? { name: m.name } : {}),
      ...(m.contextWindow ? { contextWindow: m.contextWindow } : {}),
      ...(m.maxTokens ? { maxTokens: m.maxTokens } : {}),
      ...(Array.isArray(m.input) ? { inputModalities: [...m.input] } : {}),
    }
  }
  return {
    id: m.id,
    ...(m.name ? { name: m.name } : {}),
    ...(m.contextWindow ? { contextWindow: m.contextWindow } : {}),
    ...(m.maxTokens ? { maxTokens: m.maxTokens } : {}),
    ...(Array.isArray(m.input) ? { input: [...m.input] } : {}),
    ...(m.reasoningEfforts ? { reasoningEfforts: m.reasoningEfforts } : {}),
    ...(m.compat ? { compat: m.compat } : {}),
  }
}

// ── 应用（批量写入发现结果）──────────────────────────────────────────────────

/**
 * 应用：把富化后的 models 写入目标命名空间，保留该 section/提供方的其它所有键；
 * 目录/模板路由缺 api/baseURL 时用清单兜底补齐（否则目录外新模型因协议不统一而
 * 无法解析 api → 校验失败）。写入前逐条清洗为对应 schema 接受的字段（白名单）。
 */
export async function applyModels(st: SettingsService, route: string, models: Array<Record<string, unknown>>): Promise<{ ns: Namespace; count: number }> {
  const target = resolveTarget(route, st)
  if (target === undefined) throw new Error(`未找到提供方 ${route}（settings 里没有该路由）`)
  // 路由必须真实存在：pi-ai 段里没有这个 route 就是打错了，别静默新建一个空提供方
  if (target.ns === 'llm-pi-ai' && !readProviders(st)[route]) throw new Error(`settings 里没有提供方 ${route}`)
  const cleaned = models
    .map((m) => cleanForTarget(target.ns, toTargetModel(target.ns, m), true))
    .filter((m): m is Record<string, unknown> => m !== null)
  if (target.ns === 'llm-deepseek') {
    const user = readUserLayer(st, 'llm-deepseek') ?? {}
    const next: Record<string, unknown> = { ...user, ...(cleaned.length > 0 ? { models: makeHostPlain(cleaned) } : {}) }
    if (cleaned.length === 0) delete next.models
    await st.replace('llm-deepseek', makeHostPlain(next), readRevision(st, 'llm-deepseek'))
    return { ns: target.ns, count: cleaned.length }
  }
  const preserved: Record<string, unknown> = {}
  const section = readSection(st, 'llm-pi-ai')
  if (section) for (const k of Object.keys(section)) if (k !== 'providers') preserved[k] = section[k]
  const providers = { ...readProviders(st) }
  const cur = providers[route]
  if (cur && typeof cur === 'object') {
    const enriched: Record<string, unknown> = { ...cur }
    if (!enriched.api && target.mp?.api) enriched.api = target.mp.api
    if (!enriched.baseURL && target.mp?.baseURL) enriched.baseURL = target.mp.baseURL
    if (cleaned.length > 0) enriched.models = makeHostPlain(cleaned)
    else delete enriched.models
    providers[route] = enriched
  }
  await st.replace('llm-pi-ai', makeHostPlain({ ...preserved, providers }))
  return { ns: target.ns, count: cleaned.length }
}

// ── pi-ai 已安装目录（运行时读取，用于「编辑现有模型」与 modelOverrides 判定）──

/** pi-ai 目录快照缓存：{ providerId: { modelId: ManifestModel } }；null = 不可得。 */
let piAiCatalog: Record<string, Record<string, ManifestModel>> | null | undefined
/** pi-ai 目录加载诊断（失败原因，供 /current 展示）。 */
let piAiCatalogError: string | undefined

/** 候选目录路径（按可靠性排序）：插件自身依赖 → DSH 安装 → checkout → 全局 npm。 */
function piAiDataCandidates(): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (p?: string) => { if (p && !seen.has(p)) { seen.add(p); out.push(p) } }
  const REL = 'node_modules/@earendil-works/pi-ai/dist/providers/data'
  push(process.env.DSH_PI_AI_DATA_DIR)
  // profile 里的 DSH 安装（cwd 通常就是 profile 目录）
  if (process.env.DSH_HOME) push(`${process.env.DSH_HOME}/profiles/web/node_modules/@deepseek-ai/dsh/${REL}`)
  push(`./node_modules/@deepseek-ai/dsh/${REL}`)
  // DSH 安装：全局 npm 前缀下的 @deepseek-ai/dsh/node_modules
  const nm = `node_modules/@deepseek-ai/dsh/${REL}`
  if (process.env.APPDATA) push(`${process.env.APPDATA}/npm/${nm}`)
  if (process.env.HOME) push(`${process.env.HOME}/.npm-global/lib/${nm}`)
  push(`/usr/local/lib/${nm}`)
  push(`/usr/lib/${nm}`)
  // checkout（源码树）
  if (process.env.DSH_CHECKOUT) {
    push(`${process.env.DSH_CHECKOUT}/node_modules/@earendil-works/pi-ai/dist/providers/data`)
    push(`${process.env.DSH_CHECKOUT}/vendor/pi-ai/dist/providers/data`)
  }
  return out
}

/** 一个 pi-ai 目录 JSON → ManifestModel 表（多协议取并集）。 */
function modelsFromCatalogJson(json: unknown): Record<string, ManifestModel> {
  const out: Record<string, ManifestModel> = {}
  if (!json || typeof json !== 'object') return out
  for (const group of Object.values(json as Record<string, unknown>)) {
    if (!group || typeof group !== 'object' || Array.isArray(group)) continue
    for (const [id, raw] of Object.entries(group as Record<string, any>)) {
      if (!id || out[id]) continue
      const input = normalizeInput(raw?.input)
      out[id] = {
        name: typeof raw?.name === 'string' ? raw.name : undefined,
        ...(input ? { input } : {}),
        ...(typeof raw?.contextWindow === 'number' ? { contextWindow: raw.contextWindow } : {}),
        ...(typeof raw?.maxTokens === 'number' ? { maxTokens: raw.maxTokens } : {}),
        ...(raw?.reasoning === true ? { reasoning: true } : {}),
        ...(raw?.thinkingLevelMap && typeof raw.thinkingLevelMap === 'object' ? { thinkingLevelMap: raw.thinkingLevelMap } : {}),
        ...(raw?.compat && typeof raw.compat === 'object' ? { compat: raw.compat } : {}),
      }
    }
  }
  return out
}

/**
 * 读 pi-ai 已安装目录（一次/会话）。用动态 `node:fs` 读数据文件——插件 host 半区
 * 跑在 Node 里，目录是纯数据快照；读不到就降级为「只有清单条目」，绝不抛错。
 * 动态 import 而不是顶层 import：client 半区也会 import 本模块的纯函数，
 * 顶层 node:fs 会污染浏览器 bundle。
 */
export async function loadPiAiCatalog(): Promise<Record<string, Record<string, ManifestModel>>> {
  if (piAiCatalog !== undefined) return piAiCatalog ?? {}
  try {
    const fs: any = await import('node:fs')
    for (const dir of piAiDataCandidates()) {
      try {
        if (!fs.existsSync(dir)) continue
        const out: Record<string, Record<string, ManifestModel>> = {}
        for (const f of fs.readdirSync(dir) as string[]) {
          if (!f.endsWith('.json') || f === '.manifest.json') continue
          try {
            const json = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'))
            const models = modelsFromCatalogJson(json)
            if (Object.keys(models).length > 0) out[f.replace(/\.json$/, '')] = models
          } catch { /* 单个文件坏了不影响其它 */ }
        }
        if (Object.keys(out).length > 0) { piAiCatalog = out; piAiCatalogError = undefined; return out }
      } catch { /* 换下一个候选目录 */ }
    }
    piAiCatalogError = 'pi-ai 目录数据目录未找到'
  } catch (e: any) {
    piAiCatalogError = String(e?.message ?? e)
  }
  piAiCatalog = null
  return {}
}

/** pi-ai 目录加载状态（诊断用）。 */
export async function piAiCatalogStatus() {
  const c = await loadPiAiCatalog()
  return { loaded: Object.keys(c).length > 0, providers: Object.keys(c).length, error: piAiCatalogError }
}

/** 某路由的「已安装目录」模型表：内置清单优先，其次运行时读到的 pi-ai 目录。 */
async function catalogFor(route: string, mp: ManifestProvider | undefined): Promise<Record<string, ManifestModel> | undefined> {
  const runtime = (await loadPiAiCatalog())[route]
  if (mp?.catalog && runtime) return { ...runtime, ...mp.catalog }
  return mp?.catalog ?? runtime
}

// ── 手动编辑：读现有模型 / 写单个模型 / 删模型 ────────────────────────────────

/** 一条可编辑模型的当前值与建议值。 */
export interface EditableModel {
  id: string
  /** 当前 profile 里的展示名 / 容量 / 模态 / 档位（pi-ai）。 */
  current: Record<string, unknown>
  /** 建议值（models.dev + 清单），UI 用「采纳」按钮回填。 */
  suggested: Record<string, unknown>
  /** 建议值来源：models-dev / manifest / catalog / 无。 */
  suggestedSource: 'models-dev' | 'manifest' | 'catalog' | ''
  /** 备注（如「内测模型」）。 */
  note?: string
  /** 是否由用户显式写在 profile 里（false = 适配器默认目录就有的模型）。 */
  configured: boolean
  /** pi-ai catalog 路由：该模型属于已安装目录（可写 modelOverrides 而非 models）。 */
  inCatalog?: boolean
}

/** 把一个 ManifestModel 转成「建议值」形状。 */
function suggestionFromManifest(mf: ManifestModel): Record<string, unknown> {
  return {
    name: mf.name,
    contextWindow: mf.contextWindow,
    maxTokens: mf.maxTokens,
    input: mf.input,
    reasoning: mf.reasoning,
    ...(mf.thinkingLevelMap ? { reasoningEfforts: reasoningEffortsFromManifest(mf.thinkingLevelMap) } : {}),
  }
}

/** 取某路由的「建议元数据」：models.dev 优先，其次内置清单，再次目录清单。 */
function suggestionFor(
  route: string,
  id: string,
  modelsDev: Record<string, any>,
  catalog: Record<string, ManifestModel> | undefined,
): { suggested: Record<string, unknown>; source: EditableModel['suggestedSource']; note?: string } {
  const mp = manifestProvider(route)
  const provDev = modelsDev?.[route]
  const md = provDev?.models?.[id] ?? findByName(provDev?.models, id) ?? globalModelsDevModel(modelsDev, id)
  const mf = mp?.models[id] ?? (mp ? findByName(mp.models, id) : undefined)
  const cat = catalog?.[id] ?? (catalog ? findByName(catalog, id) : undefined)
  if (md) {
    const input = normalizeInput(md?.modalities?.input)
    return {
      suggested: {
        name: md?.name,
        contextWindow: md?.limit?.context,
        maxTokens: md?.limit?.output,
        input,
        reasoning: md?.reasoning,
        ...(reasoningEffortsFromModelsDev(md) ? { reasoningEfforts: reasoningEffortsFromModelsDev(md) } : {}),
      },
      source: 'models-dev',
      note: mf?.note,
    }
  }
  if (mf) return { suggested: suggestionFromManifest(mf), source: 'manifest', note: mf.note }
  if (cat) return { suggested: suggestionFromManifest(cat), source: 'catalog', note: cat.note }
  return { suggested: {}, source: '' }
}

/**
 * 列出某路由的「现有模型」用于手动编辑：
 *  - profile 里已显式配置的模型（`models` 列表 / pi-ai 的 `modelOverrides`）
 *  - 适配器默认目录就有的模型（llm-deepseek 的内置三条 / pi-ai catalog 条目）
 * 每条都带上 models.dev/清单的建议值，UI 可一键采纳。
 */
export async function currentModels(
  st: SettingsService | undefined,
  route: string,
  modelsDev: Record<string, any>,
): Promise<{ target: RouteTarget | undefined; models: EditableModel[]; reasoningEffort?: string; thinking?: string }> {
  const target = resolveTarget(route, st)
  if (target === undefined) return { target: undefined, models: [] }
  const catalog = await catalogFor(route, target.mp)
  const out: EditableModel[] = []
  const seen = new Set<string>()
  const push = (id: string, current: Record<string, unknown>, configured: boolean, inCatalog?: boolean) => {
    if (!id || seen.has(id)) return
    seen.add(id)
    const { suggested, source, note } = suggestionFor(route, id, modelsDev, catalog)
    out.push({ id, current, suggested, suggestedSource: source, note, configured, ...(inCatalog === undefined ? {} : { inCatalog }) })
  }
  if (target.ns === 'llm-deepseek') {
    for (const m of Array.isArray(target.profile.models) ? target.profile.models : []) {
      if (m && typeof m.id === 'string') push(m.id, m as Record<string, unknown>, true)
    }
  } else {
    for (const m of Array.isArray(target.profile.models) ? target.profile.models : []) {
      if (m && typeof m.id === 'string') push(m.id, m as Record<string, unknown>, true)
    }
    const ov = target.profile.modelOverrides
    if (ov && typeof ov === 'object' && !Array.isArray(ov)) {
      for (const [id, v] of Object.entries(ov as Record<string, unknown>)) {
        if (v && typeof v === 'object') push(id, v as Record<string, unknown>, true, true)
      }
    }
  }
  // 适配器默认目录（未显式配置但实际可用）——让"手填的模型号"和"目录模型"同屏可编辑
  if (catalog) for (const id of Object.keys(catalog)) push(id, {}, false)
  return {
    target,
    models: out,
    ...(target.ns === 'llm-deepseek'
      ? {
        reasoningEffort: typeof target.profile.reasoningEffort === 'string' ? target.profile.reasoningEffort : 'high',
        thinking: typeof target.profile.thinking === 'string' ? target.profile.thinking : 'enabled',
      }
      : {}),
  }
}

/** 一个路由允许的推理档位（deepseek 是路由级固定四档；pi-ai 由模型自己声明）。 */
export function routeReasoningLevels(ns: Namespace): string[] {
  return ns === 'llm-deepseek' ? ['off', 'low', 'high', 'max'] : [...THINKING_LEVELS]
}

/**
 * 写入单条模型（新增或更新），保留该模型原有的其它字段与该提供方的其它所有键。
 *  - pi-ai：profile 无 `models` 列表且该模型在目录里 → 写 `modelOverrides[id]`
 *    （只改这一个模型，目录其余照常服务）；否则写 `models` 列表。
 *  - deepseek：写入 `models` 列表（没有目录覆盖机制）。
 */
export async function writeModel(
  st: SettingsService,
  route: string,
  model: Record<string, unknown>,
): Promise<{ ns: Namespace; key: 'models' | 'modelOverrides' }> {
  const target = resolveTarget(route, st)
  if (target === undefined) throw new Error(`未找到提供方 ${route}（settings 里没有该路由）`)
  const id = typeof model.id === 'string' ? model.id.trim() : ''
  if (!id) throw new Error('缺少模型 id')
  const cleaned = cleanForTarget(target.ns, { ...model, id }, true)
  if (cleaned === null) throw new Error(`模型 ${id} 没有任何可写入的字段`)

  if (target.ns === 'llm-deepseek') {
    const user = readUserLayer(st, 'llm-deepseek') ?? {}
    const cur: any[] = Array.isArray(user.models) ? [...user.models] : []
    const i = cur.findIndex((m) => m && m.id === id)
    if (i >= 0) cur[i] = { ...cur[i], ...cleaned }
    else cur.push(cleaned)
    await st.replace('llm-deepseek', makeHostPlain({ ...user, models: cur }), readRevision(st, 'llm-deepseek'))
    return { ns: target.ns, key: 'models' }
  }

  const providers = { ...readProviders(st) }
  const cur: Record<string, any> = { ...(providers[route] ?? {}) }
  const mp = target.mp
  if (!cur.api && mp?.api) cur.api = mp.api
  if (!cur.baseURL && mp?.baseURL) cur.baseURL = mp.baseURL
  const hasCatalog = !!((await catalogFor(route, mp))?.[id])
  const useOverrides = !Array.isArray(cur.models) && hasCatalog
  if (useOverrides) {
    const ov: Record<string, any> = { ...(cur.modelOverrides && typeof cur.modelOverrides === 'object' ? cur.modelOverrides : {}) }
    const prev = ov[id] && typeof ov[id] === 'object' ? ov[id] : {}
    const next = cleanForTarget(target.ns, { ...cleaned }, false)
    ov[id] = makeHostPlain(next ?? prev)
    cur.modelOverrides = makeHostPlain(ov)
  } else {
    const list: any[] = Array.isArray(cur.models) ? [...cur.models] : []
    const i = list.findIndex((m) => m && m.id === id)
    if (i >= 0) list[i] = { ...list[i], ...cleaned }
    else list.push(cleaned)
    cur.models = makeHostPlain(list)
  }
  providers[route] = cur
  const preserved: Record<string, unknown> = {}
  const section = readSection(st, 'llm-pi-ai')
  if (section) for (const k of Object.keys(section)) if (k !== 'providers') preserved[k] = section[k]
  await st.replace('llm-pi-ai', makeHostPlain({ ...preserved, providers }))
  return { ns: target.ns, key: useOverrides ? 'modelOverrides' : 'models' }
}

/** 从该提供方删除一个模型（`models` 列表条目或 pi-ai 的 `modelOverrides` 条目）。 */
export async function removeModel(st: SettingsService, route: string, id: string): Promise<{ removed: boolean; from: string }> {
  const target = resolveTarget(route, st)
  if (target === undefined) throw new Error(`未找到提供方 ${route}（settings 里没有该路由）`)
  if (target.ns === 'llm-deepseek') {
    const user = readUserLayer(st, 'llm-deepseek') ?? {}
    const cur: any[] = Array.isArray(user.models) ? [...user.models] : []
    const next = cur.filter((m) => !(m && m.id === id))
    if (next.length === cur.length) return { removed: false, from: '' }
    await st.replace('llm-deepseek', makeHostPlain({ ...user, models: next }), readRevision(st, 'llm-deepseek'))
    return { removed: true, from: 'models' }
  }
  const providers = { ...readProviders(st) }
  const cur: Record<string, any> = { ...(providers[route] ?? {}) }
  let from = ''
  if (Array.isArray(cur.models)) {
    const next = cur.models.filter((m: any) => !(m && m.id === id))
    if (next.length !== cur.models.length) { cur.models = next; from = 'models' }
  }
  if (!from && cur.modelOverrides && typeof cur.modelOverrides === 'object' && cur.modelOverrides[id] !== undefined) {
    const ov = { ...cur.modelOverrides }
    delete ov[id]
    cur.modelOverrides = ov
    from = 'modelOverrides'
  }
  if (!from) return { removed: false, from: '' }
  providers[route] = cur
  const preserved: Record<string, unknown> = {}
  const section = readSection(st, 'llm-pi-ai')
  if (section) for (const k of Object.keys(section)) if (k !== 'providers') preserved[k] = section[k]
  await st.replace('llm-pi-ai', makeHostPlain({ ...preserved, providers }))
  return { removed: true, from }
}

/** 写入 llm-deepseek 的路由级推理档位 / thinking 开关。 */
export async function writeRouteReasoning(
  st: SettingsService,
  route: string,
  patch: { reasoningEffort?: string; thinking?: string },
): Promise<void> {
  const target = resolveTarget(route, st)
  if (target === undefined || target.ns !== 'llm-deepseek') throw new Error(`${route} 不是 DeepSeek 官方路由`)
  const user = readUserLayer(st, 'llm-deepseek') ?? {}
  const next: Record<string, unknown> = { ...user }
  if (patch.reasoningEffort !== undefined) {
    if (!['off', 'low', 'high', 'max'].includes(patch.reasoningEffort)) throw new Error('reasoningEffort 只能是 off/low/high/max')
    next.reasoningEffort = patch.reasoningEffort
  }
  if (patch.thinking !== undefined) {
    if (!['enabled', 'disabled'].includes(patch.thinking)) throw new Error('thinking 只能是 enabled/disabled')
    next.thinking = patch.thinking
  }
  await st.replace('llm-deepseek', makeHostPlain(next), readRevision(st, 'llm-deepseek'))
}

/** 所有清单提供方键（诊断/工具用）。 */
export function manifestKeys(): string[] {
  return Object.keys(MANIFEST)
}
