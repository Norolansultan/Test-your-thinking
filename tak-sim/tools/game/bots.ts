/**
 * Game mode (SPEC/29) balance bots: scripted players that drive a `Game` through its public API only
 * (`state`, `issue`, `tick`) — the yardsticks of `npm run game:balance` and the balance regression test.
 *
 *  - `idle`: never gives an order.
 *  - `naive`: every 10 game-min sends every free ground unit to `attack` the scenario's first ignition
 *    point, the aircraft to `drop` there and the drones to `recon` there (a player who never looks at
 *    the map again).
 *  - `competent`: every 5 game-min reads the player's fogged picture (`state.known`) — not the fire —
 *    finds the active front (burning, seen in the last 15 min), clusters it (300 m), sends the nearest
 *    free crews to the edge nearest the protected settlement and to the head, lays hose lines from
 *    forest units at natural water toward the front, keeps the tanker shuttling to the busiest engine,
 *    drops on the head, keeps drones over the largest fire and over spot fires and the rest patrolling
 *    the burned area, sends a crew to protect the settlement when fire is within 1 km of it, and mops
 *    up what still smoulders once the flames are out. Reasonable, not omniscient.
 *
 * Deterministic (no randomness, no wall clock): the same scenario, seed and strategy play the same game.
 */

import { CELL, type Game, type GameScenario, type GameWorld, type Order, type Unit, type XY } from "../../app/game/contracts.js";
import { createGame } from "../../app/game/sim/game.js";
import type { GameDeps } from "../../app/game/sim/ports.js";
import { clockLabel, insideMap, windToVector } from "../../app/game/sim/geom.js";

export type StrategyId = "idle" | "naive" | "competent";
export const STRATEGY_IDS: readonly StrategyId[] = ["idle", "naive", "competent"];

/** A scripted player: `decide` is called every `everyS` seconds of game time (and once at the start). */
export interface Bot {
  readonly id: StrategyId;
  readonly everyS: number;
  decide(game: Game): void;
}

const GROUND_ATTACK = new Set<Unit["kind"]>(["engine", "volunteer", "forest_unit"]);
const RECON = new Set<Unit["kind"]>(["drone_thermal", "drone_vtol", "spotter"]);
const DROPPERS = new Set<Unit["kind"]>(["helicopter", "drone_water"]);

