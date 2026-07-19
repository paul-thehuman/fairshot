import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { Claim, ClaimCategory, Grade, EvidenceSource } from "./types";
import type { EvidenceSnippet } from "./tavily";

type Provider = "openai" | "gemini" | "anthropic";

// OpenAI, then Gemini (both hackathon credits), Anthropic last: keeps the
// app's own runtime inference off the Claude Code subscription quota used to
// build it.
function activeProvider(): Provider {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  throw new Error(
    "No LLM provider configured. Set OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY in .env.local."
  );
}

const CLAIM_CATEGORIES: ClaimCategory[] = [
  "traction",
  "technical",
  "experience",
  "team",
  "market",
];
const GRADES: Grade[] = ["corroborated", "weak_signal", "unverifiable"];

const EXTRACTION_SYSTEM = `You extract discrete, independently checkable claims from a founder's pitch.
Rules:
- Return 3 to 6 claims. Fewer is fine if the pitch is thin. Never invent claims not implied by the text.
- Each claim must be a single, specific, checkable assertion (a fact someone could search for), not a vague statement of ambition.
- Category must be exactly one of: ${CLAIM_CATEGORIES.join(", ")}.
- Output strict JSON only: {"claims":[{"text":"...","category":"..."}]}`;

const GRADING_SYSTEM = `You grade one founder claim against search evidence provided to you.
Rules:
- grade must be exactly one of: ${GRADES.join(", ")}.
- "corroborated": at least one provided source directly supports the claim.
- "weak_signal": sources are tangentially related or partially consistent, but do not directly confirm it.
- "unverifiable": no provided source speaks to the claim, or the evidence list was empty. Do not guess. Absence of evidence is not evidence of falsehood, say so plainly.
- sources: only cite URLs that appear in the evidence list you were given. Never invent a URL. If no source supports the claim, return an empty sources array.
- reasoning: one plain sentence, no hedging filler, state what was or was not found.
- Output strict JSON only: {"grade":"...","reasoning":"...","sourceUrls":["..."]}`;

function parseJson<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Providers without a JSON response mode sometimes preface or wrap the
    // object; recover the first object-shaped block before giving up.
    const block = cleaned.match(/\{[\s\S]*\}/);
    if (block) return JSON.parse(block[0]) as T;
    throw new Error("Model returned non-JSON output");
  }
}

async function callOpenAI(system: string, user: string): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });
  return res.choices[0]?.message?.content ?? "{}";
}

async function callAnthropic(system: string, user: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const res = await client.messages.create({
    model,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = res.content[0];
  return block && block.type === "text" ? block.text : "{}";
}

async function callGemini(system: string, user: string): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Gemini call failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

async function call(system: string, user: string): Promise<string> {
  switch (activeProvider()) {
    case "openai":
      return callOpenAI(system, user);
    case "gemini":
      return callGemini(system, user);
    case "anthropic":
      return callAnthropic(system, user);
  }
}

// Generic JSON-mode completion for FairShot's reasoning steps (interview
// planning, capability assessment, screening, memo, query parsing).
export async function completeJSON<T>(system: string, user: string): Promise<T> {
  return parseJson<T>(await call(system, user));
}

export function currentProvider(): Provider {
  return activeProvider();
}

export async function extractClaims(
  pitch: string,
  links: string[]
): Promise<Claim[]> {
  const user = `Founder pitch:\n${pitch}\n\nPublic links provided:\n${
    links.join("\n") || "(none)"
  }`;
  const raw = await call(EXTRACTION_SYSTEM, user);
  const parsed = parseJson<{
    claims: { text: string; category: string }[];
  }>(raw);

  return parsed.claims
    .filter((c) => CLAIM_CATEGORIES.includes(c.category as ClaimCategory))
    .slice(0, 6)
    .map((c, i) => ({
      id: `claim-${i}`,
      text: c.text,
      category: c.category as ClaimCategory,
    }));
}

export async function gradeClaim(
  claimText: string,
  evidence: EvidenceSnippet[]
): Promise<{ grade: Grade; reasoning: string; sources: EvidenceSource[] }> {
  const evidenceList =
    evidence.length > 0
      ? evidence
          .map((e, i) => `[${i}] ${e.title} — ${e.url}\n${e.content}`)
          .join("\n\n")
      : "(no search results found)";

  const user = `Claim: "${claimText}"\n\nEvidence found:\n${evidenceList}`;
  const raw = await call(GRADING_SYSTEM, user);
  const parsed = parseJson<{
    grade: string;
    reasoning: string;
    sourceUrls: string[];
  }>(raw);

  const grade: Grade = GRADES.includes(parsed.grade as Grade)
    ? (parsed.grade as Grade)
    : "unverifiable";

  // Structural guard: only accept sources the model actually saw. Drops
  // anything that doesn't match a real search result rather than trusting
  // the model's citation.
  const validUrls = new Set(evidence.map((e) => e.url));
  const sources: EvidenceSource[] = evidence
    .filter((e) => parsed.sourceUrls?.includes(e.url) && validUrls.has(e.url))
    .map((e) => ({ url: e.url, title: e.title }));

  return { grade, reasoning: parsed.reasoning, sources };
}
