/**
 * Game mode (SPEC/29 contracts): the game loop. `createGame` binds a scenario to a world, a seed and
 * the world/fire/weather ports; `tick` advances game time in fixed `SIM_STEP_S` steps; `issue`
 * validates and applies an order and logs it for replay. Everything runs on virtual time and integer
 * hashing only, so the same scenario, seed and command log replay the same game (`replay`).
 *
 * Each step: weather → scenario events → arrivals → unit behaviours → fire step → buildings and crew
 * safety → clock → fog of war → radio → objectives, score and phase.
 */

import { SIM_STEP_S, type AssetStatus, type FireStepReport, type Game, type GameCommand, type GamePhase, type GameScenario, type GameState, type GameWorld, type Order, type ScenarioEvent, type ScenarioUnit, type Score, type XY } from "../contracts.js";
import { stepAir } from "./air.js";
import { runEvent, periodicRadio, SITREP_EVERY_S } from "./events.js";
import { FireIndex } from "./fire-index.js";
import { Fog } from "./fog.js";
import { clockLabel } from "./geom.js";
import { stepGround } from "./ground.js";
import { AssetWatch, stepCrewSafety } from "./hazards.js";
import type { GameDeps } from "./ports.js";
import { RadioLog } from "./radio.js";
import { resolveScenario } from "./resolve.js";
import { active, resetBehaviour, say, toUnit, unitSay, type Ctx, type UnitRt } from "./runtime.js";
import { CONTAIN_CONFIRM_S, failedForGood, gradeFor, objectiveWhy, pointsFor, updateObjectives, type ObjectiveStatus } from "./score.js";
import { resumePhase } from "./support.js";
import { T } from "./texts.js";
import { specOf } from "./unit-specs.js";
import { resolveProtectId, validateOrder, type IssueResult } from "./validate.js";

const DRONES = new Set(["drone_thermal", "drone_vtol", "drone_water"]);

function entryPoint(world: GameWorld, su: ScenarioUnit): XY {
  const n = world.entryNodes.length;
  if (n === 0) return world.commandPost;
  const i = su.entryNode === undefined ? 0 : ((Math.trunc(su.entryNode) % n) + n) % n;
  return world.roads.nodes[world.entryNodes[i]!] ?? world.commandPost;
}

function makeUnit(world: GameWorld, su: ScenarioUnit, index: number): UnitRt {
  const spec = specOf(su.kind);
  const entry = entryPoint(world, su);
  const onScene = su.arriveAtS <= 0;
  // Units on scene at the start wait at the command post (unless a scenario names their entry);
  // the drone team sets up at the command post; everyone else comes in by road at an entry node.
  const start = DRONES.has(su.kind) || (onScene && su.entryNode === undefined) ? world.commandPost : entry;
  return {
    id: su.id, kind: su.kind, spec, index, arriveAtS: su.arriveAtS, entry,
    pos: start,
    status: onScene ? "idle" : "en_route",
    order: null,
    waterL: spec.air ? 0 : spec.waterL,
    energyPct: 100,
    harm: 0,
    hoseLine: null,
    etaS: onScene ? null : su.arriveAtS,
    legs: [], dest: null, phase: "none", workCell: -1, workAt: null, prevOrder: null,
    hoseAnchor: null, hoseTip: null, hoseNatural: false, hoseCells: null,
    breakCells: null, breakNext: 0, breakProgressM: 0,
    orbitAngle: 0, phaseUntilS: 0, logistics: null, retreatTo: null, retreatUntilS: -1,
    airborne: false, recalled: false, casualty: false,
    onSceneSinceS: Math.max(0, su.arriveAtS),
    lastSitrepS: -((index * 97) % SITREP_EVERY_S),
    said: new Set<string>(),
  };
}

