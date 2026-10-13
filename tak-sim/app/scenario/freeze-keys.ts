/**
 * The freeze items' computed answer keys (SPEC/08 amendment 2 Oct 2026, the goal-based bank in
 * `freeze-bank.ts`). TRUTH: scoring only. Every function reads the frozen CA bundle
 * (`site-scenario.json`); none depends on anything the participant does, so — under the
 * identical-stimulus rule — the "future" an L3 item asks about is fixed for everyone.
 *
 * Geometry is a local equirectangular projection about the site's latitude (metres east and
 * north of a fixed origin). Over the site's 7 × 7 km extent its distance error is far below a
 * map_point tolerance (< 0.1 %), and it needs no projection library in the browser.
 *
 * Rules, by construct (each documented at its function):
 * - the head NOW: the observed head the map draws (`observedHead.anchor` of the view's map step);
 * - the head at a LATER clock: the vertex of the CA truth perimeter (main and detached fronts) at
 *   that step's end that lies furthest along the next step's observed spread bearing (it matches
 *   the next step's observed head to within ~40 m on every step);
 * - the unit nearest the head: by distance to the observed head (fix pass 3: replaces "ahead of the
 *   head", which the crews' side-of-the-head reports, judged from the wind, contradicted);
 * - nearest settlement, distance bands, growth trends and the first-detached sector: below.
 */

import type { LatLon, Polygon } from "../engine/primitives.js";
import { SITE_SCENARIO, type SiteStep } from "./site-scenario.js";

const LAT0 = 60.85;
const LON0 = 27.35;
const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LON = 111_320 * Math.cos((LAT0 * Math.PI) / 180);

interface XY { readonly x: number; readonly y: number }
const toXY = (p: LatLon): XY => ({ x: (p.lon - LON0) * M_PER_DEG_LON, y: (p.lat - LAT0) * M_PER_DEG_LAT });
const fromXY = (p: XY): LatLon => ({ lat: LAT0 + p.y / M_PER_DEG_LAT, lon: LON0 + p.x / M_PER_DEG_LON });

/** Distance in metres. */
export function distanceM(a: LatLon, b: LatLon): number {
  const A = toXY(a), B = toXY(b);
  return Math.hypot(A.x - B.x, A.y - B.y);
}

