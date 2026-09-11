# AGENTS.md — dsh-model-detector 开发指南

本文件面向**在此仓库上工作的 AI Agent / 开发者**。读完它再动手，避免踩我们踩过的坑。

## 定位（一句话）

> 为任意 pi-ai 提供方（以及 DeepSeek 官方 API 路由 `deepseek-official`）「**检测**其线上最新模型 + 用 models.dev 自动富化正确元数据（模态/容量/推理）+ 写入该提供方」，并支持**手动编辑现有模型参数**——设置页插件。

**明确不是**：静态"模型目录/百科"（那是我们放弃的旧定位）；也不是手工维护清单（models.dev 是自动主源）。

## 架构（双半区）

- **Host 半区**：`src/index.ts`（入口）+ `src/api.ts`（业务）+ `src/manifest.ts`（薄覆盖清单）。
  - `inject = ['webServer', 'settings', 'tools']`，注册 webServer 前缀路由 `/dsh-model-detector/api`（`/providers`、`/discover`、`/current`、`/save-model`、`/remove-model`、`/route-settings`、`/apply`），外加只读工具 `_dsh_model_detector_status`。
- **Client 半区**：`src/client/`（React 设置页，`settings.section` slot）。
  - `inject = ['slots']`，注册 `settings.section`，label「模型检测」；样式走 **DSH 设计语言**（`--dsw-alias-*` token，capsule 按钮、发丝线卡片）。
  - 两种模式：「发现新模型」（勾选应用）与「编辑现有模型」（逐条改参数）。

## 写入目标：两套 schema（核心新增）

| | `llm-pi-ai` | `llm-deepseek` |
|---|---|---|
| 路由 | 任意（`opencode-go`、`deepseek`…） | 仅 `deepseek-official`（`dsh-llm-deepseek` 唯一拥有） |
| 模型字段 | `id/name/contextWindow/maxTokens/input/reasoningEfforts/compat` | `id/name/description/contextWindow/maxTokens/inputModalities/imagePixelBudget/imageMaxBytes` |
| 模态键 | `input: ['text','image']`（空数组合法 = 不声明） | `inputModalities: ['text','image']`（**`min(1)`，空数组非法**） |
| 推理档位 | **模型级** `reasoningEfforts`（dict，须含至少一个非 off 档位） | **路由级** `reasoningEffort`（off/low/high/max）+ `thinking` |
| 目录覆盖 | 无 `models` 列表时写 `modelOverrides[id]` | 无（只写 `models` 列表） |

- `resolveNamespace(route, st)`：pi-ai 段里有该 route → `llm-pi-ai`；route 是 `deepseek-official` → `llm-deepseek`；否则看清单 `target` 提示，缺省 `llm-pi-ai`。
- `resolveTarget(route, st)` 给出 `ns / profile / apiKeyEnv / baseURL / hasModelsList`；`toTargetModel()` 把统一发现形状转成目标形状；`cleanForTarget()` 按目标白名单清洗。
- **DeepSeek 适配器硬规则**（`packages/llm/llm-deepseek/src/adapter.ts`）：收到图片时 `models.find(id)?.inputModalities?.includes('image') !== true` → 抛 `UNSUPPORTED_CONTENT`。**没写 `inputModalities` 就等于纯文本**——这是"手填模型号不支持多模态"的根因。
- 写入用 `readUserLayer()`（`settings.describe().user`）作基底，只落"用户层"，不把 schema 默认值固化成用户配置；`replace()` 带 `readRevision()` 做冲突检测。

## 数据流（核心）

```
/discover(route) →
  resolveTarget(route, st) 取 profile；baseURL 兜底 manifestProvider(route).baseURL
  解析 apiKey：请求体 → 凭据服务 resolve(apiKeyEnv)
  fetchLiveModels(baseURL, apiKey)   # GET <baseURL>/models（线上最新 id）
  mergeDiscovered(route, ids, defaults, modelsDev)
    # 优先级：models.dev → manifest → 家族推断 → 默认(text+262144/32768)
  toTargetModel(ns, m)  # 统一形状 → pi-ai(input) / deepseek(inputModalities)
  // 线上失败只回退 models.dev/manifest，绝不回退该提供方旧配置

/current(route) → 现有模型（profile models/modelOverrides + 适配器目录）+ 建议值
/save-model → writeModel（就地合并该条；pi-ai 目录路由无 models 列表时写 modelOverrides）
```

