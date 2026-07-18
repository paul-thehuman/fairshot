import { getAll } from "@/lib/store";
import { loadThesis } from "@/lib/thesis";
import { FAIRNESS_EXCLUSIONS } from "@/lib/fairness";
import QueryBar from "./query-bar";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  "threshold.crossed": "Threshold crossed",
  "dedupe.merge": "Profiles merged",
  "decision.made": "Decision",
  "interview.complete": "Interview complete",
  "scan.complete": "Scan",
  "memo.generated": "Memo drafted",
  "application.received": "Application",
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export default async function Dashboard() {
  const thesis = loadThesis();
  const founders = getAll("founders");
  const opportunities = getAll("opportunities");
  const signals = getAll("signals");
  const interviews = getAll("interviews");
  const events = getAll("events")
    .filter((e) => EVENT_LABEL[e.type])
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  const sources = new Set(signals.map((s) => s.source));
  const openInvites = interviews.filter((i) => i.status === "invited").length;
  const decisionHours = opportunities
    .filter((o) => o.decision)
    .map((o) => {
      const first = new Date(o.statusHistory[0].at).getTime();
      const decided = new Date(
        o.statusHistory.find((h) => h.status === "decision")?.at ?? o.createdAt
      ).getTime();
      return (decided - first) / 3_600_000;
    });
  const medianHours = median(decisionHours);

  const stats: { label: string; value: string; hint: string }[] = [
    {
      label: "Founders in Memory",
      value: String(founders.length),
      hint: `${founders.filter((f) => !f.synthetic).length} discovered live`,
    },
    {
      label: "Signals ingested",
      value: String(signals.length),
      hint: `${sources.size} sourcing channels`,
    },
    {
      label: "Awaiting interview",
      value: String(openInvites),
      hint: "crossed the conviction threshold",
    },
    {
      label: "Signal → decision",
      value: medianHours == null ? "—" : `${Math.round(medianHours)}h`,
      hint: medianHours == null ? "no decisions yet" : "median, this Memory",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          FairShot
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          Overlooked founders, found and fairly assessed
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Active thesis: {thesis.sectors.join(", ")} · {thesis.stages.join(", ")} ·{" "}
          {thesis.geographies.join(", ")} · ${(thesis.checkSizeUsd / 1000).toFixed(0)}K
          checks ·{" "}
          <a href="/settings" className="text-blue-600 hover:underline dark:text-blue-400">
            change
          </a>
        </p>
      </header>

      <QueryBar />

      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
            <p className="text-xs text-neutral-500">{stat.hint}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 font-semibold">What just happened</h2>
          <ul className="space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {EVENT_LABEL[event.type]}
                </p>
                <p className="mt-0.5 text-neutral-700 dark:text-neutral-300">
                  {event.detail}
                </p>
              </li>
            ))}
            {events.length === 0 && (
              <li className="rounded-lg border border-dashed border-neutral-200 p-3 text-sm text-neutral-400 dark:border-neutral-800">
                Nothing yet. Seed the universe and run a scan from the Pipeline page.
              </li>
            )}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 font-semibold">Newest signals</h2>
          <ul className="space-y-2">
            {signals
              .sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt))
              .slice(0, 6)
              .map((signal) => (
                <li
                  key={signal.id}
                  className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {signal.source}
                  </p>
                  <p className="mt-0.5 text-neutral-700 dark:text-neutral-300">
                    {signal.title}
                  </p>
                </li>
              ))}
          </ul>
        </section>
      </div>

      <section className="mt-10 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-semibold">What FairShot deliberately ignores</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Capability is scored from evidence tied to specific claims. The system
          does not use:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
          {FAIRNESS_EXCLUSIONS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-neutral-500">
          And one enforced policy: real people discovered outbound are prioritised
          for outreach, never capability-judged until they choose to take part.
        </p>
      </section>
    </main>
  );
}
