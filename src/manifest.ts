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
  /** 备注（UI 展示用，例如「内测模型，模态为推断值」）。 */
  note?: string
  /** 推理档位 → wire 值映射（可选，deepseek 家族需要）。 */
  thinkingLevelMap?: Record<string, string | null>
  compat?: Record<string, unknown>
}

export interface ManifestProvider {
  /** 该提供方默认的 wire 协议（如 openai-completions）。 */
  api?: string
  /** 该提供方默认 baseURL。 */
  baseURL?: string
  /**
   * 写入目标：`pi-ai`（llm-pi-ai 段）或 `deepseek`（llm-deepseek 段，DeepSeek 官方 API）。
   * 缺省 `pi-ai`。同一 route 键可能在两个段里都存在（如 `deepseek` 是 pi-ai 目录路由、
   * `deepseek-official` 是内置 DeepSeek 适配器路由），因此这条只作兜底：实际命名空间
   * 以 settings 里该 route 的归属为准。
   */
  target?: 'pi-ai' | 'deepseek'
  /**
   * 该路由在 models.dev 里的**上游厂商**（models.dev 只为真正的厂商/Vendor 注册 provider，
   * 不给本地代理、聚合网关单独建条目 —— 如 antigravity 反代暴露的 gemini-* / claude-* /
   * gpt-*，在 models.dev 里分别挂在 `google` / `anthropic` / `openai` 名下）。
   *
   * 命中上游时优先于全局跨厂商扫描：全局扫描在多个等效候选同分时按 provider 遍历顺序
   * 决出，会任取某个网关的乐观值（实测 `gemini-3.8-flash` 取到 vivgrid 的
   * maxTokens=128000，而 google 的权威值是 65536 —— 超限请求会被上游拒掉）。
   */
  upstream?: string[]
  /** 清单条目备注（UI 展示用，例如「内测模型」）。 */
  note?: string
  /**
   * 该提供方「已安装目录」的模型（pi-ai 内置 catalog / 内置适配器默认 models）。
   * 与 {@link models} 不同：这些模型未必在 profile 里显式配置，但适配器默认就会服务；
   * 用于「编辑现有模型」时给出可编辑的候选（无需等线上发现）。
   */
  catalog?: Record<string, ManifestModel>
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
  // antigravity（本机反代，Anthropic 协议，baseURL 形如 http://127.0.0.1:8045）：models.dev
  // 没有这个 provider，且它的清单端点只在 /v1/models（见 api.ts 的 liveModelsUrls）。
  // 这里只声明上游厂商用于富化；baseURL 属每台机器自己的本地端口，不写死。
  'antigravity': { upstream: ['google', 'anthropic', 'openai'], models: {} },
  'anthropic': { baseURL: 'https://api.anthropic.com', models: {} },
  // WorkBuddy（本机网关，baseURL 形如 http://127.0.0.1:7863/v1，清单同样只在 /v1/models）：
  // 模型号带**区域命名空间前缀**（`cn:deepseek-v4.1-flash`、`global:glm-5.3`），由
  // normalizeModelId 剥掉；upstream 按厂商声明，让 `glm-*`/`kimi-*`/`minimax-*`/`gpt-*`/
  // `gemini-*`/`hy*` 拿到第一方元数据，而不是随机落进某个网关的乐观容量值。
  'wb': {
    upstream: [
      'deepseek', 'moonshotai', 'zai', 'zhipuai', 'minimax', 'minimax-cn',
      'tencent-tokenhub', 'tencent-token-plan', 'tencent-coding-plan',
      'openai', 'google', 'anthropic', 'alibaba', 'alibaba-cn',
    ],
    models: {},
  },
  'cerebras': { baseURL: 'https://api.cerebras.ai/v1', models: {} },
  // ── DeepSeek 官方 API（内置 llm-deepseek 适配器 + pi-ai 目录路由）──────────
  // 路由键有两种：内置适配器路由 `deepseek-official`（settings 段 `llm-deepseek`）
  // 与 pi-ai 目录路由 `deepseek`（settings 段 `llm-pi-ai`）。两者都是
  // https://api.deepseek.com 的 OpenAI 兼容端点，共用同一份模型元数据。
  //
  // 为什么必须在这里声明（而非只靠 models.dev）：
  //  - 内置适配器 `dsh-llm-deepseek` 在收到图片时硬判定
  //    `models.find(id)?.inputModalities?.includes('image') !== true` → 抛
  //    `UNSUPPORTED_CONTENT`。即「手动填一个模型号」= 没写 inputModalities = 纯文本，
  //    图片一律被拒（这正是 deepseek-v4.1-flash-expires-on-0910 的困境）。
  //  - 线上 GET /models 只回 id/owned_by，永远拿不到模态。
  'deepseek-official': {
    api: 'openai-completions',
    baseURL: 'https://api.deepseek.com',
    target: 'deepseek',
    // 适配器默认目录（未写进 settings 时也在服务），用于「编辑现有模型」同屏列出
    catalog: {
      'deepseek-v4-flash': { name: 'DeepSeek V4 Flash', input: ['text'], contextWindow: 1000000, reasoning: true },
      'deepseek-v4-pro': { name: 'DeepSeek V4 Pro', input: ['text'], contextWindow: 1000000, reasoning: true },
      'deepseek-v4-flash-vision-exp': { name: 'DeepSeek V4 Flash Vision (Exp)', input: ['text', 'image'], contextWindow: 1000000, reasoning: true },
    },
    models: {
      'deepseek-v4-flash': {
        name: 'DeepSeek V4 Flash',
        input: ['text'],
        contextWindow: 1000000, maxTokens: 384000, reasoning: true,
      },
      'deepseek-v4-pro': {
        name: 'DeepSeek V4 Pro',
        input: ['text'],
        contextWindow: 1000000, maxTokens: 384000, reasoning: true,
      },
      'deepseek-v4-flash-vision-exp': {
        name: 'DeepSeek V4 Flash Vision (Exp)',
        input: ['text', 'image'],
        contextWindow: 1000000, maxTokens: 384000, reasoning: true,
      },
      // 内测模型：官方 GET /models 与 models.dev 均未收录，只能手填模型号。
      // 模态按「flash 家族 + vision 实验线」推断为 text+image；若实测被拒，用
      // 「编辑现有模型」把输入模态改回文本即可。
      'deepseek-v4.1-flash-expires-on-0910': {
        name: 'DeepSeek V4.1 Flash (内测, 2026-09-10 到期)',
        note: '内测模型，官方 /models 未收录；模态为推断值，可用「编辑现有模型」修正',
        input: ['text', 'image'],
        contextWindow: 1000000, maxTokens: 384000, reasoning: true,
      },
    },
  },
  'deepseek': {
    baseURL: 'https://api.deepseek.com',
    target: 'pi-ai',
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
      'deepseek-v4.1-flash-expires-on-0910': {
        name: 'DeepSeek V4.1 Flash (内测, 2026-09-10 到期)',
        note: '内测模型，官方 /models 未收录；模态为推断值，可用「编辑现有模型」修正',
        input: ['text', 'image'],
        contextWindow: 1000000, maxTokens: 384000, reasoning: true,
        thinkingLevelMap: { minimal: null, low: null, medium: null, high: 'high', max: 'max' },
        compat: { supportsStore: false, supportsDeveloperRole: false, maxTokensField: 'max_tokens', requiresReasoningContentOnAssistantMessages: true, thinkingFormat: 'deepseek' },
      },
    },
  },
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
 * 家族级模态推断：清单里没有的新模型号，若同族的清单条目声明了 image，就按同族
 * 继承模态。用于内测/预发布模型（如 `deepseek-v4.1-flash-expires-on-0910` 与
 * `deepseek-v4-flash-vision-exp` 同族）——避免"手填一个模型号 = 纯文本"。
 *
 * 只在**没有任何其它来源**声明模态时使用，且必须有同族条目；宁可保守（返回
 * undefined 走纯文本）也不凭名字里的 vision 字样猜测。
 *
 * @param provider - 清单提供方（pi-ai 或 deepseek 目标都适用）
 * @param id - 待推断的模型 id
 * @returns 推断出的输入模态；无同族依据时 undefined
 */
