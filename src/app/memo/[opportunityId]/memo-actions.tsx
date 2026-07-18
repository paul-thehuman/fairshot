"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateMemoButton({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/diligence/${opportunityId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Diligence failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diligence failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={run}
        disabled={running}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {running ? "Scoring axes and drafting memo…" : "Run diligence: score axes + draft memo"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function DecisionButtons({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(verdict: "invest" | "pass" | "watch") {
    setBusy(verdict);
    setError(null);
    try {
      const res = await fetch("/api/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, verdict }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Decision failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={() => decide("invest")}
          disabled={busy !== null}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy === "invest" ? "…" : "Invest $100K"}
        </button>
        <button
          onClick={() => decide("watch")}
          disabled={busy !== null}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
        >
          {busy === "watch" ? "…" : "Watch"}
        </button>
        <button
          onClick={() => decide("pass")}
          disabled={busy !== null}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
        >
          {busy === "pass" ? "…" : "Pass"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
