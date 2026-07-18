import { completeJSON } from "../llm";
import { getAll, getById } from "../store";
import type { Interview, InterviewQuestion, Trait } from "../types";

export const TRAITS: Trait[] = [
  "ability",
  "aspiration",
  "learning_agility",
  "accountability",
];

const PLAN_SYSTEM = `You are FairShot's capability interviewer, applying behavioural interviewing from high-potential talent assessment.
You receive a founder's profile: signals, existing claims with evidence grades, and any prior trait assessments.
Plan 5 interview questions.
Craft rules, non-negotiable:
- ANCHOR every question in a concrete detail from THIS founder's profile: name the project, event, claim, or signal you are asking about. A question that could be sent to any founder is a failed question; show the founder their evidence was actually read.
- Behavioural and past tense: "walk me through the week when...", "tell me about the moment...". Ask what THEY personally did, with the outcome. Never hypotheticals, never yes/no, never opinions about themselves.
- Target the traits with the THINNEST evidence first, across exactly these traits: ability, aspiration, learning_agility, accountability.
- Banned: "tell me about yourself", strengths/weaknesses questions, "where do you see yourself", vision questions, and any question not tied to their evidence.
- Plain, warm English. One thing per question. No jargon.
- why: one sentence naming the evidence gap this question targets.
- Output strict JSON only: {"questions":[{"trait":"...","question":"...","why":"..."}]}`;

export async function planInterview(interview: Interview): Promise<InterviewQuestion[]> {
  const founder = getById("founders", interview.founderId);
  const venture = getAll("ventures").find((v) => v.founderId === interview.founderId);
  const signals = getAll("signals")
    .filter((s) => s.founderId === interview.founderId)
    .map((s) => ({ source: s.source, title: s.title, content: s.content }));
  const claims = getAll("claims")
    .filter((c) => c.founderId === interview.founderId)
    .map((c) => ({ text: c.text, grade: c.grade ?? "ungraded", origin: c.origin }));
  const priorTraits = getAll("traitScores")
    .filter((t) => t.founderId === interview.founderId)
    .map((t) => ({ trait: t.trait, confidence: t.confidence }));

  const profile = {
    founder: founder?.name,
    bio: founder?.bio,
    venture: venture ? { name: venture.name, oneLiner: venture.oneLiner } : null,
    signals,
    claims,
    priorTraitAssessments: priorTraits,
  };

  const parsed = await completeJSON<{
    questions: { trait: string; question: string; why: string }[];
  }>(PLAN_SYSTEM, JSON.stringify(profile, null, 2));

  const questions: InterviewQuestion[] = (parsed.questions ?? [])
    .filter((q) => TRAITS.includes(q.trait as Trait))
    .slice(0, 6)
    .map((q) => ({ trait: q.trait as Trait, question: q.question, why: q.why }));

  if (questions.length === 0) {
    throw new Error("Interview planner returned no usable questions");
  }
  return questions;
}
