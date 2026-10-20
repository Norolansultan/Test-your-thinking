/**
 * TEMPLATE SITE — not a real place. SPEC/23, SPEC/24 §4.
 *
 * A synthetic fuel grid laid out from the SPEC/18 §5 feature table (bearings and distances from
 * the ignition point), so the CA can be exercised before the real site is chosen. After the site
 * search (SPEC/23) this is replaced by rasters exported from QGIS (Metsäkeskus stand data, MML
 * topography, Syke peatland) through `loadAsciiGrid` in `ascii-grid.ts`.
 *
 * The fuel classes and their p_veg / p_den values are a PROPOSED mapping of Finnish fuels onto
 * the Alexandridis (2008) categories (agricultural −0.3, thickets 0, pine 0.4; sparse −0.4,
 * normal 0, dense 0.3), pending the domain reviewer (SPEC/11 §1.2).
 */

import type { LatLon } from "../../app/engine/primitives.js";
import { Xorshift64Star } from "../../app/engine/prng.js";
import type { GridFrame } from "./geometry.js";
import type { FuelClass, FuelGrid } from "./model.js";
import type { SiteModel } from "./run.js";

export const FUEL_CLASSES: readonly FuelClass[] = [
  { id: "water", labelFi: "Vesi", burnable: false, pVeg: 0, pDen: 0 },
  // Linear breaks (SPEC/24 §12): crossed at the full rate only by a head fire in a strong (gust) wind.
  { id: "road_gravel", labelFi: "Soratie", burnable: true, pVeg: -0.7, pDen: -0.4, barrier: { minWindMs: 9, headArcDeg: 45, leak: 0.01 } },
  { id: "field", labelFi: "Pelto", burnable: true, pVeg: -0.3, pDen: -0.4 },
  { id: "pine_heath", labelFi: "Kuivahko mänty", burnable: true, pVeg: 0.4, pDen: 0 },
  { id: "spruce_mature", labelFi: "Varttunut kuusikko (harventamaton)", burnable: true, pVeg: 0.4, pDen: 0.3 },
  { id: "spruce_thinned", labelFi: "Kuusikko (harvennettu)", burnable: true, pVeg: 0.4, pDen: -0.4 },
  { id: "birch_aspen", labelFi: "Koivu–haapa", burnable: true, pVeg: -0.3, pDen: 0 },
  // Drained pine mire: pine-dominated and dry in drought, sparse stand (SPEC/18 §7 cycle 14:
  // "dry pine between ditches"). Deep peat burning is authored, not modelled (categoricalBasis "depth").
  { id: "drained_peat", labelFi: "Ojitettu turvemaa (mänty)", burnable: true, pVeg: 0.4, pDen: -0.4 },
  { id: "cleared_corridor", labelFi: "Raivattu käytävä", burnable: true, pVeg: -0.3, pDen: -0.4 },
  { id: "built", labelFi: "Rakennettu", burnable: false, pVeg: 0, pDen: 0 },
  // Open (treeless) bog: burns only as a sparse surface fire. Appended so existing indices hold.
  { id: "open_bog", labelFi: "Avosuo", burnable: true, pVeg: -0.3, pDen: -0.4 },
  // A 4–5 m forest road and a 1–3 m brook with wet banks: weaker breaks than a gravel road.
  { id: "road_forest", labelFi: "Metsäautotie", burnable: true, pVeg: -0.5, pDen: -0.4, barrier: { minWindMs: 7, headArcDeg: 60, leak: 0.02 } },
  { id: "brook", labelFi: "Puro", burnable: true, pVeg: -0.5, pDen: 0, barrier: { minWindMs: 6, headArcDeg: 60, leak: 0.03 } },
];

const F = (id: string): number => {
  const i = FUEL_CLASSES.findIndex((c) => c.id === id);
  if (i < 0) throw new Error(`unknown fuel class ${id}`);
  return i;
};

/** Placeholder geographic anchor for the template (SPEC/18 §2's approximate ignition point). */
const TEMPLATE_IGNITION: LatLon = { lat: 60.9, lon: 27.35 };

