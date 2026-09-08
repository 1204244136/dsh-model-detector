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
/* 控制行：可换行；子项可收缩但不叠字（flex-wrap 是防"两个 select 撞在一起"的关键） */
.mc-row { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; min-width: 0; }
/* 顶行（提供方 + 主操作按钮）：**永不换行**——按钮组固定与选择器同行，
   切换模式导致按钮数量变化时也不会掉到下一行；空间不足由选择器让位（省略号） */
.mc-rowTop { flex-wrap: nowrap; overflow: hidden; }
.mc-grow { flex: 1 1 auto; min-width: 0; }
/* 主操作按钮作为一组：不收缩、不换行 */
.mc-actions { display: inline-flex; align-items: center; gap: 8px; flex-wrap: nowrap; flex: none; }
/* 字段组：标签不收缩、控件可收缩；窄面板下整组换行 */
.mc-field { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary, #57606a); min-width: 0; flex: 0 1 auto; }
/* 顶行里的选择器：优先 176px；有富余就伸展（上限 300px）吸收空隙，
   空间不足则收缩（省略号）——按钮组始终同行且贴右，选择器与按钮之间不留死空 */
.mc-rowTop .mc-select { flex: 0 1 auto; width: 176px; min-width: 88px; max-width: 300px; }
.mc-rowTop .mc-field { flex: 0 1 auto; min-width: 0; }
.mc-rowTop .mc-fieldLabel { flex: none; }
.mc-fieldLabel { flex: none; white-space: nowrap; }
.mc-fieldLabelWide { min-width: 4.5em; }
.mc-metaRow { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.mc-metaChip { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 2px 9px; border-radius: 8px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary, #57606a); background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05)); flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mc-metaChip i { font-style: normal; flex: none; color: var(--dsw-alias-label-tertiary, #8c959f); }
/* 子面板（路由级设置） */
.mc-panelSub { gap: 8px; background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.02)); }
.mc-panelHead { display: flex; align-items: baseline; gap: 8px; }
.mc-panelTitle { font-size: 13px; line-height: 20px; font-weight: 600; color: var(--dsw-alias-label-primary, #1f2328); }
.mc-panelSubNote { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary, #8c959f); }

/* ── buttons ── */
.mc-btn {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 34px; padding: 0 14px; border: none; border-radius: 17px;
  font: inherit; font-size: 13px; line-height: 20px; font-weight: 500; cursor: pointer; color: inherit;
  /* 按钮永不收缩：nowrap 行里参与收缩会把它挤出容器（踩过） */
  flex: none; white-space: nowrap;
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
/* 顶行内的按钮略紧凑，保证与选择器同行 */
.mc-rowTop .mc-btn { height: 32px; padding: 0 11px; font-size: 12.5px; }
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
.mc-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
/* 搜索框可收缩：min-width:0 是关键，否则它把同行的按钮挤出容器 */
.mc-search { position: relative; flex: 1 1 200px; min-width: 0; }
.mc-searchIcon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--dsw-alias-label-tertiary, #8c959f); font-size: 14px; pointer-events: none; }
.mc-search .mc-input { width: 100%; padding-left: 30px; }
.mc-pager { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; flex: none; }
.mc-pageNow { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary, #57606a); white-space: nowrap; }
.mc-pageRange { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary, #8c959f); white-space: nowrap; }

/* ── model list（每模型一卡的卡片布局，自描述、不挤压） ── */
.mc-list { display: flex; flex-direction: column; }
.mc-entry { border: 1px solid var(--dsw-alias-border-l2, #d0d7de); border-radius: 11px; background: var(--dsw-alias-bg-layer-1, #ffffff); padding: 10px 12px; transition: border-color .15s ease, background .15s ease, box-shadow .15s ease; }
.mc-entry + .mc-entry { margin-top: 8px; }
.mc-entry:hover { border-color: rgba(9, 105, 218, 0.45); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06); }
.mc-entry-on { border-color: var(--dsw-alias-brand-primary, #0969da); background: rgba(9, 105, 218, 0.05); }
.mc-entryTop { display: flex; align-items: center; gap: 8px; min-width: 0; }
.mc-entryTop > input[type="checkbox"] { accent-color: var(--dsw-alias-brand-primary, #0969da); width: 14px; height: 14px; flex: none; }
.mc-entryTop .mc-src { margin-top: 0; flex: none; }
/* 徽标组：始终贴右、不换行、不参与挤压（模型号可换行） */
.mc-entryBadges { display: inline-flex; align-items: center; gap: 6px; flex: none; }
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

/* ── 模式切换（segmented control） ── */
.mc-segGroup { display: inline-flex; align-items: center; gap: 4px; padding: 3px; border: 1px solid var(--dsw-alias-border-l2, #d0d7de); border-radius: 12px; background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.04)); flex: none; }
.mc-seg {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
  height: 26px; padding: 0 12px; border: 1px solid transparent; border-radius: 9px;
  background: transparent; color: var(--dsw-alias-label-secondary, #57606a);
  font: inherit; font-size: 12px; line-height: 18px; cursor: pointer; white-space: nowrap;
  transition: background .15s ease, color .15s ease, border-color .15s ease;
}
.mc-seg:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); }
.mc-segOn { background: var(--dsw-alias-bg-layer-1, #ffffff); color: var(--dsw-alias-brand-primary, #0969da); border-color: var(--dsw-alias-brand-primary, #0969da); font-weight: 500; }
.mc-seg:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #0969da); outline-offset: 1px; }
/* 卡片内的紧凑档位/模态切换（比模式切换小一号，避免与输入框抢宽度） */
.mc-segGroupSm { padding: 2px; border-radius: 10px; }
.mc-segGroupSm .mc-seg { height: 24px; padding: 0 10px; border-radius: 8px; }

/* ── 编辑模式的表单 ── */
.mc-selectNarrow { flex: 0 0 auto; width: 128px; min-width: 0; max-width: 128px; }
/* 字段网格：宽面板两列，窄面板一列，标签统一列宽对齐 */
.mc-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(238px, 1fr)); gap: 8px 18px; margin-top: 10px; }
.mc-fieldRow { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary, #57606a); }
.mc-fieldRowTop { align-items: flex-start; margin-top: 8px; }
.mc-fieldRow .mc-fieldLabel { flex: 0 0 4.5em; }
.mc-fieldRow .mc-input { flex: 1 1 auto; min-width: 0; }
.mc-inputWire { flex: 0 0 84px; width: 84px; height: 26px; padding: 0 8px; font-size: 12px; border-radius: 8px; }
.mc-textarea { width: 100%; min-height: 46px; padding: 6px 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 18px; resize: vertical; }
.mc-efforts { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; min-width: 0; }
.mc-effortItem { display: inline-flex; align-items: center; gap: 4px; }
.mc-wireHint { font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary, #8c959f); white-space: nowrap; }
.mc-adv { margin-top: 10px; }
.mc-advSum { cursor: pointer; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary, #8c959f); }
.mc-advSum:hover { color: var(--dsw-alias-brand-primary, #0969da); }
.mc-adv .mc-textarea { margin-top: 6px; }
.mc-entryActions { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--dsw-alias-border-l2, #d0d7de); flex-wrap: wrap; }
.mc-btnDanger { border: 1px solid rgba(207, 34, 46, 0.36); background: transparent; color: var(--dsw-alias-state-error-primary, #cf222e); }
.mc-btnDanger:hover:not(:disabled) { background: rgba(207, 34, 46, 0.10); }
.mc-addBox { display: inline-flex; align-items: center; gap: 6px; flex: 1 1 300px; min-width: 220px; }
.mc-addBox .mc-input { flex: 1 1 auto; min-width: 140px; }
.mc-dirty { padding: 1px 8px; border-radius: 10px; font-size: 11px; line-height: 16px; background: rgba(154, 103, 0, 0.16); color: var(--dsw-alias-state-warn-label, #9a6700); }
.mc-note { padding: 1px 8px; border-radius: 10px; font-size: 11px; line-height: 16px; background: rgba(154, 103, 0, 0.16); color: var(--dsw-alias-state-warn-label, #9a6700); cursor: help; }
.mc-hintLine { margin-top: 8px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary, #8c959f); }
/* 行内代码（提示文案里的字段名） */
.mc-code { padding: 0 4px; border-radius: 5px; background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--dsw-alias-label-secondary, #57606a); }
/* 工具栏：第一行搜索/操作，第二行分页（避免挤成一行换行错位） */
.mc-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mc-toolbarEnd { justify-content: flex-end; }
/* 来源徽标：目录（适配器默认目录）/ override（pi-ai modelOverrides） */
.mc-src-catalog { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); color: var(--dsw-alias-label-tertiary, #57606a); }
`
