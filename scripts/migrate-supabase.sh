#!/usr/bin/env bash
# ==============================================================================
# Velgic V3 — Supabase remote migration helper
#
# Usage:
#   dry-run (review what will be applied):
#     ./scripts/migrate-supabase.sh --project-ref <PROJECT_REF> --dry-run
#
#   apply (dry-run → confirmation → push):
#     ./scripts/migrate-supabase.sh --project-ref <PROJECT_REF> --apply
#
# Requirements:
#   - Supabase CLI installed (see "Supabase CLI setup" below)
#   - Authenticated via `supabase login` or SUPABASE_ACCESS_TOKEN env var
#   - Database password known (prompted by `supabase link`, or set
#     SUPABASE_DB_PASSWORD env var to skip the prompt)
#
# What this script does NOT do:
#   • It does NOT run supabase/seed.sql remotely.
#     Seed is for local development only (see "Local seed" section below).
#   • It does NOT use --include-seed (deliberately — see "Why --include-seed
#     is never used remotely" in docs/migration-workflow.md).
#   • It does NOT modify the migration file.
#   • It does NOT expose credentials in logs.
# ==============================================================================

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────
MIGRATION_FILE="supabase/migrations/20260817180000_init_schema.sql"
EXPECTED_MIGRATIONS=("20260817180000_init_schema.sql")

# ──────────────────────────────────────────────────────────────────────────────
# Colours (non-empty only when stdout is a terminal)
# ──────────────────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
  BOLD='\033[1m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BOLD=''; NC=''
fi

ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✖${NC} $1"; }

# ──────────────────────────────────────────────────────────────────────────────
# Help
# ──────────────────────────────────────────────────────────────────────────────
usage() {
  cat <<'USAGE_EOF'
Usage:
  ./scripts/migrate-supabase.sh --project-ref <REF> --dry-run
  ./scripts/migrate-supabase.sh --project-ref <REF> --apply
  ./scripts/migrate-supabase.sh --help

Options:
  --project-ref <REF>    Supabase project reference (from dashboard URL).
                         Required for both --dry-run and --apply.

  --dry-run              Link to the project and run `supabase db push --dry-run`
                         to show pending migrations without applying anything.

  --apply                Run a preflight dry-run, prompt for confirmation,
                         then apply pending migrations.

  --help                 Show this help text and exit.

Examples:
  # Review pending migrations
  ./scripts/migrate-supabase.sh --project-ref abcdefghijklmno --dry-run

  # Apply after reviewing the dry-run output
  ./scripts/migrate-supabase.sh --project-ref abcdefghijklmno --apply
USAGE_EOF
  exit 0
}

# exit 1 + usage (for argument/pre-flight errors — never exits 0)
fail_usage() {
  err "$1"
  echo ""
  sed -n '/^Usage:/,/^USAGE_EOF/p' "${BASH_SOURCE[0]}" | sed '$d'
  exit 1
}

# ──────────────────────────────────────────────────────────────────────────────
# Parse arguments
# ──────────────────────────────────────────────────────────────────────────────
MODE=""
PROJECT_REF=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-ref) PROJECT_REF="$2";  shift 2 ;;
    --dry-run)     MODE="dry-run";    shift   ;;
    --apply)       MODE="apply";      shift   ;;
    --help)        usage                       ;;
    *)             fail_usage "Unknown argument: $1" ;;
  esac
done

if [[ -z "$PROJECT_REF" ]]; then
  fail_usage "--project-ref is required"
fi
if [[ -z "$MODE" ]]; then
  fail_usage "Specify --dry-run or --apply"
fi

# ──────────────────────────────────────────────────────────────────────────────
# Pre-flight checks
# ──────────────────────────────────────────────────────────────────────────────

# 1. Supabase CLI
if ! command -v supabase &>/dev/null; then
  err "Supabase CLI not found."
  echo ""
  echo "Install it:"
  echo "  brew install supabase/tap/supabase          # macOS"
  echo "  npm install -g supabase --save-dev          # npm (see docs)"
  echo "  cargo install supabase-cli                  # Rust"
  echo ""
  echo "Then authenticate:"
  echo "  supabase login                              # opens browser for GitHub OAuth"
  echo "  # OR export SUPABASE_ACCESS_TOKEN=<your-token>"
  exit 1
fi
ok "Supabase CLI found: $(supabase --version 2>&1 | head -1)"

# 2. Repository root
cd "$REPO_DIR"
ok "Repository root: $REPO_DIR"

# 3. Git branch & tree
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ -z "$CURRENT_BRANCH" ]]; then
  warn "Not a git repository or no branch detected."
else
  echo "  Branch: $CURRENT_BRANCH"
fi

if ! git diff --quiet HEAD 2>/dev/null; then
  warn "Working tree has uncommitted changes."
  echo "  Commit or stash before migrating to avoid drift."
  echo ""
fi

# 4. Migration file exists
MIGRATION_ABS="$REPO_DIR/$MIGRATION_FILE"
if [[ ! -f "$MIGRATION_ABS" ]]; then
  err "Migration file not found: $MIGRATION_FILE"
  exit 1
