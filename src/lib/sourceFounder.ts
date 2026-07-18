import { completeJSON } from "./llm";
import { searchEvidence } from "./tavily";
import { findOrCreateFounder } from "./dedupe";
import { screenPending } from "./pipeline";
import { getAll, getById, logEvent, newId, now, patchById, upsert } from "./store";
import type { Opportunity, Venture } from "./types";

// Targeted sourcing: point FairShot at a specific person and it builds an
// evidence profile from the real web, screens it against the thesis, and
// invites them to interview. Targeting someone is an investor-initiated act
// of interest, so the invitation is created regardless of the automatic
// conviction threshold. The assessment policy still holds: no capability
// judgment until the person actually participates.

const GH_HEADERS: HeadersInit = {
  Accept: "application/vnd.github+json",
  "User-Agent": "fairshot-hackathon",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

async function ghJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: GH_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${url}`);
  return (await res.json()) as T;
}

interface GhUser {
  login: string;
  name: string | null;
  blog: string | null;
  bio: string | null;
  html_url: string;
}

interface GhRepo {
  name: string;
  description: string | null;
  html_url: string;
  pushed_at: string;
  stargazers_count: number;
  fork: boolean;
  language: string | null;
}

export async function sourceFounderByGithub(handle: string) {
  const user = await ghJson<GhUser>(`https://api.github.com/users/${handle}`);
  const repos = (
    await ghJson<GhRepo[]>(
      `https://api.github.com/users/${handle}/repos?sort=pushed&per_page=8`
    )
  )
    .filter((r) => !r.fork)
    .slice(0, 4);

  const { founder } = findOrCreateFounder({
    name: user.name || user.login,
    handles: { github: user.login, website: user.blog || undefined },
    origin: "outbound",
    bio: user.bio ?? undefined,
  });

  const existingTitles = new Set(
    getAll("signals")
      .filter((s) => s.founderId === founder.id)
      .map((s) => s.title)
  );
  let signalsAdded = 0;
  const addSignal = (signal: {
    source: "github" | "web";
    title: string;
    content: string;
    url?: string;
    observedAt: string;
  }) => {
    if (existingTitles.has(signal.title)) return;
    upsert("signals", {
      id: newId(),
      founderId: founder.id,
      ...signal,
      ingestedAt: now(),
    });
    existingTitles.add(signal.title);
    signalsAdded += 1;
  };

  for (const repo of repos) {
    addSignal({
      source: "github",
      title: `${repo.name} — repository by ${user.login}`,
      content: `${repo.description ?? "No description"}. ${repo.stargazers_count} stars${repo.language ? `, ${repo.language}` : ""}, pushed ${repo.pushed_at.slice(0, 10)}.`,
      url: repo.html_url,
      observedAt: repo.pushed_at,
    });
  }

  // Real web evidence via Tavily, scoped to their site when we have one.
  // Identity gate: enrichment is only enrichment if it is about the same
  // person. A mini validator pass excludes namesakes, exclusions are logged,
  // and no verification means no enrichment: honesty over volume.
  try {
    const query = `"${user.name || user.login}"${user.blog ? ` ${user.blog}` : ""} founder builder`;
    const web = await searchEvidence(query, user.blog ? [user.blog] : []);
    let hits = web.slice(0, 5);
    try {
      const verdict = await completeJSON<{ keep: number[] }>(
        `You verify identity matches for a person-enrichment pipeline. Given a person's known profile and numbered web results, return ONLY the indexes of results clearly about the SAME person. Exclude namesakes and unrelated pages; when unsure, exclude. Output strict JSON only: {"keep":[0,2]}`,
        JSON.stringify({
          person: {
            handle: user.login,
            name: user.name,
            website: user.blog,
            bio: user.bio,
            repos: repos.map((r) => r.name),
          },
          results: hits.map((h, i) => ({
            i,
            title: h.title,
            url: h.url,
            content: h.content.slice(0, 200),
          })),
        })
      );
      const keep = new Set(verdict.keep ?? []);
      const excluded = hits.length - [...keep].filter((i) => i >= 0 && i < hits.length).length;
      hits = hits.filter((_, i) => keep.has(i));
      if (excluded > 0) {
        logEvent(
          "enrichment.identity_filtered",
          `${excluded} web result(s) about other people excluded while profiling ${user.login}`,
          { founderId: founder.id }
        );
      }
    } catch {
      hits = [];
    }
    for (const hit of hits.slice(0, 3)) {
      addSignal({
        source: "web",
        title: hit.title,
        content: hit.content.slice(0, 400),
        url: hit.url,
        observedAt: now(),
      });
    }
  } catch (err) {
    logEvent(
      "sourcing.web_skipped",
      `Web enrichment skipped for ${handle}: ${err instanceof Error ? err.message : "error"}`
    );
  }

  let venture = getAll("ventures").find((v) => v.founderId === founder.id);
  if (!venture) {
    let profile = {
      ventureName: repos[0]?.name ?? "Independent build",
      oneLiner: user.bio ?? "Independent builder",
      sector: "unclassified",
      geography: "unknown",
    };
    try {
      profile = await completeJSON<typeof profile>(
        `You profile a builder from their public evidence. Output strict JSON only: {"ventureName":"...","oneLiner":"...","sector":"...","geography":"..."}. ventureName: their most substantial current product or venture. oneLiner: one sentence, max 120 chars, what it does. sector: 2-4 plain words. geography: region or country if evident, else "unknown".`,
        JSON.stringify({
          bio: user.bio,
          website: user.blog,
          repos: repos.map((r) => ({ name: r.name, description: r.description })),
          webEvidence: getAll("signals")
            .filter((s) => s.founderId === founder.id && s.source === "web")
            .map((s) => `${s.title}: ${s.content.slice(0, 150)}`),
        })
      );
    } catch {
      // Best-effort profiling; the fallback is honest.
    }
    venture = {
      id: newId(),
      founderId: founder.id,
      name: profile.ventureName,
      oneLiner: profile.oneLiner,
      sector: profile.sector,
      geography: profile.geography,
      stage: "pre-seed",
      createdAt: now(),
    } satisfies Venture;
    upsert("ventures", venture);
  }

  let opportunity = getAll("opportunities").find(
    (o) => o.founderId === founder.id && o.status !== "decision"
  );
  if (!opportunity) {
    opportunity = {
      id: newId(),
      ventureId: venture.id,
      founderId: founder.id,
      status: "sourced",
      statusHistory: [{ status: "sourced", at: now() }],
      createdAt: now(),
    } satisfies Opportunity;
    upsert("opportunities", opportunity);
  }

  await screenPending();

  let interview = getAll("interviews").find(
    (i) => i.opportunityId === opportunity.id
  );
  if (!interview) {
    interview = {
      id: newId(),
      opportunityId: opportunity.id,
      founderId: founder.id,
      plannedQuestions: [],
      turns: [],
      status: "invited" as const,
      extractedClaimIds: [],
      createdAt: now(),
    };
    upsert("interviews", interview);
  }
  const current = getById("opportunities", opportunity.id)!;
  if (current.status === "sourced" || current.status === "screened") {
    patchById("opportunities", current.id, {
      status: "interview",
      statusHistory: [...current.statusHistory, { status: "interview" as const, at: now() }],
    });
  }

  logEvent(
    "sourced.targeted",
    `Targeted sourcing: ${founder.name} (@${user.login}) profiled from ${signalsAdded} real signals; interview invitation created`,
    { founderId: founder.id, opportunityId: opportunity.id }
  );

  return {
    founderId: founder.id,
    opportunityId: opportunity.id,
    interviewId: interview.id,
    signalsAdded,
    conviction: getById("opportunities", opportunity.id)?.convictionScore ?? null,
  };
}
