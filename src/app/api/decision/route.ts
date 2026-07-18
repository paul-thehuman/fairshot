import { NextResponse } from "next/server";
import { getById, logEvent, now, patchById } from "@/lib/store";
import type { Decision } from "@/lib/types";

export async function POST(req: Request) {
  let body: { opportunityId?: string; verdict?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const opportunityId = body.opportunityId ?? "";
  const verdict = body.verdict ?? "";
  if (!["invest", "pass", "watch"].includes(verdict)) {
    return NextResponse.json(
      { error: "verdict must be invest, pass, or watch" },
      { status: 400 }
    );
  }
  const opp = getById("opportunities", opportunityId);
  if (!opp) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }

  const updated = patchById("opportunities", opportunityId, {
    decision: verdict as Decision,
    status: "decision",
    statusHistory: [...opp.statusHistory, { status: "decision" as const, at: now() }],
  })!;

  // Speed instrumentation: first signal to decision, the metric the brief asks for.
  const firstSeen = new Date(opp.statusHistory[0].at).getTime();
  const hours = (Date.now() - firstSeen) / 3_600_000;
  const elapsed = hours < 1 ? `${Math.max(1, Math.round(hours * 60))}m` : `${Math.round(hours)}h`;
  const founder = getById("founders", opp.founderId);
  logEvent(
    "decision.made",
    `Decision for ${founder?.name ?? "founder"}: ${verdict.toUpperCase()} (${elapsed} from first signal to decision)`,
    { founderId: opp.founderId, opportunityId }
  );
  return NextResponse.json({
    opportunity: updated,
    hoursToDecision: Math.round(hours * 100) / 100,
    elapsed,
  });
}
