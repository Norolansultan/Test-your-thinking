/**
 * The uncertainty audit extended to Haku's `varmuus` (24 Oct 2026, SPEC/09 revision (bf); `app/telemetry/haku-certainty-audit.ts`,
 * `npm run review:uncertainty -- --report`): Haku's stated level read from its certainty field, the records the answer cites and their
 * certainty, overstatement and conflicts, what the answer touched (the planted record, the projection, a scripted AI error), and the
 * report by group. Synthetic logs and records (`test/tools/review-fixtures.ts`).
 */

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CANONICAL_FLAG_SEQUENCE, DESIGNED_EVENT_IDS } from "../../app/scenario/types.js";
import {
  answerGrounds, certaintyReport, citedTimes, hakuCertaintyLevel, mentionsProjection, overstated, projectionWrongIn, type AuditAtom,
} from "../../app/telemetry/haku-certainty-audit.js";
import type { AiChatAnswerReceivedDetail } from "../../app/telemetry/record-kinds.js";
import { parseCsv } from "../../app/telemetry/uncertainty-audit.js";
import { certaintyAudit, main } from "../../tools/review/thinker-uncertainty-audit.js";
import { answer, ATOMS, sessionFile } from "../tools/review-fixtures.js";

const atoms = new Map<string, AuditAtom>(ATOMS.map((a) => [a.id, a]));
const detail = (e: ReturnType<typeof answer>) => e.detail as AiChatAnswerReceivedDetail;

describe("Haku's stated level", () => {
  it("is the first level word of the certainty field, in either language, never a word inside another", () => {
    expect(hakuCertaintyLevel("certain: the newest reports state it")).toBe("certain");
    expect(hakuCertaintyLevel("uncertain (the sources disagree)")).toBe("uncertain");
    expect(hakuCertaintyLevel("probable (two reports); not certain")).toBe("probable");
    expect(hakuCertaintyLevel("not known: no report on it")).toBe("not_known");
    expect(hakuCertaintyLevel("varma")).toBe("certain");
    expect(hakuCertaintyLevel("epävarma (lähteet eroavat)")).toBe("uncertain");
    expect(hakuCertaintyLevel("todennäköinen, kaksi ilmoitusta")).toBe("probable");
    expect(hakuCertaintyLevel("Ei tiedossa.")).toBe("not_known");
    expect(hakuCertaintyLevel("unlikely to change")).toBe("unparsed");
    expect(hakuCertaintyLevel("")).toBe("unparsed");
  });

  it("is overstated when it ranks above the weakest record it cites", () => {
    expect(overstated("certain", "uncertain")).toBe(true);
    expect(overstated("probable", "probable")).toBe(false);
    expect(overstated("certain", null)).toBe(false);
    expect(overstated("unparsed", "unknown" as never)).toBe(false);
  });
});

describe("what an answer rests on and touches", () => {
  it("cites times in Haku's basis and in the Thinker's brackets only", () => {
    expect(citedTimes("haku", { vastaus: "By 15.30 the head reaches R1.", perusteet: "DR1 at 13.30; KY21 klo 13:45; DR1 at 13.30", varmuus: "", muuttaisi: "" })).toEqual(["13.30", "13.45"]);
    expect(citedTimes("thinker", { vastaus: "Hold R2 [T1, T2, 13.30, 13.45]. P2 no longer holds: EK16 19.22.", perusteet: "", varmuus: "", muuttaisi: "" })).toEqual(["13.30", "13.45"]);
  });

  it("the weakest cited record's certainty, conflicts between cited records, the planted record cited or only given", () => {
    const g = answerGrounds(detail(answer("q", { retrieved: ["a1", "a2"], perusteet: "DR1 at 13.30; KY21 at 13.45", varmuus: "certain" })), "haku", atoms);
    expect(g).toMatchObject({ basisAtomIds: ["a1", "a2"], recordLevel: "uncertain", conflict: false, planted: "no", projection: false, aiError: false });
    expect(answerGrounds(detail(answer("q", { retrieved: ["a2", "a3"], perusteet: "KY21 at 13.45; EK11 at 13.46" })), "haku", atoms)).toMatchObject({ recordLevel: "uncertain", conflict: true });
    const planted = DESIGNED_EVENT_IDS.planted;
    expect(answerGrounds(detail(answer("q", { retrieved: [planted], perusteet: "CP at 15.41" })), "haku", atoms).planted).toBe("cited");
    expect(answerGrounds(detail(answer("q", { retrieved: ["a1"], recent: [planted], perusteet: "DR1 at 13.30" })), "haku", atoms).planted).toBe("given");
  });

  it("the projection named; a scripted AI error is the projection named in a view whose projection is wrong", () => {
    expect(mentionsProjection("Is the spread projection right?", "")).toBe(true);
    expect(mentionsProjection("", "Leviämisennusteen mukaan palo etenee itään.")).toBe(true);
    expect(mentionsProjection("What is the weather forecast?", "Sääennuste: tuuli kääntyy.")).toBe(false);
    const wrong = CANONICAL_FLAG_SEQUENCE.findIndex((f) => f !== "holds") + 1;
    const right = CANONICAL_FLAG_SEQUENCE.findIndex((f) => f === "holds") + 1;
    expect(projectionWrongIn(wrong)).toBe(true);
    expect(projectionWrongIn(right)).toBe(false);
    expect(projectionWrongIn(0)).toBe(false);
    const asked = (view: number) => answerGrounds(detail(answer("q", { view, question: "Does the projection hold?", retrieved: [] })), "haku", atoms);
    expect(asked(wrong)).toMatchObject({ projection: true, aiError: true });
    expect(asked(right)).toMatchObject({ projection: true, aiError: false });
  });
});

