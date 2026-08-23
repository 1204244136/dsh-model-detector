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

/** 元数据来源标注：UI 据此区分「查得」与「兜底」，避免把默认当查得。 */
const SOURCE_LABEL: Record<string, string> = {
  'models-dev': 'models.dev',
  'manifest': '清单',
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
}

interface DiscoveredModel {
  id: string
  name?: string
  contextWindow?: number
  maxTokens?: number
  input?: Array<'text' | 'image'>
  reasoning?: boolean
  /** 来源：models.dev / 内置清单 / 保守默认（未查到）。 */
  source?: 'models-dev' | 'manifest' | 'default'
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
  const [meta, setMeta] = React.useState<{ sourceCounts: Record<string, number>; modelsDevLoaded?: boolean; modelsDevProviders?: number; providerInModelsDev?: boolean; modelsDevError?: string } | null>(null)

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
    setBusy(true); setStatus(null); setMeta(null); setModels([]); setPage(1); setQ(''); setDebouncedQ('')
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
      <header className="mc-head">
        <span className="mc-headDot" aria-hidden="true" />
        <h3 className="mc-title">模型检测</h3>
      </header>

      {/* 控制面板 */}
      <section className="mc-panel">
        <div className="mc-row">
          <label className="mc-field">
            <span className="mc-fieldLabel">提供方</span>
            <select className="mc-select" value={sel} onChange={(e) => { setSel(e.target.value); setModels([]); setSelected(new Set()); setPage(1) }}>
              {providers.map((p) => <option key={p.route} value={p.route}>{p.displayName} ({p.route})</option>)}
            </select>
          </label>
          <div className="mc-grow" />
          <div className="mc-actions">
            <button className="mc-btn mc-btnPrimary" disabled={busy || !sel} onClick={discover}>
              <span className={`mc-btnIcon ${busy ? 'mc-spin' : ''}`}>↻</span>获取最新模型
            </button>
            <button className="mc-btn mc-btnAccent" disabled={busy || selected.size === 0} onClick={apply}>
              应用所选<span className="mc-btnBadge">{selected.size}</span>
            </button>
          </div>
        </div>
        {selProvider && (
          <div className="mc-metaRow">
            <span className="mc-metaChip"><i>baseURL</i>{selProvider.baseURL || '-'}</span>
            <span className="mc-metaChip"><i>协议</i>{selProvider.api || '-'}</span>
            <span className="mc-metaChip"><i>现有模型</i>{selProvider.modelCount}</span>
          </div>
        )}
      </section>

      {/* 状态 / 诊断 */}
      {busy && models.length === 0 && (
        <div className="mc-alert mc-alert-info"><span className="mc-alertIcon">⏳</span>正在获取模型列表…</div>
      )}
      {status && !(busy && models.length === 0) && (
        <div className={`mc-alert ${status.ok ? 'mc-alert-ok' : 'mc-alert-err'}`}>
          <span className="mc-alertIcon">{status.ok ? '✓' : '✕'}</span>
          <span>{status.text}</span>
        </div>
      )}
      {meta && meta.modelsDevLoaded === false && (
        <div className="mc-alert mc-alert-warn"><span className="mc-alertIcon">⚠</span>models.dev 加载失败{meta.modelsDevError ? `（${meta.modelsDevError}）` : ''}，能力仅靠清单/默认</div>
      )}

      {/* 来源统计 + 未收录提示 */}
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
          {/* 工具栏 */}
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

          {/* 模型列表：每模型一张卡片，自描述、不挤压 */}
          <div className="mc-list">
            {pageModels.map((m) => (
              <div className={`mc-entry ${selected.has(m.id) ? 'mc-entry-on' : ''}`} key={m.id}>
                <label className="mc-entryTop" title="提供方使用的模型 id，写回配置时使用">
                  <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                  <span className="mc-lineTag">提供方</span>
                  <span className="mc-id">{m.id}</span>
                  {m.source && <span className={`mc-src mc-src-${m.source}`}>{SOURCE_LABEL[m.source]}</span>}
                </label>
                {m.name && m.name !== m.id && (
                  <div className="mc-entryName" title="models.dev / 清单收录的展示名">
                    <span className="mc-lineTag">收录名</span>
                    <span className="mc-name">{m.name}</span>
                  </div>
                )}
                <div className="mc-entryMeta">
                  {(m.input || []).map((x) => <span key={x} className="mc-chip">{MODALITY[x]}</span>)}
                  <span className="mc-metaItem">上下文 <b>{fmt(m.contextWindow)}</b></span>
                  <span className="mc-metaItem">输出 <b>{fmt(m.maxTokens)}</b></span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {models.length === 0 && !busy && providers.length > 0 && (
        <div className="mc-empty">选择提供方后点击「获取最新模型」</div>
      )}
      {providers.length === 0 && !busy && (
        <div className="mc-empty">当前未配置任何 pi-ai 提供方</div>
      )}
    </div>
  )
}
