/**
 * A fixture of the training incident for the play harness's tests (revision (bp), 26 Oct 2026): work package A's content
 * (`TRAINING`, `TRAINING_TEXT`) is a placeholder in this tree, so the tests give the harness a small spec of their own — the square of
 * `08` (bp) §bp.1 (basemap pixels 4 375–5 000 × 0–625, in WGS84 by the harness's own inverse of `basemapPx`), five items of the four
 * kinds (a live point and a live choice, an S3 question card, the S4 memory item and an S4 freeze choice) — and texts tagged with their
 * language, so a page can be checked to print its own language only. A fake orchestrator (`TrainingHost`) records the calls.
 */

import type { Lang } from "../../app/i18n/lang.js";
import type { SessionSnapshot } from "../../app/session/snapshot.js";
import type { TrainingHost, TrainingView } from "../../app/session/training/host.js";
import type { TrainingItem, TrainingSpec } from "../../app/session/training/spec.js";
import type { TrainingTexts } from "../../app/i18n/training-texts-types.js";
import type { LogRecord } from "../../app/telemetry/log.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { latLonAtBasemapPx } from "../../tools/play/freeze-grid.js";

const extent = buildDemoScenario().extent;
const nw = latLonAtBasemapPx({ x: 4375, y: 0 }, extent);
const se = latLonAtBasemapPx({ x: 5000, y: 625 }, extent);
const centre = { lat: (nw.lat + se.lat) / 2, lon: (nw.lon + se.lon) / 2 };

const item = (id: string, section: TrainingItem["section"], position: number, mode: TrainingItem["mode"], answer: TrainingItem["answer"], extra: Partial<TrainingItem> = {}): TrainingItem => ({
  id, section, position, mode, answer, scene: section === "s1" ? "s1" : "incident", source: section === "s1" ? null : "records", covariate: null, marks: [],
  options: answer === "choice" ? [{ id: `${id}.o1` }, { id: `${id}.o2` }, { id: `${id}.o3` }] : [], key: answer === "choice" ? { optionId: `${id}.o2` } : { point: centre },
  feedback: { numbers: { m: 42 } }, ...extra,
});

export const FIXTURE_ITEMS: readonly TrainingItem[] = [
  item("training.s1.place", "s1", 1, "live", "point"),
  item("training.s1.measure", "s1", 2, "live", "choice"),
  item("training.s3.records1", "s3", 3, "card", "choice", { lesson: { questionId: "q.dr8", recordIds: ["trn.r06"] } }),
  item("training.s4.memory", "s4", 4, "freeze", "point", { memory: { unit: "EK53", at: centre, exposureMs: 8_000 } }),
  item("training.s4.log", "s4", 5, "freeze", "choice"),
];

export const FIXTURE_SPEC: TrainingSpec = {
  version: "training-fixture", capMs: 720_000, cardWindowMs: 60_000, demoMinDwellMs: 10_000, now: { virtualTimeS: -10_920, label: "10.18" },
  area: { bounds: { south: se.lat, west: nw.lon, north: nw.lat, east: se.lon }, lockMarginM: 100, centre },
  roadLabels: [], scenes: { s1: null, incident: null } as unknown as TrainingSpec["scenes"], items: FIXTURE_ITEMS,
  sections: (["s1", "s3", "s4"] as const).map((id) => ({ id, itemIds: FIXTURE_ITEMS.filter((i) => i.section === id).map((i) => i.id) })),
};

