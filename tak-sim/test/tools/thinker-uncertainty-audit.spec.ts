/**
 * `tools/review/thinker-uncertainty-audit.ts` (SPEC/32 §5): session files → the blind sheet, the unblinding key and the AUROC report.
 */

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import { InMemoryLogSink, SessionLog, type LogHeader } from "../../app/telemetry/log.js";
import type { TelemetryEvent } from "../../app/telemetry/record-kinds.js";
import { parseCsv } from "../../app/telemetry/uncertainty-audit.js";
import { auditSessions, aurocReport, keyCsv, main } from "../../tools/review/thinker-uncertainty-audit.js";

const header = (sessionId: string): LogHeader => ({
  formatVersion: "0.12.0", sessionId, participantCode: `P-${sessionId}`, condition: "substitutive", scenarioId: "s", scenarioVersion: "0",
  seed: "1", bundleHash: "b", appVersion: "0", startedAtIso: "2026-01-01T00:00:00.000Z", userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 },
  cell: "reasoning_intent", echelon: "command",
});

const answer = (queryId: string, view: number, vastaus: string): TelemetryEvent => ({
  kind: "ai_chat_answer_received",
  detail: {
    queryId, text: "q", view, virtualTimeS: 0, retrieved: [], retrievalMode: "hybrid", modelId: "m", promptHash: "h",
    answer: { vastaus, perusteet: "", varmuus: "", muuttaisi: "" }, latencyMs: 1, fallback: false, fallbackReason: null, phase: "exploration", promptVariant: "standard", tool: "open_thinker",
  },
});

async function sessionFile(sessionId: string, events: readonly TelemetryEvent[]): Promise<string> {
  const h = header(sessionId);
  const log = new SessionLog(h, new InMemoryLogSink());
  for (const [i, e] of events.entries()) await appendTelemetryEvent(log, asVirtualTime(0), i, e);
  return [JSON.stringify({ header: h }), ...(await log.readAll()).map((r) => JSON.stringify(r))].join("\n");
}

describe("thinker-uncertainty-audit", () => {
  it("audits session files into a blind sheet and a key, and reports the AUROC of a coded sheet", async () => {
    const a = await sessionFile("s1", [answer("q1", 9, "Rintama on todennäköisesti L3:ssa."), answer("q2", 10, "R2 on 380 m päässä.")]);
    const b = await sessionFile("s2", [answer("q1", 11, "The head may cross the road.")]);
    const sessions = auditSessions([a, b]);
    expect(sessions.map((s) => [s.sessionId, s.participant, s.rows.map((r) => r.statedCertainty)])).toEqual([
      ["s1", "P-s1", ["hedged", "unhedged"]], ["s2", "P-s2", ["hedged"]],
    ]);
    expect(new Set(sessions.flatMap((s) => s.rows.map((r) => r.blindId))).size).toBe(3); // the same query id in two sessions: two ids
    const key = parseCsv(keyCsv(sessions));
    expect(key[0]).toEqual(["answer_id", "session_id", "participant", "query_id", "hedge_terms"]);
    expect(key.slice(1).find((r) => r[1] === "s2")).toEqual([sessions[1]!.rows[0]!.blindId, "s2", "P-s2", "q1", "may"]);

    const dir = mkdtempSync(join(tmpdir(), "uncertainty-"));
    writeFileSync(join(dir, "a.jsonl"), a);
    writeFileSync(join(dir, "b.jsonl"), b);
    main(["--logs", join(dir, "a.jsonl"), join(dir, "b.jsonl"), "--out", join(dir, "sheet.csv"), "--key", join(dir, "key.csv")]);
    const sheet = parseCsv(readFileSync(join(dir, "sheet.csv"), "utf8"));
    expect(sheet).toHaveLength(4);
    expect(sheet.flat().join(" ")).not.toContain("s1");
    expect(readFileSync(join(dir, "key.csv"), "utf8")).toContain("s1");

    // The coders fill `correct`: the unhedged answer correct, the hedged ones wrong → AUROC 1.
    const coded = [sheet[0]!.join(","), ...sheet.slice(1).map((r) => [r[0], r[1], `"${r[2]}"`, r[3], r[3] === "unhedged" ? "1" : "0", "K1"].join(","))].join("\n");
    const report = aurocReport(coded);
    expect(report).toContain("coded answers: 3");
    expect(report).toContain("AUROC (unhedged = 1 against correct): 1.000");
    expect(aurocReport(sheet.map((r) => r.join(",")).join("\n"))).toContain("n/a");
  });
});
