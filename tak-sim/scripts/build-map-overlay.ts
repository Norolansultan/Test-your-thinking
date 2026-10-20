/**
 * Writes `app/render/ui/map-overlay.json`: the live map's static reference overlay (SPEC/12 revision (al)) — the
 * 1 km ETRS-TM35FIN grid, the anchor points of the road labels R1/R2/R3, the R3 bridge, the 20 kV power line's
 * label and the command post. Build-time only: every coordinate conversion stays at the bundle-build boundary
 * (SPEC/03 §1.1); the browser reads the JSON. Deterministic (no randomness, fixed rounding).
 *
 * Water points W1–W3, the sectors and the region's other fires are not here: the map reads them from the scenario
 * export (`site-scenario.json` `features`, `sectors`, `regionFires`), which their owners regenerate.
 *
 *   npx tsx scripts/build-map-overlay.ts
 */

import { writeFileSync } from "node:fs";
import { tm35ToWgs84 } from "../tools/fire-ca/tm35.js";
import { IGN_TM35 } from "../tools/topo-map/terrain-base.js";
import { BRIDGE, POWER_LINE } from "../tools/topo-map/terrain.js";
import { COMMAND_POINT, FIXED_ROADS } from "../tools/topo-map/roads.js";

interface P { readonly x: number; readonly y: number }
const round = (v: number) => Math.round(v * 1e6) / 1e6;
/** Site metres (x east, y north of IGN) → WGS84, as `site-export.ts` does. */
const ll = (p: P) => { const q = tm35ToWgs84(IGN_TM35.eastM + p.x, IGN_TM35.northM + p.y); return { lat: round(q.lat), lon: round(q.lon) }; };

/** The polyline's vertex nearest `target` — a label sits on the drawn road, never beside it. */
function onLine(line: readonly P[], target: P): P {
  return line.reduce((a, p) => (Math.hypot(p.x - target.x, p.y - target.y) < Math.hypot(a.x - target.x, a.y - target.y) ? p : a));
}
/** Densify a polyline to ≤ 20 m steps, so `onLine` lands within 10 m of any target on it. */
function dense(line: readonly P[]): P[] {
  const out: P[] = [];
  for (let k = 0; k + 1 < line.length; k++) {
    const a = line[k]!, b = line[k + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 20));
    for (let i = 0; i < n; i++) out.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
  }
  out.push(line[line.length - 1]!);
  return out;
}

// FIXED_ROADS (tools/topo-map/roads.ts): [2] R3 west (maantie → command point), [3] R1, [4] R3 east (over the bridge), [5] R2.
const R3W = dense(FIXED_ROADS[2]!.line), R1 = dense(FIXED_ROADS[3]!.line), R3E = dense(FIXED_ROADS[4]!.line), R2 = dense(FIXED_ROADS[5]!.line);

// Label anchors, chosen well away from the old fire's north edge and from V13's US2 (test/render/map-overlay.spec.ts
// holds them ≥ 600 m from both): R1 between the command post and the ignition's west side; R2 south of the bog;
// R3 south of the command post and east of the bridge.
const roads = [
  { id: "R1", at: ll(onLine(R1, { x: -700, y: 400 })) },
  { id: "R2", at: ll(onLine(R2, { x: 1510, y: -1750 })) },
  { id: "R3", at: ll(onLine(R3W, { x: -1350, y: -900 })) },
  { id: "R3", at: ll(onLine(R3E, { x: 3900, y: 520 })) },
];

// The power line: a straight 45° line through (1500, 0); its label sits 3 km south-west of that, far from the fire.
const [pa, pb] = [POWER_LINE[0]!, POWER_LINE[1]!];
const along = (d: number): P => { const L = Math.hypot(pb.x - pa.x, pb.y - pa.y); const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2; return { x: mx + ((pb.x - pa.x) / L) * d, y: my + ((pb.y - pa.y) / L) * d }; };
const powerLine = { label: "20 kV", at: ll(along(-3000)), towards: ll(along(-2900)) };

// The 1 km grid: TM35 easting and northing lines at whole kilometres, ±13 km about IGN (the pan limit is 12 km), each
// sampled every 2 km (the lines are straight in TM35; the chord error over 2 km is far below a pixel).
const R = 13_000, STEP = 2_000;
const e0 = Math.ceil((IGN_TM35.eastM - R) / 1000) * 1000, e1 = Math.floor((IGN_TM35.eastM + R) / 1000) * 1000;
const n0 = Math.ceil((IGN_TM35.northM - R) / 1000) * 1000, n1 = Math.floor((IGN_TM35.northM + R) / 1000) * 1000;
const samples = (from: number, to: number) => { const out: number[] = []; for (let v = from; v < to; v += STEP) out.push(v); out.push(to); return out; };
const grid: { readonly axis: "E" | "N"; readonly km: number; readonly line: { lat: number; lon: number }[] }[] = [];
for (let e = e0; e <= e1; e += 1000) grid.push({ axis: "E", km: e / 1000, line: samples(n0, n1).map((n) => ll({ x: e - IGN_TM35.eastM, y: n - IGN_TM35.northM })) });
for (let n = n0; n <= n1; n += 1000) grid.push({ axis: "N", km: n / 1000, line: samples(e0, e1).map((e) => ll({ x: e - IGN_TM35.eastM, y: n - IGN_TM35.northM })) });

const out = {
  generatedBy: "npx tsx scripts/build-map-overlay.ts (SPEC/12 revision (al))",
  roads,
  bridge: { fi: "R3:n silta (Kotkanjoki)", at: ll(BRIDGE) },
  commandPost: ll(COMMAND_POINT),
  powerLine,
  grid,
};
writeFileSync("app/render/ui/map-overlay.json", `${JSON.stringify(out)}\n`);
console.log(`map-overlay.json: ${roads.length} road labels, ${grid.length} grid lines`);
