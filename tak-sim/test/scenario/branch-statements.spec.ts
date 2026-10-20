/**
 * The candidate developments after "fundamentally wrong" (readiness round, agent H, 5 Oct 2026;
 * `branch-statements.ts`): truth derived from the CA, never from the shuffle; exactly one true per
 * view and none at the omission (V9); no grey statement; no cue of a designed event or of the view's
 * freeze item; similar lengths; English in the labels file matching the generator.
 */

import { describe, expect, it } from "vitest";
import labels from "../../content/i18n/labels.en.json" with { type: "json" };
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { BRANCH_OMISSION_VIEW, BRANCH_SPECS, branchTextEn, branchTextFi, branchVerdict, buildBranchStatements, viewDevelopment } from "../../app/scenario/branch-statements.js";
import { MAIN_VIEWS } from "../../app/scenario/views.js";
import { toRenderableBranchStatement } from "../../app/boundary/render-boundary.js";

const scenario = buildDemoScenario();
const L = labels as Record<string, string>;

describe("branch statements: truth from the CA run", () => {
  it("every view has four statements, every truth defined (scored), exactly one true — none at the omission view (V9)", () => {
    for (const v of MAIN_VIEWS) {
      const st = scenario.branchStatements.filter((b) => b.cycle === v.index);
      expect(st, `V${v.index}`).toHaveLength(4);
      expect(st.every((b) => b.truth.isActualDevelopment !== null), `V${v.index}`).toBe(true);
      expect(st.filter((b) => b.truth.isActualDevelopment === true).length, `V${v.index}`).toBe(v.index === BRANCH_OMISSION_VIEW ? 0 : 1);
    }
  });

  it("each statement's truth is its rule's verdict on the CA (not its place in the shuffle), and the scenario keeps it", () => {
    const built = new Map(buildBranchStatements().map((b) => [b.branchId, b]));
    for (const b of scenario.branchStatements) {
      const [, view, k] = /^branch\.(\d+)\.(\d)$/.exec(b.branchId)!.map(Number) as [number, number, number];
      const spec = BRANCH_SPECS[view]![k]!;
      expect(b.truth.isActualDevelopment, b.branchId).toBe(branchVerdict(spec, viewDevelopment(view)));
      expect(b).toEqual(built.get(b.branchId));
    }
    // The order shown is seeded, so the true statement is not always first.
    const firstTrue = MAIN_VIEWS.filter((v) => v.index !== BRANCH_OMISSION_VIEW).map((v) => scenario.branchStatements.filter((b) => b.cycle === v.index).findIndex((b) => b.truth.isActualDevelopment));
    expect(new Set(firstTrue).size).toBeGreaterThan(1);
    expect(buildDemoScenario().branchStatements).toEqual(scenario.branchStatements);
  });

  it("the CA facts behind the key statements (as documented)", () => {
    expect(viewDevelopment(4).newFronts).toBe(0); // SPEC/33 stage 9: the crown run's spots merge with the head by 15:20 on the rebuilt map (was 1)
    expect(viewDevelopment(4).advanceM.NE).toBeGreaterThan(690); // the crown run, the true statement (NE over 600 m)
    expect(viewDevelopment(9).newFronts).toBe(1); // the rekindle: the omission, outside the menu
    expect(viewDevelopment(8).growthHa).toBe(0);
    expect(viewDevelopment(12).advanceM.SE).toBeGreaterThan(288); // revision (aj): ~340 m, the SE statement's threshold 250 m (was > 345 for 300 m)
  });

  it("no statement cues a designed event or the view's freeze item", () => {
    const of = (v: number) => BRANCH_SPECS[v]!;
    for (const v of [7, 8, 9]) expect(of(v).some((s) => s.kind === "new_front"), `V${v}: the rekindle`).toBe(false);
    for (const v of [2, 5, 6, 13]) expect(of(v).some((s) => s.kind === "new_front"), `V${v}: a spot reported in the view`).toBe(false);
    expect(of(13).some((s) => s.kind === "dir" && s.sectors.some((d) => d.startsWith("N")))).toBe(false); // the contradiction is about the north edge
    for (const v of [5, 14]) expect(of(v).some((s) => s.kind === "growth"), `V${v}: freeze growth_trend`).toBe(false);
    expect(of(10).some((s) => s.kind === "dir")).toBe(false); // freeze front_direction
    expect(of(4).some((s) => s.kind === "stalls")).toBe(false); // freeze rate_trend
    expect(of(7).some((s) => s.kind === "dir" && s.sectors.includes("NW"))).toBe(false); // freeze cabins_reach
    for (const b of scenario.branchStatements) expect(b.statementFi).not.toMatch(/syttymäkoh|uudelleen|kyt|mök|ristiri|savu/i);
  });

  it("statements of a view are of similar length, in both languages", () => {
    for (const v of MAIN_VIEWS) {
      const h = viewDevelopment(v.index).horizonClock;
      for (const lang of [branchTextFi, branchTextEn]) {
        const n = BRANCH_SPECS[v.index]!.map((s) => lang(s, h).length);
        expect(Math.max(...n) / Math.min(...n), `V${v.index}`).toBeLessThanOrEqual(1.3);
      }
    }
  });

  it("every statement has its English in labels.en.json, equal to the generator's", () => {
    for (const v of MAIN_VIEWS) {
      const h = viewDevelopment(v.index).horizonClock;
      for (const s of BRANCH_SPECS[v.index]!) expect(L[branchTextFi(s, h)]).toBe(branchTextEn(s, h));
    }
  });

  it("the render boundary strips the truth (I4)", () => {
    for (const b of scenario.branchStatements) expect(JSON.stringify(toRenderableBranchStatement(b))).not.toMatch(/truth|isActualDevelopment/);
  });
});
