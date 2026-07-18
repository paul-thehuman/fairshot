import { getAll } from "@/lib/store";
import { loadThesis } from "@/lib/thesis";
import type { OppStatus, SignalSource } from "@/lib/types";
import ScanButton from "./scan-button";

export const dynamic = "force-dynamic";

const COLUMNS: { status: OppStatus; label: string; hint: string }[] = [
  { status: "sourced", label: "Sourced", hint: "Found, not yet screened" },
  { status: "screened", label: "Screened", hint: "Thesis fit + conviction scored" },
  { status: "interview", label: "Interview", hint: "Capability interview open" },
  { status: "diligence", label: "Diligence", hint: "Evidence and memo in progress" },
  { status: "decision", label: "Decision", hint: "Invest, pass, or watch" },
];

const SOURCE_BADGE: Record<SignalSource, string> = {
  github: "GitHub",
  hackernews: "HN",
  arxiv: "arXiv",
  hackathon: "Hackathon",
  accelerator: "Accelerator",
  application: "Applied",
  interview: "Interview",
};

export default async function PipelinePage() {
  const thesis = loadThesis();
  const opportunities = getAll("opportunities");
  const founders = new Map(getAll("founders").map((f) => [f.id, f]));
  const ventures = new Map(getAll("ventures").map((v) => [v.id, v]));
  const signals = getAll("signals");
  const interviews = getAll("interviews");
  const founderScores = new Map(
    getAll("founderScores").map((s) => [s.founderId, s])
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            One funnel, two doors
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Pipeline</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Outbound discoveries and inbound applications, screened the same way.
            Conviction ≥ {thesis.convictionThreshold} triggers an interview invitation.
          </p>
        </div>
        <ScanButton />
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {COLUMNS.map((col) => {
          const cards = opportunities
            .filter((o) => o.status === col.status)
            .sort((a, b) => (b.convictionScore ?? -1) - (a.convictionScore ?? -1));
          return (
            <section key={col.status}>
              <h2 className="mb-1 text-sm font-semibold">
                {col.label}{" "}
                <span className="font-normal text-neutral-400">({cards.length})</span>
              </h2>
              <p className="mb-3 text-xs text-neutral-500">{col.hint}</p>
              <div className="space-y-3">
                {cards.map((opp) => {
                  const founder = founders.get(opp.founderId);
                  const venture = ventures.get(opp.ventureId);
                  const sources = [
                    ...new Set(
                      signals
                        .filter((s) => s.founderId === opp.founderId)
                        .map((s) => s.source)
                    ),
                  ];
                  const score = founderScores.get(opp.founderId);
                  const invited = interviews.some(
                    (i) => i.opportunityId === opp.id && i.status !== "complete"
                  );
                  return (
                    <article
                      key={opp.id}
                      className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800"
                    >
                      <p className="font-medium">
                        {founder?.name ?? "Unknown"}
                        {founder?.synthetic && (
                          <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 align-middle text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                            Synthetic
                          </span>
                        )}
                      </p>
                      <p className="text-neutral-600 dark:text-neutral-400">
                        {venture?.name}
                        {venture?.oneLiner ? ` — ${venture.oneLiner.slice(0, 70)}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {sources.map((s) => (
                          <span
                            key={s}
                            className="rounded-full border border-neutral-300 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500 dark:border-neutral-700"
                          >
                            {SOURCE_BADGE[s]}
                          </span>
                        ))}
                        {invited && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                            Interview invited
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex gap-4 text-xs text-neutral-500">
                        <span>
                          Conviction:{" "}
                          <strong className="text-neutral-700 dark:text-neutral-300">
                            {opp.convictionScore ?? "—"}
                          </strong>
                        </span>
                        <span>
                          Founder score:{" "}
                          <strong className="text-neutral-700 dark:text-neutral-300">
                            {score?.score ?? "—"}
                          </strong>
                        </span>
                      </div>
                      {opp.convictionRationale && (
                        <p className="mt-2 text-xs text-neutral-500">
                          {opp.convictionRationale}
                        </p>
                      )}
                    </article>
                  );
                })}
                {cards.length === 0 && (
                  <p className="rounded-lg border border-dashed border-neutral-200 p-3 text-xs text-neutral-400 dark:border-neutral-800">
                    Empty
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
