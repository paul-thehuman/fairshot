import { completeJSON } from "./llm";
import { getAll, now, upsert } from "./store";
import { TRAITS } from "./interview/planner";
import type { Trait, TraitConfidence, TraitScore } from "./types";

const CAPABILITY_SYSTEM = `You are FairShot's capability engine, applying a high-potential talent framework to founders.
Trait definitions:
- ability: quality of what they've built and written; problem decomposition; technical or domain depth.
- aspiration: drive shown in behaviour: shipping cadence, persistence, building alongside other commitments.
- learning_agility: visible skill acquisition, absorbing feedback, successful transitions into new domains.
- accountability: follow-through and ownership: maintaining what they shipped, fixing what others report, doing what they said they would do.
Rules:
- Score each of the four traits strictly from the evidence provided: 0-100 with confidence "high"|"medium"|"low", OR confidence "insufficient" with score null. Never guess; "insufficient" is a respectable first-class answer.
- Externally corroborated evidence outweighs self-report. Interview answers are behavioural evidence worth at most "medium" confidence unless corroborated.
- rationale: 1-2 plain sentences naming the specific evidence used.
- evidenceIds: cite ONLY ids present in the provided evidence lists.
- Output strict JSON only: {"traits":[{"trait":"ability","score":0,"confidence":"low","rationale":"...","evidenceIds":["..."]}]}`;

const CONFIDENCES: TraitConfidence[] = ["high", "medium", "low", "insufficient"];

export async function assessFounder(
  founderId: string,
  opportunityId: string
): Promise<TraitScore[]> {
  const claims = getAll("claims")
    .filter((c) => c.founderId === founderId)
    .map((c) => ({
      id: c.id,
      text: c.text,
      origin: c.origin,
      grade: c.grade ?? "ungraded",
      reasoning: c.reasoning,
    }));
  const signals = getAll("signals")
    .filter((s) => s.founderId === founderId)
    .map((s) => ({ id: s.id, source: s.source, title: s.title, content: s.content }));

  const parsed = await completeJSON<{
    traits: {
      trait: string;
      score: number | null;
      confidence: string;
      rationale: string;
      evidenceIds: string[];
    }[];
  }>(CAPABILITY_SYSTEM, JSON.stringify({ claims, signals }, null, 2));

  // Structural guard, same principle as the evidence engine: the model may
  // only cite evidence ids that actually exist in Memory.
  const validIds = new Set([...claims.map((c) => c.id), ...signals.map((s) => s.id)]);

  const results: TraitScore[] = TRAITS.map((trait: Trait) => {
    const entry = parsed.traits?.find((t) => t.trait === trait);
    const confidence: TraitConfidence =
      entry && CONFIDENCES.includes(entry.confidence as TraitConfidence)
        ? (entry.confidence as TraitConfidence)
        : "insufficient";
    const insufficient = confidence === "insufficient" || entry?.score == null;
    const score: TraitScore = {
      id: `${opportunityId}-${trait}`,
      founderId,
      opportunityId,
      trait,
      score: insufficient ? null : Math.max(0, Math.min(100, Math.round(entry!.score!))),
      confidence: insufficient ? "insufficient" : confidence,
      rationale:
        entry?.rationale ??
        "Not enough evidence to assess this trait; the interview and future signals can fill the gap.",
      evidenceClaimIds: (entry?.evidenceIds ?? []).filter((id) => validIds.has(id)),
      assessedAt: now(),
    };
    upsert("traitScores", score);
    return score;
  });

  return results;
}
