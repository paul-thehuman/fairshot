import { getById, upsert } from "./store";
import type { Thesis } from "./types";

export const DEFAULT_THESIS: Thesis = {
  id: "active",
  sectors: ["AI infrastructure", "developer tools", "applied AI"],
  stages: ["pre-seed"],
  geographies: ["Europe", "North America"],
  checkSizeUsd: 100_000,
  ownershipTargetPct: 7,
  riskAppetite: "balanced",
  convictionThreshold: 70,
};

export function loadThesis(): Thesis {
  return getById("theses", "active") ?? DEFAULT_THESIS;
}

export function saveThesis(patch: Partial<Thesis>): Thesis {
  const merged: Thesis = { ...loadThesis(), ...patch, id: "active" };
  upsert("theses", merged);
  return merged;
}
