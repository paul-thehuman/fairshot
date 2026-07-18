import { computeScore } from "./scoring";
import { getAll, getById, logEvent, now, upsert } from "./store";
import type { FounderScoreRecord, GradedClaim, TraitScore } from "./types";

const CONFIDENCE_WEIGHT = { high: 1, medium: 0.7, low: 0.4 } as const;

// Deterministic aggregation, computed in code, never asserted by the model:
// 70% confidence-weighted capability traits, 30% evidence-base quality.
// Append-only history; the score follows the person and never resets.
export function updateFounderScore(
  founderId: string,
  reason: string
): FounderScoreRecord {
  const latestByTrait = new Map<string, TraitScore>();
  for (const t of getAll("traitScores")
    .filter((t) => t.founderId === founderId)
    .sort((a, b) => a.assessedAt.localeCompare(b.assessedAt))) {
    latestByTrait.set(t.trait, t);
  }
  const scored = [...latestByTrait.values()].filter(
    (t): t is TraitScore & { score: number; confidence: keyof typeof CONFIDENCE_WEIGHT } =>
      t.score !== null && t.confidence !== "insufficient"
  );

  const gradedClaims = getAll("claims")
    .filter((c) => c.founderId === founderId && c.grade)
    .map(
      (c): GradedClaim => ({
        id: c.id,
        text: c.text,
        category: c.category,
        grade: c.grade!,
        reasoning: c.reasoning ?? "",
        sources: c.sources ?? [],
      })
    );
  const evidencePct = computeScore(gradedClaims).pct;

  let score: number;
  if (scored.length > 0) {
    const weightedSum = scored.reduce(
      (sum, t) => sum + CONFIDENCE_WEIGHT[t.confidence] * t.score,
      0
    );
    const weightTotal = scored.reduce(
      (sum, t) => sum + CONFIDENCE_WEIGHT[t.confidence],
      0
    );
    score = Math.round(0.7 * (weightedSum / weightTotal) + 0.3 * evidencePct);
  } else {
    // Evidence-only baseline before any capability assessment exists.
    score = Math.round(evidencePct * 0.6);
  }

  const existing = getById("founderScores", founderId);
  if (existing && existing.score === score) return existing;

  const record: FounderScoreRecord = {
    id: founderId,
    founderId,
    score,
    history: [...(existing?.history ?? []), { score, at: now(), reason }],
  };
  upsert("founderScores", record);
  logEvent("founderScore.updated", `Founder score ${existing ? `moved ${existing.score} → ${score}` : `set to ${score}`}: ${reason}`, { founderId });
  return record;
}
