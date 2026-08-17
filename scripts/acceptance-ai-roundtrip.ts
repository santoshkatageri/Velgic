/**
 * Final V2 validation — external AI round-trip (simulated external tool)
 * ======================================================================
 * Velgic deliberately has no paid AI API, so this harness plays the role of
 * an external AI tool (ChatGPT / Gemini / Claude / Grok) with full fidelity:
 *
 *   1. Reads the EXACT generated Velgic AI prompt for the seeded test campaign
 *      "Top Open Source Alternatives for Content Creators"
 *      (docs/velgic-ai-prompt-example.txt).
 *   2. "External AI": consumes ONLY the prompt — parses the embedded EXAMPLE
 *      shape, the {{PLACEHOLDER}} CONTEXT, the RULES, and the EXISTING
 *      PLATFORM TEXT — and returns a manifest JSON. If the prompt is missing
 *      something the rules require, the AI's best-effort output exposes it.
 *   3. Writes the AI's response as a real metadata.json
 *      (docs/examples/metadata.ai-roundtrip.json).
 *   4. Imports it into Velgic and verifies: JSON parses, schema 1.0 validates,
 *      no hallucinated assets, no invented URLs, platform formats correct,
 *      per-platform metadata correct, X thread structure correct, schedules
 *      valid, asset references preserved, imported data renders correctly,
 *      persistence.
 *   5. Negative phase: hallucinating AI responses (invented asset/URL/platform,
 *      wrong format, broken datetime, missing metadata) must be rejected with
 *      the right codes and no partial import.
 *
 * Run from the repository root:
 *
 *   npm install --no-save jsdom
 *   npx esbuild scripts/acceptance-ai-roundtrip.ts --bundle --format=cjs \
 *     --platform=node --external:react --external:react-dom \
 *     --external:react-dom/client --external:react-router-dom \
 *     --external:zustand --external:zustand/middleware --external:jsdom \
 *     --outfile=scripts/acceptance-ai-roundtrip.cjs --log-level=error
 *   node scripts/acceptance-ai-roundtrip.cjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
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
Object.defineProperty(g, 'Element', { value: dom.window.Element, configurable: true })
Object.defineProperty(g, 'Event', { value: dom.window.Event, configurable: true })
Object.defineProperty(g, 'getComputedStyle', { value: dom.window.getComputedStyle.bind(dom.window), configurable: true })
Object.defineProperty(g, 'localStorage', { value: dom.window.localStorage, configurable: true })

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
function note(msg: string) {
  console.log(`  NOTE: ${msg}`)
}
function section(title: string) {
  console.log(`\n[${title}]`)
}

const $$ = (sel: string) => Array.from(document.querySelectorAll(sel)) as HTMLElement[]
const text = () => document.body.textContent ?? ''

/* ------------------------------------------------------------------ */
/* Simulated external AI: consumes ONLY the prompt, returns JSON        */
/* ------------------------------------------------------------------ */
interface ParsedAsset {
  asset_id: string
  filename: string | null
  type: string
  reference: string
  provider: string
  role: string | null
  mimeType: string | null
  size: number | null
  duration: number | null
  platform: string
}

interface AIRoundTrip {
  manifest: Record<string, unknown>
  report: {
    scheduleIsoProvided: boolean
    ytIso: string | null
    assets: ParsedAsset[]
  }
}

