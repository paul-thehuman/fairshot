import { NextResponse } from "next/server";

// Voice for the Socratic interview: ElevenLabs speaks the agent's turns.
// The interview brain stays ours; this is output only.
export async function POST(req: Request) {
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Voice unavailable: ELEVENLABS_API_KEY not set" },
      { status: 503 }
    );
  }
  const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" }),
      signal: AbortSignal.timeout(20_000),
    }
  );
  if (!res.ok || !res.body) {
    return NextResponse.json(
      { error: `Voice synthesis failed (${res.status})` },
      { status: 502 }
    );
  }
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg" } });
}