const d2 = (a: XY, b: XY): number => Math.hypot(a.x - b.x, a.y - b.y);
/** Unit ids in code-point order (no locale). */
const byId = (a: { readonly id: string }, b: { readonly id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const onScene = (u: Unit): boolean => u.status !== "en_route" && u.status !== "out_of_action";

// ---------------------------------------------------------------------------------------------
// idle and naive
// ---------------------------------------------------------------------------------------------

export function idleBot(): Bot {
  return { id: "idle", everyS: 3600, decide: () => undefined };
}

/** SPEC/29 balance: the "naive" player — everything at the first ignition point, every 10 minutes. */
export function naiveBot(): Bot {
  return {
    id: "naive",
    everyS: 600,
    decide(game) {
      const at = game.scenario.ignitions[0] ?? game.world.commandPost;
      for (const u of game.state.units) {
        if (!onScene(u)) continue;
        if (u.order !== null && u.order.type !== "hold") continue;
        if (GROUND_ATTACK.has(u.kind) || u.kind === "tanker") game.issue(u.id, { type: "attack", target: at });
        else if (DROPPERS.has(u.kind)) game.issue(u.id, { type: "drop", target: at });
        else if (RECON.has(u.kind)) game.issue(u.id, { type: "recon", centre: at });
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// competent
// ---------------------------------------------------------------------------------------------

/** Burning cells seen within this long count as the active front, s. */
export const FRONT_FRESH_S = 900;
/** Front cells this close belong to one fire, m. */
export const CLUSTER_M = 300;
/** A crew's target is still live while known front lies this close to it, m. */
const TARGET_LIVE_M = 250;
/** Two crews' targets on one fire are at least this far apart, m. */
const TARGET_SPACING_M = 150;
/** Fire this close to the protected settlement sends a crew to protect it, m. */
const PROTECT_TRIGGER_M = 1000;
/** A forest unit lays hose from natural water when the front is this close to it, m. */
const HOSE_MAX_M = 900;
/** A drop is re-aimed when the head moved more than this, m. */
const REAIM_M = 150;

interface Cluster {
  readonly cells: number[];
  readonly centre: XY;
  /** The front cell furthest downwind. */
  readonly head: XY;
  /** Distance of the cluster's nearest cell to the protected place, m. */
  readonly nearM: number;
}

interface Picture {
  readonly front: number[];
  readonly smoulder: number[];
  readonly clusters: Cluster[];
  /** Everything ever seen burned or burning (for patrols). */
  readonly burnedCentre: XY | null;
  readonly burnedRadiusM: number;
}

function cellXY(world: GameWorld, cell: number): XY {
  const { cols, rows, cellM } = world.grid;
  const col = cell % cols;
  const row = Math.floor(cell / cols);
  return { x: (col + 0.5) * cellM, y: (rows - row - 0.5) * cellM };
}

/** Single-linkage clusters of cells within `linkM` (bucketed; deterministic: cells ascending). */
function clusterCells(world: GameWorld, cells: readonly number[], linkM: number): number[][] {
  const n = cells.length;
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const pts = cells.map((c) => cellXY(world, c));
  const buckets = new Map<number, number[]>();
  const key = (bx: number, by: number): number => bx * 100_003 + by;
  pts.forEach((p, i) => {
    const k = key(Math.floor(p.x / linkM), Math.floor(p.y / linkM));
    const b = buckets.get(k);
    if (b === undefined) buckets.set(k, [i]);
    else b.push(i);
  });
  pts.forEach((p, i) => {
    const bx = Math.floor(p.x / linkM);
    const by = Math.floor(p.y / linkM);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of buckets.get(key(bx + dx, by + dy)) ?? []) {
          if (j <= i || d2(p, pts[j]!) > linkM) continue;
          const a = find(i);
          const b = find(j);
          if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
        }
      }
    }
  });
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const g = groups.get(r);
    if (g === undefined) groups.set(r, [cells[i]!]);
    else g.push(cells[i]!);
  }
  return [...groups.keys()].sort((a, b) => a - b).map((k) => groups.get(k)!);
}

function protectedPlace(game: Game): { id: string | null; at: XY } {
  for (const o of game.scenario.objectives) {
    if (o.kind !== "protect_settlement") continue;
    const s = game.world.settlements.find((x) => x.id === o.settlementId);
    if (s !== undefined) return { id: s.id, at: s.centre };
  }
  return { id: null, at: game.scenario.ignitions[0] ?? game.world.commandPost };
}

function readPicture(game: Game, place: XY): Picture {
  const st = game.state;
  const world = game.world;
  const fresh = st.tS - FRONT_FRESH_S;
  const front: number[] = [];
  const smoulder: number[] = [];
  let sx = 0;
  let sy = 0;
  let nb = 0;
  const burnedPts: XY[] = [];
  for (let c = 0; c < st.known.length; c++) {
    const k = st.known[c]!;
    if (k === CELL.burning || k === CELL.smouldering || k === CELL.burnedOut || k === CELL.extinguished) {
      const p = cellXY(world, c);
      sx += p.x;
      sy += p.y;
      nb++;
      if ((nb & 7) === 0) burnedPts.push(p);
    }
    if (k === CELL.burning && st.knownAtS[c]! >= fresh) front.push(c);
    else if (k === CELL.smouldering) smoulder.push(c);
  }
  const wTo = windToVector(st.weather.windFromDeg);
  const clusters: Cluster[] = clusterCells(world, front, CLUSTER_M).map((cells) => {
    let cx = 0;
    let cy = 0;
    let near = Infinity;
    for (const c of cells) {
      const p = cellXY(world, c);
      cx += p.x;
      cy += p.y;
      near = Math.min(near, d2(p, place));
    }
    const centre = { x: cx / cells.length, y: cy / cells.length };
    let head = centre;
    let best = -Infinity;
    for (const c of cells) {
      const p = cellXY(world, c);
      const proj = (p.x - centre.x) * wTo.x + (p.y - centre.y) * wTo.y;
      if (proj > best) { best = proj; head = p; }
    }
    return { cells, centre, head, nearM: near };
  });
  clusters.sort((a, b) => b.cells.length - a.cells.length || a.nearM - b.nearM);
  const burnedCentre = nb > 0 ? { x: sx / nb, y: sy / nb } : null;
  let radius = 0;
  if (burnedCentre !== null) for (const p of burnedPts) radius = Math.max(radius, d2(p, burnedCentre));
  return { front, smoulder, clusters, burnedCentre, burnedRadiusM: radius };
}

/** The water point nearest `p` that a vehicle can reach by road and that lies on the map. */
function nearestRoadWater(world: GameWorld, p: XY): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const w of world.waterPoints) {
    if (w.roadNode === null || !insideMap(world.grid, w.at)) continue;
    const d = d2(w.at, p);
    if (d < bestD) { bestD = d; best = w.id; }
  }
  return best;
}

