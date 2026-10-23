/**
 * `npx tsx tools/review/map-pretest.ts` — builds the map-reading pretest (difficulty audit, 23 Oct 2026;
 * `docs/audits/2026-10-23-difficulty/proposal-map.md` c.2) from the site data, and computes its keys. Keys are COMPUTED, never typed.
 *
 * The extract: the study basemap's cheaper option of c.2 — pixels x 4375–5000, y 0–625 of `public/maps/topo.webp` (= tile `0_3`,
 * x 625–1250, y 0–625; TM35 E 526 500–529 000, N 6 753 500–6 756 000), north-east of the incident, outside its extent and outside every
 * key, record and item. It holds Kaitajärvi (named in no record, item or radio text), mires with ditches, a cased main road, forest roads
 * and tracks, houses, the power line and contours. The participant sees the same tile as the session (Finnish, or `topo-en` in English
 * sessions) with an overlay drawn from the output: a 4 × 4 grid of 625 m squares (A–D west to east, 1–4 north to south), the marks and
 * a 500 m scale bar.
 *
 * The items (the marks are placed by rule; a rule whose margin fails throws, and the marks must be moved by changing the rule):
 * - P1 square: the square holding the southern end of Kaitajärvi (every shore vertex within 8 px of the southernmost) — or, because
 *   on this extract the southern shore runs across the C/D line (C4 or D4: ambiguous), the lake's one island; the feature lies in one
 *   square, ≥ 12 px (48 m) from every grid line; the distractors are the three other squares holding the most lake vertices.
 * - P2 slope: marks 1 and 2 (1 the western) on land; one the steepest point of a 12.5 px lattice, the other a point with a third of its
 *   slope (between a quarter and two fifths) ≥ 150 px away; the ratio ≥ 2.5; contours near both. Key: the steeper.
 * - P3 water: ★ on a house or a road, the nearest open water 100–400 m away, the next ≥ 1.4 × farther, every mire ditch ≥ 1.4 × farther;
 *   a ★ whose nearest water is not the large named lake is preferred (the item then tests distance, not salience).
 * - P4 area: X inside a drained mire, ≥ 10 px inside its edge, ≥ 25 px from the extract's edge, a ditch within 25 px; not in water or a field.
 * - P5 distance and P6 direction: A on a road, ≥ 300 m from Kaitajärvi, the lake's centroid ≥ 20° from N/E/S/W as seen from A and
 *   ≥ 70 % of the lake's vertices in the same quadrant (P6); B on a road at 1 200 m (else 600 m) ± 3 % from A (P5).
 * Every mark is ≥ 40 px from every other.
 *
 * Writes `content/pretest/map-pretest.json` (what the app shows: the extract, grid, marks, items and options in both languages — no
 * key), `content/pretest/map-pretest.key.json` (TRUTH, analysis only: each key and the figures behind it) and a preview for the two
 * people who check the keys against the image (`docs/audits/2026-10-23-difficulty/map-pretest-preview.svg`). Deterministic: the same
 * site data write the same bytes (`test/tools/map-pretest.spec.ts` rebuilds and compares).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PRETEST_FRAME_PX, pretestSvg, type MapPretestSpec, type PretestMark } from "../../app/render/ui/pretest-overlay.js";
import { bearing, byPosition, centroid, contourError, dist, ElevationGrid, fromCardinal, inside, lineDist, polygonDist, round1, toPx, type Px, type Ring } from "./map-pretest-geometry.js";

interface TopoFeatures {
  readonly size: number;
  readonly metresPerPixel: number;
  readonly elevationGrid: { readonly size: number; readonly values: readonly number[] };
  readonly water: readonly Ring[];
  readonly islands: readonly Ring[];
  readonly fields: readonly Ring[];
  readonly drainedBogs: readonly Ring[];
  readonly brooks: readonly Ring[];
  readonly ditches: readonly Ring[];
  readonly contours: readonly { readonly level: number; readonly pts: Ring }[];
  readonly roads: readonly { readonly cls: string; readonly pts: Ring }[];
  readonly buildings: readonly { readonly px: readonly [number, number]; readonly kind: string }[];
  readonly labels: readonly { readonly text: string; readonly px: readonly [number, number] }[];
  readonly labelsEn: readonly { readonly text: string; readonly px: readonly [number, number] }[];
}

/** The extract, in basemap pixels (4 m), and the tile that holds it. */
export const CROP = { x0: 4375, y0: 0, size: 625, tile: "0_3", tileX0: 625, tileY0: 0, tilePx: 1250 } as const;
const SQUARES = 4;
const SQUARE_PX = CROP.size / SQUARES;
const COLS = ["A", "B", "C", "D"] as const;
const MARK_GAP_PX = 40;
export const PRETEST_TIME_LIMIT_MS = 240_000;
export const PRETEST_VERSION = "map-pretest-2026-10-23";

