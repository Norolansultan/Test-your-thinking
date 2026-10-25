/**
 * The map training's build (researcher decision 25 Oct 2026, replacing the map-reading pretest's; `tools/review/map-training.ts`,
 * SPEC/08 (bj)): the keys are computed from the site data, never typed — the committed outputs are exactly what the tool writes now;
 * the extract is the pretest's, outside the incident, and the training's own names (R5–R7, EK51, DR8, Kaitajärvi) are in no record,
 * item or radio text of the scenario; every choice task has its key among its options; the rules' margins hold; the texts exist in
 * both languages for every task and option and name nothing of the scenario.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildMapTraining, CROP, json, MEMORY_MS, previewSvg, readTopoFeatures, TRAINING_NAMES, TRAINING_TIME_LIMIT_MS } from "../../tools/review/map-training.js";
import { MAP_TRAINING } from "../../app/session/map-training.js";
import { isPointTask, type TrainingTask } from "../../app/session/map-training-spec.js";
import { MAP_TRAINING_TEXT } from "../../app/i18n/map-training-texts.js";
import { PLACE_NAMES_EN } from "../../app/i18n/place-names.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { recordText } from "../../app/session/template-answer.js";
import { toRenderable } from "../../app/boundary/render-boundary.js";
import { wgs84ToTm35 } from "../../tools/fire-ca/tm35.js";

const built = buildMapTraining(readTopoFeatures("."));
const key = built.key.tasks as Record<string, Record<string, unknown>>;
const task = <K extends TrainingTask["kind"]>(kind: K) => MAP_TRAINING.tasks.find((t) => t.kind === kind) as Extract<TrainingTask, { kind: K }>;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
/** The scenario's names (records, questions, directive): the first block of `PLACE_NAMES_EN`, in both languages. */
const SCENARIO_NAMES = ["Karhujärvi", "Haukilampi", "Kotkanjoki", "Koivuoja", "Myllyoja", "Lahdenkylä", "Mökkiranta", "Rahkasuo", "Kuivakangas", "Kuusimäki", "Honkaharju"]
  .flatMap((fi) => [fi, PLACE_NAMES_EN[fi]!]);

