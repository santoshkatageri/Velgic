# Velgic

**Velgic — AI-powered Creator & Content Intelligence OS.** A local-first tool for a technical creator that takes you from **idea → experiment → content → publishing → learning**.

Built as a functional MVP (not a static mockup). Dark, professional, developer-grade UI.

## Stack

- **React 18 + TypeScript** (Vite)
- **React Router** (hash-based, no server rewrites needed)
- **Zustand** with `persist` — everything you edit is saved to `localStorage`
- **Plain CSS** design system (no UI framework) with CSS variables / design tokens

## What it does

- **Dashboard** — "What should I build next?" recommendation engine, content-pipeline summary, quick capture, and recent experiments.
- **Idea Inbox** — capture ideas with category, audience, format, effort, impact, status, and notes; score each idea 1–10 across *audience value*, *novelty*, *personal relevance*, and *ease of execution* for a computed opportunity score (0–40).
- **Content Pipeline** — a drag-and-drop Kanban board (Ideas → Research → Script → Production → Published).
- **Content Detail** — per-item sections (core idea, hook, audience problem, key insight, script, visual plan, production notes, publishing checklist, performance, lessons learned) plus one-click mock AI generation for hooks, short-form scripts, visual plans, LinkedIn posts, and Instagram captions.
- **Experiment Log** — hypothesis, what was built, tools, time spent, result, metrics, what worked/failed, key learning, and follow-up idea — framed as learning records, not vanity metrics.
- **Insights** — best topics, best formats, best hooks, average performance, experiments worth repeating, and underperforming topics (simple charts only).

## Recommendation engine

```
Opportunity Score = Audience Value + Novelty + Personal Relevance + Ease of Execution
```

Ideas marked **"Reusable across multiple formats"** get a `+4` bonus. The engine explains its reasoning, not just a number.

## AI integration

The app ships with a `MockAiProvider` (`src/lib/ai.ts`) so everything works offline. To connect a real model, implement the `AiProvider` interface and call `configureProvider(...)` once — no UI changes required.

## Run it

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
```

Data lives in `src/data/seed.ts` (realistic seeded examples: 8 ideas, 5 pipeline items, 5 published records, 4 experiments). Use **Reset demo data** in the sidebar to restore the seed.
