/**
 * `npm run training:build` (`npx tsx tools/review/training.ts`) — builds the training incident (researcher decision 26 Oct 2026;
 * SPEC/08 (bp) §bp.9, replacing the map training of `map-training.ts`): a small fire at Kaitajärvi in the basemap's north-east corner,
 * thirteen items in S1–S4, each key COMPUTED from the site (`content/site/build/topo-features.json`), the contract
 * (`content/site/contract.json`) and the corpus (`content/training/corpus.json`), never typed. Every rule checks a margin; a rule whose
 * margin fails throws, and the rule (not a mark) is what changes. Nothing lies within 400 m of the 20 kV line.
 *
 * Writes `content/training/incident.json` (the `TrainingSpec` the app shows: area, scenes, items, keys, marks as WGS84, feedback
 * figures), `content/training/key.json` (the figures and margins behind every key, for the two key checkers), the filled corpus
 * (`corpus.json`, `records.en.json`) and the checkers' preview (`docs/audits/2026-10-26-training/preview.svg`). Deterministic: the
 * same site data write the same bytes (`test/training/build.spec.ts` rebuilds and compares).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { LatLon } from "../../app/engine/primitives.js";
import { deriveSeed, Xorshift64Star } from "../../app/engine/prng.js";
import { basemapLatLon } from "../../app/render/ui/basemap-px.js";
import { trainingScenes } from "../../app/session/training/scenes.js";
import type { TrainingItem, TrainingMark, TrainingSpec } from "../../app/session/training/spec.js";
import { bearing, centroid, dist, inside, type Px, type Ring } from "./map-training-geometry.js";
import { contractCheck, readContract } from "./training-contract.js";
import { compassPoint, corpusKeys, fillCorpus, readCorpus, type CorpusFile, type Wording } from "./training-corpus.js";
import { fireKey, FIRE, memoryKey, r6Point, roadLabels } from "./training-fire.js";
import { previewSvg } from "./training-preview.js";
import { measureKey, placeKey, slopeKey, waterKey } from "./training-s1.js";
import { AREA, BAND_M, buildSite, readTopoFeatures, siteOf } from "./training-site.js";

export const TRAINING_VERSION = "training-2026-10-26";
export const TRAINING_SEED = 0x7472_6169_6e69_6e67n; // "training"
export const CAP_MS = 720_000;
export const CARD_WINDOW_MS = 60_000;
export const DEMO_MIN_DWELL_MS = 10_000;
export const MEMORY_MS = 8_000;
export const NOW = { virtualTimeS: -10_920, label: "10.18" } as const;
export const PREVIEW_PATH = "docs/audits/2026-10-26-training/preview.svg";
export const TILE_HREF = "../../../app/render/ui/public/maps/topo/0_3.webp";

const ll = (p: Px): LatLon => { const q = basemapLatLon(p); return { lat: Math.round(q.lat * 1e6) / 1e6, lon: Math.round(q.lon * 1e6) / 1e6 }; };
const site = (p: Px) => { const q = siteOf(p); return { x: Math.round(q.x), y: Math.round(q.y) }; };

/** The choice items' options in their authored order: a quantity scale keeps its order; `last` stays last (as `arrangeSpamOptions`). */
const OPTION_SPECS: readonly { readonly item: string; readonly ids: readonly string[]; readonly scale?: true; readonly last?: readonly string[] }[] = [
  { item: "training.s1.measure", ids: ["m150", "m300", "m600", "m1200"], scale: true },
  { item: "training.s1.slope", ids: ["towards_b", "towards_c", "equal"], last: ["equal"] },
  { item: "training.s1.water", ids: ["fill_1", "fill_2", "either"], last: ["either"] },
  { item: "training.s2.now", ids: ["map_edge", "at_road", "cannot_tell"], last: ["cannot_tell"] },
  { item: "training.s3.records1", ids: ["ha02", "ha04", "ha11", "ha25"], scale: true },
  { item: "training.s3.older", ids: ["passable", "blocked", "cut_by_fire", "light_only"] },
  { item: "training.s3.records2", ids: ["two", "three", "four", "six"], scale: true },
  { item: "training.s4.log", ids: ["ek51", "ek52", "dr8", "nobody"], last: ["nobody"] },
  { item: "training.s4.map", ids: ["north", "south", "both", "none"], last: ["both", "none"] },
  { item: "training.s4.records", ids: ["mpm4", "mpm10", "mpm20", "mpm40"], scale: true },
];

