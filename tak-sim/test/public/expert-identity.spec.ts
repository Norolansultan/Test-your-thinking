/**
 * SPEC/35 §1, §9 P1: the public-audience version changes nothing in an expert session. A whole study-shell session (consent, the
 * AI literacy test, the preflight, the pre-session item, the intro video, VP, the training, V1–V14 with the hinge, the post-session
 * questionnaire, the debrief, the end) is run in each cell with the options the app gives it, and its records are compared with
 * the same run's records before the layer was built (commit fccaa56, telemetry format 0.12.0): identical, byte for byte, except
 * the header's new fields (`audience`, `scope`) and its format version in `session_started`.
 *
 * Updated deliberately for SPEC/36 (23 Oct 2026, format 0.14.0): every session, expert sessions included, now has the results step
 * after the post-session questionnaire, which writes ONE new record, `results_optin {optedIn}`, just before `debrief_shown`. The
 * comparison removes that record and renumbers the records after it (seq − 1); everything else is still the 0.12.0 run's, byte for
 * byte (the same digests), so the stimulus and every measure are unchanged. The debrief text gained a paragraph, but its id (the
 * logged `textId`) did not change, so it is not visible here.
 *
 * Updated deliberately for the difficulty audit (23 Oct 2026, format 0.15.0; `docs/audits/2026-10-23-difficulty/`): every session
 * (expert sessions included, both groups) now has the map-reading pretest before VP, a fifth practice-freeze item (Haku only), a second
 * practice SPAM item (the measuring task) and the practice feedback screen after VP. The SCORED stimulus is unchanged: the main
 * session (V1 to the end) is byte for byte the 0.12.0 run's. The comparison (`identity-normalise.ts`) removes the new records and
 * renumbers, then compares three segments with digests taken from the same run at bca7002 (whose full-stream digest was `BEFORE`
 * below, i.e. 0.12.0's): before VP and the main session byte for byte, VP without its real-time fields (the driver answers the
 * second practice item one tick later; the training's dwell now belongs to the feedback screen). 515 records: 0.12.0's 502,
 * SPEC/36's `results_optin`, the pretest's 8, the feedback's 2 and the second practice item's 2. The text-only changes (the tour's
 * log, Haku and V1 steps; the overlay's larger labels, sector names and settlement labels; the measure step) write no record.
 *
 * Updated deliberately for the changes adopted before pilot 2 (24 Oct 2026, format 0.16.0): the questionnaires carry new items (the
 * pre-session sleep and shift items, the post-session self-estimate and perceived-influence items), which the comparison removes from
 * the two questionnaires' records (`identity-normalise.ts`). The Haku chip (Haku group, V8–V14) and the hinge's fatigue item write
 * records only when used, and this driver uses neither.
 * Updated deliberately for the play-test decisions (24 Oct 2026, a STIMULUS change; SPEC/08 (bg), SPEC/18 (bg)): four new pushed
 * records (V3, V4, V5, V9) write four `bubble_available` records more (519), their sources (P2, TILANNEKUVA) are listed in earlier
 * views' `navSources`, and V10's recast item has a new id. The normaliser maps exactly those back (`identity-normalise.ts`), and every
 * other record is still the 0.12.0 run's byte for byte: the same three segment digests. The re-worded stems and options, the freeze
 * header's text and the two new answers given only when a unit is asked write no record here.
 * Updated deliberately for R6 (25 Oct 2026, a TIMING change, format unchanged; SPEC/30 §4 (bi)): in a merged view the consult notice
 * comes after the step boundary's burst (70 s instead of 60 s). The driver records its plans after the minimum, so the notice shows
 * in every main view as before; the five merged views' `consult_prompt_shown` records that moved are mapped back
 * (`identity-normalise.ts`), and every other record is still the 0.12.0 run's byte for byte: the same three segment digests.
 * Updated deliberately for the map training (25 Oct 2026, format 0.17.0; SPEC/08 (bj), SPEC/07 (bj)): the pretest's step now holds
 * seven training tasks, each with its first answer and its feedback left — 16 records where the pretest wrote 8 (527) — and its memory
 * task shows a unit for 8 s before the driver can answer, so every later record's wall offset is 8 s later. The normaliser removes the
 * step's records (`map_pretest_feedback_left` added to them) and takes the training's `durationMs` out of the later offsets; the
 * three segment digests and the 502 records stand.
 * Updated deliberately for revision (bk) (25 Oct 2026, a STIMULUS change, format unchanged; SPEC/30 (bk), SPEC/18 (bk)): three pushed
 * records are held for seeking (recorded) — EK12's 14.08 report (V2), EK11's 15.35 hose request and P2's dispatch (V5, a play-test beat)
 * — so the session writes three `bubble_available` records fewer (524), and V5's `wind_shift` is replaced at its place by
 * `reinforcements`. The normaliser puts the two generated reports' deliveries back where 0.12.0 wrote them and maps the item id back
 * (`identity-normalise.ts`); the dispatch was not in 0.12.0. Every other record is still the 0.12.0 run's: the same three digests.
 * Updated deliberately for revision (bm) (25 Oct 2026, a STIMULUS change, format unchanged; SPEC/18 (bm)): the twelve "report filed"
 * pointers are pushed (twelve `bubble_available` records more) and displace seven routine generated records from the stream (seven
 * fewer): 529. The normaliser removes the pointers' deliveries and puts the displaced ones back where 0.12.0 wrote them
 * (`identity-normalise.ts`); every other record is still the 0.12.0 run's: the same three digests. The pointer mark itself never
 * reaches the log (a `bubble_available` names the atom only).
 * Updated deliberately for revision (bn) (25 Oct 2026, a STIMULUS change, format unchanged; SPEC/18 (bn)): the pointers are the command
 * centre's acknowledgements (source JOKE, kept out of `navSources`), and V11 and V12 displace KY23's repeated reports instead of VD1's
 * drops and pause; still 529 records, and the normaliser maps both back (`identity-normalise.ts` `BM_DISPLACED`, `BN_SOURCE`): the same
 * three digests.
 * Updated deliberately for revision (bp) (26 Oct 2026, format 0.18.0; SPEC/15 (bp), SPEC/07 (bp)): the training incident takes the map
 * training's step, VP is the first look with NO practice freeze, and the practice feedback is retired. The driver answers the training
 * (`public-run.ts` `trainingStep`); the normaliser removes its `training_*` records and takes its wall time (the intro to S5 left) out of
 * every later record's offset (`identity-normalise.ts`). The pre-VP and main digests stand byte for byte. VP'S DIGEST IS RE-BASELINED,
 * once, for one reason: VP's practice freeze is gone (its `freeze_started` and `freeze_submitted` with cycle 0 — this driver submits at once —
 * are no longer written; 500 records after normalising, was 502); every other VP record is unchanged. The new VP digests were
 * taken on the package-C branch (the old orchestrator without the map training's and the practice feedback's options); the integration
 * commit re-runs this test after merging A, B and C and confirms them (SPEC/15 §bp.8). Until the merge this tree has neither the
 * training's content nor its orchestrator methods (`TRAINING_IN_TREE`): the training's own assertions then check that the session runs
 * without it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TELEMETRY_FORMAT_VERSION } from "../../app/telemetry/record-kinds.js";
import { driveSession, newStudySession, TRAINING_IN_TREE, wholeSession } from "./public-run.js";
import { TRAINING } from "../../app/session/training/spec-data.js";
import { BK_HELD, BK_HELD_BEAT, BM_DISPLACED, BM_POINTER_PREFIX, PLAYTEST_PUSHED, segmentDigests } from "./identity-normalise.js";
import { POINTERS } from "../../app/scenario/pointers.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * The full-stream digests of the same runs at fccaa56 (before SPEC/35 P1): 502 records each. The bca7002 run (SPEC/36) still matched
 * them once `results_optin` was removed; the segment digests below were taken from that run (`identity-normalise.ts`).
 */
