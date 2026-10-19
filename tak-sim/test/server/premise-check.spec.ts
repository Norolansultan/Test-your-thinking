/**
 * SPEC/30 §3 (19 Oct 2026): the guide's rule-based premise check — the premise-evidence table (DRAFT, panel to confirm), its startup
 * check, the pure look-up by view and records clock, and the fixed-template lines. Fidelity (§3.6): a flag in every no-fit view
 * (V9, V10, V14) once its deciding record is in, none before it, none in V8 and the fit views V11–V13; a record is never cited
 * before the time gate has released it.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { reachableAtoms, stepAtVirtualTime } from "../../app/retrieval/time-gate.js";
import { recordAtomId } from "../../app/scenario/demo-directive.js";
import { STEP_SECONDS } from "../../app/scenario/views.js";
import { STRATEGY_FROM_VIEW } from "../../app/session/thinker-protocol.js";
import { normaliseNewlines, repoPath, sha256Hex } from "../../server/thinker/config.js";
import { loadDirectivePremises, premisesBlock } from "../../server/thinker/directive-premises.js";
import { receivedUpToOf } from "../../server/thinker/model.js";
import {
  checkPremiseEvidence, loadPremiseEvidence, parsePremiseEvidence, PREMISE_EVIDENCE_FILE, PREMISE_EVIDENCE_VIEWS, premiseBlockStatuses, premiseCheck, premiseCheckShown, premiseLines,
  recordLookupOf,
} from "../../server/thinker/premise-check.js";
import { scenario } from "../engine/thinker-fixtures.js";

const table = loadPremiseEvidence();
const premises = loadDirectivePremises();
const lookup = recordLookupOf(scenario.atoms);
const rawText = readFileSync(repoPath(PREMISE_EVIDENCE_FILE), "utf8");
const raw = () => JSON.parse(rawText) as { views: Record<string, Record<string, Record<string, unknown>>> } & Record<string, unknown>;
const atomOf = (id: string) => scenario.atoms.find((a) => a.id === id)!;

/** The records clock the proxy computes at a step of a view: the latest observation among the time-gated records. */
function clockAtStep(step: number): number {
  return receivedUpToOf(reachableAtoms(scenario.atoms, step), (step - 1) * STEP_SECONDS);
}

/** Every clock a request in `view` can carry: the view's start and, in a merged view, its second step's start. */
function stepsOf(view: number): number[] {
  const spec = scenario.cycles.find((c) => c.index === view)!;
  return Array.from({ length: spec.steps }, (_, k) => stepAtVirtualTime(spec, spec.startsAtVirtual + k * STEP_SECONDS)!);
}

const contradictedIds = (view: number, clock: number) => premiseCheck(table, view, clock)!.filter((i) => i.status === "contradicted").map((i) => i.id);

/** The deciding records, found by content (as the directive keys do): a regenerated corpus that moves an id fails here. */
const DECIDING = {
  spot1701: recordAtomId(12, /^Avotulta ja savua syttymäkohdan kaakkoispuolella, vanhan eteläreunan ulkopuolella/),
  dr21725: recordAtomId(13, /^DR2 lämpökuva, eteläreuna \(L3\) klo 17\.25: erillinen palo/),
  dr31735: recordAtomId(13, /^DR3 kehäkartoitus valmis klo 17\.35:.*Erillinen uusi palo/),
  spot1923: recordAtomId(19, /^Uutta savua ja liekkejä syttymäkohdan länsipuolella, vanhan länsireunan ulkopuolella/),
  ek16crossing: recordAtomId(19, /^Palon kärki ylitti metsäautotien \(Honkaharju\) klo 19\.00–19\.20/),
};

