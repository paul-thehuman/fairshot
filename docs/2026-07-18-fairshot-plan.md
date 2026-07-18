# FairShot Implementation Plan

> Executes the approved spec at `docs/2026-07-18-fairshot-design.md`. Lean-format plan (hackathon, solo, ~9 build hours): exact files, interfaces and verification per phase, full code written at build time. Executed inline, phase by phase, commit per task. Deviation from spec, agreed rationale: JSON file store instead of SQLite (avoids native-module build risk on Windows; repository layer keeps the swap trivial).

**Goal:** Working FairShot MVP + demo data + video-ready storyline by Sunday 13:30 UK.

**Architecture:** Next.js 16 App Router app. All state in a typed JSON repository (`src/lib/store.ts`). Scanners normalise external sources into Signals; Signals and applications converge into one Opportunity funnel; the Socratic interview, capability engine and evidence engine produce graded claims; screening and memo layers read only from Memory. Runtime LLM via existing provider-agnostic `llm.ts` (add Gemini). Evidence via existing `tavily.ts` (reused unchanged).

**Env:** `TAVILY_API_KEY` (have), `OPENAI_API_KEY` (claim filed) or `GEMINI_API_KEY` (available) or `ANTHROPIC_API_KEY` (fallback only).

**Note before any code:** Next.js 16 has breaking changes vs training data. Check `node_modules/next/dist/docs/` for App Router route-handler and page conventions before writing each new file type (AGENTS.md requirement).

---

## Core data model (defined once, used everywhere)

```ts
// People persist; ventures come and go. This split is what makes the Founder Score durable.
type Founder = { id: string; name: string; handles: { github?: string; linkedin?: string; website?: string; hn?: string }; origin: 'inbound' | 'outbound'; createdAt: string };
type Venture = { id: string; founderId: string; name: string; oneLiner: string; sector: string; geography: string; stage: string; createdAt: string };
type OppStatus = 'sourced' | 'screened' | 'interview' | 'diligence' | 'decision';
type Opportunity = { id: string; ventureId: string; founderId: string; status: OppStatus; decision?: 'invest' | 'pass' | 'watch'; statusHistory: { status: OppStatus; at: string }[]; convictionScore?: number; createdAt: string };
type SignalSource = 'github' | 'hackernews' | 'arxiv' | 'hackathon' | 'accelerator' | 'application' | 'interview';
type Signal = { id: string; founderId?: string; source: SignalSource; url?: string; title: string; content: string; observedAt: string; ingestedAt: string };
// Claim/GradedClaim/EvidenceSource: extend existing types.ts with { opportunityId, founderId, origin: 'pitch' | 'interview' | 'signal' }
type Trait = 'ability' | 'aspiration' | 'learning_agility' | 'accountability';
type TraitScore = { founderId: string; opportunityId: string; trait: Trait; score: number | null; confidence: 'high' | 'medium' | 'low' | 'insufficient'; rationale: string; evidenceClaimIds: string[] };
type FounderScore = { founderId: string; score: number; history: { score: number; at: string; reason: string }[] }; // append-only, never resets
type Axis = 'founder' | 'market' | 'idea_market';
type AxisScore = { opportunityId: string; axis: Axis; rating: string; trend: 'improving' | 'stable' | 'declining'; rationale: string; evidenceRefs: string[] };
type Thesis = { sectors: string[]; stages: string[]; geographies: string[]; checkSizeUsd: number; ownershipTargetPct: number; riskAppetite: 'conservative' | 'balanced' | 'aggressive' };
type Interview = { id: string; opportunityId: string; plannedQuestions: { trait: Trait; question: string; why: string }[]; turns: { role: 'agent' | 'founder'; text: string; at: string }[]; status: 'invited' | 'in_progress' | 'complete'; extractedClaimIds: string[] };
type Memo = { opportunityId: string; snapshot: string; hypotheses: string[]; swot: { s: string[]; w: string[]; o: string[]; t: string[] }; problemProduct: string; tractionKpis: string; gaps: string[]; claims: GradedClaim[]; recommendation: { verdict: 'invest' | 'pass' | 'watch'; thesisFit: string; rationale: string }; generatedAt: string };
```

## Phase 0 — Foundations (≈30 min, tonight)

