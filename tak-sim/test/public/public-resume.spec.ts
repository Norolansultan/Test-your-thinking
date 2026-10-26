/**
 * SPEC/35 P1 with SPEC/05 §9: a public or phase-A session interrupted at one of the new steps resumes there — the primer again
 * from its first page, the profile again (with `?profiili=heti`), the questionnaire after V7 in a phase-A session — the engine in
 * that screen's state, the log gapless, the header's audience and scope kept. SPEC/36: the results step again (any session).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryLogSink, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import type { SessionOptions, SessionSnapshot } from "../../app/session/orchestrator.js";
import { driveSession, driveStep, kinds, newStudySession, passTraining, TRAINING_IN_TREE } from "./public-run.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const gapless = (records: readonly LogRecord[]) => records.forEach((r, i) => expect(r.seq).toBe(i));

/** Runs a session (the given options) until `stopAt` is on screen, `then` done there; then resumes it from its sink. */
async function interruptAt(options: SessionOptions, stopAt: SessionSnapshot["step"], then: (o: ReturnType<typeof newStudySession>["o"]) => Promise<void> = async () => undefined) {
  vi.setSystemTime(0);
  const sink = new InMemoryLogSink();
  const first = newStudySession({ ...options, sink });
  await first.o.start();
  await driveSession(first.o, first.snap, [stopAt]);
  await then(first.o);
  vi.clearAllTimers();
  const records = await sink.readAll();
  // The launcher resumes with the header alone (`ResumeGate`): no audience or scope is passed beside it.
  const resumed = newStudySession({ sink, resume: { header: records[0]!.detail as LogHeader, records, interruptedForMs: 5_000 } });
  await resumed.o.start();
  return { ...resumed, sink, before: records.length };
}

