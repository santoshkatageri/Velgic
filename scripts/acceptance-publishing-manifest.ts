/**
 * Velgic V2 acceptance test — Publishing Manifest
 * =================================================
 * Walks the complete workflow on the seeded test campaign
 * ("Top Open Source Alternatives for Content Creators"):
 *
 *   Content → Campaign → Platform Versions → Generate Manifest Prompt
 *   → Import JSON → Validate → Export
 *
 * Platforms under test: Instagram Reel, YouTube Short, LinkedIn Post, X Thread.
 *
 * Run from the repository root:
 *
 *   npm install --no-save jsdom   # test-only harness dependency, not part of the app
 *   npx esbuild scripts/acceptance-publishing-manifest.ts --bundle --format=cjs \
 *     --platform=node --external:react --external:react-dom \
 *     --external:react-dom/client --external:react-router-dom \
 *     --external:zustand --external:zustand/middleware --external:jsdom \
 *     --outfile=scripts/acceptance-publishing-manifest.cjs --log-level=error
 *   node scripts/acceptance-publishing-manifest.cjs
 *
 * The run also writes docs/velgic-ai-prompt-example.txt (the actual generated
 * AI prompt) and uses docs/examples/top-open-source-alternatives.velgic-manifest.json
 * as the realistic valid import fixture.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { Blob as NodeBlob } from 'node:buffer'
import { JSDOM } from 'jsdom'

/* ------------------------------------------------------------------ */
/* jsdom environment                                                   */
/* ------------------------------------------------------------------ */
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
Object.defineProperty(g, 'HTMLAnchorElement', { value: dom.window.HTMLAnchorElement, configurable: true })
Object.defineProperty(g, 'Element', { value: dom.window.Element, configurable: true })
Object.defineProperty(g, 'Event', { value: dom.window.Event, configurable: true })
Object.defineProperty(g, 'getComputedStyle', { value: dom.window.getComputedStyle.bind(dom.window), configurable: true })
Object.defineProperty(g, 'localStorage', { value: dom.window.localStorage, configurable: true })
Object.defineProperty(g, 'Blob', { value: NodeBlob, configurable: true })
dom.window.document.execCommand = (() => true) as never

// Capture export downloads instead of navigating (patch methods, keep the
// URL constructor intact for react-router).
const capturedDownload: { blob: Blob | null; filename: string } = { blob: null, filename: '' }
const RealURL = dom.window.URL as unknown as typeof URL
;(RealURL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (blob: Blob) => {
  capturedDownload.blob = blob
  return 'blob:velgic-test'
}
;(RealURL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {}
Object.defineProperty(g, 'URL', { value: RealURL, configurable: true })
dom.window.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
  capturedDownload.filename = this.download
}

const tick = () => new Promise((r) => setTimeout(r, 50))

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
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
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as
    | HTMLElement
    | undefined

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof dom.window.HTMLTextAreaElement
      ? dom.window.HTMLTextAreaElement.prototype
      : dom.window.HTMLInputElement.prototype
  ;(Object.getOwnPropertyDescriptor(proto, 'value') as PropertyDescriptor).set!.call(el, value)
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
}

