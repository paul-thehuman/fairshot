import type { EvidenceSource } from "./types";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
}

export interface EvidenceSnippet extends EvidenceSource {
  content: string;
}

export async function searchEvidence(
  query: string,
  links: string[]
): Promise<EvidenceSnippet[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not set. Add it to .env.local.");
  }

  const scopedQuery =
    links.length > 0 ? `${query} ${links.join(" ")}` : query;

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: scopedQuery,
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tavily search failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as TavilyResponse;
  return data.results.map((r) => ({
    url: r.url,
    title: r.title,
    content: r.content,
  }));
}
