/**
 * The candidate developments once shown after a "fundamentally wrong" Type J judgement (SPEC/08 revision
 * (d); HANDOFF §5.3; Type J is withdrawn since revision (x), 6 Oct 2026, the statements still built into
 * the bundle) — per-view statements whose truth is DERIVED from the CA run
 * (`site-scenario.json`), never chosen by a shuffle (readiness round, 5 Oct 2026; replaces the four
 * generic `BRANCH_TEMPLATES` whose truth was the first place of a seeded shuffle, i.e. random).
 *
 * TRUTH module: the statements' Finnish text is content (English in `labels.en.json`); their truth
 * (`isActualDevelopment`) is computed here and stripped at the render boundary (I4). Nothing under
 * `app/render` imports this file.
 *
 * Every statement is one of a few KINDS with a parameter, and each kind has a rule that reads the CA:
 * the reported fire at the view's start (`reported` + `reportedDetached` of its first step) against
 * the CA truth at its horizon (`truthAtEnd` + `truthDetached`). "Advance" is, per new-burn vertex, the
 * distance beyond the start fire's edge, binned into eight compass sectors by the bearing from the
 * nearest point on that edge (the local direction of spread, not the bearing from the fire's
 * centre, which mislabels the rekindled south front). Each rule has a TRUE band and a FALSE band with
 * a margin between them; a statement in the margin is GREY, and a view with any grey statement is
 * not scored (every truth null) — never guessed:
 * - `dir` (sectors, m): the furthest advance lies in the named sector(s) and is ≥ 1.15 × m, and every
 *   other sector's advance ≤ 0.85 × it → true; the named sectors' advance ≤ 0.6 × m, or ≤ 0.75 × the
 *   furthest advance elsewhere and < m → false.
 * - `stalls`: the furthest advance ≤ 50 m → true; ≥ 100 m → false.
 * - `bounded` (m): 100 m ≤ furthest ≤ 0.75 × m → true; < 50 m or ≥ 1.5 × m → false.
 * - `growth` (ha): the burnt area grows ≥ 1.2 × ha → true; ≤ 0.6 × ha → false.
 * - `new_front`: a burning part at the horizon that touches no part of the start fire → true; none → false.
 * - `cited` (V11 only): the authored, non-spatial categorical breach (`flagReason` "depth, not area";
 *   step 15's "palo palaa syvällä"); the CA does not model depth, so the truth is cited, not computed.
 *
 * Selection rules (documented with the per-view table in `BRANCH_SPECS`):
 * - exactly one true statement per view, except V9 (the omission): all four false, so "Ei mikään
 *   näistä" is the key there (SPEC/08 revision (d), HANDOFF §5.4; `BranchStatement` doc in `types.ts`);
 * - no statement names or cues a designed event or a later freeze item of its view: no new-front
 *   statement in V7–V9 (the rekindle), none mentions the north edge or new smoke in V13 (the
 *   contradiction), no growth statement where the freeze asks the growth trend (V5, V14), no direction
 *   statement in V10 (freeze L3 `front_direction`), no "hardly spreads" in V4 (freeze L3 `rate_trend`),
 *   no north-west statement in V7 (`cabins_reach`);
 * - no `new_front` statement in views where a spot fire is REPORTED during the view but merged into
 *   the main fire by its horizon (V2 ridge, V5 road and Korpioja, V6 Koivuoja, V13 SPOT's smoke): the
 *   CA would key it false while the record says a new fire started — grey by construction;
 * - lengths within a view stay close (`test/scenario/branch-statements.spec.ts`).
 * DRAFT: Finnish for native review, the selection for domain review.
 */

import type { CycleIndex, LatLon, Polygon } from "../engine/primitives.js";
import type { BranchStatement } from "./types.js";
import { SITE_SCENARIO } from "./site-scenario.js";
import { MAIN_VIEWS } from "./views.js";

export const BRANCH_SECTORS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type BranchSector = (typeof BRANCH_SECTORS)[number];

export type BranchSpec =
  | { readonly kind: "dir"; readonly sectors: readonly BranchSector[]; readonly m: number }
  | { readonly kind: "stalls" }
  | { readonly kind: "bounded"; readonly m: number }
  | { readonly kind: "growth"; readonly ha: number }
  | { readonly kind: "new_front" }
  | { readonly kind: "cited"; readonly id: "depth"; readonly truth: boolean; readonly basis: string };

/** The omission view (V9): no statement is the actual development; "Ei mikään näistä" is. */
export const BRANCH_OMISSION_VIEW = 9;

