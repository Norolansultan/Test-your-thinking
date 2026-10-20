/**
 * SPEC/32 §5: the Thinker uncertainty audit's core — the fi/en hedge lexicon, the blind coding sheet and the AUROC of stated certainty
 * against coded correctness.
 */

import { describe, expect, it } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import type { TelemetryEvent } from "../../app/telemetry/record-kinds.js";
import {
  blindSheetCsv, certaintyAuroc, hedgeTerms, parseCodedSheet, parseCsv, SHEET_COLUMNS, statedCertainty, thinkerAnswers,
} from "../../app/telemetry/uncertainty-audit.js";

const HEADER: LogHeader = {
  formatVersion: "0.12.0", sessionId: "audit", participantCode: "p", condition: "substitutive", scenarioId: "s", scenarioVersion: "0",
  seed: "1", bundleHash: "b", appVersion: "0", startedAtIso: "2026-01-01T00:00:00.000Z", userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 },
  cell: "reasoning_intent", echelon: "command",
};

async function buildLog(events: readonly TelemetryEvent[]): Promise<readonly LogRecord[]> {
  const log = new SessionLog(HEADER, new InMemoryLogSink());
  for (const [i, e] of events.entries()) await appendTelemetryEvent(log, asVirtualTime(0), i, e);
  return log.readAll();
}

const answer = (queryId: string, view: number, vastaus: string, tool: "haku" | "open_thinker" = "open_thinker", fallback = false): TelemetryEvent => ({
  kind: "ai_chat_answer_received",
  detail: {
    queryId, text: "q", view, virtualTimeS: 0, retrieved: [], retrievalMode: "hybrid", modelId: "m", promptHash: "h",
    answer: { vastaus, perusteet: "", varmuus: "", muuttaisi: "" }, latencyMs: 1, fallback, fallbackReason: null, phase: "exploration", promptVariant: "standard", tool,
  },
});

describe("the hedge lexicon (SPEC/32 §5)", () => {
  it("matches the Finnish terms at a word start with any ending, and the two-word entries", () => {
    expect(hedgeTerms("Tilanne on epävarmaa.")).toEqual(["epävarma"]);
    expect(hedgeTerms("Ehkä palo etenee; todennäköisesti etelään.")).toEqual(["ehkä", "todennäköisesti"]);
    expect(hedgeTerms("Arviolta 300 m. Tieto saattaa olla vanha, ei  varmaa.")).toEqual(["ei varmaa", "arvio", "saattaa"]);
    expect(hedgeTerms("Se voi olla mahdollisesti väärin.")).toEqual(["mahdollisesti", "voi olla"]);
    expect(hedgeTerms("Tilannearvio on selvä.")).toEqual([]); // not at a word start
  });

  it("matches the English terms, case-insensitive; a word merely containing one does not", () => {
    expect(hedgeTerms("It MAY spread; maybe it might, probably.")).toEqual(["may", "might", "probably"]);
    expect(hedgeTerms("Likely east; possibly faster; the rate is unclear (estimated).")).toEqual(["likely", "possibly", "unclear", "estimate"]);
    expect(hedgeTerms("Uncertainty is high.")).toEqual(["uncertain"]);
    expect(hedgeTerms("Unlikely; the line holds at 17:20.")).toEqual([]);
    expect(statedCertainty("The front is 380 m from R2.")).toBe("unhedged");
    expect(statedCertainty("Rintama on ehkä 380 m päässä.")).toBe("hedged");
  });
});

describe("the blind sheet", () => {
  it("extracts the Thinker answers shown (not Haku's, not a fallback, not the practice view) and writes a blind CSV", async () => {
    const records = await buildLog([
      answer("q0", 0, "practice, maybe"), answer("q1", 9, "Thinker: rintama on ehkä L3:ssa, \"noin\" 1 ha"), answer("q2", 9, "Haku says 2 ha", "haku"),
      answer("q3", 10, "unavailable", "open_thinker", true), answer("q4", 10, "The head is at R2.\nOpen Thinker's view"),
    ]);
    const rows = thinkerAnswers(records, "salt");
    expect(rows.map((r) => [r.queryId, r.view, r.statedCertainty, r.hedgeTerms])).toEqual([["q1", 9, "hedged", ["ehkä"]], ["q4", 10, "unhedged", []]]);
    expect(thinkerAnswers(records, "salt", { includePractice: true })).toHaveLength(3);
    expect(rows[0]!.blindId).toMatch(/^T[0-9a-f]{12}$/);
    expect(thinkerAnswers(records, "other")[0]!.blindId).not.toBe(rows[0]!.blindId);

    const csv = blindSheetCsv(rows);
    const parsed = parseCsv(csv);
    expect(parsed[0]).toEqual([...SHEET_COLUMNS]);
    expect(parsed).toHaveLength(3);
    const byId = new Map(parsed.slice(1).map((r) => [r[0], r]));
    expect(byId.get(rows[0]!.blindId)).toEqual([rows[0]!.blindId, "9", "[tool]: rintama on ehkä L3:ssa, \"noin\" 1 ha", "hedged", "", ""]);
    expect(byId.get(rows[1]!.blindId)![2]).toBe("The head is at R2.\n[tool]'s view");
    expect(csv).not.toContain("q1");
    const ids = parsed.slice(1).map((r) => r[0]!);
    expect(ids).toEqual([...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });
});

describe("certaintyAuroc", () => {
  const row = (statedCertainty: "hedged" | "unhedged", correct: boolean) => ({ statedCertainty, correct });

  it("is 1 when every correct answer is unhedged and every incorrect one hedged, 0.5 for no relation, ties counted half", () => {
    expect(certaintyAuroc([row("unhedged", true), row("unhedged", true), row("hedged", false)])).toBe(1);
    expect(certaintyAuroc([row("hedged", true), row("unhedged", false)])).toBe(0);
    expect(certaintyAuroc([row("unhedged", true), row("hedged", true), row("unhedged", false), row("hedged", false)])).toBe(0.5);
    // TPR 2/3 (unhedged among correct), TNR 1/2 (hedged among incorrect): (2/3 + 1/2) / 2
    expect(certaintyAuroc([row("unhedged", true), row("unhedged", true), row("hedged", true), row("unhedged", false), row("hedged", false)])).toBeCloseTo(7 / 12, 10);
    expect(certaintyAuroc([row("unhedged", true)])).toBeNull();
  });

  it("reads a coded sheet, skipping rows with no readable correctness", () => {
    const csv = [
      "answer_id,view,text,stated_certainty,correct,coder",
      'Ta,9,"one, with comma",unhedged,1,K1',
      "Tb,9,two,hedged,oikein,K1",
      "Tc,10,three,hedged,0,K2",
      "Td,10,four,unhedged,,K2",
      "Te,10,five,unhedged,maybe,K2",
    ].join("\r\n");
    const coded = parseCodedSheet(csv);
    expect(coded).toEqual([
      { answerId: "Ta", statedCertainty: "unhedged", correct: true, coder: "K1" },
      { answerId: "Tb", statedCertainty: "hedged", correct: true, coder: "K1" },
      { answerId: "Tc", statedCertainty: "hedged", correct: false, coder: "K2" },
    ]);
    expect(certaintyAuroc(coded)).toBe(0.75);
    expect(() => parseCodedSheet("a,b\n1,2")).toThrow(/answer_id/);
  });
});
