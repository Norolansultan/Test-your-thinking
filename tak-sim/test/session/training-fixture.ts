/**
 * A synthetic training incident for the session's tests (SPEC/08 (bp) §bp.4's shape, not its content): 13 items across S1–S4 in every
 * mode — S1 and S2 on the live map (choice and point), S3 question cards, S4 freeze items with the memory item first — 4 + 2 + 3 + 4
 * as the real training, the covariate items where the real ones are. The scenes reuse the main scenario's practice view as rendered.
 * Its corpus is three of the scenario's atoms renamed `trn.r..` at the training's step; its texts are placeholders with the shapes
 * the screen reads. The tests iterate the items generically, so they run against A's real data the same way (`training-real.spec.ts`).
 */

import { toRenderable, toRenderableCycle } from "../../app/boundary/render-boundary.js";
import type { CycleIndex, LatLon } from "../../app/engine/primitives.js";
import type { TrainingTexts } from "../../app/i18n/training-texts-types.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import type { InfoAtom } from "../../app/scenario/types.js";
import { recordText } from "../../app/session/template-answer.js";
import type { RadioLogEntry } from "../../app/session/snapshot.js";
import type { TrainingItem, TrainingSectionId, TrainingSpec } from "../../app/session/training/spec.js";

const scenario = buildDemoScenario();
const scene = toRenderableCycle(scenario.practice.cycle);

/** The square (about the real one: the basemap's north-east 2.5 km). */
export const AREA = { south: 60.9156, west: 27.489, north: 60.938, east: 27.5351 } as const;
export const CENTRE: LatLon = { lat: (AREA.south + AREA.north) / 2, lon: (AREA.west + AREA.east) / 2 };
const at = (dLat: number, dLon: number): LatLon => ({ lat: CENTRE.lat + dLat, lon: CENTRE.lon + dLon });

const OPTIONS = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }] as const;

function item(id: string, section: TrainingSectionId, position: number, mode: TrainingItem["mode"], answer: TrainingItem["answer"], extra: Partial<TrainingItem> = {}): TrainingItem {
  const key = answer === "point" ? { point: at(0.0005 * position, -0.0005 * position) } : { optionId: OPTIONS[position % 4]!.id };
  return {
    id: `training.${id}`, section, position, mode, answer, scene: section === "s1" ? "s1" : "incident", source: section === "s1" ? null : "log", covariate: null,
    marks: [{ id: "A", label: "A", kind: "point", at: at(0.001, 0.001) }], options: answer === "choice" ? OPTIONS : [], key,
    feedback: { numbers: { m: 300 }, ...(answer === "point" ? { ring: [at(0.001, 0), at(0, 0.001), at(-0.001, 0)] } : { line: [at(0, 0), at(0.002, 0.002)] }) },
    ...extra,
  };
}

const ITEMS: readonly TrainingItem[] = [
  item("s1.place", "s1", 1, "live", "point", { covariate: "point_visible" }),
  item("s1.measure", "s1", 2, "live", "choice"),
  item("s1.slope", "s1", 3, "live", "choice", { optional: true }),
  item("s1.water", "s1", 4, "live", "choice", { marks: [{ id: "star", label: "★", kind: "star", at: at(0, 0) }, { id: "f1", label: "1", kind: "water", at: at(0.003, 0) }] }),
  item("s2.now", "s2", 5, "live", "choice"),
  item("s2.project", "s2", 6, "live", "point", { source: "reasoning" }),
  item("s3.records1", "s3", 7, "card", "choice", { source: "records", covariate: "seek_first", lesson: { questionId: "q.dr8", recordIds: ["trn.r01"] } }),
  item("s3.older", "s3", 8, "card", "choice"),
  item("s3.records2", "s3", 9, "card", "choice", { source: "records" }),
  item("s4.memory", "s4", 10, "freeze", "point", { scene: "s1", source: "map", covariate: "point_memory", marks: [{ id: "unit", label: "EK53", kind: "unit", at: at(-0.004, 0.004) }], memory: { unit: "EK53", at: at(-0.004, 0.004), exposureMs: 8_000 } }),
  item("s4.log", "s4", 11, "freeze", "choice"),
  item("s4.map", "s4", 12, "freeze", "choice", { source: "map" }),
  item("s4.records", "s4", 13, "freeze", "choice", { source: "records" }),
];

const SECTIONS: TrainingSpec["sections"] = (["s1", "s2", "s3", "s4", "s5"] as const).map((id) => ({ id, itemIds: ITEMS.filter((it) => it.section === id).map((it) => it.id) }));

export const TRAINING_FIXTURE: TrainingSpec = {
  version: "training-fixture",
  capMs: 720_000, cardWindowMs: 60_000, demoMinDwellMs: 10_000,
  now: { virtualTimeS: -10_920, label: "10.18" },
  area: { bounds: AREA, lockMarginM: 100, centre: CENTRE },
  roadLabels: [{ road: "R5", at: at(0.005, 0) }, { road: "R6", at: at(-0.005, 0) }],
  scenes: { s1: { ...scene, unitPositions: {}, unitWork: {}, aircraft: [], sensorFootprints: [], clockLabel: "10.00" }, incident: { ...scene, clockLabel: "10.00" } },
  items: ITEMS,
  sections: SECTIONS,
};

/** Three of the scenario's atoms as the training's records (`trn.r01`–`r03`, step −9). */
export const TRAINING_ATOMS_FIXTURE: readonly InfoAtom[] = scenario.atoms.filter((a) => a.pointer === undefined).slice(0, 3)
  .map((a, i) => ({ ...a, id: `trn.r0${i + 1}`, cycle: -9 as unknown as CycleIndex }));

const LOG: readonly RadioLogEntry[] = TRAINING_ATOMS_FIXTURE.map((a, i) => ({ id: a.id, clockLabel: ["09.58", "10.12", "10.14"][i]!, from: a.provenance.sourceId, text: recordText(toRenderable(a).record) }));

/** The log rows to a clock (`trainingLogRows`). */
export function trainingLogRowsFixture(untilHhmm: string): RadioLogEntry[] {
  return LOG.filter((r) => r.clockLabel <= untilHhmm);
}

function texts(lang: "fi" | "en"): TrainingTexts {
  return {
    intro: { title: lang === "fi" ? "Harjoitus" : "Training", body: ["intro"], start: "start" },
    section: (id) => ({ title: `section ${id}`, body: [`body ${id}`], go: "go" }),
    item: (id) => ({ stem: `stem ${id} (${lang})`, options: { a: "A", b: "B", c: "C", d: "D" } }),
    feedback: (id, ctx) => [`feedback ${id}: ${ctx.errorM ?? ""}${ctx.timedOut ? " timed out" : ""}`],
    demo: (cell) => ({ title: cell === "radio" ? "Haku" : "Thinker", intro: "recorded", examples: [{ id: "ex1", question: "q1", answer: ["a1"], note: "n1" }, { id: "ex2", question: "q2", answer: ["a2"], note: "n2" }] }),
    demoLines: { limitation: "limitation", leave: "done" },
    ui: {},
  };
}

export const TRAINING_TEXT_FIXTURE = { fi: texts("fi"), en: texts("en") } as const;