/** Per view, four statements, in authored order (the order shown is seeded in `demo-scenario.ts`). */
export const BRANCH_SPECS: Readonly<Record<number, readonly [BranchSpec, BranchSpec, BranchSpec, BranchSpec]>> = {
  1: [{ kind: "dir", sectors: ["NE"], m: 100 }, { kind: "dir", sectors: ["SW"], m: 100 }, { kind: "growth", ha: 10 }, { kind: "stalls" }],
  2: [{ kind: "dir", sectors: ["NE"], m: 300 }, { kind: "dir", sectors: ["W"], m: 300 }, { kind: "growth", ha: 20 }, { kind: "stalls" }],
  // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): V3's south advance is 101 m (grey for "S, 100 m"), so the second statement names the
  // south-west (0 m, false). V4: the crown run's spots merge with the head by 15:20 (no new front in the CA, while the 15:20 map draws
  // two spots: grey by construction, as in V2, V5, V6), and its growth is 45 ha (grey for 60 ha): the true statement is the head's
  // run north-east (~1040 m, over 1.15 × 600 m, every other sector ≤ 523 m), the growth one 100 ha (false). Were "S, 100 m"; new front, 60 ha.
  3: [{ kind: "dir", sectors: ["NE"], m: 100 }, { kind: "dir", sectors: ["SW"], m: 100 }, { kind: "growth", ha: 15 }, { kind: "new_front" }],
  4: [{ kind: "dir", sectors: ["NE"], m: 600 }, { kind: "bounded", m: 300 }, { kind: "dir", sectors: ["SW"], m: 100 }, { kind: "growth", ha: 100 }],
  5: [{ kind: "bounded", m: 300 }, { kind: "stalls" }, { kind: "dir", sectors: ["E"], m: 300 }, { kind: "dir", sectors: ["S"], m: 300 }],
  6: [{ kind: "dir", sectors: ["N", "NW"], m: 200 }, { kind: "dir", sectors: ["E", "SE"], m: 200 }, { kind: "growth", ha: 100 }, { kind: "stalls" }],
  // 8 Oct 2026 fire retune: V7's furthest advance is 71 m (grey for "stalls" and "bounded"), growth 4.9 ha.
  7: [{ kind: "growth", ha: 3 }, { kind: "dir", sectors: ["E"], m: 100 }, { kind: "dir", sectors: ["NE"], m: 200 }, { kind: "growth", ha: 10 }],
  8: [{ kind: "stalls" }, { kind: "bounded", m: 300 }, { kind: "dir", sectors: ["NE"], m: 100 }, { kind: "growth", ha: 5 }],
  9: [{ kind: "dir", sectors: ["NE"], m: 200 }, { kind: "dir", sectors: ["N", "NW"], m: 200 }, { kind: "growth", ha: 5 }, { kind: "stalls" }],
  10: [{ kind: "bounded", m: 300 }, { kind: "stalls" }, { kind: "growth", ha: 10 }, { kind: "new_front" }],
  11: [
    { kind: "cited", id: "depth", truth: true, basis: "site-scenario.json V11 flagReason 'authored non-spatial breach (depth, not area)'; step 15 story 'Tien pohjoispuolella palo palaa syvällä kunttakerroksessa ja kantojen juurissa, 20–40 cm. Vesi ei imeydy kuivaan kunttaan. Harkitaan kasteluainetta.'" },
    { kind: "stalls" }, { kind: "dir", sectors: ["N", "NW"], m: 200 }, { kind: "growth", ha: 20 },
  ],
  // Revision (aj): the SE advance over 18:20–19:00 is ~340 m (the forest road stops the head at 18:40–19:00; was > 345), so the true statement's threshold is 250 m (verdict at 1.15×).
  12: [{ kind: "dir", sectors: ["SE"], m: 250 }, { kind: "stalls" }, { kind: "dir", sectors: ["N", "NW"], m: 300 }, { kind: "growth", ha: 30 }],
  13: [{ kind: "dir", sectors: ["SE", "S"], m: 150 }, { kind: "stalls" }, { kind: "growth", ha: 20 }, { kind: "dir", sectors: ["W", "SW"], m: 150 }],
  14: [{ kind: "dir", sectors: ["SE", "S"], m: 250 }, { kind: "stalls" }, { kind: "dir", sectors: ["N", "NW"], m: 250 }, { kind: "new_front" }],
};

// ---- Wording (Finnish source; English in labels.en.json) --------------------------------------------

const DIR_FI: Readonly<Record<string, string>> = {
  N: "pohjoiseen", NE: "koilliseen", E: "itään", SE: "kaakkoon", S: "etelään", SW: "lounaaseen", W: "länteen", NW: "luoteeseen",
};
const DIR_EN: Readonly<Record<string, string>> = {
  N: "north", NE: "north-east", E: "east", SE: "south-east", S: "south", SW: "south-west", W: "west", NW: "north-west",
};
const dirsFi = (s: readonly string[]) => s.map((d) => DIR_FI[d]!).join(" tai ");
const dirsEn = (s: readonly string[]) => s.map((d) => DIR_EN[d]!).join(" or ");