describe("the premise-evidence table (DRAFT study content)", () => {
  it("covers V8–V14 for P1 and P2, is marked DRAFT, and was written for the authored premises in force", () => {
    expect(PREMISE_EVIDENCE_VIEWS[0]).toBe(STRATEGY_FROM_VIEW);
    expect(Object.keys(table.views).map(Number)).toEqual([8, 9, 10, 11, 12, 13, 14]);
    for (const view of PREMISE_EVIDENCE_VIEWS) expect(Object.keys(table.views[view]!)).toEqual(["P1", "P2"]);
    expect(table.draft).toBe(true);
    expect(raw()["status"]).toMatch(/^DRAFT/);
    expect(table.directivePremisesSha256).toBe(premises.sha256);
    for (const view of PREMISE_EVIDENCE_VIEWS) for (const e of Object.values(table.views[view]!)) expect(e.note.length).toBeGreaterThan(10);
  });

  it("is frozen: the manifest holds its hash, and the startup check passes against it", () => {
    const manifest = JSON.parse(readFileSync(repoPath("content/thinker/manifest.json"), "utf8")) as { premiseEvidence: { sha256: string; version: number; directivePremisesSha256: string; status: string } };
    expect(manifest.premiseEvidence).toMatchObject({ sha256: table.sha256, version: table.version, directivePremisesSha256: premises.sha256 });
    expect(manifest.premiseEvidence.status).toMatch(/DRAFT/);
    expect(table.sha256).toBe(sha256Hex(normaliseNewlines(rawText)));
    expect(() => checkPremiseEvidence(table, manifest.premiseEvidence.sha256, premises, scenario.atoms)).not.toThrow();
  });

  it("the startup check refuses a table that is not the manifest's, not written for these premises, or cites a record the scenario lacks or has not yet received", () => {
    expect(() => checkPremiseEvidence(table, "0".repeat(64), premises, scenario.atoms)).toThrow(/differs from the manifest/);
    expect(() => checkPremiseEvidence(table, table.sha256, { ...premises, sha256: "f".repeat(64) }, scenario.atoms)).toThrow(/written for directive premises/);
    expect(() => checkPremiseEvidence(table, table.sha256, premises, scenario.atoms.filter((a) => a.id !== DECIDING.ek16crossing))).toThrow(/no record atom\.radio\.19\.2/);
    const early = raw();
    early.views["V14"]!["P2"]!["fromVirtualS"] = atomOf(DECIDING.ek16crossing).provenance.observedAt - 1;
    const parsed = parsePremiseEvidence(JSON.stringify(early));
    expect(() => checkPremiseEvidence(parsed, parsed.sha256, premises, scenario.atoms)).toThrow(/before atom\.radio\.19\.2 is received/);
  });

  it.each([
    ["a missing view", (j: ReturnType<typeof raw>) => { delete j.views["V12"]; }],
    ["a third premise", (j: ReturnType<typeof raw>) => { j.views["V8"]!["P3"] = { status: "not_contradicted", note: "x" }; }],
    ["an unknown status", (j: ReturnType<typeof raw>) => { j.views["V8"]!["P1"]!["status"] = "supported"; }],
    ["a contradiction without its records", (j: ReturnType<typeof raw>) => { delete j.views["V9"]!["P1"]!["atomIds"]; }],
    ["a contradiction without its time", (j: ReturnType<typeof raw>) => { delete j.views["V9"]!["P1"]!["fromVirtualS"]; }],
    ["a premise not contradicted that cites records", (j: ReturnType<typeof raw>) => { j.views["V8"]!["P1"]!["atomIds"] = ["atom.demo.12.0"]; }],
    ["an entry without a note", (j: ReturnType<typeof raw>) => { delete j.views["V11"]!["P2"]!["note"]; }],
    ["no draft marker", (j: ReturnType<typeof raw>) => { delete j["draft"]; }],
  ])("parsing rejects %s", (_label, mutate) => {
    const j = raw();
    mutate(j);
    expect(() => parsePremiseEvidence(JSON.stringify(j))).toThrow(/premise-evidence\.json/);
  });

  it("names the deciding records SPEC/30 §3 gives (found by content), each no earlier than its observation", () => {
    expect(table.views[9]!["P1"]).toMatchObject({ status: "contradicted", atomIds: [DECIDING.spot1701] });
    expect(table.views[10]!["P1"]).toMatchObject({ status: "contradicted", atomIds: [DECIDING.spot1701, DECIDING.dr21725, DECIDING.dr31735] });
    expect(table.views[14]!["P1"]).toMatchObject({ status: "contradicted", atomIds: [DECIDING.spot1923] });
    expect(table.views[14]!["P2"]).toMatchObject({ status: "contradicted", atomIds: [DECIDING.ek16crossing] });
    const notContradicted: [number, string][] = [[9, "P2"], [10, "P2"], ...[8, 11, 12, 13].flatMap((v): [number, string][] => [[v, "P1"], [v, "P2"]])];
    for (const [view, id] of notContradicted) {
      expect(table.views[view]![id], `V${view} ${id}`).toEqual(expect.objectContaining({ status: "not_contradicted", atomIds: [], fromVirtualS: null }));
    }
    for (const view of PREMISE_EVIDENCE_VIEWS) {
      for (const e of Object.values(table.views[view]!)) {
        if (e.status !== "contradicted") continue;
        // The contradiction holds once every deciding record is in: fromVirtualS is the latest of their observations.
        expect(e.fromVirtualS).toBe(Math.max(...e.atomIds.map((id) => atomOf(id).provenance.observedAt)));
      }
    }
  });
});

