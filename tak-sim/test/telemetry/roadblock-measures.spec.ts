/**
 * SPEC/32 §7: roadblock latency — from a deciding record's arrival on the screen to the first act on it (an open, a plan coded C),
 * in view seconds (the spans the view's clock stood still taken out) and wall ms. Synthetic logs, the real directive keys.
 */

import { describe, expect, it } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import { DIRECTIVE_KEYS } from "../../app/scenario/demo-directive.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import type { TelemetryEvent } from "../../app/telemetry/record-kinds.js";
import { decidingAtomsFromTable, roadblockLatencies } from "../../app/telemetry/roadblock-measures.js";
import { F7_PLANTED_ATOM_ID } from "../../app/telemetry/freeze-measures.js";

const HEADER: LogHeader = {
  formatVersion: "0.12.0", sessionId: "roadblock", participantCode: "p", condition: "substitutive", scenarioId: "s", scenarioVersion: "0",
  seed: "1", bundleHash: "b", appVersion: "0", startedAtIso: "2026-01-01T00:00:00.000Z", userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 },
  cell: "reasoning_intent", echelon: "command",
};

async function buildLog(events: readonly (readonly [number, TelemetryEvent])[]): Promise<readonly LogRecord[]> {
  const log = new SessionLog(HEADER, new InMemoryLogSink());
  for (const [t, e] of events) await appendTelemetryEvent(log, asVirtualTime(0), t, e);
  return log.readAll();
}

type Posture = "direct_attack" | "barrier_line" | "protect_values";
const start = (cycle: number): TelemetryEvent => ({ kind: "cycle_start", detail: { cycle: cycle as never, phase: cycle <= 7 ? "A" : "B", clockLabel: "x" } });
const submit = (posture: Posture, mainEffort = "L3"): TelemetryEvent => ({ kind: "allocation_submitted", detail: { plan: { mainEffort, posture, secondary: null, drones: null }, rationaleAsked: false, rationaleFi: null } });
const bubble = (atomId: string): TelemetryEvent => ({ kind: "bubble_available", detail: { atomId, mapPosition: null, tier: "T1_pushed", sourceId: "SPOT" } });
const click = (atomId: string): TelemetryEvent => ({ kind: "click", detail: { targetKind: "bubble", targetId: atomId, viewportRef: 0, pointerType: "mouse", button: 0 } });
const haku = (ids: readonly string[]): TelemetryEvent => ({ kind: "nav_query_submitted", detail: { queryId: "q", category: "c", sourceId: null, window: "latest", resultAtomIds: ids, phase: "exploration" } });
const freezeStarted = (cycle: number): TelemetryEvent => ({ kind: "freeze_started", detail: { cycle: cycle as never, atViewSeconds: 30, decisionCommittedBeforeFreeze: false, decisionStep: "exploration" } });
const freezeSubmitted = (cycle: number): TelemetryEvent => ({ kind: "freeze_submitted", detail: { cycle: cycle as never, responses: [] } });
const ended = (cycle: number): TelemetryEvent => ({ kind: "view_ended", detail: { cycle: cycle as never, viewSeconds: 120, endedBy: "participant_confirm" } });
const reviewShown = (cycle: number, atomIds: readonly string[]): TelemetryEvent => ({
  kind: "plan_review_shown",
  detail: { cycle: cycle as never, atViewSeconds: 90, trigger: "minimum_reached", premiseLines: ["l"], tableSha256: "t", premiseStatuses: [{ premiseId: "P1", status: "contradicted", atomIds }] },
});

const DECIDING = new Map<number, readonly string[]>([[9, ["atom.d9"]], [10, ["atom.d10"]], [14, ["atom.d14"]]]);

