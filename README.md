# dsh-model-detector

> 简体中文 · [English](#english-documentation)

> 为任意 **pi-ai 提供方**检测并同步其在线模型。
> Detect & sync online models for **any pi-ai provider**.

对选定的 pi-ai 提供方，拉取其**线上最新模型清单**（`GET /models`），并用 **models.dev 自动富化**正确的元数据（模态 `text/image`、上下文容量、输出上限、推理能力），最后把富化后的模型**写回该提供方**。你**不再需要手工维护任何模型清单**。

For a selected pi-ai provider, this plugin fetches the **latest online model list** (`GET /models`) and **auto-enriches** metadata (modality `text/image`, context window, output limit, reasoning) from **models.dev**, then **writes the enriched models back** to the provider. No more hand-maintained model catalogs.

```
模型 id（提供方 /models 实时拉取）  ──►  models.dev（社区权威能力源）  ──►  写入该提供方
Model ids (live from provider /models)  ──►  models.dev (authoritative community source)  ──►  written back to the provider
```

入口 / Entry：**设置 → 模型检测**（Settings → Model Detection）

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-0.0.1-green.svg)](package.json)

---

## 仓库简介 · About

> **中文**：为任意 pi-ai 提供方检测并同步其在线模型——拉取 `/models`，并用 models.dev 自动富化模态 / 上下文 / 推理后写回该提供方。
>
> **English**: A DSH plugin for any pi-ai provider — fetches its live `/models` and enriches modality / context / reasoning from models.dev, then writes them back.

---

## 效果预览 · Preview

![模型检测设置页 / Model Detection settings page](docs/preview.png)

*卡片式模型列表：每张卡注明「提供方使用的模型 id」与「models.dev 收录名」，并标注能力来源（models.dev / 清单 / 默认）。*
*Card-based list: each card shows the provider's model id, its models.dev name, and the capability source (models.dev / manifest / default).*

---

<a name="中文文档"></a>
# 中文文档

## 特性

- **实时拉取**：直接打提供方 `/models`，拿到线上最新模型 id，无视模板目录的滞后。
- **能力自动富化**：以 **models.dev** 为唯一权威能力源（上下文/输出/模态/推理），跨提供方回退，聚合网关亦可命中。
- **四级优先级**：当前提供方 models.dev → 全局 models.dev → 内置 manifest（薄覆盖）→ 保守默认。
- **卡片式交互**：分页 + 搜索防抖 + 勾选应用，海量模型不卡顿；每张卡清晰标注数据来源。
- **来源透明**：对「查得到 / 默认兜底」分别标注，models.dev 未收录时给出提示，不把默认当查得。

## 为什么做这个

DSH 原生对 pi-ai「模板（目录）提供方」的发现只回答**内置目录**（滞后，且可能缺失新模型）；对「自定义提供方」的发现只走线上 `/models`，**拿不到模态**（线上端点不声明模态）。两者都无法同时给出「**最新模型 + 正确模态**」。

本插件把这两件事拼起来：

```
线上 GET /models（最新 id）
    ↓ 合并
models.dev（自动、社区维护的模态/容量/推理）—— 主源
    ↓ 覆盖
内置 manifest（薄覆盖，仅兜底 models.dev 缺/错的个别模型）
    ↓ 兜底
保守默认（text + 262144 / 32768）
```

**模态归一化**：models.dev 可能标注 `video/pdf/audio` 等，而 DSH 只支持 `text/image`，插件归一为——含 `image` → `[text, image]`，否则 `[text]`。

**来源判定**：每个模型合并后标 `source`：

| source | 含义 |
|---|---|
| `models-dev` | 命中 models.dev（权威社区数据，含跨厂商回退） |
| `manifest` | 命中内置薄覆盖清单（dsh 专属字段 + 缺口） |
| `default` | 未收录，保守默认 |

## 安装

```sh
# 从 npm（若已发布）
dsh plugin --profile web add npm:dsh-model-detector

# 或从 GitHub 源
dsh plugin --profile web add github:<你的用户名>/dsh-model-detector

# 或本地链接（开发联调）
dsh plugin --profile web add link:C:\path\to\dsh-model-detector
```

