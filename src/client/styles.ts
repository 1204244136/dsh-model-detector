/**
 * dsh-model-detector — 设置页样式（DSH 设计语言）。
 *
 * 全部颜色只走 `--dsw-alias-*` / `--dsw-static-*` token（随主题明暗自动变化），
 * 需要透明度时用 `color-mix()` 现算，**不写亮色字面量**：字面量一旦被当作
 * token 的 fallback，在深色主题下就会显形为"亮色主题的错误颜色"
 * （DSH 官方设置页 CSS 顶部的同一条告诫）。
 *
 * token 语义速查（`packages/client/ui-theme/src/styles/design-platform.css`）：
 *  - `--dsw-alias-brand-primary` 是**高对比前景色**：亮色≈近黑、深色≈近白。
 *    它用于聚焦环/选中边框；**蓝色强调**要用 `--dsw-alias-state-business-primary`
 *    （亮色 deepseek-500 / 深色 deepseek-400）。
 *  - `--dsw-alias-*-tertiary` 系是各状态的"淡底"（亮色浅、深色深），做徽标/提示条底色。
 *  - `--dsw-alias-interactive-bg-hover[-solid|-danger]` 是主题感知的交互底色。
 */

export const CSS = `
.mc-root {
  display: flex; flex-direction: column; gap: 14px;
  max-width: 760px; padding: 4px 2px 24px;
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family);
  /* 原生控件（下拉弹层 / 复选框 / 滚动条）按方案跟随 DSH 主题：
     DSH 用 body[data-ds-dark-theme] 切换深色，弹层由浏览器按 color-scheme 绘制，
     若不同步，深色主题下弹层会拿 select 的深色底 + 亮色方案的文字色 → 不可读。 */
  color-scheme: light;
}
body[data-ds-dark-theme] .mc-root { color-scheme: dark; }

/* ── header ── */
.mc-head { display: flex; align-items: center; gap: 10px; }
.mc-headDot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--dsw-alias-state-business-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--dsw-alias-state-business-primary) 16%, transparent);
}
.mc-title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; color: var(--dsw-alias-label-primary); }

/* ── panel ── */
.mc-panel {
  display: flex; flex-direction: column; gap: 10px; padding: 12px 14px;
  border: 0.5px solid var(--dsw-alias-border-l3); border-radius: 14px;
  background: var(--dsw-alias-bg-layer-1);
}
/* 控制行：可换行；子项可收缩但不叠字（flex-wrap 是防"两个 select 撞在一起"的关键） */
.mc-row { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; min-width: 0; }
/* 顶行（提供方 + 主操作按钮）：**永不换行**——按钮组固定与选择器同行，
   切换模式导致按钮数量变化时也不会掉到下一行；空间不足由选择器让位（省略号） */
.mc-rowTop { flex-wrap: nowrap; overflow: hidden; }
.mc-grow { flex: 1 1 auto; min-width: 0; }
/* 主操作按钮作为一组：不收缩、不换行 */
.mc-actions { display: inline-flex; align-items: center; gap: 8px; flex-wrap: nowrap; flex: none; }
/* 字段组：标签不收缩、控件可收缩；窄面板下整组换行 */
.mc-field { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); min-width: 0; flex: 0 1 auto; }
/* 顶行里的选择器：优先 176px；有富余就伸展（上限 300px）吸收空隙，
   空间不足则收缩（省略号）——按钮组始终同行且贴右，选择器与按钮之间不留死空 */
.mc-rowTop .mc-select { flex: 0 1 auto; width: 176px; min-width: 88px; max-width: 300px; }
.mc-rowTop .mc-field { flex: 0 1 auto; min-width: 0; }
.mc-rowTop .mc-fieldLabel { flex: none; }
.mc-fieldLabel { flex: none; white-space: nowrap; }
.mc-fieldLabelWide { min-width: 4.5em; }
.mc-metaRow { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.mc-metaChip { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 2px 9px; border-radius: 8px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-interactive-bg-hover); flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mc-metaChip i { font-style: normal; flex: none; color: var(--dsw-alias-label-tertiary); }
/* 子面板（路由级设置）：比主面板高一层次 */
.mc-panelSub { gap: 8px; background: var(--dsw-alias-bg-layer-2); }
.mc-panelHead { display: flex; align-items: baseline; gap: 8px; }
.mc-panelTitle { font-size: 13px; line-height: 20px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.mc-panelSubNote { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }

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
.mc-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.mc-btnIcon { font-size: 14px; line-height: 1; }
.mc-btnPrimary { background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); }
.mc-btnPrimary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
/* 强调（应用所选）：绿 500 明度居中，两套主题都配深色文字才够对比
   （不能用 label-primary-foreground——它在深色主题下也翻成近黑、亮色主题下是白）。 */
.mc-btnAccent { background: var(--dsw-alias-state-success-primary); color: var(--dsw-static-neutral-bluish-1000); }
.mc-btnAccent:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 86%, var(--dsw-static-neutral-bluish-1000)); }
.mc-btnBadge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: color-mix(in srgb, var(--dsw-static-neutral-bluish-1000) 18%, transparent); font-size: 11px; line-height: 18px; text-align: center; }
.mc-btnSecondary { border: 0.5px solid var(--dsw-alias-border-l3); background: transparent; color: var(--dsw-alias-label-primary); }
.mc-btnSecondary:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.mc-btnDense { height: 30px; padding: 0 12px; border-radius: 15px; font-size: 12px; line-height: 18px; font-weight: 400; }

/* ── form controls ── */
.mc-input, .mc-select {
  box-sizing: border-box; height: 32px; padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l4); border-radius: 8px;
  background-color: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 13px; line-height: 20px;
}
/* placeholder 用 tertiary（亮 bluish-600 / 深 bluish-400）：label-dimmed 是给
   "已填充的次要信息"准备的，做占位符在亮色输入框上几乎看不见。 */
.mc-input::placeholder, .mc-textarea::placeholder { color: var(--dsw-alias-label-tertiary); }
.mc-select { flex: 1 1 auto; min-width: 120px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 原生下拉箭头贴边且不随主题，换成与宿主设置页同一枚 12px chevron
   （Data-URI SVG 解析不了 CSS 变量，#81858C 是两套主题共用的 caption 灰）。 */
.mc-select {
  appearance: none; cursor: pointer; padding-right: 30px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 12px 12px;
}
/* 顶行内的按钮略紧凑，保证与选择器同行 */
.mc-rowTop .mc-btn { height: 32px; padding: 0 11px; font-size: 12.5px; }
.mc-input:focus, .mc-select:focus { outline: none; border-color: var(--dsw-alias-brand-primary); }

/* 加载态：图标旋转而非换文案（保持按钮宽度稳定，避免布局抖动） */
.mc-spin { display: inline-block; animation: mc-spin 0.9s linear infinite; }
@keyframes mc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* ── alerts（正文用主文字色保证可读，状态色只放在图标与边框上） ── */
.mc-alert { display: flex; align-items: flex-start; gap: 8px; padding: 8px 12px; border-radius: 10px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-primary); border: 0.5px solid transparent; }
.mc-alertIcon { flex: none; width: 16px; text-align: center; font-size: 13px; line-height: 18px; }
/* 告警正文可能很长（线上拉取失败原因带 URL）：min-width:0 才能收缩，overflow-wrap
   允许长 URL 断行，否则窄面板下这个 flex 子项会把容器撑破（见 AGENTS.md 布局硬约束）。 */
.mc-alertText { min-width: 0; overflow-wrap: anywhere; }
.mc-alert-info { background: var(--dsw-alias-state-business-tertiary); border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 32%, transparent); }
.mc-alert-info .mc-alertIcon { color: var(--dsw-alias-state-business-primary); }
.mc-alert-ok { background: var(--dsw-alias-state-success-tertiary); border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 36%, transparent); }
.mc-alert-ok .mc-alertIcon { color: var(--dsw-alias-state-success-primary); }
.mc-alert-err { background: var(--dsw-alias-interactive-bg-hover-danger); border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 36%, transparent); }
.mc-alert-err .mc-alertIcon { color: var(--dsw-alias-state-error-primary); }
.mc-alert-warn { background: var(--dsw-alias-state-warn-tertiary); border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 40%, transparent); }
.mc-alert-warn .mc-alertIcon { color: var(--dsw-alias-state-warn-label); }

/* ── source counts ── */
.mc-counts { display: flex; flex-wrap: wrap; gap: 6px; }
.mc-count { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 12px; font-size: 12px; line-height: 20px; color: var(--dsw-alias-label-secondary); }
.mc-count b { font-weight: 600; }
.mc-count-models-dev { background: var(--dsw-alias-state-business-tertiary); color: var(--dsw-alias-state-business-primary); }
/* 线上声明（端点自报的容量/模态）比 models.dev 快照更权威，用 success 淡底区分 */
.mc-count-provider { background: var(--dsw-alias-state-success-tertiary); color: var(--dsw-alias-state-success-primary); }
.mc-count-manifest { background: var(--dsw-alias-interactive-bg-hover-solid); color: var(--dsw-alias-label-secondary); }
.mc-count-default { background: var(--dsw-alias-state-warn-tertiary); color: var(--dsw-alias-state-warn-label); }
/* 未收录提示：黄色 ⚠ 图标，悬停说明 */
.mc-countNote { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; font-size: 13px; line-height: 1; color: var(--dsw-alias-state-warn-label); background: var(--dsw-alias-state-warn-tertiary); cursor: help; }

/* ── toolbar ── */
.mc-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
/* 搜索框可收缩：min-width:0 是关键，否则它把同行的按钮挤出容器 */
.mc-search { position: relative; flex: 1 1 200px; min-width: 0; }
.mc-searchIcon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--dsw-alias-label-tertiary); font-size: 14px; pointer-events: none; }
.mc-search .mc-input { width: 100%; padding-left: 30px; }
.mc-pager { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; flex: none; }
.mc-pageNow { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.mc-pageRange { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); white-space: nowrap; }

/* ── model list（每模型一卡的卡片布局，自描述、不挤压） ── */
.mc-list { display: flex; flex-direction: column; }
.mc-entry { border: 0.5px solid var(--dsw-alias-border-l3); border-radius: 12px; background: var(--dsw-alias-bg-layer-2); padding: 10px 12px; transition: border-color .15s ease, background .15s ease, box-shadow .15s ease; }
.mc-entry + .mc-entry { margin-top: 8px; }
.mc-entry:hover:not(.mc-entry-on) { border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 55%, transparent); box-shadow: 0 1px 3px var(--dsw-alias-bg-mask-2); }
.mc-entry-on { border-color: var(--dsw-alias-state-business-primary); background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 9%, var(--dsw-alias-bg-layer-2)); }
.mc-entryTop { display: flex; align-items: center; gap: 8px; min-width: 0; }
.mc-entryTop > input[type="checkbox"] { accent-color: var(--dsw-alias-button-primary-fill); width: 15px; height: 15px; flex: none; cursor: pointer; }
.mc-entryTop .mc-src { margin-top: 0; flex: none; }
/* 徽标组：始终贴右、不换行、不参与挤压（模型号可换行） */
.mc-entryBadges { display: inline-flex; align-items: center; gap: 6px; flex: none; }
.mc-lineTag { font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); white-space: nowrap; flex: 0 0 auto; min-width: 3em; }
.mc-id { font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-primary); overflow-wrap: anywhere; word-break: break-word; flex: 1 1 auto; min-width: 0; }
.mc-entryName { display: flex; align-items: center; gap: 8px; margin-top: 5px; }
.mc-name { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 auto; min-width: 0; }
.mc-entryMeta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin-top: 8px; }
.mc-metaItem { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.mc-metaItem b { font-weight: 600; color: var(--dsw-alias-label-primary); }
.mc-chip { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 12px; line-height: 18px; background: var(--dsw-alias-interactive-bg-hover-solid); color: var(--dsw-alias-label-secondary); }
/* 推理档位 chip：区分于普通模态 chip，弱化强调但可辨识 */
.mc-chip-effort { background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 16%, transparent); color: var(--dsw-alias-state-business-primary); }

/* ── source badge ── */
.mc-src { display: inline-block; margin-top: 3px; padding: 1px 8px; border-radius: 10px; font-size: 11px; line-height: 16px; }
.mc-src-models-dev { background: var(--dsw-alias-state-business-tertiary); color: var(--dsw-alias-state-business-primary); }
.mc-src-provider { background: var(--dsw-alias-state-success-tertiary); color: var(--dsw-alias-state-success-primary); }
.mc-src-manifest { background: var(--dsw-alias-interactive-bg-hover-solid); color: var(--dsw-alias-label-secondary); }
.mc-src-default { background: var(--dsw-alias-state-warn-tertiary); color: var(--dsw-alias-state-warn-label); }

/* ── empty / loading ── */
.mc-empty { padding: 30px 12px; text-align: center; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-tertiary); border: 1px dashed var(--dsw-alias-border-l3); border-radius: 12px; }

/* ── 模式切换（segmented control） ── */
.mc-segGroup { display: inline-flex; align-items: center; gap: 4px; padding: 3px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: 12px; background: var(--dsw-alias-interactive-bg-hover); flex: none; }
.mc-seg {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
  height: 26px; padding: 0 12px; border: 1px solid transparent; border-radius: 9px;
  background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 12px; line-height: 18px; cursor: pointer; white-space: nowrap;
  transition: background .15s ease, color .15s ease, border-color .15s ease;
}
.mc-seg:hover { background: var(--dsw-alias-interactive-bg-hover); }
.mc-segOn { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-state-business-primary); border-color: var(--dsw-alias-state-business-primary); font-weight: 500; }
.mc-seg:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
/* 卡片内的紧凑档位/模态切换（比模式切换小一号，避免与输入框抢宽度） */
.mc-segGroupSm { padding: 2px; border-radius: 10px; }
.mc-segGroupSm .mc-seg { height: 24px; padding: 0 10px; border-radius: 8px; }

/* ── 编辑模式的表单 ── */
.mc-selectNarrow { flex: 0 0 auto; width: 128px; min-width: 0; max-width: 128px; }
/* 字段网格：宽面板两列，窄面板一列，标签统一列宽对齐 */
.mc-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(238px, 1fr)); gap: 8px 18px; margin-top: 10px; }
.mc-fieldRow { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.mc-fieldRowTop { align-items: flex-start; margin-top: 8px; }
.mc-fieldRow .mc-fieldLabel { flex: 0 0 4.5em; }
.mc-fieldRow .mc-input { flex: 1 1 auto; min-width: 0; }
.mc-inputWire { flex: 0 0 84px; width: 84px; height: 26px; padding: 0 8px; font-size: 12px; border-radius: 8px; }
.mc-textarea { width: 100%; min-height: 46px; padding: 6px 10px; font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; line-height: 18px; resize: vertical; }
.mc-efforts { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; min-width: 0; }
.mc-effortItem { display: inline-flex; align-items: center; gap: 4px; }
.mc-wireHint { font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); white-space: nowrap; }
.mc-adv { margin-top: 10px; }
.mc-advSum { cursor: pointer; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.mc-advSum:hover { color: var(--dsw-alias-state-business-primary); }
.mc-adv .mc-textarea { margin-top: 6px; }
.mc-entryActions { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 0.5px solid var(--dsw-alias-border-l3); flex-wrap: wrap; }
.mc-btnDanger { border: 0.5px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 40%, transparent); background: transparent; color: var(--dsw-alias-state-error-primary); }
.mc-btnDanger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger); }
.mc-addBox { display: inline-flex; align-items: center; gap: 6px; flex: 1 1 300px; min-width: 220px; }
.mc-addBox .mc-input { flex: 1 1 auto; min-width: 140px; }
.mc-dirty { padding: 1px 8px; border-radius: 10px; font-size: 11px; line-height: 16px; background: var(--dsw-alias-state-warn-tertiary); color: var(--dsw-alias-state-warn-label); }
.mc-note { padding: 1px 8px; border-radius: 10px; font-size: 11px; line-height: 16px; background: var(--dsw-alias-state-warn-tertiary); color: var(--dsw-alias-state-warn-label); cursor: help; }
.mc-hintLine { margin-top: 8px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
/* 行内代码（提示文案里的字段名） */
.mc-code { padding: 0 4px; border-radius: 5px; background: var(--dsw-alias-interactive-bg-hover-solid); font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 11px; color: var(--dsw-alias-label-secondary); }
/* 工具栏：第一行搜索/操作，第二行分页（避免挤成一行换行错位） */
.mc-toolbarEnd { justify-content: flex-end; }
/* 来源徽标：目录（适配器默认目录）/ override（pi-ai modelOverrides） */
.mc-src-catalog { background: var(--dsw-alias-interactive-bg-hover-solid); color: var(--dsw-alias-label-secondary); }
`
