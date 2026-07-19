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
        <p className="rounded-[5px] border-2 border-[var(--color-error)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-error)]">
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
        <p className="text-sm font-bold uppercase tracking-wide text-[var(--color-main)]">
          Capability interview
        </p>
        <h1 className="mt-1 text-2xl">
          {founder?.name}
          {venture ? ` · ${venture.name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted">
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
            className={`nb-btn nb-btn-sm mt-3 ${voiceOn ? "nb-btn-teal" : ""}`}
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
                    ? "nb-card-flat max-w-[85%] p-3 text-sm"
                    : "ml-auto max-w-[85%] rounded-[5px] border-2 border-[var(--color-border)] bg-[var(--color-main)] p-3 text-sm text-black"
                }
              >
                {turn.text}
                {turn.check && <CheckChip check={turn.check} />}
              </div>
            ))}
            {sending && (
              <div className="max-w-[85%] animate-pulse rounded-[5px] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-muted">
                🔍 Checking what you said against public sources…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {!complete && (
            <form onSubmit={send} className="mt-6 flex gap-2">
              <textarea
                rows={3}
                className="nb-input flex-1 text-sm"
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
                  className={`nb-btn nb-btn-sm self-end ${
                    listening ? "nb-btn-danger animate-pulse" : ""
                  }`}
                >
                  {listening ? "⏹" : "🎙"}
                </button>
              )}
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="nb-btn nb-btn-primary self-end text-sm"
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
      ? "bg-[var(--color-teal)] text-black"
      : check.grade === "weak_signal"
        ? "bg-[var(--color-warning)] text-black"
        : "bg-[var(--color-background)]";
  const label =
    check.grade === "corroborated"
      ? "Corroborated"
      : check.grade === "weak_signal"
        ? "Weak public signal"
        : "No public record found";
  return (
    <div
      className={`mt-2 rounded-[5px] border-2 border-[var(--color-border)] px-2.5 py-1.5 text-xs ${style}`}
    >
      <span className="font-bold">🔍 Checked while you spoke:</span>{" "}
      &ldquo;{check.claim}&rdquo; — <span className="font-bold">{label}</span>
      {check.sourceUrl && (
        <>
          {" · "}
          <a
            href={check.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline"
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
      <div className="nb-card p-5">
        <h2 className="text-lg">Before we start, {firstName}</h2>
        <p className="mt-1 text-sm text-muted">
          {brief.hasPublicEvidence
            ? "We've read what's public about you already. This short conversation is to fill the gaps a web search can't reach, so it helps to have a few specifics to hand."
            : "There's no public track record to go on yet, so this conversation is where your story gets told. That is not a mark against you, it just means the detail matters more."}
        </p>

        <section className="mt-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-purple)]">
            What we&rsquo;ll dig into
          </h3>
          <ul className="mt-2 space-y-2 text-sm">
            {brief.focusAreas.map((area) => (
              <li key={area.trait}>
                <span className="font-semibold">{area.label}.</span>{" "}
                <span className="text-muted">{area.why}</span>
              </li>
            ))}
          </ul>
        </section>

        {brief.couldNotVerify.length > 0 && (
          <section className="mt-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-main)]">
              You told us this, and we couldn&rsquo;t confirm it
            </h3>
            <p className="mt-1 text-sm text-muted">
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
          <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-teal)]">
            Worth having to hand
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {brief.bringThese.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>

        <button type="button" onClick={onReady} className="nb-btn nb-btn-primary mt-6 text-sm">
          I&rsquo;m ready, start the interview
        </button>
        <p className="mt-2 text-xs text-muted">
          Take your time. Nothing is timed, and there are no wrong answers.
        </p>
      </div>
    </div>
  );
}

function FeedbackCard({ feedback }: { feedback?: FounderFeedback }) {
  if (!feedback) {
    return (
      <div className="nb-card-flat mt-8 p-5 text-sm text-muted">
        Interview complete. Your evidence is being reviewed; feedback will appear
        on this page.
      </div>
    );
  }
  return (
    <div className="nb-card mt-8 space-y-4 p-5">
      <div>
        <h2 className="text-lg">What we saw</h2>
        <p className="text-sm text-muted">
          The same evidence the investor sees. Yours to keep, whatever happens.
        </p>
      </div>
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-teal)]">
          Strengths
        </h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {feedback.strengths.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-main)]">
          Where evidence was thin
        </h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {feedback.thinEvidence.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-purple)]">
          What would strengthen a future application
        </h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {feedback.nextSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