describe("the certainty audit by group (`review:uncertainty -- --report`)", () => {
  async function logs() {
    const wrong = CANONICAL_FLAG_SEQUENCE.findIndex((f) => f !== "holds") + 1;
    const haku = await sessionFile("h1", "radio", [
      answer("ai.1", { retrieved: ["a1", "a2"], perusteet: "DR1 at 13.30; KY21 at 13.45", varmuus: "certain" }),
      answer("ai.2", { retrieved: ["a2", "a3"], perusteet: "KY21 at 13.45; EK11 at 13.46", varmuus: "certain" }),
      answer("ai.3", { view: wrong, question: "Is the projection right?", retrieved: [], perusteet: "—", varmuus: "not known" }),
      answer("ai.4", { view: 0, retrieved: [], varmuus: "certain" }), // the practice view: left out
    ]);
    const guide = await sessionFile("g1", "reasoning_intent", [
      answer("ai.1", { retrieved: [DESIGNED_EVENT_IDS.planted], vt: 9000, view: 9, perusteet: "CP at 15.41", varmuus: "probable" }),
      answer("ai_open.1", { tool: "open_thinker", view: 9, retrieved: ["a1"], vastaus: "The head may cross R2 [T1, 13.30]." }),
      answer("ai_open.2", { tool: "open_thinker", view: 9, fallback: true }), // "unavailable": left out
    ]);
    return { haku, guide };
  }

  it("rows per answer of either tool: the stated certainty, the grounds, overstatement and 'certain' despite a conflict", async () => {
    const { haku, guide } = await logs();
    const rows = certaintyAudit([haku, guide], { atoms: ATOMS });
    expect(rows.map((r) => `${r.sessionId}:${r.queryId}:${r.tool}:${r.stated}`)).toEqual([
      "h1:ai.1:haku:certain", "h1:ai.2:haku:certain", "h1:ai.3:haku:not_known", "g1:ai.1:haku:probable", "g1:ai_open.1:thinker:hedged",
    ]);
    expect(rows[0]).toMatchObject({ recordLevel: "uncertain", overstated: true, certainDespiteConflict: false });
    expect(rows[1]).toMatchObject({ conflict: true, certainDespiteConflict: true });
    expect(rows[2]).toMatchObject({ projection: true, aiError: true, recordLevel: null, overstated: false });
    expect(rows[3]).toMatchObject({ planted: "cited", recordLevel: "certain", overstated: false });
    expect(rows[4]).toMatchObject({ tool: "thinker", overstated: false, basisAtomIds: ["a1"] });
  });

  it("the report gives each group's Haku levels and both tools' certainty by touch; the command writes it and the rows", async () => {
    const { haku, guide } = await logs();
    const report = certaintyReport(certaintyAudit([haku, guide], { atoms: ATOMS }));
    // Both "certain" answers cite an uncertain record: both overstate it; one also over a conflict.
    expect(report).toContain("| Haku group | 3 | 2 (67 %) | 0 (0 %) | 0 (0 %) | 1 (33 %) | 0 (0 %) | 2 | 2 (100 %) | 1 |");
    expect(report).toContain("| Haku group | haku | none of these | 2 | 100 % · 3.00 | — |");
    expect(report).toContain("| guide group | 1 | 0 (0 %) | 1 (100 %) |");
    expect(report).toContain("| Haku group | haku | projection named, wrong-projection view (scripted AI error) | 1 | 0 % · 0.00 | — |");
    expect(report).toContain("| guide group | haku | planted record cited (H9) | 1 | 0 % · 2.00 | — |");
    expect(report).toContain("| guide group | thinker | none of these | 1 | — | 100 % |");

    const dir = mkdtempSync(join(tmpdir(), "certainty-"));
    writeFileSync(join(dir, "h1.jsonl"), haku);
    writeFileSync(join(dir, "g1.jsonl"), guide);
    main(["--logs", join(dir, "h1.jsonl"), join(dir, "g1.jsonl"), "--report", join(dir, "report.md"), "--haku", join(dir, "rows.csv")]);
    expect(readFileSync(join(dir, "report.md"), "utf8")).toContain("## Haku's stated level against the records it cites");
    const csv = parseCsv(readFileSync(join(dir, "rows.csv"), "utf8"));
    expect(csv[0]![0]).toBe("session_id");
    expect(csv).toHaveLength(1 + 5);
  });
});
