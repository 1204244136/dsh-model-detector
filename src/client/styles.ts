/**
 * dsh-model-detector — 设置页样式（DSH 设计语言）。
 * 全部颜色走 `--dsw-alias-*` token（随主题明暗自动变化）：
 * capsule 按钮 / 发丝线卡片 / 14·22 正文 / 12·18 caption + 微妙 tint 高亮。
 */

export const CSS = `
.mc-root {
  display: flex; flex-direction: column; gap: 14px;
  max-width: 760px; padding: 4px 2px 24px;
  color: var(--dsw-alias-label-primary, #1f2328);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}

/* ── header ── */
.mc-head { display: flex; align-items: center; gap: 10px; }
.mc-headDot { width: 8px; height: 8px; border-radius: 50%; background: var(--dsw-alias-brand-primary, #0969da); box-shadow: 0 0 0 4px rgba(9, 105, 218, 0.14); }
.mc-title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 600; color: var(--dsw-alias-label-primary, #1f2328); }

/* ── panel ── */
.mc-panel { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border: 1px solid var(--dsw-alias-border-l2, #d0d7de); border-radius: 12px; background: var(--dsw-alias-bg-layer-1, #ffffff); }
/* 控制行：不换行，select 可收缩，主操作按钮恒与选择器同行 */
.mc-row { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; }
.mc-grow { flex: 1 1 auto; }
/* 两个主操作按钮作为一组，始终在一起，不被 flex-wrap 拆到两行 */
.mc-actions { display: inline-flex; align-items: center; gap: 8px; flex-wrap: nowrap; flex-shrink: 0; }
.mc-field { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary, #57606a); min-width: 0; }
/* 控制面板「提供方」标签：不收缩、不折行，挤压时由 select 让位 */
.mc-fieldLabel { flex-shrink: 0; white-space: nowrap; }
.mc-metaRow { display: flex; flex-wrap: wrap; gap: 6px; }
.mc-metaChip { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 8px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary, #57606a); background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05)); }
.mc-metaChip i { font-style: normal; color: var(--dsw-alias-label-tertiary, #8c959f); }

/* ── buttons ── */
.mc-btn {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 34px; padding: 0 14px; border: none; border-radius: 17px;
  font: inherit; font-size: 13px; line-height: 20px; font-weight: 500; cursor: pointer; color: inherit;
  transition: background .15s ease, border-color .15s ease, opacity .15s ease, box-shadow .15s ease;
}
.mc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.mc-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #0969da); outline-offset: 2px; }
.mc-btnIcon { font-size: 14px; line-height: 1; }
.mc-btnPrimary { background: var(--dsw-alias-button-primary-fill, #0969da); color: var(--dsw-alias-label-primary-foreground, #fff); }
.mc-btnPrimary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover, #0757ba); }
.mc-btnAccent { background: var(--dsw-alias-state-success-primary, #1a7f37); }
.mc-btnAccent:hover:not(:disabled) { background: #167a34; }
.mc-btnBadge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: rgba(255, 255, 255, 0.24); font-size: 11px; line-height: 18px; text-align: center; }
.mc-btnSecondary { border: 1px solid var(--dsw-alias-border-l2, #d0d7de); background: transparent; color: var(--dsw-alias-label-primary, #1f2328); }
.mc-btnSecondary:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); }
.mc-btnDense { height: 30px; padding: 0 12px; border-radius: 15px; font-size: 12px; line-height: 18px; font-weight: 400; }

/* ── form controls ── */
.mc-input, .mc-select {
  box-sizing: border-box; height: 32px; padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de); border-radius: 9px;
  background: var(--dsw-alias-bg-layer-1, #ffffff); color: var(--dsw-alias-text-primary, #1f2328);
  font: inherit; font-size: 13px; line-height: 20px;
}
.mc-select { flex: 1 1 auto; min-width: 120px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mc-input:focus, .mc-select:focus { outline: none; border-color: var(--dsw-alias-brand-primary, #0969da); box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.14); }

/* 加载态：图标旋转而非换文案（保持按钮宽度稳定，避免布局抖动） */
.mc-spin { display: inline-block; animation: mc-spin 0.9s linear infinite; }
@keyframes mc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* ── alerts ── */
.mc-alert { display: flex; align-items: flex-start; gap: 8px; padding: 8px 12px; border-radius: 10px; font-size: 12px; line-height: 18px; border: 1px solid transparent; }
.mc-alertIcon { flex: none; width: 16px; text-align: center; font-size: 13px; line-height: 18px; }
.mc-alert-info { background: rgba(9, 105, 218, 0.08); border-color: rgba(9, 105, 218, 0.24); color: var(--dsw-alias-label-secondary, #57606a); }
.mc-alert-ok { background: rgba(26, 127, 55, 0.10); border-color: rgba(26, 127, 55, 0.28); color: var(--dsw-alias-state-success-primary, #1a7f37); }
.mc-alert-err { background: rgba(207, 34, 46, 0.10); border-color: rgba(207, 34, 46, 0.28); color: var(--dsw-alias-state-error-primary, #cf222e); }
.mc-alert-warn { background: rgba(154, 103, 0, 0.10); border-color: rgba(154, 103, 0, 0.32); color: var(--dsw-alias-state-warn-label, #9a6700); }

/* ── source counts ── */
.mc-counts { display: flex; flex-wrap: wrap; gap: 6px; }
.mc-count { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 12px; font-size: 12px; line-height: 20px; color: var(--dsw-alias-label-secondary, #57606a); }
.mc-count b { font-weight: 600; }
.mc-count-models-dev { background: rgba(9, 105, 218, 0.10); color: var(--dsw-alias-brand-primary, #0969da); }
.mc-count-manifest { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05)); color: var(--dsw-alias-label-secondary, #57606a); }
.mc-count-default { background: rgba(154, 103, 0, 0.12); color: var(--dsw-alias-state-warn-label, #9a6700); }
/* 未收录提示：黄色 ⚠ 图标，悬停说明 */
.mc-countNote { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; font-size: 13px; line-height: 1; color: var(--dsw-alias-state-warn-label, #9a6700); background: rgba(154, 103, 0, 0.12); cursor: help; }

/* ── toolbar ── */
.mc-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mc-search { position: relative; flex: 1 1 220px; min-width: 180px; }
.mc-searchIcon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--dsw-alias-label-tertiary, #8c959f); font-size: 14px; pointer-events: none; }
.mc-search .mc-input { width: 100%; padding-left: 30px; }
.mc-pager { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
.mc-pageNow { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary, #57606a); white-space: nowrap; }
.mc-pageRange { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary, #8c959f); white-space: nowrap; }

/* ── model list（每模型一卡的卡片布局，自描述、不挤压） ── */
.mc-list { display: flex; flex-direction: column; }
.mc-entry { border: 1px solid var(--dsw-alias-border-l2, #d0d7de); border-radius: 11px; background: var(--dsw-alias-bg-layer-1, #ffffff); padding: 10px 12px; transition: border-color .15s ease, background .15s ease, box-shadow .15s ease; }
.mc-entry + .mc-entry { margin-top: 8px; }
.mc-entry:hover { border-color: rgba(9, 105, 218, 0.45); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06); }
.mc-entry-on { border-color: var(--dsw-alias-brand-primary, #0969da); background: rgba(9, 105, 218, 0.05); }
.mc-entryTop { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.mc-entryTop > input[type="checkbox"] { accent-color: var(--dsw-alias-brand-primary, #0969da); width: 14px; height: 14px; flex: none; }
.mc-entryTop .mc-src { margin-top: 0; flex: none; }
.mc-lineTag { font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary, #8c959f); white-space: nowrap; flex: 0 0 auto; min-width: 3em; }
.mc-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 18px; color: var(--dsw-alias-text-primary, #1f2328); overflow-wrap: anywhere; word-break: break-word; flex: 1 1 auto; min-width: 0; }
.mc-entryName { display: flex; align-items: center; gap: 8px; margin-top: 5px; }
.mc-name { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary, #57606a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 auto; min-width: 0; }
.mc-entryMeta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin-top: 8px; }
.mc-metaItem { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary, #57606a); }
.mc-metaItem b { font-weight: 600; color: var(--dsw-alias-text-primary, #1f2328); }
.mc-chip { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 12px; line-height: 18px; background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); color: var(--dsw-alias-label-secondary, #57606a); }
/* 推理档位 chip：区分于普通模态 chip，弱化强调但可辨识 */
.mc-chip-effort { background: var(--dsw-alias-brand-primary, #0969da)22; color: var(--dsw-alias-brand-primary, #0969da); }

/* ── source badge ── */
.mc-src { display: inline-block; margin-top: 3px; padding: 1px 8px; border-radius: 10px; font-size: 11px; line-height: 16px; }
.mc-src-models-dev { background: rgba(9, 105, 218, 0.10); color: var(--dsw-alias-brand-primary, #0969da); }
.mc-src-manifest { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); color: var(--dsw-alias-label-tertiary, #57606a); }
.mc-src-default { background: rgba(154, 103, 0, 0.16); color: var(--dsw-alias-state-warn-label, #9a6700); }

/* ── empty / loading ── */
.mc-empty { padding: 30px 12px; text-align: center; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-tertiary, #8c959f); border: 1px dashed var(--dsw-alias-border-l2, #d0d7de); border-radius: 12px; }
`
