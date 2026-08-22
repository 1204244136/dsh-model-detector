/**
 * dsh-model-detector — 提供方中心设置页（DSH 设计语言版）。
 * 流程：选提供方 → 「获取最新模型」（该提供方 /models + models.dev 合并）→
 *       分页预览（模态/容量/推理）→ 勾选 →「应用」写入该提供方。
 * 样式：复用 DSH 的 `--dsw-alias-*` token + capsule 按钮 + 发丝线卡片（styles.ts）。
 */
import React from './react'

const API_PREFIX = '/dsh-model-detector/api'
const PAGE_SIZE = 80
const AUTO_SELECT_LIMIT = 200

const MODALITY: Record<'text' | 'image', string> = { text: '文本', image: '图像' }

interface ProviderItem {
  route: string
  displayName: string
  api: string
  baseURL: string
  modelCount: number
  inManifest: boolean
}

interface DiscoveredModel {
  id: string
  name?: string
  contextWindow?: number
  maxTokens?: number
  input?: Array<'text' | 'image'>
  reasoning?: boolean
}

export function ModelCatalogPage(): React.ReactElement {
  const [providers, setProviders] = React.useState<ProviderItem[]>([])
  const [sel, setSel] = React.useState('')
  const [models, setModels] = React.useState<DiscoveredModel[]>([])
  const [q, setQ] = React.useState('')
  const [debouncedQ, setDebouncedQ] = React.useState('')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [page, setPage] = React.useState(1)
  const [busy, setBusy] = React.useState(false)
  const [status, setStatus] = React.useState<{ ok: boolean; text: string } | null>(null)

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

  const discover = async () => {
    if (!sel) return
    setBusy(true); setStatus(null); setModels([]); setPage(1); setQ(''); setDebouncedQ('')
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
        setStatus({ ok: true, text: `获取到 ${list.length} 个模型${auto.size > 0 ? '（已自动全选，可应用）' : '（数量较大，请用搜索或手动勾选）'}${j.fromManifestOnly ? `；models.dev 兜底：${j.warn}` : ''}` })
      } else setStatus({ ok: false, text: j?.error || '获取失败' })
    } catch (e: any) {
      setStatus({ ok: false, text: `获取失败: ${String(e?.message ?? e)}` })
    } finally { setBusy(false) }
  }

  const apply = async () => {
    if (!sel) return
    const picked = models.filter((m) => selected.has(m.id))
    if (picked.length === 0) { setStatus({ ok: false, text: '未选择任何模型' }); return }
    setBusy(true); setStatus(null)
    try {
      const r = await fetch(`${API_PREFIX}/apply`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ route: sel, models: picked.map((m) => ({ id: m.id, name: m.name, contextWindow: m.contextWindow, maxTokens: m.maxTokens, input: m.input, ...(m.reasoning !== undefined ? { reasoning: m.reasoning } : {}) })) }),
      })
      const j = await r.json()
      setStatus(j?.ok ? { ok: true, text: `已写入 ${j.count} 个模型到 ${j.route}` } : { ok: false, text: j?.error || '应用失败' })
      if (j?.ok) void loadProviders()
    } catch (e: any) {
      setStatus({ ok: false, text: `应用失败: ${String(e?.message ?? e)}` })
    } finally { setBusy(false) }
  }

  return (
    <div className="mc-root">
      <div>
        <h3 className="mc-title">模型检测</h3>
        <p className="mc-intro">选一个提供方 → 获取其最新模型（该提供方 /models + models.dev 自动合并模态/容量/推理）→ 勾选应用。列表分页渲染，海量模型不卡顿。</p>
      </div>

      <div className="mc-row">
        <label className="mc-field">
          提供方
          <select className="mc-select" value={sel} onChange={(e) => { setSel(e.target.value); setModels([]); setSelected(new Set()); setPage(1) }}>
            {providers.map((p) => <option key={p.route} value={p.route}>{p.displayName} ({p.route})</option>)}
          </select>
        </label>
        <button className="mc-btn mc-btnPrimary" disabled={busy || !sel} onClick={discover}>
          {busy ? '处理中…' : '获取最新模型'}
        </button>
        <button className="mc-btn mc-btnPrimary" disabled={busy || selected.size === 0} onClick={apply}>
          应用所选（{selected.size}）
        </button>
      </div>

      {selProvider && (
        <p className="mc-meta">baseURL: {selProvider.baseURL || '-'} ｜ 协议: {selProvider.api || '-'} ｜ 现有模型: {selProvider.modelCount}</p>
      )}

      {status && <p className={status.ok ? 'mc-ok' : 'mc-err'}>{status.text}</p>}

      {models.length > 0 && (
        <>
          <div className="mc-row">
            <input className="mc-input" value={q} placeholder="搜索已发现模型（id / 模态，如 vision、image）" onChange={(e) => setQ(e.target.value)} />
            <button className="mc-btn mc-btnSecondary mc-btnDense" onClick={() => setSelected(new Set(filtered.map((m) => m.id)))}>全选当前（{filtered.length}）</button>
            <button className="mc-btn mc-btnSecondary mc-btnDense" onClick={() => setSelected(new Set())}>清空</button>
            <div className="mc-pager">
              <button className="mc-btn mc-btnSecondary mc-btnDense" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>上一页</button>
              <span>{safePage}/{totalPages}</span>
              <button className="mc-btn mc-btnSecondary mc-btnDense" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</button>
              <span>第 {pageStart}-{pageEnd} / 共 {filtered.length} 个</span>
            </div>
          </div>
          <div className="mc-list">
            {pageModels.map((m) => (
              <div className="mc-entry" key={m.id}>
                <div className="mc-entryRow">
                  <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                  <div style={{ minWidth: 0 }}>
                    <div className="mc-id">{m.id}</div>
                    {m.name && m.name !== m.id ? <div className="mc-name">{m.name}</div> : null}
                  </div>
                  <div>{(m.input || []).map((x) => <span key={x} className="mc-chip">{MODALITY[x]}</span>)}</div>
                  <span className="mc-cap">{m.contextWindow ? m.contextWindow.toLocaleString() : '-'}</span>
                  <span className="mc-cap">{m.maxTokens ? m.maxTokens.toLocaleString() : '-'}</span>
                  <span className="mc-cap">{m.reasoning ? '推理' : '-'}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {providers.length === 0 && !busy && (
        <p className="mc-intro">当前未配置任何 pi-ai 提供方。</p>
      )}
    </div>
  )
}