describe("the map training's build (25 Oct 2026; SPEC/08 (bj))", () => {
  it("writes exactly the committed files: the training's spec, the key figures and the checkers' preview (keys computed, never typed)", () => {
    expect(json(built.spec)).toBe(readFileSync("content/pretest/map-training.json", "utf8"));
    expect(json(built.key)).toBe(readFileSync("content/pretest/map-training.key.json", "utf8"));
    expect(previewSvg(built.spec, "../../../app/render/ui/public/maps/topo/0_3.webp")).toBe(readFileSync("docs/audits/2026-10-23-difficulty/map-training-preview.svg", "utf8"));
    expect(MAP_TRAINING).toEqual(built.spec);
  });

  it("has the seven tasks in the researcher's order, the 5-minute cap and the 8 s exposure; every choice key is one of its options", () => {
    expect(MAP_TRAINING.tasks.map((t) => t.kind)).toEqual(["place", "measure", "slope", "water", "now", "project", "memory"]);
    expect(MAP_TRAINING.timeLimitMs).toBe(TRAINING_TIME_LIMIT_MS);
    expect(TRAINING_TIME_LIMIT_MS).toBe(300_000);
    expect(MAP_TRAINING.memoryMs).toBe(MEMORY_MS);
    expect(MEMORY_MS).toBe(8_000);
    for (const t of MAP_TRAINING.tasks) {
      if (isPointTask(t)) {
        expect(t.key.x > 0 && t.key.x < CROP.size && t.key.y > 0 && t.key.y < CROP.size, t.id).toBe(true);
        continue;
      }
      expect(new Set(t.options.map((o) => o.id)).size, t.id).toBe(t.options.length);
      expect(t.options.map((o) => o.id), t.id).toContain(t.key);
    }
    expect(MAP_TRAINING.roadLabels.map((l) => l.road)).toEqual(TRAINING_NAMES.roads);
  });

  it("keeps the pretest's extract, outside the incident; the training's own names are in no record, item or radio text of the scenario", () => {
    expect(MAP_TRAINING.crop).toMatchObject({ x0: 4375, y0: 0, size: 625, tile: "0_3" });
    const e = SITE_SCENARIO.extent;
    const ne = wgs84ToTm35({ lat: e.north, lon: e.east });
    const west = 509_000 + CROP.x0 * 4, north = 6_756_000 - CROP.y0 * 4, south = north - CROP.size * 4;
    expect(west > ne.eastM || south > ne.northM).toBe(true);
    const scenario = buildDemoScenario();
    const texts = [
      ...scenario.atoms.map((a) => recordText(toRenderable(a).record)),
      ...[...scenario.freezes, scenario.practice.freeze].flatMap((f) => f.items.flatMap((it) => [it.promptFi, ...it.options.map((o) => o.labelFi)])),
      ...scenario.probeSchedule.probes.map((p) => p.prompt),
    ];
    const own = new RegExp(`\\b(${[...TRAINING_NAMES.roads, TRAINING_NAMES.unit, TRAINING_NAMES.drone].join("|")})\\b|Kaitajärv|Narrow Lake`);
    for (const t of texts) expect(t, t.slice(0, 60)).not.toMatch(own);
  });

  it("the rules' margins hold", () => {
    const k = (id: string) => key[id]!;
    // 1. the junction ≥ 400 m from R5's other junctions.
    expect(k("training.t1.place").nearestOtherJunctionM as number).toBeGreaterThanOrEqual(400);
    // 2. within 4 % of its option, the next road ≥ 1.5 × as far; the options double, so no other option is within 40 %.
    const m = task("measure");
    const opt = m.options.find((o) => o.id === m.key)!.metres;
    expect(Math.abs(m.metres - opt)).toBeLessThanOrEqual(0.04 * opt);
    expect(k("training.t2.measure").nextRoadM as number).toBeGreaterThanOrEqual(1.5 * m.metres);
    for (const o of m.options) if (o.id !== m.key) expect(Math.abs(o.metres - m.metres) / m.metres).toBeGreaterThanOrEqual(0.4);
    // 3. B ≥ 5 m up across two contour lines or more, rising; C level within 1 m.
    const s = k("training.t3.slope");
    expect(s.riseBm as number).toBeGreaterThanOrEqual(5);
    const levels = s.contourLevelsAB as number[];
    expect(levels.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < levels.length; i++) expect(levels[i]!).toBeGreaterThan(levels[i - 1]!);
    expect(s.levelCmaxDevM as number).toBeLessThanOrEqual(1);
    // 4. one fill point ≤ 0.75 × nearer in a straight line, the other (the key) ≤ 0.5 × nearer by road.
    const w = task("water");
    const ki = w.key === "fill_1" ? 0 : 1, oi = 1 - ki;
    expect(w.straightKm[oi]!).toBeLessThan(w.straightKm[ki]!);
    expect(k("training.t4.water").straightRatio as number).toBeLessThanOrEqual(0.75);
    expect(w.roadKm[ki]!).toBeLessThan(w.roadKm[oi]!);
    expect(k("training.t4.water").roadRatio as number).toBeLessThanOrEqual(0.5);
    // 5./6. the drawn head 120 m short of the road (12 min at 10 m/min); the projection 300 m on, the drawn edge's lure 120 m off.
    const n = task("now"), p = task("project");
    expect(Math.round(dist(n.fire.head, n.headAt) * 4)).toBe(120);
    expect(p.headAt).toEqual(n.headAt);
    expect(p.minutes * p.metresPerMin).toBe(300);
    expect(Math.round(dist(p.headAt, p.key) * 4)).toBe(300);
    expect(k("training.t6.project").lureOffM).toBe(120);
    // 7. the unit away from every other task's points.
    expect(k("training.t7.memory").toOtherTasksM as number).toBeGreaterThanOrEqual(400);
  });
});

describe("the map training's texts (fi DRAFT, en)", () => {
  it("every task has its question and feedback, every option its label, in both languages; generic: no scenario name, no AI tool", () => {
    for (const lang of ["fi", "en"] as const) {
      const t = MAP_TRAINING_TEXT[lang];
      const all: string[] = [t.title, t.intro(7, 5), t.markHint, t.marked, t.measureHint];
      for (const task of MAP_TRAINING.tasks) {
        all.push(t.prompt(task), t.feedback(task));
        if (task.kind === "now") all.push(t.report(task));
        if (task.kind === "memory") all.push(t.study(task, 8));
        if (!isPointTask(task)) {
          const labels = task.options.map((o) => t.option(task, o.id));
          expect(new Set(labels).size, `${lang} ${task.id}`).toBe(labels.length);
          all.push(...labels);
        }
      }
      for (const s of all) {
        expect(s.length, lang).toBeGreaterThan(0);
        expect(s, s.slice(0, 50)).not.toMatch(new RegExp(SCENARIO_NAMES.join("|")));
        expect(s, s.slice(0, 50)).not.toMatch(/\b(AI|tekoäly|Thinker|LLM)\b/);
        expect(s, s.slice(0, 50)).not.toMatch(/undefined|NaN/);
      }
    }
  });

  it("the feedback states each task's computed answer", () => {
    const m = task("measure"), w = task("water"), p = task("project"), n = task("now");
    expect(MAP_TRAINING_TEXT.en.feedback(m)).toContain(`about ${m.metres} m`);
    expect(MAP_TRAINING_TEXT.en.feedback(w)).toMatch(new RegExp(`^Fill point ${w.key.slice(-1)}\\.`));
    expect(MAP_TRAINING_TEXT.fi.feedback(p)).toContain("300 m");
    expect(MAP_TRAINING_TEXT.en.feedback(n)).toMatch(new RegExp(`^At road ${n.road}\\.`));
    expect(MAP_TRAINING_TEXT.en.option(n, n.key)).toContain(n.road);
  });
});
