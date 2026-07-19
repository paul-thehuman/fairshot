import { getAll, logEvent, newId, now, upsert } from "./store";

// Publications probe: founders who write leave a public trail that LinkedIn
// walls off but RSS does not. Medium and Substack expose feeds for every
// author; most personal sites expose /feed or /rss. Recent posts become
// signals, so writing feeds the dossier exactly like code does.

const FEED_TIMEOUT_MS = 5000;
const MAX_FEEDS = 4;
const ITEMS_PER_FEED = 3;

function candidateFeeds(urls: string[]): string[] {
  const feeds = new Set<string>();
  for (const raw of urls) {
    if (!raw) continue;
    let url: URL;
    try {
      url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    } catch {
      continue;
    }
    const host = url.hostname.toLowerCase();
    if (host.endsWith("medium.com")) {
      const handle = url.pathname.match(/@([A-Za-z0-9_.-]+)/)?.[1];
      if (handle) feeds.add(`https://medium.com/feed/@${handle}`);
    } else if (host.endsWith(".substack.com")) {
      feeds.add(`https://${host}/feed`);
    } else if (
      !host.includes("github.com") &&
      !host.includes("linkedin.com") &&
      !host.includes("twitter.com") &&
      !host.includes("x.com")
    ) {
      // Personal site: probe the two conventional feed paths.
      feeds.add(`${url.origin}/feed`);
      feeds.add(`${url.origin}/rss`);
    }
  }
  return [...feeds].slice(0, MAX_FEEDS);
}

interface FeedItem {
  title: string;
  link?: string;
  date?: string;
  snippet: string;
}

function firstTag(block: string, tag: string): string | undefined {
  const m = block.match(
    new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, "i")
  );
  return m?.[1].trim() || undefined;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseFeed(xml: string): { feedTitle?: string; items: FeedItem[] } {
  const items: FeedItem[] = [];
  // RSS <item> and Atom <entry> both appear in the wild; handle both.
  const blocks = [
    ...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi),
    ...xml.matchAll(/<entry[\s>]([\s\S]*?)<\/entry>/gi),
  ];
  for (const b of blocks.slice(0, ITEMS_PER_FEED)) {
    const block = b[1];
    const title = firstTag(block, "title");
    if (!title) continue;
    const atomLink = block.match(/<link[^>]*href="([^"]+)"/i)?.[1];
    items.push({
      title: stripHtml(title),
      link: firstTag(block, "link") || atomLink,
      date: firstTag(block, "pubDate") || firstTag(block, "updated"),
      snippet: stripHtml(
        firstTag(block, "description") || firstTag(block, "summary") || ""
      ).slice(0, 300),
    });
  }
  const head = xml.split(/<item[\s>]|<entry[\s>]/i)[0];
  return { feedTitle: firstTag(head, "title"), items };
}

// Probe the given URLs for author feeds and ingest recent posts as signals.
// Entirely best-effort: a founder with no feed loses nothing.
export async function probePublications(
  founderId: string,
  urls: string[]
): Promise<number> {
  const feeds = candidateFeeds(urls);
  if (feeds.length === 0) return 0;

  const existingTitles = new Set(
    getAll("signals")
      .filter((s) => s.founderId === founderId)
      .map((s) => s.title)
  );
  let added = 0;

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const res = await fetch(feed, {
        headers: { "User-Agent": "fairshot-hackathon" },
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const body = await res.text();
      if (!/<(rss|feed|channel)[\s>]/i.test(body)) throw new Error("not a feed");
      return { feed, parsed: parseFeed(body) };
    })
  );

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const { feed, parsed } = r.value;
    for (const item of parsed.items) {
      const title = `${item.title}${parsed.feedTitle ? ` — ${parsed.feedTitle}` : ""}`;
      if (existingTitles.has(title)) continue;
      const observed = item.date ? new Date(item.date) : null;
      upsert("signals", {
        id: newId(),
        founderId,
        source: "publication",
        title,
        content:
          item.snippet ||
          `Published post found via ${new URL(feed).hostname}.`,
        url: item.link,
        observedAt:
          observed && !isNaN(observed.getTime()) ? observed.toISOString() : now(),
        ingestedAt: now(),
      });
      existingTitles.add(title);
      added += 1;
    }
  }

  if (added > 0) {
    logEvent(
      "enrichment.publications",
      `${added} published post(s) ingested from author feeds`,
      { founderId }
    );
  }
  return added;
}