class GameImpl implements Game {
  readonly scenario: GameScenario;
  readonly world: GameWorld;
  private readonly ctx: Ctx;
  private readonly fog: Fog;
  private readonly assetWatch: AssetWatch;
  private readonly events: ScenarioEvent[];
  private readonly objectives: ObjectiveStatus[];
  private readonly cmds: GameCommand[] = [];
  private phase: GamePhase = "briefing";
  private acc = 0;
  private nextEvent = 0;
  private casualties = 0;
  private containedAtS: number | null = null;
  private containedSinceS: number | null = null;
  private score: Score;
  private snapshot: GameState | null = null;

  constructor(scenario: GameScenario, world: GameWorld, seed: number, private readonly deps: GameDeps) {
    this.scenario = resolveScenario(scenario, world);
    this.world = world;
    const fire = deps.createFire(world, seed);
    const ignitionCells: number[] = [];
    for (const p of this.scenario.ignitions) {
      const c = deps.cellOf(world.grid, p);
      if (c !== null && fire.ignite(c)) ignitionCells.push(c);
    }
    const units = this.scenario.units.map((su, i) => makeUnit(world, su, i));
    const unitById = new Map<string, UnitRt>();
    for (const u of units) unitById.set(u.id, u);
    this.ctx = {
      scenario: this.scenario, world, deps, fire,
      fireIdx: new FireIndex(fire, world.grid, deps.cellCentre),
      radio: new RadioLog(), seed, units, unitById,
      tS: 0,
      weather: deps.weatherAt(this.scenario.weather, 0),
      powerLineLive: this.scenario.powerLineLiveAtStart,
      protectedUntil: new Map<string, number>(),
      burnedAssets: new Set<string>(),
    };
    this.fog = new Fog(world.grid.cols * world.grid.rows);
    this.fog.reveal(this.ctx, ignitionCells);
    this.fog.observeAll(this.ctx);
    this.assetWatch = new AssetWatch(this.ctx);
    this.events = this.scenario.events.map((e, i) => ({ e, i })).sort((a, b) => a.e.atS - b.e.atS || a.i - b.i).map((x) => x.e);
    this.objectives = this.scenario.objectives.map((objective) => ({ objective, met: null }));
    const w = this.ctx.weather;
    say(this.ctx, { from: "SÄÄ", room: "support", text: { fi: `SÄÄ: ${deps.describeWeatherFi(w)}`, en: `WEATHER: ${deps.describeWeatherEn(w)}` }, priority: "routine", key: "weather", force: true });
    this.score = this.computeScore(false);
  }

  get commands(): readonly GameCommand[] {
    return this.cmds;
  }

  get state(): GameState {
    if (this.snapshot === null) {
      const ctx = this.ctx;
      this.snapshot = {
        tS: ctx.tS,
        clockLabel: clockLabel(this.scenario.startClockMin, ctx.tS),
        phase: this.phase,
        weather: ctx.weather,
        fire: ctx.fire,
        units: ctx.units.map(toUnit),
        known: this.fog.known,
        knownAtS: this.fog.knownAtS,
        powerLineLive: ctx.powerLineLive,
        assetStatus: assetStatusOf(this.world.assets, ctx.burnedAssets, ctx.protectedUntil, ctx.tS),
        radio: ctx.radio.messages.slice(),
        score: this.score,
      };
    }
    return this.snapshot;
  }

  tick(dtS: number): void {
    if (!Number.isFinite(dtS) || dtS <= 0) return;
    if (this.phase === "briefing") this.phase = "running";
    if (this.phase !== "running") return;
    this.acc += dtS;
    while (this.acc >= SIM_STEP_S - 1e-6 && this.phase === "running") {
      this.acc -= SIM_STEP_S;
      this.step();
    }
    if (this.phase !== "running") this.acc = 0;
    this.snapshot = null;
  }