const local = (p: Px): Px => ({ x: round1(p.x - CROP.x0), y: round1(p.y - CROP.y0) });
const inCrop = (p: Px, margin = 0) => p.x >= CROP.x0 + margin && p.x <= CROP.x0 + CROP.size - margin && p.y >= CROP.y0 + margin && p.y <= CROP.y0 + CROP.size - margin;
const touchesCrop = (ring: Ring) => ring.some((q) => inCrop(toPx(q)));
const squareOf = (p: Px) => `${COLS[Math.min(SQUARES - 1, Math.floor((p.x - CROP.x0) / SQUARE_PX))]}${Math.min(SQUARES - 1, Math.floor((p.y - CROP.y0) / SQUARE_PX)) + 1}`;
const gridLineGap = (p: Px) => {
  const lx = p.x - CROP.x0, ly = p.y - CROP.y0;
  return Math.min(...[1, 2, 3].flatMap((k) => [Math.abs(lx - k * SQUARE_PX), Math.abs(ly - k * SQUARE_PX)]));
};
const lattice = (step: number, margin: number): Px[] => {
  const out: Px[] = [];
  for (let y = CROP.y0 + margin; y <= CROP.y0 + CROP.size - margin; y += step) for (let x = CROP.x0 + margin; x <= CROP.x0 + CROP.size - margin; x += step) out.push({ x, y });
  return out;
};
const roadPoints = (f: TopoFeatures, margin: number): Px[] => f.roads.flatMap((r) => r.pts.map(toPx)).filter((p) => inCrop(p, margin)).sort(byPosition);
const clearOf = (p: Px, marks: readonly Px[]) => marks.every((m) => dist(m, p) >= MARK_GAP_PX);

export interface PretestBuild { readonly spec: MapPretestSpec; readonly key: Readonly<Record<string, unknown>> }