function simulateExternalAI(prompt: string): AIRoundTrip {
  const lines = prompt.split('\n')

  // 1) The EXAMPLE JSON is the schema shape the AI starts from.
  const exampleMarker = 'EXAMPLE (match this shape and key names exactly)'
  const example = JSON.parse(prompt.slice(prompt.indexOf(exampleMarker) + exampleMarker.length).trim())

  // 2) {{PLACEHOLDER}} CONTEXT.
  const lineOf = (label: string) => lines.find((l) => l.startsWith(label + ':'))
  const get = (label: string): string => block(label)[0] ?? ''
  const block = (label: string): string[] => {
    const start = lines.findIndex((l) => l.startsWith(`{{${label}}}:`))
    if (start < 0) return []
    const out: string[] = []
    // Values may sit inline on the {{LABEL}}: line or on continuation lines.
    const first = lines[start].slice(`{{${label}}}:`.length).trim()
    if (first) out.push(first)
    for (let i = start + 1; i < lines.length; i++) {
      const l = lines[i]
      if (l.startsWith('{{') || l.trim() === '') break
      out.push(l.trim())
    }
    return out
  }

  const title = get('CONTENT_TITLE')
  const concept = get('CONTENT_CONCEPT')
  const contentType = get('CONTENT_TYPE')
  const format = get('CONTENT_FORMAT')
  const audience = get('TARGET_AUDIENCE')
  const contentStatus = get('CONTENT_STATUS')
  const origin = get('CONTENT_ORIGIN') || (example.campaign?.content?.origin as string) || 'direct'
  const hook = get('HOOK') || null
  const timezone = get('TIMEZONE') || null
  const hashtags = get('HASHTAGS')
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean)
  const locationRaw = get('LOCATION')
  const location = !locationRaw || locationRaw.startsWith('{{') ? null : locationRaw

  const campaignName = (lineOf('CAMPAIGN NAME') ?? '').replace(/^CAMPAIGN NAME:\s*/, '')
  const campaignStatus = (lineOf('CAMPAIGN STATUS') ?? '').replace(/^CAMPAIGN STATUS:\s*/, '')
  const campaignDescription = (lineOf('CAMPAIGN DESCRIPTION') ?? '').replace(/^CAMPAIGN DESCRIPTION:\s*/, '')

  // Platforms + formats from the prompt.
  const platformsLine = get('PLATFORMS')
  const platformFormats = platformsLine.split(',').map((s) => {
    const m = s.trim().match(/^(\w+) \((.+)\)$/)!
    return { platform: m[1], format: m[2] }
  })

  // Asset references (the AI must preserve these unchanged).
  const assets: ParsedAsset[] = block('ASSETS').map((l) => {
    const kv: Record<string, string> = {}
    l.split('|').forEach((seg, idx) => {
      const s = seg.trim()
      if (idx === 0) return // reference
      const eq = s.indexOf('=')
      if (eq > 0) kv[s.slice(0, eq)] = s.slice(eq + 1)
    })
    return {
      asset_id: kv.asset_id,
      filename: kv.filename ?? null,
      type: kv.type,
      reference: l.split('|')[0].trim(),
      provider: kv.provider ?? 'local',
      role: kv.role && kv.role !== 'null' ? kv.role : null,
      mimeType: kv.mimeType && kv.mimeType !== 'null' ? kv.mimeType : null,
      size: kv.size && kv.size !== 'null' ? Number(kv.size) : null,
      duration: kv.duration && kv.duration !== 'null' ? Number(kv.duration) : null,
      platform: kv.platform,
    }
  })

  // Schedules: the AI obeys "Do not invent dates" — it copies ISO values when
  // the prompt provides them, otherwise it must reconstruct from the human text.
  const scheduleIsoProvided = block('SCHEDULE').some((l) => /^\w+:\s*\d{4}-\d{2}-\d{2}T/.test(l))
  let scheduleReconstructed = false
  const schedules: Record<string, { iso: string | null; timezone: string | null }> = {}
  for (const l of block('SCHEDULE')) {
    const m = l.match(/^(\w+):\s+(.+)$/)
    if (!m) continue
    const rest = m[2]
    const iso = rest.match(/^(\d{4}-\d{2}-\d{2}T[\d:.+\-]+Z?)/)
    if (iso) {
      schedules[m[1]] = { iso: iso[1], timezone }
    } else {
      // Reconstruct a best-effort ISO datetime from the human text (what a real
      // external AI is forced to do when the prompt lacks ISO values).
      const tzM = rest.match(/·\s*([\w/+-]+)\s*$/)
      const tz = tzM ? tzM[1] : timezone
      const datePart = rest.split('·')[0].trim()
      const year = new Date().getFullYear()
      const ms = Date.parse(`${datePart} ${year}`)
      const reconstructed = Number.isNaN(ms) ? null : new Date(ms).toISOString()
      schedules[m[1]] = { iso: reconstructed, timezone: tz || timezone }
      if (reconstructed) scheduleReconstructed = true
    }
  }

  // Published URLs: only what the prompt provides — nothing invented.
  const publishedUrls: Record<string, string> = {}
  for (const l of block('PUBLISHED_URL')) {
    const m = l.match(/^(\w+):\s+(.+)$/)
    if (m) publishedUrls[m[1]] = m[2]
  }

  // Existing platform text (the AI must preserve/improve, not discard).
  const ptStart = lines.findIndex((l) => l.startsWith('EXISTING PLATFORM TEXT'))
  const sections: Record<string, Record<string, string>> = {}
  let current: string | null = null
  let lastKey = ''
  for (let i = ptStart + 1; i < lines.length; i++) {
    const l = lines[i]
    if (l === 'RULES') break
    const pm = l.match(/^\[(\w+) · .+ · (\w+)\]$/)
    if (pm) {
      current = pm[1]
      sections[current] = { _status: pm[2].toLowerCase() }
      lastKey = ''
      continue
    }
    if (!current) continue
    const km = l.match(/^([a-z_/]+):\s?(.*)$/)
    if (km) {
      sections[current][km[1]] = km[2]
      lastKey = km[1]
    } else if (lastKey) {
      sections[current][lastKey] += '\n' + l
    }
  }

  // 3) Assemble the manifest from the prompt content only.
  const platforms = platformFormats.map(({ platform, format: fmt }, i) => {
    const sec = sections[platform] ?? {}
    const sched = schedules[platform]
    const platformAssets = assets.filter((a) => a.platform === platform)
    let metadata: Record<string, unknown>
    if (platform === 'instagram') {
      metadata = {
        caption: sec.caption ?? '',
        hashtags,
        location,
      }
    } else if (platform === 'youtube') {
      metadata = {
        title: sec.title ?? title,
        description: sec.description ?? '',
        tags: (sec.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
      }
    } else if (platform === 'linkedin') {
      metadata = { post_text: sec.post ?? '' }
    } else {
      const content = sec['post/thread'] ?? ''
      const thread = content.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean)
      metadata = { content, is_thread: thread.length > 1, thread: thread.length > 1 ? thread : null }
    }
    return {
      platform,
      id: `pc-ai-${i + 1}`,
      format: fmt,
      status: sec._status ?? 'draft',
      schedule: sched?.iso
        ? { enabled: true, datetime: sched.iso, timezone: sched.timezone }
        : { enabled: false, datetime: null, timezone: null },
      published_url: publishedUrls[platform] ?? null,
      published_at: null,
      assets: platformAssets.map((a) => ({
        asset_id: a.asset_id,
        filename: a.filename ?? a.reference.split('/').pop() ?? '',
        type: a.type,
        reference: a.reference,
        provider: a.provider,
        role: a.role,
        mimeType: a.mimeType,
        size: a.size,
        duration: a.duration,
      })),
      notes: null,
      metadata,
    }
  })

  return {
    manifest: {
      schema_version: '1.0',
      manifest_id: 'velgic-manifest-ai-roundtrip',
      generated_at: new Date().toISOString(),
      timezone,
      brand: { name: null, voice: null, handle: null },
      campaign: {
        id: 'camp-ai',
        name: campaignName,
        description: campaignDescription || null,
        status: campaignStatus,
        content: {
          id: 'content-ai',
          title,
          concept,
          origin,
          audience,
          content_type: contentType,
          format: format || null,
          hook,
          draft: null,
          notes: null,
          status: contentStatus,
          linked_idea_id: null,
          linked_experiment_id: null,
        },
      },
      platforms,
    },
    report: {
      scheduleIsoProvided,
      scheduleReconstructed,
      ytIso: schedules.youtube?.iso ?? null,
      assets,
    },
  }
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */
async function main() {
  dom.window.localStorage.clear()

  const React = (await import('react')).default
  const { createRoot } = await import('react-dom/client')
  const { HashRouter } = await import('react-router-dom')
  const { default: App } = await import('../src/App')
  const { validateManifest, parseManifestText } = await import('../src/lib/manifest')
  const { useStore } = await import('../src/store/useStore')

  const PROMPT_PATH = 'docs/velgic-ai-prompt-example.txt'
  const FIXTURE_PATH = 'docs/examples/metadata.ai-roundtrip.json'

  const prompt = readFileSync(PROMPT_PATH, 'utf8')
  section('0. Prompt under test')
  expect('prompt file exists and is the Velgic AI prompt', prompt.startsWith('VELGIC PUBLISHING MANIFEST — AI GENERATION PROMPT'))
  expect('prompt schema version 1.0', prompt.includes('Schema version: 1.0'))

  section('1. External AI consumes the prompt and returns JSON')
  const { manifest, report } = simulateExternalAI(prompt)
  writeFileSync(FIXTURE_PATH, JSON.stringify(manifest, null, 2))

  const aiResponse = readFileSync(FIXTURE_PATH, 'utf8')
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(aiResponse)
    expect('AI response parses as JSON', true)
  } catch (e) {
    expect('AI response parses as JSON', false, String(e))
    throw e
  }

  expect('AI response declares schema_version 1.0', parsed.schema_version === '1.0')
  const validateIssues = validateManifest(parsed)
  expect('AI response validates against Velgic schema 1.0', validateIssues.length === 0, JSON.stringify(validateIssues))
  expect('import parser accepts it with no issues', parseManifestText(aiResponse).issues.length === 0)

  section('2. Import the AI response as metadata.json')
  const countsBefore = {
    contents: useStore.getState().contents.length,
    campaigns: useStore.getState().campaigns.length,
    platformContents: useStore.getState().platformContents.length,
  }
  const res = useStore.getState().importCampaign(parsed as never)
  expect('importCampaign succeeds', res.issues.length === 0 && !!res.campaignId)

  const s = useStore.getState()
  const content = s.contents.find((c) => c.id === 'content-ai')
  const campaign = s.campaigns.find((c) => c.id === 'camp-ai')
  const pcs = s.platformContents.filter((p) => p.campaignId === 'camp-ai')
  const pc = (platform: string) => pcs.find((p) => p.platform === platform)!

  expect('content imported', !!content)
  expect('content.title from prompt', content?.title === 'Top open-source alternatives for content creators')
  expect('content.concept from prompt', content?.concept.includes('open-source replacements'))
  expect('content.origin from prompt', content?.origin === 'research')
  expect('content.audience from prompt', content?.audience === 'Technical creators')
  expect('content.contentType from prompt', content?.contentType === 'short_video')
  expect('content.status from prompt', content?.status === 'in_production')
  expect('campaign imported + linked', !!campaign && campaign.contentId === 'content-ai')
  expect('campaign.name from prompt', campaign?.name === 'Top Open Source Alternatives')
  expect('campaign.status from prompt', campaign?.status === 'partially_published')
  expect('4 platform versions imported', pcs.length === 4)
  expect(
    'import added exactly 1 content + 1 campaign + 4 platforms',
    s.contents.length === countsBefore.contents + 1 &&
      s.campaigns.length === countsBefore.campaigns + 1 &&
      s.platformContents.length === countsBefore.platformContents + 4,
  )

  section('3. No hallucinated assets / invented URLs')
  const promptAssets = report.assets
  const importedAssets = pcs.flatMap((p) => p.assets)
  expect('asset count matches the prompt exactly', importedAssets.length === promptAssets.length && importedAssets.length === 3)
  for (const pa of promptAssets) {
    const ia = importedAssets.find((a) => a.asset_id === pa.asset_id)
    expect(
      `asset "${pa.asset_id}" preserved exactly (reference, filename, type, role, provider)`,
      !!ia &&
        ia.reference === pa.reference &&
        ia.filename === (pa.filename ?? pa.reference.split('/').pop()) &&
        ia.type === pa.type &&
        (ia.role ?? null) === pa.role &&
        (ia.provider || 'local') === pa.provider,
      JSON.stringify({ expected: pa, got: ia }),
    )
  }
  expect(
    'no unknown asset ids (nothing invented)',
    importedAssets.every((a) => promptAssets.some((p) => p.asset_id === a.asset_id)),
  )
  const promptUrlMap: Record<string, string> = {}
  for (const l of (() => {
    // Reuse the block() logic inline for {{PUBLISHED_URL}} (defined in the simulator).
    const start = prompt.split('\n').findIndex((x) => x.startsWith('{{PUBLISHED_URL}}:'))
    if (start < 0) return [] as string[]
    const out: string[] = []
    const first = prompt.split('\n')[start].slice('{{PUBLISHED_URL}}:'.length).trim()
    if (first) out.push(first)
    for (let i = start + 1; i < prompt.split('\n').length; i++) {
      const x = prompt.split('\n')[i]
      if (x.startsWith('{{') || x.trim() === '') break
      out.push(x.trim())
    }
    return out
  })()) {
    const m = l.match(/^(\w+):\s+(.+)$/)
    if (m) promptUrlMap[m[1]] = m[2]
  }
  for (const p of pcs) {
    expect(
      `published_url for ${p.platform} matches prompt (no invented URLs)`,
      (p.publishedUrl ?? null) === (promptUrlMap[p.platform] ?? null),
      JSON.stringify({ expected: promptUrlMap[p.platform] ?? null, got: p.publishedUrl }),
    )
  }
  expect('exactly one published URL across the campaign (the prompt provided one)', pcs.filter((p) => p.publishedUrl).length === 1)

  section('4. Platform formats + metadata + thread + schedules')
  expect('IG format is Reel', pc('instagram').format === 'Reel')
  expect('YT format is Short', pc('youtube').format === 'Short')
  expect('LI format is Post', pc('linkedin').format === 'Post')
  expect('X format is Thread', pc('x').format === 'Thread')

  expect('IG status Published', pc('instagram').status === 'published')
  expect('YT status Scheduled', pc('youtube').status === 'scheduled')
  expect('LI status Ready', pc('linkedin').status === 'ready')
  expect('X status Draft', pc('x').status === 'draft')

  expect('IG caption from prompt', (pc('instagram').instagram?.caption ?? '').includes('creator stack'))
  expect('IG hashtags from prompt', JSON.stringify(pc('instagram').instagram?.hashtags) === JSON.stringify(['#opensource', '#creators', '#buildinpublic']))
  expect('IG location unset (prompt had no value)', (pc('instagram').instagram?.location ?? '') === '')

  expect('YT title from prompt', pc('youtube').youtube?.title === 'Top open-source alternatives for content creators')
  expect('YT description from prompt', (pc('youtube').youtube?.description ?? '').includes('honest caveat per tool'))
  expect('YT tags from prompt', JSON.stringify(pc('youtube').youtube?.tags) === JSON.stringify(['open source', 'creator tools', 'oss']))
  expect('YT has video + thumbnail asset refs', pc('youtube').assets.some((a) => a.role === 'video') && pc('youtube').assets.some((a) => a.role === 'thumbnail'))

  expect('LI post text from prompt', (pc('linkedin').linkedin?.postText ?? '').includes('paid subscription'))

  const xContent = pc('x').x?.content ?? ''
  expect('X content rejoined from prompt', xContent.includes('Bookmark the ones worth that trade'))
  expect('X is_thread true', pc('x').x?.isThread === true)
  expect('X content holds 4 posts (blank-line separated)', xContent.split('\n\n').length === 4)

  expect('IG schedule disabled/null', pc('instagram').schedule.enabled === false && pc('instagram').schedule.datetime === null)
  expect('LI schedule disabled/null', pc('linkedin').schedule.enabled === false && pc('linkedin').schedule.datetime === null)
  expect('X schedule disabled/null', pc('x').schedule.enabled === false && pc('x').schedule.datetime === null)
  expect('YT schedule enabled', pc('youtube').schedule.enabled === true)
  expect('YT schedule datetime is valid ISO 8601', !Number.isNaN(Date.parse(pc('youtube').schedule.datetime ?? '')))
  expect('YT schedule timezone Asia/Kolkata', pc('youtube').schedule.timezone === 'Asia/Kolkata')
  if (report.scheduleIsoProvided) {
    expect('YT schedule datetime preserved EXACTLY from the prompt', pc('youtube').schedule.datetime === report.ytIso, JSON.stringify({ prompt: report.ytIso, imported: pc('youtube').schedule.datetime }))
  } else {
    note(`prompt provided no ISO datetimes — the AI had to reconstruct the schedule from human text ("${pc('youtube').schedule.datetime}")`)
  }

  section('5. Imported data renders correctly')
  const root = createRoot(document.getElementById('root')!)
  root.render(React.createElement(HashRouter, null, React.createElement(App)))
  await tick()
  window.location.hash = '#/campaigns/camp-ai'
  await tick()

  expect('imported campaign page renders', text().includes('Top Open Source Alternatives'))
  const cards = $$('.platform-card')
  expect('4 platform cards render', cards.length === 4)
  const card = (name: string) => cards.find((c) => (c.querySelector('.platform-card__name')?.textContent ?? '') === name)!

  const ig = card('Instagram')
  expect('UI: IG status Published badge', ig.querySelector('.platform-card__head-right')?.textContent?.includes('Published') ?? false)
  expect('UI: IG caption rendered', (ig.querySelector('.platform-card__body textarea') as HTMLTextAreaElement)?.value.includes('creator stack') ?? false)
  expect('UI: IG hashtags rendered', (Array.from(ig.querySelectorAll('input')).find((i) => i.value.includes('#opensource')) as HTMLInputElement)?.value === '#opensource, #creators, #buildinpublic')
  expect(
    'UI: IG published URL rendered',
    (Array.from(ig.querySelectorAll('input')).find((i) => i.placeholder === 'https://…') as HTMLInputElement)?.value === 'https://www.instagram.com/reel/oss-creators',
  )
  expect('UI: IG asset reference rendered', ig.textContent?.includes('instagram-reel-03') ?? false)

  const yt = card('YouTube')
  expect('UI: YT status Scheduled badge', yt.querySelector('.platform-card__head-right')?.textContent?.includes('Scheduled') ?? false)
  expect(
    'UI: YT title rendered',
    (Array.from(yt.querySelectorAll('input')).find((i) => i.placeholder === 'Why AI agents get stuck in loops') as HTMLInputElement)?.value === 'Top open-source alternatives for content creators',
  )
  expect('UI: YT schedule checkbox on + datetime shown', (yt.querySelector('.sched-box__toggle .checkbox') as HTMLInputElement)?.checked === true && yt.querySelector('input[type="datetime-local"]') != null)
  expect('UI: YT video + thumbnail refs rendered', (yt.querySelectorAll('.asset-box').length ?? 0) === 2)

  const li = card('LinkedIn')
  expect('UI: LI status Ready badge', li.querySelector('.platform-card__head-right')?.textContent?.includes('Ready') ?? false)
  expect('UI: LI post text rendered', (li.querySelector('.platform-card__body textarea') as HTMLTextAreaElement)?.value.includes('paid subscription') ?? false)

  const x = card('X (Twitter)')
  expect('UI: X status Draft badge', x.querySelector('.platform-card__head-right')?.textContent?.includes('Draft') ?? false)
  expect('UI: X thread rendered with all 4 posts', (x.querySelector('.platform-card__body textarea') as HTMLTextAreaElement)?.value.includes('Bookmark the ones worth that trade') ?? false)
  expect('UI: campaign status badge Partially Published', text().includes('Partially Published'))

  section('6. Persistence (refresh simulation)')
  const persisted = JSON.parse(dom.window.localStorage.getItem('velgic') ?? '{}')
  expect('imported campaign persisted', (persisted.state?.campaigns ?? []).some((c: { id: string }) => c.id === 'camp-ai'))
  expect('4 imported platform versions persisted', (persisted.state?.platformContents ?? []).filter((p: { campaignId: string }) => p.campaignId === 'camp-ai').length === 4)

  section('7. Hallucinating AI responses are rejected (defense in depth)')
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
  const clone = () => JSON.parse(JSON.stringify(fixture))
  const codesOf = (m: unknown) => validateManifest(m).map((i) => i.code)

  const negCases: Array<[string, (m: any) => void, string]> = [
    ['hallucinated asset with unknown type', (m) => { m.platforms[0].assets[0].type = 'hologram' }, 'INVALID_ASSET_REFERENCE'],
    ['asset reference stripped (AI "forgot" it)', (m) => { m.platforms[0].assets[0].reference = '' }, 'INVALID_ASSET_REFERENCE'],
    ['invented malformed URL', (m) => { m.platforms[2].published_url = 'linkedin.com/posts/ai-invented' }, 'INVALID_PUBLISHED_URL'],
    ['invented platform', (m) => { m.platforms.push({ ...m.platforms[0], platform: 'tiktok', id: 'pc-ai-9' }) }, 'INVALID_PLATFORM_FORMAT'],
    ['format not allowed for platform', (m) => { m.platforms[0].format = 'IGTV' }, 'INVALID_PLATFORM_FORMAT'],
    ['broken schedule datetime', (m) => { m.platforms[1].schedule = { enabled: true, datetime: 'tomorrow morning', timezone: null } }, 'INVALID_DATETIME'],
    ['missing required IG caption', (m) => { delete m.platforms[0].metadata.caption }, 'MISSING_REQUIRED_METADATA'],
    ['missing required YT title', (m) => { delete m.platforms[1].metadata.title }, 'MISSING_REQUIRED_METADATA'],
  ]
  for (const [label, mutate, code] of negCases) {
    const m = clone()
    mutate(m)
    const codes = codesOf(m)
    expect(`rejects: ${label} → ${code}`, codes.includes(code), codes.join(','))
  }

  // Atomicity: rejected AI responses must not change the store.
  const countsBeforeNeg = {
    contents: useStore.getState().contents.length,
    campaigns: useStore.getState().campaigns.length,
    platformContents: useStore.getState().platformContents.length,
  }
  const bad = clone()
  bad.platforms[0].format = 'IGTV'
  const badRes = useStore.getState().importCampaign(bad as never)
  const countsAfterNeg = {
    contents: useStore.getState().contents.length,
    campaigns: useStore.getState().campaigns.length,
    platformContents: useStore.getState().platformContents.length,
  }
  expect(
    'no partial import from a rejected AI response',
    badRes.issues.length > 0 && JSON.stringify(countsBeforeNeg) === JSON.stringify(countsAfterNeg),
  )

  console.log(`\n==============================`)
  console.log(`AI ROUND-TRIP RESULT: ${passed} passed, ${failed} failed`)
  if (report.scheduleReconstructed) {
    console.log('PROMPT FINDING: SCHEDULE context contained no ISO 8601 datetimes — the external AI had to reconstruct them (risking drift).')
  }
  if (!report.scheduleIsoProvided) {
    console.log('PROMPT FINDING: prompt did not provide ISO 8601 datetimes, so exact schedule preservation was impossible.')
  }
  if (failed > 0) {
    console.log('Failed checks:')
    for (const f of failures) console.log(`  - ${f}`)
    process.exit(1)
  }
  console.log('ALL AI ROUND-TRIP CHECKS PASS')
  process.exit(0)
}

main().catch((e) => {
  console.error('ROUND-TRIP CRASH:', e)
  process.exit(1)
})
