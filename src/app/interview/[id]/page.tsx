"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import type { FounderFeedback, Interview, InterviewBrief, TurnCheck } from "@/lib/types";
import { listenContinuous, speak, speechRecognitionAvailable, stopSpeaking } from "./voice";

interface Payload {
  interview: Interview;
  founder: { name: string; synthetic: boolean } | null;
  venture: { name: string } | null;
  brief: InterviewBrief | null;
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
  // The founder reads the pre-interview brief first; the conversation is
  // revealed only when they say they're ready. A resumed or finished
  // interview skips the brief.
  const [ready, setReady] = useState(false);
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
    if (voiceOn && ready && payload) speakLatest(payload.interview.turns);
  }, [voiceOn, ready, payload, speakLatest]);

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
        const data = (await r.json()) as Payload;
        if (!r.ok) throw new Error((data as { error?: string }).error || "Could not load interview");
        setPayload(data);
        // Skip the brief for a finished interview or one already under way,
        // so a reload never throws the founder back to the start screen.
        const resumed =
          data.interview.status === "complete" ||
          data.interview.turns.some((t) => t.role === "founder") ||
          !data.brief;
        if (resumed) setReady(true);
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

  const { interview, founder, venture, brief } = payload;
  const complete = interview.status === "complete";
  const showBrief = !complete && !ready && !!brief && brief.focusAreas.length > 0;

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

      {showBrief && brief ? (
        <PreInterviewBrief
          brief={brief}
          firstName={(founder?.name ?? "there").split(" ")[0]}
          onReady={() => setReady(true)}
        />
      ) : (
        <>
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
                {turn.check && <CheckChip check={turn.check} />}
              </div>
            ))}
            {sending && (
              <div className="max-w-[85%] animate-pulse rounded-lg border border-dashed border-neutral-300 p-3 text-sm text-neutral-500 dark:border-neutral-700">
                🔍 Checking what you said against public sources…
              </div>
            )}
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

          {complete && <FeedbackCard feedback={interview.feedback} />}
        </>
      )}
    </main>
  );
}

// The live fact-check performed on the founder's previous answer, rendered on
// the interviewer's reply. The source link is only ever a URL the evidence
// engine actually retrieved.
function CheckChip({ check }: { check: TurnCheck }) {
  const style =
    check.grade === "corroborated"
      ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
      : "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400";
  const label =
    check.grade === "corroborated"
      ? "Corroborated"
      : check.grade === "weak_signal"
        ? "Weak public signal"
        : "No public record found";
  return (
    <div
      className={`mt-2 rounded-md border border-dashed px-2.5 py-1.5 text-xs ${style}`}
    >
      <span className="font-medium">🔍 Checked while you spoke:</span>{" "}
      &ldquo;{check.claim}&rdquo; — {label}
      {check.sourceUrl && (
        <>
          {" · "}
          <a
            href={check.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {check.sourceTitle || "source"}
          </a>
        </>
      )}
    </div>
  );
}

function PreInterviewBrief({
  brief,
  firstName,
  onReady,
}: {
  brief: InterviewBrief;
  firstName: string;
  onReady: () => void;
}) {
  return (
    <div className="flex-1">
      <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-semibold">Before we start, {firstName}</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {brief.hasPublicEvidence
            ? "We've read what's public about you already. This short conversation is to fill the gaps a web search can't reach, so it helps to have a few specifics to hand."
            : "There's no public track record to go on yet, so this conversation is where your story gets told. That is not a mark against you, it just means the detail matters more."}
        </p>

        <section className="mt-5">
          <h3 className="text-sm font-semibold">What we&rsquo;ll dig into</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {brief.focusAreas.map((area) => (
              <li key={area.trait}>
                <span className="font-medium">{area.label}.</span>{" "}
                <span className="text-neutral-600 dark:text-neutral-400">{area.why}</span>
              </li>
            ))}
          </ul>
        </section>

        {brief.couldNotVerify.length > 0 && (
          <section className="mt-5">
            <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              You told us this, and we couldn&rsquo;t confirm it
            </h3>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              If you can back any of these up, have it ready. We never hold
              missing evidence against you; evidence we can check just earns more
              confidence.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {brief.couldNotVerify.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-5">
          <h3 className="text-sm font-semibold">Worth having to hand</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {brief.bringThese.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>

        <button
          type="button"
          onClick={onReady}
          className="mt-6 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          I&rsquo;m ready, start the interview
        </button>
        <p className="mt-2 text-xs text-neutral-500">
          Take your time. Nothing is timed, and there are no wrong answers.
        </p>
      </div>
    </div>
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
