/**
 * SPEC/12 revision 24 Sep (c): the fire/projection display rules that a later edit of
 * `fire-theme.json` or the scenario could quietly break.
 */

import { describe, expect, it } from "vitest";
import theme from "../../app/render/ui/fire-theme.json" with { type: "json" };
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { projectionCertaintyOf, toRenderableEnvelope } from "../../app/boundary/render-boundary.js";

function hue(hex: string): { h: number; s: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return { h: 0, s: 0 };
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : d / max };
}

/** Every colour string in an object tree. */
const colours = (o: unknown): string[] =>
  typeof o === "string" ? (/^#[0-9a-f]{6}$/i.test(o) ? [o] : []) : o && typeof o === "object" ? Object.values(o).flatMap(colours) : [];

describe("fire theme (SPEC/12 revision 24 Sep (c))", () => {
  it("has no blue or purple anywhere in the fire and projection layers (blue = own forces)", () => {
    for (const c of colours(theme)) {
      const { h, s } = hue(c);
      if (s > 0.15) expect(h < 180 || h > 330, `${c} hue ${Math.round(h)}°`).toBe(true);
    }
  });

  it("keeps the projection weaker than the current fire edge: never thicker, never more saturated", () => {
    for (const w of Object.values(theme.projection.widthPxByMinutes)) expect(w).toBeLessThanOrEqual(theme.uncontained.widthPx);
    expect(hue(theme.projection.color).s).toBeLessThan(hue(theme.uncontained.color).s);
    for (const b of theme.projection.bands) {
      expect(b.color.toUpperCase()).not.toBe(theme.uncontained.color.toUpperCase());
      expect(hue(b.color).s).toBeLessThan(hue(theme.uncontained.color).s);
      expect(b.opacity).toBeLessThan(theme.burnt.opacity);
    }
    // Lighter outward: the further the horizon, the weaker the band.
    const ops = theme.projection.bands.map((b) => b.opacity);
    expect([...ops].sort((a, b) => b - a)).toEqual(ops);
  });

  it("narrows the isochrones with horizon and orders certainty opacities", () => {
    const w = theme.projection.widthPxByMinutes;
    expect(w["10"]).toBeGreaterThan(w["20"]);
    const o = theme.projection.certaintyOpacity;
    expect(o.likely).toBeGreaterThan(o.moderate);
    expect(o.moderate).toBeGreaterThan(o.uncertain);
  });
});

describe("fire display data (SPEC/12 revision 24 Sep (c) §7)", () => {
  it("gives every single-step view T+10 and T+20 isochrones and every merged view T+20 and T+40: the outer one, the scored envelope, reaches exactly to the next situation (2 Oct 2026)", () => {
    for (const v of SITE_SCENARIO.views) {
      const iso = v.steps.length === 2 ? [20, 40] : [10, 20];
      expect(v.horizonMinutes).toBe(iso[1]);
      expect(v.projectionBands.map((b) => `${b.fromMinutes}-${b.toMinutes}`)).toEqual([`0-${iso[0]}`, `${iso[0]}-${iso[1]}`]);
      expect(v.isochrones.map((i) => i.minutes)).toEqual(iso);
      expect(v.isochrones[1]!.polygon).toEqual(v.envelope);
    }
  });

  it("shows at most three earlier perimeters and no detection older than 30 minutes", () => {
    for (const c of SITE_SCENARIO.steps) {
      expect(c.fire.perimeters_past.length).toBeLessThanOrEqual(3);
      const now = (c.index - 1) * 1200;
      for (const d of c.fire.detections) expect(now - d.time).toBeLessThan(30 * 60);
    }
  });

  // Review fixes (ah), 9 Oct 2026 (F2): contained only near a crew working a line; quiet edges without one are inactive.
  it("marks an edge contained only within about 150 m of a crew working a line there, and quiet secured edges inactive", () => {
    const o = SITE_SCENARIO.ignition;
    const m = (p: { lat: number; lon: number }) => ({ x: (p.lon - o.lon) * 111320 * Math.cos((o.lat * Math.PI) / 180), y: (p.lat - o.lat) * 111320 });
    const holding = new Set(["hose_attack", "pump_attack", "peat_soak", "firebreak", "road_line", "mop_up", "hose_laying"]);
    for (const s of SITE_SCENARIO.steps.filter((x) => x.index >= 1)) {
      const crews = Object.keys(s.units).filter((u) => holding.has(s.unitWork[u]?.task ?? "")).map((u) => m(s.units[u]!));
      for (const seg of s.fire.perimeter_current.filter((x) => x.status === "contained")) {
        for (const q of seg.line.slice(1, -1)) expect(crews.some((c) => Math.hypot(c.x - m(q).x, c.y - m(q).y) <= 160), `step ${s.index}`).toBe(true);
      }
    }
    // The origin's rear is held in phase A where VOL1 and KY21 work; the secured sectors go quiet (inactive) from 16:40.
    expect(SITE_SCENARIO.steps.find((c) => c.index === 2)!.fire.perimeter_current.some((x) => x.status === "contained")).toBe(true);
    expect(SITE_SCENARIO.steps.find((c) => c.index === 11)!.fire.perimeter_current.some((x) => x.status === "inactive")).toBe(true);
  });

  it("keeps the scoring label out of the render tree, and states one certainty everywhere", () => {
    const scenario = buildDemoScenario();
    for (const e of scenario.envelopes) {
      const r = toRenderableEnvelope(e);
      expect("accuracy_label" in r).toBe(false);
      expect(r.projectionCertainty).toBe(projectionCertaintyOf(e.certainty));
    }
  });
});
