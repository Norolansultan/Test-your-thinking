/**
 * The shared study link in the browser (revision (af), 9 Oct 2026; `app/session/auto-assign.ts`):
 * `?tuotanto` without a code asks `/api/assign` once when the participant starts, keeps the code and
 * the session id, never draws twice in the same browser, says the link is not active when there is
 * no assign route, and the header logs `assignmentSource`.
 */

import { describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { obtainAssignment, readStoredAssignment, STORED_ASSIGNMENT_KEY, type AssignDeps, type StorageLike } from "../../app/session/auto-assign.js";
import { ALLOCATION_TABLE, assignedByCode, conditionOfCell, startChoiceFromUrl } from "../../app/session/preview.js";
import { SessionOrchestrator } from "../../app/session/orchestrator.js";
import type { LogHeader } from "../../app/telemetry/log.js";
import { LINK_INACTIVE_BOTH } from "../../app/i18n/auto-assign-texts.js";
import { stratumOfRow } from "../../app/session/assignment.js";
import { stratumId } from "../../app/telemetry/record-kinds-pilot2.js";

const intent = ALLOCATION_TABLE.rows.find((r) => r.language === "en" && r.cell === "reasoning_intent")!;
/** The code's stratum (revision (bf)): the shared link of that stratum is the one that issues it. */
const own = stratumOfRow(intent);

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
}

function deps(fetchImpl: AssignDeps["fetch"], storage = memoryStorage()) {
  let n = 0;
  return { storage, fetch: vi.fn(fetchImpl), newSessionId: () => `browsersession${String(++n).padStart(4, "0")}` };
}

const answer = (status: number, body: unknown) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe("the shared study link", () => {
  it("is ?tuotanto with the stratum (?osite=, revision (bf)) and without a code; ?koodi= still works as a manual link", () => {
    expect(startChoiceFromUrl(`?tuotanto&osite=${stratumId(own)}`)).toEqual({ kind: "server_assign", stratum: own });
    expect(startChoiceFromUrl("?tuotanto").kind).toBe("invalid"); // revision (bf): the shared link names its stratum
    expect(startChoiceFromUrl(`?tuotanto&koodi=${intent.code}`)).toMatchObject({ kind: "assigned", assignment: { source: "table", assignmentSource: "link", stratum: own } });
    expect(startChoiceFromUrl("")).toEqual({ kind: "choose" }); // the demonstration is unchanged
  });

  it("asks once with the link's stratum, stores the code with the session id, and resumes from storage without a second draw", async () => {
    const d = deps(answer(200, { code: intent.code }));
    const first = await obtainAssignment("en", d, own);
    expect(first).toEqual({ ok: true, code: intent.code, sessionId: "browsersession0001" });
    expect(d.fetch).toHaveBeenCalledTimes(1);
    expect(d.fetch.mock.calls[0]![0]).toBe("/api/assign");
    expect(JSON.parse(d.fetch.mock.calls[0]![1].body)).toEqual({ sessionId: "browsersession0001", language: "en", stratum: stratumId(own) });
    expect(readStoredAssignment(d.storage)).toEqual({ sessionId: "browsersession0001", code: intent.code });

    const again = await obtainAssignment("en", d); // the same link reopened in the same browser
    expect(again).toEqual(first);
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it("a retry after a lost response repeats the same session id (the server answers it with the same code)", async () => {
    const storage = memoryStorage();
    const lost = deps(async () => { throw new TypeError("network"); }, storage);
    expect(await obtainAssignment("en", lost)).toEqual({ ok: false, reason: "inactive" });
    const retry = { ...deps(answer(200, { code: intent.code }), storage), newSessionId: () => "anotherfreshsession" };
    await obtainAssignment("en", retry);
    expect(JSON.parse(retry.fetch.mock.calls[0]![1].body).sessionId).toBe("browsersession0001");
  });

  it("no assign route (404, offline, an HTML page) or a refusal: no assignment, never a fallback cell", async () => {
    expect(await obtainAssignment("en", deps(answer(404, { error: "not found" })))).toEqual({ ok: false, reason: "inactive" });
    expect(await obtainAssignment("en", deps(async () => { throw new TypeError("offline"); }))).toEqual({ ok: false, reason: "inactive" });
    expect(await obtainAssignment("en", deps(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("html"); } })))).toEqual({ ok: false, reason: "inactive" });
    expect(await obtainAssignment("en", deps(answer(410, { error: "no codes left" })))).toEqual({ ok: false, reason: "refused" });
    expect(await obtainAssignment("en", deps(answer(200, { code: "EXXXXX" })))).toEqual({ ok: false, reason: "inactive" });
    // A code of the other language stratum is not accepted.
    const fi = ALLOCATION_TABLE.rows.find((r) => r.language === "fi")!;
    expect(await obtainAssignment("en", deps(answer(200, { code: fi.code })))).toEqual({ ok: false, reason: "inactive" });
    // Revision (bf): nor a code of another stratum than the link's.
    const otherStratum = ALLOCATION_TABLE.rows.find((r) => r.language === "en" && stratumId(r) !== stratumId(own))!;
    expect(await obtainAssignment("en", deps(answer(200, { code: otherStratum.code })), own)).toEqual({ ok: false, reason: "inactive" });
    expect(LINK_INACTIVE_BOTH).toEqual(["Tämä linkki ei ole käytössä. Ota yhteyttä tutkijaan.", "This link is not active; please contact the researcher."]);
  });

  it("ignores a damaged stored entry", () => {
    const s = memoryStorage();
    s.setItem(STORED_ASSIGNMENT_KEY, "{not json");
    expect(readStoredAssignment(s)).toBeNull();
    s.setItem(STORED_ASSIGNMENT_KEY, JSON.stringify({ sessionId: "../../x", code: intent.code }));
    expect(readStoredAssignment(s)).toBeNull();
  });

  it("the header logs assignmentSource: server for an issued code, link for ?koodi=", async () => {
    const scenario = buildDemoScenario();
    for (const [choice, source] of [[assignedByCode(intent.code, "server")!, "server"], [startChoiceFromUrl(`?tuotanto&koodi=${intent.code}`), "link"]] as const) {
      if (choice.kind !== "assigned") throw new Error("expected an assignment");
      const o = new SessionOrchestrator(scenario, conditionOfCell(choice.cell), {
        cell: choice.cell, participantCode: choice.participantCode!, assignment: choice.assignment, language: "en", thinker: { transport: vi.fn() },
      });
      await o.start();
      const header = (await o.logRecords()).find((r) => r.kind === "session_started")!.detail as LogHeader;
      expect(header).toMatchObject({ participantCode: intent.code, cell: "reasoning_intent", assignment: { source: "table", tableSha256: ALLOCATION_TABLE.rowsSha256, block: intent.block, assignmentSource: source, stratum: own } });
    }
  });
});
