/**
 * Which projection parts the map draws (SPEC/12 amendment 2 Oct 2026, later; review 3 Oct 2026): only growing
 * parts while something grows; every part when nothing does, so the omission view (V9) looks like V8.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { growthHa, projectionGrowth } from "../../app/render/projection-growth.js";
import theme from "../../app/render/ui/fire-theme.json" with { type: "json" };

const scenario = buildDemoScenario();
const MIN = theme.projection.growthMinHa;
const viewOf = (v: number) => {
  const env = scenario.envelopes.find((e) => e.cycle === v)!;
  const c = scenario.cycles.find((x) => x.index === v)!;
  return { isos: env.isochrones, fire: [c.perimeter, ...c.detachedFronts] };
};

describe("projection parts drawn on the map", () => {
  it("V8 and V9 draw every part of their projection, the same form as before the two-fire period", () => {
    for (const v of [8, 9]) {
      const { isos, fire } = viewOf(v);
      const g = projectionGrowth(isos, fire, MIN);
      for (const iso of isos) for (const p of [iso.polygon, ...iso.detachedParts]) expect(g.shown(p), `V${v}`).toBe(true);
    }
  });

  it("from V10 on, the held old fire's part is not drawn while the live front's is", () => {
    for (const v of [10, 11]) {
      const { isos, fire } = viewOf(v);
      const g = projectionGrowth(isos, fire, MIN);
      expect(g.anyGrows, `V${v}`).toBe(true);
      const outer = isos[isos.length - 1]!;
      const parts = [outer.polygon, ...outer.detachedParts];
      expect(parts.some((p) => !g.shown(p)), `V${v}: a held part is hidden`).toBe(true);
      expect(parts.some((p) => g.shown(p)), `V${v}: the live part is drawn`).toBe(true);
    }
  });

  it("a part that only hugs a fire ring grows ~0 ha whichever vertex the ring starts at", () => {
    const { isos, fire } = viewOf(10);
    const held = [isos[1]!.polygon, ...isos[1]!.detachedParts].sort((a, b) => growthHa(a, fire) - growthHa(b, fire))[0]!;
    const main = fire[0]!;
    for (const shift of [0, 7, 31, 101]) {
      const r = main[0]!.slice(0, -1);
      const rot = [...r.slice(shift % r.length), ...r.slice(0, shift % r.length)];
      expect(growthHa(held, [[[...rot, rot[0]!]], ...fire.slice(1)])).toBeLessThan(MIN);
    }
  });
});
