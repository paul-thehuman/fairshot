import type { GradedClaim, ScoreBand, Grade } from "./types";

const WEIGHTS: Record<Grade, number> = {
  corroborated: 1,
  weak_signal: 0.5,
  unverifiable: 0,
};

// Deterministic aggregation, computed in code, never asserted by the model.
// Keeps the headline number an honest readout of the graded claims below it,
// not a separate LLM-generated verdict that could drift from the evidence.
export function computeScore(claims: GradedClaim[]): ScoreBand {
  if (claims.length === 0) {
    return { pct: 0, band: "Largely unverifiable" };
  }

  const total = claims.reduce((sum, c) => sum + WEIGHTS[c.grade], 0);
  const pct = Math.round((total / claims.length) * 100);

  const band: ScoreBand["band"] =
    pct >= 70
      ? "Strong evidence base"
      : pct >= 40
      ? "Mixed evidence"
      : "Largely unverifiable";

  return { pct, band };
}
