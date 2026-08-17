/**
 * Velgic V3 — environment configuration.
 *
 * V2 never reads `import.meta.env.VITE_*` anywhere; V3 introduces the first
 * env-driven configuration: a Supabase project URL and anon key. Reads are
 * deliberately lazy — V2's main bundle does not import this module, so V2
 * paths stay loadable without any env vars configured.
 *
 * `isEnvConfigured()` lets callers gate initialization on whether Supabase env
 * vars are present. `getEnv()` validates and returns them, throwing a clear
 * error if anything is missing.
 *
 * Real values live in untracked files (e.g. `.env.local`); only `.env.example`
 * is committed.
 */

export interface VelgicEnv {
  /** Supabase project URL (http(s)://). */
  url: string
  /** Supabase anon (publishable) JWT. RLS is the security gate. */
  anonKey: string
}

export function isEnvConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  return typeof url === 'string' && url.length > 0 && typeof anonKey === 'string' && anonKey.length > 0
}

export function getEnv(): VelgicEnv {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error(
      'Velgic V3: VITE_SUPABASE_URL is missing. Copy .env.example to .env.local and fill it in.',
    )
  }
  if (typeof anonKey !== 'string' || anonKey.length === 0) {
    throw new Error(
      'Velgic V3: VITE_SUPABASE_ANON_KEY is missing. Copy .env.example to .env.local and fill it in.',
    )
  }
  return { url, anonKey }
}
