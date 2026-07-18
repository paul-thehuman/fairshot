"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import type { FounderFeedback, Interview } from "@/lib/types";
import { listenContinuous, speak, speechRecognitionAvailable, stopSpeaking } from "./voice";

interface Payload {
  interview: Interview;
  founder: { name: string; synthetic: boolean } | null;
  venture: { name: string } | null;
}

export default function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [micAvailable, setMicAvailable] = useState(false);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const spokenCountRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMicAvailable(speechRecognitionAvailable());
    return () => stopSpeaking();
  }, []);

  const speakLatest = useCallback((turns: Interview["turns"]) => {
    const agentTurns = turns.filter((t) => t.role === "agent");
    if (agentTurns.length === 0 || agentTurns.length === spokenCountRef.current) return;
    spokenCountRef.current = agentTurns.length;
    speak(agentTurns[agentTurns.length - 1].text).catch(() => setVoiceOn(false));
  }, []);

  useEffect(() => {
    if (voiceOn && payload) speakLatest(payload.interview.turns);
  }, [voiceOn, payload, speakLatest]);

  function toggleMic() {
    if (listening) {
      stopListeningRef.current?.();
      setListening(false);
      return;
    }
    stopSpeaking();
    const stop = listenContinuous(
      (transcript) => setDraft(transcript),
      () => setListening(false)
    );
    if (stop) {
      stopListeningRef.current = stop;
      setListening(true);
    }
  }

  useEffect(() => {
    fetch(`/api/interview/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Could not load interview");
        setPayload(data);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [payload?.interview.turns.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    stopListeningRef.current?.();
    setListening(false);
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/interview/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send answer");
      setPayload(data);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send answer");
    } finally {
      setSending(false);
    }
  }

  if (error && !payload) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-12">
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </p>
      </main>
    );
  }
  if (!payload) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-12">
        Preparing your interview… the interviewer is reading your evidence first.
      </main>
    );
  }

  const { interview, founder, venture } = payload;
  const complete = interview.status === "complete";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
      <header className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Capability interview
        </p>
        <h1 className="mt-1 text-xl font-semibold">
          {founder?.name}
          {venture ? ` · ${venture.name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          A short conversation about things you&rsquo;ve actually done. Honest
          feedback at the end, whatever the outcome.
        </p>
        {!complete && (
          <button
            type="button"
            onClick={() => {
              if (voiceOn) stopSpeaking();
              else spokenCountRef.current = 0;
              setVoiceOn(!voiceOn);
            }}
            className={`mt-3 rounded-md border px-3 py-1.5 text-sm ${
              voiceOn
                ? "border-emerald-400 text-emerald-700 dark:text-emerald-400"
                : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
            }`}
          >
            {voiceOn ? "🔊 Voice on — the interviewer speaks" : "🔈 Turn on voice interview"}
          </button>
        )}
      </header>

      <div className="flex-1 space-y-3">
        {interview.turns.map((turn, i) => (
          <div
            key={i}
            className={
              turn.role === "agent"
                ? "max-w-[85%] rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800"
                : "ml-auto max-w-[85%] rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-900"
            }
          >
            {turn.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {!complete && (
        <form onSubmit={send} className="mt-6 flex gap-2">
          <textarea
            rows={3}
            className="flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              listening
                ? "Listening… speak your answer"
                : "Answer in your own words. Specifics beat polish."
            }
            disabled={sending}
          />
          {micAvailable && (
            <button
              type="button"
              onClick={toggleMic}
              disabled={sending}
              title={listening ? "Stop listening" : "Answer by voice"}
              className={`self-end rounded-md border px-3 py-2 text-sm ${
                listening
                  ? "animate-pulse border-red-400 text-red-600"
                  : "border-neutral-300 dark:border-neutral-700"
              }`}
            >
              {listening ? "⏹" : "🎙"}
            </button>
          )}
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="self-end rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {sending ? "…" : "Send"}
          </button>
        </form>
      )}
      {error && payload && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      {complete && (
        <FeedbackCard feedback={interview.feedback} />
      )}
    </main>
  );
}

function FeedbackCard({ feedback }: { feedback?: FounderFeedback }) {
  if (!feedback) {
    return (
      <div className="mt-8 rounded-lg border border-neutral-200 p-5 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        Interview complete. Your evidence is being reviewed; feedback will appear
        on this page.
      </div>
    );
  }
  return (
    <div className="mt-8 space-y-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <div>
        <h2 className="font-semibold">What we saw</h2>
        <p className="text-sm text-neutral-500">
          The same evidence the investor sees. Yours to keep, whatever happens.
        </p>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          Strengths
        </h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {feedback.strengths.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          Where evidence was thin
        </h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {feedback.thinEvidence.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold">What would strengthen a future application</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {feedback.nextSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