  issue(unitId: string, order: Order): IssueResult {
    const u = this.ctx.unitById.get(unitId);
    const v = validateOrder(this.ctx, this.phase, unitId, u, order);
    if (!v.ok || u === undefined) return v;
    let stored: Order = order;
    if (order.type === "protect") {
      const id = resolveProtectId(this.ctx, order.assetOrSettlementId);
      if (id !== null && id !== order.assetOrSettlementId) stored = { type: "protect", assetOrSettlementId: id };
    }
    if (stored.type === "refill") {
      // A water run keeps the laid hose and the task it interrupts, and goes back to it when full.
      const cur = u.order;
      if (cur !== null && cur.type !== "refill" && cur.type !== "move" && cur.type !== "hold") u.prevOrder = cur;
      else if (cur === null || cur.type !== "refill") u.prevOrder = null;
      u.order = stored;
      u.logistics = { kind: "refill", waterPointId: stored.waterPointId, phase: "to_water" };
      u.legs = [];
      u.dest = null;
      u.retreatTo = null;
      u.retreatUntilS = -1;
      u.phase = resumePhase(u.prevOrder);
    } else {
      resetBehaviour(u);
      u.prevOrder = null;
      u.order = stored;
    }
    this.cmds.push({ atS: this.ctx.tS, unitId, order: stored });
    this.snapshot = null;
    return { ok: true };
  }

  private step(): void {
    const ctx = this.ctx;
    const dt = SIM_STEP_S;
    while (this.nextEvent < this.events.length && this.events[this.nextEvent]!.atS <= ctx.tS) {
      runEvent(ctx, this.fog, this.events[this.nextEvent]!);
      this.nextEvent++;
    }
    for (const u of ctx.units) if (u.status === "en_route" && !u.recalled && u.arriveAtS <= ctx.tS) this.arrive(u);
    for (const u of ctx.units) {
      if (!active(u)) continue;
      if (u.spec.air) stepAir(ctx, u, dt);
      else stepGround(ctx, u, dt);
    }
    const report: FireStepReport = ctx.fire.step(dt, ctx.weather);
    ctx.fireIdx.noteReport(report);
    ctx.fireIdx.refresh();
    this.assetWatch.step();
    for (const u of ctx.units) if (stepCrewSafety(ctx, u, dt)) this.casualties++;
    ctx.tS += dt;
    ctx.weather = this.deps.weatherAt(this.scenario.weather, ctx.tS);
    this.fog.observeAll(ctx);
    periodicRadio(ctx, this.fog, report);
    this.evaluate();
  }

  private arrive(u: UnitRt): void {
    u.status = u.order === null ? "idle" : "moving";
    u.etaS = null;
    u.onSceneSinceS = this.ctx.tS;
    u.lastSitrepS = this.ctx.tS;
    say(this.ctx, unitSay(u, { text: T.arrived(), priority: "important", key: "arrived", room: "command", at: u.pos }));
  }

  private evaluate(): void {
    const ctx = this.ctx;
    const idx = ctx.fireIdx;
    const containedNow = idx.everBurnedCells() > 0 && idx.burningCount() === 0;
    if (containedNow) {
      if (this.containedAtS === null) {
        this.containedAtS = ctx.tS;
        const t = T.contained(clockLabel(this.scenario.startClockMin, ctx.tS));
        say(ctx, { from: "P3", room: "command", text: { fi: `P3: ${t.fi}`, en: `P3: ${t.en}` }, priority: "important", key: "contained", force: true });
      }
      this.containedSinceS ??= ctx.tS;
    } else {
      this.containedSinceS = null;
    }
    const facts = { tS: ctx.tS, burnedHa: idx.everBurnedHa(), casualties: this.casualties, settlementsLost: this.assetWatch.lostSettlements, containedNow };
    updateObjectives(this.objectives, facts, false);
    const failed = failedForGood(this.objectives);
    if (failed !== undefined) {
      updateObjectives(this.objectives, facts, true);
      this.phase = "lost";
      const why = objectiveWhy(failed.objective, (id) => {
        const s = this.world.settlements.find((x) => x.id === id);
        return { fi: s?.nameFi ?? id, en: s?.nameEn ?? id };
      });
      const t = T.lost(why.fi, why.en);
      say(ctx, { from: "P3", room: "command", text: { fi: `P3: ${t.fi}`, en: `P3: ${t.en}` }, priority: "urgent", key: "phase", force: true });
    } else if (this.containedSinceS !== null && ctx.tS - this.containedSinceS >= CONTAIN_CONFIRM_S && !this.objectives.some((o) => o.met === false)) {
      updateObjectives(this.objectives, facts, true);
      if (this.objectives.every((o) => o.met === true)) this.finish("won");
    }
    if (this.phase === "running" && ctx.tS >= this.scenario.endAtS) {
      updateObjectives(this.objectives, facts, true);
      this.finish(this.objectives.every((o) => o.met === true) ? "won" : "ended");
    }
    this.score = this.computeScore(containedNow);
  }

