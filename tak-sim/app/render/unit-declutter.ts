/**
 * Unit-marker declutter (SPEC/12 revision (al), 10 Oct 2026). At the opening (Palo) frame one screen pixel is ~10–15 m
 * of ground, so the five or six crews, vehicles and aircraft working one stretch of edge sat on top of each other and
 * their labels ran together ("VD1 L1 21 15"). Deterministic steps, in a fixed order that depends only on the markers'
 * keys and screen positions — never on time, randomness or what the participant did — so every participant at the
 * same window size and camera sees the same layout:
 *
 * 1. **Stacks.** Taken in key order, a marker whose box overlaps a stack's anchor (the stack's first marker) and lies
 *    within `stackM` metres of it joins that stack. A stack of two or more is drawn as one badge with the count, at the
 *    middle of its members' true positions; hovering it fans the members out (`unit-markers.ts`).
 * 2. **Offsets.** Badges and single markers that still overlap are pushed apart (a fixed number of relaxation rounds,
 *    pairs in key order). A single marker moves at most `maxOffsetM` of ground; a badge only as far as keeps every
 *    member within `maxOffsetM` of it. A marker drawn away from its true position gets a leader line back to it.
 * 3. **Merges.** Two drawn boxes that still overlap are merged into one stack when every member of both stays within
 *    `maxOffsetM` of the merged badge's middle, and step 2 runs again.
 *
 * Revision (am), 10 Oct 2026: at the opening frame the markers are compact (a 16 × 12 frame, no call sign; the call sign
 * and task on hover, labels from about the 2 km zoom on, `unitLabelsShown`), and markers and badges also move off the
 * fire's uncontained edge (`fixedLines`, segments in screen px) within the same 200 m cap, so the units do not hide the
 * edge the commander reads the fire from (V12–V13's south-east front was hard to see under them).
 *
 * Pure: the caller projects the positions (MapLibre's `project`, or `mercatorProjector` in the tests).
 */

export interface DeclutterItem {
  readonly key: string;
  /** True position on screen, px. */
  readonly x: number;
  readonly y: number;
  /** The marker's box, px, centred on (x, y + dy0). */
  readonly w: number;
  readonly h: number;
  /** The box centre's vertical shift from the point, px (0: MapLibre centres the marker element on its point). */
  readonly dy0: number;
}

export interface DeclutterPlacement {
  /** Displacement from the true position, px (0, 0 for a stack member other than the anchor: it is in the badge). */
  readonly dx: number;
  readonly dy: number;
  /** The key of the stack's anchor when this marker is in a stack of two or more; null otherwise. */
  readonly stack: string | null;
}

export interface DeclutterResult {
  readonly placements: ReadonlyMap<string, DeclutterPlacement>;
  /** Stacks of two or more, anchor key → member keys (anchor first, then in key order). */
  readonly stacks: ReadonlyMap<string, readonly string[]>;
}

export interface DeclutterOptions {
  /** Ground metres per screen pixel at the current zoom. */
  readonly metresPerPx: number;
  /** No marker or badge is drawn further than this from its true position (default 200 m). */
  readonly maxOffsetM?: number;
  /** Markers this close to a stack's anchor (and overlapping it) join the stack (default 180 m). */
  readonly stackM?: number;
  /** Clear space kept between boxes, px. */
  readonly padPx?: number;
  readonly rounds?: number;
  /**
   * Boxes the markers move off but that never move themselves (revision (al): the spot-fire symbols, so a crew's
   * marker beside V13's US2 does not sit on it), within the same cap. Centre and size, px.
   */
  readonly fixed?: readonly { readonly cx: number; readonly cy: number; readonly w: number; readonly h: number }[];
  /**
   * Line segments the markers move off but that never move (revision (am): the fire's uncontained edge on screen), px.
   * A box crossing a segment is pushed across it to the side its centre is on, within the same cap; on a zig-zag edge, to the
   * nearest spot within the cap that clears every segment (`clearOfLines`).
   */
  readonly fixedLines?: readonly ScreenSegment[];
}

