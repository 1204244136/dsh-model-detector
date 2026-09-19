# dsh-model-detector

**简体中文** · [English](README_en.md)

[![npm version](https://img.shields.io/npm/v/dsh-model-detector)](https://www.npmjs.com/package/dsh-model-detector)
[![license](https://img.shields.io/npm/l/dsh-model-detector)](LICENSE)
[![downloads](https://img.shields.io/npm/dm/dsh-model-detector)](https://www.npmjs.com/package/dsh-model-detector)

![模型检测设置页](docs/preview.png)

---

# 中文文档

## 定位

为任意 **pi-ai 提供方**（以及 **DeepSeek 官方 API** 路由 `deepseek-official`）检测其线上最新模型，用 **models.dev** 自动富化正确元数据（模态 `text/image`、上下文容量、输出上限、推理能力）后写回，并提供**手动编辑现有模型参数**的能力。入口：**设置 → 模型检测**。

## 特性

- **实时拉取**：直接打提供方 `/models`，拿到线上最新模型 id，无视模板目录的滞后。
- **能力自动富化**：以 **models.dev** 为唯一权威能力源（上下文 / 输出 / 模态 / 推理），跨提供方回退，聚合网关亦可命中。
- **双命名空间写入**：自动识别提供方属于 `llm-pi-ai`（pi-ai 适配器）还是 `llm-deepseek`（DeepSeek 官方 API 内置适配器），按各自 schema 写入正确字段（`input` vs `inputModalities`）。
- **手动编辑现有模型**：逐条改参数——是否支持多模态、上下文、输出上限、思考档位、`compat`；也可手填模型号新增。**手填的模型号默认没有模态声明**，在这里勾上「图像」即可让适配器接受图片。
- **思考档位按模型富化**：从 models.dev `reasoning_options` 读取每个模型自己的推理等级（如 Muse Spark → Minimal/Low/Medium/High/Xhigh、Qwen3.8 Flash → Low/Medium/Xhigh、Kimi K3 → Max），翻译成 DSH 的 `reasoningEfforts` 写回，让第三方模型在 DSH 中可设置思考强度。**绝不套用统一档位**；纯开关/无档位模型不写，交给 pi-ai 目录兜底。DeepSeek 官方适配器的档位是**路由级**（off/low/high/max），插件在编辑页提供统一开关。
- **四级优先级**：当前提供方 models.dev → 全局 models.dev → 内置 manifest（薄覆盖）→ 保守默认。
- **卡片式交互**：分页 + 搜索防抖 + 勾选应用，海量模型不卡顿；每张卡清晰标注数据来源与推理档位。
- **来源透明**：区分「查得到」与「默认兜底」，models.dev 未收录时给出提示，不把默认当查得。
- **同名变体可分辨**：网关常把同一模型按区域挂成多条 id（`cn:deepseek-v4.1-flash`、`global:deepseek-v4.1-flash`），富化后**收录名完全一样**，选择器里两条一模一样。插件在「仅前缀不同且同时出现」时把前缀补进展示名（`cn:DeepSeek V4.1 Flash` / `global:DeepSeek V4.1 Flash`）；前缀也分不开时（同前缀、仅区域后缀不同）退回原始 id，**保证展示名唯一**。模型 `id` 一字不动，路由不受影响。

## 为什么做这个

DSH 原生对 pi-ai「模板（目录）提供方」的发现只回答**内置目录**（滞后，且可能缺失新模型）；对「自定义提供方」只走线上 `/models`，**拿不到模态**（线上端点不声明模态）。两者都无法同时给出「**最新模型 + 正确模态**」。

本插件把这两件事拼起来：

```
线上 GET /models（最新 id）
    ↓ 合并
models.dev（自动、社区维护的模态/容量/推理/思考档位）—— 主源
    ↓ 覆盖
内置 manifest（薄覆盖，仅兜底 models.dev 缺/错的个别模型；thinkingLevelMap 人工档位优先）
    ↓ 兜底
保守默认（text + 262144 / 32768）
```

**模态归一化**：models.dev 可能标注 `video/pdf/audio`，而 DSH 只支持 `text/image`，插件归一为——含 `image` → `[text, image]`，否则 `[text]`。

**名字级匹配（关键修复）**：同一系列常有纯文本与多模态两条线（`deepseek-v4-flash` vs `deepseek-v4-flash-vision-exp`）。归一化会剥掉尾部版本/日期/`-expires-on-0910` 之类的噪声段，因此手填的内测模型号 `deepseek-v4.1-flash-expires-on-0910` 与两者都「版本级等效」——**取第一个命中会落到纯文本条目**。插件改为在等效候选里**优先能力更丰富者（含 image）**，精确同名命中仍永远优先。另有家族级兜底：清单里完全没有该模型号时，若同族条目声明了 image 则继承模态。

**思考档位 → DSH reasoningEfforts**：DSH 对模型的思考强度由 profile 层的 `reasoningEfforts`（档位 → wire 值）驱动，菜单只显示适配器公布的档位。插件从 models.dev `reasoning_options` 读取每个模型声明的档位（wire 值 = 档位名，`none` → `off`），manifest 的人工 `thinkingLevelMap` 优先（如 deepseek 的 `{high, max}` + `compat.thinkingFormat: deepseek`）。只有档位声明（非纯开关）才写，且只保留 pi-ai 词汇表（off/minimal/low/medium/high/xhigh/max）内的档位，避免 DSH 校验拒绝整个提供方。

**同名变体的展示名消歧**：归一化匹配必须剥掉区域前缀（`cn:` / `global:`），否则富化率 0%；但**展示名不能跟着剥**——`cn:deepseek-v4.1-flash` 与 `global:deepseek-v4.1-flash` 富化后都会得到同一个收录名，写进 DSH 后模型选择器里两条一模一样，用户无法判断该选哪个区域。插件因此在「**仅前缀不同 + 同时出现**」时把前缀补进展示名；若前缀仍不足以区分（同前缀、差别只在被归一掉的区域后缀如 `-sg`），则退回原始 id——**展示名唯一是硬保证**，`id` 始终一字不动。

**来源判定**：每个模型合并后标 `source`：
| source | 含义 |
|---|---|
| `models-dev` | 命中 models.dev（权威社区数据，含跨厂商回退） |
| `manifest` | 命中内置薄覆盖清单（dsh 专属字段 + 缺口） |
| `default` | 未收录，保守默认 |

## 安装

**推荐：从 npm registry 安装**（`npm:dsh-model-detector`）

```sh
dsh plugin --profile web add npm:dsh-model-detector
```

安装后**重启 `dsh web`** 并刷新页面，设置页左侧出现「**模型检测**」。

> 其它来源：GitHub 源 `dsh plugin --profile web add github:1204244136/dsh-model-detector`，或本地联调 `dsh plugin --profile web add link:C:\path\to\dsh-model-detector`。

## 使用

### 模式一：发现新模型

1. 打开 **设置 → 模型检测**。
2. **选择提供方**（下拉列出你已配置的所有提供方，含 `deepseek-official`（官方 API）与各 pi-ai 路由如 `opencode-go`、`volcengine`）。
3. 点「**获取最新模型**」——插件拉取该提供方 `/models`，用 models.dev 富化模态 / 容量 / 推理。
4. 在分页列表里**搜索或勾选**想要保留的模型（`vision`、`kimi`、`image` 等关键词可快速定位）。
5. 点「**应用所选**」——把富化后的模型写进该提供方（pi-ai 写 `llm-pi-ai.providers.<route>.models`；DeepSeek 官方写 `llm-deepseek.models`）。

> 说明：插件会解析提供方的 `apiKeyEnv` 凭据去请求 `/models`（DeepSeek 官方路由默认 `DEEPSEEK_API_KEY`；线上拉取失败时**只回退** models.dev / 内置清单，**绝不用该提供方的旧配置兜底**（本插件的目的是拿"线上"信息）。

### 模式二：编辑现有模型参数（多模态 / 思考档位）

切到「**编辑现有模型**」→ 点「**读取现有模型**」，列出该提供方**现有**模型（profile 已配置的 + 适配器默认目录的），每条可改：

| 字段 | 说明 |
|---|---|
| 展示名 / 上下文 / 输出上限 | 直接填数字 |
| **输入模态**（文本 / 图像） | **手填的模型号默认纯文本**——勾上「图像」适配器才接受图片 |
| 思考档位（pi-ai） | 逐档开关 + wire 值（`off` 表示不传参数） |
| `compat`（pi-ai，高级） | JSON 编辑，如 `{"thinkingFormat":"deepseek"}` |
| 推理档位 / thinking（DeepSeek 官方） | 路由级设置，所有模型共用 |

- 「**采纳建议**」按钮用 models.dev / 清单的建议值回填。
- 顶部输入框可**手填任意模型号**新增（例如内测模型 `deepseek-v4.1-flash-expires-on-0910`）。
- 保存只改这一条：pi-ai 目录路由在无 `models` 列表时写 `modelOverrides`（只覆盖该模型，目录其余照常服务）；否则就地更新 `models` 条目。其余字段与其它提供方配置原样保留。

> **典型场景**：`deepseek-v4.1-flash-expires-on-0910` 是内测模型，官方 `GET /models` 与 models.dev 都未收录，只能在界面手填模型号——此时适配器看不到 `inputModalities`，图片一律被拒（`UNSUPPORTED_CONTENT`）。用本插件「编辑现有模型」勾上「图像」保存即可；插件清单也已内置该模型号（模态按同族推断为 text+image），点「获取最新模型」时若线上返回它也会自动带上模态。

## 性能特性

- **分页渲染**：每页 80 行 + 上一页 / 下一页 + 范围显示，DOM 只渲染一页。
- **搜索防抖**：已发现列表的搜索 300ms 防抖，不逐键重渲染大数组。
- **不自动全选海量结果**：结果 ≤200 才自动全选；更大则提示手动勾选。

## Host API

插件注册 `webServer` 前缀路由 `/dsh-model-detector/api`：

| 方法 | 路径 | 作用 |
|---|---|---|
| `GET` | `/providers` | 列出可检测提供方（route/displayName/api/baseURL/模型数/`ns`） |
| `POST` | `/discover` | 拉取该提供方 `/models` + models.dev 富化 → 统一形状模型列表 |
| `POST` | `/current` | 列出该提供方**现有**模型（profile + 适配器目录）+ models.dev/清单建议值 |
| `POST` | `/save-model` | 写入单条模型参数（保留其它字段；自动选 `models` / `modelOverrides`） |
| `POST` | `/remove-model` | 删除单条模型（`models` 条目或 `modelOverrides` 条目） |
| `POST` | `/route-settings` | 写入 DeepSeek 官方路由级设置（`reasoningEffort` / `thinking`） |
| `POST` | `/apply` | 批量把所选模型写入该提供方 |

`/discover` 响应还带诊断字段：`modelsDevLoaded` / `modelsDevProviders` / `modelsDevError` / `providerInModelsDev` / `sourceCounts`，以及 `ns` / `target`（写入目标），便于区分来源，避免把「默认」误当「查得」。

此外提供一个只读 agent 工具 `_dsh_model_detector_status`（查询各提供方概览）。

## 两套模型 schema（写入目标）

| | `llm-pi-ai`（pi-ai 适配器） | `llm-deepseek`（DeepSeek 官方 API） |
|---|---|---|
| 路由 | 任意，如 `opencode-go`、`deepseek` | `deepseek-official` |
| 模型字段 | `id/name/contextWindow/maxTokens/input/reasoningEfforts/compat` | `id/name/description/contextWindow/maxTokens/inputModalities/imagePixelBudget/imageMaxBytes` |
| 模态键 | `input: ['text','image']` | `inputModalities: ['text','image']`（`min(1)`，空数组非法） |
| 推理档位 | **模型级** `reasoningEfforts` | **路由级** `reasoningEffort`（off/low/high/max） |
| 目录覆盖 | `modelOverrides[id]`（无 `models` 列表时） | 无（只能写 `models` 列表） |

> DeepSeek 官方适配器在收到图片时硬判定 `models.find(id)?.inputModalities?.includes('image') !== true` → 抛 `UNSUPPORTED_CONTENT`。**没写 `inputModalities` 就等于纯文本**——这是"手填模型号不支持多模态"的根因。

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
│   ├── index.ts        host 入口：webServer API（7 个接口）+ 状态工具
│   ├── api.ts          host 业务：命名空间解析 / 发现合并 / 双 schema 写入 / 手动编辑
│   ├── manifest.ts     内置薄覆盖清单 + DeepSeek 官方目录（可扩展任意提供方）
│   └── client/         React 设置页（发现 / 编辑两种模式，DSH 设计语言）+ 样式
└── scripts/build.mjs   跨平台构建/类型检查（自动探测 tsc，无需 bash/本地 TypeScript）
```

## 许可证

[MIT](LICENSE)
