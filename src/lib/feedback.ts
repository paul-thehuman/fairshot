import { completeJSON } from "./llm";
import { getAll } from "./store";
import type { FounderFeedback } from "./types";

const FEEDBACK_SYSTEM = `You write FairShot's founder-facing feedback: "what we saw". The founder receives this whether or not they are funded; its job is to help them succeed.
Rules:
- strengths: 2-3 bullets naming specific evidence of capability, no flattery.
- thinEvidence: 1-3 bullets naming where evidence was thin or unverifiable, stated plainly and kindly. Absence of evidence is not an accusation.
- nextSteps: 2-3 concrete actions that would strengthen a future application: things to ship, document, or make public.
- Plain warm English. No scores, no jargon, no corporate filler.
- Output strict JSON only: {"strengths":[],"thinEvidence":[],"nextSteps":[]}`;

export async function generateFeedback(
  founderId: string,
  opportunityId: string
): Promise<FounderFeedback> {
  const claims = getAll("claims")
    .filter((c) => c.founderId === founderId)
    .map((c) => ({ text: c.text, grade: c.grade ?? "ungraded", origin: c.origin }));
  const traits = getAll("traitScores")
    .filter((t) => t.opportunityId === opportunityId)
    .map((t) => ({ trait: t.trait, confidence: t.confidence, rationale: t.rationale }));
  const signals = getAll("signals")
    .filter((s) => s.founderId === founderId)
    .map((s) => ({ source: s.source, title: s.title }));

  const parsed = await completeJSON<FounderFeedback>(
    FEEDBACK_SYSTEM,
    JSON.stringify({ claims, traits, signals }, null, 2)
  );
  return {
    strengths: parsed.strengths ?? [],
    thinEvidence: parsed.thinEvidence ?? [],
    nextSteps: parsed.nextSteps ?? [],
  };
}
