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
  TurnCheck,
} from "../types";

const MAX_AGENT_TURNS = 10;
const CATEGORIES: ClaimCategory[] = ["traction", "technical", "experience", "team", "market"];

const CONDUCT_SYSTEM = `You are conducting a planned behavioural interview for a venture fund. Decide the next move after the founder's latest answer.
You also receive "dossier": everything the fund already holds on this founder (signals found by sourcing, claims with evidence grades). Use it: when acknowledging or following up, reference a concrete dossier fact by name where it genuinely connects to their answer ("that fits the commit history on your rota-model repo"). Never invent dossier facts, and never recite the dossier for its own sake.
You may also receive "liveCheck": the fund just fact-checked one claim from the founder's latest answer, while they were speaking. A standard sentence announcing the result is automatically placed before your message, so do NOT restate the result. You MAY use it to shape your move: for an unverifiable claim, a good follow-up asks who or what could confirm it.
Rules:
- "follow_up" only if followUpAvailable is true AND the answer lacked a concrete example, numbers, or the founder's specific role. The follow-up must reference the founder's own words and ask for the exact missing specifics: numbers, dates, names, or what the founder personally did.
- otherwise "next": briefly acknowledge one specific thing from their answer (no flattery), then ask nextQuestion. If nextQuestion is null, choose "close" instead.
- "close": thank them, and say their evidence will be reviewed and they will see honest feedback either way.
- message: 1-4 sentences, plain warm English.
Output strict JSON only: {"action":"follow_up"|"next"|"close","message":"..."}`;

const LIVE_CHECK_SYSTEM = `From a founder's interview answer, pick the ONE claim most worth fact-checking against public sources right now.
A claim is worth checking only if a public web search could plausibly confirm it: a named product, employer, event, publication, repository, organisation, or public number. Personal behavioural accounts ("I decided to...", "I felt...") are not checkable.
claim: ONE short self-contained sentence, maximum 15 words, third person ("The founder ..."), names attached.
Output strict JSON only: {"checkable":true|false,"claim":"..."}`;

// Everything the fund already holds on this founder, compact enough to ride
// along on every conduct call. This is what makes the interviewer feel like it
// has actually read the file.
function buildDossier(interview: Interview) {
  const founder = getById("founders", interview.founderId);
  const venture = getAll("ventures").find((v) => v.founderId === interview.founderId);
  const signals = getAll("signals")
    .filter((s) => s.founderId === interview.founderId)
    .map((s) => ({ source: s.source, title: s.title, content: s.content.slice(0, 300) }));
  const claims = getAll("claims")
    .filter((c) => c.founderId === interview.founderId)
    .map((c) => ({ text: c.text, grade: c.grade ?? "ungraded" }));
  return {
    founder: founder?.name,
    bio: founder?.bio,
    venture: venture ? { name: venture.name, oneLiner: venture.oneLiner } : null,
    signals,
    claims,
  };
}

