/**
 * SPEC/34 §3: the training course's content — seven modules in order, each with 2–4 pages, one exercise and 2–3 check
 * questions with a valid answer, every text in Finnish and English (Finnish marked DRAFT in the content files); the
 * check questions' flow; the instructions panel's checklist.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { COURSE_MODULES, courseModule } from "../../app/game/course/index.js";
import { CHECKLIST } from "../../app/game/course/checklist.js";
import { checksPassed, nextQuestion, pickOption, startChecks } from "../../app/game/course/check-flow.js";
import { COURSE_EXERCISES } from "../../app/game/course/exercises/index.js";
import { getWorld } from "../../app/game/world/load.js";
import { inGrid } from "../../app/game/world/grid.js";

const COURSE_DIR = fileURLToPath(new URL("../../app/game/course/", import.meta.url));
const filled = (s: string): boolean => s.trim().length > 0;

describe("the course's modules", () => {
  it("are the seven of SPEC/34 §3, in order, with unique ids", () => {
    expect(COURSE_MODULES.map((m) => m.topic)).toEqual(["map", "fire", "recon", "orders", "water", "safety", "mopup"]);
    expect(new Set(COURSE_MODULES.map((m) => m.id)).size).toBe(7);
    for (const m of COURSE_MODULES) expect(courseModule(m.id)).toBe(m);
  });

  describe.each(COURSE_MODULES.map((m) => [m.id, m] as const))("%s", (_id, m) => {
    it("has a title, 2–4 pages, fi and en texts, and map views on the grid", () => {
      expect(filled(m.titleFi) && filled(m.titleEn)).toBe(true);
      expect(m.pages.length).toBeGreaterThanOrEqual(2);
      expect(m.pages.length).toBeLessThanOrEqual(4);
      for (const p of m.pages) {
        expect(filled(p.headingFi) && filled(p.headingEn) && filled(p.bodyFi) && filled(p.bodyEn)).toBe(true);
        expect(p.bodyFi).not.toMatch(/110 ?kV/);
        expect(p.bodyEn).not.toMatch(/110 ?kV/);
        if (p.view) {
          expect(inGrid(getWorld(), p.view.centre)).toBe(true);
          expect(p.view.widthM).toBeGreaterThan(200);
        }
      }
    });

    it("has one exercise on its own topic", () => {
      expect(m.exercise).toBeDefined();
      expect(m.exercise!.topic).toBe(m.topic);
      expect(m.exercise!.criteria.length).toBeGreaterThan(0);
      expect(m.exercise!.reference.commands.length).toBeGreaterThan(0);
      for (const s of [m.exercise!.titleFi, m.exercise!.titleEn, m.exercise!.promptFi, m.exercise!.promptEn, m.exercise!.reference.explanationFi, m.exercise!.reference.explanationEn]) expect(filled(s)).toBe(true);
      expect(m.exercise!.debriefFi.length).toBe(m.exercise!.debriefEn.length);
      for (const c of m.exercise!.criteria) expect(filled(c.labelFi) && filled(c.labelEn)).toBe(true);
    });

    it("has 2–3 check questions, each with a valid answer and fi and en texts", () => {
      expect(m.checks.length).toBeGreaterThanOrEqual(2);
      expect(m.checks.length).toBeLessThanOrEqual(3);
      expect(new Set(m.checks.map((q) => q.id)).size).toBe(m.checks.length);
      for (const q of m.checks) {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(Number.isInteger(q.correct)).toBe(true);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(q.options.length);
        for (const s of [q.promptFi, q.promptEn, q.explanationFi, q.explanationEn, ...q.options.flatMap((o) => [o.textFi, o.textEn])]) expect(filled(s)).toBe(true);
      }
    });
  });

  it("every exercise belongs to exactly one module, and the ids are unique", () => {
    expect(COURSE_EXERCISES.map((e) => e.id)).toEqual(COURSE_MODULES.map((m) => m.exercise!.id));
    expect(new Set(COURSE_EXERCISES.map((e) => e.id)).size).toBe(COURSE_EXERCISES.length);
    expect(new Set(COURSE_EXERCISES.map((e) => e.scenario.id)).size).toBe(COURSE_EXERCISES.length);
  });

  it("marks the Finnish texts DRAFT in every content file", () => {
    for (const dir of ["modules", "exercises"]) {
      for (const f of readdirSync(join(COURSE_DIR, dir)).filter((x) => x.endsWith(".ts") && x !== "index.ts" && x !== "common.ts")) {
        expect(readFileSync(join(COURSE_DIR, dir, f), "utf8"), `${dir}/${f}`).toContain("// DRAFT fi");
      }
    }
    expect(readFileSync(join(COURSE_DIR, "checklist.ts"), "utf8")).toContain("// DRAFT fi");
  });
});

describe("the check questions' flow", () => {
  const qs = COURSE_MODULES[0]!.checks;
  const wrong = (i: number): number => (qs[i]!.correct + 1) % qs[i]!.options.length;

  it("re-asks a question answered wrong, moves on after a right answer, and passes when each was right once", () => {
    let s = startChecks(qs.length);
    expect(checksPassed(s)).toBe(false);
    s = pickOption(s, qs, wrong(0));
    expect(s.picked).toBe(wrong(0));
    expect(s.right[0]).toBe(false);
    s = nextQuestion(s, qs);
    expect(s.index).toBe(0); // asked again
    expect(s.picked).toBeNull();
    for (let i = 0; i < qs.length; i++) {
      expect(s.index).toBe(i);
      s = pickOption(s, qs, qs[i]!.correct);
      expect(pickOption(s, qs, wrong(i))).toBe(s); // one answer per showing
      s = nextQuestion(s, qs);
    }
    expect(checksPassed(s)).toBe(true);
  });
});

describe("the instructions panel's checklist (SPEC/34 §5)", () => {
  it("covers fire, weather, terrain and fuel, people and property, resources, water, safety and the picture's age", () => {
    expect(CHECKLIST.map((c) => c.id)).toEqual(["fire", "weather", "terrain", "people", "resources", "water", "safety", "picture"]);
    for (const c of CHECKLIST) {
      expect(c.pointsFi.length).toBe(c.pointsEn.length);
      expect(c.pointsFi.length).toBeGreaterThan(0);
    }
    const safety = CHECKLIST.find((c) => c.id === "safety")!;
    expect(safety.pointsEn.join(" ")).toMatch(/LACES/);
    expect(safety.pointsEn.join(" ")).toMatch(/power line/i);
    expect(safety.pointsEn.join(" ")).toMatch(/smoke/i);
  });

  it("is generic: it names no exercise's places or units", () => {
    const text = CHECKLIST.flatMap((c) => [...c.pointsFi, ...c.pointsEn, c.headingFi, c.headingEn]).join(" ");
    for (const e of COURSE_EXERCISES) for (const u of e.scenario.units) expect(text).not.toContain(u.id);
    expect(text).not.toMatch(/Karhujärv|Haukilamp/);
  });
});
