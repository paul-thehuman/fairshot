import { completeJSON } from "./llm";
import { getAll, getById, logEvent, now, upsert } from "./store";
import { loadThesis } from "./thesis";
import type { Decision, Memo } from "./types";

const MEMO_SYSTEM = `You draft FairShot's investment memo STRICTLY from the Memory data provided. You are writing for a human investor who will act on this within 24 hours.
Sections:
- snapshot: one paragraph: the structural problem, why it's urgent, how the product solves it, who is behind it.
- hypotheses: 3-5 "why we would invest" bullets, each tied to evidence.
- swot: strengths/weaknesses/opportunities/threats, 2-4 short evidence-backed bullets each.
- problemProduct: the core problem in plain language, then the product step by step.
- tractionKpis: state ONLY what the graded claims support. Unverified numbers are stated as unverified. Contradicted numbers are stated as contradicted.
Rules:
- Use ONLY the provided data. Never fabricate a number, customer, or metric.
- gaps: list every standard memo item the data cannot support (e.g. "Cap table: not disclosed", "Financials & round structure: not available at this stage", "Customer references: unavailable"). A memo that marks its own gaps is more trustworthy.
- recommendation: verdict "invest" | "pass" | "watch" judged against the fund thesis and the three axes. thesisFit: one sentence. rationale: 2-3 sentences referencing the axes by name.
- Plain declarative English. No padding: length is not rigor.
- Output strict JSON only: {"snapshot":"...","hypotheses":[],"swot":{"strengths":[],"weaknesses":[],"opportunities":[],"threats":[]},"problemProduct":"...","tractionKpis":"...","gaps":[],"recommendation":{"verdict":"...","thesisFit":"...","rationale":"..."}}`;

const REQUIRED_GAPS = [
  { needle: "cap table", text: "Cap table: not disclosed" },
  { needle: "financial", text: "Financials & round structure: not available at this stage" },
];

export async function generateMemo(opportunityId: string): Promise<Memo> {
  const opp = getById("opportunities", opportunityId);
  if (!opp) throw new Error("Opportunity not found");
  const venture = getById("ventures", opp.ventureId);
  const founder = getById("founders", opp.founderId);
  const thesis = loadThesis();
  const claims = getAll("claims").filter((c) => c.founderId === opp.founderId);
  const axes = getAll("axisScores").filter((a) => a.opportunityId === opportunityId);
  const traits = getAll("traitScores").filter((t) => t.opportunityId === opportunityId);
  const signals = getAll("signals")
    .filter((s) => s.founderId === opp.founderId)
    .map((s) => ({ source: s.source, title: s.title, content: s.content.slice(0, 200) }));
  const founderScore = getById("founderScores", opp.founderId);

  const parsed = await completeJSON<Omit<Memo, "id" | "opportunityId" | "generatedAt">>(
    MEMO_SYSTEM,
    JSON.stringify(
      {
        thesis,
        founder: {
          name: founder?.name,
          bio: founder?.bio,
          origin: founder?.origin,
          synthetic: founder?.synthetic ?? false,
          founderScore: founderScore
            ? { score: founderScore.score, history: founderScore.history }
            : null,
        },
        venture,
        claims: claims.map((c) => ({
          id: c.id,
          text: c.text,
          category: c.category,
          origin: c.origin,
          grade: c.grade ?? "ungraded",
          reasoning: c.reasoning,
        })),
        axes,
        traits,
        signals,
      },
      null,
      2
    )
  );

  // Code-enforced honesty: the standard confidential-data gaps are present
  // whether or not the model remembered them.
  const gaps = [...(parsed.gaps ?? [])];
  for (const required of REQUIRED_GAPS) {
    if (!gaps.some((g) => g.toLowerCase().includes(required.needle))) {
      gaps.push(required.text);
    }
  }

  const verdict: Decision = ["invest", "pass", "watch"].includes(
    parsed.recommendation?.verdict as Decision
  )
    ? (parsed.recommendation.verdict as Decision)
    : "watch";

  const memo: Memo = {
    id: opportunityId,
    opportunityId,
    snapshot: parsed.snapshot ?? "",
    hypotheses: parsed.hypotheses ?? [],
    swot: {
      strengths: parsed.swot?.strengths ?? [],
      weaknesses: parsed.swot?.weaknesses ?? [],
      opportunities: parsed.swot?.opportunities ?? [],
      threats: parsed.swot?.threats ?? [],
    },
    problemProduct: parsed.problemProduct ?? "",
    tractionKpis: parsed.tractionKpis ?? "",
    gaps,
    recommendation: {
      verdict,
      thesisFit: parsed.recommendation?.thesisFit ?? "",
      rationale: parsed.recommendation?.rationale ?? "",
    },
    generatedAt: now(),
  };
  upsert("memos", memo);
  logEvent(
    "memo.generated",
    `Investment memo generated for ${founder?.name ?? "founder"} (${venture?.name ?? "venture"}): ${verdict}`,
    { founderId: opp.founderId, opportunityId }
  );
  return memo;
}
