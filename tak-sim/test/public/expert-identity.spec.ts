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
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TELEMETRY_FORMAT_VERSION } from "../../app/telemetry/record-kinds.js";
import { driveSession, newStudySession, wholeSession } from "./public-run.js";
import { segmentDigests } from "./identity-normalise.js";

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
/** The 0.12.0-equivalent run's segment digests (before VP; VP untimed; V1 to the end), 502 records after normalising. */
const SEGMENTS: Readonly<Record<"radio" | "reasoning_once" | "reasoning_intent", { readonly preVp: string; readonly vp: string; readonly main: string }>> = {
  radio: { preVp: "52a8cc6b1d7f0a13382feae3b6a6e314e9c6c7029d5c0fa152f92c5e9f28e989", vp: "6effae4c5809f23fbcaf3d5652e7690aa95e14971f8561e6ef6af734f7231c1d", main: "7e163e7a29e64182897c330d06a81dde65fc669211fb1cdc37e9bdc3a074188b" },
  reasoning_once: { preVp: "b4f442e551bf85b9c9dd21bd68970e933ce9049d1f1c6936b7e1fe358edc432b", vp: "9d94f124f82ded4130ee58b2b8459f22884ec9fea48ee330fca3ba0a4672be49", main: "27dde2d71ca55de1213c33865f57a1a21e45f09ae7e58d920e5430c3030ec964" },
  reasoning_intent: { preVp: "764a6256ca29c372f999bd9e3cfeb7b5732709d788e4898fb9ace6b23fc3beeb", vp: "9d94f124f82ded4130ee58b2b8459f22884ec9fea48ee330fca3ba0a4672be49", main: "b69b6c3ef0bb505b253d6b067b8afe43da68fa00b2654b0b0c326b7db34246fa" },
};

describe("an expert session is unchanged by the public-audience version (SPEC/35 §1)", () => {
  for (const cell of ["radio", "reasoning_once", "reasoning_intent"] as const) {
    it(`${cell}: the records are those of 0.12.0 except the header's new fields and the difficulty audit's deliberate additions`, async () => {
      const { o, records } = await wholeSession({ cell });
      expect(records).toHaveLength(515); // 0.12.0's 502, SPEC/36's `results_optin`, the difficulty audit's 12 (see the note above)
      const optIn = records.findIndex((r) => r.kind === "results_optin");
      expect(records[optIn]!.detail).toEqual({ optedIn: false });
      expect(records[optIn - 1]).toMatchObject({ kind: "questionnaire_submitted", detail: { questionnaireId: "post" } });
      expect(records[optIn + 1]!.kind).toBe("debrief_shown");
      // The difficulty audit's records, where they belong: the pretest after the pre-session item and before the intro video; the
      // feedback after VP's end and before the training; the second practice item inside VP's SPAM delivery.
      const kinds = records.map((r) => r.kind);
      const pre = kinds.findIndex((k, i) => k === "questionnaire_submitted" && (records[i]!.detail as { questionnaireId: string }).questionnaireId === "pre");
      expect(kinds.slice(pre + 1, pre + 9)).toEqual(["map_pretest_started", ...Array(6).fill("map_pretest_answer"), "map_pretest_completed"]);
      expect(records[pre + 9]).toMatchObject({ kind: "briefing_advanced", detail: { screenId: "briefing.video" } });
      const shown = kinds.indexOf("practice_feedback_shown");
      expect(records[shown - 2]).toMatchObject({ kind: "cycle_end", detail: { cycle: 0 } });
      expect(records[shown + 1]).toMatchObject({ kind: "briefing_advanced", detail: { screenId: "practice.feedback" } });
      expect(records.filter((r) => (r.detail as { probeId?: string }).probeId === "probe.s.practice.b").map((r) => r.kind)).toEqual(["spam_answered", "recall_confidence_submitted"]);
      const digests = segmentDigests(records);
      expect(digests.count).toBe(502);
      expect({ preVp: digests.preVp, vp: digests.vp, main: digests.main }).toEqual(SEGMENTS[cell]);
      // The header's new fields are present, with the expert defaults and the difficulty audit's two steps on (as the app sets them).
      expect(o.logHeader).toMatchObject({ formatVersion: TELEMETRY_FORMAT_VERSION, audience: "expert", scope: "full", mapPretest: true, practiceFeedback: true });
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
