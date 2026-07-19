import { getAll, getById } from "@/lib/store";
import type { AxisScore, Grade } from "@/lib/types";
import { DecisionButtons, GenerateMemoButton } from "./memo-actions";

export const dynamic = "force-dynamic";

const GRADE_STYLE: Record<Grade | "ungraded", string> = {
  corroborated: "bg-[var(--color-teal)] text-black",
  weak_signal: "bg-[var(--color-warning)] text-black",
  unverifiable: "bg-[var(--color-background)]",
  ungraded: "bg-[var(--color-background)]",
};

const VERDICT_STYLE: Record<string, string> = {
  invest: "bg-[var(--color-teal)] text-black",
  watch: "bg-[var(--color-warning)] text-black",
  pass: "bg-[var(--color-slate)] text-white",
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
  // Memory keeps every assessment ever made; the memo shows the latest per
  // axis (a re-run of diligence supersedes, never duplicates).
  const axisRecords = getAll("axisScores").filter(
    (a) => a.opportunityId === opportunityId
  );
  const axes = (["founder", "market", "idea_market"] as const)
    .map((ax) =>
      axisRecords
        .filter((a) => a.axis === ax)
        .sort((a, b) => a.assessedAt.localeCompare(b.assessedAt))
        .at(-1)
    )
    .filter((a): a is AxisScore => Boolean(a));
  const traits = getAll("traitScores").filter((t) => t.opportunityId === opportunityId);
  const claims = getAll("claims").filter((c) => c.founderId === opp.founderId);
  const founderScore = getById("founderScores", opp.founderId);
  const interview = getAll("interviews").find((i) => i.opportunityId === opportunityId);

  const traitLabel = (t: string) => t.replace("_", " ");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <header className="mb-8">
        <p className="text-sm font-bold uppercase tracking-wide text-[var(--color-main)]">
          Investment memo
        </p>
        <h1 className="mt-1 text-2xl">
          {founder?.name}
          {venture ? ` · ${venture.name}` : ""}
          {founder?.synthetic && (
            <span className="nb-badge nb-badge-purple ml-2 align-middle">
              Synthetic demo profile
            </span>
          )}
        </h1>
        <p className="mt-1 text-muted">{venture?.oneLiner}</p>
        <div className="mt-2 flex gap-4 text-sm text-muted">
          <span>
            Founder score: <strong>{founderScore?.score ?? "—"}</strong>
          </span>
          <span>
            Conviction: <strong>{opp.convictionScore ?? "—"}</strong>
          </span>
          <span>
            Status: <strong>{opp.status}{opp.decision ? ` · ${opp.decision.toUpperCase()}` : ""}</strong>
          </span>
        </div>
      </header>

      {/* Three axes, never averaged */}
      {axes.length > 0 && (
        <section className="mb-8 grid gap-3 md:grid-cols-3">
          {axes.map((axis) => (
            <div key={axis.id} className="nb-card p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-purple)]">
                {axis.axis === "idea_market" ? "Idea vs market" : axis.axis}
              </p>
              <p className="mt-1 font-[family-name:var(--font-heading)] font-bold">
                {axis.rating}
              </p>
              <p className="text-xs text-muted">Trend: {axis.trend}</p>
              <p className="mt-2 text-sm text-muted">{axis.rationale}</p>
            </div>
          ))}
        </section>
      )}

      {/* Capability panel: the Founder axis in detail */}
      {traits.length > 0 && (
        <section className="nb-card mb-8 p-5">
          <h2 className="text-lg">Capability assessment</h2>
          <p className="text-sm text-muted">
            Four traits from high-potential talent assessment. Every score cites
            the evidence behind it; &ldquo;insufficient&rdquo; is an honest answer, not a failure.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {traits.map((t) => (
              <div key={t.id} className="nb-card-flat p-3">
                <div className="flex items-baseline justify-between">
                  <p className="font-semibold capitalize">{traitLabel(t.trait)}</p>
                  <p className="font-[family-name:var(--font-heading)] text-lg font-bold">
                    {t.score ?? "—"}
                    <span className="ml-1 text-xs font-normal text-muted">
                      {t.confidence}
                    </span>
                  </p>
                </div>
                <p className="mt-1 text-sm text-muted">{t.rationale}</p>
                {t.evidenceClaimIds.length > 0 && (
                  <p className="mt-1 text-xs text-muted">
                    Evidence:{" "}
                    {t.evidenceClaimIds.map((id, i) => (
                      <a
                        key={id}
                        href={`#evidence-${id}`}
                        className="font-medium text-[var(--color-main)] hover:underline"
                      >
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
        <section className="nb-card-flat nb-dashed mb-8 p-5">
          <p className="mb-3 text-sm text-muted">
            No memo yet. Diligence scores the three axes against real evidence,
            then drafts the memo from Memory only.
          </p>
          <GenerateMemoButton opportunityId={opportunityId} />
        </section>
      )}

      {memo && (
        <>
          <section className="nb-card mb-8 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg">Recommendation</h2>
              <span
                className={`rounded-[5px] border-2 border-[var(--color-border)] px-3 py-1 text-sm font-bold uppercase ${
                  VERDICT_STYLE[memo.recommendation.verdict] ?? "bg-[var(--color-background)]"
                }`}
              >
                {memo.recommendation.verdict}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium">{memo.recommendation.thesisFit}</p>
            <p className="mt-1 text-sm text-muted">{memo.recommendation.rationale}</p>
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
            <div className="rounded-[5px] border-2 border-[var(--color-border)] bg-[var(--color-warning)] p-4 text-black">
              <h3 className="text-sm font-bold">Marked gaps, not guessed</h3>
              <ul className="mt-1 list-disc pl-5 text-sm">
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
        <h2 className="mb-1 text-lg">Claims and evidence</h2>
        <p className="mb-3 text-sm text-muted">
          Every claim carries its own trust grade. Sources are only ever ones the
          system actually retrieved, enforced in code.
        </p>
        <ul className="space-y-3">
          {claims.map((claim) => (
            <li
              key={claim.id}
              id={`evidence-${claim.id}`}
              className="nb-card-flat p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{claim.text}</p>
                <span
                  className={`shrink-0 rounded-[5px] border-2 border-[var(--color-border)] px-2 py-0.5 text-xs font-semibold ${GRADE_STYLE[claim.grade ?? "ungraded"]}`}
                >
                  {(claim.grade ?? "ungraded").replace("_", " ")}
                </span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted">
                {claim.category} · from {claim.origin}
              </p>
              {claim.reasoning && (
                <p className="mt-1 text-sm text-muted">{claim.reasoning}</p>
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
                          className="text-sm font-medium text-[var(--color-main)] hover:underline"
                        >
                          {s.title || s.url}
                        </a>
                      </li>
                    ) : (
                      <li key={s.title} className="text-sm text-muted">
                        {s.title}
                      </li>
                    )
                  )}
                </ul>
              )}
            </li>
          ))}
          {claims.length === 0 && (
            <li className="nb-card-flat nb-dashed p-4 text-sm text-muted">
              No claims in Memory yet for this founder.
            </li>
          )}
        </ul>
      </section>

      {interview?.feedback && (
        <section className="nb-card mt-10 p-5">
          <h2 className="text-lg">Feedback sent to the founder</h2>
          <p className="text-sm text-muted">
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
      <p className="whitespace-pre-line text-sm">{children}</p>
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
        {items.length === 0 && <li className="text-muted">None recorded</li>}
      </ul>
    </div>
  );
}
