/**
 * `map:check` hydro part (SPEC/33 §2.3 Water, §5 gate A) on the built map:
 *
 *   uphill    every stream drawn (Kotkanjoki and the brooks, in flow order) sampled every 10 m on the final DEM — at the grid node
 *             nearest each point, so the drawn line is read against the channel floor it lies on — may never rise more
 *             than 0.1 m above the lowest point upstream of it;
 *   orphans   every lake larger than 5 ha has an outlet: a stream that starts on its shore, or the sheet edge (a lake the edge cuts
 *             drains off the sheet);
 *   sinks     no grid cell lower than all eight neighbours outside the lakes and mires (an independent scan, not the generator's
 *             own depression filling);
 *   ends      every brook ends in another stream, a lake or at the sheet edge.
 */

import { fileURLToPath } from "node:url";
import { ELEV, G, GN, HALF_M, LAKE_ID, MIRE } from "../terrain.js";
import { distToLine, lineLength, loadLayers, ringArea, type BuiltLayers, type CheckResult, type P } from "./built-layers.js";

/** Elevation for a stream point: the 20 m grid node nearest it (within 14.2 m, on the channel floor the line is carved into). */
function channelZ(p: P): number {
  const c = Math.max(0, Math.min(GN - 1, Math.round((p.x + HALF_M) / G - 0.5)));
  const r = Math.max(0, Math.min(GN - 1, Math.round((p.y + HALF_M) / G - 0.5)));
  return ELEV[r * GN + c]!;
}

function densify(line: readonly P[], step: number): P[] {
  const out: P[] = [line[0]!];
  for (let k = 0; k + 1 < line.length; k++) {
    const a = line[k]!;
    const b = line[k + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let s = 1; s <= n; s++) out.push({ x: a.x + ((b.x - a.x) * s) / n, y: a.y + ((b.y - a.y) * s) / n });
  }
  return out;
}

/** Stretches of `line` that rise more than `tolM` above the lowest point upstream. */
export function uphillStretches(line: readonly P[], z: (p: P) => number, tolM = 0.1): { at: P; riseM: number }[] {
  const out: { at: P; riseM: number }[] = [];
  let low = Infinity;
  let inRise = false;
  for (const p of densify(line, 10)) {
    const v = z(p);
    if (v > low + tolM) {
      if (!inRise) out.push({ at: p, riseM: v - low });
      inRise = true;
    } else inRise = false;
    low = Math.min(low, v);
  }
  return out;
}

const nearEdge = (p: P, m: number) => Math.abs(p.x) > HALF_M - m || Math.abs(p.y) > HALF_M - m;

export function checkHydro(layers: BuiltLayers = loadLayers()): CheckResult {
  const violations: string[] = [];
  const streams = [...layers.river, ...layers.brooks];
  // Uphill.
  let uphill = 0;
  let worst = 0;
  for (const s of streams) {
    for (const u of uphillStretches(s, channelZ)) {
      uphill++;
      worst = Math.max(worst, u.riseM);
      if (uphill <= 10) violations.push(`uphill stream at (${Math.round(u.at.x)},${Math.round(u.at.y)}): +${u.riseM.toFixed(2)} m`);
    }
  }
  // Lakes without an outlet.
  let lakes5 = 0;
  let orphans = 0;
  for (const ring of layers.water) {
    if (ringArea(ring) < 50_000) continue;
    lakes5++;
    if (ring.some((p) => nearEdge(p, 30))) continue;
    const hasOutlet = streams.some((s) => s.length > 1 && distToLine(s[0]!, ring) < 40 && lineLength(s) > 30);
    if (!hasOutlet) {
      orphans++;
      const c = ring[0]!;
      violations.push(`lake of ${(ringArea(ring) / 10_000).toFixed(1)} ha near (${Math.round(c.x)},${Math.round(c.y)}) has no outlet`);
    }
  }
  // Sinks outside lakes and mires.
  let sinks = 0;
  for (let r = 1; r < GN - 1; r++) for (let c = 1; c < GN - 1; c++) {
    const i = r * GN + c;
    if (LAKE_ID[i]! >= 0 || MIRE[i]) continue;
    const z = ELEV[i]!;
    let lowest = true;
    for (let dr = -1; dr <= 1 && lowest; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && ELEV[i + dr * GN + dc]! <= z) { lowest = false; break; }
    if (lowest) {
      sinks++;
      if (sinks <= 10) violations.push(`sink at (${Math.round(-HALF_M + (c + 0.5) * G)},${Math.round(-HALF_M + (r + 0.5) * G)})`);
    }
  }
  // Brook ends.
  let dangling = 0;
  for (const b of layers.brooks) {
    const end = b[b.length - 1]!;
    const joins = nearEdge(end, 40) || streams.some((s) => s !== b && distToLine(end, s) < 30) || layers.water.some((w) => distToLine(end, w) < 40);
    if (!joins) { dangling++; if (dangling <= 10) violations.push(`brook ends nowhere at (${Math.round(end.x)},${Math.round(end.y)})`); }
  }
  return {
    name: "hydro",
    violations,
    report: [
      ["streams checked", `${streams.length} (${Math.round(streams.reduce((s, l) => s + lineLength(l), 0) / 1000)} km)`],
      ["uphill stretches", `${uphill}${uphill ? ` (worst +${worst.toFixed(2)} m)` : ""}`],
      ["lakes > 5 ha / without outlet", `${lakes5} / ${orphans}`],
      ["sinks outside lakes and mires", `${sinks}`],
      ["brooks ending nowhere", `${dangling}`],
    ],
  };
}

export function printResult(r: CheckResult): void {
  console.log(`map:check — ${r.name}: ${r.violations.length === 0 ? "pass" : `${r.violations.length} violation(s)`}`);
  for (const [k, v] of r.report) console.log(`  ${k.padEnd(40)} ${v}`);
  for (const v of r.violations) console.log(`  VIOLATION ${v}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = checkHydro();
  printResult(r);
  if (r.violations.length > 0) process.exitCode = 1;
}
