import { NextResponse } from "next/server";
import { completeJSON } from "@/lib/llm";
import { getAll } from "@/lib/store";
import type { SignalSource, Trait } from "@/lib/types";

// Multi-attribute natural-language query over Memory: one pass, not five
// manual filters. The LLM translates the question into a structured filter;
// the filtering itself runs in code over Memory, so results are auditable.

interface QueryFilter {
  sectors?: string[];
  geographies?: string[];
  sources?: SignalSource[];
  minFounderScore?: number;
  minConviction?: number;
  traits?: { trait: Trait; min: number }[];
  noPriorVcBacking?: boolean;
  status?: string[];
  keywords?: string[];
}

const QUERY_SYSTEM = `You translate an investor's plain-English founder query into a structured filter for a founder database.
Filter fields, ALL optional — include only what the query implies:
- sectors: string[] — sector terms. When you use a sector, ALSO add its synonym expansion to keywords
- geographies: string[] — regions, countries, or cities
- sources: string[] — subset of ["github","hackernews","arxiv","hackathon","accelerator","application","interview","web","publication","founder_supplied"] when the query names where founders were found
- minFounderScore: number 0-100 — when the query asks for "strong"/"top" founders, use 70
- minConviction: number 0-100
- traits: [{"trait":"ability"|"aspiration"|"learning_agility"|"accountability","min":number}]
- noPriorVcBacking: true when the query asks for founders without prior VC funding or backing
- status: string[] — subset of ["sourced","screened","interview","diligence","decision"]
- keywords: string[] — remaining free-text terms, EXPANDED with 2-4 close synonyms or domain terms so matching survives vocabulary gaps (e.g. "healthcare" → ["healthcare","health","NHS","hospital","clinical","medical"])
Output strict JSON only: {"filter":{...},"interpretation":"one plain sentence restating what will be searched"}`;

