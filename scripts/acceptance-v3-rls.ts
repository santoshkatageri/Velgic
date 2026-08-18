/**
 * Velgic V3 — RLS acceptance test (Phase 3A gate)
 * =================================================
 * Tests the ACTUAL remote Supabase RLS behaviour using real authenticated
 * user sessions (supabase-js with the anon key + signUp/signIn). It does NOT
 * inspect SQL source, does NOT use the service-role key for assertions, and
 * does NOT weaken or bypass RLS.
 *
 * Isolated test identities per run:
 *   User A → personal Workspace A
 *   User B → personal Workspace B
 * (emails are unique per run: rls.test.a.<ts>@velgic.local …)
 *
 * PREREQUISITE (preflight gate):
 *   The remote project MUST already create a profile + personal workspace +
 *   owner membership when a user signs up (the Phase 3 on_auth_user_created
 *   bootstrap trigger). If a freshly signed-up user has no workspace
 *   membership, the test FAILS FAST with PREREQUISITE MISSING — it does not
 *   invent workspaces or bypass RLS to continue.
 *
 * Run (from the repository root, on a machine with network access):
 *
 *   VELGIC_SUPABASE_URL=https://<ref>.supabase.co \
 *   VELGIC_SUPABASE_ANON_KEY=<anon key> \
 *   [VELGIC_SUPABASE_SERVICE_ROLE_KEY=<service-role key>] \
 *   npx esbuild scripts/acceptance-v3-rls.ts --bundle --format=cjs \
 *     --platform=node --outfile=scripts/acceptance-v3-rls.cjs --log-level=error
 *   node scripts/acceptance-v3-rls.cjs
 *
 * The service-role key is OPTIONAL and used ONLY for post-test cleanup
 * (deleting the two test users and their workspaces). It is never used for
 * the RLS assertions themselves.
 *
 * Exit code 0 = all isolation scenarios PASS. Non-zero = failure, or the
 * preflight prerequisite is missing (see the printed report).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/* ------------------------------------------------------------------ */
/* Environment                                                          */
/* ------------------------------------------------------------------ */

const url = process.env.VELGIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const anonKey = process.env.VELGIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
const serviceRoleKey = process.env.VELGIC_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

function die(message: string, code = 1): never {
  console.error(`\n✖ ${message}`)
  process.exit(code)
}

if (!url || !anonKey) {
  die(
    'Missing environment. Set VELGIC_SUPABASE_URL and VELGIC_SUPABASE_ANON_KEY ' +
      '(or SUPABASE_URL / SUPABASE_ANON_KEY).',
  )
}

const TS = Date.now().toString(36)
const PASS_EMAIL_A = `rls.test.a.${TS}@velgic.local`
const PASS_EMAIL_B = `rls.test.b.${TS}@velgic.local`
const TEST_PASSWORD = `velgic-rls-${TS}!A1`

/* ------------------------------------------------------------------ */
/* Assertion harness (own counter — never hard-codes V2's 291)         */
/* ------------------------------------------------------------------ */

let passed = 0
let failed = 0
const failures: string[] = []

function expect(name: string, ok: boolean, extra = ''): void {
  if (ok) {
    passed++
    console.log(`  ok: ${name}`)
  } else {
    failed++
    failures.push(name)
    console.log(`  FAIL: ${name}${extra ? ` — ${extra}` : ''}`)
  }
}

function section(title: string): void {
  console.log(`\n[${title}]`)
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

async function signUpOrSignIn(client: SupabaseClient, email: string): Promise<{ userId: string }> {
  // signUp returns an authenticated session when email confirmation is
  // disabled (the V3 default). Fall back to signInWithPassword for
  // re-runs where the identity already exists.
  const up = await client.auth.signUp({ email, password: TEST_PASSWORD })
  if (up.data.session) return { userId: up.data.user!.id }
  if (up.data.user) {
    const inRes = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD })
    if (inRes.data.session) return { userId: inRes.data.user!.id }
  }
  throw new Error(
    `Could not obtain an authenticated session for ${email}: ` +
      `${up.error?.message ?? 'no session returned'} (if email confirmation is required on this ` +
      `project, the bootstrap prerequisite is unmet — see preflight report).`,
  )
}

async function myMemberships(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from('workspace_members')
    .select('workspace_id, user_id, role')
    .eq('user_id', userId)
  if (error) throw new Error(`workspace_members read failed: ${error.message}`)
  return data ?? []
}

