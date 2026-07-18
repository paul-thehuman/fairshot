export type ClaimCategory =
  | "traction"
  | "technical"
  | "experience"
  | "team"
  | "market";

export type Grade = "corroborated" | "weak_signal" | "unverifiable";

export interface Claim {
  id: string;
  text: string;
  category: ClaimCategory;
}

export interface EvidenceSource {
  url: string;
  title: string;
}

export interface GradedClaim extends Claim {
  grade: Grade;
  reasoning: string;
  sources: EvidenceSource[];
}

export interface ScoreBand {
  pct: number;
  band: "Strong evidence base" | "Mixed evidence" | "Largely unverifiable";
}

export interface FounderScoreResult {
  name: string;
  claims: GradedClaim[];
  score: ScoreBand;
  fairnessExclusions: string[];
  provider: string;
}

export interface IntakePayload {
  name: string;
  pitch: string;
  links: string[];
}
