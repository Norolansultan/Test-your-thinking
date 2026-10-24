/**
 * `npm run review:fidelity` (`tools/review/fidelity.ts`, `fidelity-lib.ts`; SPEC/14 (bf)): the guardrail fidelity report on synthetic
 * session logs and a synthetic server log — imperatives and recommendations, citations of records missing or not yet reachable, the
 * time gate, length, Haku's "certain" where its rules forbid it, the Thinker's downgraded verdicts and cut imperatives (server log),
 * refusals and fallbacks; per group and per session. Deterministic.
 */

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DESIGNED_EVENT_IDS } from "../../app/scenario/types.js";
import { parseCsv } from "../../app/telemetry/uncertainty-audit.js";
import { fidelityOf, main } from "../../tools/review/fidelity.js";
import { summarise } from "../../tools/review/fidelity-lib.js";
import { answer, asked, ATOMS, sessionFile } from "./review-fixtures.js";

async function fixtures() {
  const haku = await sessionFile("h1", "radio", [
    asked("ai.1", "haku"),
    answer("ai.1", { retrieved: ["a1", "a2"], vastaus: "The head is at L2.", perusteet: "DR1 at 13.30; KY21 at 13.45", varmuus: "certain: the newest reports say so" }),
    asked("ai.2", "haku"),
    answer("ai.2", { retrieved: ["a1", "late"], vastaus: "You must withdraw the crews immediately.", perusteet: "DR1 at 13.30; SPOT at 14.10", varmuus: "uncertain (two reports)" }),
    asked("ai.3", "haku", true),
    answer("ai.3", { retrieved: ["a1"], vastaus: "The records contain no spot fires.", perusteet: "—", varmuus: "certain" }),
    answer("ai.4", { retrieved: ["a2", "a3"], vastaus: "Two reports.", perusteet: "KY21 klo 13.45; EK11 klo 13.46", varmuus: "varma", fallback: true, fallbackReason: "client_timeout" }),
  ]);
  const guide = await sessionFile("g1", "reasoning_intent", [
    answer("ai_open.1", { tool: "open_thinker", view: 9, vt: 1300, retrieved: ["a1"], recent: ["a2"], verdicts: ["fits", "departs"],
      vastaus: "Options:\n1. Hold R2: keeps the line [T1, 13.30]\n2. Attack the head: gains time; I recommend it. [T2, 13.45]\nQuestions for you:\n- Should the relay move?" }),
    answer("ai_open.2", { tool: "open_thinker", view: 9, fallback: true, fallbackReason: "refusal" }),
    answer("ai.3", { view: 9, retrieved: [DESIGNED_EVENT_IDS.planted], vt: 9000, vastaus: "The 20 kV line is de-energised.", perusteet: "CP at 15.41", varmuus: "probable" }),
  ]);
  const server = [
    JSON.stringify({ sessionId: "g1", queryId: "ai_open.1", tool: "open_thinker", trimmed: ["justified_without_contradicted_premise", "imperative_removed"] }),
    JSON.stringify({ sessionId: "g1", queryId: "ai_open.2", tool: "open_thinker", refusalCategory: "safety" }),
    "not json",
  ].join("\n");
  return { haku, guide, server };
}

