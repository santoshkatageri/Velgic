/**
 * Velgic 2.x final acceptance — asset library, publishing preparation,
 * validation hardening, and full manual distribution workflow.
 *
 * Runs on top of the seeded data (including the "Top Open Source
 * Alternatives for Content Creators" campaign). Regression sections verify
 * the existing V1 behavior is intact.
 *
 * Run from the repository root:
 *
 *   npm install --no-save jsdom
 *   npx esbuild scripts/acceptance-2x-final.ts --bundle --format=cjs \
 *     --platform=node --external:react --external:react-dom \
 *     --external:react-dom/client --external:react-router-dom \
 *     --external:zustand --external:zustand/middleware --external:jsdom \
 *     --outfile=scripts/acceptance-2x-final.cjs --log-level=error
 *   node scripts/acceptance-2x-final.cjs
 */
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
const g = globalThis as Record<string, unknown>
Object.defineProperty(g, 'window', { value: dom.window, configurable: true })
Object.defineProperty(g, 'document', { value: dom.window.document, configurable: true })
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true })
Object.defineProperty(g, 'HTMLElement', { value: dom.window.HTMLElement, configurable: true })
Object.defineProperty(g, 'HTMLInputElement', { value: dom.window.HTMLInputElement, configurable: true })
Object.defineProperty(g, 'HTMLSelectElement', { value: dom.window.HTMLSelectElement, configurable: true })
Object.defineProperty(g, 'HTMLTextAreaElement', { value: dom.window.HTMLTextAreaElement, configurable: true })
Object.defineProperty(g, 'Element', { value: dom.window.Element, configurable: true })
Object.defineProperty(g, 'Event', { value: dom.window.Event, configurable: true })
Object.defineProperty(g, 'getComputedStyle', { value: dom.window.getComputedStyle.bind(dom.window), configurable: true })
Object.defineProperty(g, 'localStorage', { value: dom.window.localStorage, configurable: true })

const tick = () => new Promise((r) => setTimeout(r, 50))

let passed = 0
let failed = 0
const failures: string[] = []
function expect(name: string, ok: boolean, extra = '') {
  if (ok) {
    passed++
    console.log(`  ok: ${name}`)
  } else {
    failed++
    failures.push(name)
    console.log(`  FAIL: ${name}${extra ? ` — ${extra}` : ''}`)
  }
}
function section(title: string) {
  console.log(`\n[${title}]`)
}

const $ = (sel: string) => document.querySelector(sel) as HTMLElement | null
const $$ = (sel: string) => Array.from(document.querySelectorAll(sel)) as HTMLElement[]
const text = () => document.body.textContent ?? ''
const button = (label: string) =>
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLElement | undefined

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof dom.window.HTMLTextAreaElement
      ? dom.window.HTMLTextAreaElement.prototype
      : dom.window.HTMLInputElement.prototype
  ;(Object.getOwnPropertyDescriptor(proto, 'value') as PropertyDescriptor).set!.call(el, value)
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
}