安装后**重启 `dsh web`** 并刷新页面，设置页左侧出现「**模型检测**」。

## 使用

1. 打开 **设置 → 模型检测**。
2. **选择提供方**（下拉列出你已配置的所有 pi-ai 提供方，如 `opencode-go`、`tokenrhythm`、`volcengine`）。
3. 点「**获取最新模型**」——插件拉取该提供方 `/models`，用 models.dev 富化模态/容量/推理。
4. 在分页列表里**搜索或勾选**想要保留的模型（`vision`、`kimi`、`image` 等关键词可快速定位）。
5. 点「**应用所选**」——把富化后的模型写进该提供方的 `models` 列表（自动补齐缺失的 `api`/`baseURL`，使提供方自足）。

> 说明：插件会解析提供方的 `apiKeyEnv` 凭据去请求 `/models`（如 `volcengine` 需带 key，否则 401）。线上拉取失败时**只回退** models.dev / 内置清单，**绝不用该提供方的旧配置兜底**（本插件的目的是拿"线上"信息）。

## 性能特性

海量模型（有些网关提供上千模型）也不卡顿：

- **分页渲染**：每页 80 行 + 上一页/下一页 + 范围显示，DOM 只渲染一页。
- **搜索防抖**：已发现列表的搜索 300ms 防抖，不逐键重渲染大数组。
- **不自动全选海量结果**：结果 ≤200 才自动全选；更大则提示手动勾选，避免一次性勾选数千个。

## Host API

插件注册一个 `webServer` 前缀路由 `/dsh-model-detector/api`：

| 方法 | 路径 | 作用 |
|---|---|---|
| `GET` | `/providers` | 列出已配置的 pi-ai 提供方（route/displayName/api/baseURL/模型数） |
| `POST` | `/discover` | 拉取该提供方 `/models` + models.dev 富化 → 返回富化模型列表 |
| `POST` | `/apply` | 把所选模型写入 `llm-pi-ai.providers.<route>.models` |

`/discover` 响应还带诊断字段：`modelsDevLoaded` / `modelsDevProviders` / `modelsDevError` / `providerInModelsDev` / `sourceCounts`，便于区分来源，避免把「默认」误当「查得」。

此外提供一个只读 agent 工具 `_dsh_model_detector_status`（查询各提供方概览）。

## 配置

插件 `Config` 仅一个字段：

```yaml
# profile cordis.patch.yml 覆盖
- override:
    - id: dsh-model-detector
      config:
        title: 模型检测   # 设置页标题
```

## 仓库结构

```
├── package.json        bundle 清单（dsh.bundle.patch / dsh.client / exports）
├── cordis.patch.yml    bundle patch:把 host 行 dsh-model-detector 插入组合
├── docs/preview.png    设置页效果图
├── lib/                构建产物（host lib/index.js + client lib/client.js）
├── src/
│   ├── index.ts        host 入口：webServer API + 状态工具
│   ├── api.ts          host 业务：发现合并（models.dev/清单/默认 + source 判定）+ 应用写入
│   ├── manifest.ts     内置薄覆盖清单（可扩展任意提供方）
│   └── client/         React 设置页（DSH 设计语言）+ 样式
└── scripts/build.sh    host tsc 构建（DSH_CHECKOUT）
```

## 许可证

[MIT](LICENSE)

---

<a name="english-documentation"></a>
# English Documentation

## Features

- **Live fetch**: hits the provider `/models` directly for the latest model ids, ignoring stale template catalogs.
- **Auto-enriched capabilities**: **models.dev** is the single authoritative source (context / output / modality / reasoning), with cross-provider fallback so gateway aggregators match too.
- **Four-tier priority**: current-provider models.dev → global models.dev → built-in manifest (thin override) → conservative default.
- **Card-based UX**: pagination + debounced search + checkbox apply; handles hundreds of models smoothly; every card shows its data source.
- **Transparent provenance**: distinguishes "looked up" vs "default fallback"; warns when models.dev has no record — never presents a default as a real lookup.

## Why this plugin