/** Texts tagged [fi] / [en]: a page in one language must carry no other tag. */
function textsOf(lang: Lang): TrainingTexts {
  const tag = `[${lang}]`;
  return {
    intro: { title: `${tag} Harjoitus`, body: [`${tag} intro`], start: `${tag} Aloita` },
    section: (id) => ({ title: `${tag} section ${id}`, body: [`${tag} card ${id}`], go: `${tag} go` }),
    item: (id) => ({ stem: `${tag} stem ${id}`, options: Object.fromEntries((FIXTURE_ITEMS.find((i) => i.id === id)?.options ?? []).map((o, k) => [o.id, `${tag} option ${k + 1}`])) }),
    feedback: (id, ctx) => [`${tag} feedback ${id}`, `${tag} key ${"optionId" in ctx.key ? ctx.key.optionId : "point"}; error ${ctx.errorM ?? "—"}; timed out ${ctx.timedOut}; source ${ctx.source}; m ${ctx.numbers.m}${ctx.lesson ? `; lesson ${ctx.lesson.questionId}` : ""}`],
    demo: (cell) => ({ title: `${tag} demo ${cell === "radio" ? "Haku" : "Thinker"}`, intro: `${tag} recorded`, examples: [
      { id: "ex1", question: `${tag} q1`, answer: [`${tag} a1`, `${tag} b1`], note: `${tag} note1` },
      { id: "ex2", question: `${tag} q2`, answer: [`${tag} a2`], note: `${tag} note2` },
    ] }),
    demoLines: { limitation: `${tag} limitation`, leave: `${tag} Valmis` },
    ui: {},
  };
}
export const FIXTURE_TEXTS: Readonly<Record<Lang, TrainingTexts>> = { fi: textsOf("fi"), en: textsOf("en") };

/** A training view of `itemId` (or none) in `phase`, with the tools its section opens. */
export function viewOf(phase: TrainingView["phase"], itemId: string | null, extra: Partial<TrainingView> = {}): TrainingView {
  const it = FIXTURE_ITEMS.find((i) => i.id === itemId) ?? null;
  const section = it?.section ?? (phase === "demo" ? "s5" : "s1");
  return {
    phase, sectionId: phase === "intro" ? null : section, itemId, position: it?.position ?? 0, itemCount: FIXTURE_ITEMS.length,
    scene: it?.scene ?? null, tools: { map: section !== "s4", rb: section === "s1" || section === "s3", log: section === "s2" || section === "s3", haku: it?.mode === "card" },
    answer: null, errorM: null, timedOut: false, demoId: phase === "demo" ? "haku" : null, capMs: 720_000, ...extra,
  };
}

/** The snapshot fields the harness's commands read, on the training's step. */
export function snapshotOf(view: TrainingView): SessionSnapshot {
  return { step: "training_incident", trainingIncident: view, currentCycle: 0, tour: null, spam: null, radioLog: [], consultPrompt: null, recordsBadge: false, minimumReached: false, secondsLeft: null, practice: false, clockLabel: "10.18" } as unknown as SessionSnapshot;
}

/** A fake of work package B's orchestrator methods: records each call; `records` is what `logRecords` returns. */
export function fakeHost(records: LogRecord[] = []) {
  const calls: unknown[][] = [];
  let n = 0;
  const host: TrainingHost & { logRecords(): Promise<LogRecord[]> } = {
    trainingStart: () => void calls.push(["trainingStart"]),
    trainingLeaveSection: () => void calls.push(["trainingLeaveSection"]),
    answerTraining: (itemId, answer, measures) => void calls.push(["answerTraining", itemId, answer, measures]),
    leaveTrainingFeedback: (itemId) => void calls.push(["leaveTrainingFeedback", itemId]),
    askTrainingHaku: async (text) => {
      calls.push(["askTrainingHaku", text]);
      const queryId = `trn.${++n}`;
      records.push({ kind: "training_haku_asked", detail: { queryId, itemId: "training.s3.records1", text, charCount: text.length, atItemMs: 0 } } as unknown as LogRecord);
      records.push({ kind: "training_haku_answered", detail: { queryId, itemId: "training.s3.records1", retrieved: [{ id: "trn.r06", fusedScore: 1 }], retrievalMode: "lexical_only", retrievalLanguage: "fi", answerSource: "template", modelId: null, promptHash: null, fallback: true, fallbackReason: "no_api_key", latencyMs: 0, answer: { vastaus: "1,1 ha", perusteet: "DR8 klo 10.05", varmuus: "korkea", muuttaisi: "uusi kuvaus" } } } as unknown as LogRecord);
    },
    leaveTrainingDemo: () => void calls.push(["leaveTrainingDemo"]),
    trainingSecondsLeft: () => 600,
    trainingStudySecondsLeft: () => 5,
    trainingCardSecondsLeft: () => 42,
    logRecords: async () => records,
  };
  return { host, calls, records };
}
