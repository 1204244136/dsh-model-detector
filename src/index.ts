/**
 * dsh-model-detector — 设置页形态（dev_scaffold_plugin 生成，改造）。
 * host 侧：webServer API
 *   GET  /api/providers      已配置提供方（含命名空间/目标）
 *   POST /api/discover       线上 GET /models + models.dev 富化（统一形状）
 *   POST /api/current        列出某提供方现有模型（可手动编辑）+ 建议值
 *   POST /api/save-model     写入单条模型参数（保留其它字段）
 *   POST /api/remove-model   删除单条模型
 *   POST /api/route-settings 写入路由级设置（DeepSeek 推理档位 / thinking 开关）
 *   POST /api/apply          批量写入发现结果
 * client 侧：settings.section 设置页（React）。
 */
import type { Context } from 'cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from 'schemastery'
import {
  listConfiguredProviders, readJsonBody, subPath, fetchLiveModels, mergeDiscovered,
  loadModelsDev, modelsDevStatus, applyModels, readProviders, currentModels, writeModel,
  removeModel, writeRouteReasoning, resolveTarget, toTargetModel, routeReasoningLevels,
  type HostCtx,
} from './api.js'
import { manifestProvider } from './manifest.js'

export const name = 'dsh-model-detector'
export const inject = ['webServer', 'settings', 'tools']

export interface Config {
  title: string
}

export const Config = z.object({
  title: z.string().default('模型检测'),
})

const API_PREFIX = '/dsh-model-detector/api'

const h = (ctx: Context) => ctx as any as HostCtx

