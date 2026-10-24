/**
 * SPEC/35 P1: a public session's flow — consent … the pre-session item → the primer → the intro video → VP … V14 → the
 * post-session questionnaire → the results step (SPEC/36) → the debrief → the end, the commander profile between the results step
 * and the debrief only with `immediateProfile` (`?profiili=heti`, SPEC/36: off by default); `scope: "phaseA"` ends at the hinge
 * (after V7); the explanation layer's records; and the stimulus unchanged: between VP's start and the last view's end a public
 * session writes exactly an expert session's records, plus the layer's own.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogRecord } from "../../app/telemetry/log.js";
import type { BriefingAdvancedDetail, CycleStartDetail } from "../../app/telemetry/record-kinds.js";
import { APP_OPTIONS, driveSession, driveStep, kinds, newStudySession, passPretest, wholeSession } from "./public-run.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const LAYER_KINDS = new Set(["primer_page", "primer_check", "glossary_opened", "help_card_opened", "profile_shown"]);
const transitions = (records: readonly LogRecord[]) => records.filter((r) => r.kind === "state_transition").map((r) => (r.detail as { trigger: string }).trigger);
const index = (records: readonly LogRecord[], pred: (r: LogRecord) => boolean) => records.findIndex(pred);
const screenIs = (id: string) => (r: LogRecord) => r.kind === "briefing_advanced" && (r.detail as BriefingAdvancedDetail).screenId === id;
const mainViews = (records: readonly LogRecord[]) => records.filter((r) => r.kind === "cycle_start").map((r) => (r.detail as CycleStartDetail).cycle);

/** The records from VP's start to the last view's end, without the layer's own: what the participant was shown and did. */
function stimulus(records: readonly LogRecord[]): string[] {
  const from = index(records, (r) => r.kind === "cycle_start");
  const to = records.length - 1 - [...records].reverse().findIndex((r) => r.kind === "cycle_end");
  return records.slice(from, to + 1).filter((r) => !LAYER_KINDS.has(r.kind)).map(({ tVirtual, tWallOffsetMs, kind, detail }) => JSON.stringify({ tVirtual, tWallOffsetMs, kind, detail }));
}

