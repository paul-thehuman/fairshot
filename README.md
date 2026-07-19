# FairShot

An AI venture capital operating system that finds overlooked founders, assesses them the way a world-class talent team would, and delivers an evidence-backed $100K decision within 24 hours.

Built solo in under 24 hours for Hack-Nation's 6th Global AI Hackathon (July 2026), Challenge 02 "The VC Brain" (Maschmeyer Group), by Paul Thomas of [The Human Co.](https://thehumanco.org), building with Claude Code.

## The problem

Capital flows through networks. A founder's story is scattered across repos, launches, papers and posts nobody reads closely, and diligence takes weeks. Founders who know the right people get seen; equally strong founders who don't, give up waiting. FairShot treats that as an infrastructure problem: make capability visible and checkable, so the decision runs on what someone has done, not who they know.

## The loop

Sourcing -> Screening -> Interview -> Diligence -> Decision. Two doors into one funnel:

- **Outbound**: scanners watch GitHub, Hacker News launches and arXiv (live), plus hackathon results and accelerator cohorts (synthetic channels). Discoveries become evidence profiles, deduplicated and screened against the fund's thesis. Crossing the conviction threshold triggers an interview invitation. Targeted sourcing is also supported: point FairShot at any GitHub handle and it profiles that person from their real footprint, including a follower/stars/forks summary, a 90-day public activity pulse from the events API, and author feeds (Medium, Substack, or a personal site's RSS), so founders who write arrive with their writing attached.
- **Inbound**: a founder applies with a company name and a pitch. Minimum bar, by design. Claims are extracted and graded against real web evidence immediately, and any Medium, Substack, or personal-site link is harvested for recent posts via RSS.

Both doors converge on the same universal gate: the **Socratic interview**.

## The capability engine (the differentiator)

FairShot's Founder axis is not vibes. It applies a high-potential assessment framework drawn from 20+ years of HR and talent practice, scoring four traits from evidence:

| Trait | What the system looks for | Convergent research |
|---|---|---|
| Ability | Quality of what they built and wrote; problem decomposition | Self-efficacy; execution over pedigree |
| Aspiration | Shipping cadence, persistence, building alongside commitments | Determination (Y Combinator); grit (Duckworth) |
| Learning agility | Visible skill acquisition, absorbing feedback, domain jumps that stuck | Adaptability, openness (founder personality studies) |
| Accountability | Follow-through: maintaining what they shipped, fixing what others report | Internal locus of control; "formidability" (Seibel) |

Each trait gets a score, a confidence level, a rationale, and citations into the exact evidence used. "Insufficient evidence" is a first-class answer. Externally corroborated evidence outweighs self-report; interview answers cap at medium confidence unless corroborated.

**The cold-start case is the point, not an afterthought.** A founder with no GitHub, no funding and no network still generates assessable evidence, because the interview is a behavioural instrument: adaptive questions anchored in whatever evidence exists, probing for specific past events the way a skilled human assessor would. The interview plans itself against the founder's evidence gaps, and every question stores the gap it targets.

**The interview does diligence while the founder speaks.** After each answer, FairShot picks the most checkable claim just made, searches the public web for it, grades it, and says what it found before asking the next question. The announcement is deterministic code, not model discretion, so it happens every time. A corroboration arrives with its source attached and visible to the founder ("Checked while you spoke"); a missing public record is stated neutrally, expected for internal work, and followed by the assessor's natural next move: who could confirm this? The conducting agent also carries the founder's full dossier into every turn, so acknowledgements and follow-ups connect answers to the evidence already held rather than only to the last message.

**The system is two-way.** Every assessed founder receives "What we saw": strengths, thin evidence, and concrete steps that would strengthen a future application. Guidance starts before assessment, not after: the apply page shows what checkable evidence looks like, and every invited founder gets a pre-interview brief naming the areas the interview will probe and the specific claims that could not be confirmed, so they can bring proof. Assessment that helps people succeed, not surveillance.

**Memory never forgets.** The Founder Score persists across ventures and applications, never resets, and strengthens with shipped milestones. It is one input into the Founder axis, not a substitute for per-opportunity assessment.

## Honesty, enforced in code

