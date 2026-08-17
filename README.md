# Velgic

**Velgic — AI-powered Creator & Content Intelligence OS.** A local-first tool for a technical creator that takes you from **idea → experiment → content → publishing → learning**.

Built as a functional MVP (not a static mockup). Dark, professional, developer-grade UI.

## Stack

- **React 18 + TypeScript** (Vite)
- **React Router** (hash-based, no server rewrites needed)
- **Zustand** with `persist` — everything you edit is saved to `localStorage`
- **Plain CSS** design system (no UI framework) with CSS variables / design tokens

## The three questions Velgic answers

1. **What should I explore/build?** → Ideas + Experiments (recommendation engine, opportunity scoring, experiment log)
2. **What should I publish?** → Content + Campaigns + multi-platform distribution (Velgic Publishing Manifest)
3. **What did I learn?** → Insights

These stay separate workflows: an **Idea does not need an Experiment**, and a simple
Reel, post, or thread does **not** require an experiment — content can be created
directly, from an idea, or from an experiment.

```
Idea
├── Start experiment → Experiment
└── Create content → Content

Experiment
└── Create content → Content

Content
└── Campaign → Platform content (Instagram / YouTube / LinkedIn / X)
```

## V1 — the existing product (unchanged)

- **Dashboard** — "What should I build next?" recommendation engine, content-pipeline summary, quick capture, recent experiments, content status, recent content.
- **Idea Inbox** — capture ideas with category, audience, format, effort, impact, status, and notes; score each idea 1–10 across *audience value*, *novelty*, *personal relevance*, and *ease of execution* for a computed opportunity score (0–40).
- **Content Pipeline** — a drag-and-drop Kanban board (Ideas → Research → Script → Production → Published). This remains the **production workflow**.
- **Content Detail** — per-item sections (core idea, hook, audience problem, key insight, script, visual plan, production notes, publishing checklist, performance, lessons learned) plus one-click mock AI generation for hooks, short-form scripts, visual plans, LinkedIn posts, and Instagram captions.
- **Experiment Log** — hypothesis, what was built, tools, time spent, result, metrics, what worked/failed, key learning, and follow-up idea — framed as learning records, not vanity metrics.
- **Insights** — best topics, best formats, best hooks, average performance, experiments worth repeating, and underperforming topics (simple charts only).

## V2 — Content + Multi-platform Publishing (new)

- **Content** — a first-class section in the sidebar. A content item has title,
  concept, origin (idea / experiment / research / observation / opinion / trend /
  personal experience / direct), audience, content type (Reel, Carousel, Short
  video, LinkedIn post, X post, X thread, YouTube Short, YouTube video, Article,
  Tutorial), format, hook, draft, notes, status, and optional links to an idea or
  experiment. Content can be created directly from the Content section, from any
  idea, or from any experiment.
- **Campaigns** — one content concept becomes a multi-platform campaign:

  ```
  Why AI agents get stuck in loops
  ├── Instagram → Reel    (asset, caption, hashtags, location)
  ├── YouTube   → Short   (video + thumbnail assets, title, description, tags)
  ├── LinkedIn  → Post    (post text, media)
  └── X         → Thread  (post/thread content, media)
  ```

  Each platform version is independently editable, with its own schedule
  (enabled + datetime + IANA timezone), publishing lifecycle
  (**Draft → Ready → Scheduled → Published → Failed**), and published URL.
  Actions per platform: Copy content, Copy caption, Export manifest, Open
  platform, Mark ready / scheduled / published, Add published URL. A publishing
  readiness checklist is computed per platform.
- **Velgic Publishing Manifest** — the central V2 feature. A canonical JSON
  package (`"schema_version": "1.0"`) describing the campaign, content,
  platforms, platform-specific metadata, asset references, captions/text,
  titles, descriptions, tags/hashtags, location, scheduling, publishing status,
  and published URLs. **Export** it, **generate an AI prompt** (copy into
  ChatGPT / Gemini / Claude / Grok — no paid AI API), and **import** pasted or
  uploaded JSON with full validation (invalid JSON, unsupported schema version,
  missing campaign/platform/metadata, invalid datetime, invalid platform/format,
  invalid asset reference — nothing is partially imported). Full schema
  documentation: [`docs/velgic-publishing-manifest.md`](docs/velgic-publishing-manifest.md).
- **Assets** — media is never embedded in JSON. Asset references
  (`asset_id`, `filename`, `type`, `reference`) are resolved behind a
  `StorageProvider` abstraction (local/reference in V2; Google Drive /
  Cloudflare R2 later). See `src/lib/storage.ts`.
- **No social-media APIs, no database, no auth** — V2 is fully local
  (Zustand + localStorage), with interfaces designed so external storage and
  publishing integrations can be added later.

## Recommendation engine

```
Opportunity Score = Audience Value + Novelty + Personal Relevance + Ease of Execution
```

Ideas marked **"Reusable across multiple formats"** get a `+4` bonus. The engine explains its reasoning, not just a number.

## AI integration

The app ships with a `MockAiProvider` (`src/lib/ai.ts`) so everything works offline. To connect a real model, implement the `AiProvider` interface and call `configureProvider(...)` once — no UI changes required. The V2 publishing workflow intentionally uses the **external AI prompt** approach instead: Velgic generates the prompt, you run it anywhere, and import the JSON.

## Run it

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
```

Data lives in `src/data/seed.ts` (realistic seeded examples: 8 ideas, 5 pipeline items, 5 published records, 4 experiments, 3 content pieces, 3 campaigns, 10 platform versions). Use **Reset demo data** in the sidebar to restore the seed.
