/**
 * dsh-model-detector — 「编辑现有模型」的草稿逻辑（纯函数：无 React、无 JSX、无 DOM）。
 *
 * 为什么单独成文件：这里决定了每张卡片的按钮显示「保存」还是「已保存」——
 * 是本页最容易对用户撒谎的地方（见 {@link draftIsDirty} / {@link mergeDrafts} 的注释）。
 * 拆成无 JSX 的模块才能被 scripts/verify-client.mjs 直接 import 做回归
 * （.tsx 带 JSX，Node 跑不了）。
 */

/** 写入目标：pi-ai（llm-pi-ai 段）或 DeepSeek 官方 API（llm-deepseek 段）。 */
export type TargetNs = 'pi-ai' | 'deepseek'

/** pi-ai 思考档位（与 host 侧 THINKING_LEVELS 一致，升序）：既用于展示排序，也用于草稿规范化。 */
export const EFFORT_ORDER: string[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']

/** 输入模态显示名。 */
export const MODALITY: Record<'text' | 'image', string> = { text: '文本', image: '图像' }

/** 一条编辑草稿：UI 直接绑定这些字段。 */
export interface Draft {
  id: string
  name: string
  contextWindow: string
  maxTokens: string
  /** pi-ai: text/image 声明；deepseek 走 inputModalities。 */
  input: Array<'text' | 'image'>
  /** pi-ai 专属：档位 → wire 值（'off' 档位用 '' 表示 null）。 */
  efforts: Record<string, string>
  /** pi-ai 专属：compat JSON 文本。 */
  compatText: string
  /** deepseek 专属。 */
  description: string
}

/** 一条可编辑模型：`current` 是服务端真值，`suggested` 是建议值。 */
export interface EditableModel {
  id: string
  current: Record<string, any>
  suggested: Record<string, any>
  suggestedSource: '' | 'provider' | 'models-dev' | 'manifest' | 'catalog'
  note?: string
  /** 是否已显式写进配置（false = 只来自适配器默认目录）。 */
  configured: boolean
  /** pi-ai：该条属于已安装目录（写 modelOverrides）。 */
  inCatalog?: boolean
  /**
   * 只存在于本地草稿（手填模型号，服务端还没有这条）——{@link draftIsDirty} 必须据此报「未保存」。
   * 由 Page 的 `filteredEdit` 给「drafts 里有、服务端列表里没有」的条目打上。
   */
  draftOnly?: boolean
}

/** 服务端一条模型 → 编辑草稿。 */
export const toDraft = (id: string, src: Record<string, any>, target: TargetNs): Draft => {
  const input = Array.isArray(src.input) ? src.input : Array.isArray(src.inputModalities) ? src.inputModalities : []
  const efforts: Record<string, string> = {}
  const raw = src.reasoningEfforts
  if (raw && typeof raw === 'object') {
    for (const k of EFFORT_ORDER) if (raw[k] !== undefined) efforts[k] = raw[k] === null ? '' : String(raw[k])
  }
  return {
    id,
    name: typeof src.name === 'string' ? src.name : '',
    contextWindow: src.contextWindow ? String(src.contextWindow) : '',
    maxTokens: src.maxTokens ? String(src.maxTokens) : '',
    input: input.filter((x: any) => x === 'text' || x === 'image'),
    efforts,
    compatText: src.compat && typeof src.compat === 'object' ? JSON.stringify(src.compat) : '',
    description: typeof src.description === 'string' ? src.description : '',
  }
}

/** 草稿 → 提交给 host 的模型对象（按目标命名空间裁剪）。 */
export const draftToModel = (d: Draft, target: TargetNs): Record<string, unknown> => {
  const out: Record<string, unknown> = { id: d.id }
  if (d.name) out.name = d.name
  const ctx = Number(d.contextWindow)
  if (Number.isFinite(ctx) && ctx > 0) out.contextWindow = Math.floor(ctx)
  const mt = Number(d.maxTokens)
  if (Number.isFinite(mt) && mt > 0) out.maxTokens = Math.floor(mt)
  if (target === 'deepseek') {
    if (d.description) out.description = d.description
    out.inputModalities = d.input.length > 0 ? [...d.input] : ['text']
    return out
  }
  if (d.input.length > 0) out.input = [...d.input]
  const efforts: Record<string, string | null> = {}
  for (const [k, v] of Object.entries(d.efforts)) {
    if (k === 'off') { if (v === '') efforts.off = null; else efforts.off = v; continue }
    if (v) efforts[k] = v
  }
  if (Object.keys(efforts).length > 0) out.reasoningEfforts = efforts
  const txt = d.compatText.trim()
  if (txt) {
    try { out.compat = JSON.parse(txt) } catch { /* 非法 JSON 忽略，避免写坏配置 */ }
  }
  return out
}

/**
 * 规范化草稿，使比较与「用户操作顺序」无关。
 *
 * `efforts` 的键序取决于用户先点了哪个档位（`{high,low}` 与 `{low,high}` 是同一个含义），
 * `input` 的顺序取决于先勾了哪个模态。不归一就直接 JSON 比较，会把语义相同的两条判成不同，
 * 于是按钮永远显示「未保存」（真的踩过：先点 high 再点 low，保存成功后按钮仍显示「保存」）。
 */
export function canonicalDraft(d: Draft): Draft {
  const efforts: Record<string, string> = {}
  for (const k of EFFORT_ORDER) if (d.efforts[k] !== undefined) efforts[k] = d.efforts[k]
  const input = [...d.input].sort() as Array<'text' | 'image'>
  return { ...d, input, efforts }
}

/** 两条草稿是否语义相同（顺序无关）。 */
export const sameDraft = (a: Draft, b: Draft): boolean =>
  JSON.stringify(canonicalDraft(a)) === JSON.stringify(canonicalDraft(b))

/**
 * 该条草稿相对服务端是否**有未保存的改动** —— 按钮显示「保存」还是「已保存」只看它。
 *
 * `draftOnly`（服务端还没有这条，如手填模型号）一律算未保存：它的 `current` 是 `{}`，
 * 草稿恰好等于 `toDraft({})`，若照常比较会得到 false —— 按钮变「已保存」且被禁用，
 * 手填的模型根本没法保存。
 */
export const draftIsDirty = (m: EditableModel, d: Draft, target: TargetNs): boolean =>
  m.draftOnly === true ? true : !sameDraft(d, toDraft(m.id, m.current, target))

/**
 * 把「服务端现有模型」与「本地草稿」合并成新的草稿表 —— 保存/删除之后的局部重同步。
 *
 * `syncIds` 指定哪些 id **以服务端为准**；`undefined` = 全量重建（用户主动「读取现有模型」/
 * 切换提供方）。规则：
 *  - 在 `syncIds` 里、服务端还有 → 用服务端值重建草稿（保存成功后该条变「已保存」）
 *  - 在 `syncIds` 里、服务端没有了 → 从草稿表里丢掉（删除后不残留成一张幽灵卡片）
 *  - 不在 `syncIds` 里且本地已有草稿 → **原样保留**
 *
 * 最后一条是本函数存在的全部理由。保存 A 之后若用服务端值整体重建 drafts，B / C 上还没
 * 保存的编辑会被**悄悄丢弃**（一个字节都没写进去），而 dirty 是「草稿 vs 服务端」算出来的
 * ——于是 B / C 的按钮也一起变成「已保存」。用户报告的「点一个按钮所有按钮都变已保存」
 * 就是这个：以为都存了，实际只存了一条，其余的改动已经没了。
 */
export function mergeDrafts(
  prev: Record<string, Draft>,
  models: Array<{ id: string; current: Record<string, any> }>,
  target: TargetNs,
  syncIds?: string[],
): Record<string, Draft> {
  const authoritative = syncIds === undefined ? undefined : new Set(syncIds)
  const next: Record<string, Draft> = {}
  for (const m of models) {
    const kept = prev[m.id]
    const rebuild = authoritative === undefined || authoritative.has(m.id) || kept === undefined
    next[m.id] = rebuild ? toDraft(m.id, m.current, target) : kept
  }
  // 全量重建（用户主动重读）：以服务端为准，本地未保存的条目一并清掉
  if (authoritative === undefined) return next
  // 服务端列表里没有的草稿：手填的新模型保留，刚被删掉的（在 syncIds 里）丢弃
  for (const [id, d] of Object.entries(prev)) {
    if (id in next || authoritative.has(id)) continue
    next[id] = d
  }
  return next
}

/** 草稿表里有多少条未保存（编辑模式提示用）。 */
export function countDirty(
  models: EditableModel[],
  drafts: Record<string, Draft>,
  target: TargetNs,
): number {
  let n = 0
  for (const m of models) {
    const d = drafts[m.id]
    if (d !== undefined && draftIsDirty(m, d, target)) n++
  }
  return n
}
