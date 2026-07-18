import { NextResponse } from "next/server";
import { extractClaims, gradeClaim } from "@/lib/llm";
import { searchEvidence } from "@/lib/tavily";
import { findOrCreateFounder } from "@/lib/dedupe";
import { screenPending } from "@/lib/pipeline";
import { updateFounderScore } from "@/lib/founderScore";
import { getAll, getById, logEvent, newId, now, patchById, upsert } from "@/lib/store";
import type { FounderHandles, Opportunity, StoredClaim } from "@/lib/types";

function handlesFromLinks(links: string[]): FounderHandles {
  const handles: FounderHandles = {};
  for (const link of links) {
    const github = link.match(/github\.com\/([A-Za-z0-9-]+)/);
    if (github && !handles.github) handles.github = github[1];
    else if (!handles.website) handles.website = link;
  }
  return handles;
}

// Inbound door: deck + company name minimum. Creates the founder, grades the
// pitch claims against real evidence, screens against the thesis, and always
// ends at the universal gate: the Socratic interview.
export async function POST(req: Request) {
  let payload: { name?: string; company?: string; pitch?: string; links?: string[] };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (payload.name ?? "").trim();
  const company = (payload.company ?? "").trim();
  const pitch = (payload.pitch ?? "").trim();
  const links = (payload.links ?? []).map((l) => l.trim()).filter(Boolean);

  if (!name || !company || !pitch) {
    return NextResponse.json(
      { error: "name, company, and pitch are required" },
      { status: 400 }
    );
  }

  const { founder } = findOrCreateFounder({
    name,
    handles: handlesFromLinks(links),
    origin: "inbound",
    bio: pitch.slice(0, 160),
  });

  upsert("signals", {
    id: newId(),
    founderId: founder.id,
    source: "application",
    title: `Inbound application — ${company}`,
    content: pitch,
    observedAt: now(),
    ingestedAt: now(),
  });

  let venture = getAll("ventures").find((v) => v.founderId === founder.id);
  if (!venture) {
    venture = {
      id: newId(),
      founderId: founder.id,
      name: company,
      oneLiner: pitch.slice(0, 140),
      sector: "unclassified",
      geography: "unknown",
      stage: "pre-seed",
      createdAt: now(),
    };
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

  // Grade what's checkable in the pitch. Failures are logged, never papered over.
  let claimsGraded = 0;
  try {
    const claims = await extractClaims(pitch, links);
    for (const claim of claims) {
      const stored: StoredClaim = {
        id: newId(),
        opportunityId: opportunity.id,
        founderId: founder.id,
        origin: "pitch",
        text: claim.text,
        category: claim.category,
      };
      try {
        const evidence = await searchEvidence(claim.text, links);
        const graded = await gradeClaim(claim.text, evidence);
        stored.grade = graded.grade;
        stored.reasoning = graded.reasoning;
        stored.sources = graded.sources;
        claimsGraded += 1;
      } catch (err) {
        logEvent(
          "evidence.skipped",
          `Pitch claim left ungraded: ${err instanceof Error ? err.message : "error"}`
        );
      }
      upsert("claims", stored);
    }
  } catch (err) {
    logEvent(
      "claims.extraction_skipped",
      `Pitch claim extraction skipped: ${err instanceof Error ? err.message : "error"}`
    );
  }

  await screenPending();

  // Universal gate: every applicant sits the interview, cold-start or not.
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
      statusHistory: [...current.statusHistory, { status: "interview", at: now() }],
    });
  }

  try {
    updateFounderScore(founder.id, "Inbound application received and evidence graded");
  } catch {
    // Score baseline is best-effort at this stage.
  }

  logEvent(
    "application.received",
    `${name} applied with ${company}; ${claimsGraded} claims graded; interview created`,
    { founderId: founder.id, opportunityId: opportunity.id }
  );

  return NextResponse.json({
    founderId: founder.id,
    opportunityId: opportunity.id,
    interviewId: interview.id,
  });
}
