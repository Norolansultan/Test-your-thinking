/**
 * The three cells (phase B round 2, D1; SPEC/02 revisions (f)/(j)): `?solu=k4|m7|t2` (opaque codes)
 * assigns `radio` / `reasoning_once` / `reasoning_intent`; the header logs the real cell; Haku's chat
 * request carries it in every cell (8 Oct 2026), always answered and logged as the standard variant.
 */

import { describe, expect, it, vi } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import { stepAtVirtualTime } from "../../app/retrieval/time-gate.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import type { Cell } from "../../app/scenario/types.js";
import { sessionCell, sessionHeader } from "../../app/session/header.js";
import { SessionOrchestrator } from "../../app/session/orchestrator.js";
import { CELL_PARAM_VALUES, conditionOfCell, parseCellParam, startChoiceFromUrl } from "../../app/session/preview.js";
import { manifestPromptHash, SessionQueries } from "../../app/session/queries.js";
import type { ThinkerResponse } from "../../app/session/thinker-protocol.js";
import type { ThinkerTransport } from "../../app/session/thinker-transport.js";
import { InMemoryLogSink, SessionLog, type LogHeader } from "../../app/telemetry/log.js";
import manifest from "../../content/thinker/manifest.json" with { type: "json" };

const scenario = buildDemoScenario();

describe("the cell from the URL", () => {
  it("maps the three neutral values", () => {
    expect(CELL_PARAM_VALUES).toEqual({ k4: "radio", m7: "reasoning_once", t2: "reasoning_intent" });
    expect(parseCellParam("?solu=k4")).toBe("radio");
    expect(parseCellParam("?tuotanto&solu=m7")).toBe("reasoning_once");
    expect(parseCellParam("?solu=t2&esikatselu=12")).toBe("reasoning_intent");
    expect(parseCellParam("?tuotanto")).toBeNull();
  });

  it("refuses anything else rather than guess a group", () => {
    for (const bad of ["?solu=", "?solu=Haku", "?solu=reasoning_intent", "?solu=toString", "?solu=__proto__"]) expect(() => parseCellParam(bad)).toThrow(RangeError);
  });

  it("decides what the start page offers", () => {
    expect(startChoiceFromUrl("")).toEqual({ kind: "choose" });
    expect(startChoiceFromUrl("?esikatselu=12")).toEqual({ kind: "choose" });
    // SPEC/30 §2 revision (bf), 24 Oct 2026: the shared study link names the screener's stratum (`?osite=`); without one it is refused.
    expect(startChoiceFromUrl("?tuotanto&osite=fire_rescue.lead")).toEqual({ kind: "server_assign", stratum: { profession: "fire_rescue", leads: true } });
    expect(startChoiceFromUrl("?tuotanto").kind).toBe("invalid");
    // SPEC/27 §2.2 (5 Oct 2026): `?solu=` in the study only for a pilot (`?pilotti`), logged as such.
    expect(startChoiceFromUrl("?tuotanto&solu=t2").kind).toBe("invalid");
    expect(startChoiceFromUrl("?tuotanto&solu=t2&pilotti")).toEqual({ kind: "assigned", cell: "reasoning_intent", assignment: { source: "url_pilot" }, participantCode: null, language: null });
    expect(startChoiceFromUrl("?solu=k4")).toEqual({ kind: "assigned", cell: "radio", assignment: { source: "url" }, participantCode: null, language: null });
    expect(startChoiceFromUrl("?tuotanto&solu=x").kind).toBe("invalid");
  });

  it("puts each cell in its condition", () => {
    expect(conditionOfCell("radio")).toBe("directed");
    expect(conditionOfCell("reasoning_once")).toBe("substitutive");
    expect(conditionOfCell("reasoning_intent")).toBe("substitutive");
  });
});

describe("the header's cell", () => {
  it("is the given cell, or the condition's default, and must match the condition", () => {
    expect(sessionCell("directed")).toBe("radio");
    expect(sessionCell("substitutive")).toBe("reasoning_once");
    expect(sessionCell("substitutive", "reasoning_intent")).toBe("reasoning_intent");
    expect(() => sessionCell("directed", "reasoning_intent")).toThrow(/does not belong/);
    expect(() => sessionCell("substitutive", "radio")).toThrow(/does not belong/);
    expect(sessionHeader(scenario, "substitutive", "p", "fi", null, true, "reasoning_intent").cell).toBe("reasoning_intent");
  });

  it.each(["radio", "reasoning_once", "reasoning_intent"] as const)("is logged by the session: %s", async (cell) => {
    const o = new SessionOrchestrator(scenario, conditionOfCell(cell), { cell, thinker: { transport: vi.fn() } });
    await o.start();
    const started = (await o.logRecords()).find((r) => r.kind === "session_started")!.detail as LogHeader;
    expect(started.cell).toBe(cell);
    expect(started.condition).toBe(conditionOfCell(cell));
  });

  it("a session refuses a cell from the other condition", () => {
    expect(() => new SessionOrchestrator(scenario, "directed", { cell: "reasoning_intent" })).toThrow(/does not belong/);
  });
});