export function inferFamilyInput(provider: ManifestProvider | undefined, id: string): Array<'text' | 'image'> | undefined {
  if (!provider) return undefined
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const target = norm(id)
  if (!target) return undefined
  // 家族前缀 = 归一化 id 去掉尾部版本/日期/后缀噪声后的第一个字母数字段组
  const family = target.split('-').filter((seg) => !/^\d+$/.test(seg)).slice(0, 2).join('-')
  if (!family) return undefined
  let hit: Array<'text' | 'image'> | undefined
  for (const [key, m] of Object.entries(provider.models)) {
    if (!m.input || !m.input.includes('image')) continue
    const nk = norm(key)
    if (nk === target) continue
    if (nk.startsWith(family)) { hit = m.input; break }
  }
  return hit
}

/**
 * 提供方路由别名 → 清单主键。用户的提供方路由可能与目录 id 有差异（如
 * 自定义命名 `opencodego` vs 目录 `opencode-go`），归一化后都能命中清单。
 */
const MANIFEST_ROUTE_ALIAS: Record<string, string> = {
  'opencodego': 'opencode-go',
  'opencode-go': 'opencode-go',
  // 内置 DeepSeek 适配器路由（dsh-llm-deepseek）→ 清单主键同名；此处仅用于
  // 让 `deepseekofficial` 之类的手写 route 也能命中清单。
  'deepseekofficial': 'deepseek-official',
  'deepseek-official': 'deepseek-official',
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
