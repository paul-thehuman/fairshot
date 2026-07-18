import { completeJSON } from "./llm";
import { findOrCreateFounder } from "./dedupe";
import { loadThesis } from "./thesis";
import { getAll, logEvent, newId, now, upsert } from "./store";
import { githubScanner } from "./scanners/github";
import { hackerNewsScanner } from "./scanners/hackernews";
import { arxivScanner } from "./scanners/arxiv";
import { syntheticScanner } from "./scanners/synthetic";
import type { Scanner, RawDiscovery } from "./scanners/types";
import type { Opportunity, OppStatus, Venture } from "./types";

export interface ScanReport {
  scanners: { source: string; found: number; error?: string }[];
  foundersCreated: number;
  foundersMerged: number;
  signalsAdded: number;
  screened: number;
  invited: number;
  llmSkipped: boolean;
}

const SCREEN_SYSTEM = `You are the first-pass screening layer of a venture fund's sourcing engine.
You receive the fund's thesis and a list of sourced opportunities with their evidence.
Rules:
- conviction is 0-100: how strongly the evidence says this founder and venture fit the thesis and merit a capability interview now.
- Score only the evidence given. Do not invent facts.
- An off-thesis sector or geography caps conviction at 40.
- rationale: one plain sentence naming the deciding factors.
- Output strict JSON only: {"results":[{"id":"...","conviction":0,"rationale":"..."}]}`;

function advance(opp: Opportunity, status: OppStatus): Opportunity {
  return {
    ...opp,
    status,
    statusHistory: [...opp.statusHistory, { status, at: now() }],
  };
}

function ingest(discovery: RawDiscovery) {
  const { founder, created } = findOrCreateFounder({
    name: discovery.name,
    handles: discovery.handles,
    origin: "outbound",
    bio: discovery.ventureOneLiner,
  });

  // Idempotent re-scans: the same signal title for the same founder is a no-op.
  const existingSignal = getAll("signals").find(
    (s) => s.founderId === founder.id && s.title === discovery.title
  );
  let signalAdded = false;
  if (!existingSignal) {
    upsert("signals", {
      id: newId(),
      founderId: founder.id,
      source: discovery.source,
      url: discovery.url,
      title: discovery.title,
      content: discovery.content,
      observedAt: discovery.observedAt,
      ingestedAt: now(),
    });
    signalAdded = true;
  }

  let venture = getAll("ventures").find((v) => v.founderId === founder.id);
  if (!venture && discovery.ventureName) {
    venture = {
      id: newId(),
      founderId: founder.id,
      name: discovery.ventureName,
      oneLiner: discovery.ventureOneLiner ?? "",
      sector: discovery.sectorHint ?? "unclassified",
      geography: discovery.geographyHint ?? "unknown",
      stage: "pre-seed",
      createdAt: now(),
    } satisfies Venture;
    upsert("ventures", venture);
  }

  let opportunity = getAll("opportunities").find(
    (o) => o.founderId === founder.id && o.status !== "decision"
  );
  if (!opportunity && venture) {
    opportunity = {
      id: newId(),
      ventureId: venture.id,
      founderId: founder.id,
      status: "sourced",
      statusHistory: [{ status: "sourced", at: now() }],
      createdAt: now(),
    };
    upsert("opportunities", opportunity);
  }

  return { created, signalAdded };
}

