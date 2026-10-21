/**
 * SPEC/35 §3 item 1, §9 P2: the primer — its content (seven pages, the same ids in both languages, one valid check question
 * each, DRAFT, generic) and its flow (`primer-flow.ts`, pure): a wrong answer shows the explanation and asks again, every
 * choice reported with its attempt, the dwell from the page's first frame to the leaving click, done after the last check.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRIMER_CONTENT, pageOfLabel } from "../../app/render/ui/explain/primer-content.js";
import { PRIMER_ILLUSTRATIONS } from "../../app/render/ui/explain/PrimerIllustrations.js";
import {
  back, canGoOn, choose, dwellMs, initialPrimerState, next, primerProblems, questionPhase, retry, type CheckRecord, type PrimerState,
} from "../../app/render/ui/explain/primer-flow.js";
import { PLACE_NAMES_EN } from "../../app/i18n/place-names.js";

const { fi, en } = PRIMER_CONTENT;

describe("the primer's content", () => {
  it("has seven pages, the same page and question ids, options and right answers in both languages, DRAFT", () => {
    expect(fi.pages).toHaveLength(7);
    expect(en.pages.map((p) => [p.id, p.illustration, p.question.id, p.question.options.length, p.question.correct]))
      .toEqual(fi.pages.map((p) => [p.id, p.illustration, p.question.id, p.question.options.length, p.question.correct]));
    expect(primerProblems(fi.pages)).toEqual([]);
    expect(primerProblems(en.pages)).toEqual([]);
    expect(fi.status).toMatch(/^DRAFT/);
    expect(en.status).toMatch(/^DRAFT/);
    expect(Object.keys(en.ui)).toEqual(Object.keys(fi.ui));
  });

  it("covers SPEC/35 §3's topics in order, each page with its own illustration", () => {
    expect(fi.pages.map((p) => p.id)).toEqual(["commander", "units", "fire_shape", "anchor_flank", "water", "safety", "screen"]);
    expect(fi.pages.map((p) => p.illustration)).toEqual([...PRIMER_ILLUSTRATIONS]);
  });

  it("is generic: no place of the scenario, and the illustrations are drawn in code, not the study map", () => {
    const places = Object.keys(PLACE_NAMES_EN).flatMap((n) => [n, PLACE_NAMES_EN[n]!]);
    const all = JSON.stringify([fi, en]);
    for (const p of places) expect(new RegExp(`(?<![\\p{L}])${p}(?![\\p{L}])`, "u").test(all), p).toBe(false);
    const ill = readFileSync("app/render/ui/explain/PrimerIllustrations.tsx", "utf8");
    expect(ill).not.toMatch(/maps\/|topo|\.webp|\.png|MapView|maplibre|site-scenario|OVERLAY/);
  });

  it("the page label fills its number and total", () => {
    expect(pageOfLabel(fi.ui, 3, 7)).toBe("Sivu 3 / 7");
    expect(pageOfLabel(en.ui, 3, 7)).toBe("Page 3 of 7");
  });
});

describe("the primer's flow", () => {
  const pages = fi.pages;
  const wrongOf = (i: number) => (pages[i]!.question.correct + 1) % pages[i]!.question.options.length;

  it("a wrong answer shows the explanation, then the question is asked again; each choice reports its attempt", () => {
    const records: CheckRecord[] = [];
    let s: PrimerState = initialPrimerState(pages.length);
    expect(questionPhase(s)).toBe("ask");
    expect(canGoOn(s)).toBe(false);
    expect(next(s)).toBe(s); // no going on before the question is answered

    let r = choose(s, pages, wrongOf(0))!;
    records.push(r.record);
    s = r.state;
    expect(questionPhase(s)).toBe("explain");
    expect(choose(s, pages, pages[0]!.question.correct)).toBeNull(); // not asked while the explanation is on screen
    s = retry(s);
    expect(questionPhase(s)).toBe("ask");
    r = choose(s, pages, pages[0]!.question.correct)!;
    records.push(r.record);
    s = r.state;
    expect(questionPhase(s)).toBe("answered");
    expect(records).toEqual([
      { questionId: "primer.q.commander", chosen: wrongOf(0), correct: false, attempt: 1 },
      { questionId: "primer.q.commander", chosen: pages[0]!.question.correct, correct: true, attempt: 2 },
    ]);
    expect(choose(s, pages, 0)).toBeNull(); // answered: no more choices
  });

  it("refuses a choice that is not an option", () => {
    const s = initialPrimerState(pages.length);
    expect(choose(s, pages, -1)).toBeNull();
    expect(choose(s, pages, 99)).toBeNull();
  });

  it("goes back and forth; a page answered stays answered; done (null) after the last page's check", () => {
    let s: PrimerState = initialPrimerState(pages.length);
    for (let i = 0; i < pages.length; i++) {
      s = choose(s, pages, pages[i]!.question.correct)!.state;
      if (i === 2) {
        s = back(s);
        expect(s.page).toBe(1);
        expect(questionPhase(s)).toBe("answered");
        s = next(s)!;
      }
      const n = next(s);
      if (i < pages.length - 1) { expect(n!.page).toBe(i + 1); s = n!; }
      else expect(n).toBeNull();
    }
    expect(back(initialPrimerState(3)).page).toBe(0);
  });

  it("measures the dwell from the page's first frame to the leaving click, never negative", () => {
    expect(dwellMs(1000.4, 13500.9)).toBe(12501);
    expect(dwellMs(null, 5000)).toBe(0);
    expect(dwellMs(5000, 4000)).toBe(0);
  });

  it("the screen reports through the contract's callbacks and reads no clock", () => {
    const src = readFileSync("app/render/ui/components/PrimerScreen.tsx", "utf8");
    expect(src).toMatch(/export function PrimerScreen\(\{ lang, onPage, onCheck, onDone \}: PrimerScreenProps\)/);
    expect(src).toMatch(/onPage\(page\.id, dwellMs\(enteredAt\.current, e\.timeStamp\)\);/);
    expect(src).toMatch(/onCheck\(r\.record\.questionId, r\.record\.chosen, r\.record\.correct, r\.record\.attempt\);/);
    expect(src).toMatch(/if \(to === null\) \{ setFinished\(true\); onDone\(\); return; \}/);
    expect(src).toMatch(/requestAnimationFrame\(\(t\) => \{ enteredAt\.current = t; \}\)/);
    expect(src).not.toMatch(/Date\.now|performance\.now|Math\.random/);
  });
});
