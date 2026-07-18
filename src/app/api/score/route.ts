import { NextResponse } from "next/server";
import { extractClaims, gradeClaim, currentProvider } from "@/lib/llm";
import { searchEvidence } from "@/lib/tavily";
import { computeScore } from "@/lib/scoring";
import { FAIRNESS_EXCLUSIONS } from "@/lib/fairness";
import type { GradedClaim, IntakePayload, FounderScoreResult } from "@/lib/types";

export async function POST(req: Request) {
  let payload: IntakePayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (payload.name || "").trim();
  const pitch = (payload.pitch || "").trim();
  const links = (payload.links || []).map((l) => l.trim()).filter(Boolean);

  if (!name || !pitch) {
    return NextResponse.json(
      { error: "name and pitch are required" },
      { status: 400 }
    );
  }

  try {
    const provider = currentProvider();
    const claims = await extractClaims(pitch, links);

    if (claims.length === 0) {
      return NextResponse.json(
        { error: "Could not extract any checkable claims from that pitch. Try adding more specifics." },
        { status: 422 }
      );
    }

    const graded: GradedClaim[] = await Promise.all(
      claims.map(async (claim) => {
        const evidence = await searchEvidence(claim.text, links);
        const { grade, reasoning, sources } = await gradeClaim(
          claim.text,
          evidence
        );
        return { ...claim, grade, reasoning, sources };
      })
    );

    const score = computeScore(graded);

    const result: FounderScoreResult = {
      name,
      claims: graded,
      score,
      fairnessExclusions: FAIRNESS_EXCLUSIONS,
      provider,
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
