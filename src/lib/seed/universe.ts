import { logEvent, replaceAll } from "../store";
import type {
  AxisScore,
  Founder,
  FounderScoreRecord,
  Interview,
  Opportunity,
  OppStatus,
  Signal,
  StoredClaim,
  TraitScore,
  Venture,
} from "../types";
import { DEFAULT_THESIS } from "../thesis";

// Authored synthetic universe: deterministic demo bed per the data strategy.
// Deliberate structure, not filler:
// - Marcus and Viktor carry seeded contradictions the evidence engine must surface
// - Priya arrived through two sourcing channels (hackathon + accelerator), so her
//   profile shows a dedup merge, and her Founder Score has real history
// - Sara is strong but off-thesis, showing the thesis filter saying no honestly
// - Kenji sits just under the conviction threshold, a near-miss the investor can watch
// - Lena has crossed the threshold and holds an open interview invitation

const D = (s: string) => `2026-${s}:00Z`;

const founders: Founder[] = [
  { id: "f-lena", name: "Lena Vogel", origin: "outbound", handles: { github: "lenavogel", website: "cachette.dev" }, bio: "Ex-database engineer, Berlin. Building Cachette, a drop-in semantic cache for LLM apps.", createdAt: D("07-10T08:15") },
  { id: "f-tomas", name: "Tomás Rivera", origin: "outbound", handles: { github: "tomasrivera" }, bio: "Won ETH Lisbon '26 with TraceKit, a time-travel debugger for AI agents.", createdAt: D("07-06T14:00") },
  { id: "f-priya", name: "Priya Nair", origin: "outbound", handles: { github: "priyanair", website: "relayhealth.io", linkedin: "priya-nair" }, bio: "Former NHS data analyst. Relay Health drafts discharge summaries from ward notes.", createdAt: D("06-24T10:30") },
  { id: "f-marcus", name: "Marcus Webb", origin: "inbound", handles: { website: "quotaflow.app", linkedin: "marcuswebb" }, bio: "Second-time founder. QuotaFlow forecasts sales pipeline slippage.", createdAt: D("07-02T09:00") },
  { id: "f-aisha", name: "Aisha Bello", origin: "outbound", handles: {}, bio: "PhD candidate, first author on an arXiv paper on low-rank fine-tuning for edge devices.", createdAt: D("07-15T11:20") },
  { id: "f-jonas", name: "Jonas Keller", origin: "outbound", handles: { github: "jonaskeller", hn: "jkeller" }, bio: "Show HN: local-first sync engine for offline field apps.", createdAt: D("07-14T19:45") },
  { id: "f-sara", name: "Sara Lindqvist", origin: "outbound", handles: { linkedin: "sara-lindqvist" }, bio: "Antler Stockholm cohort. Grid-scale battery maintenance prediction.", createdAt: D("07-08T09:30") },
  { id: "f-david", name: "David Okoye", origin: "outbound", handles: { github: "davidokoye" }, bio: "Building a CLI that turns failing CI logs into ranked fix suggestions.", createdAt: D("07-11T16:10") },
  { id: "f-ines", name: "Inês Costa", origin: "outbound", handles: { website: "clausewise.pt" }, bio: "Won Lisbon LegalTech hack. Clausewise redlines NDAs against playbooks.", createdAt: D("07-05T12:00") },
  { id: "f-viktor", name: "Viktor Hansen", origin: "inbound", handles: { website: "parcelmind.dk" }, bio: "ParcelMind reroutes last-mile delivery around live traffic and failed-drop risk.", createdAt: D("07-09T08:40") },
  { id: "f-ruth", name: "Ruth Adler", origin: "outbound", handles: { github: "ruthadler" }, bio: "Techstars London '26. Observability for fine-tuned model drift.", createdAt: D("07-16T10:00") },
  { id: "f-kenji", name: "Kenji Sato", origin: "outbound", handles: { github: "kenjisato", website: "kenjisato.dev" }, bio: "arXiv author and GitHub maintainer, structured-output constraint library.", createdAt: D("07-07T13:30") },
];

