# dsh-model-detector

[简体中文](README.md) · **English**

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![version](https://img.shields.io/badge/version-0.0.1-green.svg)](package.json)

![Model Detection settings page](docs/preview.png)

---

# English Documentation

## Overview

Detects the **latest online models** of any **pi-ai provider** and **auto-enriches** correct metadata (modality `text/image`, context window, output limit, reasoning) from **models.dev**, then **writes them back** to the provider. Entry: **Settings → Model Detection**.

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

**Recommended: from the npm registry** (`npm:dsh-model-detector`)

```sh
dsh plugin --profile web add npm:dsh-model-detector
```

After installing, **restart `dsh web`** and refresh the page; "模型检测" appears in the settings sidebar.

> Other sources: GitHub `dsh plugin --profile web add github:1204244136/dsh-model-detector`, or local dev `dsh plugin --profile web add link:C:\path\to\dsh-model-detector`.

## Usage

1. Open **Settings → Model Detection**.
2. **Pick a provider** (the dropdown lists all configured pi-ai providers, e.g. `opencode-go`, `tokenrhythm`, `volcengine`).
3. Click **"Get latest models"** — the plugin fetches that provider's `/models` and enriches modality / capacity / reasoning from models.dev.
4. **Search or check** the models you want to keep (keywords like `vision`, `kimi`, `image` help filter).
5. Click **"Apply selected"** — writes the enriched models into that provider's `models` list (auto-filling missing `api` / `baseURL` so the provider is self-contained).

> Note: the plugin resolves the provider's `apiKeyEnv` credential to call `/models` (e.g. `volcengine` needs a key or you get 401). On fetch failure it **only falls back** to models.dev / the built-in manifest — it **never** uses the provider's stale config (the point is to get "live" info).

## Performance

- **Paged rendering**: 80 rows/page + prev/next + range display; only one page is in the DOM.
- **Debounced search**: 300ms debounce on the discovered list; no per-key re-render of large arrays.
- **No auto-select of huge results**: auto-select only ≤200 results; larger sets prompt manual selection.

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
