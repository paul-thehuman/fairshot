import { completeJSON, gradeClaim } from "../llm";
import { searchEvidence } from "../tavily";
import { getAll, getById, logEvent, newId, now, patchById, upsert } from "../store";
import { planInterview } from "./planner";
import { assessFounder } from "../capability";
import { updateFounderScore } from "../founderScore";
import { generateFeedback } from "../feedback";
import type {
  ClaimCategory,
  Interview,
  InterviewTurn,
  StoredClaim,
} from "../types";

const MAX_AGENT_TURNS = 10;
const CATEGORIES: ClaimCategory[] = ["traction", "technical", "experience", "team", "market"];

const CONDUCT_SYSTEM = `You are conducting a planned behavioural interview for a venture fund. Decide the next move after the founder's latest answer.
Rules:
- "follow_up" only if followUpAvailable is true AND the answer lacked a concrete example, numbers, or the founder's specific role. The follow-up warmly asks for the missing specifics.
- otherwise "next": briefly acknowledge one specific thing from their answer (no flattery), then ask nextQuestion. If nextQuestion is null, choose "close" instead.
- "close": thank them, and say their evidence will be reviewed and they will see honest feedback either way.
- message: 1-3 sentences, plain warm English.
Output strict JSON only: {"action":"follow_up"|"next"|"close","message":"..."}`;

const INTERVIEW_EXTRACT_SYSTEM = `You extract discrete claims from a founder's behavioural interview answers.
Rules:
- 3 to 8 claims. Each is a single, specific assertion about something the founder did, built, or achieved. Never invent claims not grounded in their answers.
- category: exactly one of traction, technical, experience, team, market.
- checkable: true only if a public web search could plausibly verify it (a named product, employer, event, or public artifact). Personal behavioural accounts are checkable: false.
- Output strict JSON only: {"claims":[{"text":"...","category":"...","checkable":false}]}`;

function agentTurnCount(turns: InterviewTurn[]): number {
  return turns.filter((t) => t.role === "agent").length;
}

export async function startInterview(id: string): Promise<Interview> {
  const interview = getById("interviews", id);
  if (!interview) throw new Error("Interview not found");
  if (interview.status !== "invited") return interview;

  const questions = await planInterview(interview);
  const founder = getById("founders", interview.founderId);
  const firstName = (founder?.name ?? "there").split(" ")[0];
  const opening = `Hi ${firstName}, thanks for making time. This is a short conversation about things you've actually done. There are no trick questions and no wrong answers, and you'll see honest feedback afterwards either way. ${questions[0].question}`;

  return patchById("interviews", id, {
    status: "in_progress",
    plannedQuestions: questions,
    currentQuestion: 0,
    followUpsUsed: 0,
    turns: [{ role: "agent", text: opening, at: now() }],
  })!;
}

export async function nextTurn(id: string, founderAnswer: string): Promise<Interview> {
  let interview = getById("interviews", id);
  if (!interview) throw new Error("Interview not found");
  if (interview.status !== "in_progress") return interview;

  const turns: InterviewTurn[] = [
    ...interview.turns,
    { role: "founder", text: founderAnswer, at: now() },
  ];

  const qi = interview.currentQuestion ?? 0;
  const questions = interview.plannedQuestions;
  const isLast = qi >= questions.length - 1;
  const followUpAvailable =
    (interview.followUpsUsed ?? 0) === 0 &&
    agentTurnCount(turns) < MAX_AGENT_TURNS - 1;
  const nextQuestion = isLast ? null : questions[qi + 1].question;

  let decision: { action: string; message: string };
  try {
    decision = await completeJSON<{ action: string; message: string }>(
      CONDUCT_SYSTEM,
      JSON.stringify({
        plannedQuestions: questions.map((q) => q.question),
        currentQuestionIndex: qi,
        latestAnswer: founderAnswer,
        followUpAvailable,
        nextQuestion,
        transcript: turns.slice(-8).map((t) => `${t.role}: ${t.text}`),
      })
    );
  } catch {
    // Deterministic fallback keeps the interview moving if the LLM hiccups.
    decision = nextQuestion
      ? { action: "next", message: nextQuestion }
      : {
          action: "close",
          message:
            "Thank you, that's everything I needed. Your evidence goes for review now, and you'll see honest feedback either way.",
        };
  }

  let action = decision.action;
  if (action === "follow_up" && !followUpAvailable) action = "next";
  if (action === "next" && isLast) action = "close";

  const patch: Partial<Interview> = {
    turns: [...turns, { role: "agent", text: decision.message, at: now() }],
  };
  if (action === "follow_up") {
    patch.followUpsUsed = (interview.followUpsUsed ?? 0) + 1;
  } else if (action === "next") {
    patch.currentQuestion = qi + 1;
    patch.followUpsUsed = 0;
  } else {
    patch.status = "complete";
  }

  interview = patchById("interviews", id, patch)!;

  if (action === "close") {
    await finalizeInterview(interview);
    interview = getById("interviews", id)!;
  }
  return interview;
}

