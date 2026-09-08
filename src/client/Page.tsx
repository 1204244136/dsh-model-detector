/**
 * dsh-model-detector — 提供方中心设置页（DSH 设计语言版）。
 *
 * 两种模式：
 *  - 发现：选提供方 → 「获取最新模型」（该提供方 /models + models.dev 合并）→
 *    分页预览（模态/容量/推理）→ 勾选 →「应用」写入该提供方。
 *  - 编辑：列出该提供方**现有**模型（profile 已配置 + 适配器默认目录），逐条改参数
 *    （是否支持多模态 / 上下文 / 输出上限 / 思考档位 / compat），或手填新模型号。
 *    手填的模型号默认没有模态声明 —— 在这里勾上「图像」即可让适配器接受图片。
 *
 * 样式：复用 DSH 的 `--dsw-alias-*` token + capsule 按钮 + 发丝线卡片（styles.ts）。
 */
import React from './react'

const API_PREFIX = '/dsh-model-detector/api'
const PAGE_SIZE = 80
const AUTO_SELECT_LIMIT = 200

const MODALITY: Record<'text' | 'image', string> = { text: '文本', image: '图像' }

/** pi-ai 思考档位（与 host 侧 THINKING_LEVELS 一致，升序），用于 UI 展示排序。 */
const EFFORT_ORDER = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']

/** 把 reasoningEfforts 格式化为可读档位串（如 `Low / High / Max`），无档位返回 undefined。 */
const formatEfforts = (e?: Record<string, string | null>) => {
  if (!e) return undefined
  const levels = EFFORT_ORDER.filter((k) => k !== 'off' && e[k] !== undefined)
  if (levels.length === 0) return undefined
  return levels.map((k) => k.charAt(0).toUpperCase() + k.slice(1)).join(' / ')
}

/** 元数据来源标注：UI 据此区分「查得」与「兜底」，避免把默认当查得。 */
const SOURCE_LABEL: Record<string, string> = {
  'models-dev': 'models.dev',
  'manifest': '清单',
  'catalog': '目录',
  'default': '默认',
}

/** 数字格式：上下文/输出容量，无值显示 —。 */
const fmt = (n?: number) => (n ? n.toLocaleString('en-US') : '—')

interface ProviderItem {
  route: string
  displayName: string
  api: string
  baseURL: string
  modelCount: number
  inManifest: boolean
  ns?: string
  target?: 'pi-ai' | 'deepseek'
  builtin?: boolean
}

interface DiscoveredModel {
  id: string
  name?: string
  note?: string
  contextWindow?: number
  maxTokens?: number
  input?: Array<'text' | 'image'>
  inputModalities?: Array<'text' | 'image'>
  reasoning?: boolean
  /** 思考档位 → wire 值（models.dev / 清单声明，按模型不同）；写回 profile 后 DSH 可设推理等级。 */
  reasoningEfforts?: Record<string, string | null>
  /** 来源：models.dev / 内置清单 / 保守默认（未查到）。 */
  source?: 'models-dev' | 'manifest' | 'default'
}

interface EditableModel {
  id: string
  current: Record<string, any>
  suggested: Record<string, any>
  suggestedSource: '' | 'models-dev' | 'manifest' | 'catalog'
  note?: string
  configured: boolean
  inCatalog?: boolean
}

interface CurrentInfo {
  route: string
  ns: string
  target: 'pi-ai' | 'deepseek'
  hasModelsList: boolean
  reasoningLevels: string[]
  reasoningEffort?: string
  thinking?: string
  writable: boolean
  models: EditableModel[]
}