/** Compass bearing from a to b, degrees clockwise from north, in [0, 360). */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const A = toXY(a), B = toXY(b);
  const deg = (Math.atan2(B.x - A.x, B.y - A.y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Signed distance of p along, and across (to the right of), a bearing from an origin. */
function alongAcross(p: LatLon, origin: LatLon, brgDeg: number): { along: number; across: number } {
  const P = toXY(p), O = toXY(origin);
  const r = (brgDeg * Math.PI) / 180;
  const dx = P.x - O.x, dy = P.y - O.y;
  return { along: dx * Math.sin(r) + dy * Math.cos(r), across: dx * Math.cos(r) - dy * Math.sin(r) };
}

function inRing(p: LatLon, ring: readonly LatLon[]): boolean {
  const P = toXY(p);
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = toXY(ring[i]!), b = toXY(ring[j]!);
    if (a.y > P.y !== b.y > P.y && P.x < ((b.x - a.x) * (P.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function inPolygon(p: LatLon, poly: Polygon): boolean {
  return inRing(p, poly[0]!) && !poly.slice(1).some((hole) => inRing(p, hole));
}

/** The vertex centroid of a polygon's outer ring (enough for a front a few hundred metres wide). */
export function centroid(poly: Polygon): LatLon {
  const ring = poly[0]!;
  const pts = ring.slice(0, -1).map(toXY);
  return fromXY({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });
}

export function siteStep(step: number): SiteStep {
  const s = SITE_SCENARIO.steps.find((x) => x.index === step);
  if (!s) throw new RangeError(`the bundle has no step ${step}`);
  return s;
}

const vertices = (polys: readonly Polygon[]): LatLon[] => polys.flatMap((p) => p[0]!.slice(0, -1));
const truthPolys = (s: SiteStep): Polygon[] => [s.truthAtEnd, ...s.truthDetached];
const reportedPolys = (s: SiteStep): Polygon[] => [s.reported, ...s.reportedDetached];

/**
 * TRUTH: the id of the first generated traffic record of `step` whose content matches `re`. Generated ids
 * (evt.cNN.MMM) shift whenever the traffic is regenerated, so key atoms are found by content (3 Oct 2026); a key
 * whose record no longer exists fails the build instead of silently pointing at another message.
 */
export function trafficId(step: number, re: RegExp): string {
  const e = SITE_SCENARIO.traffic.find((x) => x.cycle === step && re.test(x.content));
  if (!e) throw new Error(`freeze key: no step-${step} traffic record matches ${re}`);
  return e.id;
}

/**
 * TRUTH: the id of the first crew radio record of `step` (`atom.radio.<step>.<k>`) whose text matches `re`.
 * The index k shifts whenever the radio is regenerated (6 Oct 2026: V14's road item pointed at two
 * unrelated messages after the phase-B rebuild), so, as for `trafficId`, the record is found by content.
 */
export function radioId(step: number, re: RegExp): string {
  const k = SITE_SCENARIO.radio.filter((r) => r.cycle === step).findIndex((r) => re.test(r.text));
  if (k < 0) throw new Error(`freeze key: no step-${step} radio record matches ${re}`);
  return `atom.radio.${step}.${k}`;
}

/**
 * TRUTH, analysis only (revision (x), 6 Oct 2026): where view `view`'s projection puts the head at the END of
 * `step` — the vertex of the view's isochrone for that clock (its main part; the isochrones are at ½, 1 and
 * 1½ of the horizon, from the view's start) furthest along the head bearing observed at the view's start,
 * the same rule `truthHeadAtEndOf` applies to the truth. Throws when the view has no isochrone for that clock.
 */
export function projectionHeadAtEndOf(view: number, step: number): LatLon {
  const v = SITE_SCENARIO.views.find((x) => x.index === view);
  if (!v) throw new RangeError(`the bundle has no view ${view}`);
  const minutes = (step - v.steps[0]! + 1) * 20;
  const iso = v.isochrones.find((i) => i.minutes === minutes);
  if (!iso) throw new RangeError(`V${view} has no ${minutes}-minute isochrone (its are ${v.isochrones.map((i) => i.minutes).join(", ")})`);
  const { anchor, bearingDeg } = siteStep(v.steps[0]!).observedHead;
  let best = anchor;
  let bestAlong = -Infinity;
  // Every part of the isochrone (revision (aj): the projection grown from a rekindled front is traced as a part of its own, sharing the old edge).
  for (const p of vertices([iso.polygon, ...iso.detachedParts])) {
    const { along } = alongAcross(p, anchor, bearingDeg);
    if (along > bestAlong) { bestAlong = along; best = p; }
  }
  return best;
}

/** The head the map shows during a step: its observed head at the step's start. */
export function headNow(step: number): LatLon {
  return siteStep(step).observedHead.anchor;
}

/** Area of a polygon's outer ring, in hectares (local projection). */
export function areaHa(poly: Polygon): number {
  const r = poly[0]!.map(toXY);
  let a = 0;
  for (let i = 0; i + 1 < r.length; i++) a += r[i]!.x * r[i + 1]!.y - r[i + 1]!.x * r[i]!.y;
  return Math.abs(a / 2) / 10_000;
}

/** A detached part this small is a spot fire, not a front (the crown run's spots are under 2 ha; phase B's fronts 10 ha and more). */
const SPOT_MAX_HA = 2;

/** The part of the CA fire at the end of `step` (main or detached) nearest a point. */
function partNearest(step: number, p: LatLon): Polygon {
  const near = (poly: Polygon) => (inPolygon(p, poly) ? 0 : Math.min(...poly[0]!.map((v) => distanceM(v, p))));
  return truthPolys(siteStep(step)).reduce((a, b) => (near(b) < near(a) ? b : a));
}

/**
 * TRUTH: the head of the CA's live front at the END of `step` — the head the next report shows, unless that head
 * is a spot fire leading the live front (a part under `SPOT_MAX_HA` beyond the live front's reach along the spread
 * bearing); then, and for the last step, the vertex of the live front (the part the head the map shows lies on)
 * furthest along the next (else this) step's spread bearing.
 */
export function truthHeadAtEndOf(step: number): LatLon {
  const s = siteStep(step);
  const next = SITE_SCENARIO.steps.find((x) => x.index === step + 1);
  const brg = (next ?? s).observedHead.bearingDeg;
  const origin = s.observedHead.anchor;
  // 8 Oct 2026: the live front, not `truthAtEnd`: after the researcher's fire-model change the south-east front is a part of
  // its own from 18:00, apart from the held 133 ha fire, so keying `truthAtEnd` put V12's and V14's heads on the dead fire.
  const live = partNearest(step, origin);
  let best: LatLon | null = null;
  let bestAlong = -Infinity;
  for (const v of vertices([live])) {
    const { along } = alongAcross(v, origin, brg);
    if (along > bestAlong) { bestAlong = along; best = v; }
  }
  // The next report's head is the CA's head at this step's end, as the next map shows it (6 Oct 2026: the furthest
  // vertex along the heading was 71 m from it at 19:20, an older cell of the same part beyond the live front).
  // Fix pass 2 (7 Oct 2026, P1-4): except a spot fire leading the front — at 15:40 the next head is a crown-run
  // spot fire ~590 m beyond it, so V5's head_later keyed a detached part outside every isochrone.
  if (next) {
    const head = next.observedHead.anchor;
    const on = partNearest(step, head);
    if (on === live || areaHa(on) >= SPOT_MAX_HA || alongAcross(head, origin, brg).along <= bestAlong) return head;
  }
  return best!;
}

/** The candidate ground units at the step's positions, nearest the step's observed head first, with their distances in metres. */
export function unitsByDistanceToHead(step: number, candidates: readonly string[]): { readonly unit: string; readonly m: number }[] {
  const s = siteStep(step);
  return candidates.filter((u) => s.units[u]).map((u) => ({ unit: u, m: distanceM(s.units[u]!, s.observedHead.anchor) })).sort((a, b) => a.m - b.m);
}

/** Shortest distance from a point to the fire the map shows during `step` (reported perimeter and detached fronts), in metres. */
export function distanceToReportedM(step: number, p: LatLon): number {
  return Math.min(...vertices(reportedPolys(siteStep(step))).map((v) => distanceM(v, p)));
}

/** TRUTH: shortest distance from a point to the CA fire at the end of `step`, in metres. */
export function distanceToTruthM(step: number, p: LatLon): number {
  return Math.min(...vertices(truthPolys(siteStep(step))).map((v) => distanceM(v, p)));
}

/** Point-to-polyline distance, in metres. */
export function distanceToLineM(p: LatLon, line: readonly LatLon[]): number {
  const P = toXY(p);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = toXY(line[i - 1]!), b = toXY(line[i]!);
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((P.x - a.x) * dx + (P.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(P.x - (a.x + t * dx), P.y - (a.y + t * dy)));
  }
  return best;
}

/** Road R1 as the bundle's three R1 features, west to east (the road runs east–west along ~60.8525° N). */
export const R1_LINE: readonly LatLon[] = [SITE_SCENARIO.features["R1_W"]!, SITE_SCENARIO.features["R1_MID"]!, SITE_SCENARIO.features["R1_R2"]!];

/** Which of the settlements (feature keys) is nearest the fire the map shows during `step`. */
export function nearestSettlement(step: number, features: readonly string[]): string {
  return [...features].sort((a, b) => distanceToReportedM(step, SITE_SCENARIO.features[a]!) - distanceToReportedM(step, SITE_SCENARIO.features[b]!))[0]!;
}

/** The sector (id) a point lies in, or null. */
export function sectorOf(p: LatLon): string | null {
  return SITE_SCENARIO.sectors.find((s) => inPolygon(p, s.geometry))?.id ?? null;
}

/**
 * The sector a point lies in, or else the nearest one (by its nearest vertex): the sectors leave
 * small gaps at the fire's origin, where L3, L4 and the burnt area meet (2 Oct 2026: the rekindle
 * flares up there).
 */
export function nearestSectorOf(p: LatLon): string | null {
  const inside = sectorOf(p);
  if (inside) return inside;
  const m = 111_320, ml = m * Math.cos((p.lat * Math.PI) / 180);
  const dist = (q: LatLon) => Math.hypot((q.lat - p.lat) * m, (q.lon - p.lon) * ml);
  const near = SITE_SCENARIO.sectors.map((s) => ({ id: s.id, d: Math.min(...s.geometry.flatMap((ring) => ring.map(dist))) })).sort((x, y) => x.d - y.d)[0];
  return near?.id ?? null;
}

/** TRUTH: the first step after `afterStep` whose CA truth has a detached front, and that front's sector (by its centroid). */
export function firstDetachedFrontAfter(afterStep: number): { step: number; sector: string | null; centroid: LatLon } | null {
  for (const s of SITE_SCENARIO.steps) {
    if (s.index <= afterStep || s.truthDetached.length === 0) continue;
    const c = centroid(s.truthDetached[0]!);
    return { step: s.index, sector: nearestSectorOf(c), centroid: c };
  }
  return null;
}

/** The fire's area growth over a main step (2–20), in hectares (truth areas at step ends, `areaHa`). */
export function growthHa(step: number): number {
  if (step < 2) throw new RangeError(`no growth for step ${step}: the bundle has no step before it`);
  return siteStep(step).areaHa - siteStep(step - 1).areaHa;
}

/**
 * TRUTH: the next step's growth against this step's: "more" above 1.25×, "less" below 0.8×,
 * "same" between, "none" if the fire does not grow at all.
 */
export function growthTrend(step: number): "more" | "less" | "same" | "none" {
  const now = growthHa(step), next = growthHa(step + 1);
  if (next <= 0.05) return "none";
  if (next > now * 1.25) return "more";
  if (next < now * 0.8) return "less";
  return "same";
}

/**
 * TRUTH: the head's achieved rate over the next step against this step's (`headRos.achievedMpm`):
 * "slows" below half, "faster" above 1.5×, "same" between.
 */
export function headRateTrend(step: number): "slows" | "same" | "faster" {
  const now = siteStep(step).headRos.achievedMpm, next = siteStep(step + 1).headRos.achievedMpm;
  if (next < now * 0.5) return "slows";
  if (next > now * 1.5) return "faster";
  return "same";
}

/**
 * TRUTH: the band a value falls in, given ascending inner edges (`ids` has one more entry than `edges`), and its
 * margin to the nearest edge. Throws when the margin is below `minMargin`, so a close call is never keyed
 * (fix pass 5, 8 Oct 2026: the projection items' bands).
 */
export function bandOf(value: number, edges: readonly number[], ids: readonly string[], minMargin: number, what: string): { readonly id: string; readonly margin: number } {
  if (ids.length !== edges.length + 1) throw new Error(`freeze key ${what}: ${ids.length} ids for ${edges.length} edges`);
  const i = edges.filter((e) => value >= e).length;
  const margin = Math.min(...edges.map((e) => Math.abs(value - e)));
  if (margin < minMargin) throw new Error(`freeze key ${what}: ${value.toFixed(1)} lies ${margin.toFixed(1)} from a band edge (< ${minMargin})`);
  return { id: ids[i]!, margin };
}

/** Service road R2 as the bundle's R2 features, north to south. */
export const R2_LINE: readonly LatLon[] = ["R1_R2", "R2_BOG", "R2_FR", "R2_MID", "R2_S"].map((k) => SITE_SCENARIO.features[k]!);

/** TRUTH: the shortest distance from the CA's first detached front at the end of `step` to a polyline, in metres. */
export function detachedFrontToLineM(step: number, line: readonly LatLon[]): number {
  const front = siteStep(step).truthDetached[0];
  if (!front) throw new RangeError(`step ${step} has no detached front`);
  return Math.min(...front[0]!.map((v) => distanceToLineM(v, line)));
}

/**
 * TRUTH: the shortest distance from the CA's live front at the end of `step` (the part nearest the step's observed head: the
 * south-east front from 18:00, apart from the held fire) to a polyline, in metres (fix pass 5, 8 Oct 2026: V14's R2 item).
 */
export function liveFrontToLineM(step: number, line: readonly LatLon[]): number {
  const live = partNearest(step, siteStep(step).observedHead.anchor);
  return Math.min(...live[0]!.map((v) => distanceToLineM(v, line)));
}

/** The four cardinal directions an answer can name, and the bearing each stands for. */
export const CARDINALS = { north: 0, east: 90, south: 180, west: 270 } as const;
export type Cardinal = keyof typeof CARDINALS;

/** The cardinal a bearing falls nearest, or null if it is within 15° of the midpoint between two (ambiguous). */
export function cardinalOf(brg: number): Cardinal | null {
  const off = ((brg % 90) + 90) % 90;
  if (off > 30 && off < 60) return null;
  const idx = Math.round(brg / 90) % 4;
  return (["north", "east", "south", "west"] as const)[idx]!;
}

/** The units within `radiusM` of a feature at the step's positions. */
export function unitsNear(step: number, feature: string, radiusM: number): string[] {
  const s = siteStep(step);
  const f = SITE_SCENARIO.features[feature]!;
  return SITE_SCENARIO.units.map((u) => u.id).filter((u) => s.units[u] && distanceM(s.units[u]!, f) <= radiusM).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// ---------------------------------------------------------------------------
// REPORT-keyed numeric L3 keys (fix pass 6, D4, researcher decision 8 Oct 2026). A numeric projection item is keyed on what the
// reports DELIVERED by the freeze imply at the asked clock, not on the CA's later truth (which the reports lag, and which a participant
// cannot know). Map and direction items stay truth-keyed.
//
// The delivered report series is the map's reported fire (`SiteStep.reported` and `reportedDetached`, the Tilannekuva fire layer: what the
// DR3 ring surveys and the other reports draw) at the START of each step up to the freeze's now step, which is the clock on screen.
// It is one point per 20 minutes, with no gaps (the text figures of the surveys are not: V10's last two ring surveys are two hours apart).
// The formula, for every item: the line through the reports of the last two steps (nowStep - 1 and nowStep),
//     v(t) = v(now) + (v(now) - v(now - 1)) * (t - now) / 20 min,
// read at the asked clock t, the end of the asked step (`askedClockMin`). The area, the growth over the next 20 minutes (that slope
// itself) and the distance of the reported fire to a point or a polyline are read this way. A front the map shows for the first time
// at the now step has no earlier report: its distance is its reported distance now less the delivered head rate (`observedHead.rateMpm`
// of the now step) times the minutes to the asked clock, the front taken as closing straight on the line (`reportedDetachedClosingAt`).
// ---------------------------------------------------------------------------

/** Minutes after midnight at the START of `step` (step 1 starts 13:20): the clock the freeze shows when `step` is its now step. */
export const stepStartMin = (step: number): number => 13 * 60 + 20 + (step - 1) * 20;
/** Minutes after midnight at the END of `step`: the asked clock of an item whose key interval ends with it. */
export const askedClockMin = (step: number): number => stepStartMin(step + 1);

/** The burnt area (ha) the map's reported fire shows during `step`: the reported perimeter and its detached parts. */
export function reportedAreaHa(step: number): number {
  const s = siteStep(step);
  return areaHa(s.reported) + s.reportedDetached.reduce((a, p) => a + areaHa(p), 0);
}

/** The line through a quantity reported at the starts of steps `nowStep - 1` and `nowStep`, read at the end of `askedStep`. */
function extrapolateReported(value: (step: number) => number, nowStep: number, askedStep: number): number {
  const now = value(nowStep), before = value(nowStep - 1);
  return now + ((now - before) * (askedClockMin(askedStep) - stepStartMin(nowStep))) / 20;
}

/** REPORT-keyed: the burnt area (ha) at the end of `askedStep`. */
export function reportedAreaAt(nowStep: number, askedStep: number): number {
  return extrapolateReported(reportedAreaHa, nowStep, askedStep);
}

/** REPORT-keyed: the area the fire grows over the 20 minutes after the now step's start (the series' slope), in hectares. */
export function reportedGrowthHa(nowStep: number): number {
  return reportedAreaHa(nowStep) - reportedAreaHa(nowStep - 1);
}

/** The shortest distance (m) from the fire the map shows during `step` (the reported perimeter and detached parts) to a polyline. */
export function reportedToLineM(step: number, line: readonly LatLon[]): number {
  return Math.min(...vertices(reportedPolys(siteStep(step))).map((v) => distanceToLineM(v, line)));
}

/** REPORT-keyed: the reported fire's nearest edge to a point (m) at the end of `askedStep`. */
export function reportedPointDistanceAt(nowStep: number, askedStep: number, p: LatLon): number {
  return extrapolateReported((s) => distanceToReportedM(s, p), nowStep, askedStep);
}

/** REPORT-keyed: the reported fire's nearest edge to a polyline (m) at the end of `askedStep`. */
export function reportedLineDistanceAt(nowStep: number, askedStep: number, line: readonly LatLon[]): number {
  return extrapolateReported((s) => reportedToLineM(s, line), nowStep, askedStep);
}

/** The shortest distance (m) from the first detached front the map shows during `step` to a polyline; throws when none is shown. */
export function reportedDetachedToLineM(step: number, line: readonly LatLon[]): number {
  const front = siteStep(step).reportedDetached[0];
  if (!front) throw new RangeError(`the map of step ${step} shows no detached front`);
  return Math.min(...front[0]!.map((v) => distanceToLineM(v, line)));
}

/** REPORT-keyed: a detached front the map first shows at `nowStep`, its distance (m) to a polyline at the end of `askedStep` (no earlier report: closing at the delivered head rate); not below zero. */
export function reportedDetachedClosingAt(nowStep: number, askedStep: number, line: readonly LatLon[]): number {
  const minutes = askedClockMin(askedStep) - stepStartMin(nowStep);
  return Math.max(0, reportedDetachedToLineM(nowStep, line) - siteStep(nowStep).observedHead.rateMpm * minutes);
}

// ---------------------------------------------------------------------------
// The projection-direction key's item reading (fix pass 7, 9 Oct 2026, revision (ad); the plan reading is `PROJECTION_DIRECTION_KEYS`
// in `demo-directive.ts`): where a numeric L3 item's band under the view's projection differs from its report-keyed band.
// ---------------------------------------------------------------------------

/** The view's projection isochrone for the END of `step` (minutes from the view's start), as polygons. */
function isochroneAt(view: number, step: number) {
  const v = SITE_SCENARIO.views.find((x) => x.index === view);
  if (!v) throw new RangeError(`the bundle has no view ${view}`);
  const minutes = (step - v.steps[0]! + 1) * 20;
  const iso = v.isochrones.find((i) => i.minutes === minutes);
  if (!iso) throw new RangeError(`V${view} has no ${minutes}-minute isochrone`);
  return [iso.polygon, ...(iso.detachedParts ?? [])];
}

/** The shortest distance (m) from the view's projected fire at the end of `step` to a polyline. */
export function projectedLineDistanceAt(view: number, step: number, line: readonly LatLon[]): number {
  return Math.min(...isochroneAt(view, step).flatMap((poly) => poly.flatMap((ring) => ring.map((p) => distanceToLineM(p, line)))));
}

/**
 * The option a band item's projection implies (`bandOf` on the projected value, with its own margin), or null when it is the key's
 * band (the item then cannot tell the two apart and carries no `projectionOptionId`).
 */
export function projectionOptionFor(projected: number, keyId: string, edges: readonly number[], ids: readonly string[], minMargin: number, what: string): string | null {
  const p = bandOf(projected, edges, ids, minMargin, `${what} (projection)`);
  return p.id === keyId ? null : p.id;
}
