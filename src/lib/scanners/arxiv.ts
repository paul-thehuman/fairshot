import type { Scanner, RawDiscovery } from "./types";
import { keywordsFor } from "./types";

function between(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match?.[1]?.replace(/\s+/g, " ").trim();
}

export const arxivScanner: Scanner = {
  source: "arxiv",
  async scan(thesis) {
    const keyword = keywordsFor(thesis, 1)[0] ?? "ai";
    const query = encodeURIComponent(`cat:cs.AI AND all:"${keyword}"`);
    const res = await fetch(
      `https://export.arxiv.org/api/query?search_query=${query}&sortBy=submittedDate&sortOrder=descending&max_results=4`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error(`arXiv ${res.status}`);
    const xml = await res.text();

    const discoveries: RawDiscovery[] = [];
    for (const entry of xml.split("<entry>").slice(1)) {
      const title = between(entry, "title");
      const url = between(entry, "id");
      const published = between(entry, "published");
      const author = between(entry.split("<author>")[1] ?? "", "name");
      const summary = between(entry, "summary");
      if (!title || !author || !published) continue;

      discoveries.push({
        source: "arxiv",
        name: author,
        handles: {},
        ventureName: undefined,
        ventureOneLiner: title,
        sectorHint: thesis.sectors[0],
        title: `arXiv: ${title}`,
        content: `First author on a recent paper matching "${keyword}". ${summary?.slice(0, 280) ?? ""}`,
        url,
        observedAt: published,
      });
    }
    return discoveries;
  },
};
