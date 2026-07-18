# VC Brain

Built for Hack-Nation's 6th Global AI Hackathon, Challenge 02 (Maschmeyer Group).

Karl's framing of the challenge: the best founders often go unfunded not
because the idea is weak, but because nobody with a checkbook knows their
name. VC Brain is a self-serve founder-scoring engine that substitutes
evidence for network access. A founder submits their own pitch and public
links, the same way you'd apply for a credit card online. No gatekeeper.

## How it works

1. **Claim extraction.** The pitch is parsed into 3-6 discrete, checkable
   claims (traction, technical, experience, team, market), not vague
   ambition statements.
2. **Evidence search.** Each claim is searched independently via the
   [Tavily](https://tavily.com) API, scoped to the founder's own public
   links where provided.
3. **Grading, not asserting.** Each claim is graded `corroborated`,
   `weak_signal`, or `unverifiable` against the actual search results.
   The model can only cite a source URL that was genuinely returned by the
   search, enforced server-side (`src/lib/llm.ts`), so it cannot invent a
   supporting source it never saw.
4. **The headline score is computed, not generated.** The founder score is
   a deterministic aggregation over the graded claims (`src/lib/scoring.ts`),
   not a separate number the model asserts. If you disagree with the score,
   you can see exactly which claim moved it.
5. **A fairness panel, on every result.** The scoring engine explicitly
   states what it does not use: school, network, age, gender, location, or
   prior VC/accelerator names. This directly answers the bias the challenge
   itself names, rather than assuming a scoring system is automatically fair.

## Stack

Next.js (App Router) + TypeScript + Tailwind. No database: this is a
stateless scoring engine, each request is self-contained.

The LLM layer (`src/lib/llm.ts`) is provider-agnostic: it uses whichever of
`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` is set, preferring OpenAI when both
are present, so the app's own runtime inference doesn't compete with the
Claude Code subscription used to build it.

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in your keys
npm run dev
```

Requires a [Tavily](https://tavily.com) API key and either an OpenAI or
Anthropic API key. See `.env.local.example`.

## What this is not

This is decision support, not a real investment commitment, and not
financial diligence. It grades what's checkable from public evidence in
seconds; it does not replace a term sheet, a background check, or a human
conversation. Absence of evidence for a claim is reported as
"unverifiable," not as a mark against the founder, most real, true things
about an early-stage founder are not yet indexed by a search engine.
