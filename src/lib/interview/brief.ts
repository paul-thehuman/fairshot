import { getAll } from "../store";
import type { Interview, InterviewBrief, Trait } from "../types";

// Plain-English name for each capability trait, for a founder who has never
// heard the internal vocabulary.
const TRAIT_LABEL: Record<Trait, string> = {
  ability: "Solving hard problems",
  aspiration: "Where you're taking this",
  learning_agility: "Learning and adapting",
  accountability: "Owning the outcome",
};

// What evidence is worth having to hand for each trait. These ask for proof of
// what the founder actually did — not tips for scoring higher.
const TRAIT_BRING: Record<Trait, string> = {
  ability:
    "A concrete thing you built or worked out, with the result in numbers if you have them",
  aspiration:
    "One real step you've already taken toward the bigger goal, not just the plan",
  learning_agility:
    "A moment something went wrong or changed, and what you did differently afterwards",
  accountability:
    "A decision that was yours to make, and how it turned out, good or bad",
};

const PUBLIC_SIGNAL_SOURCES = new Set(["github", "hackernews", "arxiv", "web"]);

// Build the pre-interview brief from state already in Memory. Returns null when
// there are no planned questions yet (nothing honest to show).
export function buildBrief(interview: Interview): InterviewBrief | null {
  const planned = interview.plannedQuestions ?? [];
  if (planned.length === 0) return null;

  // Focus areas: the traits the interview will probe, in planned order, each
  // with the specific evidence gap that put it on the list. One entry per trait.
  const focusAreas: InterviewBrief["focusAreas"] = [];
  const seen = new Set<Trait>();
  for (const q of planned) {
    if (seen.has(q.trait)) continue;
    seen.add(q.trait);
    focusAreas.push({
      trait: q.trait,
      label: TRAIT_LABEL[q.trait] ?? q.trait,
      why: q.why,
    });
  }

  const claims = getAll("claims").filter(
    (c) => c.founderId === interview.founderId && c.origin !== "interview"
  );

  // Things the founder told us that we could not confirm from public sources.
  // This is exactly the evidence worth bringing to the interview. Deduped by
  // text so a re-run or re-application never repeats a line.
  const couldNotVerify: string[] = [];
  for (const c of claims) {
    if (c.grade !== "unverifiable" && c.grade !== "weak_signal") continue;
    if (!couldNotVerify.includes(c.text)) couldNotVerify.push(c.text);
    if (couldNotVerify.length === 4) break;
  }

  // A public track record means we actually found this person or their work out
  // there — a sourced footprint. A corroborated market truism ("rotas are built
  // in spreadsheets") is not evidence about the founder, so it does not count.
  const hasPublicEvidence = getAll("signals").some(
    (s) => s.founderId === interview.founderId && PUBLIC_SIGNAL_SOURCES.has(s.source)
  );

  const bringThese: string[] = [];
  if (couldNotVerify.length > 0) {
    bringThese.push(
      "Anything that backs up the claims we couldn't confirm: a link, a screenshot, or a name we can contact"
    );
  }
  for (const area of focusAreas) {
    const prompt = TRAIT_BRING[area.trait];
    if (prompt && !bringThese.includes(prompt)) bringThese.push(prompt);
  }

  return { focusAreas, couldNotVerify, bringThese, hasPublicEvidence };
}
