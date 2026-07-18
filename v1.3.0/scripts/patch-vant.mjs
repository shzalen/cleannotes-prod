#!/usr/bin/env node
// Patch Vant's package.json: set sideEffects to true
//
// Vant 4's package.json has sideEffects listing style dirs and css,
// which marks all JS modules as side-effect-free. This causes Rollup to
// tree-shake components that are only referenced indirectly via app.use(Vant).
//
// Setting sideEffects to true prevents this and ensures all components are preserved.
//
// This script runs automatically as a postinstall hook.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pkgPath = resolve(process.cwd(), 'node_modules/vant/package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

if (pkg.sideEffects === true) {
  console.log('[postinstall] Vant sideEffects already set to true — skip')
  process.exit(0)
}

console.log(`[postinstall] Patching Vant sideEffects: ${JSON.stringify(pkg.sideEffects)} → true`)
pkg.sideEffects = true
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log('[postinstall] Vant sideEffects patched successfully')
