/**
 * The fidelity report and the certainty audit over the built scenario (SPEC/14 (bf)): Haku's deterministic template answers — the
 * fallback the browser shows when the proxy fails, built over the same time-gated records — must pass every time screen (each cited
 * time is a record the answer was given, none is later than what was reachable, the gate holds) and carry no imperative. A check of
 * the tools' record matching against the real records and clocks, not of the model.
 */

import { describe, expect, it, vi } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { stepAtVirtualTime } from "../../app/retrieval/time-gate.js";
import { sessionHeader } from "../../app/session/header.js";
import { SessionQueries } from "../../app/session/queries.js";
import type { ThinkerTransport } from "../../app/session/thinker-transport.js";
import { InMemoryLogSink, SessionLog } from "../../app/telemetry/log.js";
import type { AuditAtom } from "../../app/telemetry/haku-certainty-audit.js";
import { certaintyAudit } from "../../tools/review/thinker-uncertainty-audit.js";
import { fidelityOf } from "../../tools/review/fidelity.js";

const scenario = buildDemoScenario();

async function hakuSession(lang: "fi" | "en"): Promise<string> {
  const log = new SessionLog(sessionHeader(scenario, "directed", "P-real", lang, null, true, "radio"), new InMemoryLogSink());
  for (const [view, question] of [[2, "Missä palon kärki on?"], [5, "Mikä on tuulen suunta?"], [9, "Onko uutta paloa havaittu?"], [12, "Onko voimajohto jännitteetön?"]] as const) {
    const spec = scenario.cycles.find((c) => c.index === view)!;
    const t = spec.startsAtVirtual + 60;
    const q = new SessionQueries({
      scenario, log, now: () => asVirtualTime(t), view: () => view, currentStep: () => stepAtVirtualTime(spec, t)!,
      viewEndVirtual: () => spec.startsAtVirtual + spec.steps * 1200, phaseTag: () => "exploration", aiAvailable: () => false, language: () => lang, cell: () => "radio",
    }, { transport: vi.fn<ThinkerTransport>().mockRejectedValue(new TypeError("offline")), wait: async () => {} });
    await q.askAiChat(lang === "en" ? `Q at V${view}` : question);
  }
  return [JSON.stringify({ header: log.header }), ...(await log.readAll()).map((r) => JSON.stringify(r))].join("\n");
}

describe("the review tools over the built scenario", () => {
  it("Haku's template answers pass every time screen and carry no imperative, in both languages", async () => {
    for (const lang of ["fi", "en"] as const) {
      const rows = fidelityOf([await hakuSession(lang)]);
      expect(rows, lang).toHaveLength(4);
      for (const r of rows) {
        expect(r, `${lang} V${r.view}`).toMatchObject({ tool: "haku", fallback: true, fallbackReason: "network_error", unmatchedCitations: 0, futureCitations: 0, gateViolations: 0, imperativeSentences: 0 });
      }
      expect(rows.filter((r) => r.citedTimes > 0).length, lang).toBeGreaterThan(0);
    }
  });

  it("the certainty audit reads the template's stated level and finds the cited records' certainty", async () => {
    const rows = certaintyAudit([await hakuSession("fi")], { atoms: scenario.atoms as unknown as readonly AuditAtom[] });
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r.stated, `V${r.view}`).not.toBe("unparsed");
    expect(rows.some((r) => r.recordLevel !== null)).toBe(true);
  });
});
