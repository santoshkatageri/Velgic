-- ============================================================================
-- Velgic V3 — seed data (idempotent mirror of src/data/seed.ts)
-- ============================================================================
-- Counterpart of the Phase 2 migration (supabase/migrations/…_init_schema.sql).
-- Supabase CLI runs this file automatically on `supabase db reset` (after all
-- migrations). It is idempotent: every INSERT carries an ON CONFLICT target so
-- re-running never duplicates or mutates existing rows.
--
-- Seed identity:
--   auth.users / profiles / workspaces / workspace_members are created with
--   FIXED uuids so the seed is repeatable and the data is owned by a real
--   (local-dev) identity. With the Phase 3 auth flow this identity can sign
--   in locally and see the seeded data. DEV-ONLY — do not ship to a
--   production project.
--
-- Mapping (src/data/seed.ts → SQL):
--   seedItems (18)      → public.items           (v2_id = 'idea-1'…'pub-5')
--   seedExperiments (4) → public.experiments     (v2_id = 'exp-1'…'exp-4')
--   seedContents (4)    → public.contents        (v2_id = 'content-1'…'content-4')
--   seedCampaigns (4)   → public.campaigns       (v2_id = 'camp-1'…'camp-4')
--   seedPlatformContents (14) → public.platform_contents (v2_id = 'pc-1'…'pc-14')
--   seedAssets (10)     → public.assets          (asset_id = library id)
--   platform assets     → public.asset_references (9 usage rows)
--
-- V2 timestamps are preserved verbatim (ISO 8601 with ms, UTC) — the seed
-- anchors to '2026-08-17T09:00:00Z' exactly like src/data/seed.ts.
-- ============================================================================

do $$
declare
  -- Fixed seed identity + workspace (idempotent across re-runs).
  seed_user_id  uuid := '00000000-0000-4000-8000-000000000001';
  seed_ws_id    uuid := '00000000-0000-4000-8000-000000000002';