const ventures: Venture[] = [
  { id: "v-lena", founderId: "f-lena", name: "Cachette", oneLiner: "Drop-in semantic cache that cuts LLM API spend 40-70%", sector: "AI infrastructure", geography: "Europe", stage: "pre-seed", createdAt: D("07-10T08:15") },
  { id: "v-tomas", founderId: "f-tomas", name: "TraceKit", oneLiner: "Time-travel debugger for AI agent runs", sector: "developer tools", geography: "Europe", stage: "pre-seed", createdAt: D("07-06T14:00") },
  { id: "v-priya", founderId: "f-priya", name: "Relay Health", oneLiner: "Drafts hospital discharge summaries from ward notes, clinician-reviewed", sector: "applied AI", geography: "Europe", stage: "pre-seed", createdAt: D("06-24T10:30") },
  { id: "v-marcus", founderId: "f-marcus", name: "QuotaFlow", oneLiner: "Predicts which pipeline deals will slip this quarter", sector: "applied AI", geography: "North America", stage: "pre-seed", createdAt: D("07-02T09:00") },
  { id: "v-aisha", founderId: "f-aisha", name: "Edgeworth Labs", oneLiner: "Low-rank fine-tuning toolkit for on-device models", sector: "AI infrastructure", geography: "Europe", stage: "pre-seed", createdAt: D("07-15T11:20") },
  { id: "v-jonas", founderId: "f-jonas", name: "Fieldsync", oneLiner: "Local-first sync engine for offline field workflows", sector: "developer tools", geography: "Europe", stage: "pre-seed", createdAt: D("07-14T19:45") },
  { id: "v-sara", founderId: "f-sara", name: "Voltwatch", oneLiner: "Predictive maintenance for grid-scale batteries", sector: "climate hardware", geography: "Europe", stage: "pre-seed", createdAt: D("07-08T09:30") },
  { id: "v-david", founderId: "f-david", name: "Fixline", oneLiner: "Turns failing CI logs into ranked fix suggestions", sector: "developer tools", geography: "Europe", stage: "pre-seed", createdAt: D("07-11T16:10") },
  { id: "v-ines", founderId: "f-ines", name: "Clausewise", oneLiner: "Redlines NDAs against a firm's own playbook in minutes", sector: "applied AI", geography: "Europe", stage: "pre-seed", createdAt: D("07-05T12:00") },
  { id: "v-viktor", founderId: "f-viktor", name: "ParcelMind", oneLiner: "Reroutes last-mile delivery around failed-drop risk", sector: "applied AI", geography: "Europe", stage: "pre-seed", createdAt: D("07-09T08:40") },
  { id: "v-ruth", founderId: "f-ruth", name: "Driftboard", oneLiner: "Catches fine-tuned model drift before users do", sector: "AI infrastructure", geography: "Europe", stage: "pre-seed", createdAt: D("07-16T10:00") },
  { id: "v-kenji", founderId: "f-kenji", name: "Schemata", oneLiner: "Constraint library guaranteeing valid structured model output", sector: "developer tools", geography: "North America", stage: "pre-seed", createdAt: D("07-07T13:30") },
];

function opp(
  id: string,
  ventureId: string,
  founderId: string,
  history: [OppStatus, string][],
  convictionScore?: number,
  convictionRationale?: string
): Opportunity {
  return {
    id,
    ventureId,
    founderId,
    status: history[history.length - 1][0],
    convictionScore,
    convictionRationale,
    statusHistory: history.map(([status, at]) => ({ status, at })),
    createdAt: history[0][1],
  };
}

