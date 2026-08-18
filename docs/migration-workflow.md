# Velgic V3 — Supabase migration workflow

This document describes how to apply the Phase 2 schema migration to the remote
Supabase project and how to work with the seed data locally.

---

## Prerequisites

### 1. Install the Supabase CLI

macOS (Homebrew):

```bash
brew install supabase/tap/supabase
```

npm:

```bash
npm install -g supabase
```

Cargo:

```bash
cargo install supabase-cli
```

Binary (all platforms): download from
https://github.com/supabase/cli/releases

Verify the installation:

```bash
supabase --version
```

### 2. Authenticate

The Supabase CLI needs to authenticate with your Supabase account:

```bash
supabase login
```

This opens a browser window for GitHub OAuth. If you cannot use the browser
flow, generate a **personal access token** at
Dashboard → Settings → API → Access Tokens → **Generate new token**
and export it:

```bash
export SUPABASE_ACCESS_TOKEN="sbp_…"
```

(Replace `sbp_…` with the actual token value.)

### 3. Find your project reference

Open your Supabase project in the browser. The URL contains the reference:

```
https://supabase.com/dashboard/project/abcdefghijklmno
                              └──────────┬──────────┘
                                project ref
```

The reference is a short alphanumeric string (15 characters). You will need it
when running the migration script.

### 4. Know your database password

The database password was set when you created the project. If you have forgotten
it, reset it at Dashboard → Project Settings → Database → **Reset database password**.

The password is needed by `supabase link` to establish a database connection.
You can either:
- Enter it at the interactive prompt (the script will prompt you), or
- Set the `SUPABASE_DB_PASSWORD` environment variable to skip the prompt.

**Never commit the password to the repository.** The `.env*` files in this repo
are already gitignored.

---

## Migration workflow

### Step 0: Confirm the repository state

```bash
cd /path/to/Velgic
git status                         # should show a clean working tree on
                                   # arena/01a0107a-velgic or main
ls supabase/migrations/            # should list the migration file
ls supabase/seed.sql               # should exist (but not applied remotely)
```

### Step 1: Dry-run (review pending migrations)

```bash
./scripts/migrate-supabase.sh --project-ref <PROJECT_REF> --dry-run
```

This will:
1. Verify the Supabase CLI is installed and authenticated.
2. Check the working tree and migration file.
3. Link the local repository to your remote project (you will be prompted for
   the database password).
4. Run `supabase db push --dry-run`, which shows every SQL statement that
   will be executed without actually running anything.

**Review the output carefully.** Confirm that only the expected migration
(`20260817180000_init_schema.sql`) appears in the pending list.

### Step 2: Apply

```bash
./scripts/migrate-supabase.sh --project-ref <PROJECT_REF> --apply
```

This will:
1. Repeat the same pre-flight checks and link.
2. Run a **preflight dry-run** automatically.
3. Display a confirmation banner showing the target project ref, migration
   file, and current branch.
4. **Wait for you to type `yes`** before proceeding.
5. Run `supabase db push` to apply the migration.

### Step 3: Verify the remote schema

After the migration succeeds, verify all schema elements:

```bash
# Check migration status
supabase db status

# Pull the remote schema to a local file for inspection
supabase db dump --schema-only
```

Or inspect via the Supabase Dashboard → Table Editor.

---

## Verification checklist (post-migration)

| Element                | Expected count |
|------------------------|----------------|
| Tables                 | 10             |
| Foreign keys           | 15             |
| CHECK constraints      | 36             |
| Triggers               | 8              |
| Indexes                | 9              |
| RLS enabled tables     | 10             |
| RLS policies           | 33             |

Running the V2 acceptance suite (`npm test`) after a successful migration is
not a remote verification step — the test suite is fully client-side and does
not connect to the database. Run it after the migration to confirm the project
still builds and all 291 V2 checks pass:

```bash
npm run build
npm test       # 291/291 checks (client-side only)
```

---

## Local seed (development only)

The `supabase/seed.sql` file contains demo data that mirrors
`src/data/seed.ts`. It is designed for **local development only** and must
**never** be applied to the remote production project.

### Local Supabase instance

If you have Docker installed, you can run a full local Supabase stack:

```bash
cd /path/to/Velgic
supabase start                    # boot Postgres + Auth + Storage + Studio
supabase db reset                 # apply migrations + seed.sql automatically
```

`supabase db reset` does both:
  1. Runs all pending migrations from `supabase/migrations/`.
  2. Applies `supabase/seed.sql` if it exists.

After `supabase db reset`, the local database contains the full schema and the
seeded demo data (18 items, 4 experiments, 4 contents, 4 campaigns, 14
platform versions, 10 assets, 9 asset references).

### Applying seed to a running local instance (without reset)

If the local database is already running and you want to re-seed without a full
reset, use `psql`. The default local Supabase credentials are:

| Parameter         | Default value                       |
|-------------------|-------------------------------------|
| Host              | `localhost`                         |
| Port              | `54322` (printed by `supabase status`) |
| User              | `postgres`                          |
| Password          | `postgres`                          |
| Database          | `postgres`                          |

```bash
# Get connection string from the local CLI
supabase status --output env | grep STUDIO_DB

# Pipe the seed through psql
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f supabase/seed.sql
```

---

## Why `--include-seed` is never used remotely

The `supabase db push` command has an `--include-seed` flag that would also
apply `supabase/seed.sql` to the remote database. **We deliberately never use
this flag** because:

- The seed contains synthetic demo data (`seed@velgic.local`, publicly known
  content, hardcoded UUIDs) that is inappropriate for a production or
  team-project database.
- The seed references a synthetic `auth.users` row with a well-known email
  and empty password hash — a security risk on a remote project.
- The V2→V3 data migration (Phase 6) will move real user data into the
  database; the seed exists only to give developers a populated environment
  for local development.
- Separating schema (migrations) from data (seed) follows Supabase best
  practice: migrations manage structure only.

If you need a populated database for a staging or review environment, run
`supabase db reset` against your **local** instance, then consider a separate,
project-specific seed designed for that environment — never reuse
`supabase/seed.sql` verbatim.

---

## Recovery if the migration fails

### `supabase db push` fails mid-way

The entire migration runs inside a database transaction (`BEGIN … COMMIT` in
the migration file). If the push fails, the remote database is **unchanged** —
PostgreSQL automatically rolls back the transaction. Fix the migration file,
commit the fix, and run the apply step again.

### The script exits with an error before applying

Common causes:

| Symptom                     | Likely cause                        | Fix |
|-----------------------------|--------------------------------------|-----|
| `supabase: command not found` | CLI not installed or not in PATH    | Install Supabase CLI |
| `Access token not provided`   | Not authenticated                   | Run `supabase login` or export `SUPABASE_ACCESS_TOKEN` |
| `Project not found`           | Wrong project ref                   | Verify the ref in the dashboard URL |
| `Database password required`  | Password not set                   | Enter at the prompt or export `SUPABASE_DB_PASSWORD` |
| `relation "..." already exists` | Migration was already partially applied | Run `supabase db status` to see which migrations are tracked; run `supabase db push --dry-run` to reconcile |
| The migration file was modified after a previous push | Revert the changes or run `supabase db push --dry-run` to see the exact diff |

If the migration script itself has a bug:

```bash
bash -n scripts/migrate-supabase.sh   # syntax check
```

Report the exact error message and the output of `supabase db status` —
do not manually create or drop tables through the dashboard.