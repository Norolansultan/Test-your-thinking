/**
 * SPEC/10_Build_Plan_and_Acceptance.md, M4: "`test/telemetry/coverage.spec`
 * drives a scripted session and asserts every record kind in `07` §2 is
 * emitted at least once with every required field."
 */

import { describe, expect, it } from "vitest";
import { ALL_RECORD_KINDS } from "../../app/telemetry/record-kinds.js";
import { assertGapless } from "../../app/telemetry/log.js";
import { runScriptedSession } from "./scripted-session.js";

describe("telemetry coverage — every record kind emitted at least once", () => {
  it("the scripted session emits every kind in ALL_RECORD_KINDS", async () => {
    const { records } = await runScriptedSession();
    const kindsEmitted = new Set(records.map((r) => r.kind));
    const missing = ALL_RECORD_KINDS.filter((k) => !kindsEmitted.has(k));
    expect(missing).toEqual([]);
  });

  it("emits no kind outside the declared enumeration", async () => {
    const { records } = await runScriptedSession();
    const allowed = new Set<string>(ALL_RECORD_KINDS);
    const unexpected = records.map((r) => r.kind).filter((k) => !allowed.has(k));
    expect(unexpected).toEqual([]);
  });

  it("every kind is emitted exactly once in this script (so 'missing' above can't be masked by a duplicate)", async () => {
    const { records } = await runScriptedSession();
    const counts = new Map<string, number>();
    for (const r of records) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
    for (const kind of ALL_RECORD_KINDS) {
      expect(counts.get(kind)).toBe(1);
    }
  });

  it("the log stays gapless across the full scripted session (I5)", async () => {
    const { records } = await runScriptedSession();
    assertGapless(records);
  });

  it("no record's detail is undefined or null (every kind supplies a real, typed detail object)", async () => {
    const { records } = await runScriptedSession();
    for (const record of records) {
      expect(record.detail).not.toBeUndefined();
      expect(record.detail).not.toBeNull();
    }
  });

  it("the chat records name their chat (D3, 8 Oct 2026: Haku's chat and the Open Thinker log the same kinds)", async () => {
    const { records } = await runScriptedSession();
    for (const r of records.filter((x) => x.kind === "ai_chat_query_submitted" || x.kind === "ai_chat_answer_received")) {
      expect(["haku", "open_thinker"]).toContain((r.detail as { tool?: string }).tool);
    }
  });

  it("the Open Thinker's answer carries its fit verdict as a covariate (D6, 8 Oct 2026): one of the three or null, and only on its answers", async () => {
    const { records } = await runScriptedSession();
    const answers = records.filter((x) => x.kind === "ai_chat_answer_received").map((r) => r.detail as { tool?: string; aiVerdict?: string | null });
    expect(answers.filter((d) => d.tool === "open_thinker").map((d) => d.aiVerdict)).toEqual(["in_line"]);
    for (const d of answers) if (d.aiVerdict !== undefined && d.aiVerdict !== null) expect(["in_line", "departs", "not_covered"]).toContain(d.aiVerdict);
    for (const d of answers.filter((x) => x.tool === "haku")) expect(d).not.toHaveProperty("aiVerdict");
  });

  it("query_edit never carries raw keystroke text — only a count (SPEC/07 §3)", async () => {
    const { records } = await runScriptedSession();
    const queryEdit = records.find((r) => r.kind === "query_edit")!;
    expect(queryEdit.detail).not.toHaveProperty("text");
    expect(queryEdit.detail).toHaveProperty("count");
  });

  it("no record contains a correctness/flag/truth field (SPEC/07 §3: 'no record contains a correctness value, a flag, a truth annotation')", async () => {
    const { records } = await runScriptedSession();
    const bannedKeys = ["isGroundTruth", "isDecoy", "flag", "breachGeometry", "isCorrect", "score"];
    for (const record of records) {
      const json = JSON.stringify(record.detail);
      for (const key of bannedKeys) {
        expect(json).not.toContain(`"${key}"`);
      }
    }
  });
});