async function main() {
  // Fresh localStorage → seeded demo data loads (incl. camp-4 test campaign).
  dom.window.localStorage.clear()

  const React = (await import('react')).default
  const { createRoot } = await import('react-dom/client')
  const { HashRouter } = await import('react-router-dom')
  const { default: App } = await import('../src/App')
  const { buildPublishPrompt } = await import('../src/lib/publishPrompt')
  const {
    buildManifest,
    copyCampaignManifest,
    exportCampaignManifest,
    parseManifestText,
    validateManifest,
    MANIFEST_SCHEMA_VERSION,
  } = await import('../src/lib/manifest')
  const { useStore } = await import('../src/store/useStore')
  const { seedContents, seedCampaigns, seedPlatformContents } = await import('../src/data/seed')

  const content4 = seedContents.find((c) => c.id === 'content-4')!
  const campaign4 = seedCampaigns.find((c) => c.id === 'camp-4')!
  const pcs4 = seedPlatformContents.filter((p) => p.campaignId === 'camp-4')

  const root = createRoot(document.getElementById('root')!)
  root.render(React.createElement(HashRouter, null, React.createElement(App)))
  await tick()

  /* ================================================================ */
  section('1. Workflow: Content → Campaign → Platform Versions (seeded)')
  /* ================================================================ */

  window.location.hash = '#/campaigns/camp-4'
  await tick()

  expect('campaign page renders for the test campaign', text().includes('Top Open Source Alternatives'))
  expect('linked content shown on campaign page', text().includes('Top open-source alternatives for content creators'))

  const platformCards = $$('.platform-card')
  expect('exactly 4 platform versions render', platformCards.length === 4)
  expect(
    'platforms render in order Instagram → YouTube → LinkedIn → X',
    ['Instagram', 'YouTube', 'LinkedIn', 'X (Twitter)'].every((name, i) => platformCards[i]?.textContent?.includes(name)),
  )

  const card = (name: string) =>
    platformCards.find((c) => (c.querySelector('.platform-card__name')?.textContent ?? '') === name)!

  /* ----- Instagram Reel ----- */
  const ig = card('Instagram')
  expect('IG: format is Reel', ig.querySelector('.platform-card__body .select__control')?.textContent?.includes('Reel') ?? false)
  expect('IG: caption field present with content', (ig.querySelector('.platform-card__body textarea') as HTMLTextAreaElement)?.value.includes('creator stack') ?? false)
  expect(
    'IG: hashtags field present',
    (Array.from(ig.querySelectorAll('input')).find((i) => i.value.includes('#opensource')) as HTMLInputElement)?.value ===
      '#opensource, #creators, #buildinpublic',
  )
  expect('IG: location field present', Array.from(ig.querySelectorAll('input')).some((i) => i.placeholder === 'San Francisco, CA'))
  expect('IG: asset reference present', ig.textContent?.includes('instagram-reel-03') ?? false)
  expect('IG: schedule control present', !!ig.querySelector('.sched-box'))
  expect('IG: status is Published', ig.querySelector('.platform-card__head-right')?.textContent?.includes('Published') ?? false)
  expect(
    'IG: published URL shown',
    (Array.from(ig.querySelectorAll('input')).find((i) => i.placeholder === 'https://…') as HTMLInputElement)?.value ===
      'https://www.instagram.com/reel/oss-creators',
  )

  /* ----- YouTube Short ----- */
  const yt = card('YouTube')
  expect('YT: format is Short', yt.querySelector('.platform-card__body .select__control')?.textContent?.includes('Short') ?? false)
  expect(
    'YT: title field present',
    (Array.from(yt.querySelectorAll('input')).find((i) => i.placeholder === 'Why AI agents get stuck in loops') as HTMLInputElement)?.value ===
      'Top open-source alternatives for content creators',
  )
  expect('YT: description field present', yt.querySelector('textarea') != null)
  expect(
    'YT: tags field present',
    (Array.from(yt.querySelectorAll('input')).find((i) => i.placeholder === 'ai agents, llm, automation') as HTMLInputElement)?.value ===
      'open source, creator tools, oss',
  )
  expect('YT: video + thumbnail asset refs present', (yt.querySelectorAll('.asset-box').length ?? 0) === 2)
  expect('YT: status is Scheduled', yt.querySelector('.platform-card__head-right')?.textContent?.includes('Scheduled') ?? false)
  const ytScheduleOn = yt.querySelector('.sched-box__toggle .checkbox') as HTMLInputElement
  expect('YT: schedule enabled with datetime', ytScheduleOn?.checked === true && yt.querySelector('input[type="datetime-local"]') != null)
  expect('YT: timezone shown (Asia/Kolkata)', yt.textContent?.includes('Asia/Kolkata') ?? false)

  /* ----- LinkedIn Post ----- */
  const li = card('LinkedIn')
  expect('LI: format is Post', li.querySelector('.platform-card__body .select__control')?.textContent?.includes('Post') ?? false)
  expect(
    'LI: post text field present',
    (li.querySelector('.platform-card__body textarea') as HTMLTextAreaElement)?.value.includes('paid subscription') ?? false,
  )
  expect('LI: media reference add available', (li.textContent ?? '').includes('Add media reference'))
  expect('LI: status is Ready', li.querySelector('.platform-card__head-right')?.textContent?.includes('Ready') ?? false)

  /* ----- X Thread ----- */
  const x = card('X (Twitter)')
  expect('X: format is Thread', x.querySelector('.platform-card__body .select__control')?.textContent?.includes('Thread') ?? false)
  const xTextarea = x.querySelector('.platform-card__body textarea') as HTMLTextAreaElement
  expect('X: thread content present', xTextarea?.value.includes('setup time') ?? false)
  expect('X: is-thread flag on', (x.querySelector('.check-row--compact .checkbox') as HTMLInputElement)?.checked === true)
  expect('X: status is Draft', x.querySelector('.platform-card__head-right')?.textContent?.includes('Draft') ?? false)

  /* ----- workflow actions ----- */
  expect('workflow actions present', ['Import manifest', 'Export manifest', 'Copy JSON', 'Generate AI prompt'].every((l) => button(l) != null))

  /* ================================================================ */
  section('2. Generate the actual Velgic AI prompt')
  /* ================================================================ */

  const prompt = buildPublishPrompt({ campaign: campaign4, content: content4, platformContents: pcs4 })

  expect('prompt header present', prompt.includes('VELGIC PUBLISHING MANIFEST — AI GENERATION PROMPT'))
  expect('prompt targets external tools', prompt.includes('ChatGPT, Gemini, Claude, Grok'))
  expect('placeholder CONTENT_TITLE filled', prompt.includes('{{CONTENT_TITLE}}: Top open-source alternatives for content creators'))
  expect('placeholder CONTENT_CONCEPT filled', prompt.includes('{{CONTENT_CONCEPT}}: Free, open-source replacements'))
  expect('placeholder TARGET_AUDIENCE filled', prompt.includes('{{TARGET_AUDIENCE}}: Technical creators'))
  expect('placeholder PLATFORMS filled', prompt.includes('{{PLATFORMS}}: instagram (Reel), youtube (Short), linkedin (Post), x (Thread)'))
  expect('placeholder FORMATS filled', prompt.includes('{{FORMATS}}: Reel, Short, Post, Thread'))
  expect('placeholder ASSETS filled with references', prompt.includes('instagram/oss-reel.mp4') && prompt.includes('youtube/oss-thumb.jpg'))
  expect('placeholder TIMEZONE filled', prompt.includes('{{TIMEZONE}}: Asia/Kolkata'))
  const scheduleLine = prompt.split('\n').find((l) => l.startsWith('{{SCHEDULE}}: ')) ?? ''
  expect('placeholder SCHEDULE filled', scheduleLine.includes('youtube:') && /Aug \d+, \d{1,2}:\d{2}/.test(scheduleLine), scheduleLine)
  expect('placeholder PUBLISHED_URL filled', prompt.includes('{{PUBLISHED_URL}}: instagram: https://www.instagram.com/reel/oss-creators'))
  expect('placeholder HASHTAGS filled', prompt.includes('{{HASHTAGS}}: #opensource #creators #buildinpublic'))
  expect('placeholder BRAND_VOICE stays literal for the user', prompt.includes('{{BRAND_VOICE}}: {{BRAND_VOICE}}'))
  expect('campaign name + status included', prompt.includes('CAMPAIGN NAME: Top Open Source Alternatives') && prompt.includes('CAMPAIGN STATUS: partially_published'))

  const requiredRules = [
    'Return ONLY valid JSON.',
    'Do not use markdown fences',
    'Do not provide explanations',
    'Do not invent assets.',
    'Do not invent URLs.',
    'Do not invent dates.',
    'Use null for unavailable optional values.',
    'Follow the Velgic schema exactly',
    'Preserve provided asset references',
    'Use valid ISO 8601 datetime values',
    'Respect the requested platform and format values.',
  ]
  expect('all 11 prompt rules present', requiredRules.every((r) => prompt.includes(r)), requiredRules.filter((r) => !prompt.includes(r)).join('; '))

  const schemaBits = [
    'schema_version (string, always "1.0")',
    'content.origin must be one of:',
    'platform.status must be one of: draft, ready, scheduled, published, failed',
    'Allowed format per platform: instagram → Reel | Carousel | Post',
    'assets[] entries: { asset_id, filename, type, reference, provider, role, mimeType, size, duration }',
    'instagram metadata: { caption (string), hashtags (array of strings), location (string or null) }',
    'youtube metadata: { title (non-empty string), description (string), tags (array of strings) }',
    'linkedin metadata: { post_text (string) }',
    'x metadata: { content (string), is_thread (boolean), thread',
    'published_url: a valid http(s) URL string when present, otherwise null',
  ]
  expect('complete schema field list embedded', schemaBits.every((b) => prompt.includes(b)), schemaBits.filter((b) => !prompt.includes(b)).join('; '))

  // The embedded example must itself be a valid manifest.
  const exampleMarker = 'EXAMPLE (match this shape and key names exactly)'
  const exampleJson = prompt.slice(prompt.indexOf(exampleMarker) + exampleMarker.length).trim()
  const parsedExample = JSON.parse(exampleJson)
  expect('embedded example parses as JSON', parsedExample.schema_version === MANIFEST_SCHEMA_VERSION)
  const exampleIssues = validateManifest(parsedExample)
  expect('embedded example JSON validates cleanly against the schema', exampleIssues.length === 0, JSON.stringify(exampleIssues))

  // Save the actual prompt as evidence.
  writeFileSync('docs/velgic-ai-prompt-example.txt', prompt)
  expect('prompt saved to docs/velgic-ai-prompt-example.txt', readFileSync('docs/velgic-ai-prompt-example.txt', 'utf8') === prompt)

  // UI: modal shows the same prompt with a Copy Prompt button.
  button('Generate AI prompt')?.click()
  await tick()
  const promptBox = $('.prompt-box__text') as HTMLTextAreaElement
  expect('AI prompt modal opens with the generated prompt', promptBox?.value === prompt)
  expect('Copy Prompt button present', button('Copy prompt') != null)
  ;(Array.from(document.querySelectorAll('.modal__footer button')).find((b) => b.textContent === 'Close') as HTMLElement)?.click()
  await tick()

  /* ================================================================ */
  section('3. Import realistic metadata.json → all fields populate')
  /* ================================================================ */

  const fixture = JSON.parse(readFileSync('docs/examples/top-open-source-alternatives.velgic-manifest.json', 'utf8'))
  const fixtureIssues = validateManifest(fixture)
  expect('fixture metadata.json is a valid manifest', fixtureIssues.length === 0, JSON.stringify(fixtureIssues))

  const countsBefore = {
    contents: useStore.getState().contents.length,
    campaigns: useStore.getState().campaigns.length,
    platformContents: useStore.getState().platformContents.length,
  }
  const imported = useStore.getState().importCampaign(fixture)
  expect('importCampaign succeeds with no issues', imported.issues.length === 0 && !!imported.campaignId)

  const s = useStore.getState()
  const c = s.contents.find((i) => i.id === 'content-05')
  const k = s.campaigns.find((i) => i.id === 'camp-05')
  const pcs = s.platformContents.filter((i) => i.campaignId === 'camp-05')
  const pc = (platform: string) => pcs.find((p) => p.platform === platform)!

  expect('content created', !!c)
  expect('content.title', c?.title === 'Top open-source alternatives for content creators')
  expect('content.concept', c?.concept.includes('open-source replacements'))
  expect('content.origin', c?.origin === 'research')
  expect('content.audience', c?.audience === 'Technical creators')
  expect('content.contentType', c?.contentType === 'short_video')
  expect('content.format', c?.format === 'Vertical short-form, under 60s')
  expect('content.hook', c?.hook.includes('You do not need to pay'))
  expect('content.draft', c?.draft.includes('Hook → the three tools'))
  expect('content.notes', c?.notes.includes('ossinsight'))
  expect('content.status', c?.status === 'in_production')

  expect('campaign created + linked', !!k && k.contentId === 'content-05')
  expect('campaign.name', k?.name === 'Top Open Source Alternatives')
  expect('campaign.description', k?.description.includes('Launch-week distribution'))
  expect('campaign.status', k?.status === 'partially_published')
  expect('campaign.platforms', JSON.stringify([...(k?.platforms ?? [])].sort()) === JSON.stringify(['instagram', 'linkedin', 'x', 'youtube']))
  expect('4 platform versions imported', pcs.length === 4)

  // Instagram
  expect('IG: format Reel', pc('instagram').format === 'Reel')
  expect('IG: status published', pc('instagram').status === 'published')
  expect('IG: publishedUrl', pc('instagram').publishedUrl === 'https://www.instagram.com/reel/oss-creators')
  expect('IG: publishedAt', pc('instagram').publishedAt === '2026-08-15T10:30:00Z')
  expect('IG: schedule disabled', pc('instagram').schedule.enabled === false)
  expect('IG: notes', pc('instagram').notes.includes('pinned comment'))
  expect('IG: caption', pc('instagram').instagram?.caption.includes('creator stack'))
  expect('IG: hashtags', JSON.stringify(pc('instagram').instagram?.hashtags) === JSON.stringify(['#opensource', '#creators', '#buildinpublic']))
  expect('IG: location', pc('instagram').instagram?.location === 'Remote studio')
  const igAsset = pc('instagram').assets[0]
  expect('IG: asset reference fields', igAsset.asset_id === 'instagram-reel-21' && igAsset.filename === 'oss-reel.mp4' && igAsset.type === 'video' && igAsset.reference === 'instagram/oss-reel.mp4' && igAsset.provider === 'local' && igAsset.role === 'media')
  expect('IG: asset optional metadata', igAsset.mimeType === 'video/mp4' && igAsset.size === 24800000 && igAsset.duration === 42)

  // YouTube
  expect('YT: format Short', pc('youtube').format === 'Short')
  expect('YT: status scheduled', pc('youtube').status === 'scheduled')
  expect('YT: schedule enabled + ISO 8601 datetime', pc('youtube').schedule.enabled === true && pc('youtube').schedule.datetime === '2026-08-20T18:00:00+05:30')
  expect('YT: timezone', pc('youtube').schedule.timezone === 'Asia/Kolkata')
  expect('YT: notes', pc('youtube').notes.includes('Thumbnail A/B'))
  expect('YT: title', pc('youtube').youtube?.title === 'Top open-source alternatives for content creators')
  expect('YT: description', pc('youtube').youtube?.description.includes('honest caveat per tool'))
  expect('YT: tags', JSON.stringify(pc('youtube').youtube?.tags) === JSON.stringify(['open source', 'creator tools', 'oss']))
  expect('YT: video + thumbnail roles', pc('youtube').assets.some((a) => a.role === 'video') && pc('youtube').assets.some((a) => a.role === 'thumbnail'))
  expect('YT: thumbnail asset metadata', pc('youtube').assets.find((a) => a.role === 'thumbnail')?.mimeType === 'image/jpeg')

  // LinkedIn
  expect('LI: format Post', pc('linkedin').format === 'Post')
  expect('LI: status ready', pc('linkedin').status === 'ready')
  expect('LI: notes', pc('linkedin').notes.includes('launch day'))
  expect('LI: post text', pc('linkedin').linkedin?.postText.includes('paid subscription'))
  expect('LI: no assets (empty array)', pc('linkedin').assets.length === 0)

  // X
  expect('X: format Thread', pc('x').format === 'Thread')
  expect('X: status draft', pc('x').status === 'draft')
  expect('X: notes', pc('x').notes.includes('second post'))
  expect('X: is_thread true', pc('x').x?.isThread === true)
  expect('X: thread rejoined into content', (pc('x').x?.content ?? '').includes('Bookmark the ones worth that trade'))
  expect('X: content contains 4 posts', (pc('x').x?.content ?? '').split('\n\n').length === 4)

  expect('import added exactly one content/campaign + four platforms', s.contents.length === countsBefore.contents + 1 && s.campaigns.length === countsBefore.campaigns + 1 && s.platformContents.length === countsBefore.platformContents + 4)

  // UI verification of the imported campaign page.
  window.location.hash = '#/campaigns/camp-05'
  await tick()
  expect('imported campaign renders', text().includes('Top Open Source Alternatives'))
  const importedCards = $$('.platform-card')
  expect('imported campaign shows 4 platform versions', importedCards.length === 4)
  const importedIg = importedCards.find((c) => c.querySelector('.platform-card__name')?.textContent === 'Instagram')!
  expect(
    'UI: imported IG caption populated',
    (importedIg.querySelector('.platform-card__body textarea') as HTMLTextAreaElement)?.value.includes('creator stack') ?? false,
  )
  expect(
    'UI: imported IG location populated',
    (Array.from(importedIg.querySelectorAll('input')).find((i) => i.placeholder === 'San Francisco, CA') as HTMLInputElement)?.value ===
      'Remote studio',
  )
  expect(
    'UI: imported IG published URL populated',
    (Array.from(importedIg.querySelectorAll('input')).find((i) => i.placeholder === 'https://…') as HTMLInputElement)?.value ===
      'https://www.instagram.com/reel/oss-creators',
  )
  const importedYt = importedCards.find((c) => c.querySelector('.platform-card__name')?.textContent === 'YouTube')!
  expect(
    'UI: imported YT title populated',
    (Array.from(importedYt.querySelectorAll('input')).find((i) => i.placeholder === 'Why AI agents get stuck in loops') as HTMLInputElement)?.value ===
      'Top open-source alternatives for content creators',
  )
  expect('UI: imported YT schedule enabled + datetime shown', (importedYt.querySelector('.sched-box__toggle .checkbox') as HTMLInputElement)?.checked === true && importedYt.querySelector('input[type="datetime-local"]') != null)
  const importedX = importedCards.find((c) => c.querySelector('.platform-card__name')?.textContent === 'X (Twitter)')!
  expect(
    'UI: imported X thread populated',
    (importedX.querySelector('.platform-card__body textarea') as HTMLTextAreaElement)?.value.includes('setup time') ?? false,
  )
  expect('UI: imported campaign status badge', text().includes('Partially Published'))

  /* ================================================================ */
  section('4. Invalid manifests are rejected with useful errors')
  /* ================================================================ */

  const clone = () => JSON.parse(JSON.stringify(fixture))
  const codesOf = (input: unknown) => validateManifest(input).map((i) => i.code)
  const parseCodesOf = (raw: string) => parseManifestText(raw).issues.map((i) => i.code)

  expect('rejects: invalid JSON text', parseCodesOf('this is { not json') .join(',') === 'INVALID_JSON')
  expect('rejects: unsupported schema version', codesOf({ schema_version: '9.9' }).join(',') === 'UNSUPPORTED_SCHEMA_VERSION')
  expect('rejects: missing schema version', codesOf({ platforms: [] }).join(',') === 'UNSUPPORTED_SCHEMA_VERSION')
  expect('rejects: missing campaign', codesOf({ schema_version: '1.0' }).includes('MISSING_CAMPAIGN'), codesOf({ schema_version: '1.0' }).join(','))
  const noName = clone(); noName.campaign.name = ''
  expect('rejects: empty campaign name', codesOf(noName).join(',') === 'MISSING_CAMPAIGN')
  const noPlatforms = clone(); noPlatforms.platforms = []
  expect('rejects: missing platforms', codesOf(noPlatforms).join(',') === 'MISSING_PLATFORM')
  const tiktok = clone(); tiktok.platforms[0].platform = 'tiktok'
  expect('rejects: unknown platform', codesOf(tiktok).join(',') === 'INVALID_PLATFORM_FORMAT')
  const igtv = clone(); igtv.platforms[0].format = 'IGTV'
  expect('rejects: invalid platform format', codesOf(igtv).join(',') === 'INVALID_PLATFORM_FORMAT')
  const noCaption = clone(); delete noCaption.platforms[0].metadata.caption
  expect('rejects: missing required platform metadata', codesOf(noCaption).join(',') === 'MISSING_REQUIRED_METADATA')
  const enabledNoDate = clone(); enabledNoDate.platforms[1].schedule = { enabled: true, datetime: null, timezone: null }
  expect('rejects: schedule enabled without datetime', codesOf(enabledNoDate).join(',') === 'INVALID_DATETIME')
  const badDate = clone(); badDate.platforms[1].schedule.datetime = 'tomorrow at 6pm'
  expect('rejects: invalid ISO 8601 datetime', codesOf(badDate).includes('INVALID_DATETIME'), codesOf(badDate).join(','))
  const badAsset = clone(); badAsset.platforms[0].assets[0].reference = ''
  expect('rejects: invalid asset reference (empty reference)', codesOf(badAsset).join(',') === 'INVALID_ASSET_REFERENCE')
  const badAssetType = clone(); badAssetType.platforms[0].assets[0].type = 'hologram'
  expect('rejects: invalid asset reference (unknown type)', codesOf(badAssetType).join(',') === 'INVALID_ASSET_REFERENCE')
  const badStatus = clone(); badStatus.platforms[2].status = 'archived'
  expect('rejects: invalid platform status', codesOf(badStatus).join(',') === 'INVALID_STATUS')
  const badUrl = clone(); badUrl.platforms[0].published_url = 'not-a-url'
  expect('rejects: invalid published URL', codesOf(badUrl).join(',') === 'INVALID_PUBLISHED_URL')
  const badContentType = clone(); badContentType.campaign.content.content_type = 'meme'
  expect('rejects: invalid content type', codesOf(badContentType).join(',') === 'INVALID_CONTENT_TYPE')

  // Atomicity: failed imports must not change the store.
  const countsBeforeInvalid = {
    contents: useStore.getState().contents.length,
    campaigns: useStore.getState().campaigns.length,
    platformContents: useStore.getState().platformContents.length,
  }
  const badImport = useStore.getState().importCampaign(igtv as never)
  const countsAfterInvalid = {
    contents: useStore.getState().contents.length,
    campaigns: useStore.getState().campaigns.length,
    platformContents: useStore.getState().platformContents.length,
  }
  expect(
    'no partial import (store unchanged after rejected manifest)',
    badImport.issues.length > 0 && JSON.stringify(countsBeforeInvalid) === JSON.stringify(countsAfterInvalid),
  )

  // UI: paste invalid JSON → useful validation errors shown.
  button('Import manifest')?.click()
  await tick()
  const importTa = $('.import-area__text') as HTMLTextAreaElement
  setValue(importTa, '{"schema_version": "1.0", "campaign": {')
  button('Validate')?.click()
  await tick()
  expect('UI: invalid JSON shows INVALID_JSON error', text().includes('INVALID_JSON'))
  expect('UI: error message is human-readable', text().includes('The pasted text is not valid JSON'))
  setValue(importTa, JSON.stringify(tiktok))
  button('Validate')?.click()
  await tick()
  expect('UI: unknown platform error shown with path', text().includes('INVALID_PLATFORM_FORMAT') && text().includes('$.platforms[0].platform') && text().includes('Unknown platform "tiktok"'))
  expect('UI: validation failure states nothing was imported', text().includes('Validation failed — nothing was imported'))
  ;(Array.from(document.querySelectorAll('.modal__footer button')).find((b) => b.textContent === 'Cancel') as HTMLElement)?.click()
  await tick()

  /* ================================================================ */
  section('5. Export the campaign manifest')
  /* ================================================================ */

  const stateNow = useStore.getState()
  const exportCampaign = stateNow.campaigns.find((c) => c.id === 'camp-05')!
  const exportContent = stateNow.contents.find((c) => c.id === exportCampaign.contentId) ?? null
  const exportPcs = stateNow.platformContents.filter((p) => p.campaignId === 'camp-05')

  const manifest = buildManifest({ campaign: exportCampaign, content: exportContent, platformContents: exportPcs })
  expect('export manifest schema_version 1.0', manifest.schema_version === MANIFEST_SCHEMA_VERSION)
  expect('export manifest carries campaign + content + 4 platforms', manifest.campaign.name === 'Top Open Source Alternatives' && manifest.campaign.content?.title === 'Top open-source alternatives for content creators' && manifest.platforms.length === 4)
  const exportIssues = validateManifest(manifest)
  expect('exported manifest validates cleanly', exportIssues.length === 0, JSON.stringify(exportIssues))

  exportCampaignManifest(exportCampaign, exportContent, exportPcs)
  expect('download triggered with a .json filename', capturedDownload.filename === 'velgic-manifest-top-open-source-alternatives.json')
  const downloaded = await (capturedDownload.blob as Blob).text()
  const downloadedJson = JSON.parse(downloaded)
  expect('downloaded file is the canonical JSON', downloadedJson.schema_version === '1.0' && downloadedJson.campaign.id === 'camp-05')

  const copied = await copyCampaignManifest(exportCampaign, exportContent, exportPcs)
  expect('Copy JSON resolves successfully', copied === true)

  /* ================================================================ */
  section('6. Persistence (refresh simulation)')
  /* ================================================================ */

  const persisted = JSON.parse(dom.window.localStorage.getItem('velgic') ?? '{}')
  expect('localStorage contains content model', Array.isArray(persisted.state?.contents) && Array.isArray(persisted.state?.campaigns) && Array.isArray(persisted.state?.platformContents))
  expect('imported campaign persisted', persisted.state.campaigns.some((c: { id: string }) => c.id === 'camp-05'))
  expect('imported platform versions persisted', persisted.state.platformContents.filter((p: { campaignId: string }) => p.campaignId === 'camp-05').length === 4)

  /* ================================================================ */
  console.log(`\n==============================`)
  console.log(`ACCEPTANCE RESULT: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.log('Failed checks:')
    for (const f of failures) console.log(`  - ${f}`)
    process.exit(1)
  }
  console.log('ALL PUBLISHING-MANIFEST ACCEPTANCE CHECKS PASS')
  process.exit(0)
}

main().catch((e) => {
  console.error('ACCEPTANCE CRASH:', e)
  process.exit(1)
})