export const BEFORE: Readonly<Record<"radio" | "reasoning_once" | "reasoning_intent", string>> = {
  radio: "b0a7259d27a6e269585745d12f47a5220ed95e2c6f7d72039f16023b4675fd46",
  reasoning_once: "16221cec25e37ce70aeeeb97cfa6774bdf314eba280bd02a80c4ea1e3f2d96ee",
  reasoning_intent: "e35af1bf9d6301e75f702dbb33dd5d642c70ca372cc54e540d750957eda977ec",
};
/**
 * The 0.12.0-equivalent run's segment digests (before VP; VP untimed; V1 to the end). Revision (bp): VP's re-baselined (no practice
 * freeze; see the note above), 500 records after normalising; before VP and from V1 the 0.12.0 run's, unchanged.
 */
const SEGMENTS: Readonly<Record<"radio" | "reasoning_once" | "reasoning_intent", { readonly preVp: string; readonly vp: string; readonly main: string }>> = {
  radio: { preVp: "52a8cc6b1d7f0a13382feae3b6a6e314e9c6c7029d5c0fa152f92c5e9f28e989", vp: "4ff00fb560ddf898832b9f3cd63df618f87e32bd70414aae0fe7bb10451bf29c", main: "7e163e7a29e64182897c330d06a81dde65fc669211fb1cdc37e9bdc3a074188b" },
  reasoning_once: { preVp: "b4f442e551bf85b9c9dd21bd68970e933ce9049d1f1c6936b7e1fe358edc432b", vp: "031efa9d13a82f7f5ef09530ac7e03c864e93eb10429d9d6fab014b53b7d6101", main: "27dde2d71ca55de1213c33865f57a1a21e45f09ae7e58d920e5430c3030ec964" },
  reasoning_intent: { preVp: "764a6256ca29c372f999bd9e3cfeb7b5732709d788e4898fb9ace6b23fc3beeb", vp: "031efa9d13a82f7f5ef09530ac7e03c864e93eb10429d9d6fab014b53b7d6101", main: "b69b6c3ef0bb505b253d6b067b8afe43da68fa00b2654b0b0c326b7db34246fa" },
};
/** The VP digests of 0.12.0 to revision (bp), with VP's practice freeze: kept for the record. */
export const VP_BEFORE_BP: Readonly<Record<"radio" | "thinker", string>> = {
  radio: "6effae4c5809f23fbcaf3d5652e7690aa95e14971f8561e6ef6af734f7231c1d", thinker: "9d94f124f82ded4130ee58b2b8459f22884ec9fea48ee330fca3ba0a4672be49",
};

