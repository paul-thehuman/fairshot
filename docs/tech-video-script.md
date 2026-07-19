# FairShot: tech video script

Target: 60 seconds (Hack-Nation's per-video cap). Screen recording of the public GitHub repo with your voice over it. Dry and factual: what the code does, no pitch framing.

## Before recording

1. Repo is public: github.com/paul-thehuman/fairshot
2. Have these paths open in tabs, in order, so you can click through live: repo root, src/lib/store.ts, src/lib/pipeline.ts, src/lib/scanners/, src/lib/dedupe.ts, src/lib/llm.ts (scrolled to gradeClaim), src/lib/interview/conduct.ts, src/lib/capability.ts, src/lib/memo.ts (scrolled to REQUIRED_GAPS), package.json.
3. Zoom in enough that code is readable on the recording.

## Script

**Repo root**

FairShot is a Next.js and TypeScript app.

**src/lib/store.ts**

Data is stored as JSON files, one collection per file, behind a single repository module.

**src/lib/pipeline.ts**

The pipeline has five stages: sourcing, screening, interview, diligence, decision.

**src/lib/scanners/**

Sourcing pulls from GitHub, Hacker News, and arXiv, plus a targeted lookup by GitHub handle.

**src/lib/dedupe.ts**

New founders are deduplicated by GitHub handle, website domain, or name.

**src/lib/llm.ts** (scroll to gradeClaim)

Every claim a founder makes goes through an evidence step: a web search, then an LLM grades it as corroborated, weak signal, or unverifiable.

The grader can only cite URLs that were actually returned by the search. Anything else is dropped before it's stored.

**src/lib/interview/conduct.ts**

The interview runs as a state machine: a planned set of questions, up to one follow-up each, a fixed turn limit.

After each answer, one claim is picked and checked the same way, live, mid-conversation.

**src/lib/capability.ts**

Four traits are scored per founder: ability, aspiration, learning agility, accountability. Each score cites the specific evidence it came from.

The founder score and the axis ratings are calculated in code from those graded inputs. The LLM doesn't assign the final number.

**src/lib/memo.ts** (scroll to REQUIRED_GAPS)

The memo is generated from stored data only, and a fixed list of required disclosures is appended in code regardless of what the model writes.

**package.json**

That's the stack: Next.js, a JSON store, three pluggable LLM providers, Tavily for search, ElevenLabs for voice.

## Cut list if over time

Cut the dedupe line first. Keep everything from llm.ts onward — that's the load-bearing "honesty enforced in code" material a technical judge is there to check.
