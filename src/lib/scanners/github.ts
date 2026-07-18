import type { Scanner, RawDiscovery } from "./types";
import { keywordsFor } from "./types";

interface GhRepo {
  name: string;
  description: string | null;
  html_url: string;
  pushed_at: string;
  stargazers_count: number;
  owner: { login: string; type: string };
}

interface GhUser {
  login: string;
  name: string | null;
  blog: string | null;
  bio: string | null;
}

const headers: HeadersInit = {
  Accept: "application/vnd.github+json",
  "User-Agent": "fairshot-hackathon",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

// Unauthenticated GitHub search allows 10 requests/minute; a short TTL cache
// makes repeat scans free instead of rate-limited.
const cache = new Map<string, { at: number; data: unknown }>();

async function cachedJson<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.data as T;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${url}`);
  const data = (await res.json()) as T;
  cache.set(url, { at: Date.now(), data });
  return data;
}

export const githubScanner: Scanner = {
  source: "github",
  async scan(thesis) {
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
    const discoveries: RawDiscovery[] = [];
    const seenOwners = new Set<string>();

    for (const keyword of keywordsFor(thesis, 2)) {
      const q = encodeURIComponent(`${keyword} in:name,description pushed:>=${since} stars:>=5`);
      const search = await cachedJson<{ items: GhRepo[] }>(
        `https://api.github.com/search/repositories?q=${q}&sort=updated&order=desc&per_page=8`
      );
      for (const repo of search.items ?? []) {
        if (repo.owner.type !== "User") continue;
        if (seenOwners.has(repo.owner.login)) continue;
        seenOwners.add(repo.owner.login);
        if (discoveries.length >= 6) break;

        let user: GhUser = { login: repo.owner.login, name: null, blog: null, bio: null };
        try {
          user = await cachedJson<GhUser>(`https://api.github.com/users/${repo.owner.login}`);
        } catch {
          // Profile enrichment is best-effort; the repo signal stands alone.
        }

        discoveries.push({
          source: "github",
          name: user.name || user.login,
          handles: { github: user.login, website: user.blog || undefined },
          ventureName: repo.name,
          ventureOneLiner: repo.description ?? undefined,
          sectorHint: thesis.sectors[0],
          title: `${repo.name} — active repository matching "${keyword}"`,
          content: `${repo.description ?? "No description"}. ${repo.stargazers_count} stars, pushed ${repo.pushed_at.slice(0, 10)}.${user.bio ? ` Owner bio: ${user.bio}` : ""}`,
          url: repo.html_url,
          observedAt: repo.pushed_at,
        });
      }
    }
    return discoveries;
  },
};