// Positive funding evidence only; negated mentions ("never raised", "no
// funding") must not count against a founder, that is the cold-start case.
const NEGATED_FUNDING = /\b(never|not|no|without|haven't|hasn't|didn't)\b[^.!?]{0,40}\b(raised|funding|funded|backed|investors?)\b/gi;
const FUNDING_EVIDENCE = /\braised (\$|£|€|an? |over |around )|series [a-c]\b|closed (a|our|the) (round|seed)|vc[- ]backed|venture[- ]backed|angel round/i;
// Case-sensitive on purpose: "led by Sequoia" is funding evidence, "led by a
// colleague" is not.
const FUNDING_EVIDENCE_CS = /led by [A-Z][a-z]/;

function fuzzyHit(haystack: string, needles: string[]): string | null {
  const lower = haystack.toLowerCase();
  for (const needle of needles) {
    const n = needle.toLowerCase();
    if (lower.includes(n) || n.includes(lower)) return needle;
  }
  return null;
}

export async function POST(req: Request) {
  let body: { q?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const q = (body.q ?? "").trim();
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

  let filter: QueryFilter = {};
  let interpretation = "";
  try {
    const parsed = await completeJSON<{ filter: QueryFilter; interpretation: string }>(
      QUERY_SYSTEM,
      q
    );
    filter = parsed.filter ?? {};
    interpretation = parsed.interpretation ?? "";
  } catch {
    filter = { keywords: q.split(/\s+/).filter((w) => w.length > 2) };
    interpretation = "Keyword search (reasoning layer unavailable, honest fallback)";
  }

  const ventures = getAll("ventures");
  const opportunities = getAll("opportunities");
  const signals = getAll("signals");
  const claims = getAll("claims");
  const founderScores = new Map(getAll("founderScores").map((s) => [s.founderId, s]));
  const traitScores = getAll("traitScores");

  const results = getAll("founders")
    .map((founder) => {
      const venture = ventures.find((v) => v.founderId === founder.id);
      const opp = opportunities.find((o) => o.founderId === founder.id);
      const mySignals = signals.filter((s) => s.founderId === founder.id);
      const myEvidence = [
        ...mySignals.map((s) => `${s.title} ${s.content}`),
        ...claims.filter((c) => c.founderId === founder.id).map((c) => c.text),
      ].join(" ");
      const score = founderScores.get(founder.id)?.score;
      const matched: string[] = [];
      const sectorUnknown =
        !venture || ["unclassified", "unknown", ""].includes(venture.sector.toLowerCase());

      if (filter.sectors?.length) {
        if (sectorUnknown) {
          // Don't hard-fail founders whose sector was never classified; the
          // expanded keywords carry the domain judgment instead.
          matched.push("sector: unclassified (judged on domain terms instead)");
        } else {
          const hit = fuzzyHit(venture!.sector, filter.sectors);
          if (!hit) return null;
          matched.push(`sector: ${venture!.sector}`);
        }
      }
      if (filter.geographies?.length) {
        const hit = venture && fuzzyHit(venture.geography, filter.geographies);
        if (!hit) return null;
        matched.push(`geography: ${venture!.geography}`);
      }
      if (filter.sources?.length) {
        const mine = new Set(mySignals.map((s) => s.source));
        const hit = filter.sources.find((s) => mine.has(s));
        if (!hit) return null;
        matched.push(`found via ${hit}`);
      }
      if (filter.minFounderScore != null) {
        if (score == null || score < filter.minFounderScore) return null;
        matched.push(`founder score ${score} ≥ ${filter.minFounderScore}`);
      }
      if (filter.minConviction != null) {
        if (opp?.convictionScore == null || opp.convictionScore < filter.minConviction)
          return null;
        matched.push(`conviction ${opp.convictionScore} ≥ ${filter.minConviction}`);
      }
      if (filter.traits?.length) {
        for (const wanted of filter.traits) {
          const mine = traitScores
            .filter((t) => t.founderId === founder.id && t.trait === wanted.trait)
            .sort((a, b) => b.assessedAt.localeCompare(a.assessedAt))[0];
          if (!mine || mine.score == null || mine.score < wanted.min) return null;
          matched.push(`${wanted.trait.replace("_", " ")} ${mine.score} ≥ ${wanted.min}`);
        }
      }
      if (filter.noPriorVcBacking) {
        const denegated = myEvidence.replace(NEGATED_FUNDING, "");
        if (FUNDING_EVIDENCE.test(denegated) || FUNDING_EVIDENCE_CS.test(denegated))
          return null;
        matched.push("no funding evidence in Memory (treated as no prior VC backing)");
      }
      if (filter.status?.length) {
        if (!opp || !filter.status.includes(opp.status)) return null;
        matched.push(`status: ${opp.status}`);
      }
      if (filter.keywords?.length) {
        const searchable =
          `${founder.name} ${founder.bio ?? ""} ${venture?.name ?? ""} ${venture?.oneLiner ?? ""} ${myEvidence}`.toLowerCase();
        // Stem down to 5 characters so "healthcare" still finds "health".
        const hits = filter.keywords.filter((keyword) => {
          const k = keyword.toLowerCase();
          for (let len = k.length; len >= Math.min(5, k.length); len--) {
            if (searchable.includes(k.slice(0, len))) return true;
          }
          return false;
        });
        if (hits.length === 0) return null;
        matched.push(`mentions: ${hits.join(", ")}`);
      }

      return {
        founderId: founder.id,
        opportunityId: opp?.id ?? null,
        name: founder.name,
        synthetic: founder.synthetic ?? false,
        venture: venture?.name ?? null,
        oneLiner: venture?.oneLiner ?? founder.bio ?? "",
        status: opp?.status ?? null,
        conviction: opp?.convictionScore ?? null,
        founderScore: score ?? null,
        matchedBecause: matched,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort(
      (a, b) =>
        (b.founderScore ?? -1) - (a.founderScore ?? -1) ||
        (b.conviction ?? -1) - (a.conviction ?? -1)
    )
    .slice(0, 12);

  return NextResponse.json({ interpretation, count: results.length, results });
}
