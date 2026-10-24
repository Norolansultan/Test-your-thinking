/**
 * `31` F18, F30 (19 Oct 2026; analysis only, never on screen): which freeze items measure retrieval as well as perception. An item whose
 * every key record reaches a participant only by a search — none pushed — is flagged `retrievalDependent`; the analysis reports such items
 * conditional on their exposure (`freezeItemExposure`, WP-3). One rule for the bank's items and the infrastructure slot (`demo-probes.ts`
 * applies it to both); `test/scenario/freeze-rules.spec.ts` checks it against the built scenario's pushed atoms.
 */

import { sortedEntries } from "../engine/deterministic-object.js";
import { CYCLE_STORY, isPushedBeat } from "./demo-story.js";
import { SITE_SCENARIO } from "./site-scenario.js";
import { DESIGNED_EVENT_IDS, type FreezeItem } from "./types.js";

/**
 * The ids of the records that reach a participant only by a search: generated traffic below T1 (the forecasts `evt.wx.*` among them), crew
 * radio not pushed, story beats not pushed (marked `recorded`, or a crew's answer when `asked`: the play-test CO readings, 24 Oct 2026),
 * and F7's two designed records (the grid operator's log and HELI1's line clearance, T2).
 */
const RECORDED_IDS: ReadonlySet<string> = new Set([
  ...SITE_SCENARIO.traffic.filter((x) => x.tier !== "T1_pushed").map((x) => x.id),
  ...SITE_SCENARIO.radio.flatMap((r) => (r.pushed ? [] : [`atom.radio.${r.cycle}.${SITE_SCENARIO.radio.filter((q) => q.cycle === r.cycle).indexOf(r)}`])),
  ...sortedEntries(CYCLE_STORY).flatMap(([step, v]) => v.bubbles.flatMap((b, k) => (isPushedBeat(b) ? [] : [`atom.demo.${step}.${k}`]))),
  DESIGNED_EVENT_IDS.gridRecord, DESIGNED_EVENT_IDS.heliLineClearance,
]);

/** Whether every one of the (non-empty) key records is recorded-only. */
export function allRecordedOnly(keyAtomIds: readonly string[]): boolean {
  return keyAtomIds.length > 0 && keyAtomIds.every((id) => RECORDED_IDS.has(id));
}

/** The item with `retrievalDependent: true` when every key record is recorded-only; otherwise unchanged. */
export function withRetrievalFlag(item: FreezeItem): FreezeItem {
  return allRecordedOnly(item.keyAtomIds ?? []) ? { ...item, retrievalDependent: true } : item;
}