const opportunities: Opportunity[] = [
  opp("o-lena", "v-lena", "f-lena", [["sourced", D("07-10T08:15")], ["screened", D("07-10T08:40")], ["interview", D("07-16T09:00")]], 78, "Strong thesis fit (AI infra, Europe); shipping cadence and adoption signals both rising"),
  opp("o-tomas", "v-tomas", "f-tomas", [["sourced", D("07-06T14:00")], ["screened", D("07-06T14:25")]], 64, "Hackathon win is a strong ability signal; no adoption evidence yet"),
  opp("o-priya", "v-priya", "f-priya", [["sourced", D("06-24T10:30")], ["screened", D("06-24T11:00")], ["interview", D("06-30T09:00")], ["diligence", D("07-04T15:30")]], 82, "Two independent sourcing channels; pilot traction inside target sector"),
  opp("o-marcus", "v-marcus", "f-marcus", [["sourced", D("07-02T09:00")], ["screened", D("07-02T09:20")], ["interview", D("07-08T10:00")], ["diligence", D("07-12T11:00")]], 71, "Experienced founder, credible wedge; revenue claims need verification"),
  opp("o-aisha", "v-aisha", "f-aisha", [["sourced", D("07-15T11:20")]], undefined, undefined),
  opp("o-jonas", "v-jonas", "f-jonas", [["sourced", D("07-14T19:45")]], undefined, undefined),
  opp("o-sara", "v-sara", "f-sara", [["sourced", D("07-08T09:30")], ["screened", D("07-08T09:55")]], 35, "Capable founder but climate hardware is outside the active thesis sectors"),
  opp("o-david", "v-david", "f-david", [["sourced", D("07-11T16:10")], ["screened", D("07-11T16:30")]], 58, "Useful wedge in a crowded space; differentiation unclear"),
  opp("o-ines", "v-ines", "f-ines", [["sourced", D("07-05T12:00")], ["screened", D("07-05T12:20")]], 66, "Clear buyer and demo; market size for single-workflow legal tools uncertain"),
  opp("o-viktor", "v-viktor", "f-viktor", [["sourced", D("07-09T08:40")], ["screened", D("07-09T09:00")]], 61, "Live pilot claimed; team composition needs verification"),
  opp("o-ruth", "v-ruth", "f-ruth", [["sourced", D("07-16T10:00")]], undefined, undefined),
  opp("o-kenji", "v-kenji", "f-kenji", [["sourced", D("07-07T13:30")], ["screened", D("07-07T13:50")]], 69, "One point under threshold: strong library adoption, founder intent to commercialise unconfirmed"),
];

const signals: Signal[] = [
  { id: "s-lena-1", founderId: "f-lena", source: "github", url: "https://github.com/lenavogel/cachette", title: "cachette — semantic cache for LLM calls", content: "1.9k stars, 41 commits in the last 30 days, v0.4 released with Redis backend. Issues answered same-day by the maintainer.", observedAt: D("07-10T08:00"), ingestedAt: D("07-10T08:15") },
  { id: "s-lena-2", founderId: "f-lena", source: "hackernews", url: "https://news.ycombinator.com/item?id=100000001", title: "Show HN: Cachette — cut your LLM bill with a semantic cache", content: "214 points, 87 comments. Author answered objections about cache invalidation with benchmarks.", observedAt: D("07-12T17:30"), ingestedAt: D("07-12T18:00") },
  { id: "s-tomas-1", founderId: "f-tomas", source: "hackathon", title: "ETH Lisbon 2026 — Grand Prize: TraceKit", content: "Won grand prize from 220 teams with a time-travel debugger for agent runs. Judges cited unusually complete execution for 36 hours.", observedAt: D("07-05T22:00"), ingestedAt: D("07-06T14:00") },
  { id: "s-priya-1", founderId: "f-priya", source: "hackathon", title: "NHS Hack Week 2026 — Winner: Relay Health", content: "Won with discharge-summary drafting tool. Built with two junior doctors; team continued after the event.", observedAt: D("06-20T18:00"), ingestedAt: D("06-24T10:30") },
  { id: "s-priya-2", founderId: "f-priya", source: "accelerator", title: "Techstars London 2026 cohort list", content: "Relay Health listed in the summer 2026 cohort. Company describes 2 hospital pilots underway.", observedAt: D("06-28T09:00"), ingestedAt: D("06-28T09:30") },
  { id: "s-priya-3", founderId: "f-priya", source: "github", url: "https://github.com/priyanair/relay-notes", title: "relay-notes — ward note parser", content: "Steady commit history over 8 months including 5 months while employed full-time. Two external contributors.", observedAt: D("07-01T12:00"), ingestedAt: D("07-01T12:30") },
  { id: "s-marcus-1", founderId: "f-marcus", source: "application", title: "Inbound application — QuotaFlow", content: "Applied with deck. Claims $40K MRR, 12 paying customers, and a 3-person engineering team.", observedAt: D("07-02T09:00"), ingestedAt: D("07-02T09:00") },
  { id: "s-marcus-2", founderId: "f-marcus", source: "hackernews", url: "https://news.ycombinator.com/item?id=100000002", title: "Podcast: RevOps Weekly, June 2026 episode notes", content: "In a June 2026 podcast appearance Marcus described QuotaFlow as pre-revenue and design-partner stage. Contradicts the July application's $40K MRR claim.", observedAt: D("06-15T08:00"), ingestedAt: D("07-03T10:00") },
  { id: "s-aisha-1", founderId: "f-aisha", source: "arxiv", url: "https://arxiv.org/abs/2607.01234", title: "Sub-1B parameter adaptation for edge inference", content: "First-author paper, 40 citations in 6 weeks. Reference implementation released.", observedAt: D("07-14T09:00"), ingestedAt: D("07-15T11:20") },
  { id: "s-jonas-1", founderId: "f-jonas", source: "hackernews", url: "https://news.ycombinator.com/item?id=100000003", title: "Show HN: Fieldsync — local-first sync for offline field apps", content: "156 points. Several commenters from utilities and agriculture asked for pilot access.", observedAt: D("07-14T16:00"), ingestedAt: D("07-14T19:45") },
  { id: "s-sara-1", founderId: "f-sara", source: "accelerator", title: "Antler Stockholm residency list", content: "Voltwatch in current residency. Two grid operators in conversation.", observedAt: D("07-07T10:00"), ingestedAt: D("07-08T09:30") },
  { id: "s-david-1", founderId: "f-david", source: "github", url: "https://github.com/davidokoye/fixline", title: "fixline — CI failure triage", content: "430 stars, weekly releases for 9 weeks straight.", observedAt: D("07-11T15:00"), ingestedAt: D("07-11T16:10") },
  { id: "s-ines-1", founderId: "f-ines", source: "hackathon", title: "Lisbon LegalTech Hack — Winner: Clausewise", content: "Won with playbook-driven NDA redlining. Two law firms requested follow-up demos during judging.", observedAt: D("07-04T20:00"), ingestedAt: D("07-05T12:00") },
  { id: "s-viktor-1", founderId: "f-viktor", source: "application", title: "Inbound application — ParcelMind", content: "Applied with deck. Claims a live pilot with a Danish courier and a team of five.", observedAt: D("07-09T08:40"), ingestedAt: D("07-09T08:40") },
  { id: "s-viktor-2", founderId: "f-viktor", source: "accelerator", title: "Copenhagen Founders Fair profile", content: "June 2026 profile lists ParcelMind as a solo-founder project seeking a technical co-founder. Contradicts the application's team-of-five claim.", observedAt: D("06-18T09:00"), ingestedAt: D("07-10T09:00") },
  { id: "s-ruth-1", founderId: "f-ruth", source: "accelerator", title: "Techstars London 2026 cohort list", content: "Driftboard listed in the summer 2026 cohort, demo day scheduled September.", observedAt: D("07-15T09:00"), ingestedAt: D("07-16T10:00") },
  { id: "s-kenji-1", founderId: "f-kenji", source: "arxiv", url: "https://arxiv.org/abs/2606.05678", title: "Grammar-constrained decoding at scale", content: "Second-author paper underpinning the Schemata library.", observedAt: D("06-30T09:00"), ingestedAt: D("07-07T13:30") },
  { id: "s-kenji-2", founderId: "f-kenji", source: "github", url: "https://github.com/kenjisato/schemata", title: "schemata — structured output constraints", content: "2.7k stars, used by three notable open-source agent frameworks. Maintainer active but has not signalled commercial intent.", observedAt: D("07-06T12:00"), ingestedAt: D("07-07T13:30") },
];