export function buildMapPretest(f: TopoFeatures): PretestBuild {
  if (f.size !== 5000 || f.metresPerPixel !== 4) throw new Error("map pretest: the basemap is not the 5000 px, 4 m one");
  const mpp = f.metresPerPixel;
  const grid = new ElevationGrid(f.elevationGrid.size, f.elevationGrid.values, f.size);
  const contourErr = contourError(grid, f.contours, (p) => inCrop(p, -200));
  if (contourErr > 1.5) throw new Error(`map pretest: the elevation grid disagrees with the contours (median ${contourErr.toFixed(2)} m)`);

  // The lake: the water polygon holding the "Kaitajärvi" label; its English name from `labelsEn`.
  const labelIdx = f.labels.findIndex((l) => l.text === "Kaitajärvi");
  if (labelIdx < 0 || !inCrop(toPx(f.labels[labelIdx]!.px))) throw new Error("map pretest: no Kaitajärvi label in the extract");
  const lakeNameEn = f.labelsEn[labelIdx]!.text;
  const lake = f.water.find((w) => inside(toPx(f.labels[labelIdx]!.px), w));
  if (!lake) throw new Error("map pretest: the Kaitajärvi label is in no water polygon");
  if (!lake.every((q) => inCrop(toPx(q)))) throw new Error("map pretest: Kaitajärvi runs out of the extract");
  const others = f.water.filter((w) => w !== lake && touchesCrop(w));
  if (others.length !== 1) throw new Error(`map pretest: expected one other water body in the extract, found ${others.length}`);
  const smallLake = others[0]!;
  const smallIn = smallLake.map(toPx).filter((p) => inCrop(p));
  if (smallIn.some((p) => p.y - CROP.y0 < 0.75 * CROP.size)) throw new Error("map pretest: the other lake is not at the extract's southern edge");
  const brooks = f.brooks.filter(touchesCrop);
  const ditches = f.ditches.filter(touchesCrop);
  const waters = [lake, smallLake];
  const wet = (p: Px) => waters.some((w) => polygonDist(p, w) < 12);
  const marks: Px[] = [];

  // P1: the square of a lake feature — its southern end (the proposal's), or, when the southern shore runs along a grid line, the
  // lake's one island. A feature qualifies when every vertex of it (the end: within 8 px of the extreme) lies in one square ≥ 12 px
  // from every grid line.
  const southY = Math.max(...lake.map((q) => q[1]));
  const islands = f.islands.filter((r) => r.every((q) => inside(toPx(q), lake)));
  const targets = [
    { id: "south_end", pts: lake.map(toPx).filter((p) => southY - p.y <= 8), fi: "Missä ruudussa on Kaitajärven eteläpää?", en: `In which square is the southern end of ${lakeNameEn}?` },
    ...(islands.length === 1 ? [{ id: "island", pts: islands[0]!.map(toPx), fi: "Missä ruudussa on Kaitajärven saari?", en: `In which square is the island in ${lakeNameEn}?` }] : []),
  ];
  const p1 = targets.find((t) => new Set(t.pts.map(squareOf)).size === 1 && t.pts.every((p) => gridLineGap(p) >= 12));
  if (!p1) throw new Error("map pretest P1: neither the southern end nor an island lies clearly in one square");
  const p1Key = squareOf(p1.pts[0]!);
  const counts = new Map<string, number>();
  for (const q of lake) { const s = squareOf(toPx(q)); counts.set(s, (counts.get(s) ?? 0) + 1); }
  const distractors = [...counts.entries()].filter(([s]) => s !== p1Key).sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(([s]) => s);
  if (distractors.length < 3) throw new Error("map pretest P1: the lake touches fewer than four squares");
  const p1Options = [p1Key, ...distractors].sort((a, b) => (a < b ? -1 : 1));

  // P5/P6: A on a road, the lake clearly in one quadrant from it; then B at 1 200 m (else 600 m) on a road.
  const lakeC = centroid(lake);
  const quadrant = (deg: number) => Math.floor(deg / 90);
  const aCands = roadPoints(f, 40).filter((p) => polygonDist(p, lake) * mpp >= 300 && !wet(p)).map((p) => {
    const brg = bearing(p, lakeC), q = quadrant(brg);
    const share = lake.filter((v) => quadrant(bearing(p, toPx(v))) === q).length / lake.length;
    return { p, brg, q, share, margin: fromCardinal(brg) };
  }).filter((c) => c.margin >= 20 && c.share >= 0.7).sort((a, b) => (b.share - a.share) || (b.margin - a.margin) || byPosition(a.p, b.p));
  let pA: (typeof aCands)[number] | null = null, pB: Px | null = null, abM = 0, abTarget = 0;
  for (const target of [1200, 600]) {
    for (const a of aCands) {
      const bs = roadPoints(f, 40).filter((b) => clearOf(b, [a.p]) && Math.abs(dist(a.p, b) * mpp - target) <= 0.03 * target)
        .sort((x, y) => (Math.abs(dist(a.p, x) * mpp - target) - Math.abs(dist(a.p, y) * mpp - target)) || byPosition(x, y));
      if (bs.length > 0) { pA = a; pB = bs[0]!; abM = dist(a.p, pB) * mpp; abTarget = target; break; }
    }
    if (pA) break;
  }
  if (!pA || !pB) throw new Error("map pretest P5/P6: no A and B satisfy the rules");
  marks.push(pA.p, pB);
  const distanceOptions = [300, 600, 1200, 2000];
  const p5Key = distanceOptions.reduce((a, b) => (Math.abs(b - abM) < Math.abs(a - abM) ? b : a));
  if (p5Key !== abTarget) throw new Error("map pretest P5: the key is not the target option");
  const p6Key = (["ne", "se", "sw", "nw"] as const)[pA.q]!;

  // P3: ★ — the nearest open water, clearly nearer than the rest and than any ditch.
  const starCands = [...f.buildings.filter((b) => b.kind === "house").map((b) => toPx(b.px)).filter((p) => inCrop(p, 40)), ...roadPoints(f, 40)]
    .filter((p) => clearOf(p, marks)).map((p) => {
      const d = { lake: polygonDist(p, lake), small_lake: polygonDist(p, smallLake), brook: Math.min(...brooks.map((b) => lineDist(p, b))) };
      const ranked = (["lake", "small_lake", "brook"] as const).map((k) => ({ k, d: d[k] })).sort((x, y) => x.d - y.d);
      const ditch = Math.min(...ditches.map((x) => lineDist(p, x)));
      return { p, ranked, ditch, ratio: ranked[1]!.d / Math.max(1e-9, ranked[0]!.d) };
    })
    .filter((c) => c.ranked[0]!.d * mpp >= 100 && c.ranked[0]!.d * mpp <= 400 && c.ratio >= 1.4 && c.ditch >= 1.4 * c.ranked[0]!.d)
    .sort((a, b) => (Number(a.ranked[0]!.k === "lake") - Number(b.ranked[0]!.k === "lake")) || (b.ratio - a.ratio) || byPosition(a.p, b.p));
  const star = starCands[0];
  if (!star) throw new Error("map pretest P3: no ★ satisfies the rules");
  marks.push(star.p);

  // P4: X inside a drained mire with ditches.
  const bogs = f.drainedBogs.filter(touchesCrop);
  const xCands = lattice(5, 25).filter((p) => clearOf(p, marks) && !wet(p) && !f.fields.some((r) => inside(p, r)))
    .map((p) => ({ p, bog: bogs.find((b) => inside(p, b)) }))
    .filter((c): c is { p: Px; bog: Ring } => c.bog !== undefined)
    .map((c) => ({ p: c.p, depth: lineDist(c.p, [...c.bog, c.bog[0]!]), ditch: Math.min(...ditches.map((x) => lineDist(c.p, x))) }))
    .filter((c) => c.depth >= 10 && c.ditch <= 25).sort((a, b) => (b.depth - a.depth) || byPosition(a.p, b.p));
  const xMark = xCands[0];
  if (!xMark) throw new Error("map pretest P4: no X satisfies the rules");
  marks.push(xMark.p);

  // P2: the slope pair.
  const contourNear = (p: Px, r: number) => new Set(f.contours.filter((c) => c.pts.some((q) => dist(p, toPx(q)) <= r)).map((c) => c.level)).size;
  const land = lattice(12.5, 40).filter((p) => !wet(p) && clearOf(p, marks)).map((p) => ({ p, s: grid.slope(p, mpp) }));
  const steepest = [...land].sort((a, b) => (b.s - a.s) || byPosition(a.p, b.p)).find((c) => contourNear(c.p, 30) >= 2);
  if (!steepest) throw new Error("map pretest P2: no steep point with contours");
  const gentle = land.filter((c) => c.s >= 0.25 * steepest.s && c.s <= 0.4 * steepest.s && dist(c.p, steepest.p) >= 150 && contourNear(c.p, 45) >= 1)
    .sort((a, b) => (Math.abs(a.s - steepest.s / 3) - Math.abs(b.s - steepest.s / 3)) || byPosition(a.p, b.p))[0];
  if (!gentle || steepest.s / gentle.s < 2.5) throw new Error("map pretest P2: no gentle point at a ratio of 2.5 or more");
  const [m1, m2] = [steepest, gentle].sort((a, b) => byPosition(a.p, b.p));
  marks.push(m1!.p, m2!.p);
  const p2Key = m1 === steepest ? "at_1" : "at_2";

  const mark = (id: string, label: string, p: Px, kind: PretestMark["kind"] = "point"): PretestMark => ({ id, label, kind, ...local(p) });
  const spec: MapPretestSpec = {
    generatedBy: "npx tsx tools/review/map-pretest.ts (difficulty audit, 23 Oct 2026; proposal-map.md c.2)",
    version: PRETEST_VERSION,
    crop: { ...CROP, metresPerPixel: mpp, squarePx: SQUARE_PX },
    scaleBarMetres: 500,
    timeLimitMs: PRETEST_TIME_LIMIT_MS,
    marks: [mark("p2_1", "1", m1!.p), mark("p2_2", "2", m2!.p), mark("p3_star", "★", star.p), mark("p4_x", "X", xMark.p, "area"), mark("p5_a", "A", pA.p), mark("p5_b", "B", pB)],
    items: [
      { id: "pretest.p1.square", skill: "find_named_place", stem: { fi: p1.fi, en: p1.en },
        options: p1Options.map((s) => ({ id: s, fi: s, en: s })) },
      { id: "pretest.p2.slope", skill: "steeper_slope", stem: { fi: "Kumpi rinne on jyrkempi, kohdassa 1 vai kohdassa 2?", en: "Which slope is steeper, at 1 or at 2?" },
        options: [{ id: "at_1", fi: "Kohdassa 1", en: "At 1" }, { id: "at_2", fi: "Kohdassa 2", en: "At 2" }, { id: "equal", fi: "Yhtä jyrkkiä", en: "Equally steep" }, { id: "cannot_tell", fi: "Kartasta ei voi päätellä", en: "The map cannot tell" }] },
      { id: "pretest.p3.water", skill: "nearest_water", stem: { fi: "Mistä ★:n kohdalla olevalle pumpulle saisi vettä lähimpää?", en: "Where is the nearest place to draw water for a pump at ★?" },
        options: [{ id: "lake", fi: "Kaitajärvestä", en: `From ${lakeNameEn}` }, { id: "small_lake", fi: "Kartan etelälaidan pienestä järvestä", en: "From the small lake at the map's southern edge" },
          { id: "brook", fi: "Purosta", en: "From a brook" }, { id: "none_1km", fi: "Kilometrin sisällä ei ole vettä", en: "There is no water within 1 km" }] },
      { id: "pretest.p4.area", skill: "recognise_mire", stem: { fi: "Mitä alue X esittää?", en: "What does area X show?" },
        options: [{ id: "drained_mire", fi: "Ojitettua suota", en: "A drained mire" }, { id: "field", fi: "Peltoa", en: "A field" }, { id: "lake", fi: "Järveä", en: "A lake" }, { id: "clearcut", fi: "Hakkuuaukeaa", en: "A clear-cut" }] },
      { id: "pretest.p5.distance", skill: "distance_by_scale", stem: { fi: "Kuinka pitkä on linnuntie A:sta B:hen?", en: "How far is it in a straight line from A to B?" },
        options: distanceOptions.map((m) => ({ id: `m${m}`, fi: `${m >= 1000 ? `${Math.floor(m / 1000)} ${String(m % 1000).padStart(3, "0")}` : m} m`, en: `${m >= 1000 ? `${Math.floor(m / 1000)},${String(m % 1000).padStart(3, "0")}` : m} m` })) },
      { id: "pretest.p6.direction", skill: "direction", stem: { fi: "Missä suunnassa Kaitajärvi on A:sta katsottuna?", en: `In which direction is ${lakeNameEn} from A?` },
        options: [{ id: "ne", fi: "Koillisessa", en: "North-east" }, { id: "se", fi: "Kaakossa", en: "South-east" }, { id: "sw", fi: "Lounaassa", en: "South-west" }, { id: "nw", fi: "Luoteessa", en: "North-west" }] },
    ],
  };
  const key = {
    status: "TRUTH — analysis only, never sent to the screen. Computed by tools/review/map-pretest.ts; check against the preview before use.",
    version: PRETEST_VERSION,
    items: {
      "pretest.p1.square": {
        key: p1Key, feature: p1.id, gridLineGapPx: round1(Math.min(...p1.pts.map(gridLineGap))),
        southernEndSquares: [...new Set(lake.map(toPx).filter((p) => southY - p.y <= 8).map(squareOf))].sort((a, b) => (a < b ? -1 : 1)),
      },
      "pretest.p2.slope": { key: p2Key, slope1: round1(m1!.s * 1000) / 1000, slope2: round1(m2!.s * 1000) / 1000, ratio: round1(steepest.s / gentle.s) },
      "pretest.p3.water": { key: star.ranked[0]!.k, metres: Object.fromEntries(star.ranked.map((r) => [r.k, Math.round(r.d * mpp)])), ditchMetres: Math.round(star.ditch * mpp), ratio: round1(star.ratio) },
      "pretest.p4.area": { key: "drained_mire", insideEdgePx: round1(xMark.depth), nearestDitchPx: round1(xMark.ditch) },
      "pretest.p5.distance": { key: `m${p5Key}`, metres: Math.round(abM) },
      "pretest.p6.direction": { key: p6Key, bearingDeg: round1(pA.brg), fromCardinalDeg: round1(pA.margin), lakeVerticesInQuadrant: round1(pA.share * 100) / 100 },
    },
  };
  return { spec, key };
}

