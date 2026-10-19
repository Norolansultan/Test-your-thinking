/**
 * The plan's draft across an interruption (review 6 Oct 2026, blocker): a freeze or V13's probe unmounts
 * the plan panel, so the draft is held by `SessionBody` (mounted for the whole view) and given back to
 * the panel exactly as it was. The holding logic is pure (`DecisionPanels.tsx`) and tested here; where
 * the state lives is checked at the source, as `visible-probe-ui.spec.ts` does (hooks cannot be rendered
 * in this test setup). Also the "recorded" line's summary and the revision's prefill.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { DEPARTURE_REASONS, type SectorPlan } from "../../app/scenario/plan-types.js";
import {
  draftFromPlan, EMPTY_PLAN_DRAFT, heldPlanDraft, planFromDraft, planSummary, type HeldPlanDraft, type PlanDraft,
} from "../../app/render/ui/components/DecisionPanels.js";

const src = (f: string) => readFileSync(`app/render/ui/components/${f}`, "utf8");

const DRAFT: PlanDraft = { mainEffort: "L2", posture: "barrier_line", secondarySector: "L3", secondaryTask: "task.mopup", droneSector: "L1", droneTask: "task.watch", departureNoted: false, departureReason: null };
const FULL: SectorPlan = { mainEffort: "L2", posture: "barrier_line", secondary: { sectorId: "L3", taskId: "task.mopup" }, drones: { sectorId: "L1", taskId: "task.watch" } };
const SECTORS = [{ id: "L1", labelFi: "Lohko 1" }, { id: "L2", labelFi: "Lohko 2" }, { id: "L3", labelFi: "Lohko 3" }];

describe("the plan's draft held for its view", () => {
  it("comes back exactly as it was within the view (after a freeze or probe), and empty in the next view", () => {
    const held: HeldPlanDraft = { view: 13, draft: DRAFT };
    expect(heldPlanDraft(held, 13)).toBe(DRAFT);
    expect(heldPlanDraft(held, 14)).toEqual(EMPTY_PLAN_DRAFT);
    expect(heldPlanDraft({ view: null, draft: EMPTY_PLAN_DRAFT }, 0)).toEqual(EMPTY_PLAN_DRAFT);
  });

  it("makes the plan only when complete; the posture is required", () => {
    expect(planFromDraft(DRAFT, true)).toEqual(FULL);
    expect(planFromDraft({ ...DRAFT, posture: null }, true)).toBeNull();
    expect(planFromDraft({ ...DRAFT, secondaryTask: null }, true)).toBeNull();
    expect(planFromDraft({ ...DRAFT, droneSector: undefined }, true)).toBeNull();
    expect(planFromDraft({ ...DRAFT, droneSector: undefined }, false)).toEqual({ ...FULL, drones: null }); // no drones on scene
    expect(planFromDraft({ ...DRAFT, secondarySector: null, droneSector: null }, true)).toEqual({ ...FULL, secondary: null, drones: null });
    expect(planFromDraft(EMPTY_PLAN_DRAFT, true)).toBeNull();
  });

  it("a recorded plan goes back into the form unchanged (the revision's prefill)", () => {
    for (const plan of [FULL, { ...FULL, secondary: null, drones: null }]) expect(planFromDraft(draftFromPlan(plan), true)).toEqual(plan);
    expect(draftFromPlan(null)).toEqual(EMPTY_PLAN_DRAFT);
  });
});

describe("the recorded plan's line", () => {
  it("summarises the plan from the form's own texts, in both languages", () => {
    const fi = UI_TEXT.fi, en = UI_TEXT.en;
    expect(planSummary(FULL, SECTORS, true, fi, (s) => s)).toBe(`Lohko 2 (${fi.postures.barrier_line}) · Lohko 3 → ${fi.secondaryTasks["task.mopup"]} · Lohko 1 → ${fi.droneTasks["task.watch"]}`);
    expect(planSummary({ ...FULL, secondary: null, drones: null }, SECTORS, true, en, (s) => s.replace("Lohko", "Sector"))).toBe(`Sector 2 (${en.postures.barrier_line}) · ${en.noSecondary} · ${en.dronesCarryOn}`);
    expect(planSummary({ ...FULL, drones: null }, SECTORS, false, en, (s) => s)).not.toContain(en.dronesCarryOn); // no drones on scene
  });
});

describe("where the draft lives (source)", () => {
  it("SessionBody holds it, keyed by the view, and passes it down; the panel keeps no state of its own", () => {
    const view = src("SessionView.tsx");
    expect(view).toMatch(/useState<HeldPlanDraft>\(\{ view: null, draft: EMPTY_PLAN_DRAFT \}\)/);
    expect(view).toMatch(/planDraft=\{heldPlanDraft\(plan, snapshot\.currentCycle\)\}/);
    expect(view).toMatch(/onPlanDraft=\{\(draft\) => setPlan\(\{ view: snapshot\.currentCycle, draft \}\)\}/);
    expect(src("DecisionPanels.tsx")).not.toMatch(/useState|useEffect/);
    expect(src("JudgementPanel.tsx")).toMatch(/<PlanPanel snapshot=\{snapshot\} orchestrator=\{orchestrator\} draft=\{planDraft\} onDraft=\{onPlanDraft\} \/>/);
  });

  it("shows the recorded line while waiting, prefills the revision, and the time-out notice in exploration", () => {
    const panel = src("JudgementPanel.tsx");
    const waiting = panel.slice(panel.indexOf('case "awaiting_view_end"'), panel.indexOf('case "hinge_pause"'));
    expect(waiting).toMatch(/t\.planRecorded/);
    expect(waiting).toMatch(/onPlanDraft\(draftFromPlan\(snapshot\.recordedPlan\)\); void orchestrator\.reviseAllocation\(\)/);
    const exploration = panel.slice(panel.indexOf('case "exploration"'), panel.indexOf('case "freeze"'));
    expect(exploration).toMatch(/snapshot\.previousViewTimedOutWithoutPlan && .*t\.timeUpNoPlan/);
  });
});

describe("the departure note (fix pass 6, D5; from V8, identical in both conditions)", () => {
  it("is optional: the plan is complete without it; before V8 the plan carries no such field", () => {
    expect(planFromDraft(DRAFT, true, false)).toEqual(FULL);
    expect(planFromDraft(DRAFT, true, true)).toEqual({ ...FULL, departureNoted: false });
  });

  it("carries the ticked box and the chosen reason (revision (ai): optional, nothing preselected), and no reason without the box", () => {
    expect(planFromDraft({ ...DRAFT, departureNoted: true, departureReason: "crew_safety" }, true, true)).toEqual({ ...FULL, departureNoted: true, departureReason: "crew_safety" });
    expect(planFromDraft({ ...DRAFT, departureNoted: true, departureReason: null }, true, true)).toEqual({ ...FULL, departureNoted: true });
    expect(planFromDraft({ ...DRAFT, departureNoted: false, departureReason: "resources" }, true, true)).toEqual({ ...FULL, departureNoted: false });
    expect(EMPTY_PLAN_DRAFT.departureReason).toBeNull();
  });

  it("the reason is a closed single choice shown only with the box: no text field, the six reasons in both languages, no tool option", () => {
    const panel = src("DecisionPanels.tsx");
    expect(panel).not.toMatch(/type="text"|<textarea/);
    expect(panel).toMatch(/\{departureNoted && \(/);
    expect(panel).toMatch(/DEPARTURE_REASONS\.map/);
    expect([...DEPARTURE_REASONS]).toEqual(["crew_safety", "protect_people_property", "new_fire_info", "directive_unfit", "resources", "other"]);
    expect(UI_TEXT.fi.departureReasonLabel).toBe("Pääasiallinen syy");
    expect(UI_TEXT.en.departureReasonLabel).toBe("Main reason");
    expect(UI_TEXT.fi.departureReasons).toEqual({
      crew_safety: "Miehistön turvallisuus", protect_people_property: "Ihmisten tai rakennusten suojaaminen",
      new_fire_info: "Uusi tieto palosta", directive_unfit: "Linjaus ei sovi nykytilanteeseen", // `31` coa F11: no examples (they cued the deciding fronts)
      resources: "Voimavarat eivät riitä linjauksen mukaiseen toimintaan", other: "Muu",
    });
    for (const lang of ["fi", "en"] as const) expect(DEPARTURE_REASONS.map((r) => UI_TEXT[lang].departureReasons[r]).join(" ")).not.toMatch(/haku|search|thinker|tekoäly|työkalu|tool|\bAI\b/i);
  });

  it("a recorded plan with the note goes back into the form (the revision's prefill)", () => {
    const noted = { ...FULL, departureNoted: true, departureReason: "new_fire_info" as const };
    expect(planFromDraft(draftFromPlan(noted), true, true)).toEqual(noted);
  });

  it("has its text in both languages, and the panel offers it from V8 in every condition (source)", () => {
    expect(UI_TEXT.fi.departureLabel).toBe("Poikkean johdon linjauksesta");
    expect(UI_TEXT.en.departureLabel).toBe("I am departing from the command directive");
    const panel = src("DecisionPanels.tsx");
    expect(panel).toMatch(/offerDeparture = snapshot\.currentCycle >= DEPARTURE_NOTE_FROM_VIEW/);
    expect(panel).not.toMatch(/condition/); // identical in both conditions
  });
});
