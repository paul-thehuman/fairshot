import { NextResponse } from "next/server";
import { seedUniverse } from "@/lib/seed/universe";

export async function POST() {
  const counts = seedUniverse();
  return NextResponse.json({ ok: true, counts });
}