- The evidence grader can only cite source URLs it actually retrieved; fabricated citations are dropped server-side.
- The capability engine can only cite evidence ids that exist in Memory; invented references are filtered.
- Headline scores are deterministic aggregations computed in code, never numbers a model asserts.
- Investment memos must flag missing data explicitly ("Cap table: not disclosed"); the standard gaps are appended in code even if the model forgets.
- The three screening axes (Founder, Market, Idea-vs-Market) are scored independently and never averaged; each carries its own trend.
- "No prior VC backing" queries are negation-aware: a founder saying they have never raised money is counted for them, not against them.
- Web enrichment passes an identity gate: results about namesakes are excluded and the exclusion is logged. No verification means no enrichment.
- Mid-interview fact-checks are announced by deterministic code, never left to the model's discretion, and obey the same retrieved-URLs-only citation rule.
- Speed is instrumented: every status change is timestamped, and each decision records elapsed time from first signal.

## Assessment policy

Real people discovered outbound are prioritised for outreach, never capability-judged, until they choose to participate in an interview. Applying inbound is participation. Synthetic demo profiles are labelled "Synthetic" in the UI, carry no fabricated clickable links, and any name collision with a real person is coincidental. During this hackathon, decisions and memos are demonstrated on synthetic profiles, plus one real, consenting volunteer: the builder, who was sourced by his own system, interviewed by voice, and honestly rated WATCH.

## Rubric mapping

| Criterion | FairShot's answer |
|---|---|
| Data Architecture & Intelligence (30%) | Multi-channel live + synthetic sourcing, dedup on handle, domain and name, identity-gated enrichment, explicit cold-start method |
| Intelligent Analysis & Trust (25%) | Per-claim trust grades with retrieved sources, confidence levels, contradictions flagged before the investor sees them, and live mid-interview fact-checks shown to the founder in real time |
| Investment Utility & Execution (30%) | Actionable memo with a recommendation against a configurable thesis; signal-to-decision time measured; one-click decision |
| UX & Design (15%) | Investor dashboard, funnel board, plain-English querying, voice interview |

## Architecture

Next.js 16 (App Router) + TypeScript. Memory is a typed JSON file store behind one repository module (src/lib/store.ts); swapping to a real database touches one file. Runtime LLM calls run through a provider-agnostic layer (src/lib/llm.ts): OpenAI first, Gemini fallback, JSON mode, deliberately separate from the coding assistant used to build the product. Evidence search via Tavily. Voice via ElevenLabs text-to-speech plus browser speech recognition; the interview brain stays FairShot's own.

Key modules: scanners/ (sourcing channels), pipeline.ts (ingest, dedup, screen, threshold), sourceFounder.ts (targeted sourcing + identity gate), interview/ (planner + adaptive conduct), capability.ts (trait scoring), founderScore.ts (persistent score), screening.ts (three axes), memo.ts (evidence-backed memo), feedback.ts (founder-facing feedback).

## Run it

    npm install
    cp .env.local.example .env.local   # add TAVILY_API_KEY and OPENAI_API_KEY or GEMINI_API_KEY
    npm run dev
    curl -X POST localhost:3000/api/seed

Then visit the dashboard, run a scan from the Pipeline page, apply as the demo cold-start founder from /apply, or run the full scripted rehearsal: node scripts/rehearsal.mjs

## Research areas engaged

- **Confidence around soft-skill assessment**: every trait carries a confidence level bound to evidence quality, with self-report structurally capped and "insufficient" allowed. The 12 to 54 founder-score movement of the demo cold-start founder is the method demonstrated: the interview manufactures assessable evidence where none existed.
- **Public footprints and founder success**: the capability framework converges with the entrepreneurship literature (grit and determination, adaptability, internal locus of control), and the trait definitions map those constructs onto observable footprint behaviour.
- **Data quality vs volume**: the identity gate prefers empty enrichment over wrong enrichment, and logs what it excluded.

## Honest limits

- Trend arrows are v1 heuristics (score history and evidence recency), stated as such.
- The JSON store is a hackathon choice; the repository layer isolates the swap.
- Voice input uses the browser's built-in speech recognition (Chrome).
- LLM judgments vary between runs; the code-level guards constrain hallucination, they do not abolish variance.
- This is decision support, not financial diligence, and not a substitute for a term sheet or a human conversation.

## Credits

Hack-Nation partner credits: Tavily (evidence search), OpenAI (runtime reasoning), ElevenLabs (voice). Built with Claude Code.