describe("roadblockLatencies (SPEC/32 §7)", () => {
  it("an open before any plan, a plan C first (carried over), and no act before the view ended", async () => {
    const records = await buildLog([
      // V9: pushed at 1 s, a freeze stops the clock for 3 s, opened at 7 s → 6 s wall, 3 s of view time; the plan comes after.
      [0, start(9)], [1_000, bubble("atom.d9")], [1_500, bubble("atom.d10")], [2_000, freezeStarted(9)], [5_000, freezeSubmitted(9)],
      [7_000, click("atom.d9")], [8_000, submit("barrier_line")], [9_000, ended(9)],
      // V10: atom.d10 was pushed in V9, so it stands in the message log from the view's start; the first act is a plan coded C.
      [20_000, start(10)], [30_000, submit("direct_attack")], [31_000, click("atom.d10")], [32_000, ended(10)],
      // V14: shown in a Haku result, then only a plan coded B before the view ended; an open after the end does not count.
      [40_000, start(14)], [41_000, haku(["atom.d14", "other"])], [45_000, submit("barrier_line")], [50_000, ended(14)], [51_000, click("atom.d14")],
    ]);
    const rows = roadblockLatencies(records, DIRECTIVE_KEYS, { decidingAtoms: DECIDING, plantedAtomId: "planted" });
    expect(rows.map((r) => [r.record, r.view, r.atomId, r.arrivalRoute, r.actKind, r.latencyViewSeconds, r.latencyWallMs])).toEqual([
      ["deciding", 9, "atom.d9", "pushed", "opened", 3, 6_000],
      ["deciding", 10, "atom.d10", "carried_over", "plan_c", 10, 10_000],
      ["deciding", 14, "atom.d14", "haku_result", null, null, null],
      ["planted", null, "planted", null, null, null, null],
    ]);
  });

  it("opening a cited record from the review counts for the guide group; the review's open span is not view time", async () => {
    const records = await buildLog([
      [0, start(9)], [2_000, submit("barrier_line")], [4_000, reviewShown(9, ["atom.d9"])],
      [9_000, { kind: "plan_review_record_opened", detail: { cycle: 9 as never, atomId: "atom.d9" } }],
      [10_000, { kind: "plan_review_closed", detail: { cycle: 9 as never, choice: "keep", dwellMs: 6_000 } }], [10_001, ended(9)],
    ]);
    const [row] = roadblockLatencies(records, DIRECTIVE_KEYS, { decidingAtoms: new Map([[9, ["atom.d9"]]]), plantedAtomId: "planted" });
    expect(row).toMatchObject({ arrivalRoute: "review_citation", actKind: "opened_from_review", latencyWallMs: 5_000, latencyViewSeconds: 0 });
  });

  it("the planted record is read in the view it first arrived in, and only an open is its act", async () => {
    const records = await buildLog([
      [0, start(6)], [1_000, haku(["x"])], [2_000, ended(6)],
      [3_000, start(7)], [4_000, bubble(F7_PLANTED_ATOM_ID)], [5_000, submit("direct_attack")], [6_500, click(F7_PLANTED_ATOM_ID)], [7_000, ended(7)],
    ]);
    const rows = roadblockLatencies(records, DIRECTIVE_KEYS, { decidingAtoms: new Map() });
    expect(rows).toEqual([{
      record: "planted", atomId: F7_PLANTED_ATOM_ID, view: 7, arrivalRoute: "pushed", arrivalSeq: 4, actKind: "opened", actSeq: 6, latencyViewSeconds: 2.5, latencyWallMs: 2_500,
    }]);
  });

  it("a chat retrieval is an arrival only in the sensitivity; a view never entered has null rows", async () => {
    const retrieved: TelemetryEvent = {
      kind: "ai_chat_answer_received",
      detail: {
        queryId: "q", text: "q", view: 9, virtualTimeS: 0, retrieved: [{ id: "atom.d9", fusedScore: 1 }], retrievalMode: "hybrid", modelId: "m", promptHash: "h",
        answer: { vastaus: "a", perusteet: "", varmuus: "", muuttaisi: "" }, latencyMs: 1, fallback: false, fallbackReason: null, phase: "exploration", promptVariant: "standard", tool: "open_thinker",
      },
    };
    const records = await buildLog([[0, start(9)], [1_000, retrieved], [3_000, submit("direct_attack")], [4_000, ended(9)]]);
    const opts = { decidingAtoms: new Map([[9, ["atom.d9"]], [10, ["atom.d10"]]]), plantedAtomId: "planted" };
    expect(roadblockLatencies(records, DIRECTIVE_KEYS, opts)[0]).toMatchObject({ arrivalRoute: null, actKind: null });
    expect(roadblockLatencies(records, DIRECTIVE_KEYS, { ...opts, includeChatRetrieval: true })[0]).toMatchObject({ arrivalRoute: "chat_retrieval", actKind: "plan_c", latencyViewSeconds: 2 });
    expect(roadblockLatencies(records, DIRECTIVE_KEYS, opts)[1]).toMatchObject({ view: 10, arrivalRoute: null });
  });

  it("reads the deciding records from the premise-evidence table by default", () => {
    expect([...decidingAtomsFromTable().entries()]).toEqual([
      [9, ["atom.demo.12.0"]], [10, ["atom.demo.12.0", "evt.c13.010", "evt.c13.034"]], [14, ["atom.demo.19.2"]],
    ]);
  });
});