## 元数据来源（四级，切勿回到"人工逐模型维护"）

1. **models.dev**（`https://models.dev/api.json`，`loadModelsDev()` 缓存一次/会话，**主源**）——自动、覆盖几乎所有提供方、含模态/容量/推理。
2. **内置 manifest**（`src/manifest.ts`，薄覆盖层）——只兜底 models.dev 缺/错的个别模型（如 `hy3-preview`、内测模型）；按提供方 keyed，可扩展。`catalog` 字段是"适配器默认目录"（deepseek-official 的三条），用于编辑页列出。
3. **家族模态推断**（`inferFamilyInput()`）——清单里完全没有该模型号时，若同族条目声明了 image 则继承模态（内测/预发布模型）。宁可保守也不按名字里的 `vision` 字样猜。
4. **保守默认**：`text` + 262144/32768。

> **名字级匹配必须"优先能力更丰富者"**：`pickBestMatch()` 在等效候选里按「含 image > 上下文容量」打分。原因：同一系列常有纯文本与多模态两条线（`deepseek-v4-flash` vs `deepseek-v4-flash-vision-exp`），而 `deepseek-v4.1-flash-expires-on-0910` 这类手填 id 与两者都"版本级等效"——**取第一个命中会落到纯文本条目**。精确同名命中永远优先。
> `normalizeModelId()` 会剥掉尾部 `-expires-on-0910` 之类到期标记，否则内测 id 无法等效命中。

> **模态归一化**：`normalizeInput()` 把 models.dev 的 `['text','image','video',...]` 归为 `['text','image']`（含 image）否则 `['text']`。DSH 只支持 text/image，**不要**把 video/pdf/audio 当作 DSH 模态。

> **pi-ai 目录**：`loadPiAiCatalog()` 运行时读 `@earendil-works/pi-ai/dist/providers/data/*.json`（候选路径见 `piAiDataCandidates()`，读不到就降级为"只有清单条目"）。用于让 pi-ai 路由的"编辑现有模型"列出目录条目、并判定能否写 `modelOverrides`。

## 关键约定

- **跨 realm 写 settings**：静态 bundle 运行在宿主 sandbox realm，`settings.get` 拿到的是深冻结对象。写入必须用 `makeHostPlain`（`Object.create(null)` 递归重建）重建后再 `settings.replace(...)`，否则 dsh-settings 的 `isPlainObject` 检查会拒绝。参考 dsh-model-pro。
- **apply 补 api/baseURL**：目录/模板提供方的 profile 可能没显式 `api`/`baseURL`（继承 pi-ai 目录）。写入前用 `manifestProvider(route)` 兜底补齐，否则目录外的新模型（如 vision-exp）会因目录协议不统一而 `resolveRouteModels` 校验失败。
- **前端口径**：每页 80 行、结果 ≤200 才自动全选（海量防卡顿）、搜索 300ms 防抖。改这些常量在 `src/client/Page.tsx`（`PAGE_SIZE`/`AUTO_SELECT_LIMIT`）。
- **`api.ts` 不得顶层 import `node:fs`**：client 半区也会 import 本模块的纯函数，顶层 node 内置模块会污染浏览器 bundle。用 `await import('node:fs')`（`loadPiAiCatalog` 是 async）。

## 构建（务必注意）

`npm run build` = `node scripts/build.mjs`（host tsc 产出 `lib/` + client tsdown）；`npm run typecheck` = `node scripts/build.mjs --noEmit`；`npm run build:client` = `tsdown`；`npm run verify` = `node scripts/verify.mjs`（**host 回归测试**：命名空间识别 / 名字级匹配（内测模型号多模态）/ 双 schema 手动编辑往返，用假 settings 驱动已构建产物，不启动 DSH）。

> 改动 `api.ts` / `manifest.ts` 后**务必跑 `npm run build && npm run verify`**：`verify.mjs` 覆盖的就是最容易回归的两处（内测模型号必须拿到 image 模态；写入字段必须落在各自 schema 白名单内）。

