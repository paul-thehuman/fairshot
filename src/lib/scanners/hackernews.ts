import type { Scanner, RawDiscovery } from "./types";
import { keywordsFor } from "./types";

interface HnHit {
  objectID: string;
  title: string;
  author: string;
  points: number;
  num_comments: number;
  created_at: string;
  url: string | null;
}

export const hackerNewsScanner: Scanner = {
  source: "hackernews",
  async scan(thesis) {
    const since = Math.floor((Date.now() - 30 * 86_400_000) / 1000);
    const discoveries: RawDiscovery[] = [];
    const seenAuthors = new Set<string>();

    for (const keyword of keywordsFor(thesis, 2)) {
      const res = await fetch(
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keyword)}&tags=show_hn&numericFilters=created_at_i>${since},points>=20&hitsPerPage=5`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error(`HN Algolia ${res.status}`);
      const data = (await res.json()) as { hits: HnHit[] };

      for (const hit of data.hits ?? []) {
        if (seenAuthors.has(hit.author)) continue;
        seenAuthors.add(hit.author);
        const cleaned = hit.title.replace(/^Show HN:\s*/i, "");
        discoveries.push({
          source: "hackernews",
          name: hit.author,
          handles: { hn: hit.author, website: hit.url ?? undefined },
          ventureName: cleaned.split(/[–—:|-]/)[0].trim().slice(0, 60) || undefined,
          ventureOneLiner: cleaned,
          sectorHint: thesis.sectors[0],
          title: hit.title,
          content: `Show HN launch: ${hit.points} points, ${hit.num_comments} comments. Launched ${hit.created_at.slice(0, 10)}.`,
          url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          observedAt: hit.created_at,
        });
      }
    }
    return discoveries;
  },
};