// Interview closed: extract claims, grade the checkable ones, run the
// capability assessment, refresh the Founder Score, generate founder-facing
// feedback, and move the opportunity into diligence. Each step degrades
// gracefully; a failure is logged, never invented around.
async function finalizeInterview(interview: Interview): Promise<void> {
  const founderAnswers = interview.turns
    .filter((t) => t.role === "founder")
    .map((t) => t.text)
    .join("\n\n");

  const claimIds: string[] = [];
  try {
    const parsed = await completeJSON<{
      claims: { text: string; category: string; checkable: boolean }[];
    }>(INTERVIEW_EXTRACT_SYSTEM, `Founder's interview answers:\n${founderAnswers}`);

    for (const extracted of (parsed.claims ?? []).slice(0, 8)) {
      const claim: StoredClaim = {
        id: newId(),
        opportunityId: interview.opportunityId,
        founderId: interview.founderId,
        origin: "interview",
        text: extracted.text,
        category: CATEGORIES.includes(extracted.category as ClaimCategory)
          ? (extracted.category as ClaimCategory)
          : "experience",
      };
      if (extracted.checkable) {
        try {
          const evidence = await searchEvidence(extracted.text, []);
          const graded = await gradeClaim(extracted.text, evidence);
          claim.grade = graded.grade;
          claim.reasoning = graded.reasoning;
          claim.sources = graded.sources;
        } catch (err) {
          logEvent(
            "evidence.skipped",
            `Grading skipped for interview claim: ${err instanceof Error ? err.message : "error"}`
          );
        }
      } else {
        claim.grade = "unverifiable";
        claim.reasoning =
          "Behavioural account from the interview; weighed for consistency rather than external corroboration.";
        claim.sources = [];
      }
      upsert("claims", claim);
      claimIds.push(claim.id);
    }
    patchById("interviews", interview.id, { extractedClaimIds: claimIds });
  } catch (err) {
    logEvent(
      "interview.extraction_failed",
      err instanceof Error ? err.message : "unknown error"
    );
  }

  try {
    await assessFounder(interview.founderId, interview.opportunityId);
    updateFounderScore(interview.founderId, "Capability interview completed");
  } catch (err) {
    logEvent(
      "capability.failed",
      err instanceof Error ? err.message : "unknown error"
    );
  }

  try {
    const feedback = await generateFeedback(
      interview.founderId,
      interview.opportunityId
    );
    patchById("interviews", interview.id, { feedback });
  } catch (err) {
    logEvent(
      "feedback.failed",
      err instanceof Error ? err.message : "unknown error"
    );
  }

  const opp = getById("opportunities", interview.opportunityId);
  if (opp && opp.status !== "diligence" && opp.status !== "decision") {
    patchById("opportunities", opp.id, {
      status: "diligence",
      statusHistory: [...opp.statusHistory, { status: "diligence", at: now() }],
    });
  }

  const founder = getById("founders", interview.founderId);
  logEvent(
    "interview.complete",
    `Capability interview complete for ${founder?.name ?? "founder"}; ${claimIds.length} claims extracted; opportunity moved to diligence`,
    { founderId: interview.founderId, opportunityId: interview.opportunityId }
  );
}
