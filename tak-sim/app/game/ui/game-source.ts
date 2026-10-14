/**
 * Game mode screen: the ONE place that creates a `Game` (and lists the scenarios). Everything else in `ui/` is built
 * against the `Game` contract only.
 *
 * TEMPORARY: a minimal "fire-only" adapter while the game loop (`sim/game.ts`, `createGame`) is built in parallel. It
 * runs the real world, the real live fire and the real weather keys, with static units near the command post; a move
 * order teleports the unit, attack and drop put the unit's water on the fire, refill fills the tank, and the fog of war
 * is simply what each unit's sensor circle covers. When the game loop is merged this file switches to
 * `createGame(scenario, getWorld(), seed, defaultDeps)` and the real scenarios.
 */

import { type Game, type GameCommand, type GamePhase, type GameScenario, type GameState, type GameWorld, type Order, type RadioMessage, type Score, type Unit, type UnitKind, type Weather, type XY } from "../contracts.js";
import { createFireSim } from "../fire/spread.js";
import { describeWeatherEn, describeWeatherFi, weatherAt } from "../weather/weather.js";
import { cellOf, cellsInCircle, distance } from "../world/grid.js";
import { getWorld } from "../world/load.js";
import { canDo, SENSOR_M } from "./orders.js";

/** The game's world (decoded once). */
export function gameWorld(): GameWorld {
  return getWorld();
}

const at = (start: number, hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return ((h ?? 0) * 60 + (m ?? 0) - start) * 60;
};

const IGN: XY = { x: 5000, y: 5000 };

function radio(atS: number, from: string, room: RadioMessage["room"], priority: RadioMessage["priority"], textFi: string, textEn: string, pos?: XY): RadioMessage {
  return pos === undefined ? { atS, from, room, priority, textFi, textEn } : { atS, from, room, priority, textFi, textEn, at: pos };
}

/** TEMPORARY scenarios (the real ones come with the game loop). */
const TEMP_SCENARIOS: readonly GameScenario[] = [
  {
    id: "training", titleFi: "Harjoitus", titleEn: "Training", difficulty: "easy", startClockMin: 600, endAtS: 2 * 3600,
    briefingFi: "Pieni palo hakkuuaukealla, heikko tuuli. Opettele ohjaamaan yksiköitä.\n\nTavoite: rajaa palo kahdessa tunnissa.",
    briefingEn: "A small fire on a clear-cut in a light wind. Learn to command the units.\n\nObjective: contain the fire within two hours.",
    ignitions: [IGN],
    weather: [{ atS: 0, windFromDeg: 240, windMs: 3, gustMs: 5, tempC: 20, rh: 45 }],
    units: [{ id: "EK11", kind: "engine", arriveAtS: 0 }, { id: "VPK", kind: "volunteer", arriveAtS: 0 }, { id: "DR1", kind: "drone_thermal", arriveAtS: 0 }],
    events: [{ atS: 0, kind: "radio", message: radio(0, "HÄTÄKESKUS", "command", "important", "HÄTÄKESKUS: Maastopalo hakkuuaukealla.", "EMERGENCY CENTRE: Wildfire on a clear-cut.", IGN) }],
    objectives: [{ kind: "contain", byS: 2 * 3600 }, { kind: "no_casualties" }],
    powerLineLiveAtStart: false,
  },
  {
    id: "summer-afternoon", titleFi: "Kesäiltapäivä", titleEn: "Summer afternoon", difficulty: "normal", startClockMin: 720, endAtS: at(720, "20:00"),
    briefingFi: "Perjantai heinäkuun lopussa, neljäs viikko ilman sadetta. Harvesterin kuljettaja soitti 112:een: hakkuuaukealla palaa.\n\nTavoitteet: suojaa Lahdenkylä, rajaa palo klo 20 mennessä, tuo jokainen miehistö kotiin.\n\n110 kV voimajohto on jännitteinen klo 15.30 asti.",
    briefingEn: "A Friday at the end of July, the fourth week without rain. A harvester operator called 112: the clear-cut is burning.\n\nObjectives: protect Bay Village, contain the fire by 20:00, bring every crew home.\n\nThe 110 kV line is live until 15:30.",
    ignitions: [IGN],
    weather: [
      { atS: 0, windFromDeg: 225, windMs: 4, gustMs: 7, tempC: 27, rh: 30 },
      { atS: at(720, "14:00"), windFromDeg: 235, windMs: 6, gustMs: 11, tempC: 29, rh: 26 },
      { atS: at(720, "16:20"), windFromDeg: 170, windMs: 4, gustMs: 7, tempC: 23, rh: 42 },
      { atS: at(720, "18:00"), windFromDeg: 270, windMs: 6, gustMs: 10, tempC: 22, rh: 35 },
    ],
    units: [
      { id: "EK11", kind: "engine", arriveAtS: 0 }, { id: "VPK", kind: "volunteer", arriveAtS: 0 }, { id: "EK12", kind: "engine", arriveAtS: 0 },
      { id: "DR1", kind: "drone_thermal", arriveAtS: 0 }, { id: "EK14", kind: "forest_unit", arriveAtS: 0 }, { id: "EK13", kind: "tanker", arriveAtS: 0 },
      { id: "HELI1", kind: "helicopter", arriveAtS: 0 }, { id: "UGV1", kind: "ugv", arriveAtS: 0 },
    ],
    events: [
      { atS: 0, kind: "radio", message: radio(0, "HÄTÄKESKUS", "command", "important", "HÄTÄKESKUS: Maastopalo hakkuuaukealla Kuivakankaan lounaispuolella. Palo leviää koilliseen.", "EMERGENCY CENTRE: Wildfire on a clear-cut south-west of Kuivakangas. Spreading north-east.", IGN) },
      { atS: 120, kind: "radio", message: radio(120, "P3", "command", "urgent", "P3: Lahdenkylä suojattava. Kärki pysäytettävä ennen kuusikkoa.", "P3: Bay Village must be protected. Stop the head before the spruce.") },
      { atS: at(720, "14:00"), kind: "ignite", at: { x: 5707, y: 5707 } },
    ],
    objectives: [{ kind: "protect_settlement", settlementId: "lahdenkyla" }, { kind: "contain", byS: at(720, "20:00") }, { kind: "no_casualties" }],
    powerLineLiveAtStart: true,
  },
];

