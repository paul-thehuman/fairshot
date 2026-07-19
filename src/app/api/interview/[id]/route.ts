import { NextResponse } from "next/server";
import { nextTurn, startInterview } from "@/lib/interview/conduct";
import { buildBrief } from "@/lib/interview/brief";
import { getAll, getById } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function interviewPayload(id: string) {
  const interview = getById("interviews", id);
  if (!interview) return null;
  const founder = getById("founders", interview.founderId);
  const venture = getAll("ventures").find(
    (v) => v.founderId === interview.founderId
  );
  return {
    interview,
    founder: founder
      ? { name: founder.name, synthetic: founder.synthetic ?? false }
      : null,
    venture: venture ? { name: venture.name } : null,
    brief: buildBrief(interview),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = getById("interviews", id);
  if (!existing) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }
  if (existing.status === "invited") {
    try {
      await startInterview(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Planner failed";
      return NextResponse.json(
        { error: `The interview planner is unavailable: ${message}` },
        { status: 503 }
      );
    }
  }
  return NextResponse.json(interviewPayload(id));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  try {
    await nextTurn(id, message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Interview turn failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json(interviewPayload(id));
}
