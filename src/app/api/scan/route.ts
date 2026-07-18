import { NextResponse } from "next/server";
import { runScan } from "@/lib/pipeline";

export async function POST() {
  try {
    const report = await runScan();
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