const claims: StoredClaim[] = [
  { id: "c-priya-1", opportunityId: "o-priya", founderId: "f-priya", origin: "pitch", category: "traction", text: "Relay Health has two NHS hospital pilots underway", grade: "corroborated", reasoning: "Techstars cohort listing independently describes two hospital pilots.", sources: [{ url: "https://www.techstars.com/accelerators/london", title: "Techstars London 2026 cohort" }] },
  { id: "c-priya-2", opportunityId: "o-priya", founderId: "f-priya", origin: "pitch", category: "technical", text: "Working parser handles unstructured ward notes across two hospital IT systems", grade: "weak_signal", reasoning: "Public repo shows sustained development and external contributors; cross-system claim not independently verified.", sources: [{ url: "https://github.com/priyanair/relay-notes", title: "relay-notes repository" }] },
  { id: "c-priya-3", opportunityId: "o-priya", founderId: "f-priya", origin: "interview", category: "experience", text: "Built and maintained the tool for five months while employed full-time as an NHS data analyst", grade: "corroborated", reasoning: "Commit history timeline matches stated employment period.", sources: [{ url: "https://github.com/priyanair/relay-notes", title: "relay-notes commit history" }] },
  { id: "c-marcus-1", opportunityId: "o-marcus", founderId: "f-marcus", origin: "pitch", category: "traction", text: "QuotaFlow is at $40K MRR with 12 paying customers", grade: "weak_signal", reasoning: "No independent corroboration found, and a June 2026 podcast appearance described the company as pre-revenue. Contradiction flagged for the memo.", sources: [] },
  { id: "c-marcus-2", opportunityId: "o-marcus", founderId: "f-marcus", origin: "pitch", category: "team", text: "Three-person engineering team", grade: "unverifiable", reasoning: "No public evidence of additional engineers; no contradiction either.", sources: [] },
  { id: "c-marcus-3", opportunityId: "o-marcus", founderId: "f-marcus", origin: "pitch", category: "experience", text: "Previously founded and sold a sales-analytics tool", grade: "corroborated", reasoning: "Acquisition covered in trade press in 2023.", sources: [{ url: "https://example-trade-press.com/quotawise-acquired", title: "QuotaWise acquired (2023)" }] },
  { id: "c-viktor-1", opportunityId: "o-viktor", founderId: "f-viktor", origin: "pitch", category: "team", text: "Team of five including two ML engineers", grade: "weak_signal", reasoning: "A June 2026 founders-fair profile lists ParcelMind as a solo-founder project seeking a technical co-founder. Contradiction flagged for the memo.", sources: [] },
  { id: "c-viktor-2", opportunityId: "o-viktor", founderId: "f-viktor", origin: "pitch", category: "traction", text: "Live pilot with a Danish courier network", grade: "unverifiable", reasoning: "No public evidence found either way; absence of evidence, not evidence of falsehood.", sources: [] },
];

