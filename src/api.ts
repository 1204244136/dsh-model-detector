/**
 * dsh-model-detector — Host 半区业务逻辑（清单列举 / 发现合并 / 应用写入）。
 *
 * 元数据来源（四级优先级，无需人工逐模型维护）：
 *  1. models.dev（自动，社区维护，含模态/容量/推理）——主源
 *  2. 内置 manifest（薄覆盖层，仅覆盖 models.dev 缺/错的模型）
 *  3. 名字级匹配（精确命中失败时，按归一化名字等效命中 models.dev/manifest 条目，
 *     或以模型名里的容量/模态 token 推导：如 128k/256k/4k/1.5m、vision/vl/image）
 *  4. 保守默认（text + 262144/32768）
 *
 * 与 dsh-model-pro 相同的跨 realm 约定：静态 bundle 运行在宿主 sandbox
 * realm，settings 解析值是深冻结对象；写入用 makeHostPlain 重建以通过
 * isPlainObject 检查。
 */

import { manifestProvider, type ManifestModel } from './manifest.js'

/** models.dev 元数据端点（自动更新、覆盖几乎所有提供方）。 */
export const MODELS_DEV_URL = 'https://models.dev/api.json'

/** 归一化后：DSH 只支持 text/image，把 models.dev 的完整模态列表映射过来。 */
export function normalizeInput(modalities?: unknown): Array<'text' | 'image'> | undefined {
  if (!Array.isArray(modalities)) return undefined
  const set = new Set(modalities)
  return set.has('image') ? ['text', 'image'] : ['text']
}

/** settings 服务子集（与 dsh-model-pro 相同）。 */
export interface SettingsService {
  get(ns: string): Record<string, unknown> | undefined
  readonly writable: boolean
  replace(ns: string, section: unknown): Promise<void>
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

/** 读取 llm-pi-ai 提供方表。 */
export function readProviders(st: SettingsService | undefined): Record<string, any> {
  if (st === undefined) return {}
  try {
    const section = st.get('llm-pi-ai')
    if (section && typeof section === 'object' && (section as any).providers && typeof (section as any).providers === 'object')
      return (section as any).providers
  } catch { /* ignore */ }
  return {}
}

/** 列出已配置的 pi-ai 提供方（route / displayName / api / baseURL / 模型数）。 */
export function listConfiguredProviders(st: SettingsService | undefined) {
  const providers = readProviders(st)
  return Object.entries(providers).map(([route, p]: any) => ({
    route,
    displayName: (p && typeof p.displayName === 'string' && p.displayName) || route,
    api: p?.api || manifestProvider(route)?.api || '',
    baseURL: p?.baseURL || manifestProvider(route)?.baseURL || '',
    modelCount: Array.isArray(p?.models) ? p.models.length : 0,
    inManifest: manifestProvider(route) !== undefined,
  }))
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

/** 归一化模型 id 用于名字级匹配：小写、去尾部日期/版本/后缀段。 */
function normalizeModelId(id: string): string {
  return id
    .toLowerCase()
    // 去掉尾部日期段（YYMMDD=6位 / YYYYMMDD=8位）及 latest/beta/rc/dev/preview/ga/stable 后缀
    .replace(/(?:[-_.])?(?:[12]\d{7}|\d{6})\s*$/g, '')
    .replace(/[-_.](?:latest|beta|rc|dev|preview|ga|stable)\b(?:[-_.]|\b)/g, '')
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

/** 在 models.dev / manifest 的模型记录里按名字级等效命中（未命中返回 undefined）。 */
function findByName<T>(entries: Record<string, T> | undefined, id: string): T | undefined {
  if (!entries) return undefined
  for (const key in entries) {
    if (modelNameEquivalent(key, id)) return entries[key]
  }
  return undefined
}

/**
 * 全局 models.dev 回退：当前提供方未收录时，按名字级等效在 models.dev 的其它
 * 提供方里命中。聚合/网关路由（如 opencode-go、volcengine）常把模型挂在各自
 * 上游厂商 slug（如 minimax、deepseek）下，而非当前路由键，需跨提供方扫一遍。
 */
function globalModelsDevModel(modelsDev: Record<string, any>, id: string): any | undefined {
  for (const providerId in modelsDev) {
    const hit = findByName(modelsDev[providerId]?.models, id)
    if (hit) return hit
  }
  return undefined
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
    const contextWindow = md?.limit?.context ?? mf?.contextWindow ?? providerDefault.contextWindow
    const maxTokens = md?.limit?.output ?? mf?.maxTokens ?? providerDefault.maxTokens
    const input = normalizeInput(md?.modalities?.input) ?? mf?.input ?? defInput
    const reasoning = md?.reasoning ?? mf?.reasoning
    // 来源：models.dev > manifest > 保守默认（供 UI 区分"查得"与"兜底"）
    const source = md ? 'models-dev' : mf ? 'manifest' : 'default'
    return {
      id,
      name: (md?.name || mf?.name || id) as string,
      ...(contextWindow ? { contextWindow } : {}),
      ...(maxTokens ? { maxTokens } : {}),
      input: [...input],
      ...(reasoning !== undefined ? { reasoning } : {}),
      ...(mf?.thinkingLevelMap ? { thinkingLevelMap: mf.thinkingLevelMap } : {}),
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
    const input = (mf?.input ?? defInput)
    const reasoning = mf?.reasoning
    const source = mf ? 'manifest' : 'default'
    return {
      id,
      name: (mf?.name || id) as string,
      ...(contextWindow ? { contextWindow } : {}),
      ...(maxTokens ? { maxTokens } : {}),
      input: [...input],
      ...(reasoning !== undefined ? { reasoning } : {}),
      ...(mf?.thinkingLevelMap ? { thinkingLevelMap: mf.thinkingLevelMap } : {}),
      ...(mf?.compat ? { compat: mf.compat } : {}),
      source,
    }
  })
}

/**
 * 应用：把富化后的 models 写入 `llm-pi-ai.providers.<route>.models`，
 * 保留该 section 的其它所有键；目录/模板路由缺 api/baseURL 时用清单兜底补齐
 * （否则目录外新模型因协议不统一而无法解析 api → 校验失败）。
 */
export async function applyModels(st: SettingsService, route: string, models: Array<Record<string, unknown>>): Promise<void> {
  const preserved: Record<string, unknown> = {}
  try {
    const section = st.get('llm-pi-ai') as Record<string, unknown> | undefined
    if (section && typeof section === 'object') {
      for (const k of Object.keys(section)) {
        if (k === 'providers') continue
        preserved[k] = section[k]
      }
    }
  } catch { /* nothing to preserve */ }
  const providers = { ...(readProviders(st)) }
  const cur = providers[route]
  if (cur && typeof cur === 'object') {
    const mp = manifestProvider(route)
    const enriched: Record<string, unknown> = { ...cur }
    if (!enriched.api && mp?.api) enriched.api = mp.api
    if (!enriched.baseURL && mp?.baseURL) enriched.baseURL = mp.baseURL
    if (models.length > 0) enriched.models = makeHostPlain(models)
    else delete enriched.models
    providers[route] = enriched
  }
  await st.replace('llm-pi-ai', makeHostPlain({ ...preserved, providers }))
}
