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

let currentAudio: HTMLAudioElement | null = null;

export async function speak(text: string): Promise<void> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("voice unavailable");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  currentAudio?.pause();
  currentAudio = new Audio(url);
  await currentAudio.play();
}

export function stopSpeaking(): void {
  currentAudio?.pause();
  currentAudio = null;
}
