"use client";

import { useState } from "react";

interface QueryResult {
  founderId: string;
  opportunityId: string | null;
  name: string;
  synthetic: boolean;
  venture: string | null;
  oneLiner: string;
  status: string | null;
  conviction: number | null;
  founderScore: number | null;
  matchedBecause: string[];
}

export default function QueryBar() {
  const [q, setQ] = useState("");
  const [running, setRunning] = useState(false);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [results, setResults] = useState<QueryResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Query failed");
      setInterpretation(data.interpretation);
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="mb-8">
      <form onSubmit={search} className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2.5 text-sm dark:border-neutral-700"
          placeholder='Ask in plain English: "technical founder, Europe, AI infra, no prior VC backing"'
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="submit"
          disabled={running || !q.trim()}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {running ? "Searching…" : "Search"}
        </button>
      </form>
      {interpretation && (
        <p className="mt-2 text-xs text-neutral-500">Understood as: {interpretation}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {results && (
        <div className="mt-4 space-y-2">
          {results.map((r) => (
            <a
              key={r.founderId}
              href={r.opportunityId ? `/memo/${r.opportunityId}` : "#"}
              className="block rounded-lg border border-neutral-200 p-3 text-sm transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
            >
              <div className="flex items-baseline justify-between">
                <p className="font-medium">
                  {r.name}
                  {r.synthetic && (
                    <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                      Synthetic
                    </span>
                  )}
                  {r.venture && (
                    <span className="text-neutral-500"> · {r.venture}</span>
                  )}
                </p>
                <p className="text-xs text-neutral-500">
                  Score {r.founderScore ?? "—"} · Conviction {r.conviction ?? "—"}
                </p>
              </div>
              <p className="mt-0.5 text-neutral-600 dark:text-neutral-400">
                {r.oneLiner.slice(0, 110)}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Matched: {r.matchedBecause.join(" · ") || "all criteria"}
              </p>
            </a>
          ))}
          {results.length === 0 && (
            <p className="rounded-lg border border-dashed border-neutral-200 p-3 text-sm text-neutral-400 dark:border-neutral-800">
              No founders in Memory match every stated criterion. FairShot does not
              pad results.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
