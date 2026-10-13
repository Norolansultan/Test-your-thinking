/**
 * Revision (am), 10 Oct 2026: the Thinker practice in the browser. In the Thinker cells the Open Thinker
 * is available in the practice view (VP); its records carry view 0 like every practice record (analysis
 * drops them by that tag); its turns are cleared from the conversation when V1 starts, so the model's
 * history in V1 holds no practice turn; a resume restores them only into VP. The radio cell has no Open
 * Thinker in VP or anywhere.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { SessionQueries } from "../../app/session/queries.js";
import type { OpenThinkerResponse } from "../../app/session/thinker-protocol.js";
import type { OpenThinkerTransport, ThinkerTransport } from "../../app/session/thinker-transport.js";
import type { LogRecord } from "../../app/telemetry/log.js";
import { THINKER_MODEL_ID } from "../../server/thinker/config.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { allocateAndConfirm, runOutView } from "./view-flow.js";

const scenario = buildDemoScenario();

const OPEN_LIVE: OpenThinkerResponse = {
  answer: "Uusin ilmoitus kärjestä on DR1:ltä klo 12.00.", retrieved: [], modelId: THINKER_MODEL_ID, promptHash: "b".repeat(64), latencyMs: 3000,
  fallback: false, fallbackReason: null, retrievalMode: "hybrid", promptVariant: "standard", verdict: null, verdicts: null,
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function session(condition: "directed" | "substitutive", cell: "radio" | "reasoning_once" | "reasoning_intent", openTransport: OpenThinkerTransport) {
  const transport = vi.fn<ThinkerTransport>();
  const o = new SessionOrchestrator(scenario, condition, { cell, thinker: { transport, openTransport } });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  return { o, snap: () => box.snap! };
}

async function ask(o: SessionOrchestrator, q: string): Promise<string> {
  const pending = o.askOpenThinker(q);
  await vi.advanceTimersByTimeAsync(2_500);
  return pending;
}

describe("revision (am): the Thinker practice in VP", () => {
  it.each(["reasoning_once", "reasoning_intent"] as const)("%s: the Open Thinker answers in VP, logged with view 0; its history is cleared when V1 starts", async (cell) => {
    const openTransport = vi.fn<OpenThinkerTransport>().mockResolvedValue(OPEN_LIVE);
    const { o, snap } = session("substitutive", cell, openTransport);
    await o.start();
    expect(snap()).toMatchObject({ practice: true, aiAvailable: true });
    expect(await ask(o, UI_TEXT.fi.tour.practiceThinker.example)).toBe(OPEN_LIVE.answer);
    await ask(o, "entä L3?");
    expect(openTransport).toHaveBeenNthCalledWith(1, expect.objectContaining({ view: 0, cell, condition: "substitutive", history: [] }));
    expect(openTransport).toHaveBeenNthCalledWith(2, expect.objectContaining({ view: 0, history: [{ role: "user", text: UI_TEXT.fi.tour.practiceThinker.example }, { role: "model", text: OPEN_LIVE.answer }] }));
    expect(snap().openThinkerHistory).toHaveLength(2);

    const records = await o.logRecords();
    const open = records.filter((r) => (r.kind === "ai_chat_query_submitted" || r.kind === "ai_chat_answer_received") && (r.detail as { tool?: string }).tool === "open_thinker");
    expect(open).toHaveLength(4);
    for (const r of open) expect((r.detail as { view: number }).view).toBe(0); // the practice tag, as every practice record
    // Bracketed by the practice phase, as analysis expects.
    const enteredPractice = records.findIndex((r) => r.kind === "phase_entered" && (r.detail as { phase: string }).phase === "practice");
    expect(enteredPractice).toBeGreaterThanOrEqual(0);
    expect(enteredPractice).toBeLessThan(open[0]!.seq);

    await runOutView(o, snap);
    await allocateAndConfirm(o, snap);
    await o.completeTraining();
    expect(snap().currentCycle).toBe(1);
    expect(snap().openThinkerHistory).toHaveLength(0); // the practice conversation does not carry into V1
    await ask(o, "mitä nyt?");
    expect(openTransport).toHaveBeenLastCalledWith(expect.objectContaining({ view: 1, history: [] }));
  });

  it("the radio cell has no Open Thinker in VP", async () => {
    const openTransport = vi.fn<OpenThinkerTransport>();
    const { o, snap } = session("directed", "radio", openTransport);
    await o.start();
    expect(snap()).toMatchObject({ practice: true, aiAvailable: false });
    await expect(o.askOpenThinker("mitä tehdä?")).rejects.toThrow(/not available/);
    expect(openTransport).not.toHaveBeenCalled();
  });

  it("a local fallback in VP is logged with the reasoning_once prompt's hash in both Thinker cells (the prompt VP is answered with)", async () => {
    const hashes: string[] = [];
    for (const cell of ["reasoning_once", "reasoning_intent"] as const) {
      const { o } = session("substitutive", cell, vi.fn<OpenThinkerTransport>().mockRejectedValue(new Error("down")));
      await o.start();
      await ask(o, "missä kärki on?");
      const answer = (await o.logRecords()).find((r) => r.kind === "ai_chat_answer_received")!;
      expect(answer.detail).toMatchObject({ view: 0, fallback: true, tool: "open_thinker" });
      hashes.push((answer.detail as { promptHash: string }).promptHash);
    }
    expect(hashes[1]).toBe(hashes[0]);
  });

  it("startView clears the practice turns once, at the first main view, and the hinge clearing still follows", () => {
    const q = new SessionQueries({} as never);
    const turn = { query: "q", answer: "a", unavailable: false };
    q.restoreChats([record(1, 0, "p1")], 0); // a resume into VP keeps its practice turns
    expect(q.openThinkerHistory.map((t) => t.query)).toEqual(["p1"]);
    q.startView(0);
    expect(q.openThinkerHistory).toHaveLength(1);
    q.startView(1);
    expect(q.openThinkerHistory).toHaveLength(0);
    q.openThinkerHistory.push(turn);
    q.startView(2);
    expect(q.openThinkerHistory).toHaveLength(1);
    q.startView(8);
    expect(q.openThinkerHistory).toHaveLength(0);
  });

  it("a resume after VP restores no practice turn into the conversation", () => {
    const q = new SessionQueries({} as never);
    q.restoreChats([record(1, 0, "p1"), record(2, 1, "o1"), record(3, 2, "o2")], 3);
    expect(q.openThinkerHistory.map((t) => t.query)).toEqual(["o1", "o2"]);
  });
});

function record(seq: number, view: number, text: string): LogRecord {
  return {
    seq: seq as never, tVirtual: 0 as never, tWallOffsetMs: 0, kind: "ai_chat_answer_received",
    detail: { queryId: `q${seq}`, text, view, virtualTimeS: 0, retrieved: [], retrievalMode: "hybrid", modelId: "m", promptHash: "h",
      answer: { vastaus: `${text} — answer`, perusteet: "", varmuus: "", muuttaisi: "" }, latencyMs: 1, fallback: false, fallbackReason: null,
      phase: "exploration", promptVariant: "standard", tool: "open_thinker" },
  } as LogRecord;
}