export function buildTemplateSite(cellSizeM = 25, sizeM = 8000): SiteModel {
  const n = Math.round(sizeM / cellSizeM);
  const ignitionM = { eastM: sizeM / 2, northM: sizeM / 2 };
  const originLat = TEMPLATE_IGNITION.lat - ignitionM.northM / 111_320;
  const originLon = TEMPLATE_IGNITION.lon - ignitionM.eastM / (111_320 * Math.cos((TEMPLATE_IGNITION.lat * Math.PI) / 180));
  const frame: GridFrame = { origin: { lat: originLat, lon: originLon }, cols: n, rows: n, cellSizeM };

  const truth = new Uint8Array(n * n);
  const machine = new Uint8Array(n * n);
  const elevation = new Float32Array(n * n);
  const rng = new Xorshift64Star(0x5eed_2008n);

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const x = (c + 0.5) * cellSizeM - ignitionM.eastM; // metres east of IGN
      const y = (r + 0.5) * cellSizeM - ignitionM.northM; // metres north of IGN
      const d = Math.hypot(x, y);
      let b = (Math.atan2(x, y) * 180) / Math.PI;
      if (b < 0) b += 360;
      const near = (bx: number, by: number, rad: number) => Math.hypot(x - bx, y - by) <= rad;
      const polar = (bearing: number, dist: number) => {
        const t = (bearing * Math.PI) / 180;
        return [Math.sin(t) * dist, Math.cos(t) * dist] as const;
      };
      const lineDist = (px: number, py: number, bearing: number) => {
        const t = (bearing * Math.PI) / 180;
        return Math.abs((x - px) * Math.cos(t) - (y - py) * Math.sin(t));
      };

      // Background: managed boreal mosaic, pine-dominated with spruce patches (deterministic).
      let fuel = rng.nextFloat() < 0.12 ? F("spruce_mature") : F("pine_heath");
      let staleFuel = fuel;

      // BOG-S — drained, ditched peatland, 0.6–1.8 km S/SE.
      if (d >= 600 && d <= 1800 && b >= 135 && b <= 200) fuel = staleFuel = F("drained_peat");
      // VALLEY-N — wet valley north of R1, 1–2 km N.
      if (y >= 1000 && y <= 2000 && Math.abs(x) <= 900) fuel = staleFuel = F("birch_aspen");
      // RIDGE — lichen-heath esker, 0.8–1.2 km NE; raised 15 m.
      if (d >= 800 && d <= 1200 && b >= 25 && b <= 65) {
        fuel = staleFuel = F("pine_heath");
        elevation[i] = 15 * Math.exp(-(((d - 1000) / 180) ** 2));
      }
      // SPR — mature unthinned spruce 1.3–2.2 km NE; the stand data says thinned (M3).
      if (d >= 1300 && d <= 2200 && b >= 25 && b <= 70) {
        fuel = F("spruce_mature");
        staleFuel = F("spruce_thinned");
      }
      // BIRCH — birch–aspen strip along a brook at 2.3 km NE.
      if (d >= 2250 && d <= 2450 && b >= 15 && b <= 80) fuel = staleFuel = F("birch_aspen");
      // PL — power line NE–SW through a point 1.5 km E (the template keeps the old 36 m corridor; the generated site's line is a 20 kV
      // distribution line with a ~10 m corridor since SPEC/33 (bc)).
      if (lineDist(1500, 0, 45) <= 18) fuel = staleFuel = F("cleared_corridor");
      // VILLAGE-E — fields and houses 3.5–4 km SE.
      const [vx, vy] = polar(135, 3750);
      if (near(vx, vy, 600)) fuel = staleFuel = F("field");
      if (near(vx, vy, 140)) fuel = staleFuel = F("built");
      // POND 1.5 km NW, LAKE-N 2.5 km NW.
      const [px, py] = polar(315, 1500);
      if (near(px, py, 150)) fuel = staleFuel = F("water");
      const [lx, ly] = polar(320, 2500);
      if (near(lx, ly, 420)) fuel = staleFuel = F("water");
      // Roads: R1 E–W 400 m N; R2 N–S along the east side, crossing BOG-S's east edge.
      if (Math.abs(y - 400) <= 12) fuel = staleFuel = F("road_gravel");
      if (Math.abs(x - 1500) <= 12 && y >= -2200 && y <= 1000) fuel = staleFuel = F("road_gravel");

      truth[i] = fuel;
      machine[i] = staleFuel;
    }
  }

  const grid = (fuel: Uint8Array): FuelGrid => ({ cols: n, rows: n, cellSizeM, fuel, classes: FUEL_CLASSES, elevationM: elevation });
  return {
    name: "template (SPEC/18 §5 layout, not a real place)",
    frame,
    truthFuel: grid(truth),
    machineFuel: grid(machine),
    ignitionM,
    referenceFuelId: "pine_heath",
  };
}