function targetOf(o: Order | null): XY | null {
  if (o === null) return null;
  switch (o.type) {
    case "attack": return o.target;
    case "drop": return o.target;
    case "recon": return o.centre;
    case "hose_line": return o.to;
    case "move": return o.to;
    default: return null;
  }
}

/** Whether any of `cells` lies within `r` of `p`. */
function anyNear(world: GameWorld, cells: readonly number[], p: XY, r: number): boolean {
  for (const c of cells) if (d2(cellXY(world, c), p) <= r) return true;
  return false;
}

/** SPEC/29 balance: the "competent" player (see the file header). */
export function competentBot(): Bot {
  const lastDrop = new Map<string, XY>();
  return {
    id: "competent",
    everyS: 300,
    decide(game) {
      const st = game.state;
      const world = game.world;
      const place = protectedPlace(game);
      const pic = readPicture(game, place.at);
      const wTo = windToVector(st.weather.windFromDeg);
      const units = st.units.filter(onScene);
      const busy = new Set<string>();

      // Targets on the edge: cells nearest the protected place first, the head next.
      const liveCells = pic.front.length > 0 ? pic.front : pic.smoulder;
      const clusterOf = new Map<number, Cluster>();
      for (const k of pic.clusters) for (const c of k.cells) clusterOf.set(c, k);
      const scored = liveCells.map((c) => {
        const p = cellXY(world, c);
        const cl = clusterOf.get(c);
        const proj = cl === undefined ? 0 : (p.x - cl.centre.x) * wTo.x + (p.y - cl.centre.y) * wTo.y;
        return { c, p, score: d2(p, place.at) - 0.8 * proj };
      }).sort((a, b) => a.score - b.score || a.c - b.c);

      // 1. Structure protection when the fire is within 1 km of the settlement.
      const threat = place.id !== null && anyNear(world, pic.front, place.at, PROTECT_TRIGGER_M);
      if (place.id !== null) {
        const protecting = units.filter((u) => u.order?.type === "protect");
        for (const u of protecting) busy.add(u.id);
        if (threat && protecting.length === 0) {
          const cands = units.filter((u) => u.kind === "engine" || u.kind === "volunteer" || u.kind === "tanker")
            .filter((u) => u.status !== "refilling")
            .sort((a, b) => d2(a.pos, place.at) - d2(b.pos, place.at) || byId(a, b));
          const pick = cands.find((u) => u.kind !== "tanker") ?? cands[0];
          if (pick !== undefined && game.issue(pick.id, { type: "protect", assetOrSettlementId: place.id }).ok) busy.add(pick.id);
        }
      }

      // 2. Ground crews: who is free?
      const isFree = (u: Unit): boolean => {
        if (busy.has(u.id)) return false;
        if (u.status === "refilling" || u.status === "returning") return false;
        const o = u.order;
        if (o === null || o.type === "hold") return true;
        if (o.type === "protect") return false;
        if (o.type === "fire_break") return false;
        const t = targetOf(o);
        if (t === null) return true;
        if (o.type === "hose_line") return !anyNear(world, liveCells, t, 400) && u.status !== "moving";
        if (o.type === "attack") {
          if (!anyNear(world, liveCells, t, TARGET_LIVE_M)) return true;
          return u.status === "idle"; // standing by: too hot, or nothing it can work
        }
        return u.status === "idle";
      };
      const crews = units.filter((u) => GROUND_ATTACK.has(u.kind));
      const taken: XY[] = [];
      for (const u of crews) {
        if (isFree(u)) continue;
        const t = targetOf(u.order);
        if (t !== null) taken.push(t);
        busy.add(u.id);
      }
      let free = crews.filter((u) => !busy.has(u.id));

      // Forest units: a hose line from natural water toward the front when it is within reach.
      for (const u of free.filter((x) => x.kind === "forest_unit")) {
        let best: { to: XY; d: number } | null = null;
        for (const s of scored.slice(0, 200)) {
          for (const w of world.waterPoints) {
            if (!insideMap(world.grid, w.at)) continue;
            const d = d2(w.at, s.p);
            if (d > HOSE_MAX_M) continue;
            if (taken.some((t) => d2(t, s.p) < TARGET_SPACING_M)) continue;
            if (best === null || d < best.d) best = { to: s.p, d };
          }
        }
        if (best !== null && pic.front.length > 0 && game.issue(u.id, { type: "hose_line", to: best.to }).ok) {
          taken.push(best.to);
          busy.add(u.id);
        }
      }
      free = free.filter((u) => !busy.has(u.id));

      // Everyone else free: direct attack, spread along the edge, nearest crew to each target.
      for (const s of scored) {
        if (free.length === 0) break;
        if (taken.some((t) => d2(t, s.p) < TARGET_SPACING_M)) continue;
        free.sort((a, b) => d2(a.pos, s.p) - d2(b.pos, s.p) || byId(a, b));
        const u = free[0]!;
        if (u.waterMaxL > 0 && u.waterL < u.waterMaxL * 0.1 && u.kind !== "forest_unit") {
          const wp = nearestRoadWater(world, u.pos);
          if (wp !== null) game.issue(u.id, { type: "refill", waterPointId: wp });
          free.shift();
          continue;
        }
        if (game.issue(u.id, { type: "attack", target: s.p }).ok) taken.push(s.p);
        free.shift();
      }
      // More crews than spaced targets (a small fire): the rest join the best targets, nearest first.
      for (let i = 0; free.length > 0 && scored.length > 0; i++) {
        const s = scored[i % Math.min(3, scored.length)]!;
        free.sort((a, b) => d2(a.pos, s.p) - d2(b.pos, s.p) || byId(a, b));
        const u = free.shift()!;
        game.issue(u.id, { type: "attack", target: s.p });
      }

      // 3. Tankers: keep the busiest engine supplied.
      const tankers = units.filter((u) => u.kind === "tanker" && !busy.has(u.id));
      const engines = crews.filter((u) => u.kind !== "forest_unit" && u.order !== null && (u.order.type === "attack" || u.order.type === "protect"))
        .sort((a, b) => a.waterL / Math.max(1, a.waterMaxL) - b.waterL / Math.max(1, b.waterMaxL) || byId(a, b));
      const supplied = new Set<string>();
      for (const t of tankers) {
        const o = t.order;
        if (o !== null && o.type === "shuttle") {
          const cur = st.units.find((x) => x.id === o.toUnitId);
          if (cur !== undefined && onScene(cur) && cur.order !== null && cur.order.type !== "hold") {
            supplied.add(cur.id);
            continue;
          }
        }
        const target = engines.find((e) => !supplied.has(e.id));
        if (target === undefined) continue;
        const wp = nearestRoadWater(world, target.pos);
        if (wp !== null && game.issue(t.id, { type: "shuttle", waterPointId: wp, toUnitId: target.id }).ok) supplied.add(target.id);
      }

      // 4. Aircraft with water: the head of the fire nearest the settlement; the water drone takes spot fires.
      const main = [...pic.clusters].sort((a, b) => a.nearM - b.nearM || b.cells.length - a.cells.length)[0];
      const spots = pic.clusters.filter((c) => c.cells.length <= 30);
      for (const u of units.filter((x) => DROPPERS.has(x.kind))) {
        const cl = u.kind === "drone_water" && spots.length > 0 ? spots[0]! : main;
        if (cl === undefined) continue;
        const aim = cl.head;
        const prev = lastDrop.get(u.id);
        if (u.order !== null && u.order.type === "drop" && prev !== undefined && d2(prev, aim) <= REAIM_M) continue;
        if (game.issue(u.id, { type: "drop", target: aim }).ok) lastDrop.set(u.id, aim);
      }

      // 5. Eyes: thermal drones over the largest fire and the spot fires; the wide sensors patrol the burned area.
      const recon = units.filter((x) => RECON.has(x.kind)).sort((a, b) => byId(a, b));
      const looks: XY[] = pic.clusters.map((c) => c.centre);
      let k = 0;
      for (const u of recon) {
        let centre: XY | null;
        if (u.kind === "drone_thermal") {
          centre = looks.length > 0 ? looks[k % looks.length]! : pic.burnedCentre;
          k++;
        } else {
          centre = pic.burnedCentre ?? game.scenario.ignitions[0] ?? null;
        }
        if (centre === null) continue;
        const cur = targetOf(u.order);
        if (u.order?.type === "recon" && cur !== null && d2(cur, centre) <= 200) continue;
        game.issue(u.id, { type: "recon", centre });
      }
    },
  };
}

