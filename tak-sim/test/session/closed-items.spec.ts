/**
 * Revision (ai), 9 Oct 2026 (researcher: no open-ended questions in the session; three professor
 * reviews): the closed items. No free-text participant input is left except the Search/Thinker
 * question box; the questionnaire's multi-select kind (exclusive option, cell filter, seeded order with
 * fixed-last options, logged); the conditional `disagreement.action`; `last.basis.main` over the
 * ticked options; `felt.wrong` without a content list; `directive.fit`; the participant option order;
 * V13's area item and its scoring; the departure reason never reaching the Thinker.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STUDY_TEXT } from "../../app/i18n/study-texts.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { AREA_FIXED_LAST, AREA_OPTIONS, CONTRADICTION_AREA_KEY } from "../../app/scenario/demo-probes.js";
import { probeKeysOf } from "../../app/scenario/probe-keys.js";
import { participantOptionOrder, type OptionOrderSeed } from "../../app/session/option-order.js";
import {
  checkQuestionnaireAnswers, itemShown, multiOptionOrders, POST_ITEMS, questionnaireItems, THINKER_CELLS, type QuestionnaireItem,
} from "../../app/session/questionnaire.js";
import { uncertaintyMeasures } from "../../app/telemetry/probe-measures.js";
import type { LogRecord } from "../../app/telemetry/log.js";

const scenario = buildDemoScenario();
const seed = (participantCode: string): OptionOrderSeed => ({ scenarioSeed: scenario.seed, scenarioId: scenario.id, participantCode });
const item = (items: readonly QuestionnaireItem[], id: string) => items.find((i) => i.id === id)!;
const optionIds = (i: QuestionnaireItem) => (i.kind === "multi" ? i.options.map((o) => o.id) : []);

describe("no free-text participant input is left, except the Search/Thinker question box", () => {
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p.replace(/\\/g, "/")); } };
  walk("app");

  it("no textarea anywhere; text inputs only in Haku's search drawer and the question box (RightPanel)", () => {
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/<textarea/);
    const withTextInput = files.filter((f) => /<input(?![^>]*type="(checkbox|number|radio|range)")/.test(readFileSync(f, "utf8")));
    expect(withTextInput.sort()).toEqual(["app/render/ui/components/Drawers.tsx", "app/render/ui/components/RightPanel.tsx"]);
  });

  it("no questionnaire item or probe takes text", () => {
    for (const i of POST_ITEMS) expect(["choice", "scale", "number", "multi", "pick_from", "retention"], i.id).toContain(i.kind);
    for (const p of scenario.probeSchedule.probes) expect(p.response.kind, p.id).not.toBe("free_text");
  });
});

describe("the multi-select kind (questionnaire.ts)", () => {
  const radio = questionnaireItems("post", "radio", seed("P-1"));
  const thinker = questionnaireItems("post", "reasoning_once", seed("P-1"));

  it("filters options by cell: Thinker options only in the Thinker cells; the only difference between cells is that filter", () => {
    expect(optionIds(item(radio, "last.basis"))).not.toContain("thinker");
    expect(optionIds(item(thinker, "last.basis"))).toContain("thinker");
    expect(optionIds(item(radio, "disagreement.action"))).not.toContain("asked_thinker");
    expect(optionIds(item(thinker, "disagreement.action"))).toContain("asked_thinker");
    for (const cell of THINKER_CELLS) expect(optionIds(item(questionnaireItems("post", cell), "last.basis"))).toContain("thinker");
    // The same items and options apart from the Thinker filter.
    const strip = (items: readonly QuestionnaireItem[]) => items.filter((i) => !i.cells).map((i) => ({ id: i.id, kind: i.kind, options: [...optionIds(i)].filter((o) => o !== "thinker" && o !== "asked_thinker").sort() }));
    expect(strip(radio)).toEqual(strip(thinker));
  });

  it("offers the decided options: no 'none' in last.basis, the directive always, 'nothing' exclusive in disagreement.action, no 'did not disagree'", () => {
    expect([...optionIds(item(thinker, "last.basis"))].sort()).toEqual(["directive", "drone_sensor", "experience", "other", "projection", "search", "situation_log", "thinker", "unit_reports"]);
    expect([...optionIds(item(thinker, "disagreement.action"))].sort()).toEqual(["asked_search", "asked_thinker", "checked_reports", "nothing", "placed_on_own_estimate", "safety_margin", "went_with_projection"]);
    expect(item(thinker, "disagreement.action")).toMatchObject({ exclusive: "nothing" });
  });

  it("the order is seeded once from the scenario (the same for every participant), deterministic, and keeps the fixed-last options last", () => {
    const a1 = optionIds(item(questionnaireItems("post", "radio", seed("P-1")), "last.basis"));
    const a2 = optionIds(item(questionnaireItems("post", "radio", seed("P-1")), "last.basis"));
    expect(a2).toEqual(a1);
    const orders = new Set(["P-1", "P-2", "P-3", "P-4", "P-5", "P-6"].map((c) => optionIds(item(questionnaireItems("post", "radio", seed(c)), "last.basis")).join(",")));
    expect(orders.size).toBe(1); // identical stimulus: one order for everyone
    for (const c of ["P-1", "P-2", "P-3", "P-4", "P-5", "P-6"]) {
      expect(optionIds(item(questionnaireItems("post", "radio", seed(c)), "last.basis")).at(-1)).toBe("other");
      expect(optionIds(item(questionnaireItems("post", "reasoning_intent", seed(c)), "disagreement.action")).at(-1)).toBe("nothing");
    }
    expect(multiOptionOrders(radio)).toEqual([{ itemId: "last.basis", optionIds: optionIds(item(radio, "last.basis")) }, { itemId: "disagreement.action", optionIds: optionIds(item(radio, "disagreement.action")) }]);
  });

  it("validates: known options, no repeats, the exclusive option alone; logs the ticked ids in the order shown with that order; empty is null", () => {
    const order = optionIds(item(thinker, "last.basis"));
    expect(() => checkQuestionnaireAnswers(thinker, { "last.basis": ["projection", "nonsense"] })).toThrow(/not an option/);
    expect(() => checkQuestionnaireAnswers(radio, { "last.basis": ["thinker"] })).toThrow(/not an option/); // filtered out in this cell
    expect(() => checkQuestionnaireAnswers(thinker, { "last.basis": ["projection", "projection"] })).toThrow(/twice/);
    expect(() => checkQuestionnaireAnswers(thinker, { "last.basis": "projection" })).toThrow(/list/);
    const action = { "disagreement.recall": "yes" };
    expect(() => checkQuestionnaireAnswers(thinker, { ...action, "disagreement.action": ["nothing", "asked_search"] })).toThrow(/only answer/);
    expect(checkQuestionnaireAnswers(thinker, { ...action, "disagreement.action": ["nothing"] }).find((a) => a.itemId === "disagreement.action")!.value).toEqual(["nothing"]);
    const answers = checkQuestionnaireAnswers(thinker, { "last.basis": ["experience", "projection"] });
    expect(answers.find((a) => a.itemId === "last.basis")).toEqual({ itemId: "last.basis", value: order.filter((id) => id === "experience" || id === "projection"), optionOrder: order });
    expect(checkQuestionnaireAnswers(thinker, { "last.basis": [] }).find((a) => a.itemId === "last.basis")).toEqual({ itemId: "last.basis", value: null, optionOrder: order });
  });

  it("last.basis.main: shown only with two or more ticked, one of the ticked", () => {
    const main = item(thinker, "last.basis.main");
    expect(itemShown(main, {})).toBe(false);
    expect(itemShown(main, { "last.basis": ["projection"] })).toBe(false);
    expect(itemShown(main, { "last.basis": ["projection", "search"] })).toBe(true);
    expect(() => checkQuestionnaireAnswers(thinker, { "last.basis": ["projection", "search"], "last.basis.main": "experience" })).toThrow(/not ticked/);
    expect(() => checkQuestionnaireAnswers(thinker, { "last.basis": ["projection"], "last.basis.main": "projection" })).toThrow(/not shown/);
    const ok = checkQuestionnaireAnswers(thinker, { "last.basis": ["projection", "search"], "last.basis.main": "search" });
    expect(ok.find((a) => a.itemId === "last.basis.main")!.value).toBe("search");
    expect(checkQuestionnaireAnswers(thinker, { "last.basis": ["projection"] }).find((a) => a.itemId === "last.basis.main")).toEqual({ itemId: "last.basis.main", value: null, notShown: true });
  });

  it("disagreement.action is shown only after 'yes' to disagreement.recall; an answer to it otherwise is refused", () => {
    const action = item(thinker, "disagreement.action");
    for (const recall of [undefined, "no", "unsure"]) {
      expect(itemShown(action, recall ? { "disagreement.recall": recall } : {})).toBe(false);
      expect(() => checkQuestionnaireAnswers(thinker, { ...(recall ? { "disagreement.recall": recall } : {}), "disagreement.action": ["asked_search"] })).toThrow(/not shown/);
    }
    expect(itemShown(action, { "disagreement.recall": "yes" })).toBe(true);
    const ans = checkQuestionnaireAnswers(thinker, { "disagreement.recall": "yes", "disagreement.action": ["safety_margin", "checked_reports"] });
    expect(ans.find((a) => a.itemId === "disagreement.action")).toMatchObject({ value: optionIds(action).filter((id) => id === "safety_margin" || id === "checked_reports") });
  });

  it("felt.wrong is yes/no/unsure with no content list; directive.fit after the retention items, in every cell", () => {
    expect(item(radio, "felt.wrong")).toMatchObject({ kind: "choice", options: ["yes", "no", "unsure"] });
    for (const lang of ["fi", "en"] as const) expect(Object.keys(STUDY_TEXT[lang].questionnaire.items["felt.wrong"]!.options!).sort()).toEqual(["no", "unsure", "yes"]);
    for (const items of [radio, thinker]) {
      const ids = items.map((i) => i.id);
      expect(item(items, "directive.fit")).toMatchObject({ kind: "choice", options: ["fitted", "not_at_times", "not_mostly", "dont_know"] });
      expect(ids.indexOf("directive.fit")).toBeGreaterThan(ids.indexOf("retention.hinge"));
      if (ids.includes("ai.directive_relation")) expect(ids.indexOf("directive.fit")).toBeGreaterThan(ids.indexOf("ai.directive_relation"));
      expect(ids.indexOf("directive.fit")).toBeLessThan(ids.indexOf("tlx.mental"));
    }
    expect(STUDY_TEXT.fi.questionnaire.items["directive.fit"]!.prompt).toBe("Sopiko päivystävän palopäällikön linjaus tilanteeseen sen kehittyessä?");
    expect(STUDY_TEXT.en.questionnaire.items["directive.fit"]!.prompt).toBe("Did the duty fire chief's directive fit the situation as it developed?");
  });

  it("every multi option has a label in both languages", () => {
    for (const lang of ["fi", "en"] as const) {
      for (const i of POST_ITEMS) if (i.kind === "multi") for (const o of i.options) expect(STUDY_TEXT[lang].questionnaire.items[i.id]!.options?.[o.id], `${lang} ${i.id}.${o.id}`).toBeTruthy();
    }
  });
});

describe("participantOptionOrder (option-order.ts)", () => {
  it("is a permutation, deterministic in (scenario seed, item), the same for every participant, fixed-last kept last", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "other"];
    const o = participantOptionOrder(ids, ["other"], seed("P-7"), "x");
    expect([...o].sort()).toEqual([...ids].sort());
    expect(o.at(-1)).toBe("other");
    expect(participantOptionOrder(ids, ["other"], seed("P-7"), "x")).toEqual(o);
    // Identical stimulus (researcher's rule): every participant sees the same order.
    const many = new Set(Array.from({ length: 12 }, (_, i) => participantOptionOrder(ids, ["other"], seed(`P-${i}`), "x").join()));
    expect(many.size).toBe(1);
    expect(participantOptionOrder(ids, ["missing"], seed("P-7"), "x")).toHaveLength(ids.length);
  });
});

describe("V13's area item (demo-probes.ts) and its scoring", () => {
  const probe = scenario.probeSchedule.probes.find((p) => p.id === scenario.contradiction.detectionProbeId)!;

  it("two parts, non-leading: no option names a report, a record, a conflict or a contradiction; 'other' last", () => {
    expect(probe.response).toMatchObject({ kind: "area_check", fixedLastIds: ["other"] });
    expect(probe.collectsConfidence).toBe(false);
    expect(AREA_OPTIONS.map((o) => o.id)).toEqual(["north_edge", "east_old_head", "southeast_front", "west_bog", "units", "weather", "projection", "other"]);
    expect(AREA_FIXED_LAST).toEqual(["other"]);
    for (const o of AREA_OPTIONS) expect(o.fi).not.toMatch(/raport|ilmoitu|tallenn|ristiri|epäjohdonmuk|eriäv|SPOT|EK14/i);
  });

  it("the key is the north edge, where the contradiction lies (SPOT's north-edge flare-up against EK14's 'our line holds')", () => {
    expect(CONTRADICTION_AREA_KEY).toBe("north_edge");
    expect(scenario.invariants.find((i) => i.name === "contradiction.area_hit")!.expected).toBe("north_edge");
    expect(scenario.invariants.some((i) => i.name === "contradiction.detected")).toBe(false);
    const premise = scenario.atoms.find((a) => a.id === scenario.contradiction.premiseAtomId)!.record as { text: string; authorUnitId: string };
    expect(premise).toMatchObject({ authorUnitId: "SPOT" });
    expect(premise.text).toMatch(/^Pohjoisreuna/);
    expect(probeKeysOf(scenario).contradictionArea).toEqual({ probeId: probe.id, key: "north_edge" });
  });

  it("scores the area hit from the raw records: 'north edge' among the parts hits; other parts or 'no' miss; unanswered is null", () => {
    const keys = probeKeysOf(scenario);
    const order = ["weather", "north_edge", "units", "other"];
    const recs = (response: unknown): LogRecord[] => [
      { seq: 1, kind: "probe_presented", tWallOffsetMs: 1000, tVirtual: 0, detail: { probeId: probe.id, type: "U", mode: "PROBING_VISIBLE", optionIds: order, cycle: 13, atViewSeconds: 100, decisionStep: null } },
      ...(response === undefined ? [] : [{ seq: 2, kind: "probe_submitted", tWallOffsetMs: 4000, tVirtual: 0, detail: { probeId: probe.id, response } }]),
    ] as unknown as LogRecord[];
    const area = (response: unknown) => uncertaintyMeasures(recs(response), keys).area;
    expect(area({ unsure: true, areas: ["weather", "north_edge"], optionOrder: order })).toMatchObject({ unsure: true, areaHit: true, keyPosition: 1, openMs: 3000 });
    expect(area({ unsure: true, areas: ["weather"], optionOrder: order })).toMatchObject({ areaHit: false });
    expect(area({ unsure: false, areas: [], optionOrder: order })).toMatchObject({ unsure: false, areaHit: false });
    expect(area(undefined)).toMatchObject({ unsure: null, areas: null, areaHit: null, openMs: null });
  });
});

describe("the departure reason never reaches the Thinker", () => {
  it("the Thinker request carries no plan, and the plan context is derived on the server from the view alone", () => {
    const protocol = readFileSync("app/session/thinker-protocol.ts", "utf8");
    const request = protocol.slice(protocol.indexOf("export interface ThinkerRequest"), protocol.indexOf("export interface OpenThinkerTurnWire"));
    expect(request).not.toMatch(/plan|departure/i);
    const model = readFileSync("server/thinker/model.ts", "utf8");
    const ctx = model.slice(model.indexOf("export function openPlanContext"), model.indexOf("export interface ModelUsage"));
    expect(ctx).not.toMatch(/departure|SectorPlan|allocation_submitted/);
    for (const f of ["app/session/thinker-transport.ts", "app/session/queries.ts", "server/thinker/handler.ts"]) expect(readFileSync(f, "utf8"), f).not.toMatch(/departureReason/);
  });
});