> ✅ `scripts/build.mjs` **自动探测 tsc**：优先本地 `node_modules/typescript`，否则回退 DSH checkout 的 tsc（`$DSH_CHECKOUT` 或 `~/Documents/GitHub/deepseek-harness`）——**不再依赖 bash，也不需要本地 TypeScript**。

> ⚠️ **构建依赖必须指向"已构建"的包**，不能指向只有源码的 checkout。
> `scripts/build.sh` 用 `link_pkg` 把 `node_modules/cordis`、`node_modules/schemastery`、`node_modules/@deepseek-ai/dsh-*` 以 junction 关联到 `$CHECKOUT/vendor/*`（或 DSH 安装）。某些 checkout 的 `vendor/*` 是**源码版**（只有 `src/`、无 `lib/`），tsc/运行时会报 `Cannot find module 'cordis'` 或 `dsh-tools/lib/index.js missing`。
>
> **可靠做法**：把这些依赖 junction 指向 DSH 安装里已构建的包（例如
> `C:\Users\12042\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai\cordis|schemastery|dsh-tools|dsh-llm`），再 `node <checkout>/node_modules/typescript/bin/tsc -p tsconfig.json` 编译 host、`npm run build:client` 编译 client。`scripts/build.sh` 负责 junction 依赖链接与 DSH_CHECKOUT 探测（默认偏好 `~/Documents/GitHub/deepseek-harness`）。

## 目录结构

```
├── package.json        bundle 清单（dsh.bundle.patch / dsh.client / exports）
├── cordis.patch.yml    - insert: dsh-model-detector → 组合
├── src/
│   ├── index.ts        host：webServer API（providers/discover/current/save-model/remove-model/route-settings/apply）+ 状态工具
│   ├── api.ts          命名空间解析/双 schema 写入/发现合并/手动编辑；models.dev 缓存；pi-ai 目录读取
│   ├── manifest.ts     薄覆盖清单 + DeepSeek 官方目录（可扩展任意提供方）
│   └── client/         React 设置页（Page.tsx / styles.ts / react.ts / index.ts），发现 + 编辑两模式
├── scripts/build.mjs   跨平台构建/类型检查（自动探测 tsc，无需 bash/本地 TypeScript）
├── scripts/verify.mjs  host 回归测试（npm run verify，假 settings 驱动 lib/）
├── scripts/preview.mjs 布局预览（真实 CSS + 同构 DOM → .preview/layout-<mode>-<theme>.html；FRAME_WIDTH/MODE/THEME 可调）
└── scripts/build.sh    junction 依赖链接 + host tsc 构建（参考，build.mjs 的可选补充）
```