export function makeBot(id: StrategyId): Bot {
  switch (id) {
    case "idle": return idleBot();
    case "naive": return naiveBot();
    case "competent": return competentBot();
  }
}

// ---------------------------------------------------------------------------------------------
// Playing a game
// ---------------------------------------------------------------------------------------------

export interface PlayResult {
  readonly scenario: string;
  readonly strategy: StrategyId;
  readonly seed: number;
  readonly phase: string;
  readonly clock: string;
  readonly tS: number;
  readonly burnedHa: number;
  readonly assetsLost: number;
  readonly settlementsLost: number;
  readonly casualties: number;
  readonly points: number;
  readonly grade: string;
  readonly containedClock: string | null;
  readonly objectives: string;
  readonly commands: number;
  /** How close the fire came to the protected settlement's centre, m (null: no such settlement). */
  readonly nearestToSettlementM: number | null;
}

export interface PlayOptions {
  /** Game seconds per `tick` call (the decision interval is rounded to it). Default 60. */
  readonly tickS?: number;
}

/** How close any cell the fire reached lies to the protected settlement (the truth, for the report only), m. */
export function closestApproach(game: Game): number | null {
  const place = protectedPlace(game);
  if (place.id === null) return null;
  const st = game.state.fire.state;
  let best = Infinity;
  for (let c = 0; c < st.length; c++) {
    const v = st[c]!;
    if (v === CELL.burning || v === CELL.smouldering || v === CELL.burnedOut || v === CELL.extinguished) best = Math.min(best, d2(cellXY(game.world, c), place.at));
  }
  return Number.isFinite(best) ? Math.round(best) : null;
}

