/**
 * dsh-model-detector — 内置提供方模型清单（curated manifest）。
 *
 * 作用：为「线上发现」补全线上端点不声明的元数据——输入模态（input）、
 * 容量（contextWindow/maxTokens）、推理（reasoning）、协议兼容（compat）。
 *
 * 线上 `GET /models` 只返回 id/owned_by，永远拿不到模态；pi-ai 目录有模态但
 * 滞后。本清单即「与最新模型同步、但由人工维护的元数据」来源。
 *
 * 结构按「提供方路由 keyed」设计，可扩展到任意提供方；当前以 opencode-go
 * 为全量样本。合并原则：已知模型用清单补齐，未知模型回退 text + 默认容量
 * （保守，绝不误判为视觉）。
 */

export interface ManifestModel {
  id?: string
  name?: string
  /** 输入模态：text 文本、image 图像。已知才声明，未知靠合并回退。 */
  input?: Array<'text' | 'image'>
  contextWindow?: number
  maxTokens?: number
  /** 是否推理模型；true 会带上 thinking 分发形态。 */
  reasoning?: boolean
  /** 推理档位 → wire 值映射（可选，deepseek 家族需要）。 */
  thinkingLevelMap?: Record<string, string | null>
  compat?: Record<string, unknown>
}

export interface ManifestProvider {
  /** 该提供方默认的 wire 协议（如 openai-completions）。 */
  api?: string
  /** 该提供方默认 baseURL。 */
  baseURL?: string
  models: Record<string, ManifestModel>
}

/** 内置清单。key = pi-ai 提供方路由 id；可按 provider 扩展。 */
export const MANIFEST: Record<string, ManifestProvider> = {
  'opencode-go': {
    api: 'openai-completions',
    baseURL: 'https://opencode.ai/zen/go/v1',
    models: {
      'deepseek-v4-flash': {
        name: 'DeepSeek V4 Flash',
        input: ['text'],
        contextWindow: 1000000, maxTokens: 384000, reasoning: true,
        thinkingLevelMap: { minimal: null, low: null, medium: null, high: 'high', max: 'max' },
        compat: { supportsStore: false, supportsDeveloperRole: false, maxTokensField: 'max_tokens', requiresReasoningContentOnAssistantMessages: true, thinkingFormat: 'deepseek' },
      },
      'deepseek-v4-pro': {
        name: 'DeepSeek V4 Pro',
        input: ['text'],
        contextWindow: 1000000, maxTokens: 384000, reasoning: true,
        thinkingLevelMap: { minimal: null, low: null, medium: null, high: 'high', max: 'max' },
        compat: { supportsStore: false, supportsDeveloperRole: false, maxTokensField: 'max_tokens', requiresReasoningContentOnAssistantMessages: true, thinkingFormat: 'deepseek' },
      },
      'deepseek-v4-flash-vision-exp': {
        name: 'DeepSeek V4 Flash Vision (Exp)',
        input: ['text', 'image'],
        contextWindow: 1000000, maxTokens: 384000, reasoning: true,
        thinkingLevelMap: { minimal: null, low: null, medium: null, high: 'high', max: 'max' },
        compat: { supportsStore: false, supportsDeveloperRole: false, maxTokensField: 'max_tokens', requiresReasoningContentOnAssistantMessages: true, thinkingFormat: 'deepseek' },
      },
      'ox-alpha-free': {
        name: 'ox-alpha-free',
        input: ['text'],
        contextWindow: 1000000, maxTokens: 32768, reasoning: false,
      },
      'muse-spark-1.2-contributor': {
        name: 'Muse Spark 1.2 (Contributor)',
        input: ['text', 'image'],
        contextWindow: 1000000, maxTokens: 131072, reasoning: false,
      },
      'mimo-v2.5': { input: ['text', 'image'], contextWindow: 1000000, maxTokens: 128000, reasoning: true },
      'mimo-v2.5-pro': { input: ['text'], contextWindow: 1048576, maxTokens: 128000, reasoning: true },
      'mimo-v2-omni': { input: ['text', 'image'], contextWindow: 1000000, maxTokens: 131072, reasoning: true },
      'mimo-v2-pro': { input: ['text'], contextWindow: 1000000, maxTokens: 131072, reasoning: true },
      'kimi-k3': { name: 'Kimi K3 (2x usage)', input: ['text', 'image'], contextWindow: 1048576, maxTokens: 131072, reasoning: true, thinkingLevelMap: { off: null, minimal: null, low: null, medium: null, high: null, xhigh: null, max: 'max' } },
      'kimi-k2.7-code': { input: ['text', 'image'], contextWindow: 262144, maxTokens: 262144, reasoning: true },
      'kimi-k2.6': { input: ['text', 'image'], contextWindow: 262144, maxTokens: 65536, reasoning: true },
      'kimi-k2.5': { input: ['text', 'image'], contextWindow: 262144, maxTokens: 65536, reasoning: true },
      'glm-5.3': { input: ['text'], contextWindow: 1000000, maxTokens: 131072, reasoning: true },
      'glm-5.2': { input: ['text'], contextWindow: 1000000, maxTokens: 131072, reasoning: true },
      'glm-5.1': { input: ['text'], contextWindow: 202752, maxTokens: 32768, reasoning: true },
      'glm-5': { input: ['text'], contextWindow: 1000000, maxTokens: 131072, reasoning: true },
      'hy3': { input: ['text'], contextWindow: 256000, maxTokens: 64000, reasoning: true },
      'hy3-preview': { input: ['text'], contextWindow: 400000, maxTokens: 64000, reasoning: true },
      'minimax-m2.7': { input: ['text'], contextWindow: 204800, maxTokens: 131072, reasoning: true },
      'minimax-m2.5': { input: ['text'], contextWindow: 1000000, maxTokens: 131072, reasoning: true },
      'qwen3.6-plus': { input: ['text', 'image'], contextWindow: 1000000, maxTokens: 65536, reasoning: true },
      'qwen3.5-plus': { input: ['text'], contextWindow: 1000000, maxTokens: 65536, reasoning: true },
    },
  },
}

/** 归一化的模态文本标签，用于 UI 展示。 */
export const MODALITY_LABEL: Record<'text' | 'image', string> = { text: '文本', image: '图像' }

/**
 * 提供方路由别名 → 清单主键。用户的提供方路由可能与目录 id 有差异（如
 * 自定义命名 `opencodego` vs 目录 `opencode-go`），归一化后都能命中清单。
 */
const MANIFEST_ROUTE_ALIAS: Record<string, string> = {
  'opencodego': 'opencode-go',
  'opencode-go': 'opencode-go',
}

/** 取一个提供方路由的清单主键；无命中返回空串。 */
export function manifestKey(route: string): string {
  if (MANIFEST[route]) return route
  const alias = MANIFEST_ROUTE_ALIAS[route]
  return alias && MANIFEST[alias] ? alias : ''
}

/** 按归一化主键取清单提供方元数据（无命中 undefined）。 */
export function manifestProvider(route: string): ManifestProvider | undefined {
  const key = manifestKey(route)
  return key ? MANIFEST[key] : undefined
}
