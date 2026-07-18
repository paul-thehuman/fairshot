import { NextResponse } from "next/server";
import { assertAssessable } from "@/lib/capability";
import { generateMemo } from "@/lib/memo";
import { scoreAxes } from "@/lib/screening";
import { getById } from "@/lib/store";

// Runs diligence for an opportunity: three-axis screening, then the memo.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  const { opportunityId } = await params;
  const opp = getById("opportunities", opportunityId);
  if (!opp) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }
  try {
    assertAssessable(opp.founderId);
    await scoreAxes(opportunityId);
    const memo = await generateMemo(opportunityId);
    return NextResponse.json({ memo });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Diligence failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