begin

  -- --------------------------------------------------------------------------
  -- 0. Identity bootstrap (DEV-ONLY synthetic user, local dev only)
  -- --------------------------------------------------------------------------
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
     raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
     confirmation_token, email_change, email_change_token_new, recovery_token)
  values
    ('00000000-0000-0000-0000-000000000000', seed_user_id, 'authenticated', 'authenticated',
     'seed@velgic.local', crypt('velgic-seed', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now(),
     '', '', '', '')
  on conflict (id) do nothing;

  insert into public.profiles (id, display_name, avatar_url)
  values (seed_user_id, 'Velgic Seed', null)
  on conflict (id) do nothing;

  insert into public.workspaces (id, name, owner_id, kind)
  values (seed_ws_id, 'Velgic Seed Workspace', seed_user_id, 'personal')
  on conflict (id) do nothing;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (seed_ws_id, seed_user_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  -- --------------------------------------------------------------------------
  -- 1. items — 18 rows (8 ideas + 5 pipeline + 5 published)
  --    Columns: (workspace_id, v2_id, title, problem, category, audience,
  --              format, estimated_effort, potential_impact, reusable,
  --              stage, priority, notes, scores, core_idea, hook,
  --              audience_problem, key_insight, script, visual_plan,
  --              production_notes, linkedin_post, instagram_caption,
  --              checklist, performance, lessons_learned, created_at,
  --              updated_at)
  -- --------------------------------------------------------------------------
  insert into public.items
    (workspace_id, v2_id, title, problem, category, audience, format,
     estimated_effort, potential_impact, reusable, stage, priority, notes,
     scores, core_idea, hook, audience_problem, key_insight, script,
     visual_plan, production_notes, linkedin_post, instagram_caption,
     checklist, performance, lessons_learned, created_at, updated_at)
  values
    -- idea-1
    (seed_ws_id, 'idea-1',
     'I built a SaaS with AI agents and shipped it without a single code review',
     'Solo builders assume you need a team (or at least a reviewer) to ship production software.',
     'SaaS', 'Indie hackers', 'Video',
     4, 9, true, 'ideas', 'high',
     'Would pair well with a written teardown and a code walkthrough.',
     '{"audienceValue":9,"novelty":8,"personalRelevance":9,"easeOfExecution":6}'::jsonb,
     '', '', '', '', '', '', '', '', '',
     '[]'::jsonb, null, '',
     '2026-08-08T09:00:00.000Z', '2026-08-15T09:00:00.000Z'),
    -- idea-2
    (seed_ws_id, 'idea-2',
     'Automate my entire publishing pipeline with one Make.com workflow',
     'Creators lose hours per week on the repetitive steps between "done" and "published".',
     'Creator Workflows', 'Technical creators', 'Thread',
     2, 7, true, 'ideas', 'medium', '',
     '{"audienceValue":8,"novelty":6,"personalRelevance":8,"easeOfExecution":9}'::jsonb,
     '', '', '', '', '', '', '', '', '',
     '[]'::jsonb, null, '',
     '2026-08-05T09:00:00.000Z', '2026-08-05T09:00:00.000Z'),
    -- idea-3
    (seed_ws_id, 'idea-3',
     'A CLI tool that reviews your pull requests with a local LLM',
     'PR reviews are the bottleneck in every team, and sending code to hosted LLMs is a non-starter for many.',
     'Developer Tools', 'Developers', 'Demo',
     3, 8, false, 'ideas', 'medium', '',
     '{"audienceValue":8,"novelty":7,"personalRelevance":7,"easeOfExecution":6}'::jsonb,
     '', '', '', '', '', '', '', '', '',
     '[]'::jsonb, null, '',
     '2026-08-02T09:00:00.000Z', '2026-08-02T09:00:00.000Z'),
    -- idea-4
    (seed_ws_id, 'idea-4',
     'Chrome extension that turns any YouTube tutorial into a step-by-step build guide',
     'Tutorials are 20 minutes long but only contain 90 seconds of actionable steps.',
     'Web Apps', 'AI builders', 'Short-form video',
     3, 8, true, 'ideas', 'medium', '',
     '{"audienceValue":8,"novelty":8,"personalRelevance":6,"easeOfExecution":6}'::jsonb,
     '', '', '', '', '', '', '', '', '',
     '[]'::jsonb, null, '',
     '2026-07-30T09:00:00.000Z', '2026-07-30T09:00:00.000Z'),
    -- idea-5
    (seed_ws_id, 'idea-5',
     'Benchmark: 5 AI code editors on the same real-world project',
     'Every AI editor claims to be the best; almost nobody tests them on the same non-trivial task.',
     'Experiments', 'Developers', 'Article',
     5, 9, true, 'ideas', 'low',
     'Define a single repo + rubric first. Could spawn a video and a data post.',
     '{"audienceValue":9,"novelty":7,"personalRelevance":6,"easeOfExecution":4}'::jsonb,
     '', '', '', '', '', '', '', '', '',
     '[]'::jsonb, null, '',
     '2026-07-28T09:00:00.000Z', '2026-07-28T09:00:00.000Z'),
    -- idea-6
    (seed_ws_id, 'idea-6',
     'Ship a micro-SaaS MVP in 7 days, documenting every hour',
     'Build-in-public is full of highlight reels; people want the raw hour-by-hour truth.',
     'SaaS', 'Indie hackers', 'Thread',
     4, 8, true, 'ideas', 'high', '',
     '{"audienceValue":8,"novelty":6,"personalRelevance":8,"easeOfExecution":7}'::jsonb,
     '', '', '', '', '', '', '', '', '',
     '[]'::jsonb, null, '',
     '2026-07-26T09:00:00.000Z', '2026-07-26T09:00:00.000Z'),
    -- idea-7
    (seed_ws_id, 'idea-7',
     'Scrape and summarize 1,000 Hacker News comments with an agent pipeline',
     'Useful signal hides inside giant HN threads and nobody has time to read them all.',
     'Automation', 'Engineering managers', 'Tutorial',
     2, 6, false, 'ideas', 'low', '',
     '{"audienceValue":6,"novelty":6,"personalRelevance":5,"easeOfExecution":8}'::jsonb,
     '', '', '', '', '', '', '', '', '',
     '[]'::jsonb, null, '',
     '2026-07-24T09:00:00.000Z', '2026-07-24T09:00:00.000Z'),
    -- idea-8
    (seed_ws_id, 'idea-8',
     'Recreate one viral UI with plain CSS vs Tailwind vs an AI codegen tool',
     'People argue about tools without comparing their output side-by-side on the same target.',
     'Web Apps', 'Developers', 'Video',
     2, 7, false, 'ideas', 'medium', '',
     '{"audienceValue":7,"novelty":6,"personalRelevance":7,"easeOfExecution":9}'::jsonb,
     '', '', '', '', '', '', '', '', '',
     '[]'::jsonb, null, '',
     '2026-07-22T09:00:00.000Z', '2026-07-22T09:00:00.000Z'),
    -- pipe-1
    (seed_ws_id, 'pipe-1',
     'Local-first AI assistant that runs fully offline on a laptop',
     'People want AI without sending their data to a cloud; local models are now good enough to matter.',
     'AI', 'Developers', 'Demo',
     4, 8, true, 'research', 'high', '',
     '{"audienceValue":8,"novelty":8,"personalRelevance":8,"easeOfExecution":5}'::jsonb,
     '', '', '', '', '', '', '', '', '',
     '[]'::jsonb, null, '',
     '2026-08-10T09:00:00.000Z', '2026-08-16T09:00:00.000Z'),
    -- pipe-2
    (seed_ws_id, 'pipe-2',
     'Automate client onboarding with a self-hosted agent',
     'Onboarding is repetitive, error-prone, and eats founder time.',
     'Automation', 'Founders', 'Tutorial',
     3, 7, true, 'research', 'medium', '',
     '{"audienceValue":7,"novelty":5,"personalRelevance":6,"easeOfExecution":7}'::jsonb,
     '', '', '', '', '', '', '', '', '',
     '[]'::jsonb, null, '',
     '2026-08-09T09:00:00.000Z', '2026-08-09T09:00:00.000Z'),
    -- pipe-3
    (seed_ws_id, 'pipe-3',
     'Why your AI demos fail (and how to fix them)',
     'Most AI demos are 10 minutes of fluff with the interesting part buried at minute 8.',
     'AI', 'AI builders', 'Short-form video',
     1, 6, true, 'script', 'medium', '',
     '{"audienceValue":7,"novelty":6,"personalRelevance":6,"easeOfExecution":9}'::jsonb,
     'A tight, contrarian take on demo structure: open with the failure mode, not the product.',
     'Your AI demo lost everyone in the first 30 seconds — here is exactly why.',
     '', '', '', '', '', '', '',
     '[]'::jsonb, null, '',
     '2026-08-11T09:00:00.000Z', '2026-08-11T09:00:00.000Z'),
    -- pipe-4
    (seed_ws_id, 'pipe-4',
     'I let an AI agent manage my GitHub repos for 30 days',
     'Agent autonomy is overhyped — what actually happens when you give one real responsibility?',
     'Experiments', 'Developers', 'Article',
     4, 8, true, 'script', 'high', '',
     '{"audienceValue":8,"novelty":8,"personalRelevance":8,"easeOfExecution":5}'::jsonb,
     '', '', '', '', '', '', '', '', '',
     '[]'::jsonb, null, '',
     '2026-08-12T09:00:00.000Z', '2026-08-12T09:00:00.000Z'),
    -- pipe-5
    (seed_ws_id, 'pipe-5',
     'Turning a Figma file into a production app with AI',
     'Design-to-code is full of broken promises; founders want to know what actually ships.',
     'Web Apps', 'Founders', 'Video',
     3, 7, false, 'production', 'medium', '',
     '{"audienceValue":7,"novelty":6,"personalRelevance":7,"easeOfExecution":7}'::jsonb,
     '', '', '', '', '', '', '', '', '',
     '[]'::jsonb, null, '',
     '2026-08-13T09:00:00.000Z', '2026-08-17T09:00:00.000Z'),
    -- pub-1
    (seed_ws_id, 'pub-1',
     'I automated my email inbox with GPT-4o and saved 6 hours a week',
     'Inbox triage is the highest-friction, lowest-value work in a solo business.',
     'Automation', 'Technical creators', 'Short-form video',
     2, 8, true, 'published', 'high', '',
     '{"audienceValue":8,"novelty":7,"personalRelevance":9,"easeOfExecution":9}'::jsonb,
     'A simple AI triage pipeline: read → classify → draft replies → I approve with one click.',
     'My inbox answered itself for 30 days. Here is the 6-hour-a-week system I built.',
     'Solo creators drown in email they cannot ignore but should not write by hand.',
     'The win is not the draft quality — it is the approval loop that keeps a human in charge.',
     'HOOK: My inbox answered itself for 30 days.

0:00 – The pileup: 400 unread, 6 hours lost weekly.
0:10 – The pipeline: every email gets classified and drafted by GPT-4o.
0:30 – The human gate: I approve or edit in one click.
0:45 – The result: 6 hours recovered, zero missed clients.
0:55 – CTA: full workflow linked in the comments.',
     'Cold open: inbox counter ticking up in real time.
Mid: split-screen of the triage dashboard approving drafts.
Overlay: "6 hrs / week recovered" in monospace.
Close: clean title card + one CTA.',
     'Screen-record the dashboard at 2x. Record voiceover after, using the script as a bed.',
     'I automated my email inbox with GPT-4o and recovered 6 hours a week.

The key was not better prompts — it was a one-click approval loop that keeps me in charge.

Classify → draft → I approve.

Full workflow in the comments.

#Automation #BuildInPublic',
     'POV: your inbox answers itself 🤖

6 hours a week recovered with a GPT-4o triage pipeline. Would you trust it? 👇

#automation #ai #creator #buildinpublic',
     '[{"id":"Record the triage dashboard demo","label":"Record the triage dashboard demo","done":true},
       {"id":"Write script + hooks","label":"Write script + hooks","done":true},
       {"id":"Cut short-form edit (under 60s)","label":"Cut short-form edit (under 60s)","done":true},
       {"id":"Schedule post + pin comment with workflow","label":"Schedule post + pin comment with workflow","done":true}]'::jsonb,
     '{"publishedAt":"2026-07-20T09:00:00.000Z","platform":"YouTube Shorts + LinkedIn","views":184000,"likes":12400,"comments":620,"shares":1900,"saves":4300}'::jsonb,
     'Posts that show a real, boring workflow outperform polished product shots. The approval-loop detail drove the most comments.',
     '2026-07-15T09:00:00.000Z', '2026-07-20T09:00:00.000Z'),
    -- pub-2
    (seed_ws_id, 'pub-2',
     'Building a full-stack app with only natural language',
     'Can a non-stop natural-language loop really replace typed code for a real app?',
     'AI', 'AI builders', 'Article',
     3, 8, true, 'published', 'high', '',
     '{"audienceValue":8,"novelty":9,"personalRelevance":8,"easeOfExecution":5}'::jsonb,
     'A 72-hour build where I only typed English, never code, and documented every failure.',
     'I built a working full-stack app without writing a single line of code. It took 72 hours and broke in ways I did not expect.',
     'Builders want to know how far natural-language coding actually goes today.',
     'Natural language gets you 80% there; the last 20% still needs an engineer who can read the diff.',
     'HOOK: No code typed, 72 hours, one working app.

0:00 – The rule: English only.
0:15 – Day 1: the happy path works shockingly fast.
0:35 – Day 2: the wheels come off (auth, state, edge cases).
0:50 – Day 3: shipping a real MVP.
0:58 – The honest verdict.

CTA: read the full teardown in the comments.',
     'Time-lapse of the prompt log scrolling beside the app being built.
Big monospace counters: "0 lines typed", "72 hours", "1 app".
Clips of the worst failure moments kept in for honesty.',
     'Article first, then repurpose the strongest moments into 3 short clips.',
     'I built a working full-stack app without writing a line of code.

72 hours. English only.

The first 80% was magic. The last 20% still needed an engineer.

That last 20% is the moat — here is the full teardown.

#AI #BuildInPublic #Engineering',
     'No code. Just English. One working app in 72 hours 🤯

The last 20% surprised me. Full teardown in bio.

#ai #coding #buildinpublic',
     '[{"id":"Outline + target audience","label":"Outline + target audience","done":true},
       {"id":"Draft article","label":"Draft article","done":true},
       {"id":"Record the 72h time-lapse","label":"Record the 72h time-lapse","done":true},
       {"id":"Publish + cross-post clips","label":"Publish + cross-post clips","done":true}]'::jsonb,
     '{"publishedAt":"2026-07-08T09:00:00.000Z","platform":"Blog + X","views":96000,"likes":8900,"comments":540,"shares":2100,"saves":3600}'::jsonb,
     'Failure footage builds trust. The sections where I showed things breaking got the most engagement and quotes.',
     '2026-07-04T09:00:00.000Z', '2026-07-08T09:00:00.000Z'),
    -- pub-3
    (seed_ws_id, 'pub-3',
     'My AI code review bot caught 40 real bugs in a month',
     'Teams want AI review, but the ROI is rarely measured with real bug counts.',
     'Developer Tools', 'Engineering managers', 'Article',
     3, 8, false, 'published', 'medium', '',
     '{"audienceValue":8,"novelty":7,"personalRelevance":9,"easeOfExecution":6}'::jsonb,
     'A month-long field test of a local-LLM review bot with every catch logged and verified.',
     'An AI reviewer caught 40 real bugs on my team in 30 days. Here is the data — and the 12 false alarms.',
     'Engineering leaders need evidence, not demos, before adding AI to the review flow.',
     'Precision matters more than recall — a reviewer that cries wolf gets ignored within a week.',
     'HOOK: 40 real bugs, 30 days, one AI reviewer.

0:00 – The setup: local model, PR hook.
0:20 – The wins: null-safety, race conditions, bad migrations.
0:40 – The cost: 12 false alarms, one ignored by the team.
0:55 – The verdict: ship it, but tune precision first.

CTA: full data and prompt in the comments.',
     'Dashboard card with the bug tally animating up to 40.
Side-by-side: real bug diff vs false positive.
Simple bar chart of catch categories.',
     'Redact all proprietary code. Keep the prompt and thresholds in the repo link.',
     'An AI code reviewer caught 40 real bugs on my team in 30 days.

And 12 false alarms that nearly got it uninstalled.

The lesson: precision beats recall in AI review.

Full data + prompt in the comments.

#DeveloperTools #AI #Engineering',
     '40 real bugs. 30 days. One AI reviewer 🐛🤖

The false alarms almost killed it. Full breakdown in bio.

#ai #developertools #engineering',
     '[{"id":"Collect and verify bug log","label":"Collect and verify bug log","done":true},
       {"id":"Draft article + charts","label":"Draft article + charts","done":true},
       {"id":"Redact code samples","label":"Redact code samples","done":true},
       {"id":"Publish + share data","label":"Publish + share data","done":true}]'::jsonb,
     '{"publishedAt":"2026-06-26T09:00:00.000Z","platform":"Blog + Reddit","views":64000,"likes":5100,"comments":430,"shares":980,"saves":2400}'::jsonb,
     'Data posts compound: the original bug tally got picked up by two newsletters because the numbers were verifiable.',
     '2026-06-22T09:00:00.000Z', '2026-06-26T09:00:00.000Z'),
    -- pub-4
    (seed_ws_id, 'pub-4',
     'How I ship side projects: a repeatable 3-day system',
     'Most side projects die in week two because there is no system for the boring middle.',
     'Creator Workflows', 'Indie hackers', 'Thread',
     2, 7, true, 'published', 'medium', '',
     '{"audienceValue":9,"novelty":6,"personalRelevance":9,"easeOfExecution":9}'::jsonb,
     'A 3-day cadence — scope, build, ship — that forces a deadline and kills scope creep.',
     'I used to abandon every side project in week two. Then I built a 3-day shipping system.',
     'Indie hackers start strong and quit when the novelty fades.',
     'The system works because day 1 forbids new scope — not because of motivation.',
     'HOOK: Every side project I ever shipped used the same 3-day system.

Day 1 – Scope: one job, one metric.
Day 2 – Build: no new features allowed.
Day 3 – Ship: publish or kill it.

CTA: save this thread for your next project.',
     'Thread cards with one idea each, minimal color, big type. A simple 3-column visual for the three days.',
     'Keep the thread under 10 posts. Repurpose into a carousel a week later.',
     'Every side project I have ever shipped used the same 3-day system.

Day 1 — Scope: one job, one metric.
Day 2 — Build: no new features.
Day 3 — Ship: publish or kill it.

Not a motivation trick. A scope trick.

#IndieHackers #BuildInPublic',
     'The 3-day system behind every side project I ship 🚀

Day 1 scope, Day 2 build, Day 3 ship. Save this for your next one.

#indiehackers #buildinpublic #creators',
     '[{"id":"Draft thread (10 posts max)","label":"Draft thread (10 posts max)","done":true},
       {"id":"Design 3 card visuals","label":"Design 3 card visuals","done":true},
       {"id":"Schedule thread","label":"Schedule thread","done":true},
       {"id":"Repurpose into carousel","label":"Repurpose into carousel","done":true}]'::jsonb,
     '{"publishedAt":"2026-06-18T09:00:00.000Z","platform":"X","views":210000,"likes":14200,"comments":780,"shares":3400,"saves":6100}'::jsonb,
     'Frameworks and systems outperform single tips. The "scope trick" framing made it more shareable than motivation advice.',
     '2026-06-15T09:00:00.000Z', '2026-06-18T09:00:00.000Z'),
    -- pub-5
    (seed_ws_id, 'pub-5',
     'The 7 AI tools I actually use daily as a developer',
     'AI tool lists are usually affiliate fluff with no real daily usage.',
     'AI', 'Developers', 'Carousel',
     1, 6, true, 'published', 'low', '',
     '{"audienceValue":7,"novelty":6,"personalRelevance":8,"easeOfExecution":9}'::jsonb,
     'A no-BS list of the 7 tools that survived 90 days of actual use, with what each replaced.',
     'I tried 40 AI tools in 90 days. Only 7 made my daily workflow — here is the honest list.',
     'Developers are sick of hype lists and want tools that survive real usage.',
     'The tools that win are the ones that replace a specific 10-minute task, not "everything".',
     'Slide 1 – "40 tried, 7 kept."
Slides 2–8 – one tool per slide: what it replaced + the catch.
Slide 9 – the pattern: specific-task tools beat general assistants.
Slide 10 – CTA: save for later.',
     'One tool per slide, consistent layout: icon, "replaces X", one honest caveat. Dark, minimal, no logos clashing.',
     'Export at 1080x1350. Keep the caveats — they are the differentiator.',
     'I tried 40 AI tools in 90 days. Only 7 survived my daily workflow.

The pattern: the winners replace one specific 10-minute task.

The "do everything" tools lost.

Full list in the carousel below.

#AI #DeveloperTools',
     '40 AI tools. 90 days. 7 survivors 🧰

The winners all replace one specific task. Save this list.

#ai #developertools #carousel',
     '[{"id":"Shortlist the 7 tools","label":"Shortlist the 7 tools","done":true},
       {"id":"Design carousel template","label":"Design carousel template","done":true},
       {"id":"Write caveats per tool","label":"Write caveats per tool","done":true},
       {"id":"Publish + pin save CTA","label":"Publish + pin save CTA","done":true}]'::jsonb,
     '{"publishedAt":"2026-06-08T09:00:00.000Z","platform":"Instagram + LinkedIn","views":74000,"likes":6800,"comments":310,"shares":1500,"saves":5200}'::jsonb,
     'Carousels with honest caveats massively outperform pure praise lists. Saves were the dominant signal.',
     '2026-06-04T09:00:00.000Z', '2026-06-08T09:00:00.000Z')
  on conflict (workspace_id, v2_id) do nothing;

  -- --------------------------------------------------------------------------
  -- 2. experiments — 4 rows
  -- --------------------------------------------------------------------------
  insert into public.experiments
    (workspace_id, v2_id, name, status, outcome, hypothesis, what_was_built,
     tools, time_spent, result, metrics, what_worked, what_failed,
     key_learning, follow_up_idea, worth_repeating, created_at, updated_at)
  values
    (seed_ws_id, 'exp-1',
     'Prompt loop: iterate with AI feedback vs one-shot prompts',
     'done', 'success',
     'Iterating a prompt with model-generated critique produces a better result than a single carefully-written prompt.',
     'A small harness that asks the model to critique its own output, then regenerates, for N rounds on a fixed task.',
     'Python, GPT-4o, a fixed 20-case eval set',
     '6 hours',
     '3-round self-critique beat the best one-shot prompt by 18% on the eval set.',
     '[{"label":"Eval win rate","value":"+18%"},{"label":"Rounds tested","value":"1–5"},{"label":"Cost per task","value":"+2.3x"}]'::jsonb,
     'Keeping a fixed eval set made every iteration measurable. Self-critique worked best on structured outputs.',
     'Beyond 3 rounds, results degraded — the model started overfitting to its own style.',
     'A short, measurable feedback loop beats more prompt engineering. Cap the rounds.',
     'Test the same loop with a cheaper model as the critic and a strong model as the writer.',
     true,
     '2026-07-18T09:00:00.000Z', '2026-07-23T09:00:00.000Z'),
    (seed_ws_id, 'exp-2',
     'Does posting at 6am vs 6pm change engagement?',
     'done', 'mixed',
     'Posting in the morning drives more engagement than the evening for a developer audience.',
     'A 4-week A/B across 8 posts, alternating identical formats at 6am and 6pm.',
     'Manual posting, platform analytics, a tracking sheet',
     '4 weeks (ongoing monitoring)',
     'Morning posts got 12% more reach, but evening posts had 8% higher comment quality. Net effect was small.',
     '[{"label":"Morning reach","value":"+12%"},{"label":"Evening comments","value":"+8%"},{"label":"Confidence","value":"Low"}]'::jsonb,
     'Alternating identical formats kept the comparison clean.',
     'Sample size too small — algorithmic variance swamped the time-of-day effect.',
     'Time of day matters less than topic freshness. Not worth optimizing until volume is higher.',
     'Re-run with 30+ posts and topic held constant before drawing conclusions.',
     false,
     '2026-07-03T09:00:00.000Z', '2026-07-08T09:00:00.000Z'),
    (seed_ws_id, 'exp-3',
     'Can I build a working CRUD app in under 60 minutes with an AI editor?',
     'done', 'success',
     'A focused, experienced developer can ship a small but real CRUD app in under an hour using an AI editor.',
     'An inventory tracker with auth, a DB, and deploy — timed with a stopwatch.',
     'Cursor, Next.js, SQLite, Vercel',
     '54 minutes',
     'Shipped a working app in 54 minutes, including deploy. The demo itself became a top-performing post.',
     '[{"label":"Build time","value":"54 min"},{"label":"Manual fixes","value":"3"},{"label":"Result","value":"Shipped"}]'::jsonb,
     'Extreme scope discipline — I wrote the spec first and refused feature creep.',
     'The AI hallucinated two API routes that cost me 8 minutes to spot and fix.',
     'The bottleneck is the human, not the model. A tight spec beats a smarter model.',
     'Repeat with a junior developer to see if the 60-minute bar still holds.',
     true,
     '2026-07-13T09:00:00.000Z', '2026-07-15T09:00:00.000Z'),
    (seed_ws_id, 'exp-4',
     'Auto-generating thumbnails with an image model',
     'running', 'mixed',
     'AI-generated thumbnails can match or beat my manually designed thumbnails on click-through rate.',
     'A pipeline that generates 3 thumbnail variants per post and serves them in a rotating A/B test.',
     'Image model API, a rotation script, CTR tracking',
     'Ongoing — week 2 of 4',
     'Early data: AI variants trail manual thumbnails by ~9% CTR, but one style variant is close.',
     '[{"label":"Variants per post","value":"3"},{"label":"CTR delta","value":"-9%"},{"label":"Weeks run","value":"2/4"}]'::jsonb,
     'The rotation infra is solid; CTR differences are now measurable per variant.',
     'Generic AI art underperforms — the model over-renders and adds noise.',
     'Prompting for "clean, minimal, high contrast" matters more than the model choice.',
     'Train the prompts on my best 20 manual thumbnails and re-test.',
     false,
     '2026-08-07T09:00:00.000Z', '2026-08-17T09:00:00.000Z')
  on conflict (workspace_id, v2_id) do nothing;

  -- --------------------------------------------------------------------------
  -- 3. contents — 4 rows (V2 ContentItem; linked ids resolve to the seeded
  --    items/experiments by v2_id)
  -- --------------------------------------------------------------------------
  insert into public.contents
    (workspace_id, v2_id, title, concept, origin, audience, content_type,
     format, hook, draft, notes, status, linked_idea_id, linked_experiment_id,
     created_at, updated_at)
  values
    (seed_ws_id, 'content-1',
     'Automate my entire publishing pipeline with one Make.com workflow',
     'A single Make.com scenario that turns a finished script into scheduled posts across Instagram, YouTube, LinkedIn and X — assets, captions, hashtags and a Velgic publishing manifest included.',
     'idea', 'Technical creators', 'tutorial',
     'Text + screen-recording tutorial',
     'I replaced 6 hours of weekly posting busywork with one Make.com workflow — here is the exact blueprint.',
     'Intro: the five manual steps every creator repeats per post. Middle: the scenario, node by node. Outro: export the Velgic manifest as the deliverable.',
     'Linked to idea-2. Ship the manifest export as the call to action.',
     'ready',
     (select id from public.items where workspace_id = seed_ws_id and v2_id = 'idea-2'),
     null,
     '2026-08-11T09:00:00.000Z', '2026-08-16T09:00:00.000Z'),
    (seed_ws_id, 'content-2',
     'I built a working CRUD app in 54 minutes with an AI editor',
     'A 54-minute timed build of an inventory tracker with auth, DB and deploy, told as a speedrun — including the three manual fixes and where the AI saved time.',
     'experiment', 'Developers', 'youtube_short',
     'Under-60s vertical Short + link to the full write-up',
     'I built and deployed a CRUD app in 54 minutes. Here is the timer, the three bugs, and where the AI saved me.',
     '',
     'From exp-3. Reuse the timer footage and the three manual fixes as the spine.',
     'draft',
     null,
     (select id from public.experiments where workspace_id = seed_ws_id and v2_id = 'exp-3'),
     '2026-08-13T09:00:00.000Z', '2026-08-13T09:00:00.000Z'),
    (seed_ws_id, 'content-3',
     'Why AI agents get stuck in loops',
     'Agents get stuck in loops because their context breaks down, not their reasoning. Anatomy of the failure mode plus three fixes: checkpointing, memory compaction, and explicit exit conditions.',
     'observation', 'AI builders', 'short_video',
     'Vertical short-form, under 60s',
     'Your AI agent is not stuck in a loop — its memory is. Here is the fix.',
     'Hook → the loop clip → anatomy (3 causes, ~10s each) → the fixes → CTA.',
     '',
     'ready',
     null, null,
     '2026-08-12T09:00:00.000Z', '2026-08-17T09:00:00.000Z'),
    (seed_ws_id, 'content-4',
     'Top open-source alternatives for content creators',
     'Free, open-source replacements for the paid creator stack — video editing, design, hosting, analytics — each with one honest caveat, framed as "you trade money for setup time".',
     'research', 'Technical creators', 'short_video',
     'Vertical short-form, under 60s',
     'You do not need to pay for your creator stack. Here are the open-source tools I actually use.',
     '',
     'V2 end-to-end test case: one content concept, four platforms, independent platform statuses.',
     'in_production',
     null, null,
     '2026-08-08T09:00:00.000Z', '2026-08-11T09:00:00.000Z')
  on conflict (workspace_id, v2_id) do nothing;

  -- --------------------------------------------------------------------------
  -- 4. campaigns — 4 rows (content_id resolved by v2_id; NO platforms column —
  --    derived from platform_contents at read time)
  -- --------------------------------------------------------------------------
  insert into public.campaigns
    (workspace_id, v2_id, content_id, name, description, status, created_at, updated_at)
  values
    (seed_ws_id, 'camp-1',
     (select id from public.contents where workspace_id = seed_ws_id and v2_id = 'content-1'),
     'Make.com publishing pipeline — launch week',
     'Launch week distribution for the publishing pipeline tutorial.',
     'partially_published',
     '2026-08-13T09:00:00.000Z', '2026-08-16T09:00:00.000Z'),
    (seed_ws_id, 'camp-2',
     (select id from public.contents where workspace_id = seed_ws_id and v2_id = 'content-2'),
     '54-minute CRUD app speedrun',
     'Short + thread from the CRUD experiment.',
     'draft',
     '2026-08-14T09:00:00.000Z', '2026-08-14T09:00:00.000Z'),
    (seed_ws_id, 'camp-3',
     (select id from public.contents where workspace_id = seed_ws_id and v2_id = 'content-3'),
     'AI agents stuck in loops',
     'One concept, four platforms.',
     'draft',
     '2026-08-15T09:00:00.000Z', '2026-08-17T09:00:00.000Z'),
    (seed_ws_id, 'camp-4',
     (select id from public.contents where workspace_id = seed_ws_id and v2_id = 'content-4'),
     'Top Open Source Alternatives',
     'One content concept, distributed across four platforms.',
     'partially_published',
     '2026-08-09T09:00:00.000Z', '2026-08-11T09:00:00.000Z')
  on conflict (workspace_id, v2_id) do nothing;

  -- --------------------------------------------------------------------------
  -- 5. platform_contents — 14 rows. Per-platform metadata jsonb mirrors the
  --    V2 non-flattened shapes (instagram/youtube/linkedin/x). The CHECK on
  --    the table enforces exactly one matching metadata object.
  -- --------------------------------------------------------------------------
  insert into public.platform_contents
    (workspace_id, v2_id, campaign_id, platform, format, status,
     published_url, published_at, notes,
     schedule_enabled, schedule_datetime, schedule_timezone,
     instagram, youtube, linkedin, x, metrics, created_at, updated_at)
  values
    (seed_ws_id, 'pc-1',
     (select id from public.campaigns where workspace_id = seed_ws_id and v2_id = 'camp-1'),
     'instagram', 'Reel', 'ready',
     null, null, '',
     true, '2026-08-19T09:00:00.000Z', 'America/New_York',
     '{"caption":"I automated my whole publishing pipeline with ONE Make.com workflow 🤖\n\nEvery finished script now becomes scheduled posts + captions + hashtags across 4 platforms.\n\nWould you use this? 👇","hashtags":["#buildinpublic","#automation","#creators","#make"],"location":""}'::jsonb,
     null, null, null, null,
     '2026-08-13T09:00:00.000Z', '2026-08-16T09:00:00.000Z'),
    (seed_ws_id, 'pc-2',
     (select id from public.campaigns where workspace_id = seed_ws_id and v2_id = 'camp-1'),
     'youtube', 'Short', 'draft',
     null, null, '',
     false, null, null,
     null,
     '{"title":"I automated my entire publishing pipeline with Make.com","description":"One workflow turns a finished script into scheduled posts across Instagram, YouTube, LinkedIn and X. Full scenario walkthrough inside.","tags":["make.com","automation","creator workflow"]}'::jsonb,
     null, null, null,
     '2026-08-13T09:00:00.000Z', '2026-08-13T09:00:00.000Z'),
    (seed_ws_id, 'pc-3',
     (select id from public.campaigns where workspace_id = seed_ws_id and v2_id = 'camp-1'),
     'linkedin', 'Post', 'published',
     'https://www.linkedin.com/posts/velgic-publishing-pipeline', '2026-08-15T09:00:00.000Z', '',
     false, null, null,
     null, null,
     '{"post_text":"I automated my entire publishing pipeline with one Make.com workflow.\n\nScript in → scheduled posts out, across Instagram, YouTube, LinkedIn and X.\n\nThe part that surprised me: the biggest win was the manifest — one JSON that describes every post, caption, asset and schedule. Now my publishing is reviewable like code.\n\n#BuildInPublic #Automation #CreatorEconomy"}'::jsonb,
     null, null,
     '2026-08-14T09:00:00.000Z', '2026-08-15T09:00:00.000Z'),
    (seed_ws_id, 'pc-4',
     (select id from public.campaigns where workspace_id = seed_ws_id and v2_id = 'camp-1'),
     'x', 'Thread', 'scheduled',
     null, null, '',
     true, '2026-08-18T09:00:00.000Z', 'America/New_York',
     null, null, null,
     '{"content":"I replaced my entire weekly publishing routine with one Make.com workflow.\n\nThe routine was: 5 manual steps × 4 platforms = 20 decisions per post.\n\nNow: script in → manifest out. One JSON describes every post, caption, asset, and schedule across Instagram, YouTube, LinkedIn and X.\n\nPublishing became a code review, not a chore.","is_thread":true}'::jsonb,
     null,
     '2026-08-14T09:00:00.000Z', '2026-08-16T09:00:00.000Z'),
    (seed_ws_id, 'pc-5',
     (select id from public.campaigns where workspace_id = seed_ws_id and v2_id = 'camp-2'),
     'youtube', 'Short', 'draft',
     null, null, '',
     false, null, null,
     null,
     '{"title":"A working CRUD app in 54 minutes with an AI editor","description":"Timed build: auth, DB, deploy — 54 minutes. The three manual fixes and where the AI saved time.","tags":["ai editor","cursor","build in public"]}'::jsonb,
     null, null, null,
     '2026-08-14T09:00:00.000Z', '2026-08-14T09:00:00.000Z'),
    (seed_ws_id, 'pc-6',
     (select id from public.campaigns where workspace_id = seed_ws_id and v2_id = 'camp-2'),
     'x', 'Post', 'draft',
     null, null, '',
     false, null, null,
     null, null, null,
     '{"content":"I built and deployed a CRUD app in 54 minutes with an AI editor.\n\n3 manual fixes, 2 hallucinated routes, 1 shipped app.\n\nThe bottleneck was never the model — it was my spec.","is_thread":false}'::jsonb,
     null,
     '2026-08-14T09:00:00.000Z', '2026-08-14T09:00:00.000Z'),
    (seed_ws_id, 'pc-7',
     (select id from public.campaigns where workspace_id = seed_ws_id and v2_id = 'camp-3'),
     'instagram', 'Reel', 'ready',
     null, null, '',
     false, null, null,
     '{"caption":"POV: your AI agent keeps looping the same three steps 🤖\n\nIt is not stuck — its memory is. Here are the three fixes:\n1. Checkpoint progress\n2. Compact memory before it overflows\n3. Give it an exit condition\n\nSave this for your next agent build 👇","hashtags":["#ai","#aiagents","#buildinpublic","#llm"],"location":""}'::jsonb,
     null, null, null, null,
     '2026-08-15T09:00:00.000Z', '2026-08-17T09:00:00.000Z'),
    (seed_ws_id, 'pc-8',
     (select id from public.campaigns where workspace_id = seed_ws_id and v2_id = 'camp-3'),
     'youtube', 'Short', 'draft',
     null, null, '',
     false, null, null,
     null,
     '{"title":"Why AI agents get stuck in loops","description":"The loop is a symptom: the model lost the context it needs to make progress. Three fixes that actually work.","tags":["ai agents","llm","context engineering"]}'::jsonb,
     null, null, null,
     '2026-08-15T09:00:00.000Z', '2026-08-15T09:00:00.000Z'),
    (seed_ws_id, 'pc-9',
     (select id from public.campaigns where workspace_id = seed_ws_id and v2_id = 'camp-3'),
     'linkedin', 'Post', 'draft',
     null, null, '',
     false, null, null,
     null, null,
     '{"post_text":"Most agent failures are not reasoning failures. They are context failures.\n\nWhen an agent loops, it usually lost the information it needs to make progress — so it re-runs the only steps it still remembers.\n\nThree fixes we ship in production:\n• Checkpoint progress after every step\n• Compact memory before it overflows\n• Define explicit exit conditions\n\nThe loop is a symptom. Fix the memory, not the model.\n\n#AI #AIEngineering #LLM"}'::jsonb,
     null, null,
     '2026-08-15T09:00:00.000Z', '2026-08-15T09:00:00.000Z'),
    (seed_ws_id, 'pc-10',
     (select id from public.campaigns where workspace_id = seed_ws_id and v2_id = 'camp-3'),
     'x', 'Thread', 'ready',
     null, null, '',
     false, null, null,
     null, null, null,
     '{"content":"Your AI agent is not stuck in a loop — its memory is.\n\nThe loop is a symptom: the model lost the context it needs to make progress, so it re-runs the only steps it still remembers.\n\nThree fixes:\n1. Checkpoint progress after every step.\n2. Compact memory before it overflows.\n3. Define explicit exit conditions.\n\nThe loop is a symptom. Fix the memory, not the model.","is_thread":true}'::jsonb,
     null,
     '2026-08-15T09:00:00.000Z', '2026-08-17T09:00:00.000Z'),
    (seed_ws_id, 'pc-11',
     (select id from public.campaigns where workspace_id = seed_ws_id and v2_id = 'camp-4'),
     'instagram', 'Reel', 'published',
     'https://www.instagram.com/reel/oss-creators', '2026-08-11T09:00:00.000Z',
     'Published from the app manually — analytics in platform insights.',
     false, null, null,
     '{"caption":"You do not need to pay for your creator stack 🤝\n\nEvery paid tool I replaced with an open-source alternative — and the one caveat that keeps me honest.\n\nSave this for your next setup 👇","hashtags":["#opensource","#creators","#buildinpublic"],"location":""}'::jsonb,
     null, null, null, null,
     '2026-08-09T09:00:00.000Z', '2026-08-11T09:00:00.000Z'),
    (seed_ws_id, 'pc-12',
     (select id from public.campaigns where workspace_id = seed_ws_id and v2_id = 'camp-4'),
     'youtube', 'Short', 'scheduled',
     null, null,
     'Thumbnail variant A/B is running via the experiment log.',
     true, '2026-08-18T09:00:00.000Z', 'Asia/Kolkata',
     null,
     '{"title":"Top open-source alternatives for content creators","description":"The free, open-source replacements for your paid creator stack — video editing, design, hosting, analytics — with one honest caveat per tool.","tags":["open source","creator tools","oss"]}'::jsonb,
     null, null, null,
     '2026-08-09T09:00:00.000Z', '2026-08-10T09:00:00.000Z'),
    (seed_ws_id, 'pc-13',
     (select id from public.campaigns where workspace_id = seed_ws_id and v2_id = 'camp-4'),
     'linkedin', 'Post', 'ready',
     null, null, '',
     false, null, null,
     null, null,
     '{"post_text":"You do not need a paid subscription for every part of your creator stack.\n\nEvery tool I replaced with an open-source alternative — video editing, design, hosting, analytics — and the one honest caveat for each.\n\nThe caveat pattern: free means you trade money for setup time.\n\n#OpenSource #BuildInPublic #CreatorEconomy"}'::jsonb,
     null, null,
     '2026-08-09T09:00:00.000Z', '2026-08-09T09:00:00.000Z'),
    (seed_ws_id, 'pc-14',
     (select id from public.campaigns where workspace_id = seed_ws_id and v2_id = 'camp-4'),
     'x', 'Thread', 'draft',
     null, null, '',
     false, null, null,
     null, null, null,
     '{"content":"You do not need to pay for your creator stack.\n\nEvery paid tool I replaced with an open-source alternative — and the one caveat that keeps me honest.\n\nVideo editing, design, hosting, analytics: there is an open-source option for each.\n\nThe caveat: free means you trade money for setup time. Bookmark the ones worth that trade.","is_thread":true}'::jsonb,
     null,
     '2026-08-09T09:00:00.000Z', '2026-08-09T09:00:00.000Z')
  on conflict (workspace_id, v2_id) do nothing;

  -- --------------------------------------------------------------------------
  -- 6. assets — 10 library entries (9 referenced by platform versions +
  --    brand-kit-01, which is referenced by no platform version).
  --    `asset_id` is the V2 canonical library id.
  --    library_created_at mirrors src/data/seed.ts: the first platform
  --    version that referenced the asset (or the explicit value for
  --    brand-kit-01).
  -- --------------------------------------------------------------------------
  insert into public.assets
    (workspace_id, asset_id, filename, type, reference, provider, role,
     mime_type, size, duration, library_notes, library_created_at)
  values
    (seed_ws_id, 'instagram-reel-01', 'reel.mp4', 'video', 'instagram/reel.mp4', 'local', 'media',
     null, null, null, '', '2026-08-13T09:00:00.000Z'),
    (seed_ws_id, 'youtube-short-01', 'short.mp4', 'video', 'youtube/short.mp4', 'local', 'video',
     null, null, null, '', '2026-08-13T09:00:00.000Z'),
    (seed_ws_id, 'youtube-thumb-01', 'thumb.jpg', 'image', 'youtube/thumb.jpg', 'local', 'thumbnail',
     null, null, null, '', '2026-08-13T09:00:00.000Z'),
    (seed_ws_id, 'instagram-reel-02', 'loop.mp4', 'video', 'instagram/loop.mp4', 'local', 'media',
     null, null, null, '', '2026-08-15T09:00:00.000Z'),
    (seed_ws_id, 'youtube-short-02', 'agents-loop.mp4', 'video', 'youtube/agents-loop.mp4', 'local', 'video',
     null, null, null, '', '2026-08-15T09:00:00.000Z'),
    (seed_ws_id, 'youtube-thumb-02', 'agents-loop-thumb.jpg', 'image', 'youtube/agents-loop-thumb.jpg', 'local', 'thumbnail',
     null, null, null, '', '2026-08-15T09:00:00.000Z'),
    (seed_ws_id, 'instagram-reel-03', 'oss-reel.mp4', 'video', 'instagram/oss-reel.mp4', 'local', 'media',
     'video/mp4', 24800000, 42, '', '2026-08-09T09:00:00.000Z'),
    (seed_ws_id, 'youtube-short-03', 'oss-short.mp4', 'video', 'youtube/oss-short.mp4', 'local', 'video',
     'video/mp4', 24800000, 42, '', '2026-08-09T09:00:00.000Z'),
    (seed_ws_id, 'youtube-thumb-03', 'oss-thumb.jpg', 'image', 'youtube/oss-thumb.jpg', 'local', 'thumbnail',
     'image/jpeg', 320000, null, '', '2026-08-09T09:00:00.000Z'),
    (seed_ws_id, 'brand-kit-01', 'brand-kit.pdf', 'document', 'brand/brand-kit.pdf', 'local', null,
     'application/pdf', 1200000, null, 'Brand kit — not yet referenced by any campaign.', '2026-08-03T09:00:00.000Z')
  on conflict (workspace_id, asset_id) do nothing;

  -- --------------------------------------------------------------------------
  -- 7. asset_references — 9 usage rows (platform version ↔ library asset,
  --    with the per-usage role from src/data/seed.ts). Both FK endpoints
  --    resolve by v2_id / asset_id.
  -- --------------------------------------------------------------------------
  insert into public.asset_references (asset_id, platform_content_id, role)
  values
    ((select id from public.assets where workspace_id = seed_ws_id and asset_id = 'instagram-reel-01'),
     (select id from public.platform_contents where workspace_id = seed_ws_id and v2_id = 'pc-1'),
     'media'),
    ((select id from public.assets where workspace_id = seed_ws_id and asset_id = 'youtube-short-01'),
     (select id from public.platform_contents where workspace_id = seed_ws_id and v2_id = 'pc-2'),
     'video'),
    ((select id from public.assets where workspace_id = seed_ws_id and asset_id = 'youtube-thumb-01'),
     (select id from public.platform_contents where workspace_id = seed_ws_id and v2_id = 'pc-2'),
     'thumbnail'),
    ((select id from public.assets where workspace_id = seed_ws_id and asset_id = 'instagram-reel-02'),
     (select id from public.platform_contents where workspace_id = seed_ws_id and v2_id = 'pc-7'),
     'media'),
    ((select id from public.assets where workspace_id = seed_ws_id and asset_id = 'youtube-short-02'),
     (select id from public.platform_contents where workspace_id = seed_ws_id and v2_id = 'pc-8'),
     'video'),
    ((select id from public.assets where workspace_id = seed_ws_id and asset_id = 'youtube-thumb-02'),
     (select id from public.platform_contents where workspace_id = seed_ws_id and v2_id = 'pc-8'),
     'thumbnail'),
    ((select id from public.assets where workspace_id = seed_ws_id and asset_id = 'instagram-reel-03'),
     (select id from public.platform_contents where workspace_id = seed_ws_id and v2_id = 'pc-11'),
     'media'),
    ((select id from public.assets where workspace_id = seed_ws_id and asset_id = 'youtube-short-03'),
     (select id from public.platform_contents where workspace_id = seed_ws_id and v2_id = 'pc-12'),
     'video'),
    ((select id from public.assets where workspace_id = seed_ws_id and asset_id = 'youtube-thumb-03'),
     (select id from public.platform_contents where workspace_id = seed_ws_id and v2_id = 'pc-12'),
     'thumbnail')
  on conflict (asset_id, platform_content_id) do nothing;

end $$;
