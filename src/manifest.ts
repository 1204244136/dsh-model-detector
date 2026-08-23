/**
 * dsh-model-detector — 内置提供方模型清单（curated manifest）。
 *
 * 作用：为「线上发现」补全线上端点不声明的元数据——输入模态（input）、
 * 容量（contextWindow/maxTokens）、推理（reasoning）、协议兼容（compat）。
 * 同时兜底「目录/模板提供方」的 baseURL：DSH 的 llm 服务不暴露查询提供方
 * baseURL 的接口，而 llm-pi-ai 命名空间的解析值里目录路由也不带显式
 * baseURL（运行时才从 pi-ai 目录继承）。本清单按提供方路由 keyed，为所有
 * 官方（pi-ai 目录）模板写上它们已写定的 baseURL，使插件列表、/discover、
 * /apply 在 profile 缺 baseURL 时也有处可依；api 缺省时仍由 pi-ai 目录在
 * 运行时按模型给出，这里不强行写死（避免把 catalog 路由改成显式协议路由）。
 *
 * 线上 `GET /models` 只返回 id/owned_by，永远拿不到模态；pi-ai 目录有模态但
 * 滞后。本清单即「与最新模型同步、但由人工维护的元数据」来源。
 *
 * 合并原则：已知模型用清单补齐，未知模型回退 text + 默认容量（保守，
 * 绝不误判为视觉）。
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

  // ── 官方模板 baseURL 兜底（provider 级，models 留空）───────────────
  // 以下为 DSH 随 pi-ai 目录提供的全部「官方模板」。它们的 baseURL 已写在
  // pi-ai 目录里（node_modules/@earendil-works/pi-ai/dist/providers/*），但未
  // 透出到 llm 服务 / llm-pi-ai 解析值，插件读到的 profile 只有用户显式写的
  // 字段，故目录路由（如 openrouter）的 baseURL 在插件里显示为空。这里照
  // opencode-go 的写法为每个官方模板补上已写定的 baseURL；api 省略，运行时
  // 由 pi-ai 目录按模型给出，避免把 catalog 路由改成显式协议路由。
  // 无固定 baseURL 的模板（azure-openai-responses / cloudflare-* / opencode /
  // bearer-token 等按部署而定）不在此列。
  'ant-ling': { baseURL: 'https://api.ant-ling.com/v1', models: {} },
  'anthropic': { baseURL: 'https://api.anthropic.com', models: {} },
  'cerebras': { baseURL: 'https://api.cerebras.ai/v1', models: {} },
  'deepseek': { baseURL: 'https://api.deepseek.com', models: {} },
  'fireworks': { baseURL: 'https://api.fireworks.ai/inference', models: {} },
  'github-copilot': { baseURL: 'https://api.individual.githubcopilot.com', models: {} },
  'google': { baseURL: 'https://generativelanguage.googleapis.com/v1beta', models: {} },
  'groq': { baseURL: 'https://api.groq.com/openai/v1', models: {} },
  'huggingface': { baseURL: 'https://router.huggingface.co/v1', models: {} },
  'kimi-coding': { baseURL: 'https://api.kimi.com/coding', models: {} },
  'minimax': { baseURL: 'https://api.minimax.io/anthropic', models: {} },
  'minimax-cn': { baseURL: 'https://api.minimaxi.com/anthropic', models: {} },
  'mistral': { baseURL: 'https://api.mistral.ai', models: {} },
  'moonshotai': { baseURL: 'https://api.moonshot.ai/v1', models: {} },
  'moonshotai-cn': { baseURL: 'https://api.moonshot.cn/v1', models: {} },
  'nvidia': { baseURL: 'https://integrate.api.nvidia.com/v1', models: {} },
  'openai': { baseURL: 'https://api.openai.com/v1', models: {} },
  'openai-codex': { baseURL: 'https://chatgpt.com/backend-api', models: {} },
  'openrouter': { baseURL: 'https://openrouter.ai/api/v1', models: {} },
  'qwen-token-plan': { baseURL: 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1', models: {} },
  'qwen-token-plan-cn': { baseURL: 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1', models: {} },
  'together': { baseURL: 'https://api.together.ai/v1', models: {} },
  'vercel-ai-gateway': { baseURL: 'https://ai-gateway.vercel.sh', models: {} },
  'xai': { baseURL: 'https://api.x.ai/v1', models: {} },
  'xiaomi': { baseURL: 'https://api.xiaomimimo.com/v1', models: {} },
  'xiaomi-token-plan-ams': { baseURL: 'https://token-plan-ams.xiaomimimo.com/v1', models: {} },
  'xiaomi-token-plan-cn': { baseURL: 'https://token-plan-cn.xiaomimimo.com/v1', models: {} },
  'xiaomi-token-plan-sgp': { baseURL: 'https://token-plan-sgp.xiaomimimo.com/v1', models: {} },
  'zai': { baseURL: 'https://api.z.ai/api/coding/paas/v4', models: {} },
  'zai-coding-cn': { baseURL: 'https://open.bigmodel.cn/api/coding/paas/v4', models: {} },
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
