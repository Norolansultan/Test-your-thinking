/**
 * `map:check` realism part (SPEC/33 §2.3, gate A): the landscape statistics a Finnish map reader would notice, measured on the
 * built map, with planning limits the domain reviewer confirms (SPEC/33 §1 c, §5 gate R). Prints a report; a value outside its
 * limit is a violation.
 *
 *   relief        land elevations within ±10 km: 1st–99th percentile inside 58–112 m, total relief 35–80 m
 *   slope         Horn slope histogram; flat (< 2 %) 25–75 % of the land, steep (> 20 %) under 3 %
 *   mires         15–30 % of the land; no mire ≥ 10 ha convex (≥ 0.97: a triangle, ellipse or circle), median convexity ≤ 0.85
 *   fields        every parcel a rectangle (rectangularity ≥ 0.95), 30–170 m wide
 *   forest roads  0.3–1.2 km per km² of land
 *   contours      no set of three or more nested closed contours that are all smooth ellipses (the "concentric ellipses" tell)
 */

import { fileURLToPath } from "node:url";
import { ELEV, G, GN, LAKE_ID, SLOPE } from "../terrain.js";
import { dist, inRing, lineLength, loadLayers, minRectArea, ringArea, RingIndex, shape, type BuiltLayers, type CheckResult, type P, type Ring } from "./built-layers.js";
import { printResult } from "./hydro.js";

export const LIMITS = {
  p1Min: 58, p99Max: 112, reliefMin: 35, reliefMax: 80,
  flatMin: 0.25, flatMax: 0.75, steepMax: 0.03,
  mireMin: 0.15, mireMax: 0.3, mireConvexMax: 0.97, mireMedianConvexityMax: 0.85,
  parcelRectMin: 0.95, parcelWidthMin: 30, parcelWidthMax: 170,
  forestRoadMin: 0.3, forestRoadMax: 1.2,
  ellipseNestMax: 0,
} as const;

const quantile = (sorted: readonly number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))]!;

/** How far a closed ring departs from its moment-equivalent ellipse: the spread of its points' normalised radius (0 = an ellipse). */
export function ellipseResidual(r: Ring): { residual: number; cx: number; cy: number; minor: number } {
  const n = r.length;
  let cx = 0, cy = 0;
  for (const p of r) { cx += p.x; cy += p.y; }
  cx /= n; cy /= n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of r) { const dx = p.x - cx; const dy = p.y - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  sxx /= n; syy /= n; sxy /= n;
  const tr = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l2 = tr / 2 - Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  // Points on an ellipse's outline have second moments a²/2, b²/2 along its axes.
  const a = Math.sqrt(2 * l1);
  const b = Math.sqrt(2 * Math.max(l2, 1e-9));
  const rs = r.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const u = dx * Math.cos(th) + dy * Math.sin(th);
    const v = -dx * Math.sin(th) + dy * Math.cos(th);
    return Math.hypot(u / a, v / b);
  });
  const mean = rs.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(rs.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  return { residual: sd / mean, cx, cy, minor: b };
}