async function prescreen(report: ScanReport) {
  const thesis = loadThesis();
  const founders = new Map(getAll("founders").map((f) => [f.id, f]));
  const ventures = new Map(getAll("ventures").map((v) => [v.id, v]));
  const signals = getAll("signals");

  const pending = getAll("opportunities")
    .filter((o) => o.status === "sourced")
    .slice(0, 12);
  if (pending.length === 0) return;

  const items = pending.map((o) => {
    const founder = founders.get(o.founderId);
    const venture = ventures.get(o.ventureId);
    const evidence = signals
      .filter((s) => s.founderId === o.founderId)
      .map((s) => `[${s.source}] ${s.title}: ${s.content}`)
      .join("\n");
    return {
      id: o.id,
      founder: founder?.name ?? "Unknown",
      venture: venture?.name ?? "Unknown",
      oneLiner: venture?.oneLiner ?? "",
      sector: venture?.sector ?? "unknown",
      geography: venture?.geography ?? "unknown",
      evidence,
    };
  });

  let results: { id: string; conviction: number; rationale: string }[];
  try {
    const parsed = await completeJSON<{
      results: { id: string; conviction: number; rationale: string }[];
    }>(
      SCREEN_SYSTEM,
      `Fund thesis:\n${JSON.stringify(thesis, null, 2)}\n\nSourced opportunities:\n${JSON.stringify(items, null, 2)}`
    );
    results = parsed.results ?? [];
  } catch (err) {
    // No LLM key configured (or provider down): leave opportunities sourced
    // rather than inventing scores. The scan itself still succeeded.
    report.llmSkipped = true;
    logEvent(
      "screen.skipped",
      `Prescreen skipped: ${err instanceof Error ? err.message : "unknown error"}`
    );
    return;
  }

  const interviews = getAll("interviews");
  for (const result of results) {
    const opp = pending.find((o) => o.id === result.id);
    if (!opp) continue;
    const conviction = Math.max(0, Math.min(100, Math.round(result.conviction)));
    let updated: Opportunity = {
      ...advance(opp, "screened"),
      convictionScore: conviction,
      convictionRationale: result.rationale,
    };
    report.screened += 1;

    const crossed = conviction >= thesis.convictionThreshold;
    const hasInterview = interviews.some((i) => i.opportunityId === opp.id);
    if (crossed && !hasInterview) {
      updated = advance(updated, "interview");
      upsert("interviews", {
        id: newId(),
        opportunityId: opp.id,
        founderId: opp.founderId,
        plannedQuestions: [],
        turns: [],
        status: "invited",
        extractedClaimIds: [],
        createdAt: now(),
      });
      const founder = getAll("founders").find((f) => f.id === opp.founderId);
      logEvent(
        "threshold.crossed",
        `${founder?.name ?? "Founder"} crossed the conviction threshold (${conviction} ≥ ${thesis.convictionThreshold}); interview invitation created`,
        { founderId: opp.founderId, opportunityId: opp.id }
      );
      report.invited += 1;
    }
    upsert("opportunities", updated);
  }
}

// Screen whatever sits in 'sourced' right now; used by the apply flow so an
// inbound application is scored the same way as an outbound discovery.
export async function screenPending(): Promise<Pick<ScanReport, "screened" | "invited" | "llmSkipped">> {
  const report: ScanReport = {
    scanners: [],
    foundersCreated: 0,
    foundersMerged: 0,
    signalsAdded: 0,
    screened: 0,
    invited: 0,
    llmSkipped: false,
  };
  await prescreen(report);
  return {
    screened: report.screened,
    invited: report.invited,
    llmSkipped: report.llmSkipped,
  };
}

export async function runScan(): Promise<ScanReport> {
  const thesis = loadThesis();
  const scanners: Scanner[] = [
    githubScanner,
    hackerNewsScanner,
    arxivScanner,
    syntheticScanner,
  ];

  const report: ScanReport = {
    scanners: [],
    foundersCreated: 0,
    foundersMerged: 0,
    signalsAdded: 0,
    screened: 0,
    invited: 0,
    llmSkipped: false,
  };

  const settled = await Promise.allSettled(scanners.map((s) => s.scan(thesis)));
  settled.forEach((outcome, i) => {
    const source = scanners[i].source;
    if (outcome.status === "rejected") {
      const message =
        outcome.reason instanceof Error ? outcome.reason.message : "failed";
      report.scanners.push({ source, found: 0, error: message });
      logEvent("scanner.error", `${source} scanner failed: ${message}`);
      return;
    }
    report.scanners.push({ source, found: outcome.value.length });
    for (const discovery of outcome.value) {
      const { created, signalAdded } = ingest(discovery);
      if (created) report.foundersCreated += 1;
      else report.foundersMerged += 1;
      if (signalAdded) report.signalsAdded += 1;
    }
  });

  await prescreen(report);
  logEvent(
    "scan.complete",
    `Scan complete: ${report.foundersCreated} new founders, ${report.foundersMerged} merged, ${report.signalsAdded} signals, ${report.screened} screened, ${report.invited} invited`
  );
  return report;
}