/** SessionQueries at a given view, with the time at the view's start and the step it reaches. */
function queriesAt(view: number, cell: Cell, transport: ThinkerTransport, lang: "fi" | "en" = "fi") {
  const spec = scenario.cycles.find((c) => c.index === view)!;
  const log = new SessionLog(sessionHeader(scenario, conditionOfCell(cell), "p", lang, null, true, cell), new InMemoryLogSink());
  const q = new SessionQueries({
    scenario, log, now: () => asVirtualTime(spec.startsAtVirtual), view: () => view, currentStep: () => stepAtVirtualTime(spec, spec.startsAtVirtual)!,
    viewEndVirtual: () => spec.startsAtVirtual, phaseTag: () => "exploration", aiAvailable: () => true, language: () => lang, cell: () => cell,
  }, { transport, wait: async () => {} });
  return { q, log };
}

const LIVE = (linjaus?: { tila: "sopii" | "ei_sovi" | "ei_liity"; perustelu: string }): ThinkerResponse => ({
  answer: { vastaus: "v", perusteet: "EK14 klo 17.05", varmuus: "todennäköinen", muuttaisi: "m", ...(linjaus ? { linjaus } : {}) },
  retrieved: [{ id: "x", score: 0.5 }], modelId: "claude-opus-5-5", promptHash: "h".repeat(64), latencyMs: 3000,
  fallback: false, fallbackReason: null, retrievalMode: "hybrid", promptVariant: linjaus ? "intent" : "standard",
});

describe("Haku's chat in the browser, per cell (D1, 8 Oct 2026)", () => {
  it("sends every cell, the radio cell included, with its condition", async () => {
    for (const cell of ["radio", "reasoning_once", "reasoning_intent"] as const) {
      const transport = vi.fn<ThinkerTransport>().mockResolvedValue(LIVE());
      await queriesAt(10, cell, transport).q.askAiChat("onko suo hallinnassa?");
      expect(transport.mock.calls[0]![0]).toMatchObject({ cell, view: 10, condition: conditionOfCell(cell) });
      expect(transport.mock.calls[0]![0]).not.toHaveProperty("history");
    }
  });

  it("never shows or logs a linjaus, even if a reply carried one (the directive line is withdrawn)", async () => {
    const linjaus = { tila: "ei_sovi" as const, perustelu: "DR2 klo 17.20 raportoi uuden rintaman." };
    const { q, log } = queriesAt(10, "reasoning_intent", vi.fn<ThinkerTransport>().mockResolvedValue(LIVE(linjaus)));
    const answer = await q.askAiChat("onko uusi rintama?");
    expect(answer).not.toHaveProperty("linjaus");
    const detail = (await log.readAll()).find((r) => r.kind === "ai_chat_answer_received")!.detail as Record<string, unknown>;
    expect(detail).toMatchObject({ promptVariant: "standard", tool: "haku", view: 10 });
    expect(detail).not.toHaveProperty("linjaus");
    expect(detail).not.toHaveProperty("linjausTila");
  });

  it.each([
    ["radio", 8, "fi"],
    ["reasoning_intent", 8, "fi"],
    ["reasoning_intent", 14, "en"],
    ["reasoning_once", 10, "fi"],
  ] as const)("the local fallback (%s, V%i, %s) is the standard four parts, tool haku", async (cell, view, lang) => {
    const { q, log } = queriesAt(view, cell, vi.fn<ThinkerTransport>().mockRejectedValue(new TypeError("Failed to fetch")), lang);
    const answer = await q.askAiChat("EK11");
    const detail = (await log.readAll()).find((r) => r.kind === "ai_chat_answer_received")!.detail as Record<string, unknown>;
    expect(detail).toMatchObject({ fallback: true, fallbackReason: "network_error", promptVariant: "standard", promptHash: manifestPromptHash(lang, "standard"), tool: "haku" });
    expect(answer).not.toHaveProperty("linjaus");
  });

  it("the local fallback's prompt hash is the manifest's for the language and variant", () => {
    expect(manifestPromptHash("fi", "standard")).toBe(manifest.prompt.sha256);
    expect(manifestPromptHash("en", "standard")).toBe(manifest.promptEn.sha256);
    expect(manifestPromptHash("fi", "intent")).toBe(manifest.promptIntent.sha256);
    expect(manifestPromptHash("en", "intent")).toBe(manifest.promptIntentEn.sha256);
    expect(manifestPromptHash("fi", "open")).toBe(manifest.promptOpen.sha256);
    expect(manifestPromptHash("en", "open")).toBe(manifest.promptOpenEn.sha256);
  });
});