export function checkRealism(layers: BuiltLayers = loadLayers()): CheckResult {
  const violations: string[] = [];
  const report: [string, string][] = [];
  // Relief and slope (land cells of the final 20 m DEM).
  const z: number[] = [];
  const bins = [0, 0, 0, 0, 0];
  for (let i = 0; i < GN * GN; i++) {
    if (LAKE_ID[i]! >= 0) continue;
    z.push(ELEV[i]!);
    const s = SLOPE[i]! * 100;
    bins[s < 2 ? 0 : s < 5 ? 1 : s < 10 ? 2 : s < 20 ? 3 : 4]!++;
  }
  z.sort((a, b) => a - b);
  const land = z.length;
  const [p1, p50, p99] = [quantile(z, 0.01), quantile(z, 0.5), quantile(z, 0.99)];
  const relief = z[z.length - 1]! - z[0]!;
  report.push(["relief (m): min / p1 / median / p99 / max", `${z[0]!.toFixed(1)} / ${p1.toFixed(1)} / ${p50.toFixed(1)} / ${p99.toFixed(1)} / ${z[z.length - 1]!.toFixed(1)} (range ${relief.toFixed(1)})`]);
  if (p1 < LIMITS.p1Min || p99 > LIMITS.p99Max) violations.push(`elevations p1–p99 ${p1.toFixed(1)}–${p99.toFixed(1)} m outside ${LIMITS.p1Min}–${LIMITS.p99Max} m`);
  if (relief < LIMITS.reliefMin || relief > LIMITS.reliefMax) violations.push(`relief ${relief.toFixed(1)} m outside ${LIMITS.reliefMin}–${LIMITS.reliefMax} m`);
  const share = bins.map((b) => b / land);
  report.push(["slope histogram (<2 / 2–5 / 5–10 / 10–20 / >20 %)", share.map((s) => `${(s * 100).toFixed(1)}%`).join(" / ")]);
  if (share[0]! < LIMITS.flatMin || share[0]! > LIMITS.flatMax) violations.push(`flat ground (< 2 %) ${(share[0]! * 100).toFixed(1)} % outside ${LIMITS.flatMin * 100}–${LIMITS.flatMax * 100} %`);
  if (share[4]! > LIMITS.steepMax) violations.push(`steep ground (> 20 %) ${(share[4]! * 100).toFixed(1)} % over ${LIMITS.steepMax * 100} %`);
  // Mires.
  const landArea = land * G * G;
  const mireRings = [...layers.mires.open, ...layers.mires.pine, ...layers.mires.drained];
  // Share by a 50 m lattice: on a mire ring, not on a firm island inside one, not in a lake (rings of different classes overlap).
  const onMire = new RingIndex(mireRings);
  const firm = new RingIndex(layers.mires.islands);
  const lake = new RingIndex(layers.water);
  let latticeLand = 0;
  let latticeMire = 0;
  for (let y = -9975; y < 10_000; y += 50) for (let x = -9975; x < 10_000; x += 50) {
    const p = { x, y };
    if (lake.contains(p)) continue;
    latticeLand++;
    if (onMire.contains(p) && !firm.contains(p)) latticeMire++;
  }
  const mireShare = latticeMire / latticeLand;
  report.push(["mire share of land", `${(mireShare * 100).toFixed(1)} % (open ${(layers.mires.open.reduce((s, r) => s + ringArea(r), 0) / landArea * 100).toFixed(1)}, pine ${(layers.mires.pine.reduce((s, r) => s + ringArea(r), 0) / landArea * 100).toFixed(1)}, drained ${(layers.mires.drained.reduce((s, r) => s + ringArea(r), 0) / landArea * 100).toFixed(1)})`]);
  if (mireShare < LIMITS.mireMin || mireShare > LIMITS.mireMax) violations.push(`mire share ${(mireShare * 100).toFixed(1)} % outside ${LIMITS.mireMin * 100}–${LIMITS.mireMax * 100} %`);
  const big = mireRings.filter((r) => ringArea(r) >= 50_000).map(shape);
  const conv = big.map((s) => s.convexity).sort((a, b) => a - b);
  const comp = big.map((s) => s.compactness).sort((a, b) => a - b);
  report.push(["mires ≥ 5 ha: n, median compactness / convexity", `${big.length}, ${quantile(comp, 0.5).toFixed(2)} / ${quantile(conv, 0.5).toFixed(2)} (max convexity ${conv.length ? conv[conv.length - 1]!.toFixed(2) : "–"})`]);
  for (const s of big) if (s.area >= 100_000 && s.convexity >= LIMITS.mireConvexMax) violations.push(`a ${(s.area / 10_000).toFixed(0)} ha mire is convex (${s.convexity.toFixed(2)}): a geometric shape, not a lobed mire`);
  if (conv.length > 0 && quantile(conv, 0.5) > LIMITS.mireMedianConvexityMax) violations.push(`median mire convexity ${quantile(conv, 0.5).toFixed(2)} over ${LIMITS.mireMedianConvexityMax}`);
  // Field parcels.
  const parcels = layers.parcels.map((r) => {
    const rect = minRectArea(r);
    const sides = [dist(r[0]!, r[1]!), dist(r[1]!, r[2]!)].sort((a, b) => a - b);
    return { rect: rect > 0 ? ringArea(r) / rect : 0, w: sides[0]!, l: sides[1]! };
  });
  const fieldArea = layers.fields.reduce((s, r) => s + ringArea(r), 0);
  report.push(["field parcels: n, area, min rectangularity, width range", `${parcels.length}, ${(fieldArea / 10_000).toFixed(0)} ha (${((fieldArea / landArea) * 100).toFixed(1)} % of land), ${parcels.length ? Math.min(...parcels.map((p) => p.rect)).toFixed(3) : "–"}, ${parcels.length ? `${Math.round(Math.min(...parcels.map((p) => p.w)))}–${Math.round(Math.max(...parcels.map((p) => p.w)))} m` : "–"}`]);
  for (const p of parcels) if (p.rect < LIMITS.parcelRectMin || p.w < LIMITS.parcelWidthMin || p.w > LIMITS.parcelWidthMax) { violations.push(`field parcel ${Math.round(p.w)} × ${Math.round(p.l)} m (rectangularity ${p.rect.toFixed(2)}) outside the limits`); break; }
  // Road density.
  const km = (cls: string, near?: number) => layers.roads.filter((r) => r.cls === cls).reduce((s, r) => s + r.line.reduce((t, q, k) => (k && (near === undefined || Math.hypot(q.x, q.y) < near) ? t + dist(q, r.line[k - 1]!) : t), 0), 0) / 1000;
  const landKm2 = landArea / 1e6;
  const forestDensity = km("forest") / landKm2;
  report.push(["road density (km/km² of land): forest / gravel / track", `${forestDensity.toFixed(2)} / ${(km("gravel") / landKm2).toFixed(2)} / ${(km("track") / landKm2).toFixed(2)}`]);
  report.push(["within 3 km of IGN: forest + gravel (km/km²)", `${((km("forest", 3000) + km("gravel", 3000)) / (Math.PI * 9)).toFixed(2)}`]);
  if (forestDensity < LIMITS.forestRoadMin || forestDensity > LIMITS.forestRoadMax) violations.push(`forest-road density ${forestDensity.toFixed(2)} km/km² outside ${LIMITS.forestRoadMin}–${LIMITS.forestRoadMax}`);
  // Contour shapes.
  const closed = layers.contours.filter((c) => !c.aux && c.pts.length > 8 && dist(c.pts[0]!, c.pts[c.pts.length - 1]!) < 12 && ringArea(c.pts) > 10_000);
  const smooth = closed.map((c) => ({ c, e: ellipseResidual(c.pts) })).filter(({ e }) => e.residual < 0.035);
  let nests = 0;
  for (const s of smooth) {
    const around = smooth.filter((o) => o !== s && Math.hypot(o.e.cx - s.e.cx, o.e.cy - s.e.cy) < 0.25 * Math.max(s.e.minor, 20) && inRing({ x: s.e.cx, y: s.e.cy }, o.c.pts));
    if (around.length >= 2 && around.every((o) => ringArea(o.c.pts) > ringArea(s.c.pts))) {
      nests++;
      violations.push(`concentric elliptical contours around (${Math.round(s.e.cx)},${Math.round(s.e.cy)})`);
    }
  }
  report.push(["contours: 5 m lines / closed ≥ 1 ha / smooth ellipses / concentric nests", `${layers.contours.filter((c) => !c.aux).length} / ${closed.length} / ${smooth.length} / ${nests}`]);
  const streamKm = [...layers.river, ...layers.brooks].reduce((s, l) => s + lineLength(l), 0) / 1000;
  const ditchKm = layers.ditches.reduce((s, d) => s + lineLength(d.line), 0) / 1000;
  report.push(["streams / ditches (km per km² of land)", `${(streamKm / landKm2).toFixed(2)} / ${(ditchKm / landKm2).toFixed(2)}`]);
  const lakeArea = layers.water.reduce((s, r) => s + ringArea(r), 0);
  report.push(["lakes (share of the sheet)", `${layers.water.length} polygons, ${((lakeArea / 4e8) * 100).toFixed(1)} %`]);
  return { name: "realism", violations, report };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = checkRealism();
  printResult(r);
  if (r.violations.length > 0) process.exitCode = 1;
}
export type { P };
