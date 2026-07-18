// Full dress rehearsal against a running dev server: seed, live scan with
// LLM screening, Amara's cold-start journey end to end, diligence, decision,
// and a natural-language query. Run: node scripts/rehearsal.mjs
const BASE = "http://localhost:3000";

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${data.error}`);
  return data;
}
const post = (p, b) => call("POST", p, b);
const get = (p) => call("GET", p);

const AMARA_PITCH =
  "I spent eleven years as a ward staffing coordinator in two NHS trusts. Rotas are still built in spreadsheets, and every gap costs a fortune in last-minute agency cover. I built a rota assistant that predicts gaps two weeks out and suggests swaps before agencies are needed. It started as a spreadsheet with formulas, then a no-code app. Three wards at my old trust use it unofficially, and the rota manager at a neighbouring trust asked for it after seeing it at a conference. I taught myself to build it at nights over two years. I have no engineering degree, no investors, and I have never raised money. I want to rebuild it properly and get it approved for wider NHS use.";

const AMARA_ANSWERS = [
  "The hardest part was predicting gaps before they happened. I took two years of shift data from our rota exports and worked out the patterns behind late drops, things like night-shift runs before leave, or certain ward and season combinations. I built a scoring model in the spreadsheet first, then rebuilt it in the no-code tool when the formulas got unmanageable. I tested it against six months of history and it caught roughly eight in ten gaps at least two weeks out.",
  "Nobody asked me to build it. I was the one phoning agencies at six in the morning when a shift fell over, so I had the problem in my hands every week. I worked on it Tuesday and Thursday evenings after shifts for about two years, and I kept going after I changed jobs because the ward managers were still using it.",
  "When the neighbouring trust asked for it, their wards ran completely different shift patterns, and my rota model couldn't represent them. I spent about a month reading how proper scheduling systems model rotations, then redesigned that part from scratch. Their rota manager now runs it on two wards, which forced me to make it configurable rather than hard-coded to my old trust.",
  "Three ward managers use it every week and message me directly when it makes a bad suggestion. I fix whatever they report the same week and keep a change log, it started in a notebook and is now a shared document with about sixty entries. When a prediction caused a double-booking last spring I drove in, sorted the rota by hand, and changed the rule that caused it that weekend.",
  "I told the rota managers I'd have the sickness-cover feature working before winter flu season, and it went live mid-November, two weeks before the first big absence spike. More recently I promised the neighbouring trust a way to export to their payroll format, and delivered it within the month.",
  "I've never raised money and I don't come from that world. But I've looked into what wider NHS rollout would actually need, I've read the clinical safety standard DCB0129 and started the hazard log it requires, because I know unofficial tools don't get past procurement. That's what the funding is for: rebuilding it properly so it can pass those gates.",
  "I think what I'm proudest of is that it never stopped being used. Tools like this usually die when the person who built them moves on, and it didn't, because I kept showing up for the people using it.",
];

function lastAgentLine(interview) {
  const agent = interview.turns.filter((t) => t.role === "agent");
  return agent[agent.length - 1]?.text ?? "";
}

const t0 = Date.now();
const mark = () => `[${Math.round((Date.now() - t0) / 1000)}s]`;

console.log(mark(), "1) Seeding universe…");
console.log("   ", JSON.stringify((await post("/api/seed")).counts));

console.log(mark(), "2) Live outbound scan with LLM screening…");
const scan = await post("/api/scan");
console.log(
  "   ",
  scan.scanners.map((s) => `${s.source}:${s.error ? "ERR" : s.found}`).join(" "),
  `| new:${scan.foundersCreated} merged:${scan.foundersMerged} screened:${scan.screened} invited:${scan.invited} llmSkipped:${scan.llmSkipped}`
);

console.log(mark(), "3) Amara applies (cold start, no links)…");
const app = await post("/api/apply", {
  name: "Amara Diallo",
  company: "Wardly",
  pitch: AMARA_PITCH,
  links: [],
});
console.log("   ", JSON.stringify(app));

console.log(mark(), "4) Socratic interview…");
let payload = await get(`/api/interview/${app.interviewId}`);
console.log("    planned questions:", payload.interview.plannedQuestions.length);
let i = 0;
while (payload.interview.status !== "complete" && i < AMARA_ANSWERS.length) {
  console.log(`    Q${i + 1}:`, lastAgentLine(payload.interview).slice(0, 120).replace(/\n/g, " "));
  payload = await post(`/api/interview/${app.interviewId}`, {
    message: AMARA_ANSWERS[i],
  });
  i += 1;
}
console.log(
  mark(),
  "    interview status:",
  payload.interview.status,
  "| extracted claims:",
  payload.interview.extractedClaimIds.length,
  "| feedback:",
  payload.interview.feedback ? "yes" : "no"
);

console.log(mark(), "5) Diligence: axes + memo…");
const dil = await post(`/api/diligence/${app.opportunityId}`);
console.log("    verdict:", dil.memo.recommendation.verdict, "|", dil.memo.recommendation.thesisFit);
console.log("    gaps:", dil.memo.gaps.join(" | "));

console.log(mark(), "6) Decision…");
const dec = await post("/api/decision", {
  opportunityId: app.opportunityId,
  verdict: dil.memo.recommendation.verdict,
});
console.log("    hours from first signal to decision:", dec.hoursToDecision);

console.log(mark(), "7) Natural-language query…");
const q = await post("/api/query", {
  q: "inbound founder, healthcare, strong accountability, no prior VC backing",
});
console.log("    understood as:", q.interpretation);
console.log(
  "    results:",
  q.results.map((r) => `${r.name} (${r.matchedBecause.length} criteria)`).join("; ") || "none"
);

console.log(mark(), "REHEARSAL COMPLETE");
