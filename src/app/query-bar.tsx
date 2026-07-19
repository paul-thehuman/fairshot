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
          className="nb-input flex-1 text-sm"
          placeholder='Ask in plain English: "technical founder, Europe, AI infra, no prior VC backing"'
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="submit"
          disabled={running || !q.trim()}
          className="nb-btn nb-btn-primary text-sm"
        >
          {running ? "Searching…" : "Search"}
        </button>
      </form>
      {interpretation && (
        <p className="mt-2 text-xs text-muted">Understood as: {interpretation}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {results && (
        <div className="mt-4 space-y-2">
          {results.map((r) => (
            <a
              key={r.founderId}
              href={r.opportunityId ? `/memo/${r.opportunityId}` : "#"}
              className="nb-card-flat block p-3 text-sm transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-baseline justify-between">
                <p className="font-medium">
                  {r.name}
                  {r.synthetic && (
                    <span className="nb-badge nb-badge-purple ml-1.5">Synthetic</span>
                  )}
                  {r.venture && <span className="text-muted"> · {r.venture}</span>}
                </p>
                <p className="text-xs text-muted">
                  Score {r.founderScore ?? "—"} · Conviction {r.conviction ?? "—"}
                </p>
              </div>
              <p className="mt-0.5 text-muted">{r.oneLiner.slice(0, 110)}</p>
              <p className="mt-1 text-xs text-muted">
                Matched: {r.matchedBecause.join(" · ") || "all criteria"}
              </p>
            </a>
          ))}
          {results.length === 0 && (
            <p className="nb-card-flat nb-dashed p-3 text-sm text-muted">
              No founders in Memory match every stated criterion. FairShot does not
              pad results.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