describe("resume across the public steps (SPEC/35, SPEC/05 §9)", () => {
  it("during the primer: the primer again from its first page (BRIEFING), its earlier pages kept; then the video and VP", async () => {
    const { o, snap, sink, before } = await interruptAt({ audience: "public" }, "primer", (o) => o.primerPage("p1.role", 2_000));
    expect(snap().step).toBe("primer");
    expect(o.engineState).toBe("BRIEFING");
    expect(o.audience).toBe("public");
    let records = await sink.readAll();
    expect(kinds(records.slice(before))).toEqual(["fault", "fault_resolved", "session_resumed"]);
    expect(records.at(-1)!.detail).toMatchObject({ resumedAt: "primer", cycleReplayed: 0 });
    await o.primerPage("p1.role", 1_000);
    await o.finishPrimer();
    if (TRAINING_IN_TREE) expect(snap().step).toBe("training_incident"); // revision (bp): the training after the primer
    await passTraining(o, snap);
    expect(snap().step).toBe("briefing");
    await o.finishIntroVideo("ended");
    expect(snap()).toMatchObject({ step: "exploration", practice: true });
    records = await sink.readAll();
    expect(records.filter((r) => r.kind === "primer_page")).toHaveLength(2);
    expect(records.filter((r) => r.kind === "state_transition").map((r) => (r.detail as { trigger: string }).trigger)).toEqual(["start", "preflight_passed", "briefing_complete"]);
    gapless(records);
  });

  it("after the primer, before VP: the intro video again, not the primer", async () => {
    const { snap, sink } = await interruptAt({ audience: "public" }, "briefing");
    expect(snap().step).toBe("briefing");
    expect((await sink.readAll()).at(-1)!.detail).toMatchObject({ resumedAt: "briefing" });
  });

  it("at the results step (SPEC/36, an expert session too): the step again (nothing logged twice), then the debrief and the end", async () => {
    for (const audience of ["expert", "public"] as const) {
      const { o, snap, sink, before } = await interruptAt({ audience }, "results_optin");
      expect(snap().step).toBe("results_optin");
      expect(o.engineState).toBe("DEBRIEF_HANDOFF");
      let records = await sink.readAll();
      expect(kinds(records.slice(before))).toEqual(["fault", "fault_resolved", "session_resumed"]);
      expect(records.at(-1)!.detail).toMatchObject({ resumedAt: "results_optin", cycleReplayed: 14 });
      await o.decideResultsOptIn(true);
      expect(snap().step).toBe("debrief");
      await o.finishDebrief();
      await o.completeSession();
      records = await sink.readAll();
      expect(records.filter((r) => r.kind === "results_optin").map((r) => r.detail)).toEqual([{ optedIn: true }]);
      expect(kinds(records)).not.toContain("profile_shown");
      gapless(records);
    }
  }, 120_000);

  it("after the results step, before the debrief closed (no profile): the debrief again", async () => {
    const { snap, sink } = await interruptAt({ audience: "public" }, "debrief");
    expect(snap().step).toBe("debrief");
    expect(kinds(await sink.readAll()).filter((k) => k === "results_optin")).toHaveLength(1);
  }, 60_000);

  it("at the profile (`?profiili=heti`): the profile again (profile_shown again), then the debrief, COMPLETE and session_completed once", async () => {
    const { o, snap, sink } = await interruptAt({ audience: "public", immediateProfile: true }, "profile");
    expect(snap().step).toBe("profile");
    expect(o.engineState).toBe("DEBRIEF_HANDOFF");
    let records = await sink.readAll();
    expect(kinds(records).slice(-4)).toEqual(["fault", "fault_resolved", "session_resumed", "profile_shown"]);
    expect(records.at(-2)!.detail).toMatchObject({ resumedAt: "profile", cycleReplayed: 14 });
    expect(snap().radioLog.length).toBeGreaterThan(0); // the message log refilled
    await o.finishProfile();
    expect(snap()).toMatchObject({ step: "debrief", debrief: { textId: "debrief.public.full" } });
    await o.finishDebrief();
    await o.completeSession();
    records = await sink.readAll();
    expect(kinds(records).filter((k) => k === "session_completed")).toHaveLength(1);
    expect(kinds(records).filter((k) => k === "profile_shown")).toHaveLength(2);
    gapless(records);
  }, 60_000);

  it("at the debrief (the profile left): the debrief again, not the profile", async () => {
    const { snap, sink } = await interruptAt({ audience: "public", immediateProfile: true }, "debrief");
    expect(snap().step).toBe("debrief");
    expect(kinds(await sink.readAll()).slice(-2)).toEqual(["session_resumed", "debrief_shown"]);
  }, 60_000);

  it("phase A, at the questionnaire after V7: the questionnaire again (DEBRIEF_HANDOFF), then the results step and the end", async () => {
    const { o, snap, sink } = await resumeWhen({ audience: "public", scope: "phaseA" }, (s) => s.step === "questionnaire" && s.questionnaire?.id === "post");
    expect(o.scope).toBe("phaseA");
    expect(snap()).toMatchObject({ step: "questionnaire", questionnaire: { id: "post" } });
    expect(o.engineState).toBe("DEBRIEF_HANDOFF");
    expect((await sink.readAll()).filter((r) => r.kind === "session_resumed").at(-1)!.detail).toMatchObject({ resumedAt: "questionnaire", cycleReplayed: 7 });
    await driveSession(o, snap);
    const records = await sink.readAll();
    expect(kinds(records).slice(-6)).toEqual(["questionnaire_submitted", "results_optin", "debrief_shown", "debrief_closed", "state_transition", "session_completed"]);
    expect(records.some((r) => r.kind === "cycle_start" && (r.detail as { cycle: number }).cycle > 7)).toBe(false);
    gapless(records);
  }, 60_000);

  it("phase A, interrupted in V5: V5 again, then V6, V7 and the questionnaire (no hinge)", async () => {
    const { o, snap, sink } = await resumeWhen({ audience: "public", scope: "phaseA" }, (s) => s.step === "exploration" && s.currentCycle === 5);
    expect(snap()).toMatchObject({ step: "exploration", currentCycle: 5 });
    await driveSession(o, snap, ["questionnaire"]);
    expect(snap().currentCycle).toBe(7);
    expect(o.engineState).toBe("DEBRIEF_HANDOFF");
    const all = await sink.readAll();
    expect(kinds(all)).not.toContain("hinge_pause_start");
    gapless(all);
  }, 60_000);
});

/** Runs a session screen by screen until `when` holds, then resumes it from its sink (the header alone, as the launcher does). */
async function resumeWhen(options: SessionOptions, when: (s: SessionSnapshot) => boolean) {
  vi.setSystemTime(0);
  const sink = new InMemoryLogSink();
  const first = newStudySession({ ...options, sink });
  await first.o.start();
  for (let guard = 0; guard < 400 && !when(first.snap()); guard++) await driveStep(first.o, first.snap);
  if (!when(first.snap())) throw new Error(`resumeWhen: never reached (at ${first.snap().step})`);
  vi.clearAllTimers();
  const records = await sink.readAll();
  const resumed = newStudySession({ sink, resume: { header: records[0]!.detail as LogHeader, records, interruptedForMs: 5_000 } });
  await resumed.o.start();
  return { ...resumed, sink, before: records.length };
}