describe("a public session (SPEC/35 §3–§5)", () => {
  it("runs the primer before the intro video and VP; with `?profiili=heti` the profile after the results step and before the debrief", async () => {
    const { o, records } = await wholeSession({ audience: "public", immediateProfile: true });
    expect(o.logHeader).toMatchObject({ audience: "public", scope: "full", formatVersion: "0.16.0", immediateProfile: true, mapPretest: true });
    const at = {
      pre: index(records, (r) => r.kind === "questionnaire_submitted" && (r.detail as { questionnaireId: string }).questionnaireId === "pre"),
      firstPage: index(records, (r) => r.kind === "primer_page"),
      primerLeft: index(records, screenIs("briefing.primer")),
      // Difficulty audit (23 Oct 2026): the map-reading pretest after the primer, before the intro video.
      pretest: index(records, (r) => r.kind === "map_pretest_started"),
      video: index(records, screenIs("briefing.video")),
      vp: index(records, (r) => r.kind === "cycle_start"),
      post: index(records, (r) => r.kind === "questionnaire_submitted" && (r.detail as { questionnaireId: string }).questionnaireId === "post"),
      optIn: index(records, (r) => r.kind === "results_optin"),
      profile: index(records, (r) => r.kind === "profile_shown"),
      debrief: index(records, (r) => r.kind === "debrief_shown"),
      completed: index(records, (r) => r.kind === "session_completed"),
    };
    expect(Object.values(at).every((i) => i >= 0)).toBe(true);
    expect([at.pre, at.firstPage, at.primerLeft, at.pretest, at.video, at.vp, at.post, at.optIn, at.profile, at.debrief, at.completed]).toEqual([...Object.values(at)].sort((a, b) => a - b));
    expect(at.pretest).toBe(at.primerLeft + 1);
    expect(records[at.video - 1]!.kind).toBe("map_pretest_completed");
    expect(at.optIn).toBe(at.post + 1);
    expect(at.profile).toBe(at.optIn + 1);
    expect(at.debrief).toBe(at.profile + 1);
    expect(kinds(records.slice(at.pre + 1, at.primerLeft + 1))).toEqual(["primer_page", "primer_check", "primer_check", "primer_page", "briefing_advanced"]);
    expect(records.slice(at.firstPage, at.primerLeft).map((r) => r.detail)).toEqual([
      { pageId: "p1.role", dwellMs: 4_000 },
      { questionId: "q1.role", chosen: 2, correct: false, attempt: 1 },
      { questionId: "q1.role", chosen: 0, correct: true, attempt: 2 },
      { pageId: "p2.units", dwellMs: 3_000 },
    ]);
    expect(records[at.primerLeft]!.detail).toEqual({ screenId: "briefing.primer", dwellMs: expect.any(Number) });
    expect(records[at.profile]!.detail).toEqual({});
    expect(records[at.debrief]!.detail).toEqual({ textId: "debrief.public.full" });
    expect(records.find((r) => r.kind === "consent_decided")!.detail).toMatchObject({ textId: "consent.public.placeholder.v0" });
    expect(mainViews(records)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(o.engineState).toBe("COMPLETE");
  }, 60_000);

  it("the stimulus is an expert session's: from VP's start to V14's end the same records at the same moments, in every cell", async () => {
    for (const cell of ["radio", "reasoning_intent"] as const) {
      const expert = await wholeSession({ cell });
      const pub = await wholeSession({ cell, audience: "public" });
      expect(stimulus(pub.records)).toEqual(stimulus(expert.records));
    }
  }, 120_000);

  it("without `?profiili=heti` (the default, SPEC/36) no profile: the questionnaire, the results step, the debrief", async () => {
    const { o, records } = await wholeSession({ audience: "public" });
    expect(o.logHeader).not.toHaveProperty("immediateProfile");
    expect(kinds(records)).not.toContain("profile_shown");
    const post = index(records, (r) => r.kind === "questionnaire_submitted" && (r.detail as { questionnaireId: string }).questionnaireId === "post");
    expect(kinds(records.slice(post, post + 3))).toEqual(["questionnaire_submitted", "results_optin", "debrief_shown"]);
    expect(records[post + 2]!.detail).toEqual({ textId: "debrief.public.full" });
  }, 60_000);

  it("the steps on screen: primer (BRIEFING), then the video; the results step and the profile (DEBRIEF_HANDOFF), then the debrief", async () => {
    vi.setSystemTime(0);
    const { o, snap } = newStudySession({ audience: "public", immediateProfile: true });
    await o.start();
    await driveSession(o, snap, ["primer"]);
    expect(snap().step).toBe("primer");
    expect(o.engineState).toBe("BRIEFING");
    await expect(o.completeTraining()).rejects.toThrow();
    await expect(o.primerPage("", 10)).rejects.toThrow(RangeError);
    await expect(o.primerPage("p1", -1)).rejects.toThrow(RangeError);
    await expect(o.primerCheck("q1", 1.5, true, 1)).rejects.toThrow(RangeError);
    await expect(o.primerCheck("q1", 0, true, 0)).rejects.toThrow(RangeError);
    await o.finishPrimer();
    expect(snap().step).toBe("map_pretest"); // difficulty audit (23 Oct 2026): the pretest after the primer (BRIEFING still)
    expect(o.engineState).toBe("BRIEFING");
    await passPretest(o, snap);
    expect(snap().step).toBe("briefing");
    expect(snap().introVideo).not.toBeNull();
    await expect(o.primerPage("p1", 10)).rejects.toThrow(/primerPage in step briefing/);
    await driveSession(o, snap, ["results_optin"]);
    expect(o.engineState).toBe("DEBRIEF_HANDOFF");
    await expect(o.finishProfile()).rejects.toThrow(/finishProfile in step results_optin/);
    await o.decideResultsOptIn(true);
    expect(snap().step).toBe("profile");
    await expect(o.decideResultsOptIn(true)).rejects.toThrow(/decideResultsOptIn in step profile/);
    await expect(o.finishDebrief()).rejects.toThrow(/finishDebrief in step profile/);
    await o.finishProfile();
    expect(snap()).toMatchObject({ step: "debrief", debrief: { textId: "debrief.public.full" } });
  }, 60_000);

  it("without an intro video the primer (and the map-reading pretest) leads straight to the practice view", async () => {
    vi.setSystemTime(0);
    const { introVideo: _none, ...noVideo } = APP_OPTIONS;
    const { o, snap } = newStudySession({ audience: "public" }, noVideo);
    await o.start();
    await driveSession(o, snap, ["primer"]);
    await o.finishPrimer();
    await passPretest(o, snap);
    expect(snap()).toMatchObject({ step: "exploration", practice: true });
  });

  it("a glossary term or a help-card section opened is one record, with the view; nothing else moves (no clock, no step)", async () => {
    vi.setSystemTime(0);
    const { o, snap } = newStudySession({ audience: "public" });
    await o.start();
    await driveSession(o, snap, ["primer"]);
    await o.recordAudienceEvent({ kind: "glossary_opened", termId: "kärki", surface: "other" });
    await o.finishPrimer();
    await passPretest(o, snap);
    await o.finishIntroVideo("ended");
    const before = { step: snap().step, view: snap().currentCycle, seconds: snap().secondsLeft, clock: snap().clockLabel };
    const n = (await o.logRecords()).length;
    await o.recordAudienceEvent({ kind: "glossary_opened", termId: "fire.head", surface: "message_log" });
    await o.recordAudienceEvent({ kind: "help_card_opened", section: "roster" });
    const records = await o.logRecords();
    expect(records.slice(n).map(({ kind, detail }) => ({ kind, detail }))).toEqual([
      { kind: "glossary_opened", detail: { termId: "fire.head", surface: "message_log", view: 0 } },
      { kind: "help_card_opened", detail: { section: "roster" } },
    ]);
    expect(records.slice(n).every((r) => r.tVirtual === records[n - 1]!.tVirtual)).toBe(true);
    expect({ step: snap().step, view: snap().currentCycle, seconds: snap().secondsLeft, clock: snap().clockLabel }).toEqual(before);
    // On the primer (outside the views) the view is null; a malformed use is refused before anything is written.
    expect(records.find((r) => r.kind === "glossary_opened")!.detail).toEqual({ termId: "kärki", surface: "other", view: null });
    await expect(o.recordAudienceEvent({ kind: "glossary_opened", termId: "a b", surface: "message_log" })).rejects.toThrow(RangeError);
    await expect(o.recordAudienceEvent({ kind: "glossary_opened", termId: "x", surface: "nowhere" as never })).rejects.toThrow(RangeError);
    await expect(o.recordAudienceEvent({ kind: "help_card_opened", section: "tactics" as never })).rejects.toThrow(RangeError);
    expect(await o.logRecords()).toHaveLength(records.length);
  });

  it("uses of the layer during the views change none of the views' records", async () => {
    vi.setSystemTime(0);
    const plain = await wholeSession({ audience: "public" });
    vi.setSystemTime(0);
    const { o, snap } = newStudySession({ audience: "public" });
    await o.start();
    for (let guard = 0; guard < 400 && snap().step !== "complete"; guard++) {
      // At each main view's start (its exploration step) a term is opened and the help card's roster, then the view runs as usual.
      if (snap().step === "exploration" && !snap().practice) {
        await o.recordAudienceEvent({ kind: "glossary_opened", termId: "fire.flank", surface: "record" });
        await o.recordAudienceEvent({ kind: "help_card_opened", section: "roster" });
      }
      await driveStep(o, snap);
    }
    const used = await o.logRecords();
    expect(used.filter((r) => r.kind === "glossary_opened").map((r) => (r.detail as { view: number }).view)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(stimulus(used)).toEqual(stimulus(plain.records));
  }, 60_000);
});

describe("scope phase A (SPEC/35 §2)", () => {
  for (const audience of ["public", "expert"] as const) {
    it(`${audience}: ends at the hinge — V7's end leads to the questionnaire (no hinge screen, no phase B), then on to the end`, async () => {
      const { o, records } = await wholeSession({ audience, scope: "phaseA" });
      expect(o.logHeader).toMatchObject({ audience, scope: "phaseA" });
      expect(mainViews(records)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(kinds(records)).not.toContain("hinge_pause_start");
      expect(kinds(records)).not.toContain("hinge_check_presented");
      expect(records.some((r) => r.kind === "phase_entered" && (r.detail as { phase: string }).phase === "phase_b")).toBe(false);
      const v7End = index(records, (r) => r.kind === "cycle_end" && (r.detail as { cycle: number }).cycle === 7);
      expect(records[v7End + 1]).toMatchObject({ kind: "questionnaire_presented", detail: { questionnaireId: "post" } });
      // The directive was never given: its items are not asked, nor its basis option.
      const items = (records[v7End + 1]!.detail as { itemIds: string[]; multiOptionOrders: { itemId: string; optionIds: string[] }[] });
      expect(items.itemIds).not.toContain("retention.hinge");
      expect(items.itemIds).not.toContain("directive.fit");
      expect(items.multiOptionOrders.find((m) => m.itemId === "last.basis")!.optionIds).not.toContain("directive");
      expect(transitions(records).slice(-1)).toEqual(["handoff_complete"]);
      expect(o.engineState).toBe("COMPLETE");
      expect(kinds(records).at(-1)).toBe("session_completed");
      if (audience === "public") expect(records.find((r) => r.kind === "debrief_shown")!.detail).toEqual({ textId: "debrief.public.phaseA" });
    }, 60_000);
  }

  it("phase A's views are the full session's: the same records from VP's start to V7's end", async () => {
    const full = await wholeSession({ audience: "public" });
    const a = await wholeSession({ audience: "public", scope: "phaseA" });
    const v7 = (records: readonly LogRecord[]) => stimulus(records.slice(0, index(records, (r) => r.kind === "cycle_end" && (r.detail as { cycle: number }).cycle === 7) + 1));
    expect(v7(a.records)).toEqual(v7(full.records));
  }, 60_000);
});
