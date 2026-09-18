/**
 * 生成离线布局预览：用真实 CSS + 与 Page.tsx 相同的 DOM 结构渲染一屏，
 * 供无头浏览器截图检查（不参与构建、不随包发布）。
 *
 * 用法：
 *   node scripts/preview.mjs                      # 编辑模式 · 浅色
 *   MODE=discover node scripts/preview.mjs        # 发现模式（两个按钮，最挤的一档）
 *   THEME=dark node scripts/preview.mjs           # 深色主题（body[data-ds-dark-theme]）
 *   FRAME_WIDTH=430 node scripts/preview.mjs      # 窄面板不重叠验证
 *
 * 主题 token 直接从 DSH checkout 的 design-platform.css / base.css 内联，
 * 深浅两套都是**真实取值**（读不到 checkout 时退化为插件自身 CSS，仅供浅色参考）。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MODE = process.env.MODE === 'discover' ? 'discover' : 'edit'
const THEME = process.env.THEME === 'dark' ? 'dark' : 'light'
const stylesSrc = readFileSync(join(root, 'src', 'client', 'styles.ts'), 'utf8')
// 锚定模板起点，别用 indexOf('`')：文件头 JSDoc 里也有反引号，会把注释+JS 代码混进预览 CSS。
const CSS_MARKER = 'export const CSS = `'
const cssStart = stylesSrc.indexOf(CSS_MARKER)
if (cssStart < 0) {
  console.error(`✖ src/client/styles.ts 里找不到 "${CSS_MARKER}"——预览无法提取样式`)
  process.exit(1)
}
const css = stylesSrc.slice(cssStart + CSS_MARKER.length, stylesSrc.lastIndexOf('`'))
// 反引号会截断 CSS 模板字符串（浏览器端 build 直接报语法错，预览则静默截断样式）——
// 注释里写 token 名时用引号，别用反引号。
if (css.includes('`')) {
  console.error('✖ CSS 模板里出现了反引号：模板字符串会被截断，请改用引号')
  process.exit(1)
}

/** DSH 主题样式表候选位置（$DSH_CHECKOUT → 常见 checkout → npm 全局安装）。 */
const themeCssCandidates = () => {
  const out = []
  const checkouts = [process.env.DSH_CHECKOUT, join(homedir(), 'Documents', 'GitHub', 'deepseek-harness')].filter(Boolean)
  for (const c of checkouts) {
    out.push(join(c, 'packages', 'client', 'ui-theme', 'src', 'styles', 'design-platform.css'))
    out.push(join(c, 'packages', 'client', 'ui-theme', 'src', 'styles', 'base.css'))
  }
  return out
}

const themeCss = themeCssCandidates().filter((p) => existsSync(p)).map((p) => readFileSync(p, 'utf8')).join('\n')
if (themeCss === '') {
  console.warn('⚠ 未找到 DSH 主题样式表（设置 DSH_CHECKOUT 可指定 checkout 路径）——预览缺少 --dsw-alias-* token，颜色将全部失焦')
}

const chip = (label, value) => `<span class="mc-metaChip"><i>${label}</i>${value}</span>`
const field = (label, value, cls = '') => `<label class="mc-fieldRow"><span class="mc-fieldLabel">${label}</span><input class="mc-input ${cls}" value="${value}" readonly /></label>`
const seg = (text, on = false) => `<button type="button" class="mc-seg ${on ? 'mc-segOn' : ''}">${text}</button>`