/** Create the full distribution chain (content → campaign → platform_content) in a workspace. */
async function createChain(client: SupabaseClient, wsId: string, tag: string) {
  const content = await client
    .from('contents')
    .insert({
      workspace_id: wsId,
      v2_id: `rls-${tag}-content`,
      title: `RLS ${tag} content`,
      concept: `RLS test ${tag}`,
      origin: 'direct',
      audience: 'RLS test',
      content_type: 'article',
      status: 'draft',
    })
    .select()
    .single()
  if (content.error) throw new Error(`insert contents (${tag}) failed: ${content.error.message}`)

  const campaign = await client
    .from('campaigns')
    .insert({
      workspace_id: wsId,
      v2_id: `rls-${tag}-campaign`,
      content_id: content.data.id,
      name: `RLS ${tag} campaign`,
      status: 'draft',
    })
    .select()
    .single()
  if (campaign.error) throw new Error(`insert campaigns (${tag}) failed: ${campaign.error.message}`)

  const pc = await client
    .from('platform_contents')
    .insert({
      workspace_id: wsId,
      v2_id: `rls-${tag}-pc`,
      campaign_id: campaign.data.id,
      platform: 'x',
      format: 'Post',
      status: 'draft',
      x: { content: `RLS ${tag} post`, is_thread: false },
    })
    .select()
    .single()
  if (pc.error) throw new Error(`insert platform_contents (${tag}) failed: ${pc.error.message}`)

  const asset = await client
    .from('assets')
    .insert({
      workspace_id: wsId,
      asset_id: `rls-${tag}-asset`,
      filename: `${tag}.mp4`,
      type: 'video',
      reference: `rls/${tag}.mp4`,
      provider: 'local',
    })
    .select()
    .single()
  if (asset.error) throw new Error(`insert assets (${tag}) failed: ${asset.error.message}`)

  return { contentId: content.data.id, campaignId: campaign.data.id, pcId: pc.data.id, assetId: asset.data.id }
}

