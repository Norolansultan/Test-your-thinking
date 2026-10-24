/**
 * Assignment bound to the participant code (SPEC/27 §2.2, U4; reconciled 5 Oct 2026): the committed
 * allocation table regenerates byte for byte, its blocks are 5 : 5 (Haku : guide, SPEC/30 §2) within
 * each language stratum, the study link takes `?koodi=` and looks the cell up, `?solu=` is for demonstrations and
 * pilots only, the header logs the code and where the cell came from, and the Thinker server refuses
 * a cell that does not match the code's row.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import {
  ASSIGNMENT_PLAN, assignmentOf, BLOCK_SIZE, CODE_ALPHABET, generateAssignmentRows, inStratum, stratumSeed, type AssignmentTable,
} from "../../app/session/assignment.js";
import { STRATA, stratumId } from "../../app/telemetry/record-kinds-pilot2.js";
import { sessionHeader } from "../../app/session/header.js";
import { SessionOrchestrator } from "../../app/session/orchestrator.js";
import { ALLOCATION_TABLE, conditionOfCell, startChoiceFromUrl } from "../../app/session/preview.js";
import { validateThinkerRequest } from "../../app/session/thinker-protocol.js";
import { InMemoryLogSink, SessionLog, type LogHeader } from "../../app/telemetry/log.js";
import { asVirtualTime } from "../../app/engine/primitives.js";
import { stepAtVirtualTime } from "../../app/retrieval/time-gate.js";
import { SessionQueries } from "../../app/session/queries.js";
import type { ThinkerTransport } from "../../app/session/thinker-transport.js";
import { allocationError } from "../../server/thinker/handler.js";
import { ALLOCATION_FILE, renderAllocationFile, rowsSha256 } from "../../tools/assignment/generate.js";

const scenario = buildDemoScenario();
const committed = readFileSync(ALLOCATION_FILE, "utf8");
const table = JSON.parse(committed) as AssignmentTable;

describe("the allocation table", () => {
  it("regenerates byte-identically from the fixed seed", () => {
    expect(renderAllocationFile()).toBe(committed);
    expect(table.seed).toBe(ASSIGNMENT_PLAN.seed);
    expect(table.rowsSha256).toBe(rowsSha256(table.rows));
    expect(table.rowsSha256).toBe(createHash("sha256").update(JSON.stringify(generateAssignmentRows(ASSIGNMENT_PLAN))).digest("hex"));
    expect(ALLOCATION_TABLE.rowsSha256).toBe(table.rowsSha256); // the app reads the same file
  });

  it("has the strata of SPEC/30 §2 revision (bf): language × profession × leads others, every one of the twelve with its codes", () => {
    expect(ASSIGNMENT_PLAN.strata).toHaveLength(12);
    expect(ASSIGNMENT_PLAN.strata.map((s) => `${s.language}.${stratumId(s)}`)).toEqual(
      (["en", "fi"] as const).flatMap((language) => STRATA.map((s) => `${language}.${stratumId(s)}`)),
    );
    expect(table.version).toBe(2);
    expect(table.strata).toEqual(ASSIGNMENT_PLAN.strata);
    expect(table.rows.filter((r) => r.language === "en")).toHaveLength(140);
    expect(table.rows.filter((r) => r.language === "fi")).toHaveLength(68);
    expect(table.rows).toHaveLength(208);
    expect(table.rowsSha256).toBe("b7da0140b9e87f0afb34451db92b46da07665ef02b27266b73e22ec2ef9664ec"); // revision (bf) (was 4a4b080b…38f2, language strata only)
  });

  it("each stratum has its own stream: its rows do not depend on any other stratum's size or position", () => {
    const one = ASSIGNMENT_PLAN.strata[3]!; // en.military.nolead
    const alone = generateAssignmentRows({ ...ASSIGNMENT_PLAN, strata: [one] });
    expect(alone).toEqual(table.rows.filter((r) => inStratum(r, one.language, one)));
    const bigger = generateAssignmentRows({ ...ASSIGNMENT_PLAN, strata: ASSIGNMENT_PLAN.strata.map((s, i) => (i === 0 ? { ...s, blocks: s.blocks + 3 } : s)) });
    expect(bigger.filter((r) => inStratum(r, one.language, one))).toEqual(alone);
    expect(stratumSeed(ASSIGNMENT_PLAN.seed, "en", one)).not.toBe(stratumSeed(ASSIGNMENT_PLAN.seed, "fi", one));
  });

  it("another seed gives another table (the seed is what fixes it)", () => {
    expect(generateAssignmentRows({ ...ASSIGNMENT_PLAN, seed: ASSIGNMENT_PLAN.seed + 1 })).not.toEqual(table.rows);
  });

  it("is permuted blocks of 4, 2 : 2, within each stratum; no code carries reasoning_once (SPEC/30 §2 (bf))", () => {
    expect(BLOCK_SIZE).toBe(4);
    for (const s of ASSIGNMENT_PLAN.strata) {
      const rows = table.rows.filter((r) => inStratum(r, s.language, s));
      expect(rows).toHaveLength(s.blocks * BLOCK_SIZE);
      for (let b = 1; b <= s.blocks; b++) {
        const block = rows.filter((r) => r.block === b);
        expect(block).toHaveLength(BLOCK_SIZE);
        const count = (cell: string) => block.filter((r) => r.cell === cell).length;
        expect([count("radio"), count("reasoning_intent")]).toEqual([2, 2]);
      }
      // Issued in table order, a stratum is never more than two codes out of balance.
      let diff = 0;
      for (const r of rows) { diff += r.cell === "radio" ? 1 : -1; expect(Math.abs(diff)).toBeLessThanOrEqual(2); }
    }
    expect(table.rows.some((r) => r.cell === "reasoning_once")).toBe(false);
    // Shuffled, not in composition order: not every block opens with two Haku rows.
    const blockStarts = table.rows.filter((_, i) => i % BLOCK_SIZE === 0).map((_, b) => table.rows.slice(b * BLOCK_SIZE, b * BLOCK_SIZE + 2));
    expect(blockStarts.every((two) => two.every((r) => r.cell === "radio"))).toBe(false);
  });

  it("has unique opaque codes: the stratum's letter and five characters, nothing from the cell", () => {
    const codes = table.rows.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    const body = `[${CODE_ALPHABET}]{5}`;
    for (const r of table.rows) expect(r.code).toMatch(new RegExp(`^${r.language === "fi" ? "F" : "E"}${body}$`));
  });

  it("looks a code up, ignoring case and surrounding space; an unknown code has no row", () => {
    const row = table.rows[7]!;
    expect(assignmentOf(table, ` ${row.code.toLowerCase()} `)).toEqual(row);
    expect(assignmentOf(table, "FXXXXX")).toBeNull();
  });
});

describe("the start page with a participant code", () => {
  const fi = table.rows.find((r) => r.language === "fi" && r.cell === "reasoning_intent")!;
  const en = table.rows.find((r) => r.language === "en" && r.cell === "radio")!;

  it("study: the table's cell and language; the cell never comes from the link", () => {
    expect(startChoiceFromUrl(`?tuotanto&koodi=${fi.code}`)).toEqual({
      kind: "assigned", cell: "reasoning_intent", participantCode: fi.code, language: "fi",
      assignment: { source: "table", tableSha256: table.rowsSha256, block: fi.block, assignmentSource: "link", stratum: { profession: fi.profession, leads: fi.leads } },
    });
    expect(startChoiceFromUrl(`?tuotanto&koodi=${en.code}`)).toMatchObject({ kind: "assigned", cell: "radio", language: "en" });
  });

  it("refuses an unknown code, a code with ?solu=, and ?solu= in the study without ?pilotti", () => {
    expect(startChoiceFromUrl("?tuotanto&koodi=FXXXXX").kind).toBe("invalid");
    expect(startChoiceFromUrl(`?tuotanto&koodi=${fi.code}&solu=m7`).kind).toBe("invalid");
    expect(startChoiceFromUrl(`?koodi=${fi.code}&solu=m7`).kind).toBe("invalid");
    expect(startChoiceFromUrl("?tuotanto&solu=m7").kind).toBe("invalid");
    expect(startChoiceFromUrl("?tuotanto&solu=m7&pilotti")).toMatchObject({ kind: "assigned", cell: "reasoning_once", assignment: { source: "url_pilot" } });
  });

  it("revision (bf): the shared link carries the stratum (?osite=); without one, or with an unknown one, it is refused", () => {
    expect(startChoiceFromUrl("?tuotanto&osite=military.lead")).toEqual({ kind: "server_assign", stratum: { profession: "military", leads: true } });
    expect(startChoiceFromUrl("?tuotanto&osite=Fire_Rescue.NoLead")).toEqual({ kind: "server_assign", stratum: { profession: "fire_rescue", leads: false } });
    const missing = startChoiceFromUrl("?tuotanto");
    expect(missing).toMatchObject({ kind: "invalid" });
    expect((missing as { message: string }).message).toMatch(/no stratum \(\?osite=/);
    expect(startChoiceFromUrl("?tuotanto&osite=police.lead")).toMatchObject({ kind: "invalid" });
    expect(STRATA.map((s) => startChoiceFromUrl(`?tuotanto&osite=${stratumId(s)}`).kind)).toEqual(Array(6).fill("server_assign"));
  });

  it("revision (bf): a code link may name its stratum and must then name the code's; a pilot or demonstration link logs the one it names", () => {
    const own = stratumId({ profession: fi.profession, leads: fi.leads });
    expect(startChoiceFromUrl(`?tuotanto&koodi=${fi.code}&osite=${own}`)).toMatchObject({ kind: "assigned", participantCode: fi.code });
    const other = STRATA.map(stratumId).find((id) => id !== own)!;
    expect(startChoiceFromUrl(`?tuotanto&koodi=${fi.code}&osite=${other}`)).toMatchObject({ kind: "invalid" });
    expect(startChoiceFromUrl("?tuotanto&solu=t2&pilotti&osite=other.nolead")).toMatchObject({ kind: "assigned", assignment: { source: "url_pilot", stratum: { profession: "other", leads: false } } });
    expect(startChoiceFromUrl("?solu=k4&osite=fire_rescue.lead")).toMatchObject({ kind: "assigned", assignment: { source: "url", stratum: { profession: "fire_rescue", leads: true } } });
    expect(startChoiceFromUrl("?solu=k4")).toMatchObject({ kind: "assigned", assignment: { source: "url" } });
    expect((startChoiceFromUrl("?solu=k4") as { assignment: object }).assignment).not.toHaveProperty("stratum");
  });

  it("the header logs the code, the cell and the table's hash", async () => {
    const choice = startChoiceFromUrl(`?tuotanto&koodi=${fi.code}`);
    if (choice.kind !== "assigned") throw new Error("expected an assignment");
    const o = new SessionOrchestrator(scenario, conditionOfCell(choice.cell), {
      cell: choice.cell, participantCode: choice.participantCode!, assignment: choice.assignment, language: choice.language!, thinker: { transport: vi.fn() },
    });
    await o.start();
    const header = (await o.logRecords()).find((r) => r.kind === "session_started")!.detail as LogHeader;
    expect(header).toMatchObject({ participantCode: fi.code, cell: "reasoning_intent", language: "fi", assignment: { source: "table", tableSha256: table.rowsSha256, block: fi.block, stratum: { profession: fi.profession, leads: fi.leads } } });
    expect(sessionHeader(scenario, "directed", "p", "fi", null, true, "radio")).not.toHaveProperty("assignment");
  });
});

describe("the Thinker server checks the cell against the code", () => {
  const intent = table.rows.find((r) => r.cell === "reasoning_intent")!;
  const haku = table.rows.find((r) => r.cell === "radio")!;

  it("accepts the code's own cell, refuses another or an unknown code; no code, no check", () => {
    expect(allocationError({ cell: "reasoning_intent", participantCode: intent.code })).toBeNull();
    expect(allocationError({ cell: "reasoning_once", participantCode: intent.code })).toMatch(/does not match/);
    expect(allocationError({ cell: "reasoning_intent", participantCode: haku.code })).toMatch(/does not match/);
    expect(allocationError({ cell: "reasoning_once", participantCode: "FXXXXX" })).toMatch(/unknown/);
    expect(allocationError({ cell: "reasoning_intent" })).toBeNull();
  });

  it("the browser sends the code only for a table-assigned session", async () => {
    const spec = scenario.cycles.find((c) => c.index === 9)!;
    for (const [assignment, code] of [[{ source: "table", tableSha256: table.rowsSha256, block: intent.block }, intent.code], [{ source: "url" }, "preview"]] as const) {
      const log = new SessionLog(sessionHeader(scenario, "substitutive", code, "fi", null, true, "reasoning_intent", assignment), new InMemoryLogSink());
      const transport = vi.fn<ThinkerTransport>().mockRejectedValue(new TypeError("offline"));
      const q = new SessionQueries({
        scenario, log, now: () => asVirtualTime(spec.startsAtVirtual), view: () => 9, currentStep: () => stepAtVirtualTime(spec, spec.startsAtVirtual)!,
        viewEndVirtual: () => spec.startsAtVirtual, phaseTag: () => "exploration", aiAvailable: () => true, language: () => "fi", cell: () => "reasoning_intent",
      }, { transport, wait: async () => {} });
      await q.askAiChat("q");
      const sent = transport.mock.calls[0]![0];
      if (assignment.source === "table") expect(sent.participantCode).toBe(intent.code);
      else expect(sent).not.toHaveProperty("participantCode");
    }
  });

  it("the request carries the code through validation; a malformed code is refused", () => {
    const base = { sessionId: "s1", condition: "substitutive", view: 9, virtualTimeS: 1, question: "q", cell: "reasoning_intent" };
    const v = validateThinkerRequest({ ...base, participantCode: intent.code });
    expect(v.ok && v.request.participantCode).toBe(intent.code);
    expect(validateThinkerRequest({ ...base, participantCode: "../x y" }).ok).toBe(false);
  });
});
