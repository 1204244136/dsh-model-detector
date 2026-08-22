# dsh-model-detector

> DSH（DeepSeek Harness）插件：**为任意 pi-ai 提供方检测并同步其在线模型**。

对选定的 pi-ai 提供方，拉取其**线上最新模型清单**（`GET /models`），并用 **models.dev 自动富化**正确的元数据（模态 text/image、上下文容量、输出上限、推理能力），最后把富化后的模型**写入该提供方**。你不再需要手工维护任何模型清单。

设置页入口：**设置 → 模型检测**。

---

## 为什么做这个

DSH 原生对 pi-ai「模板（目录）提供方」的发现只回答**内置目录**（滞后，且可能缺失新模型，如 `deepseek-v4-flash-vision-exp`）；而对「自定义提供方」的发现只走线上 `/models`，**拿不到模态**（线上端点不声明模态）。两者都无法同时给出「**最新模型 + 正确模态**」。

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

---

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

---

## 使用

1. 打开 **设置 → 模型检测**。
2. **选择提供方**（下拉列出你已配置的所有 pi-ai 提供方，如 `opencode-go`、`tokenrhythm`、`volcengine`）。
3. 点「**获取最新模型**」——插件拉取该提供方 `/models`，用 models.dev 富化模态/容量/推理。
4. 在分页列表里**搜索或勾选**想要保留的模型（`vision`、`kimi`、`image` 等关键词可快速定位）。
5. 点「**应用所选**」——把富化后的模型写进该提供方的 `models` 列表（自动补齐缺失的 `api`/`baseURL`，使提供方自足）。

> 说明：插件会解析提供方的 `apiKeyEnv` 凭据去请求 `/models`（如 `volcengine` 需带 key，否则 401）。线上拉取失败时**只回退** models.dev / 内置清单，**绝不用该提供方的旧配置兜底**（本插件的目的是拿"线上"信息）。

---

## 性能特性

海量模型（有些网关提供上千模型）也不卡顿：

- **分页渲染**：每页 80 行 + 上一页/下一页 + 范围显示，DOM 只渲染一页。
- **搜索防抖**：已发现列表的搜索 300ms 防抖，不逐键重渲染大数组。
- **不自动全选海量结果**：结果 ≤200 才自动全选；更大则提示手动勾选，避免一次性勾选数千个。

---

## Host API

插件注册一个 `webServer` 前缀路由 `/dsh-model-detector/api`：

| 方法 | 路径 | 作用 |
|---|---|---|
| `GET` | `/providers` | 列出已配置的 pi-ai 提供方（route/displayName/api/baseURL/模型数） |
| `POST` | `/discover` | 拉取该提供方 `/models` + models.dev 富化 → 返回富化模型列表 |
| `POST` | `/apply` | 把所选模型写入 `llm-pi-ai.providers.<route>.models` |

此外提供一个只读 agent 工具 `_dsh_model_detector_status`（查询各提供方概览）。

---

## 配置

插件 `Config` 仅一个字段：

```yaml
# profile cordis.patch.yml 覆盖
- override:
    - id: dsh-model-detector
      config:
        title: 模型检测   # 设置页标题
```

---

## 仓库结构

```
├── package.json        bundle 清单（dsh.bundle.patch / dsh.client / exports）
├── cordis.patch.yml    bundle patch:把 host 行 dsh-model-detector 插入组合
├── lib/                构建产物（host lib/index.js + client lib/client.js）
├── src/
│   ├── index.ts        host 入口：webServer API + 状态工具
│   ├── api.ts          host 业务：发现合并（models.dev/清单/默认 三级）+ 应用写入
│   ├── manifest.ts     内置薄覆盖清单（可扩展任意提供方）
│   └── client/         React 设置页（DSH 设计语言）+ 样式
└── scripts/build.sh    host tsc 构建（DSH_CHECKOUT）
```

## License

BSD-3-Clause
