/**
 * 生成离线布局预览：用真实 CSS + 与 Page.tsx 相同的 DOM 结构渲染一屏，
 * 供无头浏览器截图检查（不参与构建、不随包发布）。
 * 用法：node scripts/preview.mjs  → 写出 .preview/layout.html
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const stylesSrc = readFileSync(join(root, 'src', 'client', 'styles.ts'), 'utf8')
const css = stylesSrc.slice(stylesSrc.indexOf('`') + 1, stylesSrc.lastIndexOf('`'))

const chip = (label, value) => `<span class="mc-metaChip"><i>${label}</i>${value}</span>`
const field = (label, value, cls = '') => `<label class="mc-fieldRow"><span class="mc-fieldLabel">${label}</span><input class="mc-input ${cls}" value="${value}" readonly /></label>`
const seg = (text, on = false) => `<button type="button" class="mc-seg ${on ? 'mc-segOn' : ''}">${text}</button>`

const html = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><title>模型检测 · 布局预览</title>
<style>
  body { margin: 0; padding: 20px 24px; background: #f6f7f9; }
  .frame { width: ${Number(process.env.FRAME_WIDTH ?? 580)}px; }
  ${css}
</style></head>
<body>
<div class="frame">
  <div class="mc-root">
    <header class="mc-head"><span class="mc-headDot"></span><h3 class="mc-title">模型检测</h3></header>

    <section class="mc-panel">
      <div class="mc-row">
        <label class="mc-field">
          <span class="mc-fieldLabel">提供方</span>
          <select class="mc-select"><option>DeepSeek（官方 API） (deepseek-official)</option></select>
        </label>
        <div class="mc-grow"></div>
        <div class="mc-actions">
          <button class="mc-btn mc-btnPrimary"><span class="mc-btnIcon">↻</span>读取现有模型</button>
        </div>
      </div>
      <div class="mc-row">
        <span class="mc-segGroup">${seg('发现新模型')}${seg('编辑现有模型', true)}</span>
        <div class="mc-metaRow">
          ${chip('baseURL', 'https://api.deepseek.com')}
          ${chip('协议', 'openai-completions')}
          ${chip('现有模型', '4')}
          ${chip('写入', 'llm-deepseek')}
        </div>
      </div>
    </section>

    <section class="mc-panel mc-panelSub">
      <div class="mc-panelHead"><span class="mc-panelTitle">路由级设置</span><span class="mc-panelSubNote">对所有模型生效</span></div>
      <div class="mc-row">
        <label class="mc-field"><span class="mc-fieldLabel mc-fieldLabelWide">推理档位</span><select class="mc-select mc-selectNarrow"><option>high</option></select></label>
        <label class="mc-field"><span class="mc-fieldLabel mc-fieldLabelWide">thinking</span><select class="mc-select mc-selectNarrow"><option>enabled</option></select></label>
      </div>
      <div class="mc-hintLine">保存任一模型后，\`models\` 列表会取代适配器默认目录，请把要用的模型都加进来。</div>
    </section>

    <div class="mc-toolbar">
      <div class="mc-search"><span class="mc-searchIcon">⌕</span><input class="mc-input" placeholder="搜索模型号 / 展示名" readonly /></div>
      <div class="mc-addBox"><input class="mc-input" placeholder="手填模型号，如 deepseek-v4.1-flash" readonly /><button class="mc-btn mc-btnSecondary mc-btnDense">添加模型</button></div>
    </div>
    <div class="mc-toolbar mc-toolbarEnd">
      <span class="mc-pageRange">共 4 个 · 本页 4</span>
      <div class="mc-pager">
        <button class="mc-btn mc-btnSecondary mc-btnDense" disabled>上一页</button>
        <span class="mc-pageNow">1 / 1 页</span>
        <button class="mc-btn mc-btnSecondary mc-btnDense" disabled>下一页</button>
      </div>
    </div>

    <div class="mc-list">
      <div class="mc-entry mc-entry-on">
        <div class="mc-entryTop">
          <span class="mc-lineTag">模型号</span>
          <span class="mc-id">deepseek-v4.1-flash-expires-on-0910</span>
          <span class="mc-entryBadges">
            <span class="mc-src mc-src-models-dev">models.dev</span>
            <span class="mc-note">内测</span>
            <span class="mc-dirty">未保存</span>
          </span>
        </div>
        <div class="mc-fields">
          ${field('展示名', 'DeepSeek V4.1 Flash (内测)')}
          ${field('上下文', '1000000')}
          ${field('输出上限', '384000')}
          <div class="mc-fieldRow"><span class="mc-fieldLabel">输入模态</span><span class="mc-segGroup mc-segGroupSm">${seg('文本', true)}${seg('图像', true)}</span></div>
        </div>
        <div class="mc-hintLine">思考档位由上方「路由级设置」统一控制（off / low / high / max），不随单个模型设置。</div>
        <div class="mc-entryActions">
          <button class="mc-btn mc-btnPrimary mc-btnDense">保存</button>
          <button class="mc-btn mc-btnSecondary mc-btnDense">还原</button>
          <button class="mc-btn mc-btnSecondary mc-btnDense">采纳建议（含图像）</button>
          <div class="mc-grow"></div>
          <button class="mc-btn mc-btnDanger mc-btnDense">删除</button>
        </div>
      </div>

      <div class="mc-entry">
        <div class="mc-entryTop">
          <span class="mc-lineTag">模型号</span>
          <span class="mc-id">deepseek-v4-flash</span>
          <span class="mc-entryBadges"><span class="mc-src mc-src-catalog">目录默认</span><span class="mc-src mc-src-models-dev">models.dev</span></span>
        </div>
        <div class="mc-fields">
          ${field('展示名', 'DeepSeek-V4-Flash')}
          ${field('上下文', '1000000')}
          ${field('输出上限', '256000')}
          <div class="mc-fieldRow"><span class="mc-fieldLabel">输入模态</span><span class="mc-segGroup mc-segGroupSm">${seg('文本', true)}${seg('图像')}</span></div>
        </div>
        <div class="mc-hintLine">思考档位由上方「路由级设置」统一控制（off / low / high / max），不随单个模型设置。</div>
        <div class="mc-entryActions">
          <button class="mc-btn mc-btnPrimary mc-btnDense" disabled>已保存</button>
          <button class="mc-btn mc-btnSecondary mc-btnDense" disabled>还原</button>
          <div class="mc-grow"></div>
          <button class="mc-btn mc-btnDanger mc-btnDense" disabled>目录默认</button>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>`

const outDir = join(root, '.preview')
mkdirSync(outDir, { recursive: true })
const out = join(outDir, 'layout.html')
writeFileSync(out, html, 'utf8')
console.log(`写出预览：${out}`)
