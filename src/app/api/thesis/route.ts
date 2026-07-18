import { NextResponse } from "next/server";
import { loadThesis, saveThesis } from "@/lib/thesis";
import type { Thesis } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(loadThesis());
}

export async function PUT(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return NextResponse.json(saveThesis(body as Partial<Thesis>));
}