function json(res: any, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

export function apply(ctx: Context, config: Config): void {
  const host = h(ctx)
  const st = host.get('settings')
  const webServer = (ctx as any).webServer
  const tools = (ctx as any).tools

  ctx.effect(() => webServer.register({
    kind: 'prefix',
    path: API_PREFIX,
    handler: async (req: any, res: any) => {
      try {
        const path = subPath(req, API_PREFIX)
        if (req.method === 'GET' && path === 'providers') {
          return json(res, 200, { ok: true, providers: listConfiguredProviders(st) })
        }

        // ── 发现：线上 GET /models + models.dev/清单富化（统一形状）───────────
        if (req.method === 'POST' && path === 'discover') {
          const body = (await readJsonBody(req)) as any
          const route = typeof body?.route === 'string' ? body.route : ''
          if (!route) return json(res, 400, { ok: false, error: '缺少 route' })
          const target = resolveTarget(route, st)
          const p = target?.profile
          const mp = manifestProvider(route)
          const baseURL = typeof body?.baseURL === 'string' && body.baseURL
            ? body.baseURL
            : (target?.baseURL || p?.baseURL || mp?.baseURL || '')
          // apiKey：优先请求体；否则解析凭据服务里的 apiKeyEnv
          let apiKey = typeof body?.apiKey === 'string' ? body.apiKey : ''
          if (!apiKey) {
            const env = (typeof p?.apiKeyEnv === 'string' && p.apiKeyEnv) || target?.apiKeyEnv || ''
            const creds = host.get('credentials') as any
            if (env && creds && typeof creds.resolve === 'function') {
              try { const hit = await creds.resolve(env); if (hit?.value) apiKey = hit.value } catch { /* 忽略 */ }
            }
          }
          if (!baseURL) return json(res, 400, { ok: false, error: '缺少 baseURL' })
          const defaults = {
            api: p?.api || mp?.api,
            baseURL,
            contextWindow: p?.defaultContextWindow,
            maxTokens: p?.defaultMaxTokens,
            input: p?.defaultInput,
          }
          const modelsDev = await loadModelsDev()
          const mdDiag = modelsDevStatus()
          if (mdDiag.error) host.logger.warn('dsh-model-detector: models.dev 加载失败:', mdDiag.error)
          const sourceCounts = (list: Array<Record<string, unknown>>) => {
            const counts: Record<string, number> = {}
            for (const m of list) {
              const s = String((m as any)?.source ?? 'default')
              counts[s] = (counts[s] || 0) + 1
            }
            return counts
          }
          /** 统一发现形状 → 目标命名空间的模型形状（deepseek 用 inputModalities）。 */
          const shape = (list: Array<Record<string, unknown>>) =>
            target ? list.map((m) => toTargetModel(target.ns, m)) : list
          try {
            // 线上清单里端点自声明的元数据（容量/输出上限/模态/档位）一并带进合并：
            // 它是端点自己的能力陈述，优先级高于 models.dev 的第三方快照。
            const live = await fetchLiveModels(baseURL, apiKey)
            const merged = mergeDiscovered(route, live, defaults, modelsDev)
            return json(res, 200, {
              ok: true, models: shape(merged), raw: merged, source: 'live+models.dev', fromManifestOnly: false,
              route, ns: target?.ns ?? 'llm-pi-ai', target: target?.ns === 'llm-deepseek' ? 'deepseek' : 'pi-ai',
              modelsDevLoaded: mdDiag.loaded, modelsDevProviders: mdDiag.providers,
              modelsDevError: mdDiag.error, providerInModelsDev: !!modelsDev?.[route],
              sourceCounts: sourceCounts(merged),
            })
          } catch (e: any) {
            // 线上拉取失败：只回退 models.dev / 内置清单（插件的目的是拿"线上"信息，
            // 不用提供方旧配置兜底）。两者都没有 → 0 模型 + 明确提示。
            const mdIds = modelsDev?.[route]?.models ? Object.keys(modelsDev[route].models) : []
            const mpIds = mp ? Object.keys(mp.models) : []
            const ids = mdIds.length > 0 ? mdIds : mpIds
            const reason = String(e?.message ?? e)
            // 回退只认「同名 provider 键」：models.dev 里没有该路由、内置清单也没有条目时，
            // 就没有任何 id 可用（全局名字级回退只能在**已有 id 列表**上逐条匹配，不能凭空
            // 造出模型号）。此时必须把原因说清楚，否则前端只显示"获取到 0 个模型"。
            const warn = ids.length === 0
              ? `${reason}；models.dev 未收录提供方「${route}」、内置清单也没有它的模型，无法离线兜底。请检查该路由的 baseURL / 协议（Anthropic 协议路由的模型清单通常在 /v1/models）`
              : `${reason}；已回退 models.dev / 内置清单（${ids.length} 条），能力元数据可能滞后`
            const fallbackMerged = mergeDiscovered(route, ids, defaults, modelsDev)
            return json(res, 200, {
              ok: true, models: shape(fallbackMerged), raw: fallbackMerged,
              source: 'fallback', fromManifestOnly: ids.length > 0, warn,
              route, ns: target?.ns ?? 'llm-pi-ai', target: target?.ns === 'llm-deepseek' ? 'deepseek' : 'pi-ai',
              modelsDevLoaded: mdDiag.loaded, modelsDevProviders: mdDiag.providers,
              modelsDevError: mdDiag.error, providerInModelsDev: !!modelsDev?.[route],
              sourceCounts: sourceCounts(fallbackMerged),
            })
          }
        }

        // ── 现有模型（手动编辑）──────────────────────────────────────────────
        if (req.method === 'POST' && path === 'current') {
          const body = (await readJsonBody(req)) as any
          const route = typeof body?.route === 'string' ? body.route : ''
          if (!route) return json(res, 400, { ok: false, error: '缺少 route' })
          const modelsDev = await loadModelsDev()
          // 顺带拉一次线上清单，把端点自声明喂给建议值（编辑页此前只看 models.dev，
          // 会把 maxTokens 建议成比端点真实上限更大的值 —— 点「采纳」就写坏）。
          // 尽力而为：任何失败都退回旧行为，不影响编辑页可用性。
          const target0 = resolveTarget(route, st)
          const p0 = target0?.profile
          let declared: Awaited<ReturnType<typeof fetchLiveModels>> | undefined
          let declaredWarn: string | undefined
          const baseURL0 = target0?.baseURL || (typeof p0?.baseURL === 'string' ? p0.baseURL : '')
          if (baseURL0) {
            let apiKey0 = ''
            const env0 = (typeof p0?.apiKeyEnv === 'string' && p0.apiKeyEnv) || target0?.apiKeyEnv || ''
            const creds0 = host.get('credentials') as any
            if (env0 && creds0 && typeof creds0.resolve === 'function') {
              try { const hit = await creds0.resolve(env0); if (hit?.value) apiKey0 = hit.value } catch { /* 忽略 */ }
            }
            // 编辑页的声明是"锦上添花"，用更短的超时（3.5s）：拉不到就退回 models.dev，
            // 不能让本地代理挂住时把「读取现有模型」一起拖死。
            try { declared = await fetchLiveModels(baseURL0, apiKey0, 3500) } catch (e: any) {
              declaredWarn = String(e?.message ?? e)
            }
          }
          const r = await currentModels(st, route, modelsDev, declared)
          if (r.target === undefined) return json(res, 400, { ok: false, error: `未找到提供方 ${route}` })
          return json(res, 200, {
            ok: true,
            route,
            ns: r.target.ns,
            target: r.target.ns === 'llm-deepseek' ? 'deepseek' : 'pi-ai',
            hasModelsList: r.target.hasModelsList,
            baseURL: r.target.baseURL,
            apiKeyEnv: r.target.apiKeyEnv,
            reasoningLevels: routeReasoningLevels(r.target.ns),
            ...(r.reasoningEffort !== undefined ? { reasoningEffort: r.reasoningEffort, thinking: r.thinking } : {}),
            models: r.models,
            declaredCount: declared?.length ?? 0,
            ...(declaredWarn !== undefined ? { declaredWarn } : {}),
            writable: st?.writable !== false,
          })
        }

        // ── 写入单条模型参数 ────────────────────────────────────────────────
        if (req.method === 'POST' && path === 'save-model') {
          const body = (await readJsonBody(req)) as any
          const route = typeof body?.route === 'string' ? body.route : ''
          const model = body?.model
          if (!route) return json(res, 400, { ok: false, error: '缺少 route' })
          if (!model || typeof model !== 'object' || Array.isArray(model)) return json(res, 400, { ok: false, error: 'model 必须是对象' })
          if (st === undefined) return json(res, 400, { ok: false, error: 'settings 服务不可用' })
          if (st.writable === false) return json(res, 400, { ok: false, error: '设置只读' })
          try {
            const r = await writeModel(st, route, model as Record<string, unknown>)
            return json(res, 200, { ok: true, route, ns: r.ns, key: r.key, id: (model as any).id })
          } catch (e: any) {
            return json(res, 400, { ok: false, error: String(e?.message ?? e) })
          }
        }

        // ── 删除单条模型 ────────────────────────────────────────────────────
        if (req.method === 'POST' && path === 'remove-model') {
          const body = (await readJsonBody(req)) as any
          const route = typeof body?.route === 'string' ? body.route : ''
          const id = typeof body?.id === 'string' ? body.id : ''
          if (!route || !id) return json(res, 400, { ok: false, error: '缺少 route 或 id' })
          if (st === undefined) return json(res, 400, { ok: false, error: 'settings 服务不可用' })
          if (st.writable === false) return json(res, 400, { ok: false, error: '设置只读' })
          try {
            const r = await removeModel(st, route, id)
            return json(res, 200, { ok: true, route, id, removed: r.removed, from: r.from })
          } catch (e: any) {
            return json(res, 400, { ok: false, error: String(e?.message ?? e) })
          }
        }

        // ── 路由级设置（DeepSeek 推理档位 / thinking 开关）──────────────────
        if (req.method === 'POST' && path === 'route-settings') {
          const body = (await readJsonBody(req)) as any
          const route = typeof body?.route === 'string' ? body.route : ''
          if (!route) return json(res, 400, { ok: false, error: '缺少 route' })
          if (st === undefined) return json(res, 400, { ok: false, error: 'settings 服务不可用' })
          if (st.writable === false) return json(res, 400, { ok: false, error: '设置只读' })
          try {
            await writeRouteReasoning(st, route, {
              ...(typeof body?.reasoningEffort === 'string' ? { reasoningEffort: body.reasoningEffort } : {}),
              ...(typeof body?.thinking === 'string' ? { thinking: body.thinking } : {}),
            })
            return json(res, 200, { ok: true, route })
          } catch (e: any) {
            return json(res, 400, { ok: false, error: String(e?.message ?? e) })
          }
        }

        // ── 批量应用（发现结果）─────────────────────────────────────────────
        if (req.method === 'POST' && path === 'apply') {
          const body = (await readJsonBody(req)) as any
          const route = typeof body?.route === 'string' ? body.route : ''
          if (!route) return json(res, 400, { ok: false, error: '缺少 route' })
          if (!Array.isArray(body?.models)) return json(res, 400, { ok: false, error: 'models 必须是数组' })
          if (st === undefined) return json(res, 400, { ok: false, error: 'settings 服务不可用' })
          if (st.writable === false) return json(res, 400, { ok: false, error: '设置只读' })
          try {
            const r = await applyModels(st, route, body.models)
            return json(res, 200, { ok: true, route, ns: r.ns, count: r.count })
          } catch (e: any) {
            return json(res, 400, { ok: false, error: String(e?.message ?? e) })
          }
        }
        return json(res, 404, { ok: false, error: `未知接口 /${path}` })
      } catch (e: any) {
        host.logger.warn('dsh-model-detector api error:', e)
        return json(res, 500, { ok: false, error: String(e?.message ?? e) })
      }
    },
  }), 'dsh-model-detector: api')

  // 给 agent 用的只读状态工具（可选，方便在会话里查询）
  ctx.effect(() => tools.register(defineTool({
    name: '_dsh_model_detector_status',
    description: '查询 dsh-model-detector 对各提供方模型的发现/富化结果概览',
    parameters: {},
    output: {
      schema: { type: 'string' },
      render: (_args: unknown, value: unknown) => [{ type: 'text', text: String(value) }],
    },
    async execute() {
      return JSON.stringify({ title: config.title, providers: listConfiguredProviders(st) })
    },
  })), 'dsh-model-detector: status tool')
}
