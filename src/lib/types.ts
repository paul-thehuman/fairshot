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

// --- FairShot core model ---
// People persist; ventures come and go. The split is what makes the Founder Score durable.

export type FounderOrigin = "inbound" | "outbound";

export interface FounderHandles {
  github?: string;
  linkedin?: string;
  website?: string;
  hn?: string;
}

export interface Founder {
  id: string;
  name: string;
  handles: FounderHandles;
  origin: FounderOrigin;
  bio?: string;
  synthetic?: boolean; // authored demo profile, not a real person
  createdAt: string;
}

export interface Venture {
  id: string;
  founderId: string;
  name: string;
  oneLiner: string;
  sector: string;
  geography: string;
  stage: string;
  createdAt: string;
}

export type OppStatus = "sourced" | "screened" | "interview" | "diligence" | "decision";
export type Decision = "invest" | "pass" | "watch";

export interface Opportunity {
  id: string;
  ventureId: string;
  founderId: string;
  status: OppStatus;
  decision?: Decision;
  convictionScore?: number;
  convictionRationale?: string;
  statusHistory: { status: OppStatus; at: string }[];
  createdAt: string;
}

export type SignalSource =
  | "github"
  | "hackernews"
  | "arxiv"
  | "hackathon"
  | "accelerator"
  | "application"
  | "interview"
  | "web"
  | "publication"
  | "founder_supplied";

export interface Signal {
  id: string;
  founderId?: string;
  source: SignalSource;
  url?: string;
  title: string;
  content: string;
  observedAt: string;
  ingestedAt: string;
}

export type ClaimOrigin = "pitch" | "interview" | "signal";

// A claim in Memory. Grading fields are absent until the evidence engine has run.
export interface StoredClaim extends Claim {
  opportunityId: string;
  founderId: string;
  origin: ClaimOrigin;
  grade?: Grade;
  reasoning?: string;
  sources?: EvidenceSource[];
}

export type Trait = "ability" | "aspiration" | "learning_agility" | "accountability";
export type TraitConfidence = "high" | "medium" | "low" | "insufficient";

export interface TraitScore {
  id: string;
  founderId: string;
  opportunityId: string;
  trait: Trait;
  score: number | null; // 0-100; null when confidence is 'insufficient'
  confidence: TraitConfidence;
  rationale: string;
  evidenceClaimIds: string[];
  assessedAt: string;
}

export interface FounderScoreRecord {
  id: string; // same as founderId, one record per person
  founderId: string;
  score: number;
  history: { score: number; at: string; reason: string }[];
}

export type Axis = "founder" | "market" | "idea_market";
export type Trend = "improving" | "stable" | "declining";

export interface AxisScore {
  id: string;
  opportunityId: string;
  axis: Axis;
  rating: string;
  trend: Trend;
  rationale: string;
  evidenceRefs: string[];
  assessedAt: string;
}

export interface Thesis {
  id: string; // always 'active'
  sectors: string[];
  stages: string[];
  geographies: string[];
  checkSizeUsd: number;
  ownershipTargetPct: number;
  riskAppetite: "conservative" | "balanced" | "aggressive";
  convictionThreshold: number; // 0-100; crossing it triggers an interview invitation
}

export interface InterviewQuestion {
  trait: Trait;
  question: string;
  why: string; // which evidence gap this question targets; powers traceability
}

// A live fact-check performed on the founder's previous answer, attached to
// the agent turn that follows it. Grade and sources obey the same rule as
// everywhere else: only URLs actually retrieved may be cited.
export interface TurnCheck {
  claim: string;
  grade: Grade;
  sourceUrl?: string;
  sourceTitle?: string;
}

export interface InterviewTurn {
  role: "agent" | "founder";
  text: string;
  at: string;
  check?: TurnCheck;
}

export type InterviewStatus = "invited" | "in_progress" | "complete";

export interface FounderFeedback {
  strengths: string[];
  thinEvidence: string[];
  nextSteps: string[];
}

// Shown to the founder before the interview begins: what it will dig into and
// what evidence is worth having to hand. Derived deterministically from the
// planned questions and graded claims already in Memory — never invented, and
// never coaching on how to score better, only what to bring.
export interface InterviewBrief {
  focusAreas: { trait: Trait; label: string; why: string }[];
  couldNotVerify: string[]; // claims we hold but could not confirm from public sources
  bringThese: string[];
  hasPublicEvidence: boolean; // false for a true cold-start founder
}

export interface Interview {
  id: string;
  opportunityId: string;
  founderId: string;
  plannedQuestions: InterviewQuestion[];
  turns: InterviewTurn[];
  status: InterviewStatus;
  currentQuestion?: number;
  followUpsUsed?: number;
  extractedClaimIds: string[];
  feedback?: FounderFeedback;
  createdAt: string;
}

export interface Memo {
  id: string; // same as opportunityId
  opportunityId: string;
  snapshot: string;
  hypotheses: string[];
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  problemProduct: string;
  tractionKpis: string;
  gaps: string[]; // explicitly flagged missing data, never silently omitted
  recommendation: { verdict: Decision; thesisFit: string; rationale: string };
  generatedAt: string;
}

export interface EventLog {
  id: string;
  type: string;
  detail: string;
  refs?: Record<string, string>;
  at: string;
}
