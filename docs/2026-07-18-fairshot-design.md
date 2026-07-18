# FairShot — design spec

Date: 18 July 2026. Status: approved by Paul. Event: Hack-Nation 6th Global AI Hackathon, Challenge 02 "The VC Brain" (Maschmeyer Group). Deadline: Sunday 19 July, 14:00 UK.

## One-liner

A venture capital operating system that finds overlooked founders, assesses them the way a world-class talent team would, and delivers an evidence-backed $100K decision within 24 hours.

## Positioning

Sourcing and diligence machinery comparable to commercial tools (Harmonic, Specter, Evertrace). The differentiator is a capability engine derived from HR high-potential assessment: evidence-based scoring of the person, designed to work for founders with no conventional track record. The system is two-way: every assessed founder receives feedback.

## Rubric mapping

| Criterion | Weight | FairShot answer |
|---|---|---|
| Data Architecture & Intelligence | 30% | Multi-channel sourcing, dedup and enrichment into Memory, explicit cold-start method (capability engine + Socratic interview) |
| Intelligent Analysis & Trust | 25% | Per-claim Trust Scores, evidence citations, confidence levels, contradictions flagged |
| Investment Utility & Execution | 30% | Actionable memo with recommendation vs thesis, 24h decision framing, funnel instrumentation |
| UX & Design | 15% | Investor dashboard, funnel view, profile cards, memo view |

## Components

1. **Thesis settings.** Investor-configurable: sectors, stage, geography, check size, ownership target, risk appetite. All downstream scoring filters through this lens. Not hardcoded.
2. **Sourcing.** Two doors, one funnel. Outbound: scanners over GitHub, Hacker News launches, and arXiv (live) plus hackathon winners and accelerator cohorts (synthetic); discoveries become profiles scored identically to applicants; crossing the conviction threshold triggers an invitation to the Socratic interview. Inbound: application with deck + company name minimum.
3. **Socratic interview.** The universal assessment gate for both doors. Every inbound applicant sits it (mandatory when public evidence is thin or absent); outbound-discovered founders who cross the conviction threshold are invited to it. The question plan adapts to the evidence already held, so interview time goes where evidence is thinnest. Probes the four capability traits with follow-up questions; the transcript is parsed into claims and fed to the evidence engine. Text chat is core scope; ElevenLabs conversational voice is a stretch upgrade pending credits.
4. **Memory.** SQLite. Founders, companies, signals, claims, evidence, scores. Everything timestamped and source-tagged; duplicates merged. Houses the Founder Score: persists across ventures and applications, never resets, strengthens with shipped milestones. Distinct from per-opportunity scores.
5. **Capability engine.** Four traits scored in v1: Ability, Aspiration, Learning agility, Accountability. Each trait: score + evidence citations + confidence level; "insufficient evidence" is a permitted output. Roadmap traits (documented, not built): Engagement, Strategic mindset, Informal influence. Framework grounded in high-potential talent assessment and convergent with entrepreneurship research (grit/determination, adaptability/openness, internal locus of control).
6. **Three-axis screening.** Founder (capability engine + Founder Score as one input), Market (sizing, competitors, bull/neutral/bear), Idea-vs-Market (survives scrutiny as-is, or team strong enough to pivot). Axes scored independently, never averaged, each with a trend direction.
7. **Investment memo.** Required sections: company snapshot, investment hypotheses, SWOT, problem & product, traction & KPIs. Per-claim Trust Score with click-through to exact evidence. Missing data flagged explicitly ("Cap table: not disclosed"), never fabricated. Recommendation stated against the active thesis.
8. **Natural-language query.** Compound plain-English queries ("technical founder, Berlin, AI infra, no prior VC backing") resolved over Memory in one pass.
9. **Founder feedback.** Every assessed founder receives a "what we saw" summary: strengths, where evidence was thin, what would strengthen a future application.

## Data strategy

Hybrid. Live: GitHub, Hacker News, arXiv, Tavily evidence search. Synthetic: founder profiles with seeded contradictions as a guaranteed demo bed. The cold-start founder is authored so the demo cannot fall flat.

## Stack

Next.js + TypeScript (existing scaffold kept; its claim-extraction → Tavily-grounding → honest-grading engine is reused as the Trust Score core). Memory: typed JSON file store behind a repository layer (build decision: zero native-dependency risk on Windows; production swap to a real database is isolated to one file). Runtime LLM calls: OpenAI (Gemini fallback), never the builder's Claude quota. Evidence: Tavily. Voice: ElevenLabs (stretch).

## Demo storyline (also the video script)

Founder A is discovered: GitHub signal → enriched profile → crosses the conviction threshold → invited to the Socratic interview → capability scores → memo → invest recommendation, every claim traceable. Founder B is invisible: no GitHub, no network; applies with a deck, sits the Socratic interview, capability becomes visible, memo marks unverifiable claims honestly. Around them: thesis filtering and one natural-language query moment.

## Build order and cut lines

1. Memory schema + thesis settings
2. Sourcing scanners + funnel (deepest investment)
3. Capability engine + Socratic interview
4. Screening + memo + Trust Scores
5. Dashboard polish
6. Sunday morning reserved: video, README, submission

Cut first if behind: outreach invitation copy, trend arrows, voice interview. Never cut: cold-start path, memo, per-claim traceability.

## Out of scope

Portfolio monitoring, follow-on strategy, fund ops, exit planning (brief non-goals). Sourcing-graph stretch goal only if ahead of schedule.
