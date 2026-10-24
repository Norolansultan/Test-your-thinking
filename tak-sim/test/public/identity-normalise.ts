/**
 * The expert-identity comparison's normalisation (`expert-identity.spec.ts`): what a session writes since a deliberate, documented
 * change, mapped back onto the records of the 0.12.0 run so the rest can be compared byte for byte.
 *
 * - SPEC/36 (0.14.0): `results_optin` is removed.
 * - The difficulty audit (23 Oct 2026, 0.15.0): the map-reading pretest's records (`map_pretest_*`), the practice feedback's records
 *   (`practice_feedback_shown` and its `briefing_advanced` "practice.feedback"), and the practice SPAM delivery's second item
 *   (`probe.s.practice.b`'s answer and confidence) are removed; the practice freeze's `missing` list loses the new
 *   `freeze.practice.forecast`; the header loses `mapPretest` and `practiceFeedback`.
 * - The header's 0.13.0 fields (`audience`, `scope`) and its `formatVersion` are dropped.
 * - Adopted before pilot 2 (24 Oct 2026, 0.16.0): the questionnaires' new items (`ADDED_ITEM_IDS`: the pre-session `sleep.hours` and
 *   `shift.recent`, the post-session `accuracy.perceived` and `influence.*`) are removed from `questionnaire_presented.itemIds` and
 *   `questionnaire_submitted.answers` (the driver leaves them blank). The hinge's fatigue item and the Haku chip write nothing unless
 *   used, and the driver uses neither; the session has no stratum.
 * - The play-test decisions (24 Oct 2026, a STIMULUS change, format unchanged; SPEC/18 (bg)): the four new pushed records' deliveries
 *   (`bubble_available` of `PLAYTEST_PUSHED`: DR1's birch-strip line in V3, P2's 15.00 forecast headline in V4, the reinforcements'
 *   ETAs in V5, the 17.05 situation picture in V9) are removed; their sources leave the views' `navSources` before the view in which
 *   the 0.12.0 run first listed them (P2 V9, TILANNEKUVA V11); V10's `missing` list names `area_growth_hour` as `area_total_hour`
 *   (the recast item, SPEC/08 (bg) bg.3). The two new T3 answers (EK11 14.08, EK16 18.45) are delivered only when asked and the
 *   driver asks no unit, so they write nothing here; the header's new text and the re-worded stems are not logged.
 * Then every record is renumbered in order (`seq` from 0, as the run writes them).
 *
 * The digests are taken per segment: before VP (`phase_entered` practice), VP with the training text after it (to `phase_entered`
 * phase_a), and the main session (V1 to the end). VP's digest leaves out the real-time fields (`tWallOffsetMs`, `dwellMs`): the
 * driver answers the second practice SPAM item one tick (1 s) later than the first, and the training text's dwell now belongs to the
 * feedback screen before it; nothing else in VP moves.
 */

import type { LogRecord } from "../../app/telemetry/log.js";
import { sha256Hex } from "../../app/telemetry/sha256.js";

const ADDED_KINDS: ReadonlySet<string> = new Set(["results_optin", "map_pretest_started", "map_pretest_answer", "map_pretest_completed", "practice_feedback_shown"]);
/** The play-test's new pushed story beats (24 Oct 2026; `demo-story.ts`), and the view from which 0.12.0 listed each new nav source. */
export const PLAYTEST_PUSHED: ReadonlySet<string> = new Set(["atom.demo.4.1", "atom.demo.6.2", "atom.demo.7.1", "atom.demo.12.2"]);
const PLAYTEST_SOURCE_FROM: Readonly<Record<string, number>> = { P2: 9, TILANNEKUVA: 11 };

/** 0.16.0's new questionnaire items (`app/session/questionnaire.ts` revision (bf)). */
const ADDED_ITEM_IDS: ReadonlySet<string> = new Set([
  "sleep.hours", "shift.recent", "accuracy.perceived",
  "influence.plan_views.haku", "influence.plan_views.thinker", "influence.answers.haku", "influence.answers.thinker",
]);

type Rec = { readonly seq: number; readonly tVirtual: unknown; readonly tWallOffsetMs: number; readonly kind: string; readonly detail: unknown };

export function normaliseForIdentity(records: readonly Rec[]): Rec[] {
  const kept: Rec[] = [];
  for (const r of records) {
    const d = r.detail as Record<string, unknown>;
    if (ADDED_KINDS.has(r.kind)) continue;
    if (r.kind === "briefing_advanced" && d.screenId === "practice.feedback") continue;
    if (d.probeId === "probe.s.practice.b") continue;
    if (r.kind === "bubble_available" && PLAYTEST_PUSHED.has(d.atomId as string)) continue;
    if (r.kind === "cycle_start" && Array.isArray(d.navSources)) {
      const cycle = d.cycle as number;
      kept.push({ ...r, detail: { ...d, navSources: (d.navSources as string[]).filter((s) => !(cycle < (PLAYTEST_SOURCE_FROM[s] ?? 0))) } });
      continue;
    }
    if (r.kind === "freeze_submitted" && d.cycle === 10 && Array.isArray(d.missing)) {
      kept.push({ ...r, detail: { ...d, missing: (d.missing as string[]).map((m) => (m === "freeze.10.area_growth_hour" ? "freeze.10.area_total_hour" : m)) } });
      continue;
    }
    if (r.kind === "session_started") {
      const { formatVersion: _v, audience: _a, scope: _s, mapPretest: _m, practiceFeedback: _p, ...rest } = d;
      kept.push({ ...r, detail: rest });
      continue;
    }
    if (r.kind === "questionnaire_presented") {
      kept.push({ ...r, detail: { ...d, itemIds: (d.itemIds as string[]).filter((id) => !ADDED_ITEM_IDS.has(id)) } });
      continue;
    }
    if (r.kind === "questionnaire_submitted") {
      kept.push({ ...r, detail: { ...d, answers: (d.answers as { itemId: string }[]).filter((a) => !ADDED_ITEM_IDS.has(a.itemId)) } });
      continue;
    }
    if (r.kind === "freeze_submitted" && d.cycle === 0 && Array.isArray(d.missing)) {
      kept.push({ ...r, detail: { ...d, missing: (d.missing as string[]).filter((m) => m !== "freeze.practice.forecast") } });
      continue;
    }
    kept.push(r);
  }
  return kept.map((r, i) => ({ ...r, seq: i }));
}

/** The three segments' digests of normalised records (see the module note). */
export function segmentDigests(records: readonly Rec[]): { readonly preVp: string; readonly vp: string; readonly main: string; readonly count: number } {
  const n = normaliseForIdentity(records);
  const at = (phase: string) => n.findIndex((r) => r.kind === "phase_entered" && (r.detail as { phase?: string }).phase === phase);
  const vpAt = at("practice"), mainAt = at("phase_a");
  if (vpAt < 0 || mainAt < vpAt) throw new Error("identity: no practice or phase-A boundary");
  const lines = (rs: readonly Rec[]) => rs.map((r) => JSON.stringify(r)).join("\n");
  const untimed = (r: Rec) => {
    const { dwellMs: _d, ...detail } = r.detail as Record<string, unknown>;
    const { tWallOffsetMs: _t, ...rest } = r;
    return { ...rest, detail };
  };
  return {
    preVp: sha256Hex(lines(n.slice(0, vpAt))),
    vp: sha256Hex(n.slice(vpAt, mainAt).map((r) => JSON.stringify(untimed(r))).join("\n")),
    main: sha256Hex(lines(n.slice(mainAt))),
    count: n.length,
  };
}

export type { LogRecord };
