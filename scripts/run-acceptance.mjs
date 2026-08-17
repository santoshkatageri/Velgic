#!/usr/bin/env node
/**
 * Velgic acceptance-test runner — the canonical `npm test`.
 *
 * Runs every authoritative acceptance suite, preserving each suite's
 * documented execution procedure: bundle with esbuild (the same externals
 * every suite header specifies), execute with node, clean up the generated
 * `.cjs` bundle, and fail fast on the first failing suite.
 *
 * Pre-flight:
 *   - `jsdom` must be present (test-only harness dependency, never committed):
 *         npm install --no-save --no-package-lock jsdom
 *   - `esbuild` must be present (it ships as a dependency of vite):
 *         npm ci
 *
 * Side effects: the suites regenerate two evidence files
 * (docs/velgic-ai-prompt-example.txt and
 * docs/examples/metadata.ai-roundtrip.json). Their original bytes are restored
 * after the run so `npm test` never leaves a dirty working tree.
 *
 * Exit code: 0 when every suite passes, otherwise the first failing suite's
 * exit code (or 1). No assertion counts are hard-coded anywhere — suites may
 * grow or shrink freely.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

/** Authoritative acceptance suites, in canonical order. */
const SUITES = [
  'scripts/acceptance-publishing-manifest.ts',
  'scripts/acceptance-ai-roundtrip.ts',
  'scripts/acceptance-2x-final.ts',
]

/** Files the suites regenerate during a run (restored afterwards). */
const EVIDENCE_FILES = [
  'docs/velgic-ai-prompt-example.txt',
  'docs/examples/metadata.ai-roundtrip.json',
]

/** The externals documented in every suite header. */
const EXTERNALS = [
  'react',
  'react-dom',
  'react-dom/client',
  'react-router-dom',
  'zustand',
  'zustand/middleware',
  'jsdom',
]

const fail = (message, code = 1) => {
  console.error(`\n✖ ${message}`)
  process.exit(code)
}

// --- Pre-flight -------------------------------------------------------------
try {
  require.resolve('jsdom')
} catch {
  fail('test-only harness dependency "jsdom" is missing. Run: npm install --no-save --no-package-lock jsdom')
}

let esbuild
try {
  esbuild = require('esbuild')
} catch {
  fail('esbuild is missing from node_modules. Run: npm ci')
}

// --- Snapshot evidence files so the run can be undone -----------------------
const evidence = new Map()
for (const rel of EVIDENCE_FILES) {
  const abs = resolve(root, rel)
  evidence.set(abs, existsSync(abs) ? readFileSync(abs) : null)
}

// --- Run each suite ----------------------------------------------------------
let firstFailure = 0
console.log('Velgic acceptance tests (npm test)\n')

for (const suite of SUITES) {
  const source = resolve(root, suite)
  const outfile = source.replace(/\.ts$/, '.cjs')
  console.log(`▶ ${suite}`)
  try {
    await esbuild.build({
      entryPoints: [source],
      outfile,
      bundle: true,
      format: 'cjs',
      platform: 'node',
      external: EXTERNALS,
      logLevel: 'error',
    })
    const run = spawnSync(process.execPath, [outfile], { stdio: 'inherit', cwd: root })
    if (run.status !== 0) {
      firstFailure = run.status ?? 1
      console.error(`✖ ${suite} FAILED`)
      break
    }
    console.log(`✔ ${suite} passed`)
  } catch (err) {
    firstFailure = 1
    console.error(`✖ ${suite} could not run:`, err && err.message ? err.message : err)
    break
  } finally {
    rmSync(outfile, { force: true }) // never leave generated .cjs behind
  }
}

// --- Restore evidence files --------------------------------------------------
for (const [abs, original] of evidence) {
  try {
    if (original === null) rmSync(abs, { force: true })
    else writeFileSync(abs, original)
  } catch {
    // Best effort — evidence restoration must not mask a failing suite.
  }
}

if (firstFailure !== 0) {
  process.exit(firstFailure)
}
console.log('\n✔ All acceptance suites passed')
