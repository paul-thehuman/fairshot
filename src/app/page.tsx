"use client";

import { useState } from "react";
import type { FounderScoreResult, Grade } from "@/lib/types";

const GRADE_STYLE: Record<Grade, string> = {
  corroborated: "bg-emerald-100 text-emerald-800 border-emerald-300",
  weak_signal: "bg-amber-100 text-amber-800 border-amber-300",
  unverifiable: "bg-neutral-100 text-neutral-600 border-neutral-300",
};

const GRADE_LABEL: Record<Grade, string> = {
  corroborated: "Corroborated",
  weak_signal: "Weak signal",
  unverifiable: "Unverifiable",
};

export default function Home() {
  const [name, setName] = useState("");
  const [pitch, setPitch] = useState("");
  const [links, setLinks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FounderScoreResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          pitch,
          links: links.split("\n").filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-10">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          VC Brain
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          Apply for your first $100K the way you&rsquo;d apply for a credit
          card.
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          No gatekeeper, no network required. Every claim you make gets
          checked against real evidence, not vibes.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="name">
            Founder name
          </label>
          <input
            id="name"
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="pitch">
            Tell us what you&rsquo;ve built and who you are. Be specific.
          </label>
          <textarea
            id="pitch"
            rows={6}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            placeholder="e.g. I've spent 20 years leading learning and development teams, and this year I've shipped three AI products solo, including an e-learning authoring tool used by..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="links">
            Public links (one per line: GitHub, product URL, press, LinkedIn)
          </label>
          <textarea
            id="links"
            rows={3}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2"
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder={"https://github.com/...\nhttps://yourproduct.com"}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 font-medium disabled:opacity-50"
        >
          {loading ? "Checking the evidence…" : "Score this founder"}
        </button>
      </form>

      {error && (
        <p className="mt-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </p>
      )}

      {result && (
        <section className="mt-10 space-y-8">
          <div className="rounded-lg border border-neutral-300 dark:border-neutral-700 p-6">
            <p className="text-sm text-neutral-500">Founder score</p>
            <p className="mt-1 text-4xl font-semibold">{result.score.pct}</p>
            <p className="mt-1 font-medium">{result.score.band}</p>
            <p className="mt-2 text-sm text-neutral-500">
              Computed from the claims below, not asserted independently.
              Evidence graded via {result.provider}, searched via Tavily.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Claims and evidence</h2>
            <ul className="space-y-4">
              {result.claims.map((claim) => (
                <li
                  key={claim.id}
                  className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{claim.text}</p>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${GRADE_STYLE[claim.grade]}`}
                    >
                      {GRADE_LABEL[claim.grade]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                    {claim.category}
                  </p>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    {claim.reasoning}
                  </p>
                  {claim.sources.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {claim.sources.map((s) => (
                        <li key={s.url}>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {s.title || s.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-neutral-300 dark:border-neutral-700 p-6">
            <h2 className="font-semibold">What this score deliberately ignores</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              This score is built only from evidence tied to specific claims.
              It deliberately does not use:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
              {result.fairnessExclusions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
