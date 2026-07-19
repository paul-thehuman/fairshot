import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { gradeClaim } from "./llm";
import { searchEvidence } from "./tavily";
import { getAll, getById, logEvent, newId, now, patchById, upsert } from "./store";

const UPLOAD_DIR = join(process.cwd(), "data", "uploads");

function hostOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export interface UrlEvidenceResult {
  checked: number;
  upgraded: number;
  upgradedClaims: string[];
}

// A founder shares a link before the assessment closes. We record it, then
// re-grade their still-unverified claims against it with the same evidence
// engine used everywhere. The grader can only ever cite URLs it actually
// retrieved, so a link that does not support a claim changes nothing: no
// self-serving upgrades.
export async function submitUrlEvidence(
  opportunityId: string,
  url: string
): Promise<UrlEvidenceResult> {
  const opp = getById("opportunities", opportunityId);
  if (!opp) throw new Error("Opportunity not found");
  const founderId = opp.founderId;

  upsert("signals", {
    id: newId(),
    founderId,
    source: "founder_supplied",
    title: "Founder-shared link",
    content: `The founder shared this link as evidence: ${url}`,
    url,
    observedAt: now(),
    ingestedAt: now(),
  });

  const claims = getAll("claims").filter(
    (c) =>
      c.founderId === founderId &&
      (c.grade === "unverifiable" || c.grade === "weak_signal" || c.grade == null)
  );

  let upgraded = 0;
  const upgradedClaims: string[] = [];
  let checked = 0;
  for (const claim of claims.slice(0, 4)) {
    checked += 1;
    try {
      const evidence = await searchEvidence(claim.text, [url]);
      const graded = await gradeClaim(claim.text, evidence);
      const improved =
        (graded.grade === "corroborated" && claim.grade !== "corroborated") ||
        (graded.grade === "weak_signal" &&
          (claim.grade == null || claim.grade === "unverifiable"));
      if (improved && graded.sources.length > 0) {
        // Label integrity: only sources that actually come from the founder's
        // link are marked Founder-provided; an independent page the search
        // surfaced keeps its own attribution.
        const submittedHost = hostOf(url);
        patchById("claims", claim.id, {
          grade: graded.grade,
          reasoning: `Re-graded after the founder shared a link. ${graded.reasoning}`,
          sources: graded.sources.map((s) =>
            submittedHost && hostOf(s.url) === submittedHost
              ? { url: s.url, title: `Founder-provided · ${s.title}` }
              : s
          ),
        });
        upgraded += 1;
        upgradedClaims.push(claim.text);
      }
    } catch {
      // A link that cannot be fetched or graded simply changes nothing.
    }
  }

  logEvent(
    "evidence.founder_url",
    `Founder shared a link; ${upgraded} of ${checked} unverified claim(s) re-graded upward`,
    { founderId, opportunityId }
  );
  return { checked, upgraded, upgradedClaims };
}

export interface FileEvidenceResult {
  id: string;
  filename: string;
}

// A founder uploads a document or screenshot. We store it and record it as
// self-attested evidence: shown to the investor, clearly marked as supplied by
// the founder and not independently verified. Honesty over inflation: an
// upload never re-grades a claim on its own.
export async function submitFileEvidence(
  opportunityId: string,
  filename: string,
  bytes: Buffer
): Promise<FileEvidenceResult> {
  const opp = getById("opportunities", opportunityId);
  if (!opp) throw new Error("Opportunity not found");
  const founderId = opp.founderId;

  const id = newId();
  const safe = filename.replace(/[^\w.-]/g, "_").slice(-80) || "upload";
  mkdirSync(UPLOAD_DIR, { recursive: true });
  writeFileSync(join(UPLOAD_DIR, `${id}-${safe}`), bytes);

  upsert("signals", {
    id: newId(),
    founderId,
    source: "founder_supplied",
    title: `Founder-submitted: ${safe}`,
    content:
      "Document uploaded by the founder as supporting evidence. Self-attested and not independently verified.",
    url: `/api/evidence/${id}`,
    observedAt: now(),
    ingestedAt: now(),
  });

  logEvent("evidence.founder_file", `Founder uploaded ${safe}`, {
    founderId,
    opportunityId,
  });
  return { id, filename: safe };
}
