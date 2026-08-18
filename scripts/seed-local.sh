#!/usr/bin/env bash
# ==============================================================================
# Velgic V3 — Local seed helper (development only)
#
# Applies supabase/seed.sql to a LOCAL Supabase instance.
# NEVER run this against the remote production project.
#
# Prerequisites:
#   - Docker (for local Supabase)
#   - Supabase CLI
#   - A running local instance (supabase start)
#
# Usage:
#   ./scripts/seed-local.sh               # supabase db reset (migrations + seed)
#   ./scripts/seed-local.sh --psql-only   # pipe seed via psql (faster re-seed)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SEED_FILE="$REPO_DIR/supabase/seed.sql"

[[ -f "$SEED_FILE" ]] || { echo "seed.sql not found"; exit 1; }

PSQL_ONLY=false
[[ "${1:-}" == "--psql-only" ]] && PSQL_ONLY=true

cd "$REPO_DIR"
command -v supabase >/dev/null 2>&1 || { echo "Supabase CLI required"; exit 1; }

echo ""
echo "WARNING: LOCAL DEVELOPMENT ONLY. Never use against remote."
read -r -p "Using a LOCAL Supabase instance? (yes/no): " CONFIRM
[[ "$CONFIRM" == "yes" ]] || { echo "Aborted."; exit 0; }

if [[ "$PSQL_ONLY" == true ]]; then
  DB_URL="$(supabase status --output env 2>/dev/null \
    | grep 'STUDIO_DB\|DB_URL' | head -1 | cut -d= -f2- || true)"
  [[ -n "$DB_URL" ]] || { echo "Local Supabase not running"; exit 1; }
  psql "$DB_URL" -f "$SEED_FILE"
  echo "Seed applied via psql."
else
  supabase db reset
  echo "Migrations + seed applied."
fi

echo "Local DB ready. Studio: supabase studio"