describe("the guardrail fidelity report", () => {
  it("screens each answer: imperatives and recommendations, missing and future citations, the time gate, length, Haku's breaches", async () => {
    const { haku, guide, server } = await fixtures();
    const rows = fidelityOf([haku, guide], [server], { atoms: ATOMS });
    const by = (s: string, q: string) => rows.find((r) => r.sessionId === s && r.queryId === q)!;

    expect(by("h1", "ai.1")).toMatchObject({ tool: "haku", cell: "radio", imperativeSentences: 0, citedTimes: 2, unmatchedCitations: 0, futureCitations: 0, gateViolations: 0, certainty: "certain", certainBreach: "", uncited: false });
    // "must … immediately": an imperative; 14.10 names no record it was given and is after every record reachable then; `late` was not yet reachable.
    expect(by("h1", "ai.2")).toMatchObject({ imperativeSentences: 1, recommendations: 0, citedTimes: 2, unmatchedCitations: 1, futureCitations: 1, gateViolations: 1, certainty: "uncertain" });
    // "certain" on an absence claim (rule 3), no citation, sent from the chip.
    expect(by("h1", "ai.3")).toMatchObject({ viaChip: true, certainty: "certain", certainBreach: "absence", uncited: true, citedTimes: 0 });
    // Haku's fallback is the template: shown and screened; "varma" over two records that contradict each other (rule 5).
    expect(by("h1", "ai.4")).toMatchObject({ fallback: true, fallbackReason: "client_timeout", shown: true, certainty: "certain", certainBreach: "conflict" });

    const thinker = by("g1", "ai_open.1");
    expect(thinker).toMatchObject({ tool: "thinker", cell: "reasoning_intent", recommendations: 1, imperativeSentences: 1, citedTimes: 2, unmatchedCitations: 0, certainty: "unhedged", verdicts: ["fits", "departs"], downgraded: true, imperativeRemoved: true });
    expect(thinker.words).toBeGreaterThan(15);
    // A Thinker fallback is "unavailable": not screened; the server log gives the refusal's category.
    expect(by("g1", "ai_open.2")).toMatchObject({ shown: false, fallbackReason: "refusal", words: 0, refusalCategory: "safety", downgraded: false });
    // The question at 9000 s (step 8): the planted record was reachable; cited at its time.
    expect(by("g1", "ai.3")).toMatchObject({ tool: "haku", gateViolations: 0, futureCitations: 0, unmatchedCitations: 0, downgraded: null });
  });

  it("summarises per group and tool, Haku group first, with the server's counts only where its log was joined", async () => {
    const { haku, guide, server } = await fixtures();
    const groups = summarise(fidelityOf([haku, guide], [server], { atoms: ATOMS }));
    expect(groups.map((g) => `${g.cell}·${g.tool}`)).toEqual(["radio·haku", "reasoning_intent·haku", "reasoning_intent·thinker"]);
    expect(groups[0]).toMatchObject({ sessions: 1, answers: 4, viaChip: 1, shown: 4, fallbacks: 1, refusals: 0, withImperative: 1, withUnmatched: 1, withFuture: 1, gateViolations: 1, uncited: 1, certain: 3, certainBreaches: 2, downgraded: null });
    expect(groups[2]).toMatchObject({ answers: 2, shown: 1, fallbacks: 1, refusals: 1, withRecommendation: 1, downgraded: 1, imperativeRemoved: 1, hedged: 0 });
  });

  it("the command writes the table and the report, and prints the report; the same input gives the same bytes", async () => {
    const { haku, guide, server } = await fixtures();
    const dir = mkdtempSync(join(tmpdir(), "fidelity-"));
    writeFileSync(join(dir, "h1.jsonl"), haku);
    writeFileSync(join(dir, "g1.jsonl"), guide);
    writeFileSync(join(dir, "g1.server.jsonl"), server);
    const run = (n: number) => {
      main(["--logs", join(dir, "h1.jsonl"), join(dir, "g1.jsonl"), "--server-logs", join(dir, "g1.server.jsonl"), "--out", join(dir, `rows${n}.csv`), "--report", join(dir, `report${n}.md`)]);
      return [readFileSync(join(dir, `rows${n}.csv`), "utf8"), readFileSync(join(dir, `report${n}.md`), "utf8")] as const;
    };
    const [rows1, report1] = run(1);
    const [rows2, report2] = run(2);
    expect(rows2).toBe(rows1);
    expect(report2).toBe(report1);
    const table = parseCsv(rows1);
    expect(table[0]![0]).toBe("session_id");
    expect(table).toHaveLength(1 + 7);
    expect(report1).toContain("# Guardrail fidelity report");
    expect(report1).toContain("| Haku group · haku | 1 | 4 (1) |");
    expect(report1).toContain("## Per session");
  });
});