/** The options' order, fixed by the seed and the same for everyone: the key to the least-used place so far, the rest shuffled. */
export function arrangeOptions(keys: Readonly<Record<string, string>>): Record<string, string[]> {
  const rng = new Xorshift64Star(deriveSeed(TRAINING_SEED, TRAINING_VERSION, "option-order"));
  const used = [0, 0, 0, 0];
  const out: Record<string, string[]> = {};
  for (const o of OPTION_SPECS) {
    const key = keys[o.item]!;
    if (!o.ids.includes(key)) throw new Error(`training ${o.item}: the key ${key} is not an option`);
    if (o.scale) { out[o.item] = [...o.ids]; used[o.ids.indexOf(key)]! += 1; continue; }
    const last = o.last ?? [], free = o.ids.filter((id) => !last.includes(id));
    const slots = free.map((_, i) => i).filter((i) => used[i] === Math.min(...free.map((__, j) => used[j]!)));
    const slot = slots[rng.nextInt(slots.length)]!;
    const rest = rng.shuffle(free.filter((id) => id !== key));
    out[o.item] = [...rest.slice(0, slot), key, ...rest.slice(slot), ...last];
    used[slot]! += 1;
  }
  return out;
}

export interface TrainingBuild { readonly spec: TrainingSpec; readonly key: Readonly<Record<string, unknown>>; readonly corpus: CorpusFile; readonly recordsEn: Readonly<Record<string, string>>; readonly preview: string }