// Spoken announcement of a live check. Deterministic so the demo never depends
// on the model choosing to mention it. Claims are stored in third person for
// the memo; speech addresses the founder directly.
function toSecondPerson(claim: string): string {
  return claim
    .replace(/^The founder's\s/i, "your ")
    .replace(/^The founder\s/i, "you ")
    .replace(/\sthe founder's\s/gi, " your ")
    .replace(/\sthe founder\s/gi, " you ");
}

function checkSentence(check: TurnCheck): string {
  const claim = toSecondPerson(check.claim.replace(/\.$/, ""));
  if (check.grade === "corroborated") {
    return `Quick note: while you were answering, I checked "${claim}" and found it${
      check.sourceTitle ? ` (${check.sourceTitle})` : ""
    }.`;
  }
  if (check.grade === "weak_signal") {
    return `Quick note: I looked for a public record of "${claim}" while you were answering and found only weak traces, which is common for early work.`;
  }
  return `Quick note: I looked for a public record of "${claim}" while you were answering and couldn't find one. That's expected for internal work, and it is not held against you.`;
}

// Fact-check the most checkable claim in the founder's latest answer, while
// they are mid-interview. Stores the graded claim in Memory and returns what
// was found. Any failure returns null and the interview proceeds untouched.
async function liveCheckAnswer(
  interview: Interview,
  founderAnswer: string
): Promise<TurnCheck | null> {
  try {
    const picked = await completeJSON<{ checkable: boolean; claim: string }>(
      LIVE_CHECK_SYSTEM,
      founderAnswer
    );
    if (!picked.checkable || !picked.claim?.trim()) return null;
    const claimText = picked.claim.trim();

    const evidence = await searchEvidence(claimText, []);
    const graded = await gradeClaim(claimText, evidence);

    const stored: StoredClaim = {
      id: newId(),
      opportunityId: interview.opportunityId,
      founderId: interview.founderId,
      origin: "interview",
      text: claimText,
      category: "experience",
      grade: graded.grade,
      reasoning: graded.reasoning,
      sources: graded.sources,
    };
    upsert("claims", stored);
    patchById("interviews", interview.id, {
      extractedClaimIds: [...(getById("interviews", interview.id)?.extractedClaimIds ?? []), stored.id],
    });
    logEvent(
      "interview.live_check",
      `Live-checked mid-interview: "${claimText.slice(0, 80)}" → ${graded.grade}`,
      { founderId: interview.founderId, opportunityId: interview.opportunityId }
    );

    const top = graded.sources[0];
    return {
      claim: claimText,
      grade: graded.grade,
      sourceUrl: top?.url,
      sourceTitle: top?.title,
    };
  } catch {
    return null; // The check is a bonus, never a blocker.
  }
}

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
  // One follow-up per question, at most two across the whole interview:
  // founders' time is respected, and the demo stays tight.
  const totalFollowUps = Math.max(0, agentTurnCount(turns) - (qi + 1));
  const followUpAvailable =
    (interview.followUpsUsed ?? 0) === 0 &&
    totalFollowUps < 2 &&
    agentTurnCount(turns) < MAX_AGENT_TURNS - 1;
  const nextQuestion = isLast ? null : questions[qi + 1].question;

  // Vet the answer while the founder is still in the room: pick the most
  // checkable claim, search for it, grade it. Runs before the conduct call so
  // the interviewer's next words can honestly reference what was found.
  const liveCheck = await liveCheckAnswer(interview, founderAnswer);

  let decision: { action: string; message: string };
  try {
    decision = await completeJSON<{ action: string; message: string }>(
      CONDUCT_SYSTEM,
      JSON.stringify({
        dossier: buildDossier(interview),
        plannedQuestions: questions.map((q) => q.question),
        currentQuestionIndex: qi,
        latestAnswer: founderAnswer,
        followUpAvailable,
        nextQuestion,
        liveCheck: liveCheck
          ? {
              claim: liveCheck.claim,
              grade: liveCheck.grade,
              sourceTitle: liveCheck.sourceTitle ?? null,
            }
          : null,
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
  if (action !== "follow_up" && action !== "next" && action !== "close") {
    // Off-vocabulary model output must never kill the interview: treat it as
    // a plain move to the next question, or a close on the last one.
    action = isLast ? "close" : "next";
  }
  if (action === "follow_up" && !followUpAvailable) action = "next";
  if (action === "next" && isLast) action = "close";

  let spoken = (decision.message ?? "").trim();
  if (!spoken) {
    spoken =
      action === "close"
        ? "Thank you, that's everything I needed. Your evidence goes for review now, and you'll see honest feedback either way."
        : nextQuestion ?? "Let's move on.";
  }

  // The check announcement is deterministic code, not a model behaviour: it is
  // spoken every time a check ran, in the same honest register.
  const message = liveCheck ? `${checkSentence(liveCheck)} ${spoken}` : spoken;

  const patch: Partial<Interview> = {
    turns: [
      ...turns,
      {
        role: "agent",
        text: message,
        at: now(),
        ...(liveCheck ? { check: liveCheck } : {}),
      },
    ],
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

  // Claims already banked by live checks during the conversation; the closing
  // extraction must not repeat them.
  const alreadyCaptured = getAll("claims").filter(
    (c) => c.opportunityId === interview.opportunityId && c.origin === "interview"
  );

  const claimIds: string[] = [];
  try {
    const parsed = await completeJSON<{
      claims: { text: string; category: string; checkable: boolean }[];
    }>(
      INTERVIEW_EXTRACT_SYSTEM,
      `Already captured during the interview (do NOT repeat these or close variants):\n${
        alreadyCaptured.map((c) => `- ${c.text}`).join("\n") || "- none"
      }\n\nFounder's interview answers:\n${founderAnswers}`
    );

    for (const extracted of (parsed.claims ?? []).slice(0, 8)) {
      const duplicate = alreadyCaptured.some(
        (c) => c.text.trim().toLowerCase() === extracted.text.trim().toLowerCase()
      );
      if (duplicate) continue;
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
    patchById("interviews", interview.id, {
      extractedClaimIds: [
        ...(getById("interviews", interview.id)?.extractedClaimIds ?? []),
        ...claimIds,
      ],
    });
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
