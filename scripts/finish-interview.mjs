// Demo helper: completes an in-progress Amara interview via the API so the
// feedback card and diligence are ready seconds after the on-camera portion.
// Usage: node scripts/finish-interview.mjs [interviewId]
import { readFileSync } from "fs";

const BASE = "http://localhost:3000";

const ANSWERS = [
  "The neighbouring trust ran twelve-hour shifts while ours ran eight-hour ones, so my model's assumptions broke completely. I rebuilt the availability matrix over about three weekends, using the e-rostering guidance NHS England publishes as my reference for safe staffing rules, and tested it against six months of their old rotas before showing anyone. Their rota manager now gets a gap forecast every Monday and says agency requests are down by about a third.",
  "Honestly the tools were basic. I used Airtable for the availability matrix and Glide to put an app on top. I designed the matrix, wrote every formula, and sat with ward sisters on their breaks to check the swap suggestions made sense. The trust never gave me a budget, so I paid the fifty pounds a month for Glide myself for the first year.",
  "I never did a formal course. I picked things up from YouTube and the Glide community forum at night after shifts. The biggest jump came when I stopped copying templates and rebuilt the matrix logic myself so I actually understood it. When the safer staffing guidance was updated I went through it line by line and rebuilt my swap rules around it.",
  "The winter flu season was the deadline that mattered. Two ward sisters told me sickness cover was their worst week of the year, so I promised them a sickness-cover feature by December. I delivered it in November and then spent a weekend fixing a bug they found in the swap chain, because if it suggested an unsafe swap even once they would stop trusting it.",
  "The moment I decided to take it seriously was when the rota manager from the neighbouring trust asked for it at a conference. Until then it was a side project. Since then I have started a hazard log and begun studying the DCB0129 clinical safety standard, because if I want this used across the NHS it has to be safe, not just clever.",
  "What I want next is to rebuild it properly with real engineering help, get it through information governance at one trust officially rather than unofficially, and prove the agency-cover savings with actual finance numbers instead of anecdotes.",
  "The hardest feedback was a ward sister telling me the app was confusing on nights when staff were tired. I sat with the night team for two shifts, watched where they got stuck, and stripped the interface down to one screen. Complaints stopped after that.",
  "If I am honest, the thing I most need help with is the clinical safety casework and procurement. I can build the product and I know the problem cold, but navigating NHS purchasing is a different skill and I would rather learn it from someone who has done it.",
];

async function main() {
  let id = process.argv[2];
  if (!id) {
    const interviews = JSON.parse(readFileSync("data/interviews.json", "utf8"));
    const open = interviews.find((i) => i.status === "in_progress") ?? interviews.find((i) => i.status === "invited");
    if (!open) throw new Error("No open interview found");
    id = open.id;
  }
  // Ensure started
  let state = await (await fetch(`${BASE}/api/interview/${id}`)).json();
  if (state.error) throw new Error(state.error);
  let n = state.interview.turns.filter((t) => t.role === "founder").length;
  while (state.interview.status !== "complete" && n < 12) {
    const answer = ANSWERS[Math.min(n, ANSWERS.length - 1)];
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/interview/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: answer }),
    });
    state = await res.json();
    if (state.error) throw new Error(state.error);
    const last = state.interview.turns.at(-1);
    console.log(`turn ${n + 1} (${Date.now() - t0}ms): ${last.text.slice(0, 110)}${last.check ? ` [check: ${last.check.grade}]` : ""}`);
    n += 1;
  }
  console.log(`\nstatus: ${state.interview.status}`);
  if (state.interview.feedback) {
    console.log("feedback strengths:", state.interview.feedback.strengths.length, "| thin:", state.interview.feedback.thinEvidence.length);
  }
  console.log(`interview page: ${BASE}/interview/${id}`);
  console.log(`memo page: ${BASE}/memo/${state.interview.opportunityId}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
