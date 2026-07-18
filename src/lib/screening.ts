import { completeJSON } from "./llm";
import { searchEvidence } from "./tavily";
import { getAll, getById, logEvent, now, upsert } from "./store";
import type { AxisScore, Trend } from "./types";

// The three axes are scored independently and never averaged. Founder is
// deterministic from capability evidence; Market and Idea-vs-Market are
// LLM judgments over real evidence. Trend is a v1 heuristic: Founder trend
// from Founder Score history, others default stable and say so.

const MARKET_SYSTEM = `You are the market axis of a venture screening system. Judge the MARKET only (not the founder, not execution) from the evidence provided.
Rules:
- rating: exactly one of "bullish", "neutral", "bear".
- rationale: 1-2 plain sentences naming market size, competition, or timing factors visible in the evidence.
- Output strict JSON only: {"rating":"...","rationale":"..."}`;

const IDEA_SYSTEM = `You are the idea-vs-market axis of a venture screening system. Question: does this idea survive scrutiny as-is, and if not, is this team strong enough to pivot?
Rules:
- rating: exactly one of "survives scrutiny", "pivot likely, team could make it", "weak".
- rationale: 1-2 plain sentences grounded in the claims and market evidence provided.
- Output strict JSON only: {"rating":"...","rationale":"..."}`;

function founderTrend(founderId: string): Trend {
  const record = getById("founderScores", founderId);
  if (!record || record.history.length < 2) return "stable";
  const [prev, last] = record.history.slice(-2);
  if (last.score > prev.score) return "improving";
  if (last.score < prev.score) return "declining";
  return "stable";
}

export async function scoreAxes(opportunityId: string): Promise<AxisScore[]> {
  const opp = getById("opportunities", opportunityId);
  if (!opp) throw new Error("Opportunity not found");
  const venture = getById("ventures", opp.ventureId);

  const traits = getAll("traitScores").filter(
    (t) => t.opportunityId === opportunityId
  );
  const founderScore = getById("founderScores", opp.founderId);
  const scoredTraits = traits.filter((t) => t.score !== null);

  const founderAxis: AxisScore = {
    id: `${opportunityId}-founder`,
    opportunityId,
    axis: "founder",
    rating: founderScore
      ? `${founderScore.score} — ${founderScore.score >= 70 ? "strong" : founderScore.score >= 50 ? "promising" : "early"}`
      : "unassessed",
    trend: founderTrend(opp.founderId),
    rationale:
      scoredTraits.length > 0
        ? `${scoredTraits.length} of 4 capability traits scored (${scoredTraits
            .map((t) => `${t.trait.replace("_", " ")} ${t.score}`)
            .join(", ")}). The persistent Founder Score is one input; per-opportunity capability evidence is the rest.`
        : "Capability assessment pending; the rating reflects the evidence base only.",
    evidenceRefs: traits.map((t) => t.id),
    assessedAt: now(),
  };
  upsert("axisScores", founderAxis);

  let marketAxis: AxisScore = {
    id: `${opportunityId}-market`,
    opportunityId,
    axis: "market",
    rating: "neutral",
    trend: "stable",
    rationale:
      "Market research unavailable (no evidence provider); neutral by default, and honestly labelled as such.",
    evidenceRefs: [],
    assessedAt: now(),
  };
  try {
    const evidence = await searchEvidence(
      `${venture?.name ?? ""} ${venture?.oneLiner ?? ""} market competitors funding`,
      []
    );
    const judged = await completeJSON<{ rating: string; rationale: string }>(
      MARKET_SYSTEM,
      JSON.stringify({
        venture: { name: venture?.name, oneLiner: venture?.oneLiner, sector: venture?.sector },
        evidence: evidence.map((e) => ({ title: e.title, content: e.content, url: e.url })),
      })
    );
    marketAxis = {
      ...marketAxis,
      rating: ["bullish", "neutral", "bear"].includes(judged.rating)
        ? judged.rating
        : "neutral",
      rationale: judged.rationale,
      evidenceRefs: evidence.slice(0, 4).map((e) => e.url),
    };
  } catch (err) {
    logEvent(
      "screening.market_skipped",
      err instanceof Error ? err.message : "market axis failed"
    );
  }
  upsert("axisScores", marketAxis);

  const claims = getAll("claims")
    .filter((c) => c.opportunityId === opportunityId)
    .map((c) => ({ text: c.text, grade: c.grade ?? "ungraded" }));
  let ideaAxis: AxisScore = {
    id: `${opportunityId}-idea`,
    opportunityId,
    axis: "idea_market",
    rating: "unassessed",
    trend: "stable",
    rationale: "Idea-vs-market judgment unavailable; not scored rather than guessed.",
    evidenceRefs: [],
    assessedAt: now(),
  };
  try {
    const judged = await completeJSON<{ rating: string; rationale: string }>(
      IDEA_SYSTEM,
      JSON.stringify({
        venture: { name: venture?.name, oneLiner: venture?.oneLiner },
        claims,
        marketAxis: { rating: marketAxis.rating, rationale: marketAxis.rationale },
      })
    );
    ideaAxis = {
      ...ideaAxis,
      rating: ["survives scrutiny", "pivot likely, team could make it", "weak"].includes(judged.rating)
        ? judged.rating
        : "unassessed",
      rationale: judged.rationale,
      evidenceRefs: claims.length > 0 ? ["claims"] : [],
    };
  } catch (err) {
    logEvent(
      "screening.idea_skipped",
      err instanceof Error ? err.message : "idea axis failed"
    );
  }
  upsert("axisScores", ideaAxis);

  return [founderAxis, marketAxis, ideaAxis];
}
