import type { Scanner, RawDiscovery } from "./types";

// Channels without a public API (hackathon results, accelerator cohorts) are
// represented by authored discoveries, per the hybrid data strategy. Ruth
// Adler deliberately overlaps a founder already in Memory so every live scan
// demonstrates dedup merging in front of the judges.
const DISCOVERIES: RawDiscovery[] = [
  {
    source: "hackathon",
    name: "Noor Haddad",
    handles: { github: "noorhaddad" },
    ventureName: "Benchvec",
    ventureOneLiner: "Reproducible benchmark harness for vector search engines",
    sectorHint: "AI infrastructure",
    geographyHint: "Europe",
    title: "Berlin AI Infra Hack — Winner: Benchvec",
    content:
      "Won with a reproducible benchmark harness for vector databases; three infra teams asked to use it internally during judging.",
    observedAt: "2026-07-17T20:00:00Z",
  },
  {
    source: "accelerator",
    name: "Ruth Adler",
    handles: { github: "ruthadler", linkedin: "ruth-adler" },
    ventureName: "Driftboard",
    ventureOneLiner: "Catches fine-tuned model drift before users do",
    sectorHint: "AI infrastructure",
    geographyHint: "Europe",
    title: "Techstars London demo-day preview list",
    content:
      "Driftboard confirmed for September demo day; cohort mentor cites weekly shipped increments.",
    observedAt: "2026-07-17T09:00:00Z",
  },
];

export const syntheticScanner: Scanner = {
  source: "hackathon",
  async scan() {
    return DISCOVERIES;
  },
};