export function buildTraining(root: string): TrainingBuild {
  const contract = readContract(root);
  const s = buildSite(readTopoFeatures(root), contract);
  const lockPx = AREA.lockMarginM / s.mpp;
  const square = { x0: AREA.x0, y0: AREA.y0, x1: AREA.x0 + AREA.size, y1: AREA.y0 + AREA.size };
  const lock = { x0: square.x0 - lockPx, y0: square.y0 - lockPx, x1: square.x1 + lockPx, y1: square.y1 + lockPx };
  const met = contractCheck(contract, lock), metSquare = contractCheck(contract, square);
  if (JSON.stringify(met.met) !== JSON.stringify(["MAANTIE_N", "POWER_LINE"])) throw new Error(`training: the lock meets ${met.met.join(", ")} (only MAANTIE_N and POWER_LINE may)`);

  // The keys of S1, the fire (S2, S4.map), the blocked point of R6, the memory place (S4) and the road codes.
  const place = placeKey(s);
  const measure = measureKey(s, place.key);
  const slope = slopeKey(s);
  const water = waterKey(s, place.key);
  const fire = fireKey(s, place.key);
  const block = r6Point(s, 300);
  const others = [place.key, measure.a, measure.foot, slope.a, slope.b, slope.c, water.star, water.fill1, water.fill2, ...water.route, fire.atRoad, fire.key, fire.ek51, ...fire.polygon];
  const memory = memoryKey(s, others);
  const labels = roadLabels(s, [...others, memory.at, ...s.junctions]);

  // The words the corpus takes from the geometry; each compass word keeps a margin from its neighbours.
  const lake = s.waters.filter((w) => inside(s.lakeLabel, w) || w.some((q) => dist({ x: q[0], y: q[1] }, s.lakeLabel) < 200))
    .sort((a, b) => b.length - a.length)[0]!;
  const fireMid = centroid(fire.polygon.map((p) => [p.x, p.y] as const));
  const lakeSide = compassPoint(bearing(areaCentroid(lake), fireMid), 4, 15, "the fire from Kaitajärvi");
  const roadSide = compassPoint(fire.side === "s" ? 180 : 0, 4, 45, "the fire's side of R5");
  const tail = compassPoint(fire.dir.deg + 180, 8, 15, "the fire's tail");
  const r6Dir = compassPoint(block.bearingDeg, 4, 15, "R6 from the junction");
  const wording: Wording = { lakeSide: lakeSide.point, roadSide: roadSide.point, spread: compassPoint(fire.dir.deg, 8, 20, "the spread").point, tailEdge: tail.point, r6Dir: r6Dir.point };
  const places = { fire: ll(fireMid), ek51: ll(fire.ek51), junction: ll(s.r5r6), head: ll(fire.atRoad), block: ll(block.at) };
  const { corpus, en } = fillCorpus(readCorpus(root), wording, places);
  const ck = corpusKeys(corpus);

  // The keys of the choice items, and their order.
  const ha = (v: number) => `ha${String(Math.round(v * 10)).padStart(2, "0")}`;
  const keys: Record<string, string> = {
    "training.s1.measure": `m${[150, 300, 600, 1200].reduce((a, b) => (Math.abs(b - measure.metres) < Math.abs(a - measure.metres) ? b : a))}`,
    "training.s1.slope": "towards_b", "training.s1.water": "fill_2", "training.s2.now": "at_road",
    "training.s3.records1": ha(ck.records1.key), "training.s3.older": ck.older.key,
    "training.s3.records2": ({ 2: "two", 3: "three", 4: "four", 6: "six" } as Record<number, string>)[ck.records2.key] ?? "?",
    "training.s4.log": ck.log.key.toLowerCase(), "training.s4.map": fire.side === "s" ? "south" : "north", "training.s4.records": `mpm${ck.ratePerMin}`,
  };
  if (keys["training.s1.measure"] !== `m${measure.target}`) throw new Error("training s1.measure: the key is not the target option");
  for (const [item, lure] of [["training.s3.records1", ha(ck.records1.lureLog)], ["training.s3.records1", ha(ck.records1.lureOlder)], ["training.s3.older", ck.older.lure], ["training.s3.records2", ({ 2: "two" } as Record<number, string>)[ck.records2.lure] ?? "?"]] as const) {
    if (!OPTION_SPECS.find((o) => o.item === item)!.ids.includes(lure)) throw new Error(`training ${item}: the lure ${lure} is not an option`);
  }
  if (JSON.stringify(ck.log.callers) !== JSON.stringify(["DR8", "EK51", "EK52"])) throw new Error("training s4.log: the callers must be DR8, EK51 and EK52");
  const order = arrangeOptions(keys);

  const mark = (id: string, label: string, p: Px, kind: TrainingMark["kind"] = "point"): TrainingMark => ({ id, label, kind, at: ll(p) });
  const opts = (item: string) => order[item]!.map((id) => ({ id }));
  const choice = (item: string) => ({ optionId: keys[item]! });
  const items: TrainingItem[] = [
    { id: "training.s1.place", section: "s1", position: 1, mode: "live", answer: "point", scene: "s1", source: null, covariate: "point_visible", marks: [], options: [], key: { point: ll(place.key) },
      feedback: { ring: [ll(place.key)], numbers: { roadA: "R5", roadB: "R6" } } },
    { id: "training.s1.measure", section: "s1", position: 2, mode: "live", answer: "choice", scene: "s1", source: null, covariate: null, marks: [mark("s1_measure_a", "A", measure.a)], options: opts("training.s1.measure"), key: choice("training.s1.measure"),
      feedback: { line: [ll(measure.a), ll(measure.foot)], numbers: { m: measure.metres, road: measure.road } } },
    { id: "training.s1.slope", section: "s1", position: 3, mode: "live", answer: "choice", scene: "s1", source: null, covariate: null, optional: true,
      marks: [mark("s1_slope_a", "A", slope.a), mark("s1_slope_b", "B", slope.b), mark("s1_slope_c", "C", slope.c)], options: opts("training.s1.slope"), key: choice("training.s1.slope"),
      feedback: { line: [ll(slope.a), ll(slope.b)], numbers: { m: Math.round(slope.rise) } } },
    { id: "training.s1.water", section: "s1", position: 4, mode: "live", answer: "choice", scene: "s1", source: null, covariate: null,
      marks: [mark("s1_water_star", "★", water.star, "star"), mark("s1_water_1", "1", water.fill1, "water"), mark("s1_water_2", "2", water.fill2, "water")], options: opts("training.s1.water"), key: choice("training.s1.water"),
      feedback: { ring: [ll(water.fill2)], line: [ll(water.star), ll(water.fill1)], routes: [thin(water.route, 3).map(ll)], numbers: { a: water.straight1M, b: water.roadM, key: "2", other: "1" } } },
    { id: "training.s2.now", section: "s2", position: 5, mode: "live", answer: "choice", scene: "incident", source: "log", covariate: null, marks: [], options: opts("training.s2.now"), key: choice("training.s2.now"),
      feedback: { ring: [ll(fire.atRoad)], numbers: { road: "R5", mapped: FIRE.mapped, report: FIRE.report, from: "DR8" } } },
    { id: "training.s2.project", section: "s2", position: 6, mode: "live", answer: "point", scene: "incident", source: "reasoning", covariate: null, marks: [mark("s2_head", FIRE.report, fire.atRoad, "head")], options: [], key: { point: ll(fire.key) },
      feedback: { ring: [ll(fire.key)], line: [ll(fire.atRoad), ll(fire.key)], numbers: { m: Math.round(dist(fire.atRoad, fire.key) * s.mpp), dir: fire.dir.id, from: FIRE.report, to: FIRE.target, rate: FIRE.pxPerMin * s.mpp, minutes: FIRE.targetMin } } },
    { id: "training.s3.records1", section: "s3", position: 7, mode: "card", answer: "choice", scene: "incident", source: "records", covariate: "seek_first", marks: [], options: opts("training.s3.records1"), key: choice("training.s3.records1"),
      feedback: { numbers: { lureHa: ck.records1.lureLog, lureRecord: "trn.r03" } }, lesson: { questionId: "trn.q.dr8_1005", recordIds: ["trn.r06"] } },
    { id: "training.s3.older", section: "s3", position: 8, mode: "card", answer: "choice", scene: "incident", source: "log", covariate: null, marks: [], options: opts("training.s3.older"), key: choice("training.s3.older"),
      feedback: { numbers: { r6Dir: wording.r6Dir, blockedM: 300 } }, lesson: { questionId: "trn.q.r6_passable", recordIds: [ck.older.oldest, ck.older.newest] } },
    { id: "training.s3.records2", section: "s3", position: 9, mode: "card", answer: "choice", scene: "incident", source: "records", covariate: null, marks: [], options: opts("training.s3.records2"), key: choice("training.s3.records2"),
      feedback: { numbers: { lureRecord: "trn.r05" } }, lesson: { questionId: "trn.q.ek51_crew", recordIds: ["trn.r07"] } },
    { id: "training.s4.memory", section: "s4", position: 10, mode: "freeze", answer: "point", scene: "s1", source: "map", covariate: "point_memory", marks: [], options: [], key: { point: ll(memory.at) },
      feedback: { ring: [ll(memory.at)], numbers: { unit: "EK53" } }, memory: { unit: "EK53", at: ll(memory.at), exposureMs: MEMORY_MS } },
    { id: "training.s4.log", section: "s4", position: 11, mode: "freeze", answer: "choice", scene: "incident", source: "log", covariate: null, marks: [], options: opts("training.s4.log"), key: choice("training.s4.log"), feedback: { numbers: { record: "trn.r08" } } },
    { id: "training.s4.map", section: "s4", position: 12, mode: "freeze", answer: "choice", scene: "incident", source: "map", covariate: null, marks: [], options: opts("training.s4.map"), key: choice("training.s4.map"), feedback: { numbers: { side: fire.side } } },
    { id: "training.s4.records", section: "s4", position: 13, mode: "freeze", answer: "choice", scene: "incident", source: "records", covariate: null, marks: [], options: opts("training.s4.records"), key: choice("training.s4.records"),
      feedback: { numbers: {} }, lesson: { questionId: "trn.q.dr8_1005", recordIds: ["trn.r06"] } },
  ];
  const sections = (["s1", "s2", "s3", "s4", "s5"] as const).map((id) => ({ id, itemIds: items.filter((it) => it.section === id).map((it) => it.id) }));
  const corners = [{ x: square.x0, y: square.y0 }, { x: square.x1, y: square.y0 }, { x: square.x1, y: square.y1 }, { x: square.x0, y: square.y1 }].map(ll);
  const spec: TrainingSpec = {
    version: TRAINING_VERSION, capMs: CAP_MS, cardWindowMs: CARD_WINDOW_MS, demoMinDwellMs: DEMO_MIN_DWELL_MS, now: NOW,
    area: {
      bounds: { south: Math.min(...corners.map((c) => c.lat)), west: Math.min(...corners.map((c) => c.lon)), north: Math.max(...corners.map((c) => c.lat)), east: Math.max(...corners.map((c) => c.lon)) },
      lockMarginM: AREA.lockMarginM, centre: ll({ x: AREA.x0 + AREA.size / 2, y: AREA.y0 + AREA.size / 2 }),
    },
    roadLabels: labels.map((l) => ({ road: l.road, at: ll(l.at) })),
    scenes: trainingScenes({ edge: fire.polygon.map(ll), burnt: fire.burnt.map(ll), ek51: ll(fire.ek51), spreadDeg: fire.dir.deg, windMs: 3 }),
    items, sections,
  };

  const lineMin = Math.min(...[...others, memory.at, block.at, ...labels.map((l) => l.at), ...fire.burnt, fire.lure].map(s.lineM));
  if (lineMin < BAND_M) throw new Error(`training: a coordinate lies ${lineMin.toFixed(0)} m from the power line`);
  const { qualifying, considered, route: _route, ...waterFigures } = water;
  const key = {
    status: "The figures behind each key, computed by tools/review/training.ts (SPEC/08 (bp)); two people check them against the preview before use. The training shows each key in its feedback.",
    version: TRAINING_VERSION,
    area: { sitePx: square, siteM: { x: [7500, 10_000], y: [7500, 10_000] }, tm35: { east: [526_500, 529_000], north: [6_753_500, 6_756_000] }, lockMarginM: AREA.lockMarginM },
    contract: { lockMeets: met.met, squareMeets: metSquare.met, nearestOtherFromLock: met.nearestOther, nearestOtherFromSquare: metSquare.nearestOther },
    band: { metres: BAND_M, minClearanceM: Math.round(lineMin), roads: s.named.map((n) => ({ code: n.code, metres: Math.round(pathLengthM(n.piece.pts, s.mpp)), from: site(n.piece.pts[0]!), to: site(n.piece.pts.at(-1)!) })), junctions: s.junctions.map(site) },
    wording: { ...wording, marginsDeg: { lakeSide: lakeSide.marginDeg, tailEdge: tail.marginDeg, r6Dir: r6Dir.marginDeg } },
    items: {
      "training.s1.place": { key: site(place.key), nearestOtherJunctionM: place.nearestOtherJunctionM, insideLockM: place.insideLockM, lineM: place.lineM },
      "training.s1.measure": { key: keys["training.s1.measure"], a: site(measure.a), foot: site(measure.foot), road: measure.road, metres: measure.metres, offByPct: Math.round((Math.abs(measure.metres - measure.target) / measure.target) * 1000) / 10, nextRoadM: measure.nextRoadM, footFromEndsM: measure.footFromEndsM, footFromJunctionM: measure.footFromJunctionM, lineM: measure.lineM },
      "training.s1.slope": { key: "towards_b", a: site(slope.a), b: site(slope.b), c: site(slope.c), riseBm: Math.round(slope.rise * 10) / 10, slopeBPct: Math.round((slope.rise / slope.metresEach) * 1000) / 10, contourLevelsAB: slope.levels, levelCmaxDevM: Math.round(slope.flat * 10) / 10, apartDeg: slope.apartDeg, metresEach: slope.metresEach, lineM: slope.lineM },
      "training.s1.water": { key: "fill_2", star: site(water.star), fill1: site(water.fill1), fill2: site(water.fill2), ...numbersOf(waterFigures), routeVertices: water.route.length, qualifyingStars: `${qualifying} of ${considered}` },
      "training.s2.now": { key: "at_road", road: "R5", headAtRoad: site(fire.atRoad), drawnHead: site(fire.drawnHead), drawnHeadToRoadM: fire.drawnHeadToRoadM, polygonToRoadM: fire.polygonToRoadM, roadCrossingDeg: fire.crossDeg, direction: fire.dir.id, areaHa: fire.areaHa, fireToWaterM: fire.fireToWaterM, side: fire.side, lineM: fire.lineM },
      "training.s2.project": { key: site(fire.key), metres: Math.round(dist(fire.atRoad, fire.key) * s.mpp), lure: site(fire.lure), lureOffM: fire.lureOffM, keyToWaterM: fire.keyToWaterM, keyInsideLockM: fire.keyInsideLockM },
      "training.s3.records1": { key: keys["training.s3.records1"], keyRecord: "trn.r06", keyHa: ck.records1.key, lureLogHa: ck.records1.lureLog, lureOlderHa: ck.records1.lureOlder },
      "training.s3.older": { key: "blocked", newest: ck.older.newest, olderRecord: ck.older.oldest, blockedAt: site(block.at), blockedFromJunctionM: 300, bearingFromJunctionDeg: block.bearingDeg },
      "training.s3.records2": { key: keys["training.s3.records2"], keyRecord: "trn.r07", crew: ck.records2.key, lureOnLine: ck.records2.lure },
      "training.s4.memory": { key: site(memory.at), unit: "EK53", road: memory.road, toWaterM: memory.toWaterM, fromEndsM: memory.fromEndsM, fromJunctionM: memory.fromJunctionM, toOtherItemsM: memory.toOtherItemsM, insideLockM: memory.insideLockM, lineM: memory.lineM },
      "training.s4.log": { key: keys["training.s4.log"], record: "trn.r08", callers: ck.log.callers },
      "training.s4.map": { key: keys["training.s4.map"], polygonToRoadM: fire.polygonToRoadM, wholeOneSide: true },
      "training.s4.records": { key: keys["training.s4.records"], record: "trn.r06", metresPerMin: ck.ratePerMin },
    },
    optionOrder: Object.fromEntries(Object.entries(order).map(([item, ids]) => [item, { order: ids, keyPosition: ids.indexOf(keys[item]!) + 1 }])),
    roadLabels: labels.map((l) => ({ road: l.road, at: site(l.at), awayM: l.awayM })),
    ek51: site(fire.ek51),
  };
  const recordsEn = Object.fromEntries(Object.entries(en).sort(([a], [b]) => (a < b ? -1 : 1)));
  return { spec, key, corpus, recordsEn, preview: previewSvg(spec, s, key.items, TILE_HREF) };
}