const traitScores: TraitScore[] = [
  { id: "t-priya-ability", founderId: "f-priya", opportunityId: "o-priya", trait: "ability", score: 82, confidence: "high", rationale: "Working parser across messy real-world data; hackathon win judged on execution; clean problem decomposition in the deck.", evidenceClaimIds: ["c-priya-2", "c-priya-1"], assessedAt: D("07-04T16:00") },
  { id: "t-priya-aspiration", founderId: "f-priya", opportunityId: "o-priya", trait: "aspiration", score: 84, confidence: "high", rationale: "Five months of nights-and-weekends shipping while employed full-time; kept the team together after the hackathon.", evidenceClaimIds: ["c-priya-3"], assessedAt: D("07-04T16:00") },
  { id: "t-priya-learning", founderId: "f-priya", opportunityId: "o-priya", trait: "learning_agility", score: 74, confidence: "medium", rationale: "Analyst to founder-engineer transition visible in repo history; limited evidence of absorbing commercial feedback yet.", evidenceClaimIds: ["c-priya-3"], assessedAt: D("07-04T16:00") },
  { id: "t-priya-accountability", founderId: "f-priya", opportunityId: "o-priya", trait: "accountability", score: 79, confidence: "medium", rationale: "Maintains the tool for hospital users beyond her formal role; responsive to contributor issues.", evidenceClaimIds: ["c-priya-3", "c-priya-2"], assessedAt: D("07-04T16:00") },
];

const axisScores: AxisScore[] = [
  { id: "a-priya-founder", opportunityId: "o-priya", axis: "founder", rating: "80 — strong", trend: "improving", rationale: "Four capability traits scored on high or medium confidence evidence; founder score rising across milestones.", evidenceRefs: ["t-priya-ability", "t-priya-aspiration", "t-priya-learning", "t-priya-accountability"], assessedAt: D("07-04T17:00") },
  { id: "a-priya-market", opportunityId: "o-priya", axis: "market", rating: "neutral", trend: "stable", rationale: "Clear pain and buyer, but NHS procurement cycles are slow and pilots convert unevenly.", evidenceRefs: ["s-priya-2"], assessedAt: D("07-04T17:00") },
  { id: "a-priya-idea", opportunityId: "o-priya", axis: "idea_market", rating: "survives scrutiny", trend: "improving", rationale: "Wedge survives as-is; even if discharge summaries commoditise, the ward-notes parsing layer generalises and the team has shown it can pivot.", evidenceRefs: ["c-priya-2"], assessedAt: D("07-04T17:00") },
];