DSH's native discovery for pi-ai **template (catalog) providers** only answers from the **catalog** (stale, possibly missing new models); for **custom providers** it only calls the live `/models`, so it **can't get modality** (the endpoint doesn't declare it). Neither gives both "**newest models + correct modality**" at once.

This plugin combines both:

```
Live GET /models (newest ids)
    ↓ merge
models.dev (community-maintained modality / capacity / reasoning) — primary
    ↓ override
Built-in manifest (thin override for models.dev gaps)
    ↓ fallback
Conservative default (text + 262144 / 32768)
```

**Modality normalization**: models.dev may list `video/pdf/audio`, but DSH supports only `text/image`. The plugin normalizes — contains `image` → `[text, image]`, else `[text]`.

**Source labeling**: every merged model is tagged with `source`:

| source | meaning |
|---|---|
| `models-dev` | matched in models.dev (authoritative community data, incl. cross-vendor fallback) |
| `manifest` | matched in the thin built-in manifest (dsh-specific fields + gaps) |
| `default` | not found; conservative default |

## Installation

```sh
# from npm (if published)
dsh plugin --profile web add npm:dsh-model-detector

# or from GitHub
dsh plugin --profile web add github:<username>/dsh-model-detector

# or local link (dev)
dsh plugin --profile web add link:C:\path\to\dsh-model-detector
```

After installing, **restart `dsh web`** and refresh the page; "模型检测" appears in the settings sidebar.

## Usage

1. Open **Settings → Model Detection**.
2. **Pick a provider** (the dropdown lists all configured pi-ai providers, e.g. `opencode-go`, `tokenrhythm`, `volcengine`).
3. Click **"Get latest models"** — the plugin fetches that provider's `/models` and enriches modality / capacity / reasoning from models.dev.
4. **Search or check** the models you want to keep (keywords like `vision`, `kimi`, `image` help filter).
5. Click **"Apply selected"** — writes the enriched models into that provider's `models` list (auto-filling missing `api`/`baseURL` so the provider is self-contained).

> Note: the plugin resolves the provider's `apiKeyEnv` credential to call `/models` (e.g. `volcengine` needs a key or you get 401). On fetch failure it **only falls back** to models.dev / the built-in manifest — it **never** uses the provider's stale config (the point is to get "live" info).

## Performance

Even with thousands of models (some gateways expose many), it stays smooth:

- **Paged rendering**: 80 rows/page + prev/next + range display; only one page is in the DOM.
- **Debounced search**: 300ms debounce on the discovered list; no per-key re-render of large arrays.
- **No auto-select of huge results**: auto-select only ≤200 results; larger sets prompt manual selection to avoid checking thousands at once.

## Host API

The plugin registers a `webServer` prefix route `/dsh-model-detector/api`:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/providers` | list configured pi-ai providers (route/displayName/api/baseURL/model count) |
| `POST` | `/discover` | fetch that provider's `/models` + models.dev enrichment → enriched model list |
| `POST` | `/apply` | write selected models into `llm-pi-ai.providers.<route>.models` |

`/discover` also returns diagnostics: `modelsDevLoaded` / `modelsDevProviders` / `modelsDevError` / `providerInModelsDev` / `sourceCounts`, so the UI can distinguish sources and never mistake a default for a lookup.

A read-only agent tool `_dsh_model_detector_status` is also exposed (overview per provider).

## Configuration

The plugin `Config` has a single field:

```yaml
# profile cordis.patch.yml override
- override:
    - id: dsh-model-detector
      config:
        title: Model Detection   # settings page title
```

## Repository structure

```
├── package.json        bundle manifest (dsh.bundle.patch / dsh.client / exports)
├── cordis.patch.yml    bundle patch: insert the dsh-model-detector host entry
├── docs/preview.png    settings page screenshot
├── lib/                build output (host lib/index.js + client lib/client.js)
├── src/
│   ├── index.ts        host entry: webServer API + status tool
│   ├── api.ts          host logic: discovery merge (models.dev/manifest/default + source) + apply
│   ├── manifest.ts     thin built-in manifest (extensible per provider)
│   └── client/         React settings page (DSH design language) + styles
└── scripts/build.sh    host tsc build (DSH_CHECKOUT)
```

## License

[MIT](LICENSE)