/** The scenarios, easiest first. */
export function gameScenarios(): readonly GameScenario[] {
  return TEMP_SCENARIOS;
}

/** A new game of `scenario`. TEMPORARY adapter (see the file comment). */
export function startGame(scenario: GameScenario, seed: number): Game {
  return new TempGame(scenario, gameWorld(), seed);
}

const SIM_STEP = 10;
const AIR: ReadonlySet<UnitKind> = new Set(["drone_thermal", "drone_vtol", "drone_water", "helicopter", "spotter"]);
const TANK: Readonly<Record<UnitKind, number>> = {
  engine: 3000, tanker: 14000, forest_unit: 600, volunteer: 5000, ugv: 0, drone_thermal: 0, drone_vtol: 0, drone_water: 80, helicopter: 1000, spotter: 0,
};

interface MutUnit { -readonly [K in keyof Unit]: Unit[K] }

class TempGame implements Game {
  readonly commands: GameCommand[] = [];
  private readonly fire;
  private readonly known: Uint8Array;
  private readonly knownAtS: Float32Array;
  private readonly units: MutUnit[];
  private readonly radio: RadioMessage[] = [];
  private phase: GamePhase = "briefing";
  private t = 0;
  private acc = 0;
  private nextEvent = 0;
  private weather: Weather;

  constructor(readonly scenario: GameScenario, readonly world: GameWorld, seed: number) {
    this.fire = createFireSim(world, seed);
    const n = world.grid.cols * world.grid.rows;
    this.known = new Uint8Array(n).fill(255);
    this.knownAtS = new Float32Array(n).fill(-1);
    this.weather = weatherAt(scenario.weather, 0);
    const cp = world.commandPost;
    this.units = scenario.units.map((u, i) => {
      const angle = (i / Math.max(1, scenario.units.length)) * 2 * Math.PI;
      const water = AIR.has(u.kind) ? 0 : TANK[u.kind];
      return {
        id: u.id, callsign: u.id, kind: u.kind, pos: { x: cp.x + 120 * Math.cos(angle), y: cp.y + 120 * Math.sin(angle) },
        status: "idle", order: null, waterL: water, waterMaxL: TANK[u.kind], energyPct: 100, harm: 0, hoseLine: null, etaS: null,
      };
    });
    for (const p of scenario.ignitions) this.igniteAt(p);
  }

  private igniteAt(p: XY): void {
    const c = cellOf(this.world, p);
    if (c < 0) return;
    this.fire.ignite(c);
    for (const k of cellsInCircle(this.world, p, 60)) { this.known[k] = this.fire.state[k]!; this.knownAtS[k] = this.t; }
  }

