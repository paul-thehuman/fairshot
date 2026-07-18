import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  AxisScore,
  EventLog,
  Founder,
  FounderScoreRecord,
  Interview,
  Memo,
  Opportunity,
  Signal,
  StoredClaim,
  Thesis,
  TraitScore,
  Venture,
} from "./types";

// Memory lives in JSON files under data/, one per collection, behind this
// repository layer. Swapping to a real database touches only this file.

interface CollectionMap {
  founders: Founder;
  ventures: Venture;
  opportunities: Opportunity;
  signals: Signal;
  claims: StoredClaim;
  traitScores: TraitScore;
  founderScores: FounderScoreRecord;
  axisScores: AxisScore;
  theses: Thesis;
  interviews: Interview;
  memos: Memo;
  events: EventLog;
}

export type CollectionName = keyof CollectionMap;

const DATA_DIR = path.join(process.cwd(), "data");
const cache = new Map<CollectionName, unknown[]>();

function fileFor(name: CollectionName): string {
  return path.join(DATA_DIR, `${name}.json`);
}

function load<K extends CollectionName>(name: K): CollectionMap[K][] {
  const cached = cache.get(name);
  if (cached) return cached as CollectionMap[K][];
  let items: CollectionMap[K][] = [];
  try {
    items = JSON.parse(fs.readFileSync(fileFor(name), "utf8"));
  } catch {
    items = [];
  }
  cache.set(name, items);
  return items;
}

function persist(name: CollectionName, items: unknown[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${fileFor(name)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2));
  fs.renameSync(tmp, fileFor(name));
  cache.set(name, items);
}

export function newId(): string {
  return randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

export function getAll<K extends CollectionName>(name: K): CollectionMap[K][] {
  return [...load(name)];
}

export function getById<K extends CollectionName>(
  name: K,
  id: string
): CollectionMap[K] | undefined {
  return load(name).find((item) => (item as { id: string }).id === id);
}

export function upsert<K extends CollectionName>(
  name: K,
  item: CollectionMap[K]
): CollectionMap[K] {
  const items = load(name);
  const idx = items.findIndex(
    (existing) => (existing as { id: string }).id === (item as { id: string }).id
  );
  if (idx >= 0) items[idx] = item;
  else items.push(item);
  persist(name, items);
  return item;
}

export function patchById<K extends CollectionName>(
  name: K,
  id: string,
  patch: Partial<CollectionMap[K]>
): CollectionMap[K] | undefined {
  const existing = getById(name, id);
  if (!existing) return undefined;
  return upsert(name, { ...existing, ...patch });
}

export function replaceAll<K extends CollectionName>(
  name: K,
  items: CollectionMap[K][]
): void {
  persist(name, items);
}

export function logEvent(
  type: string,
  detail: string,
  refs?: Record<string, string>
): void {
  upsert("events", { id: newId(), type, detail, refs, at: now() });
}