const founderScores: FounderScoreRecord[] = [
  { id: "f-lena", founderId: "f-lena", score: 72, history: [{ score: 72, at: D("07-12T18:00"), reason: "Initial assessment from GitHub and Show HN signals" }] },
  { id: "f-tomas", founderId: "f-tomas", score: 61, history: [{ score: 61, at: D("07-06T14:30"), reason: "Initial assessment from hackathon win" }] },
  { id: "f-priya", founderId: "f-priya", score: 80, history: [{ score: 64, at: D("06-24T11:00"), reason: "Initial assessment from hackathon win" }, { score: 73, at: D("06-28T10:00"), reason: "Accelerator acceptance and pilot evidence merged from second sourcing channel" }, { score: 80, at: D("07-04T17:00"), reason: "Capability interview completed; four traits scored on verified evidence" }] },
  { id: "f-marcus", founderId: "f-marcus", score: 66, history: [{ score: 71, at: D("07-02T10:00"), reason: "Initial assessment; prior exit corroborated" }, { score: 66, at: D("07-12T11:30"), reason: "Revenue claim contradicted by June podcast; trust-weighted adjustment" }] },
  { id: "f-aisha", founderId: "f-aisha", score: 58, history: [{ score: 58, at: D("07-15T12:00"), reason: "Initial assessment from research signal" }] },
  { id: "f-jonas", founderId: "f-jonas", score: 57, history: [{ score: 57, at: D("07-14T20:00"), reason: "Initial assessment from Show HN reception" }] },
  { id: "f-sara", founderId: "f-sara", score: 63, history: [{ score: 63, at: D("07-08T10:00"), reason: "Initial assessment; strong operator signals, off-thesis venture" }] },
  { id: "f-david", founderId: "f-david", score: 55, history: [{ score: 55, at: D("07-11T16:40"), reason: "Initial assessment from repo cadence" }] },
  { id: "f-ines", founderId: "f-ines", score: 62, history: [{ score: 62, at: D("07-05T12:30"), reason: "Initial assessment from hackathon win and buyer interest" }] },
  { id: "f-viktor", founderId: "f-viktor", score: 54, history: [{ score: 59, at: D("07-09T09:10"), reason: "Initial assessment from application" }, { score: 54, at: D("07-10T09:30"), reason: "Team-size claim contradicted by founders-fair profile" }] },
  { id: "f-ruth", founderId: "f-ruth", score: 60, history: [{ score: 60, at: D("07-16T10:30"), reason: "Initial assessment from accelerator acceptance" }] },
  { id: "f-kenji", founderId: "f-kenji", score: 68, history: [{ score: 68, at: D("07-07T14:00"), reason: "Initial assessment from library adoption and research record" }] },
];

const interviews: Interview[] = [
  { id: "i-lena", opportunityId: "o-lena", founderId: "f-lena", plannedQuestions: [], turns: [], status: "invited", extractedClaimIds: [], createdAt: D("07-16T09:00") },
];

// Founder B for the demo: the cold-start applicant. Not seeded into Memory;
// she enters live through the apply flow during the demo.
export const DEMO_COLD_START_APPLICATION = {
  name: "Amara Diallo",
  company: "Wardly",
  pitch:
    "I spent eleven years as a ward staffing coordinator in two NHS trusts. Rotas are still built in spreadsheets, and every gap costs a fortune in last-minute agency cover. I built a rota assistant that predicts gaps two weeks out and suggests swaps before agencies are needed. It started as a spreadsheet with formulas, then a no-code app. Three wards at my old trust use it unofficially, and the rota manager at a neighbouring trust asked for it after seeing it at a conference. I taught myself to build it at nights over two years. I have no engineering degree, no investors, and I have never raised money. I want to rebuild it properly and get it approved for wider NHS use.",
  links: [] as string[],
};

export function seedUniverse() {
  replaceAll("founders", founders);
  replaceAll("ventures", ventures);
  replaceAll("opportunities", opportunities);
  replaceAll("signals", signals);
  replaceAll("claims", claims);
  replaceAll("traitScores", traitScores);
  replaceAll("founderScores", founderScores);
  replaceAll("axisScores", axisScores);
  replaceAll("interviews", interviews);
  replaceAll("memos", []);
  replaceAll("events", []);
  logEvent("seed", "Synthetic universe seeded: 12 founders, 18 signals, 2 seeded contradictions, 1 dedup merge, 1 open interview invitation");
  logEvent("dedupe.merge", "Priya Nair reached via two channels (NHS Hack Week + Techstars cohort); profiles merged on GitHub handle", { founderId: "f-priya" });
  logEvent("threshold.crossed", "Lena Vogel crossed the conviction threshold (78 ≥ 70); interview invitation created", { founderId: "f-lena", opportunityId: "o-lena" });
  return {
    founders: founders.length,
    ventures: ventures.length,
    opportunities: opportunities.length,
    signals: signals.length,
    claims: claims.length,
  };
}