  private finish(phase: "won" | "ended"): void {
    this.phase = phase;
    const t = phase === "won" ? T.won() : T.ended(clockLabel(this.scenario.startClockMin, this.ctx.tS));
    say(this.ctx, { from: "P3", room: "command", text: { fi: `P3: ${t.fi}`, en: `P3: ${t.en}` }, priority: "important", key: "phase", force: true });
  }

  private computeScore(containedNow: boolean): Score {
    const idx = this.ctx.fireIdx;
    const burnedHa = Math.round(idx.everBurnedHa() * 100) / 100;
    const met = this.objectives.filter((o) => o.met === true).length;
    const points = pointsFor({
      burnedHa,
      lostAssetValue: this.assetWatch.lostValue,
      casualties: this.casualties,
      settlementsLost: this.assetWatch.lostSettlements.length,
      containedAtS: this.containedAtS,
      containedNow,
      endAtS: this.scenario.endAtS,
      objectivesMet: met,
    });
    const assetsLost = this.ctx.burnedAssets.size;
    return {
      burnedHa,
      assetsLost,
      assetsTotal: this.world.assets.length,
      settlementsLost: this.assetWatch.lostSettlements.slice(),
      casualties: this.casualties,
      containedAtS: this.containedAtS,
      points,
      grade: gradeFor({ points, allObjectivesMet: this.objectives.length > 0 && this.objectives.every((o) => o.met === true), casualties: this.casualties, assetsLost, phase: this.phase }),
      objectives: this.objectives.map((o) => ({ objective: o.objective, met: o.met })),
    };
  }
}

/** A new game: the scenario bound to the world (settlement names resolved), the fire lit, units placed. */
export function createGame(scenario: GameScenario, world: GameWorld, seed: number, deps: GameDeps): Game {
  return new GameImpl(scenario, world, seed, deps);
}

/** Replays a command log: the same scenario, world, seed and commands give the same game at `untilS`. */
export function replay(scenario: GameScenario, world: GameWorld, seed: number, deps: GameDeps, commands: readonly GameCommand[], untilS: number): Game {
  const g = createGame(scenario, world, seed, deps);
  const ordered = commands.map((c, i) => ({ c, i })).sort((a, b) => a.c.atS - b.c.atS || a.i - b.i).map((x) => x.c);
  for (const c of ordered) {
    if (c.atS > untilS) break;
    const dt = c.atS - g.state.tS;
    if (dt > 0) g.tick(dt);
    g.issue(c.unitId, c.order);
  }
  const rest = untilS - g.state.tS;
  if (rest > 0) g.tick(rest);
  return g;
}

/** The screen's view of the structures (contract `GameState.assetStatus`), in world order. */
function assetStatusOf(assets: GameWorld["assets"], burned: ReadonlySet<string>, protectedUntil: ReadonlyMap<string, number>, tS: number): Record<string, AssetStatus> {
  const out: Record<string, AssetStatus> = {};
  for (const a of assets) out[a.id] = burned.has(a.id) ? "burned" : (protectedUntil.get(a.id) ?? -1) >= tS ? "protected" : "intact";
  return out;
}
