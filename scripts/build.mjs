#!/usr/bin/env node
/**
 * 跨平台构建 / 类型检查（不再依赖 bash，不要求本地 TypeScript）。
 *
 * 自动探测 TypeScript 编译器：
 *   1. 本地 `node_modules/typescript`（常规 `npm install` 后可用）；
 *   2. 否则回退到 DSH 源码 checkout 的 tsc（本仓库按 AGENTS.md 走 checkout 构建）。
 *
 * 用法：
 *   node scripts/build.mjs          # 构建 host(tsc 产出 lib/) + client(tsdown)
 *   node scripts/build.mjs --noEmit # 仅类型检查(host)，不产出、不构建 client
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const mode = process.argv.includes('--noEmit') ? 'typecheck' : 'build'

/** 找可用的 tsc 入口（node 可直跑的类型文件）。 */
function findTsc() {
  const cands = [join(root, 'node_modules/typescript/bin/tsc')]
  const home = process.env.USERPROFILE || process.env.HOME || ''
  const checkouts = []
  if (process.env.DSH_CHECKOUT) checkouts.push(process.env.DSH_CHECKOUT)
  checkouts.push(join(home, 'Documents/GitHub/deepseek-harness'))
  for (const c of checkouts) cands.push(join(c, 'node_modules/typescript/bin/tsc'))
  return cands.find((p) => existsSync(p)) || ''
}

const tsc = findTsc()
if (!tsc) {
  console.error('build: 找不到 tsc。请先 `npm install`（安装 typescript），或设置环境变量 DSH_CHECKOUT 指向 dsh 源码 checkout。')
  process.exit(1)
}

const args = [tsc, '-p', join(root, 'tsconfig.json')]
if (mode === 'typecheck') args.push('--noEmit')

const r = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: root })
if (r.status !== 0) process.exit(r.status ?? 1)

if (mode === 'typecheck') {
  console.log('typecheck 通过 ✅')
  process.exit(0)
}

// build 模式：再构建 client（tsdown）
const tsdownBin = join(root, 'node_modules/.bin/tsdown' + (process.platform === 'win32' ? '.cmd' : ''))
if (!existsSync(tsdownBin)) {
  console.error('build: 未找到本地 tsdown（先 `npm install`）。')
  process.exit(1)
}
const rc = spawnSync(tsdownBin, [], { stdio: 'inherit', cwd: root, shell: process.platform === 'win32' })
process.exit(rc.status ?? 0)