> 改前端布局后跑 `node scripts/preview.mjs`，再用无头浏览器截图自查
> （`msedge --headless --screenshot=out.png file:///.../layout.html`）；`FRAME_WIDTH=430` 可验证窄面板不重叠，
> `MODE=discover` 可看发现模式（两个按钮，最挤的一档），`THEME=dark` 出深色主题预览
> （脚本把 DSH checkout 的 `design-platform.css`/`base.css` 真实 token 内联，并给 `<body>` 加
> `data-ds-dark-theme`）。**改颜色必须两套主题各截一次图**。`.preview/` 已 gitignore。
>
> **主题/token 硬约束（深色适配踩过）**：
> 1. **只写 `var(--dsw-*)` + `color-mix()`，不写亮色字面量**。写了 `var(--token, #1f2328)` 这种 fallback，
>    token 名一旦拼错（例如并不存在的 `--dsw-alias-text-primary`）深色主题下就会静默渲染成近黑色文字，
>    在深色卡片上几乎不可见——整个"深色没适配"就是这么来的。DSH 官方设置页 CSS 顶部有同款告诫。
> 2. **`--dsw-alias-brand-primary` 是高对比前景色（亮≈近黑/深≈近白），不是蓝色**。蓝色强调用
>    `--dsw-alias-state-business-primary`（亮 deepseek-500 / 深 deepseek-400）；各状态"淡底"用
>    `--dsw-alias-{state-warn,state-success,state-business}-tertiary`，红色淡底用
>    `--dsw-alias-interactive-bg-hover-danger`，实心浅底用 `--dsw-alias-interactive-bg-hover-solid`。
> 3. **禁止 `var(--x)22` 这类拼接**：token 值可能是 `rgb(...)`，拼出来是非法的 `rgb(15, 17, 21)22`，
>    整条声明失效（`mc-chip-effort` 曾因此完全没有背景）。要半透明一律 `color-mix(in srgb, var(--x) 16%, transparent)`。
> 4. **原生控件靠 `color-scheme` 跟随主题**：`.mc-root` 写 `color-scheme: light`，
>    `body[data-ds-dark-theme] .mc-root` 写 `color-scheme: dark`——否则深色下 `<select>` 弹层会拿
>    深色底 + 亮色方案的文字色（option 不可读）、勾选框也停在亮色。**不要**用
>    `@media (prefers-color-scheme: dark)` 代替：DSH 的主题是 JS 切的，与系统偏好未必一致。
> 5. 绿底强调按钮（`.mc-btnAccent`）文字固定用 `--dsw-static-neutral-bluish-1000`：
>    绿色 500 明度居中，两套主题都配深色文字才够对比，`label-primary-foreground` 会随主题翻色。
>
> **布局硬约束（踩过）**：`.mc-row` 必须 `flex-wrap: wrap`，字段组 `.mc-field` 用 `flex: 0 1 auto`
> 且 `.mc-fieldLabel` 用 `flex: none`——否则窄面板下两个 `select` 会**重叠**（截图里踩过）。
> 卡片里的字段用 `.mc-fields` 网格（`auto-fit minmax(238px,1fr)`），标签列宽 `4.5em` 统一对齐。
>
> **两个必守规则**（否则按钮跑出容器右边界，都踩过）：
> 1. `.mc-btn` 必须 `flex: none; white-space: nowrap`——在 `nowrap` 行里参与收缩会把按钮挤出面板。
> 2. 任何可收缩的 flex 子项（`.mc-search`、`.mc-select`、`.mc-input`）必须 `min-width: 0`，
>    否则其内容最小宽度会把同行的按钮顶出去。
>
> 顶行 `.mc-rowTop` 是 `nowrap`：**主操作按钮必须与「提供方」选择器同行**，切换模式（按钮数量变化）
> 不允许换行——空间不足时由选择器收缩（省略号）让位，而不是把按钮挤到下一行。
> 顶行**不要放 `.mc-grow` 撑杆**：它会把按钮推到最右、在选择器与按钮之间留出一段死空
> （截图里被指过）。让 `.mc-rowTop .mc-select`（`width:176px; max-width:300px`）自己吸收剩余空间。

## 改动时注意

- **改名**：批量字符串替换即可（包名、`export const name`、`API_PREFIX`、client `name`/`id`/`STYLE_ID`、`cordis.patch.yml`、label、tool 名）。**不要用 `Move-Item` 移动整个目录**——它处理带 junction 的 node_modules 会破坏依赖链接，导致构建/运行时报错（我们踩过）。改完 `node <tsc> -p tsconfig.json` + `npm run build:client` + 重装 + 重启即可。
- **新增提供方 → manifest**：只改 `src/manifest.ts` 加一段 `MANIFEST[providerId]`；models.dev 若已收录则 manifest 无需覆盖。
- **宿主注入依赖**：`ctx.get('settings')` / `host.get('credentials')` 直接取；webServer 路由用 `ctx.webServer.register`。

## Git 提交规范（必读）

- **提交信息用中文**：`subject` 一律简体中文；`type` / `scope` 保留英文关键字。
- 遵守 **Conventional Commits**：`<type>(<scope>): <subject>`，例如
  - `feat(api): 增加 models.dev 全局回退`
  - `fix(client): 修复控制面板标签挤压`
  - `docs: 更新仓库结构说明`
  - `chore: 更新构建脚本`
- 常用 `type`：`feat` / `fix` / `docs` / `refactor` / `perf` / `test` / `build` / `chore`。
- `subject` 用中文、简短、祈使句（如「修复 XXX」「增加 XXX」）；破坏性变更加 `!` 或 `BREAKING CHANGE:` 说明。

## 发布（若新增发布)

- 发布前：`npm run typecheck`（host）+ `npm run build:client`（client）+ `npm run verify`（回归）务必通过。
- `npm pack` 打包发布包（`*.tgz` 已被 `.gitignore` 忽略）；`lib/` 亦被忽略，不上传源码仓库。

