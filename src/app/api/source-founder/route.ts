import { NextResponse } from "next/server";

export const maxDuration = 300;
import { sourceFounderByGithub } from "@/lib/sourceFounder";

export async function POST(req: Request) {
  let body: { github?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const handle = (body.github ?? "").trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9-]{1,39}$/.test(handle)) {
    return NextResponse.json({ error: "Provide a valid GitHub handle" }, { status: 400 });
  }
  try {
    const result = await sourceFounderByGithub(handle);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sourcing failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