export interface ScreenSegment { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }

/** Half the width kept clear on each side of an edge line, px: the uncontained edge's line and its ticks. */
export const EDGE_HALF_PX = 3;

/**
 * Call signs are drawn under the markers only at this ground scale or closer (revision (am)): the 2 km preset (2.2 m/px
 * on a 920 px map) and somewhat wider; at the opening frame (~13 m/px) the markers are compact and the call sign shows
 * on hover.
 */
export const UNIT_LABEL_MAX_M_PER_PX = 3.5;
export function unitLabelsShown(metresPerPx: number): boolean {
  return metresPerPx <= UNIT_LABEL_MAX_M_PER_PX;
}

export const MAX_UNIT_OFFSET_M = 200;
export const STACK_M = 180;

interface Box { cx: number; cy: number; w: number; h: number }
const overlapX = (a: Box, b: Box, pad: number) => (a.w + b.w) / 2 + pad - Math.abs(a.cx - b.cx);
const overlapY = (a: Box, b: Box, pad: number) => (a.h + b.h) / 2 + pad - Math.abs(a.cy - b.cy);
const overlaps = (a: Box, b: Box, pad: number) => overlapX(a, b, pad) > 0 && overlapY(a, b, pad) > 0;
const byKey = (a: { key: string }, b: { key: string }) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

interface Group { readonly anchor: DeclutterItem; members: DeclutterItem[] }
interface Drawn { readonly g: Group; readonly home: Box; b: Box; readonly cap: number }

export function declutterUnits(input: readonly DeclutterItem[], opts: DeclutterOptions): DeclutterResult {
  const mpp = Math.max(1e-9, opts.metresPerPx);
  // A 2 % margin under the cap, so rounding never takes a marker to the limit.
  const maxPx = ((opts.maxOffsetM ?? MAX_UNIT_OFFSET_M) * 0.98) / mpp;
  const stackPx = (opts.stackM ?? STACK_M) / mpp;
  const pad = opts.padPx ?? 2;
  const rounds = opts.rounds ?? 40;
  const items = [...input].sort(byKey);
  const box = (it: DeclutterItem): Box => ({ cx: it.x, cy: it.y + it.dy0, w: it.w, h: it.h });
  const dist = (a: DeclutterItem, b: DeclutterItem) => Math.hypot(a.x - b.x, a.y - b.y);
  const lines = nearLines(opts.fixedLines ?? [], items, maxPx + 40);

  // 1. Stacks, anchored on their first member's true position.
  const groups: Group[] = [];
  for (const it of items) {
    const g = groups.find((s) => overlaps(box(s.anchor), box(it), pad) && dist(s.anchor, it) <= stackPx);
    if (g) g.members.push(it);
    else groups.push({ anchor: it, members: [it] });
  }

  const draw = (g: Group): Drawn => {
    // A badge sits at the middle of its members' true positions (their bounding box's centre).
    const c = centreOf(g.members);
    const home = { ...box(g.anchor), cx: c.x, cy: c.y + g.anchor.dy0 };
    const reach = Math.max(...g.members.map((m) => Math.hypot(m.x - c.x, m.y - c.y)));
    return { g, home, b: { ...home, w: Math.max(...g.members.map((m) => m.w)), h: Math.max(...g.members.map((m) => m.h)) }, cap: Math.max(0, maxPx - reach) };
  };
  let drawn = groups.map(draw);
  // 2 and 3: relax, merge the first pair still overlapping that can be merged, repeat.
  for (let pass = 0; pass < 12; pass++) {
    for (const d of drawn) d.b = { ...d.b, cx: d.home.cx, cy: d.home.cy };
    relax(drawn, opts.fixed ?? [], lines, pad, rounds);
    const pair = mergeablePair(drawn, pad, (a, b) => { const all = [...a.g.members, ...b.g.members], c = centreOf(all); return all.every((m) => Math.hypot(m.x - c.x, m.y - c.y) <= maxPx * 0.9); });
    if (!pair) break;
    const [a, b] = pair;
    a.g.members = [a.g.anchor, ...[...a.g.members, ...b.g.members].filter((m) => m !== a.g.anchor).sort(byKey)];
    drawn = drawn.filter((d) => d !== b).map((d) => (d === a ? draw(a.g) : d));
  }

  const placements = new Map<string, DeclutterPlacement>();
  const stacks = new Map<string, readonly string[]>();
  for (const d of drawn) {
    // Relative to the anchor's own true position (a badge's middle is not its anchor's).
    const a = d.g.anchor;
    const dx = Math.round((d.b.cx - a.x) * 10) / 10, dy = Math.round((d.b.cy - a.y - a.dy0) * 10) / 10;
    if (d.g.members.length > 1) {
      stacks.set(d.g.anchor.key, d.g.members.map((m) => m.key));
      for (const m of d.g.members) placements.set(m.key, m === d.g.anchor ? { dx, dy, stack: d.g.anchor.key } : { dx: 0, dy: 0, stack: d.g.anchor.key });
    } else {
      placements.set(d.g.anchor.key, { dx, dy, stack: null });
    }
  }
  return { placements, stacks };
}

