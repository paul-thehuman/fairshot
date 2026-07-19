"use client";

// Voice I/O helpers for the interview page. Output: ElevenLabs TTS via our
// /api/tts route. Input: the browser's built-in speech recognition (Chrome),
// so founders can simply talk. Both degrade silently to text.

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

export function speechRecognitionAvailable(): boolean {
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

// Keeps listening through natural pauses: founders think before they speak,
// and the browser's recognizer loves to give up at the first silence. We run
// in continuous mode and silently restart whenever the browser ends a
// session, accumulating the transcript until the user presses stop.
export function listenContinuous(
  onTranscript: (text: string) => void,
  onDone: () => void
): (() => void) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;

  let stopped = false;
  let bankedText = "";
  let sessionText = "";
  let recognition: RecognitionLike | null = null;

  const attach = () => {
    recognition = new Ctor();
    recognition.lang = "en-GB";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      sessionText = Array.from(
        { length: e.results.length },
        (_, i) => e.results[i][0].transcript
      ).join(" ");
      onTranscript(`${bankedText} ${sessionText}`.replace(/\s+/g, " ").trim());
    };
    recognition.onerror = null;
    recognition.onend = () => {
      bankedText = `${bankedText} ${sessionText}`.replace(/\s+/g, " ").trim();
      sessionText = "";
      if (stopped) {
        onDone();
        return;
      }
      try {
        attach();
      } catch {
        onDone();
      }
    };
    recognition.start();
  };

  attach();
  return () => {
    stopped = true;
    recognition?.stop();
  };
}

// One reused <audio> element for all speech. Browsers only allow programmatic
// playback on an element a user gesture has already "blessed". Creating a fresh
// Audio() per utterance (as before) loses that blessing, so the first spoken
// turn, played ~2s after the click once TTS returns, is blocked with
// NotAllowedError. That rejection flips voice off and reads as "audio comes
// back but nothing plays". Reusing one blessed element fixes it.
let audioEl: HTMLAudioElement | null = null;
let lastObjectUrl: string | null = null;

function getEl(): HTMLAudioElement {
  if (!audioEl) audioEl = new Audio();
  return audioEl;
}

// A 48-byte silent 8-bit WAV, built once. Playing it inside a click handler
// blesses the shared element so later, network-delayed TTS playback is allowed.
const SILENT_WAV = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x28, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
  0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x40, 0x1f, 0x00, 0x00, 0x40, 0x1f, 0x00, 0x00, 0x01, 0x00, 0x08, 0x00,
  0x64, 0x61, 0x74, 0x61, 0x04, 0x00, 0x00, 0x00, 0x80, 0x80, 0x80, 0x80,
]);
const SILENT_URL =
  typeof window !== "undefined"
    ? URL.createObjectURL(new Blob([SILENT_WAV], { type: "audio/wav" }))
    : "";

// MUST be called synchronously inside a user gesture (click). Idempotent and
// safe to call repeatedly; it just (re)blesses the shared element.
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  const el = getEl();
  try {
    el.muted = true;
    el.src = SILENT_URL;
    const p = el.play();
    if (p)
      p.then(() => {
        el.pause();
        el.muted = false;
      }).catch(() => {
        el.muted = false;
      });
    else el.muted = false;
  } catch {
    el.muted = false;
  }
}

export async function speak(text: string): Promise<void> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("voice unavailable");
  const blob = await res.blob();
  const el = getEl();
  el.pause();
  if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
  lastObjectUrl = URL.createObjectURL(blob);
  el.src = lastObjectUrl;
  await el.play();
}

export function stopSpeaking(): void {
  audioEl?.pause();
}