/** The preview for the key checkers: the Finnish tile under the participant's overlay, exactly as the screen draws it (no key). */
export function previewSvg(spec: MapPretestSpec, tileHref: string): string {
  return `${pretestSvg(spec, tileHref).replace('width="100%" height="100%"', `width="${spec.crop.size + 2 * PRETEST_FRAME_PX}" height="${spec.crop.size + 2 * PRETEST_FRAME_PX}"`)}\n`;
}

export function readTopoFeatures(root: string): TopoFeatures {
  return JSON.parse(readFileSync(join(root, "content/site/build/topo-features.json"), "utf8")) as TopoFeatures;
}

export const json = (v: unknown): string => `${JSON.stringify(v, null, 1)}\n`;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const { spec, key } = buildMapPretest(readTopoFeatures(root));
  mkdirSync(join(root, "content/pretest"), { recursive: true });
  writeFileSync(join(root, "content/pretest/map-pretest.json"), json(spec));
  writeFileSync(join(root, "content/pretest/map-pretest.key.json"), json(key));
  writeFileSync(join(root, "docs/audits/2026-10-23-difficulty/map-pretest-preview.svg"), previewSvg(spec, "../../../app/render/ui/public/maps/topo/0_3.webp"));
  console.log(JSON.stringify(key.items, null, 1));
}