/** Best-effort cleanup via the service-role client (never used for assertions). */
async function cleanup(admin: SupabaseClient | null, userIdA: string, userIdB: string, wsA: string, wsB: string) {
  if (!admin) {
    console.log('\n  (no service-role key — skipping automatic cleanup)')
    return
  }
  try {
    // Deleting the workspaces cascades to all workspace-scoped rows
    // (items, experiments, contents, campaigns, platform_contents,
    // assets, asset_references) via the FK ON DELETE CASCADE rules.
    for (const ws of [wsA, wsB]) {
      if (ws) await admin.from('workspaces').delete().eq('id', ws)
    }
    for (const uid of [userIdA, userIdB]) {
      if (uid) await admin.auth.admin.deleteUser(uid)
    }
    for (const uid of [userIdA, userIdB]) {
      if (uid) await admin.from('profiles').delete().eq('id', uid)
    }
    console.log('\n  (cleanup done: workspaces + test users removed)')
  } catch (e) {
    console.log(`\n  (cleanup warning: ${e instanceof Error ? e.message : String(e)})`)
  }
}

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  console.log('Velgic V3 — RLS acceptance test (Phase 3A gate)\n')
  console.log(`  Target: ${url}`)
  console.log(`  Identities: ${PASS_EMAIL_A} / ${PASS_EMAIL_B}\n`)

  const clientA = createClient(url, anonKey)
  const clientB = createClient(url, anonKey)
  const admin = serviceRoleKey ? createClient(url, serviceRoleKey, { auth: { persistSession: false } }) : null

  let userIdA = ''
  let userIdB = ''
  let wsA = ''
  let wsB = ''

  /* --------------------------- preflight gate --------------------------- */
  section('Preflight — authenticated sessions + workspace bootstrap')

  try {
    const a = await signUpOrSignIn(clientA, PASS_EMAIL_A)
    const b = await signUpOrSignIn(clientB, PASS_EMAIL_B)
    userIdA = a.userId
    userIdB = b.userId
    expect('User A obtained an authenticated session', userIdA.length > 0)
    expect('User B obtained an authenticated session', userIdB.length > 0)
  } catch (e) {
    expect(`authenticated sessions available (${e instanceof Error ? e.message : String(e)})`, false)
  }

  if (failed > 0) {
    console.error(
      '\n\n✖ PREREQUISITE MISSING: could not obtain authenticated test sessions. ' +
        'Verify Auth is enabled on the project (email/password signup) and email ' +
        'confirmation is disabled, then re-run.',
    )
    await cleanup(admin, userIdA, userIdB, wsA, wsB)
    process.exit(1)
  }

  try {
    const mA = await myMemberships(clientA, userIdA)
    const mB = await myMemberships(clientB, userIdB)
    expect('User A has exactly one workspace membership (bootstrap)', mA.length === 1, `got ${mA.length}`)
    expect('User B has exactly one workspace membership (bootstrap)', mB.length === 1, `got ${mB.length}`)
    wsA = mA[0]?.workspace_id ?? ''
    wsB = mB[0]?.workspace_id ?? ''
    expect('A and B have distinct workspaces', wsA.length > 0 && wsB.length > 0 && wsA !== wsB)

    // Phase 3B contract: the bootstrap trigger must create an OWNER membership
    // and a PERSONAL workspace for each new auth user.
    const roleA = mA[0]?.role ?? ''
    const roleB = mB[0]?.role ?? ''
    expect('A’s membership role is owner (bootstrap trigger)', roleA === 'owner', `got "${roleA}"`)
    expect('B’s membership role is owner (bootstrap trigger)', roleB === 'owner', `got "${roleB}"`)

    const wsArow = await clientA.from('workspaces').select('kind').eq('id', wsA)
    const wsBrow = await clientB.from('workspaces').select('kind').eq('id', wsB)
    expect('A’s workspace kind is personal', !wsArow.error && wsArow.data?.[0]?.kind === 'personal', wsArow.error?.message)
    expect('B’s workspace kind is personal', !wsBrow.error && wsBrow.data?.[0]?.kind === 'personal', wsBrow.error?.message)
  } catch (e) {
    expect(`bootstrap membership readable (${e instanceof Error ? e.message : String(e)})`, false)
  }

  if (failed > 0) {
    console.error(
      '\n\n✖ PREREQUISITE MISSING: freshly signed-up users have no personal workspace ' +
        'membership. The auth bootstrap trigger (migration ' +
        '20260818060000_auth_bootstrap_trigger.sql: profile + personal workspace + ' +
        'owner membership via on_auth_user_created) must be deployed on the remote ' +
        'project BEFORE this RLS test can run. The test does NOT create workspaces ' +
        'or bypass RLS to continue.',
    )
    await cleanup(admin, userIdA, userIdB, wsA, wsB)
    process.exit(1)
  }

  /* --------------------------- fixture data ----------------------------- */
  section('Fixture — isolated data in each workspace')

  let aItemId = ''
  let bItemId = ''
  let chainA: { contentId: string; campaignId: string; pcId: string; assetId: string } | null = null
  let chainB: { contentId: string; campaignId: string; pcId: string; assetId: string } | null = null

  try {
    const aItem = await clientA
      .from('items')
      .insert({
        workspace_id: wsA,
        v2_id: `rls-a-item`,
        title: 'RLS A item',
        estimated_effort: 3,
        potential_impact: 5,
      })
      .select()
      .single()
    if (aItem.error) throw new Error(aItem.error.message)
    aItemId = aItem.data.id

    const bItem = await clientB
      .from('items')
      .insert({
        workspace_id: wsB,
        v2_id: `rls-b-item`,
        title: 'RLS B item',
        estimated_effort: 3,
        potential_impact: 5,
      })
      .select()
      .single()
    if (bItem.error) throw new Error(bItem.error.message)
    bItemId = bItem.data.id

    chainA = await createChain(clientA, wsA, 'a')
    chainB = await createChain(clientB, wsB, 'b')

    expect('A inserted an item into A’s workspace', aItemId.length > 0)
    expect('B inserted an item into B’s workspace', bItemId.length > 0)
    expect('A created content→campaign→platform_content→asset chain', !!chainA)
    expect('B created content→campaign→platform_content→asset chain', !!chainB)
  } catch (e) {
    expect(`fixture creation (${e instanceof Error ? e.message : String(e)})`, false)
  }

  /* --------------------------- READ ------------------------------------ */
  section('RLS — READ')

  try {
    const own = await clientA.from('items').select('id').eq('workspace_id', wsA)
    expect('A can read A’s workspace rows', !own.error && (own.data?.length ?? 0) >= 1, own.error?.message)

    const cross = await clientA.from('items').select('id').eq('workspace_id', wsB)
    expect('A querying B’s workspace explicitly receives ZERO rows', !cross.error && (cross.data?.length ?? -1) === 0, cross.error?.message)

    const direct = await clientA.from('items').select('id').eq('id', bItemId)
    expect('A cannot read B’s item by id', !direct.error && (direct.data?.length ?? -1) === 0, direct.error?.message)
  } catch (e) {
    expect(`read scenarios (${e instanceof Error ? e.message : String(e)})`, false)
  }

  /* --------------------------- INSERT ---------------------------------- */
  section('RLS — INSERT')

  try {
    const ok = await clientA.from('items').insert({
      workspace_id: wsA,
      v2_id: `rls-a-insert`,
      title: 'RLS A insert',
      estimated_effort: 1,
      potential_impact: 1,
    })
    expect('A can insert into A’s workspace', !ok.error, ok.error?.message)

    const bad = await clientA.from('items').insert({
      workspace_id: wsB,
      v2_id: `rls-a-insert-b`,
      title: 'RLS A insert into B',
      estimated_effort: 1,
      potential_impact: 1,
    })
    expect('A cannot insert into B’s workspace (RLS violation)', !!bad.error, bad.error?.message)
  } catch (e) {
    expect(`insert scenarios (${e instanceof Error ? e.message : String(e)})`, false)
  }

  /* --------------------------- UPDATE ---------------------------------- */
  section('RLS — UPDATE')

  try {
    const ok = await clientA.from('items').update({ notes: 'updated by A' }).eq('id', aItemId)
    expect('A can update A’s row', !ok.error, ok.error?.message)

    const bad = await clientA.from('items').update({ notes: 'A tampering' }).eq('id', bItemId)
    expect('A cannot update B’s row (0 rows affected)', !bad.error && (bad.data?.length ?? -1) === 0, bad.error?.message)
  } catch (e) {
    expect(`update scenarios (${e instanceof Error ? e.message : String(e)})`, false)
  }

  /* --------------------------- DELETE ---------------------------------- */
  section('RLS — DELETE')

  try {
    const ok = await clientA.from('items').delete().eq('id', aItemId)
    expect('A can delete A’s row', !ok.error, ok.error?.message)

    const bad = await clientA.from('items').delete().eq('id', bItemId)
    expect('A cannot delete B’s row (0 rows affected)', !bad.error && (bad.data?.length ?? -1) === 0, bad.error?.message)
  } catch (e) {
    expect(`delete scenarios (${e instanceof Error ? e.message : String(e)})`, false)
  }

  /* --------------------------- asset_references ------------------------- */
  section('RLS — asset_references')

  try {
    if (chainA && chainB) {
      const ownRef = await clientA.from('asset_references').insert({
        asset_id: chainA.assetId,
        platform_content_id: chainA.pcId,
        role: 'media',
      })
      expect('A can reference A’s asset on A’s platform_content', !ownRef.error, ownRef.error?.message)

      const bAsset = await clientA.from('asset_references').insert({
        asset_id: chainB.assetId,
        platform_content_id: chainA.pcId,
        role: 'media',
      })
      expect('A cannot reference B’s asset (cross-workspace blocked)', !!bAsset.error, bAsset.error?.message)

      const bPc = await clientA.from('asset_references').insert({
        asset_id: chainA.assetId,
        platform_content_id: chainB.pcId,
        role: 'media',
      })
      expect('A cannot reference B’s platform_content (cross-workspace blocked)', !!bPc.error, bPc.error?.message)

      const bothB = await clientA.from('asset_references').insert({
        asset_id: chainB.assetId,
        platform_content_id: chainB.pcId,
        role: 'media',
      })
      expect('A cannot create a fully cross-workspace reference', !!bothB.error, bothB.error?.message)
    } else {
      expect('asset_references scenarios (fixture chain missing)', false)
    }
  } catch (e) {
    expect(`asset_references scenarios (${e instanceof Error ? e.message : String(e)})`, false)
  }

  /* --------------------------- profiles -------------------------------- */
  section('RLS — profiles')

  try {
    const own = await clientA.from('profiles').select('id').eq('id', userIdA)
    expect('A can access A’s profile', !own.error && (own.data?.length ?? 0) === 1, own.error?.message)

    const other = await clientA.from('profiles').select('id').eq('id', userIdB)
    expect('A cannot access B’s profile (0 rows)', !other.error && (other.data?.length ?? -1) === 0, other.error?.message)
  } catch (e) {
    expect(`profile scenarios (${e instanceof Error ? e.message : String(e)})`, false)
  }

  /* --------------------------- workspace_members ------------------------ */
  section('RLS — workspace_members')

  try {
    const own = await clientA.from('workspace_members').select('workspace_id').eq('user_id', userIdA)
    expect('A can see A’s membership', !own.error && (own.data?.length ?? 0) >= 1, own.error?.message)

    const other = await clientA.from('workspace_members').select('workspace_id').eq('user_id', userIdB)
    expect('A cannot see B’s membership (0 rows)', !other.error && (other.data?.length ?? -1) === 0, other.error?.message)
  } catch (e) {
    expect(`workspace_members scenarios (${e instanceof Error ? e.message : String(e)})`, false)
  }

  /* --------------------------- cleanup + summary ------------------------ */
  await cleanup(admin, userIdA, userIdB, wsA, wsB)

  console.log('\n' + '='.repeat(40))
  console.log(`RLS ACCEPTANCE RESULT: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.log('FAILED:')
    for (const f of failures) console.log(`  - ${f}`)
    console.log('\nALL RLS CHECKS: FAIL')
    process.exit(1)
  }
  console.log('ALL RLS CHECKS PASS')
  console.log('NOTE: results reflect the remote project’s actual RLS behaviour using authenticated sessions.')
}

main().catch((e) => {
  console.error(`\n✖ Unhandled error: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
