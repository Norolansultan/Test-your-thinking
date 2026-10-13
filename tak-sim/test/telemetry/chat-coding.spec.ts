/** `chatQuestionsForCoding` / `blindCodingSheet` over hand-built records (8 Oct 2026). */

import { describe, expect, it } from "vitest";
import { blindCodingSheet, chatQuestionsForCoding } from "../../app/telemetry/chat-coding.js";
import type { LogRecord } from "../../app/telemetry/log.js";

const mk = (rows: readonly [number, string, object][]): LogRecord[] =>
  rows.map(([t, kind, detail], i) => ({ seq: i as never, tVirtual: 0 as never, tWallOffsetMs: t, kind, detail }));

const records = mk([
  [1_000, "ai_chat_query_submitted", { queryId: "q1", text: "Missä palo on nyt?", view: 2, virtualTimeS: 600, phase: "exploration", tool: "haku" }],
  [2_000, "ai_chat_answer_received", { queryId: "q1", view: 2, tool: "haku" }],
  [5_000, "ai_chat_query_submitted", { queryId: "q2", text: "Mitä pitäisi tehdä?", view: 9, virtualTimeS: 3_600, phase: "decision", tool: "open_thinker" }],
  [6_000, "ai_chat_answer_received", { queryId: "q2", view: 9, tool: "open_thinker" }],
  [7_000, "ai_chat_query_submitted", { queryId: "q3", text: "Vanha loki", view: 1, virtualTimeS: 0, phase: "exploration" }],
]);

describe("chatQuestionsForCoding", () => {
  it("exports every question with the tool of its answer, times, phase and a blind id", () => {
    const rows = chatQuestionsForCoding(records, "S1");
    expect(rows.map((r) => [r.queryId, r.tool, r.view, r.virtualTimeS, r.wallMs, r.phase, r.text])).toEqual([
      ["q1", "haku", 2, 600, 1_000, "exploration", "Missä palo on nyt?"],
      ["q2", "open_thinker", 9, 3_600, 5_000, "decision", "Mitä pitäisi tehdä?"],
      ["q3", null, 1, 0, 7_000, "exploration", "Vanha loki"],
    ]);
    expect(new Set(rows.map((r) => r.blindId)).size).toBe(3);
  });

  it("the blind id is stable, depends on the salt, and carries neither the query id, the tool nor the cell", () => {
    const a = chatQuestionsForCoding(records, "S1");
    expect(chatQuestionsForCoding(records, "S1")).toEqual(a);
    expect(chatQuestionsForCoding(records, "S2")[0]!.blindId).not.toBe(a[0]!.blindId);
    for (const r of a) expect(r.blindId).toMatch(/^Q[0-9a-f]{12}$/);
  });

  it("revision (an): the practice view's questions (VP, view 0) are excluded by default; includePractice keeps them, flagged", () => {
    const withPractice = mk([
      [500, "ai_chat_query_submitted", { queryId: "p1", text: "Harjoituskysymys", view: 0, virtualTimeS: 0, phase: "exploration", tool: "open_thinker" }],
      [600, "ai_chat_answer_received", { queryId: "p1", view: 0, tool: "open_thinker" }],
      [700, "ai_chat_query_submitted", { queryId: "p2", text: "Toinen harjoituskysymys", view: 0, virtualTimeS: 0, phase: "exploration", tool: "open_thinker" }],
      ...records.map((r) => [r.tWallOffsetMs, r.kind, r.detail] as [number, string, object]),
    ]);
    const rows = chatQuestionsForCoding(withPractice, "S1");
    expect(rows.map((r) => r.queryId)).toEqual(["q1", "q2", "q3"]);
    expect(rows.every((r) => r.practice === false)).toBe(true);
    const all = chatQuestionsForCoding(withPractice, "S1", { includePractice: true });
    expect(all.map((r) => [r.queryId, r.practice])).toEqual([["p1", true], ["p2", true], ["q1", false], ["q2", false], ["q3", false]]);
    expect(all[1]!.previousText).toBe("Harjoituskysymys");
    // The main rows are the same either way (practice questions never become a main question's previous one: the thread is per view).
    expect(all.slice(2)).toEqual(rows);
  });

  it("the coders' sheet drops tool and the true id and is not in log order", () => {
    const sheet = blindCodingSheet(chatQuestionsForCoding(records, "S1"));
    expect(sheet).toHaveLength(3);
    for (const row of sheet) expect(Object.keys(row).sort()).toEqual(["blindId", "phase", "previousText", "text", "view", "virtualTimeS"]);
    expect(sheet.map((r) => r.blindId)).toEqual(sheet.map((r) => r.blindId).sort());
  });

  it("gives each question the one before it in its own thread (the same tool within the same view), and the tools' names are redacted from both texts", () => {
    const thread = mk([
      [1_000, "ai_chat_query_submitted", { queryId: "a1", text: "Kysy Thinkeriltä palon suunta", view: 9, virtualTimeS: 10, phase: "exploration", tool: "open_thinker" }],
      [1_500, "ai_chat_answer_received", { queryId: "a1", view: 9, tool: "open_thinker" }],
      [2_000, "ai_chat_query_submitted", { queryId: "b1", text: "Mitä Haku sanoo tiestä?", view: 9, virtualTimeS: 20, phase: "exploration", tool: "haku" }],
      [2_500, "ai_chat_answer_received", { queryId: "b1", view: 9, tool: "haku" }],
      [3_000, "ai_chat_query_submitted", { queryId: "a2", text: "Entä nyt, Open Thinker?", view: 9, virtualTimeS: 30, phase: "exploration", tool: "open_thinker" }],
      [3_500, "ai_chat_answer_received", { queryId: "a2", view: 9, tool: "open_thinker" }],
      [4_000, "ai_chat_query_submitted", { queryId: "a3", text: "Uusi jakso", view: 10, virtualTimeS: 40, phase: "exploration", tool: "open_thinker" }],
    ]);
    const rows = chatQuestionsForCoding(thread, "S1");
    expect(rows.map((r) => r.previousText)).toEqual([null, null, "Kysy Thinkeriltä palon suunta", null]);
    const sheet = blindCodingSheet(rows);
    const byText = (t: string) => sheet.find((r) => r.text === t)!;
    expect(byText("Kysy [tool] palon suunta").previousText).toBeNull();
    expect(byText("Mitä [tool] sanoo tiestä?").previousText).toBeNull();
    expect(byText("Entä nyt, [tool]?").previousText).toBe("Kysy [tool] palon suunta");
    expect(JSON.stringify(sheet)).not.toMatch(/thinker|haku/i);
  });
});