/** The statement's Finnish text for a view whose projection ends at `h` ("HH:MM"). */
export function branchTextFi(spec: BranchSpec, h: string): string {
  switch (spec.kind) {
    case "dir": return `Palo etenee klo ${h} mennessä eniten ${dirsFi(spec.sectors)}, yli ${spec.m} m nykyisestä reunasta.`;
    case "stalls": return `Palo tuskin leviää: mikään reuna ei etene klo ${h} mennessä yli 50 m nykyisestä.`;
    case "bounded": return `Palo leviää edelleen, mutta mikään reuna ei etene klo ${h} mennessä yli ${spec.m} m.`;
    case "growth": return `Palon pinta-ala kasvaa klo ${h} mennessä yli ${spec.ha} hehtaaria nykyisestä laajuudestaan.`;
    case "new_front": return `Nykyisen palon ulkopuolelle syttyy klo ${h} mennessä uusi, siitä erillinen palo.`;
    case "cited": return `Palo palaa klo ${h} mennessä syvällä kunttaa ja kantoja, eikä vesi imeydy siihen.`;
  }
}

/** The same in English (the labels file's values; `test/scenario/branch-statements.spec.ts` checks they match). */
export function branchTextEn(spec: BranchSpec, h: string): string {
  switch (spec.kind) {
    case "dir": return `By ${h} the fire advances furthest ${dirsEn(spec.sectors)}, over ${spec.m} m past its present edge.`;
    case "stalls": return `The fire hardly spreads: no edge advances more than 50 m from where it is now by ${h}.`;
    case "bounded": return `The fire keeps spreading, but no edge advances more than ${spec.m} m by ${h}.`;
    case "growth": return `By ${h} the burnt area grows by more than ${spec.ha} hectares from what it is now.`;
    case "new_front": return `By ${h} a new fire starts outside the present fire, separate from it.`;
    case "cited": return `By ${h} the fire burns deep in the humus and stumps, and water does not soak in.`;
  }
}

// ---- The CA facts each rule reads ---------------------------------------------------------------------

const LAT0 = 60.85, LON0 = 27.35;
const M_LAT = 110_540, M_LON = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
interface XY { readonly x: number; readonly y: number }
const xy = (p: LatLon): XY => ({ x: (p.lon - LON0) * M_LON, y: (p.lat - LAT0) * M_LAT });

