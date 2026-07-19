import { getAll, logEvent, newId, now, upsert } from "./store";
import type { Founder, FounderHandles, FounderOrigin } from "./types";

function normaliseName(name: string): string {
  return name.toLowerCase().replace(/[^a-zÀ-ɏ ]/g, "").trim();
}

// Hosts shared by many unrelated people: a linkedin.com or medium.com profile
// URL identifies the platform, not the person, so it must never drive a merge.
const MULTI_TENANT_HOSTS = new Set([
  "linkedin.com",
  "medium.com",
  "x.com",
  "twitter.com",
  "github.com",
  "youtube.com",
  "instagram.com",
  "facebook.com",
]);

function domainOf(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const withProto = url.startsWith("http") ? url : `https://${url}`;
    const host = new URL(withProto).hostname.replace(/^www\./, "");
    return MULTI_TENANT_HOSTS.has(host) ? undefined : host;
  } catch {
    return undefined;
  }
}

// Match priority: GitHub handle, then website domain, then normalised name.
// On a match, new handles are merged in but existing ones are never
// overwritten, and the merge is logged as an event so it is auditable.
export function findOrCreateFounder(input: {
  name: string;
  handles?: FounderHandles;
  origin: FounderOrigin;
  bio?: string;
}): { founder: Founder; created: boolean } {
  const founders = getAll("founders");
  const gh = input.handles?.github?.toLowerCase();
  const dom = domainOf(input.handles?.website);

  const match =
    (gh && founders.find((f) => f.handles.github?.toLowerCase() === gh)) ||
    (dom && founders.find((f) => domainOf(f.handles.website) === dom)) ||
    founders.find((f) => normaliseName(f.name) === normaliseName(input.name));

  if (match) {
    const mergedHandles: FounderHandles = { ...input.handles, ...match.handles };
    const changed = JSON.stringify(mergedHandles) !== JSON.stringify(match.handles);
    const merged: Founder = {
      ...match,
      handles: mergedHandles,
      bio: match.bio || input.bio,
    };
    upsert("founders", merged);
    if (changed) {
      logEvent(
        "dedupe.merge",
        `Merged newly discovered handles into existing profile for ${match.name}`,
        { founderId: match.id }
      );
    }
    return { founder: merged, created: false };
  }

  const founder: Founder = {
    id: newId(),
    name: input.name,
    handles: input.handles ?? {},
    origin: input.origin,
    bio: input.bio,
    createdAt: now(),
  };
  upsert("founders", founder);
  return { founder, created: true };
}