function areaCentroid(r: Ring): Px {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const c = r[j]![0] * r[i]![1] - r[i]![0] * r[j]![1]; a += c; cx += (r[j]![0] + r[i]![0]) * c; cy += (r[j]![1] + r[i]![1]) * c; }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}
const pathLengthM = (ps: readonly Px[], mpp: number) => ps.reduce((sum, p, i) => (i === 0 ? 0 : sum + dist(ps[i - 1]!, p)), 0) * mpp;
/** Every `n`-th point of a path, its ends kept (the route drawn in the feedback). */
const thin = (ps: readonly Px[], n: number): Px[] => ps.filter((_, i) => i % n === 0 || i === ps.length - 1);
/** The numeric fields of a key's figures (its points are written as site metres beside them). */
function numbersOf(o: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "number").map(([k, v]) => [k, v]));
}

export const json = (v: unknown): string => `${JSON.stringify(v, null, 1)}\n`;

/** The files the build writes, by path from the project root. */
export function trainingFiles(b: TrainingBuild): Readonly<Record<string, string>> {
  return {
    "content/training/incident.json": json(b.spec),
    "content/training/key.json": json(b.key),
    "content/training/corpus.json": json(b.corpus),
    "content/training/records.en.json": json(b.recordsEn),
    [PREVIEW_PATH]: b.preview,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const files = trainingFiles(buildTraining(root));
  for (const [path, body] of Object.entries(files)) { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), body); }
  console.log(Object.keys(files).join("\n"));
}