function centreOf(items: readonly DeclutterItem[]): { x: number; y: number } {
  const xs = items.map((m) => m.x), ys = items.map((m) => m.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

function mergeablePair(drawn: readonly Drawn[], pad: number, ok: (a: Drawn, b: Drawn) => boolean): [Drawn, Drawn] | null {
  for (let i = 0; i < drawn.length; i++) {
    for (let j = i + 1; j < drawn.length; j++) {
      const a = drawn[i]!, b = drawn[j]!;
      if (!overlaps(a.b, b.b, pad)) continue;
      if (ok(a, b)) return [a, b];
      if (ok(b, a)) return [b, a];
    }
  }
  return null;
}

/** The segments that come within `reach` px of any item (the rest cannot touch a marker held within its cap). */
function nearLines(lines: readonly ScreenSegment[], items: readonly DeclutterItem[], reach: number): ScreenSegment[] {
  if (lines.length === 0 || items.length === 0) return [];
  return lines.filter((l) => items.some((it) => {
    const r = reach + Math.max(it.w, it.h);
    return it.x >= Math.min(l.x1, l.x2) - r && it.x <= Math.max(l.x1, l.x2) + r && it.y >= Math.min(l.y1, l.y2) - r && it.y <= Math.max(l.y1, l.y2) + r;
  }));
}

/**
 * A box crossing a segment (widened by `EDGE_HALF_PX` and the padding) is pushed across it along the segment's normal,
 * to the side its centre is on (exactly on the line: the normal's own side). Returns whether it moved.
 */
export function pushOffSegment(a: { cx: number; cy: number; readonly w: number; readonly h: number }, l: ScreenSegment, pad: number): boolean {
  const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len = Math.hypot(dx, dy);
  if (len < 1e-6) return false;
  const tx = dx / len, ty = dy / len, nx = -ty, ny = tx;
  const rx = a.cx - l.x1, ry = a.cy - l.y1;
  const along = rx * tx + ry * ty, across = rx * nx + ry * ny;
  const ea = (a.w / 2) * Math.abs(tx) + (a.h / 2) * Math.abs(ty);
  if (along + ea < 0 || along - ea > len) return false;
  const r = (a.w / 2) * Math.abs(nx) + (a.h / 2) * Math.abs(ny) + pad + EDGE_HALF_PX;
  if (Math.abs(across) >= r - 1e-9) return false;
  const delta = (across >= 0 ? r : -r) - across;
  a.cx += nx * delta; a.cy += ny * delta;
  return true;
}

/** Whether a box crosses a segment widened by `EDGE_HALF_PX` and the padding (`pushOffSegment`'s test, without the move). */
function crossesSegment(a: { readonly cx: number; readonly cy: number; readonly w: number; readonly h: number }, l: ScreenSegment, pad: number): boolean {
  const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len = Math.hypot(dx, dy);
  if (len < 1e-6) return false;
  const tx = dx / len, ty = dy / len, nx = -ty, ny = tx;
  const rx = a.cx - l.x1, ry = a.cy - l.y1;
  const along = rx * tx + ry * ty, across = rx * nx + ry * ny;
  const ea = (a.w / 2) * Math.abs(tx) + (a.h / 2) * Math.abs(ty);
  if (along + ea < 0 || along - ea > len) return false;
  return Math.abs(across) < (a.w / 2) * Math.abs(nx) + (a.h / 2) * Math.abs(ny) + pad + EDGE_HALF_PX - 1e-9;
}

/** Search directions for a spot clear of a zig-zag edge: 16 compass points, in a fixed order. */
const RING = Array.from({ length: 16 }, (_, k) => [Math.cos((k * Math.PI) / 8), Math.sin((k * Math.PI) / 8)] as const);

/**
 * Moves a box off the edge lines it crosses; returns whether it moved. First one push across the crossed segment to the side its
 * centre is on, when that clears every line within the cap (a straight stretch of edge). On a zig-zag edge such a push lands the
 * box on the next segment (SPEC/33 gate R, 20 Oct 2026: on the rebuilt map's jagged north edge at V6–V8, 179 of 700 edge samples
 * stayed hidden), so then the box takes the spot nearest its true position, within its cap, that clears every line — rings 1 px
 * apart, 16 directions in a fixed order — and where the edge's teeth leave no such spot within the cap (a drone orbiting over a
 * jagged edge), the spot within the cap that hides the least of the edge. Deterministic, and stable from round to round: the
 * searches start from the box's home, not from where the last round left it.
 */
function clearOfLines(d: Drawn, lines: readonly ScreenSegment[], pad: number): boolean {
  const reach = d.cap + Math.hypot(d.b.w, d.b.h) + pad + EDGE_HALF_PX;
  const near = lines.filter((l) => Math.min(l.x1, l.x2) - reach <= d.home.cx && d.home.cx <= Math.max(l.x1, l.x2) + reach
    && Math.min(l.y1, l.y2) - reach <= d.home.cy && d.home.cy <= Math.max(l.y1, l.y2) + reach);
  const crossed = near.find((l) => crossesSegment(d.b, l, pad));
  if (!crossed) return false;
  const move = (c: Box) => { const moved = Math.abs(c.cx - d.b.cx) > 1e-9 || Math.abs(c.cy - d.b.cy) > 1e-9; d.b.cx = c.cx; d.b.cy = c.cy; return moved; };
  const inCap = (b: Box) => Math.hypot(b.cx - d.home.cx, b.cy - d.home.cy) <= d.cap + 1e-9;
  const clear = (b: Box) => !near.some((l) => crossesSegment(b, l, pad));
  const pushed = { ...d.b };
  pushOffSegment(pushed, crossed, pad);
  if (inCap(pushed) && clear(pushed)) return move(pushed);
  const spots: Box[] = [{ ...d.b, cx: d.home.cx, cy: d.home.cy }];
  for (let r = 1; r <= d.cap; r++) for (const [ux, uy] of RING) spots.push({ ...d.b, cx: d.home.cx + ux * r, cy: d.home.cy + uy * r });
  const free = spots.find(clear);
  if (free) return move(free);
  // No clear spot within the cap: the least edge hidden (samples every 2 px, as the edge-visibility test counts them).
  const samples: { x: number; y: number }[] = [];
  for (const l of near) {
    const k = Math.max(1, Math.ceil(Math.hypot(l.x2 - l.x1, l.y2 - l.y1) / 2));
    for (let i = 0; i < k; i++) samples.push({ x: l.x1 + ((l.x2 - l.x1) * i) / k, y: l.y1 + ((l.y2 - l.y1) * i) / k });
  }
  const hidden = (b: Box) => samples.reduce((n, q) => n + (Math.abs(q.x - b.cx) < b.w / 2 && Math.abs(q.y - b.cy) < b.h / 2 ? 1 : 0), 0);
  let best = spots[0]!, bestN = hidden(best);
  for (const c of spots) { if (bestN === 0) break; const n = hidden(c); if (n < bestN) { best = c; bestN = n; } }
  return move(best);
}

/**
 * Overlapping pairs, in order, are pushed apart along their axis of least overlap, and boxes off the fixed boxes and
 * edge segments; each box is then held within its cap.
 */
function relax(drawn: readonly Drawn[], fixed: readonly Box[], lines: readonly ScreenSegment[], pad: number, rounds: number): void {
  for (let r = 0; r < rounds; r++) {
    let moved = false;
    for (const d of drawn) if (clearOfLines(d, lines, pad)) moved = true;
    for (const d of drawn) {
      for (const f of fixed) {
        const a = d.b, ox = overlapX(a, f, pad), oy = overlapY(a, f, pad);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        if (ox < oy) a.cx += a.cx <= f.cx ? -ox : ox;
        else a.cy += a.cy <= f.cy ? -oy : oy;
      }
    }
    for (let i = 0; i < drawn.length; i++) {
      for (let j = i + 1; j < drawn.length; j++) {
        const a = drawn[i]!.b, b = drawn[j]!.b;
        const ox = overlapX(a, b, pad), oy = overlapY(a, b, pad);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        // Coinciding centres: the earlier one goes left (or up).
        if (ox < oy) {
          const s = a.cx <= b.cx ? -1 : 1;
          a.cx += (s * ox) / 2; b.cx -= (s * ox) / 2;
        } else {
          const s = a.cy <= b.cy ? -1 : 1;
          a.cy += (s * oy) / 2; b.cy -= (s * oy) / 2;
        }
      }
    }
    for (const d of drawn) {
      const dx = d.b.cx - d.home.cx, dy = d.b.cy - d.home.cy, len = Math.hypot(dx, dy);
      if (len > d.cap) { const k = len > 0 ? d.cap / len : 0; d.b.cx = d.home.cx + dx * k; d.b.cy = d.home.cy + dy * k; }
    }
    if (!moved) break;
  }
}

/**
 * How far from its true position each marker is drawn, metres: a single marker by its displacement, a stack member
 * by the distance from its true position to the badge (the anchor's true position plus the badge's displacement).
 */
export function displayedOffsetsM(input: readonly DeclutterItem[], result: DeclutterResult, metresPerPx: number): Map<string, number> {
  const items = new Map(input.map((it) => [it.key, it]));
  const out = new Map<string, number>();
  for (const it of input) {
    const p = result.placements.get(it.key)!;
    if (p.stack === null) { out.set(it.key, Math.hypot(p.dx, p.dy) * metresPerPx); continue; }
    const anchor = items.get(p.stack)!, ap = result.placements.get(p.stack)!;
    out.set(it.key, Math.hypot(anchor.x + ap.dx - it.x, anchor.y + ap.dy - it.y) * metresPerPx);
  }
  return out;
}

/** A compact marker's frame (revision (am)), px: a ground unit, crew or aircraft, and a parked vehicle. */
export const COMPACT_FRAME = { w: 16, h: 12 } as const;
export const COMPACT_VEHICLE_FRAME = { w: 12, h: 9 } as const;

/**
 * The marker box sizes the map draws (`unit-markers.ts`), px: a labelled symbol and a parked vehicle's smaller one; with
 * `labelled` false (revision (am): wider than `UNIT_LABEL_MAX_M_PER_PX`) the compact frames, with no call sign.
 */
export function unitBox(role: "crew" | "vehicle" | "unit" | "air", label: string, labelled = true): { readonly w: number; readonly h: number; readonly dy0: number } {
  if (!labelled) return role === "vehicle" ? { ...COMPACT_VEHICLE_FRAME, dy0: 0 } : { ...COMPACT_FRAME, dy0: 0 };
  if (role === "vehicle") return { w: 18, h: 14, dy0: 0 };
  // 24 × 18 frame, 1 px gap, a 10 px monospace label (~6.2 px a character) on an 11 px line.
  return { w: Math.max(24, Math.ceil(label.length * 6.2) + 2), h: 30, dy0: 0 };
}