  get state(): GameState {
    const burnedHa = this.fire.burnedHa;
    const points = Math.max(0, Math.round(1000 - burnedHa * 4));
    const grade: Score["grade"] = points >= 900 ? "S" : points >= 750 ? "A" : points >= 600 ? "B" : points >= 450 ? "C" : points >= 300 ? "D" : "F";
    const over = this.phase !== "running" && this.phase !== "briefing";
    const clock = this.scenario.startClockMin + Math.floor(this.t / 60);
    return {
      tS: this.t,
      clockLabel: `${String(Math.floor(clock / 60) % 24).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`,
      phase: this.phase,
      weather: this.weather,
      fire: this.fire,
      units: this.units.map((u) => ({ ...u })),
      known: this.known,
      knownAtS: this.knownAtS,
      powerLineLive: this.scenario.powerLineLiveAtStart && this.t < 3.5 * 3600,
      radio: this.radio,
      score: {
        burnedHa, assetsLost: 0, assetsTotal: this.world.assets.length, settlementsLost: [], casualties: 0, containedAtS: null, points, grade,
        objectives: this.scenario.objectives.map((objective) => ({ objective, met: over ? objective.kind !== "contain" : null })),
      },
    };
  }

  tick(dtS: number): void {
    if (this.phase === "briefing") this.phase = "running";
    if (this.phase !== "running" || !(dtS > 0)) return;
    this.acc += dtS;
    while (this.acc >= SIM_STEP && this.phase === "running") {
      this.acc -= SIM_STEP;
      this.t += SIM_STEP;
      this.weather = weatherAt(this.scenario.weather, this.t);
      const evs = this.scenario.events;
      while (this.nextEvent < evs.length && evs[this.nextEvent]!.atS <= this.t) {
        const e = evs[this.nextEvent++]!;
        if (e.message) this.radio.push(e.message);
        if (e.kind === "ignite" && e.at) this.igniteAt(e.at);
      }
      if (this.t % 900 === 0) {
        this.radio.push(radio(this.t, "SÄÄ", "support", "routine", `SÄÄ: ${describeWeatherFi(this.weather, true)}.`, `WEATHER: ${describeWeatherEn(this.weather, true)}.`));
      }
      this.fire.step(SIM_STEP, this.weather);
      for (const u of this.units) {
        for (const k of cellsInCircle(this.world, u.pos, SENSOR_M[u.kind])) { this.known[k] = this.fire.state[k]!; this.knownAtS[k] = this.t; }
        if (AIR.has(u.kind)) u.energyPct = Math.max(0, u.energyPct - 0.1);
      }
      if (this.t >= this.scenario.endAtS) this.phase = "ended";
    }
  }

  issue(unitId: string, order: Order): { readonly ok: true } | { readonly ok: false; readonly reasonFi: string; readonly reasonEn: string } {
    if (this.phase === "won" || this.phase === "lost" || this.phase === "ended") return { ok: false, reasonFi: "Peli on päättynyt.", reasonEn: "The game is over." };
    const u = this.units.find((x) => x.id === unitId);
    if (!u) return { ok: false, reasonFi: `Yksikköä ${unitId} ei ole.`, reasonEn: `There is no unit ${unitId}.` };
    if (!canDo(u.kind, order.type)) return { ok: false, reasonFi: `${u.id} ei voi tehdä tätä tehtävää.`, reasonEn: `${u.id} cannot do this task.` };
    this.commands.push({ atS: this.t, unitId, order });
    u.order = order;
    u.status = "working";
    switch (order.type) {
      case "move": u.pos = order.to; u.status = "idle"; u.order = null; break;
      case "attack": case "drop": {
        if (u.waterL <= 0) return { ok: false, reasonFi: `${u.id}: säiliö on tyhjä.`, reasonEn: `${u.id}: the tank is empty.` };
        if (distance(u.pos, order.target) > 400 && !AIR.has(u.kind)) u.pos = order.target;
        const changed = this.fire.applyWater(order.target, 40, u.waterL);
        for (const k of cellsInCircle(this.world, order.target, 60)) { this.known[k] = this.fire.state[k]!; this.knownAtS[k] = this.t; }
        u.waterL = 0;
        if (changed.length === 0) u.status = "idle";
        break;
      }
      case "refill": u.waterL = u.waterMaxL; u.status = "idle"; u.order = null; break;
      case "hose_line": u.hoseLine = [u.pos, order.to]; break;
      case "hold": u.status = "idle"; break;
      default: break;
    }
    return { ok: true };
  }
}