describe("premiseCheck: a pure look-up by view and records clock", () => {
  it("flags P1 in V9 and V10 and P1 and P2 in V14 at every clock a request there can carry; nothing in V8, V11, V12 or V13", () => {
    const expected: Readonly<Record<number, readonly string[]>> = { 8: [], 9: ["P1"], 10: ["P1"], 11: [], 12: [], 13: [], 14: ["P1", "P2"] };
    for (const view of PREMISE_EVIDENCE_VIEWS) {
      for (const step of stepsOf(view)) expect(contradictedIds(view, clockAtStep(step)), `V${view} step ${step}`).toEqual(expected[view]);
    }
  });

  it("never cites a record before the time gate has released it", () => {
    for (const view of PREMISE_EVIDENCE_VIEWS) {
      for (const step of stepsOf(view)) {
        const gated = new Set(reachableAtoms(scenario.atoms, step).map((a) => a.id));
        for (const item of premiseCheck(table, view, clockAtStep(step))!) for (const id of item.atomIds) expect(gated.has(id), `V${view} step ${step} ${id}`).toBe(true);
      }
    }
  });

  it("is not contradicted before the deciding record's time, and is from that time on", () => {
    for (const [view, id, atomId] of [[9, "P1", DECIDING.spot1701], [10, "P1", DECIDING.dr31735], [14, "P1", DECIDING.spot1923], [14, "P2", DECIDING.ek16crossing]] as const) {
      const at = atomOf(atomId).provenance.observedAt;
      const before = premiseCheck(table, view, at - 1)!.find((i) => i.id === id)!;
      expect(before, `V${view} ${id} before`).toEqual({ id, status: "not_contradicted", atomIds: [], fromVirtualS: null });
      const from = premiseCheck(table, view, at)!.find((i) => i.id === id)!;
      expect(from, `V${view} ${id} from`).toMatchObject({ id, status: "contradicted", fromVirtualS: at });
    }
    // The clock of the step before a no-fit view's first step is too early for its flag (the time gate and the table agree).
    expect(contradictedIds(9, clockAtStep(11))).toEqual([]);
    expect(contradictedIds(14, clockAtStep(18))).toEqual([]);
  });

  it("has no answer for a view the table does not cover (phase A, the practice view)", () => {
    for (const view of [0, 1, 7]) expect(premiseCheck(table, view, 99_999)).toBeNull();
  });
});

describe("the fixed template (never model text)", () => {
  const at = (view: number) => premiseCheck(table, view, clockAtStep(stepsOf(view).at(-1)!))!;

  it("English: one line per contradicted premise with its source and time; the line when nothing is contradicted", () => {
    expect(premiseLines(at(14), premises, lookup, "en")).toEqual([
      "P1 The region's fire situation is as the directive describes — no longer holds: SPOT 19.23.",
      "P2 Roads or water ahead of each fire still give a line that can be held — no longer holds: EK16 19.22.",
    ]);
    expect(premiseLines(at(10), premises, lookup, "en")).toEqual(["P1 The region's fire situation is as the directive describes — no longer holds: SPOT 17.01, DR2 17.25, DR3 17.35."]);
    expect(premiseLines(at(9), premises, lookup, "en")).toEqual(["P1 The region's fire situation is as the directive describes — no longer holds: SPOT 17.01."]);
    for (const view of [8, 11, 12, 13]) expect(premiseLines(at(view), premises, lookup, "en")).toEqual(["Directive premises: no newest record contradicts P1 or P2."]);
  });

  it("Finnish (DRAFT for the native check): the authored Finnish text and 'klo' before the time", () => {
    expect(premiseLines(at(14), premises, lookup, "fi")).toEqual([
      "P1 Alueen palotilanne on sellainen kuin linjaus kuvaa — ei enää päde: SPOT klo 19.23.",
      "P2 Jokaisen palon edessä on yhä tie tai vesistö, jonka varaan linja voidaan pitää — ei enää päde: EK16 klo 19.22.",
    ]);
    expect(premiseLines(at(11), premises, lookup, "fi")).toEqual(["Linjauksen lähtöoletukset: mikään uusin tieto ei kumoa oletuksia P1 ja P2."]);
  });

  it("the shown check carries the table version, the statuses, the deciding atom ids and the flag", () => {
    expect(premiseCheckShown(table, at(14), premises, lookup, "en")).toEqual({
      tableVersion: table.version,
      items: [{ id: "P1", status: "contradicted", atomIds: [DECIDING.spot1923] }, { id: "P2", status: "contradicted", atomIds: [DECIDING.ek16crossing] }],
      lines: premiseLines(at(14), premises, lookup, "en"),
      flagShown: true,
    });
    expect(premiseCheckShown(table, at(12), premises, lookup, "en")).toMatchObject({ flagShown: false, items: [{ id: "P1", status: "not_contradicted", atomIds: [] }, { id: "P2", status: "not_contradicted", atomIds: [] }] });
  });

  it("the block after the directive states the check to the model, records cited as in the template", () => {
    const en = premisesBlock(premises, "en", premiseBlockStatuses(at(14), lookup, "en"));
    expect(en).toContain("P1: The region's fire situation is as the directive describes. — contradicted by the newest records: SPOT 19.23");
    expect(en).toContain("P2: Roads or water ahead of each fire still give a line that can be held. — contradicted by the newest records: EK16 19.22");
    expect(en).toMatch(/do not rate, restate, add or reword premises/);
    const fi = premisesBlock(premises, "fi", premiseBlockStatuses(at(11), lookup, "fi"));
    expect(fi).toContain("P1: Alueen palotilanne on sellainen kuin linjaus kuvaa. — uusimmat tiedot eivät kumoa");
    expect(fi).not.toMatch(/kumoavat:/);
  });
});
