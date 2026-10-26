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
 * - R6 (25 Oct 2026, SPEC/30 §4 (bi), a TIMING change, format unchanged): in a merged view the consult notice comes 5 s after the
 *   step boundary (70 s, scaled) instead of at 60 s, after the second step's burst. The driver records its plans after the minimum,
 *   so the notice still shows in every main view; in the merged views where it showed at its own moment (V2, V4, V11, V12, V14;
 *   V6's waited for the SPAM item, as before) its `consult_prompt_shown` is mapped back: `atViewSeconds` to the 60 s moment, `tVirtual`
 *   to the first step (− 1200 s), `tWallOffsetMs` by the 10 s (scaled) it moved, and its place to just before the view's
 *   `step_boundary_reached`.
 * - Revision (bk) (25 Oct 2026, a STIMULUS change, format unchanged; SPEC/30 (bk)): EK12's 14.08 report (V2) and EK11's 15.35 hose
 *   request (V5) are held for seeking, so their `bubble_available` records (`BK_HELD`) are put back where the 0.12.0 run wrote them;
 *   P2's dispatch (V5, a play-test beat) is recorded again, so it writes nothing to remove; V5's `missing` list names
 *   `freeze.5.reinforcements` as `freeze.5.wind_shift` (the item it replaced at the same place).
 * - Revision (bm) (25 Oct 2026, a STIMULUS change, format unchanged; SPEC/18 (bm)): the twelve "report filed" pointers write a
 *   `bubble_available` each (`BM_POINTERS`, `atom.ptr.*`), which are removed; the seven generated records they displaced from the
 *   stream (`BM_DISPLACED`, `SITE_SCENARIO.pointerDisplaced`) are put back where 0.12.0 wrote them, each just after the record 0.12.0
 *   delivered before it — EK14's 14.11 report after EK12's held 14.08 one, which is put back first, and EK14's 15.38 fuel request after
 *   EK11's held 15.35 request.
 * - Revision (bn) (25 Oct 2026, a STIMULUS change, format unchanged; SPEC/18 (bn)): the pointers are the command centre's (JOKE), so
 *   JOKE, a new source, leaves the views' `navSources`; V11 and V12 displace KY23's repeated 18.10 and 18.45 reports instead of VD1's
 *   18.13 drops and 18.51 pause (`BM_DISPLACED`, an air asset's change of state stays in the stream), each put back after the record
 *   0.12.0 delivered before it. The re-worded records (EK14's 16.35 line, EK11's 15.35 request) are not delivered, so nothing else moves.
 * - Revision (bp) (26 Oct 2026, format 0.18.0; SPEC/15 (bp) §bp.7–bp.8): the training incident takes the map training's step. Its
 *   records (`training_*`: 33 when no Search question is asked, plus 2 a question) are removed, and the wall time from its
 *   `training_started` to its `training_completed` (the intro to S5 left: every card, answer, exposure, feedback and S5's dwell) is
 *   taken out of every later record's wall offset, as the pretest it replaced took none (0.12.0's driver answered at once). The header's
 *   `trainingIncident` is dropped with the other added fields. VP has no freeze any more (its practice freeze is retired), so its
 *   segment's digest is re-baselined (`expert-identity.spec.ts`). Its two records (`freeze_started`, `freeze_submitted`: this driver
 *   submits at once) keep their places in the numbering (`VP_FREEZE_RECORDS`, before VP's SPAM prompt at 85 s, which followed the
 *   freeze at 69 s), so every later record keeps 0.12.0's `seq` and the main session's digest stands byte for byte.
 * Then every record is renumbered in order (`seq` from 0, as the run writes them).
 *
 * The digests are taken per segment: before VP (`phase_entered` practice), VP with the training text after it (to `phase_entered`
 * phase_a), and the main session (V1 to the end). VP's digest leaves out the real-time fields (`tWallOffsetMs`, `dwellMs`): the
 * driver answers the second practice SPAM item one tick (1 s) later than the first, and the training text's dwell now belongs to the
 * feedback screen before it; nothing else in VP moves.
 */

import type { LogRecord } from "../../app/telemetry/log.js";
import { sha256Hex } from "../../app/telemetry/sha256.js";

const ADDED_KINDS: ReadonlySet<string> = new Set(["results_optin", "map_pretest_started", "map_pretest_answer", "map_pretest_completed", "map_pretest_feedback_left", "practice_feedback_shown"]);
/** Revision (bp): the training incident's records, all with this prefix (SPEC/07 (bp)). */
export const TRAINING_PREFIX = "training_";
/** Revision (bp): the records VP's retired practice freeze wrote with this driver (`freeze_started`, `freeze_submitted`). */
export const VP_FREEZE_RECORDS = 2;
/**
 * The play-test's new pushed story beats (24 Oct 2026; `demo-story.ts`), and the view from which 0.12.0 listed each new nav source.
 * Revision (bk) (25 Oct 2026) took the fourth, P2's dispatch in V5 (`atom.demo.7.1`), out of the stream again: it is recorded, so it
 * writes no `bubble_available` and nothing is removed for it.
 */
export const PLAYTEST_PUSHED: ReadonlySet<string> = new Set(["atom.demo.4.1", "atom.demo.6.2", "atom.demo.12.2"]);
/** Revision (bk): the play-test beat held for seeking since (bk) (recorded; it was pushed only between (bg) and (bk)). */
export const BK_HELD_BEAT = "atom.demo.7.1";
const PLAYTEST_SOURCE_FROM: Readonly<Record<string, number>> = { P2: 9, TILANNEKUVA: 11 };
/**
 * Revision (bk) (25 Oct 2026, a STIMULUS change, format unchanged; SPEC/30 (bk), SPEC/18 (bk)): two generated reports the 0.12.0 run
 * delivered are held for seeking (recorded, `view-traffic.ts` HELD_FOR_SEEKING). Their deliveries are mapped back, each just after the
 * pushed record the 0.12.0 run delivered before it (same moment, same wall offset) as it logged them (`tier` T1_pushed).
 */
export const BK_HELD: readonly { readonly atomId: string; readonly sourceId: string; readonly after: string }[] = [
  { atomId: "evt.c03.021", sourceId: "EK12", after: "evt.c03.016" }, // V2: EK12's 14.08 report (south_flank)
  { atomId: "evt.c07.032", sourceId: "EK11", after: "evt.c07.031" }, // V5: EK11's 15.35 hose request (hose_short)
];

/** Revision (bm): the pointers' atoms (`app/scenario/pointers.ts`), whose deliveries are removed. */
export const BM_POINTER_PREFIX = "atom.ptr.";
/**
 * Revision (bm): the generated records the pointers displaced (`SITE_SCENARIO.pointerDisplaced`), each put back after the record 0.12.0
 * delivered before it in the same burst (a held record of (bk) when that is the one).
 */
export const BM_DISPLACED: readonly { readonly atomId: string; readonly sourceId: string; readonly after: string }[] = [
  { atomId: "evt.c03.029", sourceId: "EK14", after: "evt.c03.021" }, // V2: EK14's 14.11 north-edge report
  { atomId: "evt.c03.039", sourceId: "SPOT", after: "evt.c03.032" }, // V2: SPOT's 14.17 smoke column
  { atomId: "evt.c07.036", sourceId: "EK14", after: "evt.c07.032" }, // V5: EK14's 15.38 fuel request
  { atomId: "evt.c10.020", sourceId: "EK11", after: "evt.c10.017" }, // V7: EK11's 16.31 request for food and drink
  { atomId: "evt.c10.025", sourceId: "EK14", after: "evt.c10.024" }, // V7: EK14's 16.33 request for food and drink
  // Revision (bn) (review S10): KY23's repeats, no longer VD1's 18.13 drops (V11) and 18.51 pause (V12).
  { atomId: "evt.c15.027", sourceId: "KY23", after: "evt.c15.023" }, // V11: KY23's 18.10 north-edge report (a repeat of 17.09)
  { atomId: "evt.c17.010", sourceId: "KY23", after: "evt.c17.009" }, // V12: KY23's 18.45 north-edge report (a repeat)
];

/** Revision (bn): the command centre that acknowledges reports (`pointers.ts` POINTER_SENDER), a source 0.12.0 did not have. */
export const BN_SOURCE = "JOKE";

/** 0.16.0's new questionnaire items (`app/session/questionnaire.ts` revision (bf)). */
const ADDED_ITEM_IDS: ReadonlySet<string> = new Set([
  "sleep.hours", "shift.recent", "accuracy.perceived",
  "influence.plan_views.haku", "influence.plan_views.thinker", "influence.answers.haku", "influence.answers.thinker",
]);

type Rec = { readonly seq: number; readonly tVirtual: unknown; readonly tWallOffsetMs: number; readonly kind: string; readonly detail: unknown };

/** R6: the driver's 5 s preview minimum (`APP_OPTIONS`) scales the 120 s view: the 60 s moment and the merged views' 70 s one. */
const PREVIEW = (s: number) => (s * 5) / 120;
const CONSULT_AT = PREVIEW(60);
const CONSULT_AT_MERGED = PREVIEW(70);

export function normaliseForIdentity(records: readonly Rec[]): Rec[] {
  const kept: Rec[] = [];
  // The map training's time (25 Oct 2026, 0.17.0: its memory task shows its unit for 8 s before the driver can answer) is taken out of
  // every later record's wall offset, as the pretest it replaced took none (the driver answered it at once).
  let shiftMs = 0;
  let trainingFrom: number | null = null; // revision (bp): the training's start, wall offset (before any shift)
  const boundaryAt = new Map<number, number>(); // a view's `step_boundary_reached`, its place in `kept`
  for (const r0 of records) {
    const r = shiftMs > 0 ? { ...r0, tWallOffsetMs: r0.tWallOffsetMs - shiftMs } : r0;
    const d = r.detail as Record<string, unknown>;
    if (r.kind === "map_pretest_completed") shiftMs += d.durationMs as number;
    if (r.kind.startsWith(TRAINING_PREFIX)) {
      // Revision (bp): the training's records go; its wall time from the intro to S5 left comes out of every later offset.
      if (r.kind === "training_started" && trainingFrom === null) trainingFrom = r0.tWallOffsetMs;
      if (r.kind === "training_completed" && trainingFrom !== null) { shiftMs += r0.tWallOffsetMs - trainingFrom; trainingFrom = null; }
      continue;
    }
    if (r.kind === "step_boundary_reached") boundaryAt.set(d.cycle as number, kept.length);
    if (r.kind === "consult_prompt_shown" && d.atViewSeconds === CONSULT_AT_MERGED && boundaryAt.has(d.cycle as number)) {
      const at = boundaryAt.get(d.cycle as number)!;
      const moved = Math.round((CONSULT_AT_MERGED - CONSULT_AT) * 1000);
      kept.splice(at, 0, { ...r, tVirtual: (r.tVirtual as number) - 1200, tWallOffsetMs: r.tWallOffsetMs - moved, detail: { ...d, atViewSeconds: CONSULT_AT } });
      continue;
    }
    if (ADDED_KINDS.has(r.kind)) continue;
    if (r.kind === "briefing_advanced" && d.screenId === "practice.feedback") continue;
    if (d.probeId === "probe.s.practice.b") continue;
    if (r.kind === "bubble_available" && PLAYTEST_PUSHED.has(d.atomId as string)) continue;
    if (r.kind === "bubble_available" && (d.atomId as string).startsWith(BM_POINTER_PREFIX)) continue;
    if (r.kind === "bubble_available") {
      // (bk)'s held and (bm)'s displaced deliveries go back after the record 0.12.0 delivered before each, in a chain.
      const putBack = (b: Rec): void => {
        kept.push(b);
        const atomId = (b.detail as Record<string, unknown>).atomId;
        for (const h of [...BK_HELD, ...BM_DISPLACED].filter((x) => x.after === atomId)) putBack({ ...r, detail: { ...d, atomId: h.atomId, sourceId: h.sourceId, tier: "T1_pushed" } });
      };
      putBack(r);
      continue;
    }
    if (r.kind === "freeze_submitted" && d.cycle === 5 && Array.isArray(d.missing)) {
      kept.push({ ...r, detail: { ...d, missing: (d.missing as string[]).map((m) => (m === "freeze.5.reinforcements" ? "freeze.5.wind_shift" : m)) } });
      continue;
    }
    if (r.kind === "cycle_start" && Array.isArray(d.navSources)) {
      const cycle = d.cycle as number;
      kept.push({ ...r, detail: { ...d, navSources: (d.navSources as string[]).filter((s) => s !== BN_SOURCE && !(cycle < (PLAYTEST_SOURCE_FROM[s] ?? 0))) } });
      continue;
    }
    if (r.kind === "freeze_submitted" && d.cycle === 10 && Array.isArray(d.missing)) {
      kept.push({ ...r, detail: { ...d, missing: (d.missing as string[]).map((m) => (m === "freeze.10.area_growth_hour" ? "freeze.10.area_total_hour" : m)) } });
      continue;
    }
    if (r.kind === "session_started") {
      const { formatVersion: _v, audience: _a, scope: _s, mapPretest: _m, practiceFeedback: _p, trainingIncident: _t, ...rest } = d;
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
  // Revision (bp): VP's freeze's places in the numbering, when the run has none (a run of (bp) or later); see the module note.
  const hadVpFreeze = records.some((r) => r.kind === "freeze_started" && (r.detail as { cycle?: number }).cycle === 0);
  const vpPrompt = kept.findIndex((r) => (r.kind === "spam_prompt_shown" || r.kind === "cycle_end") && (r.detail as { cycle?: number }).cycle === 0);
  const gapAt = hadVpFreeze || vpPrompt < 0 ? kept.length : vpPrompt;
  return kept.map((r, i) => ({ ...r, seq: i + (i >= gapAt ? VP_FREEZE_RECORDS : 0) }));
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
