#!/usr/bin/env node
/**
 * 跨平台构建 / 类型检查（自动探测依赖与 TypeScript 编译器）。
 *
 * 自动探测 TypeScript 编译器：
 *   1. 本地 `node_modules/typescript`（常规 `npm install` 后可用）；
 *   2. 否则回退到 DSH 源码 checkout 的 tsc（本仓库按 AGENTS.md 走 checkout 构建）。
 *
 * 自动修复/建立依赖符号链接（junction）：
 *   探测 DSH Desktop 安装包或 DSH 源码 checkout，自动确保依赖健全。
 *
 * 用法：
 *   node scripts/build.mjs          # 构建 host(tsc 产出 lib/) + client(tsdown)
 *   node scripts/build.mjs --noEmit # 仅类型检查(host)，不产出、不构建 client
 */
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync, mkdirSync, symlinkSync, readlinkSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const mode = process.argv.includes('--noEmit') ? 'typecheck' : 'build'
const home = process.env.USERPROFILE || process.env.HOME || ''

/** 确保依赖链接可用（遇到失效链接时自动修复）。 */
function ensureDependencyLinks() {
  const dshDesktopDir = join(process.env.LOCALAPPDATA || join(home, 'AppData/Local'), 'Programs/DSH Desktop/resources/app/node_modules/@deepseek-ai')
  const dshCheckout = process.env.DSH_CHECKOUT || join(home, 'Documents/GitHub/deepseek-harness')

  const targetBase = existsSync(dshDesktopDir) ? dshDesktopDir : null

  if (targetBase) {
    const pkgs = [
      ['cordis', 'cordis'],
      ['cosmokit', 'cosmokit'],
      ['schemastery', 'schemastery'],
      ['@deepseek-ai/cordis', 'cordis'],
      ['@deepseek-ai/cosmokit', 'cosmokit'],
      ['@deepseek-ai/schemastery', 'schemastery'],
      ['@deepseek-ai/dsh-tools', 'dsh-tools'],
      ['@deepseek-ai/dsh-llm', 'dsh-llm'],
      ['@deepseek-ai/dsh-system-prompt', 'dsh-system-prompt'],
    ]
    for (const [dest, src] of pkgs) {
      const destPath = join(root, 'node_modules', dest)
      const srcPath = join(targetBase, src)
      if (!existsSync(srcPath)) continue
      let needRelink = false
      try {
        if (!existsSync(destPath)) {
          needRelink = true
        } else {
          const curTarget = readlinkSync(destPath)
          if (!existsSync(curTarget)) needRelink = true
        }
      } catch {
        needRelink = true
      }
      if (needRelink) {
        try {
          rmSync(destPath, { recursive: true, force: true })
          mkdirSync(dirname(destPath), { recursive: true })
          symlinkSync(srcPath, destPath, process.platform === 'win32' ? 'junction' : 'dir')
        } catch { /* 忽略重连异常 */ }
      }
    }
  }
}

ensureDependencyLinks()

/** 找可用的 tsc 入口（node 可直跑的类型文件）。 */
function findTsc() {
  const cands = [join(root, 'node_modules/typescript/bin/tsc')]
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