- [ ] Read Next 16 route-handler + page docs from `node_modules/next/dist/docs/`
- [ ] `src/lib/store.ts`: JSON repository. One file per collection under `data/` (gitignored except seeds). API: `getAll<T>(collection)`, `get<T>(collection, id)`, `upsert<T>(collection, item)`, `patch`, atomic write (tmp+rename). Collections: founders, ventures, opportunities, signals, claims, traitScores, founderScores, axisScores, theses, interviews, memos, events.
- [ ] `src/lib/types.ts`: extend with model above (keep existing Claim/Grade types compatible)
- [ ] `src/lib/llm.ts`: add `gemini` provider (REST fetch to generativelanguage.googleapis.com, `GEMINI_MODEL` default `gemini-2.5-flash`); export `completeJSON(system, user)` generic helper; provider order openai → gemini → anthropic
- [ ] `.env.local.example`: add GEMINI_API_KEY, thresholds
- [ ] Verify: `npm run build` passes. Commit: `feat: memory store, data model, gemini provider`

## Phase 1 — Thesis + synthetic universe (≈45 min)

- [ ] `src/lib/thesis.ts`: default thesis (AI/dev-tools, pre-seed, Europe+US, $100K, 7%, balanced) + `loadThesis()/saveThesis()`
- [ ] `src/app/settings/page.tsx` + `src/app/api/thesis/route.ts`: view/edit thesis form
- [ ] `src/lib/seed/universe.ts` + `src/app/api/seed/route.ts`: 14 synthetic founders — mix of origins; 2 with seeded contradictions (e.g. claimed ARR contradicted by a planted signal); Founder B (cold-start: no handles, no signals, strong story); Founder A stub is NOT seeded (comes in live via GitHub scan)
- [ ] `src/lib/dedupe.ts`: `findOrCreateFounder({name, handles})` — match priority github handle > website domain > normalised name; merge handles on match, log `events` entry
- [ ] Verify: seed via curl, inspect `data/founders.json`. Commit: `feat: thesis engine + synthetic founder universe`

## Phase 2 — Sourcing engine (≈2h, deepest investment)

- [ ] `src/lib/scanners/types.ts`: `Scanner = { source: SignalSource; scan(thesis: Thesis): Promise<RawDiscovery[]> }`; `RawDiscovery = { name, handles, title, content, url, observedAt, ventureHint? }`
- [ ] `src/lib/scanners/github.ts`: GitHub Search API (no auth, cache 10 min in store to respect 10 req/min): repos matching thesis sector topics pushed in last 14 days, min 3 stars; owner → discovery. Also fetch owner profile for enrichment
- [ ] `src/lib/scanners/hackernews.ts`: Algolia HN API, Show HN posts matching thesis keywords, last 30 days
- [ ] `src/lib/scanners/arxiv.ts`: arXiv Atom API, cs.AI/cs.SE recent papers matching sector keywords, authors → discoveries (cut first if Phase 2 overruns)
- [ ] `src/lib/scanners/synthetic.ts`: hackathon winners + accelerator cohorts from seed data, same interface — demonstrates channel breadth safely
- [ ] `src/lib/pipeline.ts`: `runScan()` — all scanners → dedupe → Signal + Founder + Venture + Opportunity(sourced) → prescreen batch (one `completeJSON` call: thesis relevance + conviction 0-100 per discovery) → status 'screened', store convictionScore; threshold crossers (≥70) → create Interview(status 'invited') + event. Every status change appends statusHistory (this is the speed instrumentation)
- [ ] `src/app/api/scan/route.ts` + funnel board `src/app/pipeline/page.tsx`: columns Sourced/Screened/Interview/Diligence/Decision, cards show source badge + conviction + founder; "Run scan" button; invite banner for threshold crossers
- [ ] Verify in browser: run scan, live GitHub founders appear, threshold crossing creates invite. Commit per scanner + `feat: sourcing pipeline and funnel board`

## Phase 3 — Socratic interview + capability engine (≈2h)