async function main() {
  dom.window.localStorage.clear()

  const React = (await import('react')).default
  const { createRoot } = await import('react-dom/client')
  const { HashRouter } = await import('react-router-dom')
  const { default: App } = await import('../src/App')
  const { validateManifest } = await import('../src/lib/manifest')
  const { assetUsage, deriveCampaignStatus } = await import('../src/lib/content')
  const { useStore } = await import('../src/store/useStore')
  const { seedAssets } = await import('../src/data/seed')

  const root = createRoot(document.getElementById('root')!)
  root.render(React.createElement(HashRouter, null, React.createElement(App)))
  await tick()

  const S = () => useStore.getState()

  /* ================================================================ */
  section('1. Regression — existing V1 behavior intact')
  /* ================================================================ */
  expect('dashboard renders recommendation', text().includes('What should I build next?'))
  expect('dashboard has Start experiment + Create content', text().includes('Start experiment') && text().includes('Create content'))
  expect('dashboard has Quick capture + Content pipeline + Recent experiments', text().includes('Quick capture') && text().includes('Content pipeline') && text().includes('Recent experiments'))
  expect('sidebar nav order', ['Dashboard', 'Ideas', 'Content', 'Pipeline', 'Experiments', 'Insights'].every((l, i) => $$('.nav__item span')[i]?.textContent === l))

  window.location.hash = '#/ideas'
  await tick()
  expect('ideas page renders', !!document.querySelector('.filter-bar__search input'))
  window.location.hash = '#/pipeline'
  await tick()
  expect('pipeline kanban unchanged (5 stages)', $$('.kanban-col').length === 5)
  window.location.hash = '#/experiments'
  await tick()
  expect('experiments page renders', text().includes('New experiment'))
  window.location.hash = '#/insights'
  await tick()
  expect('insights page renders', text().includes('Best performing topics'))

  /* ================================================================ */
  section('2. Asset library — seeded, reference-only, reusable')
  /* ================================================================ */
  expect('asset library seeded', S().assets.length >= 8)
  expect('library asset ids are unique', new Set(S().assets.map((a) => a.asset_id)).size === S().assets.length)
  expect('seeded platform asset is in the library', S().assets.some((a) => a.asset_id === 'instagram-reel-03'))
  expect('library holds reference-only metadata (no binary)', S().assets.every((a) => typeof a.reference === 'string' && !('blob' in a)))
  expect('library entries carry createdAt + notes', S().assets.every((a) => typeof a.createdAt === 'string' && typeof a.notes === 'string'))

  const igUsage = assetUsage('instagram-reel-03', S().platformContents)
  expect('usage tracking: instagram-reel-03 used by 1 platform version', igUsage.length === 1 && igUsage[0].platform === 'instagram')
  expect('brand-kit-01 is currently unused', assetUsage('brand-kit-01', S().platformContents).length === 0)

  /* ----- reuse: attach one library asset to two platform versions ----- */
  S().attachAssetToPlatform('pc-11', 'brand-kit-01', 'media')
  expect('reuse: asset attached to Instagram Reel version', S().platformContents.find((p) => p.id === 'pc-11')?.assets.some((a) => a.asset_id === 'brand-kit-01') ?? false)
  S().attachAssetToPlatform('pc-13', 'brand-kit-01', 'media')
  const usages2 = assetUsage('brand-kit-01', S().platformContents)
  expect('reuse: same asset referenced by 2 platform versions', usages2.length === 2)

  /* ----- shared edits propagate everywhere the asset is used ----- */
  S().updateAsset('brand-kit-01', { filename: 'brand-kit-v2.pdf', size: 2_400_000 })
  const copies = S().platformContents.flatMap((p) => p.assets.filter((a) => a.asset_id === 'brand-kit-01'))
  expect('shared edit: filename synced to every referencing platform version', copies.length === 2 && copies.every((a) => a.filename === 'brand-kit-v2.pdf' && a.size === 2_400_000))

  /* ----- deletion protection ----- */
  const blockedDelete = S().deleteAsset('brand-kit-01')
  expect('delete blocked while referenced (2 usages reported)', blockedDelete.deleted === false && blockedDelete.usages.length === 2)
  expect('asset still present after blocked delete', S().assets.some((a) => a.asset_id === 'brand-kit-01'))

  // Detach from both platforms (as the UI does) and delete.
  S().updatePlatformContent('pc-11', { assets: S().platformContents.find((p) => p.id === 'pc-11')!.assets.filter((a) => a.asset_id !== 'brand-kit-01') })
  S().updatePlatformContent('pc-13', { assets: S().platformContents.find((p) => p.id === 'pc-13')!.assets.filter((a) => a.asset_id !== 'brand-kit-01') })
  const okDelete = S().deleteAsset('brand-kit-01')
  expect('delete allowed once unreferenced', okDelete.deleted === true)
  expect('asset removed from the library', !S().assets.some((a) => a.asset_id === 'brand-kit-01'))

  const newAsset = {
    asset_id: 'test-asset-01',
    filename: 'temp.mp4',
    type: 'video' as const,
    reference: 'tmp/temp.mp4',
    provider: 'local',
    role: null,
    mimeType: 'video/mp4',
    size: 100,
    duration: 5,
  }
  S().addAsset(newAsset)
  expect('addAsset creates a library entry with createdAt + notes defaults', S().assets.find((a) => a.asset_id === 'test-asset-01')?.notes === '')
  expect('deleteAsset on a fresh unreferenced asset works', S().deleteAsset('test-asset-01').deleted === true)

  /* ----- import: colliding asset id with different content is uniquified ----- */
  // The fixture's IG asset id is forced to collide with the library's
  // 'instagram-reel-03' (different reference) — the import must uniquify it.
  const fixture = JSON.parse(readFileSync('docs/examples/top-open-source-alternatives.velgic-manifest.json', 'utf8'))
  ;(fixture.platforms[0].assets[0] as { asset_id: string; reference: string }).asset_id = 'instagram-reel-03'
  ;(fixture.platforms[0].assets[0] as { reference: string }).reference = 'instagram/other-cut.mp4'
  const libBefore = S().assets.length
  const res = S().importCampaign(fixture as never)
  expect('import with colliding asset id succeeds', res.issues.length === 0)
  const importedIg = S().platformContents.find((p) => p.id === 'pc-21')
  expect('imported platform version got a uniquified asset id', importedIg?.assets[0].asset_id.startsWith('instagram-reel-03-') ?? false)
  expect('library gained the new (uniquified) asset entry', S().assets.length === libBefore + 3, `expected +3, got ${S().assets.length - libBefore}`)
  expect('original library asset untouched', S().assets.some((a) => a.asset_id === 'instagram-reel-03' && a.reference === 'instagram/oss-reel.mp4'))
  expect('no partial import artifacts', validateManifest(fixture).length === 0)

  // Add an unreferenced asset so the UI can show the "unused" marker.
  S().addAsset({
    asset_id: 'unused-check-01',
    filename: 'spare-broll.mp4',
    type: 'video',
    reference: 'spare/spare-broll.mp4',
    provider: 'local',
    role: null,
    mimeType: null,
    size: null,
    duration: null,
  })

  /* ----- Assets section renders in the UI with usage ----- */
  window.location.hash = '#/content'
  await tick()
  expect('content page shows the Assets section', text().includes('Reusable reference-only assets'))
  expect('library cards render (brand-kit visible after reset? test asset) ', $$('.asset-card').length > 0)
  expect('usage chips render for referenced assets', $$('.usage-chip').length > 0)
  expect('unused marker renders for unreferenced assets', text().includes('Unused — safe to delete'))

  /* ================================================================ */
  section('3. Campaign readiness — platform statuses first, % secondary')
  /* ================================================================ */
  window.location.hash = '#/campaigns/camp-4'
  await tick()
  expect('distribution status summary renders', text().includes('Distribution status'))
  const glyphs = $$('.campaign-status-row__glyph').map((e) => e.textContent ?? '')
  expect('status glyphs: IG ✓, YT ✓, LI ✓, X ○', glyphs.join('') === '✓✓✓○', glyphs.join(','))
  expect('platform rows carry format + status', text().includes('Instagram · Reel') && text().includes('X (Twitter) · Thread'))
  expect('readiness % marked as secondary', text().includes('% ready (secondary)'))

  /* ================================================================ */
  section('4. Publishing preparation — actions, timestamp, metrics')
  /* ================================================================ */
  const cards = $$('.platform-card')
  const card = (name: string) => cards.find((c) => (c.querySelector('.platform-card__name')?.textContent ?? '') === name)!
  const ig = card('Instagram')
  const yt = card('YouTube')
  const li = card('LinkedIn')
  const x = card('X (Twitter)')

  expect('IG actions: Copy caption + Copy content', !!Array.from(ig.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Copy caption') && !!Array.from(ig.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Copy content'))
  expect('YT actions: Copy title + Copy description + Copy content', ['Copy title', 'Copy description', 'Copy content'].every((l) => Array.from(yt.querySelectorAll('button')).some((b) => b.textContent?.trim() === l)))
  expect('LI actions: Copy caption + Copy content', ['Copy caption', 'Copy content'].every((l) => Array.from(li.querySelectorAll('button')).some((b) => b.textContent?.trim() === l)))
  expect('X actions: Copy caption + Copy content', ['Copy caption', 'Copy content'].every((l) => Array.from(x.querySelectorAll('button')).some((b) => b.textContent?.trim() === l)))
  expect('lifecycle buttons on every platform', ['Mark ready', 'Mark scheduled', 'Mark published'].every((l) => Array.from(ig.querySelectorAll('button')).some((b) => b.textContent?.trim() === l)))
  expect('published URL + timestamp controls present', !!ig.querySelector('.status-controls__url input') && !!ig.querySelector('.status-controls__ts input[type="datetime-local"]'))
  expect('Set now action present', !!Array.from(ig.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Set now'))

  /* ----- full status journey on the X version: Draft → Ready → Scheduled ----- */
  ;(Array.from(x.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Mark ready') as HTMLElement)?.click()
  await tick()
  expect('X: Mark ready → status ready', S().platformContents.find((p) => p.id === 'pc-14')?.status === 'ready')
  ;(Array.from(x.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Mark scheduled') as HTMLElement)?.click()
  await tick()
  const xPc = S().platformContents.find((p) => p.id === 'pc-14')
  expect('X: Mark scheduled → status scheduled + schedule auto-enabled', xPc?.status === 'scheduled' && xPc?.schedule.enabled === true && !!xPc?.schedule.datetime)

  /* ----- published timestamp + URL on the LinkedIn version ----- */
  ;(Array.from(li.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Mark published') as HTMLElement)?.click()
  await tick()
  const liPc = S().platformContents.find((p) => p.id === 'pc-13')
  expect('LI: Mark published auto-sets a published timestamp', liPc?.status === 'published' && !!liPc?.publishedAt && !Number.isNaN(Date.parse(liPc.publishedAt)))
  const liUrl = li.querySelector('.status-controls__url input') as HTMLInputElement
  setValue(liUrl, 'https://www.linkedin.com/posts/oss-creators')
  await tick()
  expect('LI: published URL saved', S().platformContents.find((p) => p.id === 'pc-13')?.publishedUrl === 'https://www.linkedin.com/posts/oss-creators')
  const tsInput = li.querySelector('.status-controls__ts input[type="datetime-local"]') as HTMLInputElement
  setValue(tsInput, '2026-08-16T09:30')
  await tick()
  const liAfter = S().platformContents.find((p) => p.id === 'pc-13')
  expect('LI: published timestamp editable', liAfter?.publishedAt?.startsWith('2026-08-16T09:30') ?? false, String(liAfter?.publishedAt))

  /* ----- optional metrics retained per platform ----- */
  const metricsInputs = Array.from(ig.querySelectorAll('.metrics-row input')) as HTMLInputElement[]
  expect('metrics inputs (views/likes/comments/shares/saves) present', metricsInputs.length === 5)
  setValue(metricsInputs[0], '184000')
  setValue(metricsInputs[1], '12400')
  await tick()
  const igPc = S().platformContents.find((p) => p.id === 'pc-11')
  expect('metrics retained on the platform version', igPc?.metrics?.views === 184000 && igPc?.metrics?.likes === 12400 && igPc?.metrics?.saves === null)

  /* ----- campaign status derivation from mixed platform states ----- */
  const campPcs = S().platformContents.filter((p) => p.campaignId === 'camp-4')
  expect('derive: mixed published/ready → partially_published', deriveCampaignStatus(campPcs) === 'partially_published')
  button('Derive status')?.click()
  await tick()
  expect('campaign status updated via Derive status', S().campaigns.find((c) => c.id === 'camp-4')?.status === 'partially_published')

  /* ================================================================ */
  section('5. Validation hardening — timezone + asset role')
  /* ================================================================ */
  const base = JSON.parse(readFileSync('docs/examples/top-open-source-alternatives.velgic-manifest.json', 'utf8'))
  const clone = () => JSON.parse(JSON.stringify(base))
  const codes = (m: unknown) => validateManifest(m).map((i) => i.code)

  const badTzTop = clone()
  badTzTop.timezone = 'Not/AZone'
  expect('rejects: invalid top-level timezone → INVALID_TIMEZONE', codes(badTzTop).includes('INVALID_TIMEZONE'), codes(badTzTop).join(','))
  const badTzSched = clone()
  badTzSched.platforms[1].schedule.timezone = 'Mars/Olympus_Mons'
  expect('rejects: invalid schedule timezone → INVALID_TIMEZONE', codes(badTzSched).includes('INVALID_TIMEZONE'), codes(badTzSched).join(','))
  const okTz = clone()
  okTz.platforms[1].schedule.timezone = 'Europe/Berlin'
  expect('accepts: valid IANA timezone', codes(okTz).length === 0, JSON.stringify(codes(okTz)))
  const badRole = clone()
  badRole.platforms[0].assets[0].role = 'hero'
  expect('rejects: invalid asset role → INVALID_ASSET_REFERENCE', codes(badRole).includes('INVALID_ASSET_REFERENCE'), codes(badRole).join(','))
  const okRole = clone()
  okRole.platforms[0].assets[0].role = 'media'
  expect('accepts: valid asset role', codes(okRole).length === 0)

  /* ================================================================ */
  section('6. Persistence — everything survives refresh')
  /* ================================================================ */
  const persisted = JSON.parse(dom.window.localStorage.getItem('velgic') ?? '{}')
  expect('persisted: content model', Array.isArray(persisted.state?.contents) && Array.isArray(persisted.state?.campaigns) && Array.isArray(persisted.state?.platformContents))
  expect('persisted: asset library', Array.isArray(persisted.state?.assets))
  expect('persisted: publishing statuses + URLs + schedules', (persisted.state?.platformContents ?? []).some((p: { id: string }) => p.id === 'pc-13' && p.status === 'published' && p.publishedUrl === 'https://www.linkedin.com/posts/oss-creators'))
  expect('persisted: metrics', (persisted.state?.platformContents ?? []).find((p: { id: string }) => p.id === 'pc-11')?.metrics?.views === 184000)
  expect('persisted: published timestamps', (persisted.state?.platformContents ?? []).find((p: { id: string }) => p.id === 'pc-13')?.publishedAt?.startsWith('2026-08-16T09:30'))

  /* ================================================================ */
  section('7. External AI prompt — complete contract')
  /* ================================================================ */
  const prompt = readFileSync('docs/velgic-ai-prompt-example.txt', 'utf8')
  expect('prompt has brand placeholders', prompt.includes('{{BRAND_NAME}}') && prompt.includes('{{BRAND_VOICE}}') && prompt.includes('{{BRAND_HANDLE}}'))
  expect('prompt has the preservation rule', prompt.includes('Preserve factual/user-provided information unless explicitly instructed to modify it.'))
  expect('prompt has all 12 rules', prompt.split('RULES')[1].split('VELGIC PUBLISHING MANIFEST SCHEMA')[0].trim().split('\n').filter((l) => /^\d+\./.test(l.trim())).length === 12)
  expect('prompt carries ISO schedule datetime', /youtube: \d{4}-\d{2}-\d{2}T/.test(prompt))
  expect('prompt embeds the complete schema', prompt.includes('VELGIC PUBLISHING MANIFEST SCHEMA (follow exactly)') && prompt.includes('platform must be one of: instagram, youtube, linkedin, x'))

  /* ================================================================ */
  console.log(`\n==============================`)
  console.log(`2.X FINAL ACCEPTANCE RESULT: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.log('Failed checks:')
    for (const f of failures) console.log(`  - ${f}`)
    process.exit(1)
  }
  console.log('ALL 2.X FINAL ACCEPTANCE CHECKS PASS')
  process.exit(0)
}

main().catch((e) => {
  console.error('2.X FINAL CRASH:', e)
  process.exit(1)
})
