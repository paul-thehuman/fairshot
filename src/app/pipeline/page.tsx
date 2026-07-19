import { getAll } from "@/lib/store";
import { loadThesis } from "@/lib/thesis";
import type { OppStatus, SignalSource } from "@/lib/types";
import ScanButton from "./scan-button";
import SourceInput from "./source-input";

export const dynamic = "force-dynamic";

const COLUMNS: { status: OppStatus; label: string; hint: string; accent: string }[] = [
  { status: "sourced", label: "Sourced", hint: "Found, not yet screened", accent: "var(--color-slate)" },
  { status: "screened", label: "Screened", hint: "Thesis fit + conviction scored", accent: "var(--color-purple)" },
  { status: "interview", label: "Interview", hint: "Capability interview open", accent: "var(--color-main)" },
  { status: "diligence", label: "Diligence", hint: "Evidence and memo in progress", accent: "var(--color-warning)" },
  { status: "decision", label: "Decision", hint: "Invest, pass, or watch", accent: "var(--color-teal)" },
];

const SOURCE_BADGE: Record<SignalSource, string> = {
  github: "GitHub",
  hackernews: "HN",
  arxiv: "arXiv",
  hackathon: "Hackathon",
  accelerator: "Accelerator",
  application: "Applied",
  interview: "Interview",
  web: "Web",
  publication: "Writing",
  founder_supplied: "Shared",
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
          <p className="text-sm font-bold uppercase tracking-wide text-[var(--color-main)]">
            One funnel, two doors
          </p>
          <h1 className="mt-1 text-3xl">Pipeline</h1>
          <p className="mt-1 text-sm text-muted">
            Outbound discoveries and inbound applications, screened the same way.
            Conviction ≥ {thesis.convictionThreshold} triggers an interview invitation.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <ScanButton />
          <SourceInput />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {COLUMNS.map((col) => {
          const cards = opportunities
            .filter((o) => o.status === col.status)
            .sort((a, b) => (b.convictionScore ?? -1) - (a.convictionScore ?? -1));
          return (
            <section key={col.status}>
              <div
                className="mb-2 h-2 rounded-[2px] border-2 border-[var(--color-border)]"
                style={{ background: col.accent }}
              />
              <h2 className="mb-1 text-sm font-bold">
                {col.label}{" "}
                <span className="font-normal text-muted">({cards.length})</span>
              </h2>
              <p className="mb-3 text-xs text-muted">{col.hint}</p>
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
                    <a key={opp.id} href={`/memo/${opp.id}`} className="block">
                    <article className="nb-card-flat p-3 text-sm transition-transform hover:-translate-y-0.5">
                      <p className="font-semibold">
                        {founder?.name ?? "Unknown"}
                        {founder?.synthetic && (
                          <span className="nb-badge nb-badge-purple ml-1.5 align-middle">
                            Synthetic
                          </span>
                        )}
                      </p>
                      <p className="text-muted">
                        {venture?.name}
                        {venture?.oneLiner ? ` — ${venture.oneLiner.slice(0, 70)}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {sources.map((s) => (
                          <span key={s} className="nb-badge uppercase tracking-wide">
                            {SOURCE_BADGE[s]}
                          </span>
                        ))}
                        {invited && (
                          <span className="nb-badge nb-badge-warning">
                            Interview invited
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex gap-4 text-xs text-muted">
                        <span>
                          Conviction: <strong>{opp.convictionScore ?? "—"}</strong>
                        </span>
                        <span>
                          Founder score: <strong>{score?.score ?? "—"}</strong>
                        </span>
                      </div>
                      {opp.convictionRationale && (
                        <p className="mt-2 text-xs text-muted">
                          {opp.convictionRationale}
                        </p>
                      )}
                    </article>
                    </a>
                  );
                })}
                {cards.length === 0 && (
                  <p className="nb-card-flat nb-dashed p-3 text-xs text-muted">
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
