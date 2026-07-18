import { getAll, getById } from "@/lib/store";
import type { Grade } from "@/lib/types";
import { DecisionButtons, GenerateMemoButton } from "./memo-actions";

export const dynamic = "force-dynamic";

const GRADE_STYLE: Record<Grade | "ungraded", string> = {
  corroborated: "bg-emerald-100 text-emerald-800 border-emerald-300",
  weak_signal: "bg-amber-100 text-amber-800 border-amber-300",
  unverifiable: "bg-neutral-100 text-neutral-600 border-neutral-300",
  ungraded: "bg-neutral-100 text-neutral-500 border-neutral-300",
};

export default async function MemoPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const opp = getById("opportunities", opportunityId);
  if (!opp) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        Opportunity not found.
      </main>
    );
  }
  const founder = getById("founders", opp.founderId);
  const venture = getById("ventures", opp.ventureId);
  const memo = getById("memos", opportunityId);
  const axes = getAll("axisScores").filter((a) => a.opportunityId === opportunityId);
  const traits = getAll("traitScores").filter((t) => t.opportunityId === opportunityId);
  const claims = getAll("claims").filter((c) => c.founderId === opp.founderId);
  const founderScore = getById("founderScores", opp.founderId);
  const interview = getAll("interviews").find((i) => i.opportunityId === opportunityId);

  const traitLabel = (t: string) => t.replace("_", " ");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Investment memo
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          {founder?.name}
          {venture ? ` · ${venture.name}` : ""}
          {founder?.synthetic && (
            <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 align-middle text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              Synthetic demo profile
            </span>
          )}
        </h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          {venture?.oneLiner}
        </p>
        <div className="mt-2 flex gap-4 text-sm text-neutral-500">
          <span>
            Founder score:{" "}
            <strong className="text-neutral-700 dark:text-neutral-300">
              {founderScore?.score ?? "—"}
            </strong>
          </span>
          <span>
            Conviction: <strong className="text-neutral-700 dark:text-neutral-300">{opp.convictionScore ?? "—"}</strong>
          </span>
          <span>
            Status: <strong className="text-neutral-700 dark:text-neutral-300">{opp.status}{opp.decision ? ` · ${opp.decision.toUpperCase()}` : ""}</strong>
          </span>
        </div>
      </header>

      {/* Three axes, never averaged */}
      {axes.length > 0 && (
        <section className="mb-8 grid gap-3 md:grid-cols-3">
          {axes.map((axis) => (
            <div
              key={axis.id}
              className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {axis.axis === "idea_market" ? "Idea vs market" : axis.axis}
              </p>
              <p className="mt-1 font-semibold">{axis.rating}</p>
              <p className="text-xs text-neutral-500">
                Trend: {axis.trend}
              </p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {axis.rationale}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Capability panel: the Founder axis in detail */}
      {traits.length > 0 && (
        <section className="mb-8 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="font-semibold">Capability assessment</h2>
          <p className="text-sm text-neutral-500">
            Four traits from high-potential talent assessment. Every score cites
            the evidence behind it; &ldquo;insufficient&rdquo; is an honest answer, not a failure.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {traits.map((t) => (
              <div key={t.id} className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="flex items-baseline justify-between">
                  <p className="font-medium capitalize">{traitLabel(t.trait)}</p>
                  <p className="text-lg font-semibold">
                    {t.score ?? "—"}
                    <span className="ml-1 text-xs font-normal text-neutral-500">
                      {t.confidence}
                    </span>
                  </p>
                </div>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {t.rationale}
                </p>
                {t.evidenceClaimIds.length > 0 && (
                  <p className="mt-1 text-xs text-neutral-500">
                    Evidence:{" "}
                    {t.evidenceClaimIds.map((id, i) => (
                      <a key={id} href={`#evidence-${id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                        [{i + 1}]
                      </a>
                    ))}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!memo && (
        <section className="mb-8 rounded-lg border border-dashed border-neutral-300 p-5 dark:border-neutral-700">
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            No memo yet. Diligence scores the three axes against real evidence,
            then drafts the memo from Memory only.
          </p>
          <GenerateMemoButton opportunityId={opportunityId} />
        </section>
      )}

      {memo && (
        <>
          <section className="mb-8 rounded-lg border-2 border-neutral-900 p-5 dark:border-neutral-100">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Recommendation</h2>
              <span className="rounded-full bg-neutral-900 px-3 py-1 text-sm font-semibold uppercase text-white dark:bg-neutral-100 dark:text-neutral-900">
                {memo.recommendation.verdict}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium">{memo.recommendation.thesisFit}</p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {memo.recommendation.rationale}
            </p>
            {opp.status !== "decision" && (
              <div className="mt-4">
                <DecisionButtons opportunityId={opportunityId} />
              </div>
            )}
          </section>

          <section className="space-y-6">
            <MemoBlock title="Company snapshot">{memo.snapshot}</MemoBlock>
            <ListBlock title="Investment hypotheses" items={memo.hypotheses} />
            <div className="grid gap-4 md:grid-cols-2">
              <ListBlock title="Strengths" items={memo.swot.strengths} />
              <ListBlock title="Weaknesses" items={memo.swot.weaknesses} />
              <ListBlock title="Opportunities" items={memo.swot.opportunities} />
              <ListBlock title="Threats" items={memo.swot.threats} />
            </div>
            <MemoBlock title="Problem &amp; product">{memo.problemProduct}</MemoBlock>
            <MemoBlock title="Traction &amp; KPIs">{memo.tractionKpis}</MemoBlock>
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Marked gaps, not guessed
              </h3>
              <ul className="mt-1 list-disc pl-5 text-sm text-amber-800 dark:text-amber-300">
                {memo.gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}

      {/* Per-claim trust: the evidence every conclusion traces to */}
      <section className="mt-10">
        <h2 className="mb-1 font-semibold">Claims and evidence</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Every claim carries its own trust grade. Sources are only ever ones the
          system actually retrieved, enforced in code.
        </p>
        <ul className="space-y-3">
          {claims.map((claim) => (
            <li
              key={claim.id}
              id={`evidence-${claim.id}`}
              className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{claim.text}</p>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${GRADE_STYLE[claim.grade ?? "ungraded"]}`}
                >
                  {(claim.grade ?? "ungraded").replace("_", " ")}
                </span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                {claim.category} · from {claim.origin}
              </p>
              {claim.reasoning && (
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {claim.reasoning}
                </p>
              )}
              {(claim.sources ?? []).length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {claim.sources!.map((s) =>
                    s.url ? (
                      <li key={s.url + s.title}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {s.title || s.url}
                        </a>
                      </li>
                    ) : (
                      <li key={s.title} className="text-sm text-neutral-500">
                        {s.title}
                      </li>
                    )
                  )}
                </ul>
              )}
            </li>
          ))}
          {claims.length === 0 && (
            <li className="rounded-lg border border-dashed border-neutral-200 p-4 text-sm text-neutral-400 dark:border-neutral-800">
              No claims in Memory yet for this founder.
            </li>
          )}
        </ul>
      </section>

      {interview?.feedback && (
        <section className="mt-10 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="font-semibold">Feedback sent to the founder</h2>
          <p className="text-sm text-neutral-500">
            FairShot is two-way: the founder saw this same evidence summary.
          </p>
          <div className="mt-2 grid gap-4 text-sm md:grid-cols-3">
            <ListBlock title="Strengths" items={interview.feedback.strengths} small />
            <ListBlock title="Thin evidence" items={interview.feedback.thinEvidence} small />
            <ListBlock title="Suggested next steps" items={interview.feedback.nextSteps} small />
          </div>
        </section>
      )}
    </main>
  );
}

function MemoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 font-semibold" dangerouslySetInnerHTML={{ __html: title }} />
      <p className="whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300">
        {children}
      </p>
    </div>
  );
}

function ListBlock({
  title,
  items,
  small,
}: {
  title: string;
  items: string[];
  small?: boolean;
}) {
  return (
    <div>
      <h3 className={`mb-1 font-semibold ${small ? "text-sm" : ""}`}>{title}</h3>
      <ul className={`list-disc space-y-1 pl-5 ${small ? "text-sm" : "text-sm"}`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
        {items.length === 0 && <li className="text-neutral-400">None recorded</li>}
      </ul>
    </div>
  );
}