/** Revision (bp): the training's records when no Search question is asked (SPEC/07 (bp)): 1 started, 4 cards, 13 × 2, 1 S5, 1 completed. */
const TRAINING_KINDS: readonly string[] = [
  "training_started",
  ...TRAINING.sections.filter((x) => x.id !== "s5").flatMap((x) => ["training_section_left", ...x.itemIds.flatMap(() => ["training_answer", "training_feedback_left"])]),
  "training_demo_shown", "training_completed",
];

describe("an expert session is unchanged by the public-audience version (SPEC/35 §1)", () => {
  for (const cell of ["radio", "reasoning_once", "reasoning_intent"] as const) {
    it(`${cell}: the records are those of 0.12.0 except the header's new fields and the difficulty audit's deliberate additions`, async () => {
      const { o, records } = await wholeSession({ cell });
      // 0.12.0's 502, SPEC/36's `results_optin`, the play-test's 3 pushed records, revision (bk)'s 2 held, revision (bm)'s 12 pointers and 7
      // displaced, VP's second practice SPAM item's 2; revision (bp): no map training (16), no practice feedback (2), no VP freeze (2); the
      // training incident's 33 once it is in the tree (see the notes above).
      expect(records).toHaveLength(509 + (TRAINING_IN_TREE ? TRAINING_KINDS.length : 0));
      const optIn = records.findIndex((r) => r.kind === "results_optin");
      expect(records[optIn]!.detail).toEqual({ optedIn: false });
      expect(records[optIn - 1]).toMatchObject({ kind: "questionnaire_submitted", detail: { questionnaireId: "post" } });
      expect(records[optIn + 1]!.kind).toBe("debrief_shown");
      // Revision (bp): the training incident where the map training was — after the pre-session item, before the intro video — its 33
      // records in their order; no map training, no practice feedback, no VP freeze; the second practice item still inside VP's SPAM delivery.
      const kinds = records.map((r) => r.kind);
      const pre = kinds.findIndex((k, i) => k === "questionnaire_submitted" && (records[i]!.detail as { questionnaireId: string }).questionnaireId === "pre");
      const training = TRAINING_IN_TREE ? TRAINING_KINDS : [];
      expect(kinds.slice(pre + 1, pre + 1 + training.length)).toEqual(training);
      expect(records[pre + 1 + training.length]).toMatchObject({ kind: "briefing_advanced", detail: { screenId: "briefing.video" } });
      expect(kinds.filter((k) => k.startsWith("training_")).length).toBe(training.length);
      expect(kinds.filter((k) => k.startsWith("map_pretest_") || k === "practice_feedback_shown")).toEqual([]);
      expect(records.filter((r) => r.kind.startsWith("freeze_") && (r.detail as { cycle?: number }).cycle === 0)).toEqual([]);
      expect(records.some((r) => r.kind === "briefing_advanced" && (r.detail as { screenId: string }).screenId === "practice.feedback")).toBe(false);
      expect(records.filter((r) => (r.detail as { probeId?: string }).probeId === "probe.s.practice.b").map((r) => r.kind)).toEqual(["spam_answered", "recall_confidence_submitted"]);
      // The play-test's three pushed records, once each (SPEC/18 (bg)); revision (bk)'s held records never delivered (SPEC/30 (bk)).
      expect(records.filter((r) => r.kind === "bubble_available" && PLAYTEST_PUSHED.has((r.detail as { atomId: string }).atomId)).map((r) => (r.detail as { atomId: string }).atomId).sort()).toEqual([...PLAYTEST_PUSHED].sort());
      const held = new Set([BK_HELD_BEAT, ...BK_HELD.map((h) => h.atomId)]);
      expect(records.filter((r) => r.kind === "bubble_available" && held.has((r.detail as { atomId: string }).atomId))).toEqual([]);
      // Revision (bm): every pointer delivered once, with no more than any delivery says (the atom, its tier and source); the displaced never.
      const pointerDeliveries = records.filter((r) => r.kind === "bubble_available" && (r.detail as { atomId: string }).atomId.startsWith(BM_POINTER_PREFIX));
      expect(pointerDeliveries.map((r) => (r.detail as { atomId: string }).atomId).sort()).toEqual(POINTERS.map((p) => p.id).sort());
      for (const r of pointerDeliveries) expect(Object.keys(r.detail as object).sort()).toEqual(["atomId", "mapPosition", "sourceId", "tier"]);
      expect(BM_DISPLACED.map((x) => x.atomId).sort()).toEqual([...(SITE_SCENARIO.pointerDisplaced ?? [])].sort());
      const displaced = new Set(BM_DISPLACED.map((x) => x.atomId));
      expect(records.filter((r) => r.kind === "bubble_available" && displaced.has((r.detail as { atomId: string }).atomId))).toEqual([]);
      const digests = segmentDigests(records);
      expect(digests.count).toBe(500); // 0.12.0's 502 without VP's practice freeze (2)
      expect({ preVp: digests.preVp, vp: digests.vp, main: digests.main }).toEqual(SEGMENTS[cell]);
      // The header's new fields are present, with the expert defaults and (revision (bp)) the training on (as the app sets it).
      expect(o.logHeader).toMatchObject({ formatVersion: TELEMETRY_FORMAT_VERSION, audience: "expert", scope: "full", ...(TRAINING_IN_TREE ? { trainingIncident: true } : {}) });
      expect(o.logHeader).not.toHaveProperty("mapPretest");
      expect(o.logHeader).not.toHaveProperty("practiceFeedback");
      expect(records[0]!.detail).toEqual(o.logHeader);
      expect(records.some((r) => ["primer_page", "primer_check", "glossary_opened", "help_card_opened", "profile_shown"].includes(r.kind))).toBe(false);
    }, 60_000);
  }

  it("a session given `audience: \"expert\"` and `scope: \"full\"` explicitly writes the same records as one given neither", async () => {
    const a = await wholeSession({});
    const b = await wholeSession({ audience: "expert", scope: "full" });
    expect(b.records.map((r) => JSON.stringify(r))).toEqual(a.records.map((r) => JSON.stringify(r)));
  }, 60_000);

  it("the explanation layer's callbacks write nothing in an expert session, and it has no primer", async () => {
    vi.setSystemTime(0);
    const { o, snap } = newStudySession({});
    await o.start();
    await driveSession(o, snap, ["exploration"]);
    expect(snap().practice).toBe(true);
    const before = (await o.logRecords()).length;
    await o.recordAudienceEvent({ kind: "glossary_opened", termId: "fire.head", surface: "message_log" });
    await o.recordAudienceEvent({ kind: "help_card_opened", section: "glossary" });
    expect(await o.logRecords()).toHaveLength(before);
    await expect(o.primerPage("p1.role", 1_000)).rejects.toThrow(/expert session has no primer/);
    await expect(o.finishPrimer()).rejects.toThrow(/finishPrimer in step/);
  });
});