/** 一条编辑草稿：UI 直接绑定这些字段。 */
interface Draft {
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

const toDraft = (id: string, src: Record<string, any>, target: 'pi-ai' | 'deepseek'): Draft => {
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
const draftToModel = (d: Draft, target: 'pi-ai' | 'deepseek'): Record<string, unknown> => {
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

const sameDraft = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b)

export function ModelCatalogPage(): React.ReactElement {
  const [mode, setMode] = React.useState<'discover' | 'edit'>('discover')
  const [providers, setProviders] = React.useState<ProviderItem[]>([])
  const [sel, setSel] = React.useState('')
  const [models, setModels] = React.useState<DiscoveredModel[]>([])
  const [q, setQ] = React.useState('')
  const [debouncedQ, setDebouncedQ] = React.useState('')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [page, setPage] = React.useState(1)
  const [busy, setBusy] = React.useState(false)
  const [status, setStatus] = React.useState<{ ok: boolean; text: string } | null>(null)
  const [meta, setMeta] = React.useState<{ sourceCounts: Record<string, number>; modelsDevLoaded?: boolean; modelsDevProviders?: number; providerInModelsDev?: boolean; modelsDevError?: string } | null>(null)
  // ── 编辑模式状态 ──
  const [cur, setCur] = React.useState<CurrentInfo | null>(null)
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({})
  const [savingId, setSavingId] = React.useState('')
  const [newId, setNewId] = React.useState('')

  const loadProviders = async () => {
    try {
      const r = await fetch(`${API_PREFIX}/providers`, { headers: { accept: 'application/json' } })
      const j = await r.json()
      if (j?.ok && Array.isArray(j.providers)) {
        setProviders(j.providers)
        if (j.providers.length > 0) setSel((s) => s || j.providers[0].route)
      }
    } catch (e: any) {
      setStatus({ ok: false, text: `加载提供方失败: ${String(e?.message ?? e)}` })
    }
  }

  React.useEffect(() => { void loadProviders() }, [])

  const selProvider = providers.find((p) => p.route === sel)

  // 搜索防抖
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 300)
    return () => clearTimeout(t)
  }, [q])

  const filtered = React.useMemo(() => {
    if (!debouncedQ) return models
    return models.filter((m) =>
      m.id.toLowerCase().includes(debouncedQ) || (m.name ?? '').toLowerCase().includes(debouncedQ) || (m.input ?? []).some((x) => x.toLowerCase().includes(debouncedQ)))
  }, [models, debouncedQ])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageModels = React.useMemo(() => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filtered, safePage])
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  React.useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const resetView = () => { setStatus(null); setMeta(null); setModels([]); setPage(1); setQ(''); setDebouncedQ(''); setSelected(new Set()); setCur(null); setDrafts({}); setNewId('') }

  const discover = async () => {
    if (!sel) return
    setBusy(true); resetView()
    try {
      const r = await fetch(`${API_PREFIX}/discover`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ route: sel, baseURL: selProvider?.baseURL || '' }),
      })
      const j = await r.json()
      if (j?.ok) {
        const list: DiscoveredModel[] = j.models || []
        const auto = list.length <= AUTO_SELECT_LIMIT ? new Set(list.map((m) => m.id)) : new Set<string>()
        setModels(list)
        setSelected(auto)
        // models.dev 诊断：让「是否已加载/是否收录」可见，避免静默降级
        setMeta({ sourceCounts: j.sourceCounts || {}, modelsDevLoaded: j.modelsDevLoaded, modelsDevProviders: j.modelsDevProviders, providerInModelsDev: j.providerInModelsDev, modelsDevError: j.modelsDevError })
        setStatus({ ok: true, text: `获取到 ${list.length} 个模型${auto.size > 0 ? '（已自动全选，可应用）' : '（数量较大，请用搜索或手动勾选）'}${j.fromManifestOnly ? `；models.dev 兜底：${j.warn}` : ''}` })
      } else {
        setStatus({ ok: false, text: j?.error || '获取失败' })
        setMeta(null)
      }
    } catch (e: any) {
      setStatus({ ok: false, text: `获取失败: ${String(e?.message ?? e)}` })
      setMeta(null)
    } finally { setBusy(false) }
  }

  const loadCurrent = async () => {
    if (!sel) return
    setBusy(true); setStatus(null); setModels([]); setSelected(new Set()); setPage(1); setQ(''); setDebouncedQ('')
    try {
      const r = await fetch(`${API_PREFIX}/current`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ route: sel }),
      })
      const j = await r.json()
      if (j?.ok) {
        const info = j as CurrentInfo
        setCur(info)
        const next: Record<string, Draft> = {}
        for (const m of info.models) next[m.id] = toDraft(m.id, m.current, info.target)
        setDrafts(next)
        setStatus({ ok: true, text: `共 ${info.models.length} 个模型（${info.target === 'deepseek' ? 'DeepSeek 官方 API' : 'pi-ai'} · 写入 ${info.ns}）` })
      } else {
        setStatus({ ok: false, text: j?.error || '读取现有模型失败' })
        setCur(null)
      }
    } catch (e: any) {
      setStatus({ ok: false, text: `读取现有模型失败: ${String(e?.message ?? e)}` })
      setCur(null)
    } finally { setBusy(false) }
  }

  const reload = () => { if (mode === 'edit') void loadCurrent(); else void discover() }

  const apply = async () => {
    if (!sel) return
    const picked = models.filter((m) => selected.has(m.id))
    if (picked.length === 0) { setStatus({ ok: false, text: '未选择任何模型' }); return }
    setBusy(true); setStatus(null)
    try {
      const r = await fetch(`${API_PREFIX}/apply`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ route: sel, models: picked }),
      })
      const j = await r.json()
      setStatus(j?.ok ? { ok: true, text: `已写入 ${j.count} 个模型到 ${j.route}（${j.ns}）` } : { ok: false, text: j?.error || '应用失败' })
      if (j?.ok) void loadProviders()
    } catch (e: any) {
      setStatus({ ok: false, text: `应用失败: ${String(e?.message ?? e)}` })
    } finally { setBusy(false) }
  }

  const patchDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  const adopt = (m: EditableModel) => {
    const s = m.suggested || {}
    const merged: Record<string, any> = {
      ...m.current,
      ...(s.name ? { name: s.name } : {}),
      ...(s.contextWindow ? { contextWindow: s.contextWindow } : {}),
      ...(s.maxTokens ? { maxTokens: s.maxTokens } : {}),
      ...(Array.isArray(s.input) ? { input: s.input } : {}),
      ...(s.reasoningEfforts ? { reasoningEfforts: s.reasoningEfforts } : {}),
    }
    patchDraft(m.id, toDraft(m.id, merged, cur?.target ?? 'pi-ai'))
  }

  const saveModel = async (m: EditableModel) => {
    const d = drafts[m.id]
    if (!d) return
    setSavingId(m.id); setStatus(null)
    try {
      const r = await fetch(`${API_PREFIX}/save-model`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ route: sel, model: draftToModel(d, cur?.target ?? 'pi-ai') }),
      })
      const j = await r.json()
      setStatus(j?.ok ? { ok: true, text: `已保存 ${j.id}（写入 ${j.ns}${j.key ? '.' + j.key : ''}）` } : { ok: false, text: j?.error || '保存失败' })
      if (j?.ok) { void loadProviders(); void loadCurrent() }
    } catch (e: any) {
      setStatus({ ok: false, text: `保存失败: ${String(e?.message ?? e)}` })
    } finally { setSavingId('') }
  }

  const removeModel = async (m: EditableModel) => {
    setSavingId(m.id); setStatus(null)
    try {
      const r = await fetch(`${API_PREFIX}/remove-model`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ route: sel, id: m.id }),
      })
      const j = await r.json()
      setStatus(j?.ok ? { ok: j.removed, text: j.removed ? `已从 ${j.from} 删除 ${m.id}` : `${m.id} 不在配置里（可能来自适配器默认目录）` } : { ok: false, text: j?.error || '删除失败' })
      if (j?.ok && j.removed) { void loadProviders(); void loadCurrent() }
    } catch (e: any) {
      setStatus({ ok: false, text: `删除失败: ${String(e?.message ?? e)}` })
    } finally { setSavingId('') }
  }

  const saveRouteSettings = async (patch: { reasoningEffort?: string; thinking?: string }) => {
    setBusy(true); setStatus(null)
    try {
      const r = await fetch(`${API_PREFIX}/route-settings`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ route: sel, ...patch }),
      })
      const j = await r.json()
      setStatus(j?.ok ? { ok: true, text: '已保存路由级设置' } : { ok: false, text: j?.error || '保存失败' })
      if (j?.ok) void loadCurrent()
    } catch (e: any) {
      setStatus({ ok: false, text: `保存失败: ${String(e?.message ?? e)}` })
    } finally { setBusy(false) }
  }

  const addManual = () => {
    const id = newId.trim()
    if (!id) return
    if (drafts[id]) { setStatus({ ok: false, text: `${id} 已在列表中` }); return }
    setDrafts((prev) => ({ ...prev, [id]: toDraft(id, {}, cur?.target ?? 'pi-ai') }))
    setNewId('')
    setStatus({ ok: true, text: `已加入 ${id}，填好参数后点「保存」` })
  }

  const filteredEdit = React.useMemo(() => {
    const list = cur?.models ?? []
    const extra = Object.keys(drafts).filter((id) => !list.some((m) => m.id === id)).map((id) => ({ id, current: {}, suggested: {}, suggestedSource: '' as const, configured: false }))
    const all = [...list, ...extra]
    if (!debouncedQ) return all
    return all.filter((m) => m.id.toLowerCase().includes(debouncedQ) || (drafts[m.id]?.name ?? '').toLowerCase().includes(debouncedQ))
  }, [cur, drafts, debouncedQ])

  const editTotalPages = Math.max(1, Math.ceil(filteredEdit.length / PAGE_SIZE))
  const editSafePage = Math.min(page, editTotalPages)
  const editPageModels = React.useMemo(() => filteredEdit.slice((editSafePage - 1) * PAGE_SIZE, editSafePage * PAGE_SIZE), [filteredEdit, editSafePage])
  React.useEffect(() => { if (page > editTotalPages) setPage(editTotalPages) }, [page, editTotalPages])

  /** 单个编辑卡片。 */
  const renderEditCard = (m: EditableModel) => {
    const d = drafts[m.id]
    if (!d) return null
    const target = cur?.target ?? 'pi-ai'
    const dirty = !sameDraft(d, toDraft(m.id, m.current, target))
    const toggleModality = (x: 'text' | 'image') => {
      const has = d.input.includes(x)
      patchDraft(m.id, { input: has ? d.input.filter((y) => y !== x) : [...d.input, x] })
    }
    const setEffort = (level: string, wire: string | undefined) => {
      const next = { ...d.efforts }
      if (wire === undefined) delete next[level]
      else next[level] = wire
      patchDraft(m.id, { efforts: next })
    }
    return (
      <div className={`mc-entry ${dirty ? 'mc-entry-on' : ''}`} key={m.id}>
        <div className="mc-entryTop">
          <span className="mc-lineTag">模型号</span>
          <span className="mc-id">{m.id}</span>
          {!m.configured && <span className="mc-src mc-src-default" title="适配器默认目录里的模型，尚未写进配置">目录</span>}
          {m.inCatalog && <span className="mc-src mc-src-manifest" title="pi-ai 已安装目录条目，保存时写入 modelOverrides">override</span>}
          {m.suggestedSource && <span className={`mc-src mc-src-${m.suggestedSource}`} title="建议值来源">{SOURCE_LABEL[m.suggestedSource]}</span>}
          {m.note && <span className="mc-note" title={m.note}>内测</span>}
          {dirty && <span className="mc-dirty">未保存</span>}
        </div>

        <div className="mc-fields">
          <label className="mc-fieldInline">
            <span className="mc-fieldLabel">展示名</span>
            <input className="mc-input mc-inputGrow" value={d.name} placeholder={m.id} onChange={(e) => patchDraft(m.id, { name: e.target.value })} />
          </label>
          <label className="mc-fieldInline">
            <span className="mc-fieldLabel">上下文</span>
            <input className="mc-input mc-inputNum" inputMode="numeric" value={d.contextWindow} placeholder="1000000" onChange={(e) => patchDraft(m.id, { contextWindow: e.target.value.replace(/[^\d]/g, '') })} />
          </label>
          <label className="mc-fieldInline">
            <span className="mc-fieldLabel">输出上限</span>
            <input className="mc-input mc-inputNum" inputMode="numeric" value={d.maxTokens} placeholder={target === 'deepseek' ? '256000' : '32768'} onChange={(e) => patchDraft(m.id, { maxTokens: e.target.value.replace(/[^\d]/g, '') })} />
          </label>
        </div>

        <div className="mc-fields">
          <span className="mc-fieldInline mc-fieldStatic">
            <span className="mc-fieldLabel">输入模态</span>
            <span className="mc-segGroup">
              {(['text', 'image'] as const).map((x) => (
                <button key={x} type="button" className={`mc-seg ${d.input.includes(x) ? 'mc-segOn' : ''}`} onClick={() => toggleModality(x)} title={x === 'image' ? '勾上后该模型才接受图片输入（未声明 = 纯文本）' : '文本输入'}>
                  {MODALITY[x]}
                </button>
              ))}
            </span>
          </span>
          {m.suggestedSource && (m.suggested.contextWindow || m.suggested.maxTokens || (m.suggested.input && m.suggested.input.length > 0)) && (
            <button type="button" className="mc-btn mc-btnSecondary mc-btnDense" onClick={() => adopt(m)} title="用 models.dev / 清单的建议值回填">采纳建议 {m.suggested.input && m.suggested.input.includes('image') ? '（含图像）' : ''}</button>
          )}
        </div>

        {target === 'pi-ai' && (
          <div className="mc-fields">
            <span className="mc-fieldInline mc-fieldStatic">
              <span className="mc-fieldLabel">思考档位</span>
              <span className="mc-efforts">
                {EFFORT_ORDER.map((lv) => {
                  const on = d.efforts[lv] !== undefined
                  return (
                    <span key={lv} className="mc-effortItem">
                      <button type="button" className={`mc-seg ${on ? 'mc-segOn' : ''}`} onClick={() => setEffort(lv, on ? undefined : lv)} title={lv === 'off' ? '关闭推理（参数缺席）' : `声明 ${lv} 档位`}>{lv}</button>
                      {on && lv !== 'off' && (
                        <input className="mc-input mc-inputWire" value={d.efforts[lv] ?? ''} placeholder="wire" onChange={(e) => setEffort(lv, e.target.value)} title="发给提供方的 wire 值（如 high / max / reasoning_effort 的取值）" />
                      )}
                      {on && lv === 'off' && <span className="mc-wireHint">空=不传</span>}
                    </span>
                  )
                })}
              </span>
            </span>
          </div>
        )}

        {target === 'deepseek' && (
          <div className="mc-entryMeta">
            <span className="mc-metaItem mc-hintText">思考档位由「DeepSeek 官方 API」的路由级设置统一控制（off / low / high / max），不随模型单独设置。</span>
          </div>
        )}

        {target === 'pi-ai' && (
          <details className="mc-adv">
            <summary className="mc-advSum">高级：compat（wire 兼容开关，JSON）</summary>
            <textarea className="mc-input mc-textarea" rows={2} value={d.compatText} placeholder='{"thinkingFormat":"deepseek","maxTokensField":"max_tokens"}' onChange={(e) => patchDraft(m.id, { compatText: e.target.value })} />
          </details>
        )}

        <div className="mc-entryActions">
          <button className="mc-btn mc-btnPrimary mc-btnDense" disabled={busy || savingId === m.id || !dirty} onClick={() => void saveModel(m)}>
            {savingId === m.id ? '保存中…' : '保存'}
          </button>
          <button className="mc-btn mc-btnSecondary mc-btnDense" disabled={busy || savingId === m.id || !dirty} onClick={() => patchDraft(m.id, toDraft(m.id, m.current, target))}>还原</button>
          <div className="mc-grow" />
          <button className="mc-btn mc-btnDanger mc-btnDense" disabled={busy || savingId === m.id || !m.configured} onClick={() => void removeModel(m)} title={m.configured ? '从配置里删除该模型' : '该模型来自适配器默认目录，不在配置里'}>删除</button>
        </div>
      </div>
    )
  }

  return (
    <div className="mc-root">
      <header className="mc-head">
        <span className="mc-headDot" aria-hidden="true" />
        <h3 className="mc-title">模型检测</h3>
      </header>

      {/* 控制面板 */}
      <section className="mc-panel">
        <div className="mc-row">
          <label className="mc-field">
            <span className="mc-fieldLabel">提供方</span>
            <select className="mc-select" value={sel} onChange={(e) => { setSel(e.target.value); setModels([]); setSelected(new Set()); setPage(1); setCur(null); setDrafts({}); setStatus(null) }}>
              {providers.map((p) => <option key={p.route} value={p.route}>{p.displayName} ({p.route})</option>)}
            </select>
          </label>
          <div className="mc-grow" />
          <div className="mc-actions">
            <button className="mc-btn mc-btnPrimary" disabled={busy || !sel} onClick={() => (mode === 'edit' ? void loadCurrent() : void discover())}>
              <span className={`mc-btnIcon ${busy ? 'mc-spin' : ''}`}>↻</span>{mode === 'edit' ? '读取现有模型' : '获取最新模型'}
            </button>
            {mode === 'discover' && (
              <button className="mc-btn mc-btnAccent" disabled={busy || selected.size === 0} onClick={apply}>
                应用所选<span className="mc-btnBadge">{selected.size}</span>
              </button>
            )}
          </div>
        </div>
        <div className="mc-row">
          <span className="mc-segGroup">
            <button type="button" className={`mc-seg ${mode === 'discover' ? 'mc-segOn' : ''}`} onClick={() => { setMode('discover'); resetView() }}>发现新模型</button>
            <button type="button" className={`mc-seg ${mode === 'edit' ? 'mc-segOn' : ''}`} onClick={() => { setMode('edit'); resetView() }}>编辑现有模型</button>
          </span>
          {selProvider && (
            <div className="mc-metaRow">
              <span className="mc-metaChip"><i>baseURL</i>{selProvider.baseURL || '-'}</span>
              <span className="mc-metaChip"><i>协议</i>{selProvider.api || '-'}</span>
              <span className="mc-metaChip"><i>现有模型</i>{selProvider.modelCount}</span>
              <span className="mc-metaChip"><i>写入</i>{selProvider.ns || 'llm-pi-ai'}</span>
            </div>
          )}
        </div>
      </section>

      {/* 状态 / 诊断 */}
      {busy && ((mode === 'discover' && models.length === 0) || (mode === 'edit' && cur === null)) && (
        <div className="mc-alert mc-alert-info"><span className="mc-alertIcon">⏳</span>{mode === 'edit' ? '正在读取现有模型…' : '正在获取模型列表…'}</div>
      )}
      {status && !(busy && ((mode === 'discover' && models.length === 0) || (mode === 'edit' && cur === null))) && (
        <div className={`mc-alert ${status.ok ? 'mc-alert-ok' : 'mc-alert-err'}`}>
          <span className="mc-alertIcon">{status.ok ? '✓' : '✕'}</span>
          <span>{status.text}</span>
        </div>
      )}
      {mode === 'discover' && meta && meta.modelsDevLoaded === false && (
        <div className="mc-alert mc-alert-warn"><span className="mc-alertIcon">⚠</span>models.dev 加载失败{meta.modelsDevError ? `（${meta.modelsDevError}）` : ''}，能力仅靠清单/默认</div>
      )}

      {/* ── 发现模式 ── */}
      {mode === 'discover' && (
        <>
          {meta && (
            <div className="mc-counts">
              {(['models-dev', 'manifest', 'default'] as const).map((k) => {
                const n = meta.sourceCounts[k]
                if (!n) return null
                return <span key={k} className={`mc-count mc-count-${k}`}>{SOURCE_LABEL[k]} <b>{n}</b></span>
              })}
              {meta.modelsDevLoaded === true && meta.providerInModelsDev === false && (
                <span className="mc-countNote" title={`models.dev 未收录该提供方（共 ${meta.modelsDevProviders ?? 0} 家），能力按全局 models.dev 回退`}>⚠</span>
              )}
            </div>
          )}

          {models.length > 0 && (
            <>
              <div className="mc-toolbar">
                <div className="mc-search">
                  <span className="mc-searchIcon">⌕</span>
                  <input className="mc-input" value={q} placeholder="搜索已发现模型（id / 模态）" onChange={(e) => setQ(e.target.value)} />
                </div>
                <button className="mc-btn mc-btnSecondary mc-btnDense" onClick={() => setSelected(new Set(filtered.map((m) => m.id)))}>全选当前（{filtered.length}）</button>
                <button className="mc-btn mc-btnSecondary mc-btnDense" onClick={() => setSelected(new Set())}>清空</button>
                <div className="mc-pager">
                  <button className="mc-btn mc-btnSecondary mc-btnDense" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>上一页</button>
                  <span className="mc-pageNow">{safePage} / {totalPages} 页</span>
                  <button className="mc-btn mc-btnSecondary mc-btnDense" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</button>
                  <span className="mc-pageRange">共 {filtered.length} 个 · 本页 {pageStart}-{pageEnd}</span>
                </div>
              </div>

              <div className="mc-list">
                {pageModels.map((m) => {
                  const input = m.input ?? m.inputModalities ?? []
                  return (
                    <div className={`mc-entry ${selected.has(m.id) ? 'mc-entry-on' : ''}`} key={m.id}>
                      <label className="mc-entryTop" title="提供方使用的模型 id，写回配置时使用">
                        <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                        <span className="mc-lineTag">提供方</span>
                        <span className="mc-id">{m.id}</span>
                        {m.source && <span className={`mc-src mc-src-${m.source}`}>{SOURCE_LABEL[m.source]}</span>}
                        {m.note && <span className="mc-note" title={m.note}>内测</span>}
                      </label>
                      {m.name && m.name !== m.id && (
                        <div className="mc-entryName" title="models.dev / 清单收录的展示名">
                          <span className="mc-lineTag">收录名</span>
                          <span className="mc-name">{m.name}</span>
                        </div>
                      )}
                      <div className="mc-entryMeta">
                        {input.map((x) => <span key={x} className="mc-chip">{MODALITY[x]}</span>)}
                        {formatEfforts(m.reasoningEfforts) && <span className="mc-chip mc-chip-effort">推理 {formatEfforts(m.reasoningEfforts)}</span>}
                        <span className="mc-metaItem">上下文 <b>{fmt(m.contextWindow)}</b></span>
                        <span className="mc-metaItem">输出 <b>{fmt(m.maxTokens)}</b></span>
                        {m.source === 'default' && (
                          <span className="mc-metaItem mc-hintText">未查到元数据（默认纯文本）——应用后可在「编辑现有模型」里手动勾上图像</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {models.length === 0 && !busy && providers.length > 0 && (
            <div className="mc-empty">选择提供方后点击「获取最新模型」</div>
          )}
        </>
      )}

      {/* ── 编辑模式 ── */}
      {mode === 'edit' && (
        <>
          {cur && cur.target === 'deepseek' && (
            <div className="mc-panel mc-panelSub">
              <div className="mc-row">
                <label className="mc-field">
                  <span className="mc-fieldLabel">推理档位</span>
                  <select className="mc-select mc-selectNarrow" value={cur.reasoningEffort ?? 'high'} disabled={busy || !cur.writable} onChange={(e) => void saveRouteSettings({ reasoningEffort: e.target.value })}>
                    {(cur.reasoningLevels.length > 0 ? cur.reasoningLevels : ['off', 'low', 'high', 'max']).map((lv) => <option key={lv} value={lv}>{lv}</option>)}
                  </select>
                </label>
                <label className="mc-field">
                  <span className="mc-fieldLabel">thinking</span>
                  <select className="mc-select mc-selectNarrow" value={cur.thinking ?? 'enabled'} disabled={busy || !cur.writable} onChange={(e) => void saveRouteSettings({ thinking: e.target.value })}>
                    <option value="enabled">enabled</option>
                    <option value="disabled">disabled</option>
                  </select>
                </label>
                <div className="mc-grow" />
                <span className="mc-hintText">推理档位是路由级（所有模型共用）；保存任一模型后，该列表会取代适配器默认目录，请把要用的模型都加进来</span>
              </div>
            </div>
          )}

          {cur && (
            <>
              <div className="mc-toolbar">
                <div className="mc-search">
                  <span className="mc-searchIcon">⌕</span>
                  <input className="mc-input" value={q} placeholder="搜索模型号 / 展示名" onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="mc-addBox">
                  <input className="mc-input" value={newId} placeholder="手填模型号，如 deepseek-v4.1-flash-expires-on-0910" onChange={(e) => setNewId(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addManual() }} />
                  <button className="mc-btn mc-btnSecondary mc-btnDense" disabled={!newId.trim()} onClick={addManual}>添加模型</button>
                </div>
                <div className="mc-pager">
                  <button className="mc-btn mc-btnSecondary mc-btnDense" disabled={editSafePage <= 1} onClick={() => setPage((p) => p - 1)}>上一页</button>
                  <span className="mc-pageNow">{editSafePage} / {editTotalPages} 页</span>
                  <button className="mc-btn mc-btnSecondary mc-btnDense" disabled={editSafePage >= editTotalPages} onClick={() => setPage((p) => p + 1)}>下一页</button>
                  <span className="mc-pageRange">共 {filteredEdit.length} 个</span>
                </div>
              </div>

              <div className="mc-list">{editPageModels.map((m) => renderEditCard(m))}</div>
              {filteredEdit.length === 0 && <div className="mc-empty">该提供方还没有模型：在上面手填一个模型号后「添加模型」</div>}
            </>
          )}

          {cur === null && !busy && providers.length > 0 && (
            <div className="mc-empty">选择提供方后点击「读取现有模型」，逐条改参数（模态 / 容量 / 思考档位）</div>
          )}
        </>
      )}

      {providers.length === 0 && !busy && (
        <div className="mc-empty">当前未配置任何 pi-ai 提供方</div>
      )}
    </div>
  )
}
