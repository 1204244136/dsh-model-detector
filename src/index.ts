/**
 * dsh-model-detector — 设置页形态（dev_scaffold_plugin 生成，改造）。
 * host 侧：webServer API（/api/providers、/api/discover、/api/apply）。
 * client 侧：settings.section 设置页（React）。
 */
import type { Context } from 'cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from 'schemastery'
import {
  listConfiguredProviders, readJsonBody, subPath, fetchLiveModels, mergeDiscovered,
  loadModelsDev, applyModels, readProviders, type HostCtx,
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
        if (req.method === 'POST' && path === 'discover') {
          const body = (await readJsonBody(req)) as any
          const route = typeof body?.route === 'string' ? body.route : ''
          if (!route) return json(res, 400, { ok: false, error: '缺少 route' })
          const p = readProviders(st)[route] as any
          const mp = manifestProvider(route)
          const baseURL = typeof body?.baseURL === 'string' ? body.baseURL : (p?.baseURL || mp?.baseURL || '')
          // apiKey：优先请求体；否则解析 provider.apiKeyEnv 的凭据
          let apiKey = typeof body?.apiKey === 'string' ? body.apiKey : ''
          if (!apiKey) {
            const creds = host.get('credentials') as any
            if (creds && typeof creds.resolve === 'function' && p?.apiKeyEnv) {
              try { const hit = await creds.resolve(p.apiKeyEnv); if (hit?.value) apiKey = hit.value } catch { /* 忽略 */ }
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
          try {
            const liveIds = await fetchLiveModels(baseURL, apiKey)
            const merged = mergeDiscovered(route, liveIds.map((x: { id: string }) => x.id), defaults, modelsDev)
            return json(res, 200, { ok: true, models: merged, source: 'live+models.dev', fromManifestOnly: false })
          } catch (e: any) {
            // 线上拉取失败：只回退 models.dev / 内置清单（插件的目的是拿"线上"信息，
            // 不用提供方旧配置兜底）。两者都没有 → 0 模型 + 明确提示。
            const mdIds = modelsDev?.[route] ? Object.keys(modelsDev[route]) : []
            const mpIds = mp ? Object.keys(mp.models) : []
            const ids = mdIds.length > 0 ? mdIds : mpIds
            const catalogWarn = ids.length === 0
              ? `${String(e?.message ?? e)} 且 models.dev/清单未收录该提供方`
              : String(e?.message ?? e)
            return json(res, 200, {
              ok: true, models: mergeDiscovered(route, ids, defaults, modelsDev),
              source: 'fallback', fromManifestOnly: ids.length > 0, warn: catalogWarn,
            })
          }
        }
        if (req.method === 'POST' && path === 'apply') {
          const body = (await readJsonBody(req)) as any
          const route = typeof body?.route === 'string' ? body.route : ''
          if (!route) return json(res, 400, { ok: false, error: '缺少 route' })
          if (!Array.isArray(body?.models)) return json(res, 400, { ok: false, error: 'models 必须是数组' })
          if (st === undefined) return json(res, 400, { ok: false, error: 'settings 服务不可用' })
          if (st.writable === false) return json(res, 400, { ok: false, error: '设置只读' })
          await applyModels(st, route, body.models)
          return json(res, 200, { ok: true, route, count: body.models.length })
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
