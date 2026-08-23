# AGENTS.md — dsh-model-detector 开发指南

本文件面向**在此仓库上工作的 AI Agent / 开发者**。读完它再动手，避免踩我们踩过的坑。

## 定位（一句话）

> 为任意 pi-ai 提供方「**检测**其线上最新模型 + 用 models.dev 自动富化正确元数据（模态/容量/推理）+ 写入该提供方」——设置页插件。

**明确不是**：静态"模型目录/百科"（那是我们放弃的旧定位）；也不是手工维护清单（models.dev 是自动主源）。

## 架构（双半区）

- **Host 半区**：`src/index.ts`（入口）+ `src/api.ts`（业务）+ `src/manifest.ts`（薄覆盖清单）。
  - `inject = ['webServer', 'settings', 'tools']`，注册 webServer 前缀路由 `/dsh-model-detector/api`（`/providers`、`/discover`、`/apply`），外加只读工具 `_dsh_model_detector_status`。
- **Client 半区**：`src/client/`（React 设置页，`settings.section` slot）。
  - `inject = ['slots']`，注册 `settings.section`，label「模型检测」；样式走 **DSH 设计语言**（`--dsw-alias-*` token，capsule 按钮、发丝线卡片）。

## 数据流（核心）

```
/discover(route) →
  readProviders(st) 取该提供方；baseURL 兜底 manifestProvider(route).baseURL
  解析 apiKey：请求体 → 凭据服务 resolve(p.apiKeyEnv)
  fetchLiveModels(baseURL, apiKey)   # GET <baseURL>/models（线上最新 id）
  mergeDiscovered(route, ids, defaults, modelsDev)
    # 优先级：models.dev → manifest → 默认(text+262144/32768)
  // 线上失败只回退 models.dev/manifest，绝不回退该提供方旧配置
```

## 元数据来源（三级，切勿回到"人工逐模型维护"）

1. **models.dev**（`https://models.dev/api.json`，`loadModelsDev()` 缓存一次/会话，**主源**）——自动、覆盖几乎所有提供方、含模态/容量/推理。
2. **内置 manifest**（`src/manifest.ts`，薄覆盖层）——只兜底 models.dev 缺/错的个别模型（如 `hy3-preview`）；按提供方 keyed，可扩展。
3. **保守默认**：`text` + 262144/32768。

> **模态归一化**：`normalizeInput()` 把 models.dev 的 `['text','image','video',...]` 归为 `['text','image']`（含 image）否则 `['text']`。DSH 只支持 text/image，**不要**把 video/pdf/audio 当作 DSH 模态。

## 关键约定

- **跨 realm 写 settings**：静态 bundle 运行在宿主 sandbox realm，`settings.get` 拿到的是深冻结对象。写入必须用 `makeHostPlain`（`Object.create(null)` 递归重建）重建后再 `settings.replace('llm-pi-ai', ...)`，否则 dsh-settings 的 `isPlainObject` 检查会拒绝。参考 dsh-model-pro。
- **apply 补 api/baseURL**：目录/模板提供方的 profile 可能没显式 `api`/`baseURL`（继承 pi-ai 目录）。写入前用 `manifestProvider(route)` 兜底补齐，否则目录外的新模型（如 vision-exp）会因目录协议不统一而 `resolveRouteModels` 校验失败。
- **前端口径**：每页 80 行、结果 ≤200 才自动全选（海量防卡顿）、搜索 300ms 防抖。改这些常量在 `src/client/Page.tsx`（`PAGE_SIZE`/`AUTO_SELECT_LIMIT`）。

## 构建（务必注意）

`npm run build` = `node scripts/build.mjs`（host tsc 产出 `lib/` + client tsdown）；`npm run typecheck` = `node scripts/build.mjs --noEmit`；`npm run build:client` = `tsdown`。

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
│   ├── index.ts        host：webServer API（providers/discover/apply）+ 状态工具
│   ├── api.ts          发现合并/应用写入；models.dev 缓存；makeHostPlain；模态归一化
│   ├── manifest.ts     薄覆盖清单（可扩展任意提供方）
│   └── client/         React 设置页（Page.tsx / styles.ts / react.ts / index.ts）
├── scripts/build.mjs   跨平台构建/类型检查（自动探测 tsc，无需 bash/本地 TypeScript）
└── scripts/build.sh    junction 依赖链接 + host tsc 构建（参考，build.mjs 的可选补充）
```

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

- 发布前：`npm run typecheck`（host）+ `npm run build:client`（client）务必通过。
- `npm pack` 打包发布包（`*.tgz` 已被 `.gitignore` 忽略）；`lib/` 亦被忽略，不上传源码仓库。

