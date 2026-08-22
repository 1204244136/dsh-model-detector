/**
 * dsh-model-detector — 设置页样式（DSH 设计语言）。
 * 全部颜色走 `--dsw-alias-*` token（随主题明暗自动变化），
 * 复刻官方设置页的 capsule 按钮 / 发丝线卡片 / 14·22 正文 / 12·18 caption。
 */

export const CSS = `
.mc-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 720px;
  color: var(--dsw-alias-label-primary, #1f2328);
  font-family: system-ui, -apple-system, sans-serif;
}
.mc-title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; color: var(--dsw-alias-label-primary, #1f2328); }
.mc-intro { margin: 0; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-tertiary, #57606a); }
.mc-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mc-field { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-secondary, #57606a); }
.mc-meta { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary, #57606a); }
.mc-ok { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-success-primary, #1a7f37); }
.mc-err { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary, #cf222e); }
.mc-warn { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-warn-label, #9a6700); }

/* capsule 按钮：primary h36 r18；dense h28 r14 */
.mc-btn {
  box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  height: 36px; padding: 0 14px; border: none; border-radius: 18px;
  font: inherit; font-size: 14px; line-height: 22px; cursor: pointer; color: inherit;
}
.mc-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.mc-btnPrimary { background: var(--dsw-alias-button-primary-fill, #0969da); color: var(--dsw-alias-label-primary-foreground, #fff); }
.mc-btnPrimary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover, #0757ba); }
.mc-btnSecondary { border: 1px solid var(--dsw-alias-border-l2, #d0d7de); background: transparent; color: var(--dsw-alias-label-primary, #1f2328); }
.mc-btnSecondary:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06)); }
.mc-btnDense { height: 28px; padding: 0 10px; border-radius: 14px; font-size: 12px; line-height: 18px; }

/* 表单控件 */
.mc-input, .mc-select {
  box-sizing: border-box; height: 32px; padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, #ffffff); color: var(--dsw-alias-text-primary, #1f2328);
  font: inherit; font-size: 13px; line-height: 20px;
}
.mc-input:focus, .mc-select:focus { outline: none; border-color: var(--dsw-alias-brand-primary, #0969da); }

/* 模型列表：发丝线卡片，复用 DSH modelList/modelEntry 样式 */
.mc-list { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.mc-entry { border: 1px solid var(--dsw-alias-border-l2, #d0d7de); border-radius: 8px; padding: 6px 10px; }
.mc-entryRow { display: grid; grid-template-columns: auto minmax(0, 1.4fr) minmax(0, 1fr) auto auto auto; align-items: center; gap: 10px; }
.mc-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 18px; color: var(--dsw-alias-text-primary, #1f2328); }
.mc-name { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary, #57606a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mc-cap { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary, #57606a); white-space: nowrap; }
.mc-chip { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 12px; line-height: 18px; margin-right: 4px; background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06)); color: var(--dsw-alias-label-secondary, #57606a); }

/* 分页区 */
.mc-pager { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary, #57606a); }
`