function ringArea(ring: readonly LatLon[]): number {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) { const a = xy(ring[i]!), b = xy(ring[i + 1]!); s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2;
}
function inRing(p: LatLon, ring: readonly LatLon[]): boolean {
  const P = xy(p);
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = xy(ring[i]!), b = xy(ring[j]!);
    if (a.y > P.y !== b.y > P.y && P.x < ((b.x - a.x) * (P.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
const inPoly = (p: LatLon, poly: Polygon) => inRing(p, poly[0]!) && !poly.slice(1).some((h) => inRing(p, h));
/**
 * Two parts touch when a vertex of one lies well inside the other (more than `EDGE_TOL_M` from its outline). A new fire grown out
 * of the old edge (a rekindle, revision (aj)) shares that edge: its vertices there lie ON the old outline, inside by nothing, so it is
 * still a new front; a continuing front contains its earlier outline, whose forward vertices lie a cell or more inside it.
 */
const EDGE_TOL_M = 10;
const wellInside = (p: LatLon, poly: Polygon) => inPoly(p, poly) && nearestOnRing(p, poly[0]!).d > EDGE_TOL_M;
/** The same outline: at least half of `a`'s vertices lie on `b`'s outline (a held fire that did not move between the report and the horizon). */
const sameOutline = (a: Polygon, b: Polygon) => a[0]!.filter((p) => nearestOnRing(p, b[0]!).d <= EDGE_TOL_M).length >= 0.5 * a[0]!.length;
const touches = (a: Polygon, b: Polygon) => a[0]!.some((p) => wellInside(p, b)) || b[0]!.some((p) => wellInside(p, a)) || sameOutline(a, b) || sameOutline(b, a);
function nearestOnRing(p: LatLon, ring: readonly LatLon[]): { d: number; x: number; y: number } {
  const Q = xy(p);
  let best = { d: Infinity, x: 0, y: 0 };
  for (let i = 0; i < ring.length - 1; i++) {
    const A = xy(ring[i]!), B = xy(ring[i + 1]!);
    const dx = B.x - A.x, dy = B.y - A.y;
    const t = Math.max(0, Math.min(1, ((Q.x - A.x) * dx + (Q.y - A.y) * dy) / (dx * dx + dy * dy || 1)));
    const x = A.x + t * dx, y = A.y + t * dy, d = Math.hypot(Q.x - x, Q.y - y);
    if (d < best.d) best = { d, x, y };
  }
  return best;
}

/** What the CA says happens in a view, start fire against truth at the horizon. TRUTH. */
export interface ViewDevelopment {
  readonly view: number;
  readonly horizonClock: string;
  /** Furthest advance beyond the start fire's edge per sector, metres (new parts included). */
  readonly advanceM: Readonly<Record<BranchSector, number>>;
  readonly growthHa: number;
  readonly newFronts: number;
}

export function viewDevelopment(view: number): ViewDevelopment {
  const v = MAIN_VIEWS.find((x) => x.index === view);
  const sv = SITE_SCENARIO.views.find((x) => x.index === view);
  const sc = SITE_SCENARIO.steps.find((x) => x.index === v?.steps[0]);
  if (!v || !sv || !sc) throw new RangeError(`no main view ${view}`);
  const start: Polygon[] = [sc.reported, ...sc.reportedDetached];
  const end: Polygon[] = [sv.truthAtEnd, ...sv.truthDetached];
  const advanceM = Object.fromEntries(BRANCH_SECTORS.map((s) => [s, 0])) as Record<BranchSector, number>;
  for (const poly of end) for (const p of poly[0]!) {
    if (start.some((sp) => inPoly(p, sp))) continue;
    let best = { d: Infinity, x: 0, y: 0 };
    for (const sp of start) { const n = nearestOnRing(p, sp[0]!); if (n.d < best.d) best = n; }
    const Q = xy(p);
    const brg = ((Math.atan2(Q.x - best.x, Q.y - best.y) * 180) / Math.PI + 360) % 360;
    const sector = BRANCH_SECTORS[Math.round(brg / 45) % 8]!;
    advanceM[sector] = Math.max(advanceM[sector], Math.round(best.d));
  }
  const area = (ps: readonly Polygon[]) => ps.reduce((s, p) => s + ringArea(p[0]!), 0) / 10_000;
  return {
    view, horizonClock: sv.horizonClock, advanceM,
    growthHa: Math.round((area(end) - area(start)) * 10) / 10,
    newFronts: end.filter((tp) => !start.some((sp) => touches(tp, sp))).length,
  };
}

/** The rule's verdict: true, false, or null (in the margin: not defensible either way). */
export function branchVerdict(spec: BranchSpec, dev: ViewDevelopment): boolean | null {
  const adv = dev.advanceM;
  const furthest = Math.max(...BRANCH_SECTORS.map((s) => adv[s]));
  switch (spec.kind) {
    case "dir": {
      const inSet = Math.max(...spec.sectors.map((s) => adv[s]));
      const outside = Math.max(0, ...BRANCH_SECTORS.filter((s) => !spec.sectors.includes(s)).map((s) => adv[s]));
      if (inSet >= 1.15 * spec.m && outside <= 0.85 * inSet) return true;
      if (inSet <= 0.6 * spec.m || (inSet <= 0.75 * outside && inSet < spec.m)) return false;
      return null;
    }
    case "stalls": return furthest <= 50 ? true : furthest >= 100 ? false : null;
    case "bounded":
      if (furthest >= 100 && furthest <= 0.75 * spec.m) return true;
      return furthest < 50 || furthest >= 1.5 * spec.m ? false : null;
    case "growth": return dev.growthHa >= 1.2 * spec.ha ? true : dev.growthHa <= 0.6 * spec.ha ? false : null;
    case "new_front": return dev.newFronts > 0;
    case "cited": return spec.truth;
  }
}

/**
 * Each main view's four statements with their truth (TRUTH), in authored order. A view with a grey
 * statement gets null on every statement (not scored), and so does its "Ei mikään näistä".
 */
export function buildBranchStatements(): BranchStatement[] {
  return MAIN_VIEWS.flatMap((v) => {
    const dev = viewDevelopment(v.index);
    const specs = BRANCH_SPECS[v.index]!;
    const verdicts = specs.map((s) => branchVerdict(s, dev));
    const scored = verdicts.every((x) => x !== null);
    return specs.map((spec, k) => ({
      branchId: `branch.${v.index}.${k}`,
      cycle: v.index as CycleIndex,
      statementFi: branchTextFi(spec, dev.horizonClock),
      truth: { isActualDevelopment: scored ? verdicts[k]! : null },
    }));
  });
}
