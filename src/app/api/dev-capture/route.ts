import { NextResponse } from "next/server";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

// Dev-only utility: the browser posts its rendered DOM here so screens can be
// exported to a Claude Design project. Not part of the product; disabled in
// production builds.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const { name, html } = (await req.json()) as { name?: string; html?: string };
  if (!name || !html || !/^[a-z0-9-]+$/.test(name)) {
    return NextResponse.json({ error: "name and html required" }, { status: 400 });
  }
  const dir = join(process.cwd(), "design-export");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.raw.html`), html, "utf8");
  return NextResponse.json({ ok: true, bytes: html.length });
}