const html = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><title>模型检测 · 布局预览（${MODE}/${THEME}）</title>
<style>
${themeCss}
  html, body { margin: 0; }
  body { padding: 20px 24px; background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, #111); font-family: var(--dsw-font-family, system-ui); }
  .frame { width: ${Number(process.env.FRAME_WIDTH ?? 580)}px; }
${css}
</style></head>
<body${THEME === 'dark' ? ' data-ds-dark-theme' : ''}>
<div class="frame">
  <div class="mc-root">
    <header class="mc-head"><span class="mc-headDot"></span><h3 class="mc-title">模型检测</h3></header>

    <section class="mc-panel">
      <div class="mc-row mc-rowTop">
        <label class="mc-field">
          <span class="mc-fieldLabel">提供方</span>
          <select class="mc-select"><option>DeepSeek（官方 API）</option></select>
        </label>
        <div class="mc-actions">
          <button class="mc-btn mc-btnPrimary"><span class="mc-btnIcon">↻</span>${MODE === 'discover' ? '获取最新模型' : '读取现有模型'}</button>
          ${MODE === 'discover' ? '<button class="mc-btn mc-btnAccent">应用所选<span class="mc-btnBadge">2</span></button>' : ''}
        </div>
      </div>
      <div class="mc-row">
        <span class="mc-segGroup">${seg('发现新模型', MODE === 'discover')}${seg('编辑现有模型', MODE === 'edit')}</span>
        <div class="mc-metaRow">
          ${chip('路由', 'deepseek-official')}
          ${chip('baseURL', 'https://api.deepseek.com')}
          ${chip('协议', 'openai-completions')}
          ${chip('现有模型', '4')}
          ${chip('写入', 'llm-deepseek')}
        </div>
      </div>
    </section>

    ${MODE === 'discover' ? `
    <div class="mc-counts">
      <span class="mc-count mc-count-provider">线上声明 <b>4</b></span>
      <span class="mc-count mc-count-models-dev">models.dev <b>2</b></span>
      <span class="mc-count mc-count-manifest">清单 <b>1</b></span>
      <span class="mc-count mc-count-default">默认 <b>1</b></span>
      <span class="mc-countNote" title="models.dev 未收录该提供方">⚠</span>
    </div>
    <div class="mc-alert mc-alert-warn"><span class="mc-alertIcon">⚠</span><span>models.dev 加载失败，能力仅靠清单/默认</span></div>
    <div class="mc-alert mc-alert-warn"><span class="mc-alertIcon">⚠</span><span class="mc-alertText">GET http://127.0.0.1:8045/models 失败: HTTP 404；GET http://127.0.0.1:8045/v1/models 失败: HTTP 404；models.dev 未收录提供方「antigravity」、内置清单也没有它的模型，无法离线兜底。请检查该路由的 baseURL / 协议（Anthropic 协议路由的模型清单通常在 /v1/models）</span></div>` : `
    <section class="mc-panel mc-panelSub">
      <div class="mc-panelHead"><span class="mc-panelTitle">路由级设置</span><span class="mc-panelSubNote">对所有模型生效</span></div>
      <div class="mc-row">
        <label class="mc-field"><span class="mc-fieldLabel mc-fieldLabelWide">推理档位</span><select class="mc-select mc-selectNarrow"><option>high</option></select></label>
        <label class="mc-field"><span class="mc-fieldLabel mc-fieldLabelWide">thinking</span><select class="mc-select mc-selectNarrow"><option>enabled</option></select></label>
      </div>
      <div class="mc-hintLine">保存任一模型后，<code class="mc-code">models</code> 列表会取代适配器默认目录，请把要用的模型都加进来。</div>
    </section>
    <div class="mc-alert mc-alert-info"><span class="mc-alertIcon">⏳</span><span>正在读取现有模型…</span></div>
    <div class="mc-alert mc-alert-err"><span class="mc-alertIcon">✕</span><span>读取现有模型失败: fetch failed</span></div>`}

    <div class="mc-toolbar">
      <div class="mc-search"><span class="mc-searchIcon">⌕</span><input class="mc-input" placeholder="${MODE === 'discover' ? '搜索已发现模型（id / 模态）' : '搜索模型号 / 展示名'}" readonly /></div>
      ${MODE === 'discover'
        ? '<button class="mc-btn mc-btnSecondary mc-btnDense">全选当前（35）</button><button class="mc-btn mc-btnSecondary mc-btnDense">清空</button>'
        : '<div class="mc-addBox"><input class="mc-input" placeholder="手填模型号，如 deepseek-v4.1-flash" readonly /><button class="mc-btn mc-btnSecondary mc-btnDense">添加模型</button></div>'}
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
${MODE === 'discover' ? `
      <div class="mc-entry mc-entry-on">
        <label class="mc-entryTop">
          <input type="checkbox" checked />
          <span class="mc-lineTag">提供方</span>
          <span class="mc-id">deepseek-v4.1-flash-expires-on-0910</span>
          <span class="mc-entryBadges"><span class="mc-src mc-src-manifest">清单</span><span class="mc-note">内测</span></span>
        </label>
        <div class="mc-entryName"><span class="mc-lineTag">收录名</span><span class="mc-name">DeepSeek V4.1 Flash (内测, 2026-09-10 到期)</span></div>
        <div class="mc-entryMeta">
          <span class="mc-chip">文本</span><span class="mc-chip">图像</span>
          <span class="mc-metaItem">上下文 <b>1,000,000</b></span>
          <span class="mc-metaItem">输出 <b>384,000</b></span>
        </div>
      </div>
      <div class="mc-entry">
        <label class="mc-entryTop">
          <input type="checkbox" />
          <span class="mc-lineTag">提供方</span>
          <span class="mc-id">deepseek-v4-pro</span>
          <span class="mc-entryBadges"><span class="mc-src mc-src-models-dev">models.dev</span></span>
        </label>
        <div class="mc-entryName"><span class="mc-lineTag">收录名</span><span class="mc-name">DeepSeek V4 Pro</span></div>
        <div class="mc-entryMeta">
          <span class="mc-chip">文本</span><span class="mc-chip mc-chip-effort">推理 High / Max</span>
          <span class="mc-metaItem">上下文 <b>1,000,000</b></span>
          <span class="mc-metaItem">输出 <b>384,000</b></span>
        </div>
      </div>
      <div class="mc-entry">
        <label class="mc-entryTop">
          <input type="checkbox" />
          <span class="mc-lineTag">提供方</span>
          <span class="mc-id">deepseek-v4-unknown-exp</span>
          <span class="mc-entryBadges"><span class="mc-src mc-src-default">默认</span></span>
        </label>
        <div class="mc-entryMeta">
          <span class="mc-chip">文本</span>
          <span class="mc-metaItem">上下文 <b>262,144</b></span>
          <span class="mc-metaItem">输出 <b>32,768</b></span>
        </div>
        <div class="mc-hintLine">未查到元数据（按纯文本处理）——应用后可在「编辑现有模型」里勾上图像。</div>
      </div>` : `
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
        <div class="mc-fieldRow mc-fieldRowTop">
          <span class="mc-fieldLabel">思考档位</span>
          <span class="mc-efforts">
            <span class="mc-effortItem">${seg('off')}<span class="mc-wireHint">空 = 不传</span></span>
            <span class="mc-effortItem">${seg('low', true)}<input class="mc-input mc-inputWire" value="low" readonly /></span>
            <span class="mc-effortItem">${seg('high', true)}<input class="mc-input mc-inputWire" value="high" readonly /></span>
          </span>
        </div>
        <details class="mc-adv"><summary class="mc-advSum">高级：compat（wire 兼容开关，JSON）</summary><textarea class="mc-input mc-textarea" rows="2" readonly>{"thinkingFormat":"deepseek"}</textarea></details>
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
      </div>`}
    </div>
  </div>
</div>
</body></html>`

const outDir = join(root, '.preview')
mkdirSync(outDir, { recursive: true })
const out = join(outDir, `layout-${MODE}-${THEME}.html`)
writeFileSync(out, html, 'utf8')
// 保持旧路径可用（脚本外的截图命令/文档都在用 layout.html）
copyFileSync(out, join(outDir, 'layout.html'))
console.log(`写出预览：${out}`)
