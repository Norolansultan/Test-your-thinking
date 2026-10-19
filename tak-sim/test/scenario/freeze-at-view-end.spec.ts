/**
 * SPEC/30 §5.1 (19 Oct 2026): the no-fit views V10 and V14 freeze after the plan is final — at the view's end, after the
 * plan-confidence item — so the view carries `freezeAtViewEnd` and no pre-planned moment. One source of truth
 * (`FREEZE_AT_VIEW_END` in `views.ts`), set by the builder; the contract checks the property's shape; the session's timing
 * puts no freeze cue on the clock for such a view. The session's run of it: `test/session/end-of-view-freeze.spec.ts`.
 */

import { describe, expect, it } from "vitest";
import { ScenarioConstructionError, createScenarioContract } from "../../app/scenario/contract.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { FREEZE_VIEWS } from "../../app/scenario/demo-probes.js";
import { CONSULT_PROMPT_AT_S, FREEZE_AT_VIEW_END } from "../../app/scenario/views.js";
import type { ScenarioContract } from "../../app/scenario/types.js";
import { viewTimingOf } from "../../app/session/view-clock.js";
import { buildValidScenario } from "./fixtures/valid-scenario.js";

const scenario = buildDemoScenario();

function reasonOf(input: ScenarioContract): string | null {
  try { createScenarioContract(input); return null; } catch (e) { return e instanceof ScenarioConstructionError ? e.reason : String(e); }
}

/** The fixture with view `index` changed by `patch`. */
function withView(index: number, patch: Record<string, unknown>): ScenarioContract {
  const s = buildValidScenario();
  return { ...s, cycles: s.cycles.map((c) => (c.index === index ? { ...c, ...patch } : c)) } as ScenarioContract;
}

describe("the end-of-view freeze in the scenario (SPEC/30 §5.1)", () => {
  it("is V10 and V14 only, both freeze views, and the builder sets it from that one set", () => {
    expect([...FREEZE_AT_VIEW_END].sort((a, b) => a - b)).toEqual([10, 14]);
    for (const v of FREEZE_AT_VIEW_END) expect(FREEZE_VIEWS.has(v)).toBe(true);
    const flagged = [scenario.practice.cycle, ...scenario.cycles].filter((c) => c.freezeAtViewEnd === true).map((c) => c.index);
    expect(flagged).toEqual([...FREEZE_AT_VIEW_END].sort((a, b) => a - b));
    for (const c of scenario.cycles.filter((x) => FREEZE_AT_VIEW_END.has(x.index))) expect(c).toMatchObject({ hasFreeze: true, freezeAtSeconds: null, freezeAtViewEnd: true });
  });

  it("the demo scenario passes the contract with it (the builder's own call), and the fixture with a valid end-of-view freeze too", () => {
    expect(reasonOf(scenario)).toBeNull();
    expect(reasonOf(withView(10, { hasFreeze: true, freezeAtSeconds: null, freezeAtViewEnd: true }))).toBeNull();
    expect(reasonOf(withView(10, { hasFreeze: true, freezeAtSeconds: 40, freezeAtViewEnd: false }))).toBeNull();
  });

  it("the contract refuses it without a freeze, with a moment beside it, on the practice view, or as a non-boolean", () => {
    expect(reasonOf(withView(10, { hasFreeze: false, freezeAtSeconds: null, freezeAtViewEnd: true }))).toBe("invalid-view-timing");
    expect(reasonOf(withView(10, { hasFreeze: true, freezeAtSeconds: 40, freezeAtViewEnd: true }))).toBe("invalid-view-timing");
    expect(reasonOf(withView(10, { hasFreeze: true, freezeAtSeconds: null, freezeAtViewEnd: "yes" }))).toBe("invalid-view-timing");
    const s = buildValidScenario();
    const practice = { ...s.practice, cycle: { ...s.practice.cycle, hasFreeze: true, freezeAtSeconds: null, freezeAtViewEnd: true } };
    expect(reasonOf({ ...s, practice } as ScenarioContract)).toBe("invalid-view-timing");
    // Without the property a freeze still needs its moment in the window (unchanged).
    expect(reasonOf(withView(10, { hasFreeze: true, freezeAtSeconds: null }))).toBe("invalid-view-timing");
  });

  it("the view's timing puts no freeze on the clock for it; the other freeze views keep their moments", () => {
    for (const c of scenario.cycles.filter((x) => x.hasFreeze)) {
      const t = viewTimingOf(c, null);
      if (FREEZE_AT_VIEW_END.has(c.index)) expect(t).toMatchObject({ freezeAtSeconds: null, freezeAtViewEnd: true });
      else expect(t).toMatchObject({ freezeAtSeconds: c.freezeAtSeconds, freezeAtViewEnd: false });
    }
  });
});

describe("the consult notification's moment (SPEC/30 §4)", () => {
  it("is 60 s on every main view's clock, scaled by a preview like every view moment, and absent in the practice view", () => {
    expect(CONSULT_PROMPT_AT_S).toBe(60);
    for (const c of scenario.cycles) expect(viewTimingOf(c, null).consultPromptAtSeconds).toBe(60);
    expect(viewTimingOf(scenario.cycles[0]!, { minViewSeconds: 12 }).consultPromptAtSeconds).toBe(6);
    expect(viewTimingOf(scenario.practice.cycle, null).consultPromptAtSeconds).toBeNull();
  });
});
