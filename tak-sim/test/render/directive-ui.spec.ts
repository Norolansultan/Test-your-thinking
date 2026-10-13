/**
 * The directive and the posture in the UI (4 Oct 2026). The components are checked at the source,
 * as `FreezeScreen`'s rules are (`test/scenario/freeze-items.spec.ts`): the hinge pause screen
 * shows the directive in the session language, and the plan panel asks the main effort's posture
 * with nothing preselected and confirm disabled until it is chosen. The wording is the brief's.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { MAIN_EFFORT_POSTURES } from "../../app/scenario/plan-types.js";

describe("the posture's wording", () => {
  it("is review round 2's (one term each, no lexical pull), in both languages, for every posture", () => {
    expect(UI_TEXT.fi.postures).toEqual({
      direct_attack: "Suora hyökkäys palon reunaan",
      barrier_line: "Puolustuslinja tien tai vesistön varaan",
      protect_values: "Asutuksen suojaus",
    });
    expect(UI_TEXT.en.postures).toEqual({
      direct_attack: "Direct attack on the fire's edge",
      barrier_line: "Defensive line on a road or water",
      protect_values: "Protecting settlements",
    });
    expect(Object.keys(UI_TEXT.fi.postures).sort()).toEqual([...MAIN_EFFORT_POSTURES].sort());
  });

  it("the guided tour's description of the plan mentions it", () => {
    expect(UI_TEXT.fi.tour.steps.decision.body).toMatch(/toimintatava/);
    expect(UI_TEXT.en.tour.steps.decision.body).toMatch(/main effort posture/);
  });
});

describe("the plan panel", () => {
  const src = readFileSync("app/render/ui/components/DecisionPanels.tsx", "utf8");

  it("starts every view with no posture, and confirm needs one", () => {
    // The draft is held by `SessionBody` since 6 Oct 2026 (`plan-draft-ui.spec.ts`); empty in every view.
    expect(src).toMatch(/EMPTY_PLAN_DRAFT: PlanDraft = \{ mainEffort: null, posture: null,/);
    expect(src).toMatch(/const complete = d\.mainEffort !== null && d\.posture !== null &&/);
    expect(src).toMatch(/MAIN_EFFORT_POSTURES\.map/);
  });
});

describe("the hinge pause screen", () => {
  const src = readFileSync("app/render/ui/components/JudgementPanel.tsx", "utf8");

  it("shows the directive in the session language, from P2", () => {
    const hinge = src.slice(src.indexOf('case "hinge_pause"'), src.indexOf('case "complete"'));
    expect(hinge).toMatch(/tr\(snapshot\.hingeDirective\)/);
    expect(hinge).toMatch(/t\.hingeDirectiveFrom/);
    expect(UI_TEXT.fi.hingeDirectiveFrom).toMatch(/P2/);
    expect(UI_TEXT.en.hingeDirectiveFrom).toMatch(/P2/);
  });
});