/** Plays one game with a bot to its end (won, lost or the end time). */
export function playGame(scenario: GameScenario, world: GameWorld, deps: GameDeps, seed: number, strategy: StrategyId, opts: PlayOptions = {}): PlayResult {
  const tickS = opts.tickS ?? 60;
  const game = createGame(scenario, world, seed, deps);
  const bot = makeBot(strategy);
  game.tick(10);
  let nextDecision = 0;
  while (game.state.phase === "running") {
    if (game.state.tS >= nextDecision) {
      bot.decide(game);
      nextDecision = game.state.tS + bot.everyS;
    }
    game.tick(tickS);
  }
  const s = game.state.score;
  const objectives = s.objectives.map((o) => `${o.objective.kind.slice(0, 4)}:${o.met === true ? "y" : o.met === false ? "n" : "?"}`).join(" ");
  return {
    scenario: game.scenario.id,
    strategy,
    seed,
    phase: game.state.phase,
    clock: game.state.clockLabel,
    tS: game.state.tS,
    burnedHa: s.burnedHa,
    assetsLost: s.assetsLost,
    settlementsLost: s.settlementsLost.length,
    casualties: s.casualties,
    points: s.points,
    grade: s.grade,
    containedClock: s.containedAtS === null ? null : clockLabel(game.scenario.startClockMin, s.containedAtS),
    objectives,
    commands: game.commands.length,
    nearestToSettlementM: closestApproach(game),
  };
}
