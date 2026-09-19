# dsh-model-detector

[简体中文](README.md) · **English**

[![npm version](https://img.shields.io/npm/v/dsh-model-detector)](https://www.npmjs.com/package/dsh-model-detector)
[![license](https://img.shields.io/npm/l/dsh-model-detector)](LICENSE)
[![downloads](https://img.shields.io/npm/dm/dsh-model-detector)](https://www.npmjs.com/package/dsh-model-detector)

![Model Detection settings page](docs/preview.png)

---

# English Documentation

## Overview

Detects the **latest online models** of any **pi-ai provider** (plus the **DeepSeek official API** route `deepseek-official`), **auto-enriches** correct metadata (modality `text/image`, context window, output limit, reasoning) from **models.dev**, writes them back, and lets you **edit existing model parameters by hand**. Entry: **Settings → Model Detection**.

## Features

- **Live fetch**: hits the provider `/models` directly for the latest model ids, ignoring stale template catalogs.
- **Auto-enriched capabilities**: **models.dev** is the single authoritative source (context / output / modality / reasoning), with cross-provider fallback so gateway aggregators match too.
- **Two write namespaces**: recognizes whether a provider belongs to `llm-pi-ai` (pi-ai adapter) or `llm-deepseek` (DeepSeek official API adapter) and writes each schema's own fields (`input` vs `inputModalities`).
- **Manual parameter editing**: edit any existing model — multimodal support, context, output cap, thinking levels, `compat` — or add a hand-typed model id. **A hand-typed id declares no modality**, so it is text-only until you tick "image" here.
- **Per-model thinking levels**: reads each model's own reasoning levels from models.dev `reasoning_options` and writes them as DSH `reasoningEfforts`. **Never a uniform set**; DeepSeek's official adapter is route-level (off/low/high/max) and the editor exposes it once.
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

**Name-level matching (key fix)**: a family often ships a text-only and a multimodal line (`deepseek-v4-flash` vs `deepseek-v4-flash-vision-exp`). Normalization strips trailing version/date/`-expires-on-0910` noise, so a hand-typed internal id such as `deepseek-v4.1-flash-expires-on-0910` is "version-equivalent" to both — **taking the first hit lands on the text-only entry**. The plugin instead **prefers the richer candidate (one that declares `image`)** among equivalents; an exact id hit still always wins. A family-level fallback covers ids the manifest does not know at all.

**Source labeling**: every merged model is tagged with `source`:

| source | meaning |
|---|---|
| `models-dev` | matched in models.dev (authoritative community data, incl. cross-vendor fallback) |
| `manifest` | matched in the thin built-in manifest (dsh-specific fields + gaps) |
| `default` | not found; conservative default |

## Installation

**Recommended: from the npm registry** (`npm:dsh-model-detector`)

```sh
dsh plugin --profile web add npm:dsh-model-detector
```

After installing, **restart `dsh web`** and refresh the page; "模型检测" appears in the settings sidebar.

> Other sources: GitHub `dsh plugin --profile web add github:1204244136/dsh-model-detector`, or local dev `dsh plugin --profile web add link:C:\path\to\dsh-model-detector`.

## Usage

### Mode 1 — discover new models

1. Open **Settings → Model Detection**.
2. **Pick a provider** (the dropdown lists every provider, including `deepseek-official` and pi-ai routes such as `opencode-go`, `volcengine`).
3. Click **"Get latest models"** — fetches that provider's `/models` and enriches modality / capacity / reasoning from models.dev.
4. **Search or check** the models you want to keep (keywords like `vision`, `kimi`, `image` help filter).
5. Click **"Apply selected"** — writes them into that provider (`llm-pi-ai.providers.<route>.models` for pi-ai; `llm-deepseek.models` for the DeepSeek official route).

> Note: the plugin resolves the provider's `apiKeyEnv` credential to call `/models` (`DEEPSEEK_API_KEY` for the official route). On fetch failure it **only falls back** to models.dev / the built-in manifest — it **never** uses the provider's stale config.

### Mode 2 — edit existing model parameters (multimodal / thinking)

Switch to **"Edit existing models"** → **"Read existing models"**. It lists the models the provider already serves (configured ones plus adapter-catalog defaults); each one is editable:

| Field | Notes |
|---|---|
| display name / context / output cap | plain numbers |
| **input modalities** (text / image) | **a hand-typed id is text-only by default** — tick "image" so the adapter accepts images |
| thinking levels (pi-ai) | per-level toggle + wire value (`off` = omit the parameter) |
| `compat` (pi-ai, advanced) | JSON, e.g. `{"thinkingFormat":"deepseek"}` |
| reasoning effort / thinking (DeepSeek official) | route-level, shared by all models |

- **"Adopt suggestion"** fills in the models.dev / manifest values.
- The top input adds **any model id by hand** (e.g. the internal `deepseek-v4.1-flash-expires-on-0910`).
- Saving touches only that model: a pi-ai catalog route without a `models` list writes `modelOverrides` (rest of the catalog keeps serving); otherwise it updates the `models` entry in place. Every other field and provider stays untouched.

> **Typical case**: `deepseek-v4.1-flash-expires-on-0910` is an internal model absent from the official `GET /models` and from models.dev, so it can only be typed by hand — and then the adapter sees no `inputModalities` and rejects every image (`UNSUPPORTED_CONTENT`). Tick "image" in this editor and save; the built-in manifest also lists that id (modality inferred from its family), so discovery carries modality if the endpoint ever reports it.

## Performance

- **Paged rendering**: 80 rows/page + prev/next + range display; only one page is in the DOM.
- **Debounced search**: 300ms debounce on the discovered list; no per-key re-render of large arrays.
- **No auto-select of huge results**: auto-select only ≤200 results; larger sets prompt manual selection.

## Host API

The plugin registers a `webServer` prefix route `/dsh-model-detector/api`:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/providers` | list detectable providers (route/displayName/api/baseURL/model count/`ns`) |
| `POST` | `/discover` | fetch that provider's `/models` + models.dev enrichment → unified-shape models |
| `POST` | `/current` | list the provider's **existing** models (profile + adapter catalog) + models.dev/manifest suggestions |
| `POST` | `/save-model` | write one model's parameters (keeps other fields; picks `models` or `modelOverrides`) |
| `POST` | `/remove-model` | delete one model (`models` entry or `modelOverrides` entry) |
| `POST` | `/route-settings` | write DeepSeek official route-level settings (`reasoningEffort` / `thinking`) |
| `POST` | `/apply` | write the selected models into the provider |

`/discover` also returns diagnostics: `modelsDevLoaded` / `modelsDevProviders` / `modelsDevError` / `providerInModelsDev` / `sourceCounts`, plus `ns` / `target`.

A read-only agent tool `_dsh_model_detector_status` is also exposed (overview per provider).

## Two model schemas (write targets)

| | `llm-pi-ai` (pi-ai adapter) | `llm-deepseek` (DeepSeek official API) |
|---|---|---|
| Route | any, e.g. `opencode-go`, `deepseek` | `deepseek-official` |
| Model fields | `id/name/contextWindow/maxTokens/input/reasoningEfforts/compat` | `id/name/description/contextWindow/maxTokens/inputModalities/imagePixelBudget/imageMaxBytes` |
| Modality key | `input: ['text','image']` | `inputModalities: ['text','image']` (`min(1)`; empty is invalid) |
| Thinking levels | **per model** `reasoningEfforts` | **route-level** `reasoningEffort` (off/low/high/max) |
| Catalog override | `modelOverrides[id]` (when no `models` list) | none (only the `models` list) |

> The DeepSeek adapter hard-checks `models.find(id)?.inputModalities?.includes('image') !== true` on image input and throws `UNSUPPORTED_CONTENT`. **No `inputModalities` means text-only** — the root cause of "a hand-typed model id does not support multimodal".

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
│   ├── index.ts        host entry: webServer API (7 endpoints) + status tool
│   ├── api.ts          host logic: namespace resolution / discovery merge / dual-schema writes / manual editing
│   ├── manifest.ts     thin built-in manifest + DeepSeek official catalog (extensible per provider)
│   └── client/         React settings page (discover + edit modes, DSH design language) + styles
└── scripts/build.mjs   cross-platform build/typecheck (auto-detects tsc; no bash needed)
```

## License

[MIT](LICENSE)