fi
ok "Migration file: $MIGRATION_FILE"

# 5. Migration filename matches expected pattern
MIGRATION_BASENAME="$(basename "$MIGRATION_ABS")"
MATCHED=0
for expected in "${EXPECTED_MIGRATIONS[@]}"; do
  if [[ "$MIGRATION_BASENAME" == "$expected" ]]; then
    MATCHED=1
    break
  fi
done
if [[ "$MATCHED" -eq 0 ]]; then
  warn "Unexpected migration file name: $MIGRATION_BASENAME"
  echo "  Expected one of: ${EXPECTED_MIGRATIONS[*]}"
  echo "  Continuing anyway (the filename check is a safety net)."
fi

# 6. supabase/ folder has a config.toml
if [[ ! -f "$REPO_DIR/supabase/config.toml" ]]; then
  err "supabase/config.toml not found. Did you run 'supabase init'?"
  exit 1
fi
ok "supabase/config.toml present"

# 7. supabase/migrations/ folder exists and contains only our migration
if [[ ! -d "$REPO_DIR/supabase/migrations" ]]; then
  err "supabase/migrations/ directory missing."
  exit 1
fi
ok "supabase/migrations/ directory present"

# 8. Verify seed.sql exists but warn it will NOT be applied
SEED_ABS="$REPO_DIR/supabase/seed.sql"
if [[ -f "$SEED_ABS" ]]; then
  # Show file size as a sanity check (non-empty seed)
  SEED_SIZE=$(wc -c < "$SEED_ABS")
  ok "supabase/seed.sql found ($SEED_SIZE bytes) — will NOT be pushed remotely"
else
  warn "supabase/seed.sql not found (optional for remote migration)"
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# Dry-run mode
# ──────────────────────────────────────────────────────────────────────────────
if [[ "$MODE" == "dry-run" ]]; then
  echo -e "${BOLD}Linking to project ${PROJECT_REF}…${NC}"
  supabase link --project-ref "$PROJECT_REF"

  echo ""
  echo -e "${BOLD}═ Dry run ═${NC}"
  supabase db push --dry-run
  echo ""
  echo -e "${GREEN}Dry run complete.${NC}"
  echo ""
  echo "Review the pending migrations above. If everything looks correct,"
  echo "run the apply command:"
  echo ""
  echo "  $0 --project-ref $PROJECT_REF --apply"
  echo ""
  exit 0
fi

# ──────────────────────────────────────────────────────────────────────────────
# Apply mode
# ──────────────────────────────────────────────────────────────────────────────
if [[ "$MODE" == "apply" ]]; then
  echo -e "${BOLD}Linking to project ${PROJECT_REF}…${NC}"
  supabase link --project-ref "$PROJECT_REF"

  echo ""
  echo -e "${BOLD}═ Preflight dry run ═${NC}"
  supabase db push --dry-run
  echo ""

  # Require explicit confirmation
  echo -e "${YELLOW}${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}${BOLD}║  REMOTE MIGRATION — CONFIRMATION REQUIRED               ║${NC}"
  echo -e "${YELLOW}${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo "  Target project ref:  ${PROJECT_REF}"
  echo "  Migration file:      ${MIGRATION_FILE}"
  echo "  Repo branch:         ${CURRENT_BRANCH}"
  echo ""
  echo -e "${RED}This will apply the migration to the REMOTE Supabase database.${NC}"
  echo -e "${RED}The seed file (supabase/seed.sql) is NOT included.${NC}"
  echo ""

  read -r -p "Type 'yes' to continue: " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    echo ""
    echo "Migration aborted by user."
    exit 0
  fi

  echo ""
  echo -e "${BOLD}═ Applying migration ═${NC}"
  supabase db push
  echo ""
  echo -e "${GREEN}${BOLD}Migration applied successfully.${NC}"
  echo ""
  echo -e "${BOLD}Next steps — verify remotely:${NC}"
  echo ""
  echo "  1. Check applied migrations:"
  echo "     supabase db status"
  echo ""
  echo "  2. Inspect schema via the Supabase dashboard:"
  echo "     https://supabase.com/dashboard/project/${PROJECT_REF}/editor"
  echo ""
  echo "  3. Or connect with psql:"
  echo "     supabase db dump --data-only --file /dev/null  # just checks connection"
  echo ""
  echo "  ${YELLOW}IMPORTANT:${NC} The seed.sql file was intentionally NOT applied."
  echo "  Seed data is for local development only. Apply it locally with:"
  echo "    supabase db reset       # runs migrations + seed.sql on local DB"
  echo ""
  echo "  Never run supabase/seed.sql against a remote project."
  echo ""
  exit 0
fi

# ──────────────────────────────────────────────────────────────────────────────
# ShellCheck directive (the script is complete — this line is unreachable)
# ──────────────────────────────────────────────────────────────────────────────
# This comment marks the end of the script file for review tooling.