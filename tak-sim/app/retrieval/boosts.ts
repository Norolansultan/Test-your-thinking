/**
 * The additive scores of the hybrid retrieval (`hybrid.ts`), split out of it at revision (bo) (25 Oct 2026) to keep it under 500
 * lines; unchanged: the recency boost (8 Oct 2026, D2(a)), the latest-state preference and the clock match (24 Oct 2026, D10). The
 * clock match's named-source check is `named-source.ts`'s `namesSource`, shared with the named-source rule.
 */

import { compareStrings } from "../engine/deterministic-object.js";
import type { InfoAtom } from "../scenario/types.js";
import { clockAt, recordText } from "../session/template-answer.js";
import type { ClockMatchConfig, LatestRecencyConfig, RecencyBoostConfig, RetrievalLang } from "./hybrid.js";
import { namesSource } from "./named-source.js";

const SECTOR_CODE = /\bL[1-4]\b/g;

/** Newer observation first, then the larger id: the same total order as the ranking's tie-break. */
function isNewer(a: InfoAtom, b: InfoAtom): boolean {
  return a.provenance.observedAt !== b.provenance.observedAt ? a.provenance.observedAt > b.provenance.observedAt : compareStrings(a.id, b.id) > 0;
}

/** The recency boost of each candidate (by position): the newest of its source and the newest of each sector it names. */
export function recencyBoosts(candidates: readonly InfoAtom[], boost: RecencyBoostConfig): number[] {
  const newestOfSource = new Map<string, number>();
  const newestOfSector = new Map<string, number>();
  const sectorsOf = candidates.map((a) => [...new Set(recordText(a.record).match(SECTOR_CODE) ?? [])]);
  const consider = (map: Map<string, number>, key: string, i: number) => {
    const held = map.get(key);
    if (held === undefined || isNewer(candidates[i]!, candidates[held]!)) map.set(key, i);
  };
  candidates.forEach((a, i) => {
    consider(newestOfSource, a.provenance.sourceId, i);
    for (const sec of sectorsOf[i]!) consider(newestOfSector, sec, i);
  });
  const out = candidates.map(() => 0);
  for (const i of newestOfSource.values()) out[i]! += boost.source;
  const sectorWinners = new Set<number>();
  for (const i of newestOfSector.values()) sectorWinners.add(i);
  for (const i of sectorWinners) out[i]! += boost.sector;
  return out;
}

/** The latest-state preference ({@link LatestRecencyConfig}) of each candidate (by position), from the base scores. */
export function latestBoosts(candidates: readonly InfoAtom[], base: readonly number[], latest: LatestRecencyConfig): number[] {
  const top = Math.max(0, ...base);
  const relevant = base.map((b) => top > 0 && b > 0 && b >= latest.relevance * top);
  const times = candidates.filter((_, i) => relevant[i]).map((a) => a.provenance.observedAt);
  const lo = Math.min(...times);
  const hi = Math.max(...times);
  return candidates.map((a, i) => (relevant[i] && hi > lo ? (latest.graded * (a.provenance.observedAt - lo)) / (hi - lo) : 0));
}

/** A record's clock as Haku and the model show it (`clockAt`, floored to the minute), in minutes after midnight. */
export function recordClockMinutes(atom: InfoAtom): number {
  const [h, m] = clockAt(atom.provenance.observedAt).split(".").map(Number) as [number, number];
  return h * 60 + m;
}

/** The clock match of each candidate: the nearest of the question's clocks decides ({@link ClockMatchConfig}). */
export function clockBoosts(candidates: readonly InfoAtom[], clocks: readonly number[], match: ClockMatchConfig, lexicalQuery: string, lang: RetrievalLang): number[] {
  const named = new Map<string, boolean>();
  return candidates.map((a) => {
    if (clocks.length === 0) return 0;
    const t = recordClockMinutes(a);
    const d = Math.min(...clocks.map((c) => Math.abs(t - c)));
    if (d > match.farMinutes) return 0;
    if (d > match.nearMinutes) return match.far;
    const id = a.provenance.sourceId;
    if (!named.has(id)) named.set(id, namesSource(lexicalQuery, id, lang));
    return match.near + (named.get(id) ? match.namedSource : 0);
  });
}
