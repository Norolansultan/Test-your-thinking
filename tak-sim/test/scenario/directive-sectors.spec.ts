/**
 * Build check (fix pass 2, 7 Oct 2026, FC4/P2-3): every fire location a directive key is keyed on lies at
 * least 50 m inside the union of the sectors its sound posture accepts, so a plan in the accepted sectors is
 * on that fire and the key cannot flip on a few metres of the CA or of the sector wedges. The locations are
 * the ones the keys are computed from (`app/scenario/demo-directive.ts`): the rekindled front's centroid
 * (`NEW_FRONT`), the second rekindle's centroid (`SECOND_REKINDLE`), and the head the view's map shows
 * (`headSector`, V11–V13). Checked by sampling a 50 m circle round the location.
 */

import { describe, expect, it } from "vitest";
import type { LatLon, Polygon } from "../../app/engine/primitives.js";
import { DIRECTIVE_KEYS, NEW_FRONT, SECOND_REKINDLE } from "../../app/scenario/demo-directive.js";
import { centroid, headNow, inPolygon, siteStep } from "../../app/scenario/freeze-keys.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { MAIN_VIEWS } from "../../app/scenario/views.js";

const MARGIN_M = 50;
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Whether every point of the circle of `MARGIN_M` round `p` (and `p`) lies in one of `sectors`. */
function insideBy(p: LatLon, sectors: readonly string[]): boolean {
  const polys: Polygon[] = SITE_SCENARIO.sectors.filter((s) => sectors.includes(s.id)).map((s) => s.geometry);
  const m = 111_320, ml = m * Math.cos((p.lat * Math.PI) / 180);
  const pts: LatLon[] = [p, ...Array.from({ length: 24 }, (_, k) => ({ lat: p.lat + (Math.cos((2 * Math.PI * k) / 24) * MARGIN_M) / m, lon: p.lon + (Math.sin((2 * Math.PI * k) / 24) * MARGIN_M) / ml }))];
  return pts.every((q) => polys.some((poly) => inPolygon(q, poly)));
}

/** The second rekindle's centroid: the step-19 detached front whose sectors are the key's. */
function secondRekindleAt(): LatLon {
  const front = siteStep(SECOND_REKINDLE.step).reportedDetached.find((f) => {
    const before = siteStep(SECOND_REKINDLE.step - 1);
    return ![before.truthAtEnd, ...before.truthDetached].some((p) => inPolygon(centroid(f), p));
  });
  if (!front) throw new Error("no second rekindle on the step-19 map");
  return centroid(front);
}

describe("directive keys: the keyed fire lies inside its accepted sectors", () => {
  const newFrontAt = centroid(siteStep(NEW_FRONT.step).reportedDetached[0]!);
  const rekindleAt = secondRekindleAt();
  const cases = MAIN_VIEWS.flatMap((v) => {
    const key = DIRECTIVE_KEYS[v.index];
    if (!key?.soundSectors) return [];
    return Object.entries(key.soundSectors).map(([posture, sectors]) => {
      const at = posture === "direct_attack" && sameSet(sectors!, NEW_FRONT.sectors) && v.steps.includes(NEW_FRONT.step) ? newFrontAt
        : posture === "direct_attack" && sameSet(sectors!, SECOND_REKINDLE.sectors) && v.steps.includes(SECOND_REKINDLE.step) ? rekindleAt
          : posture === "direct_attack" && sameSet(sectors!, NEW_FRONT.sectors) ? newFrontAt
            : headNow(v.steps[0]!);
      return { view: v.id, posture, sectors: sectors!, at };
    });
  });

  it("has keys with sector-limited sound postures to check", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(`${c.view} ${c.posture}: ≥ ${MARGIN_M} m inside ${c.sectors.join("+")}`, () => {
      expect(insideBy(c.at, c.sectors), `${c.view} ${c.posture} at ${c.at.lat.toFixed(6)}, ${c.at.lon.toFixed(6)}`).toBe(true);
    });
  }
});
