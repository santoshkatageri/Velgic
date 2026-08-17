import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getEnv } from '../env'

/**
 * Velgic V3 — typed `supabase-js` client instantiation.
 *
 * Lazy: the client is only constructed on the first `getSupabaseClient()` call.
 * V2's SPA does not import this module, so:
 *
 *   • V2's runtime bundle is unchanged.
 *   • V2's behavior is unchanged (no env vars required to run V2 code paths).
 *   • Initialization is gated by `src/lib/env.ts`'s `isEnvConfigured()` /
 *     `getEnv()` — callers must not call `getSupabaseClient()` unless they
 *     know the VITE_SUPABASE_* env vars are present.
 *
 * `persistSession` and `autoRefreshToken` are enabled so a future auth flow
 * (Phase 3) can use Supabase's localStorage session store. They are inert
 * until the auth code lands; in V3's first cut the SPA never calls Auth APIs.
 *
 * Phase 2 SQL migrations, Phase 3 auth wiring, Phase 4 storage adapter,
 * Phase 5 RPC calls (manifest_import) etc. all sit behind this single client
 * accessor.
 */

let cached: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!cached) {
    const { url, anonKey } = getEnv()
    cached = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return cached
}

/**
 * Force-reset the cached client. Useful in tests and after the user signs out.
 * Phase 1 does not call this; it is provided for symmetry with the future auth
 * lifecycle.
 */
export function resetSupabaseClient(): void {
  cached = null
}

export type { SupabaseClient }
