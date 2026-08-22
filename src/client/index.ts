/**
 * dsh-model-detector — client 设置页（settings.section slot）。
 * 构建：npm run build:client（tsdown → lib/client.js，ModuleLoader.load 注册）。
 * ⚠️ 必坑：① apply 用 ctx.slots 必须 export const inject = ['slots']；
 * ② register 必须带 name 字段（= slot 名，如 settings.section）。
 */
import type { SlotsService } from '@deepseek-ai/dsh-client-ui-slots'
import React from './react'
import { ModelCatalogPage } from './Page'
import { CSS } from './styles'

type ClientContext = {
  slots: SlotsService
}

export const inject = ['slots']

export const name = 'dsh-model-detector'

const STYLE_ID = 'dsh-model-detector-styles'

function adoptStyles(cssText: string): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = cssText
  document.head.appendChild(style)
}

export function apply(ctx: ClientContext): void {
  const slots = ctx.get?.('slots') ?? ctx.slots
  if (slots === undefined) return
  adoptStyles(CSS)
  ctx.effect(() => slots.inject('settings.section', () =>
    slots.register(
      { name: 'settings.section', id: 'dsh-model-detector', order: 13, label: () => '模型检测' },
      () => React.createElement(ModelCatalogPage),
    ),
  ), 'dsh-model-detector: settings section')
}
