import type { FounderHandles, SignalSource, Thesis } from "../types";

// A raw discovery is what any sourcing channel returns before Memory sees it:
// enough to identify a person, describe what they're building, and preserve
// the signal itself. The pipeline turns these into Founder + Venture +
// Opportunity + Signal records with dedup applied.
export interface RawDiscovery {
  source: SignalSource;
  name: string;
  handles: FounderHandles;
  ventureName?: string;
  ventureOneLiner?: string;
  sectorHint?: string;
  geographyHint?: string;
  title: string;
  content: string;
  url?: string;
  observedAt: string;
}

export interface Scanner {
  source: SignalSource;
  scan(thesis: Thesis): Promise<RawDiscovery[]>;
}

// Thesis sectors mapped to search keywords each channel can use.
const SECTOR_KEYWORDS: Record<string, string[]> = {
  "ai infrastructure": ["llm inference", "vector database"],
  "developer tools": ["ai developer tools", "ai cli"],
  "applied ai": ["ai agent"],
};

export function keywordsFor(thesis: Thesis, cap = 3): string[] {
  const out: string[] = [];
  for (const sector of thesis.sectors) {
    const mapped = SECTOR_KEYWORDS[sector.toLowerCase()];
    out.push(...(mapped ?? [sector.toLowerCase()]));
  }
  return [...new Set(out)].slice(0, cap);
}