- [ ] `src/lib/interview/planner.ts`: `planInterview(founderId, opportunityId)` — gathers existing claims/evidence/signals, one `completeJSON` call returns 5-6 questions targeted at the thinnest traits (each: trait, question, why — the 'why' powers traceability). Cold-start founders get the full four-trait spread
- [ ] `src/lib/interview/conduct.ts`: `nextTurn(interviewId, founderAnswer)` — adaptive: one follow-up max per planned question (cap 10 agent turns), then closes; extraction on close: transcript → claims (origin 'interview', reuse extraction prompt with behavioural-evidence tuning) → grade via existing evidence engine where claims are externally checkable; interview-only claims marked confidence-from-consistency
- [ ] `src/app/interview/[id]/page.tsx` + `src/app/api/interview/[id]/route.ts`: chat UI (founder-facing, warm tone), works for both doors (application flow lands here; invited outbound founders open the same page)
- [ ] `src/app/apply/page.tsx` + `src/app/api/apply/route.ts`: deck text/paste + company name minimum → creates Founder(origin inbound) + Opportunity → claims from pitch → straight into interview
- [ ] `src/lib/capability.ts`: `assessFounder(founderId, opportunityId)` — per trait: score 0-100 or null + confidence + rationale + evidenceClaimIds, from graded claims + signals; 'insufficient' is a first-class outcome; one `completeJSON` call, validated server-side (cited claim ids must exist — same guard pattern as llm.ts sources)
- [ ] `src/lib/founderScore.ts`: `updateFounderScore(founderId, reason)` — deterministic aggregation (code, not LLM): trait scores weighted by confidence + evidence-base pct from computeScore; appends history, never resets
- [ ] `src/lib/feedback.ts`: `founderFeedback(founderId, opportunityId)` — "what we saw": strengths, thin-evidence areas, what would strengthen a future application; shown post-interview + stored
- [ ] Verify: full cold-start journey in browser as Founder B. Commit: `feat: socratic interview, capability engine, founder score, feedback`

**Sleep gate ≈ 02:00.** Phases 0-3 tonight = every novel-risk component built and testable. Sunday is assembly.

## Phase 4 — Screening + memo (Sun ≈07:30-09:00)

- [ ] `src/lib/screening.ts`: `scoreAxes(opportunityId)` — Founder axis (capability + FounderScore as one input, per spec); Market axis (one Tavily market search + bull/neutral/bear); Idea-vs-Market (survives as-is vs team-can-pivot). Independent calls, never averaged; trend v1 = evidence recency heuristic (documented as such)
- [ ] `src/lib/memo.ts`: `generateMemo(opportunityId)` — 5 required sections from Memory only; gaps array ("Cap table: not disclosed") explicitly rendered; recommendation vs active thesis; per-claim trust = existing grades
- [ ] `src/app/memo/[opportunityId]/page.tsx`: memo view; every claim expandable → grade, reasoning, source links (agentic traceability); axis panel with trends; decision buttons (invest/pass/watch) → status 'decision' + timestamp (completes time-to-decision metric)
- [ ] Verify: memo for one synthetic contradiction founder shows the contradiction flagged. Commit: `feat: three-axis screening and evidence-backed memo`

## Phase 5 — NL query + dashboard (≈09:00-10:00)

- [ ] `src/app/api/query/route.ts`: NL → `completeJSON` → filter object `{sectors?, geography?, traits?, minFounderScore?, source?, status?, noPriorBacking?}` → store filter in code; returns founders + why-matched
- [ ] `src/app/page.tsx` (rework home): dashboard — query bar, funnel stats, newest signals, threshold crossings, median signal→decision time
- [ ] Verify: compound demo query resolves in one pass. Commit: `feat: natural-language query + investor dashboard`

## Phase 6 — Demo integrity (≈10:00-11:00)

- [ ] Full run-through of both journeys (Founder A live-discovered; Founder B cold-start) + contradiction moment + NL query + thesis edit re-scoring
- [ ] Fix what breaks; `npm run build` clean
- [ ] Stretch, only if green: ElevenLabs voice on interview page (Conversational AI widget, agent prompt = planner output); validator agent pass over one memo

## Phase 7 — Submission (≈11:00-13:30, protected)

- [ ] README rewrite: architecture diagram, rubric mapping, capability framework + research-area write-up (confidence method for soft skills; public-footprint question), honest limits section
- [ ] Push repo to GitHub (public), verify clone-and-run instructions
- [ ] Video: script from demo storyline (I draft, Paul records); submit by 13:30 for 30 min buffer

## Cut lines (pre-agreed)

Behind in P2: drop arXiv scanner. Behind in P3: fixed question set, no adaptive follow-ups. Behind in P5: dashboard stats become static funnel counts. Never cut: cold-start path, memo with per-claim trust, traceability click-through.
