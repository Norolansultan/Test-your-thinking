/**
 * `npm run game:balance` — plays every game-mode scenario (SPEC/29) with each bot strategy
 * (tools/game/bots.ts: idle, naive, competent) over several seeds on the real world and fire model,
 * and prints one row per game and the median per scenario × strategy: outcome (phase and clock),
 * burned area, buildings lost, casualties, points, grade, and CPU time.
 *
 * Options: `--seeds 1-5` (or `1,3,7`), `--scenario <id>`, `--strategy <id>`, `--tick 60` (game seconds
 * per tick), `--quiet` (medians only). Run from `tak-sim/`.
 */

import { defaultDeps } from "../../app/game/sim/default-deps.js";
import { GAME_SCENARIOS } from "../../app/game/scenarios/index.js";
import { getWorld } from "../../app/game/world/load.js";
import { playGame, STRATEGY_IDS, type PlayResult, type StrategyId } from "./bots.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function parseSeeds(s: string | undefined): number[] {
  if (s === undefined) return [1, 2, 3, 4, 5];
  const out: number[] = [];
  for (const part of s.split(",")) {
    const m = /^(\d+)-(\d+)$/.exec(part.trim());
    if (m !== null) for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(i);
    else if (part.trim().length > 0) out.push(Number(part));
  }
  return out;
}

const GRADES = ["S", "A", "B", "C", "D", "F"];

function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return NaN;
  return n % 2 === 1 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

function medianGrade(gs: readonly string[]): string {
  const idx = gs.map((g) => GRADES.indexOf(g)).sort((a, b) => a - b);
  return GRADES[idx[Math.floor((idx.length - 1) / 2)]!] ?? "?";
}

/** Median closest approach to the protected settlement, or "-" when the scenario protects none. */
function nearMedian(rows: readonly PlayResult[]): string {
  const xs = rows.map((r) => r.nearestToSettlementM).filter((x): x is number => x !== null);
  return xs.length === 0 ? "-" : String(median(xs));
}

function pad(s: string | number, n: number): string {
  const t = String(s);
  return t.length >= n ? t : t + " ".repeat(n - t.length);
}

const now = (): number => performance.now(); // determinism-lint-allow: CPU timing of the balance report only, never game state

const seeds = parseSeeds(arg("seeds"));
const scenarioId = arg("scenario");
const strategyId = arg("strategy") as StrategyId | undefined;
const tickS = Number(arg("tick") ?? 60);
const quiet = process.argv.includes("--quiet");
const world = getWorld();
const scenarios = GAME_SCENARIOS.filter((s) => scenarioId === undefined || s.id === scenarioId);
const strategies = STRATEGY_IDS.filter((s) => strategyId === undefined || s === strategyId);

const header = `${pad("scenario", 17)}${pad("strategy", 10)}${pad("seed", 5)}${pad("outcome", 14)}${pad("ha", 8)}${pad("lost", 6)}${pad("cas", 4)}${pad("pts", 6)}${pad("gr", 3)}${pad("contained", 10)}${pad("objectives", 30)}${pad("near m", 7)}${pad("cmds", 6)}cpu ms`;
console.log(header);
console.log("-".repeat(header.length));
const summary: string[] = [];
for (const s of scenarios) {
  for (const st of strategies) {
    const rows: (PlayResult & { cpuMs: number })[] = [];
    for (const seed of seeds) {
      const t0 = now();
      const r = playGame(s, world, defaultDeps, seed, st, { tickS });
      const cpuMs = Math.round(now() - t0);
      rows.push({ ...r, cpuMs });
      if (!quiet) {
        console.log(`${pad(s.id, 17)}${pad(st, 10)}${pad(seed, 5)}${pad(`${r.phase} ${r.clock}`, 14)}${pad(r.burnedHa.toFixed(1), 8)}${pad(r.assetsLost, 6)}${pad(r.casualties, 4)}${pad(r.points, 6)}${pad(r.grade, 3)}${pad(r.containedClock ?? "-", 10)}${pad(r.objectives, 30)}${pad(r.nearestToSettlementM ?? "-", 7)}${pad(r.commands, 6)}${cpuMs}`);
      }
    }
    const phases = new Map<string, number>();
    for (const r of rows) phases.set(r.phase, (phases.get(r.phase) ?? 0) + 1);
    const outcome = [...phases.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([p, n]) => `${p}×${n}`).join(" ");
    const endClocks = rows.map((r) => r.tS);
    const medEnd = median(endClocks);
    const clock = rows.find((r) => r.tS === medEnd)?.clock ?? rows[0]!.clock;
    summary.push(`${pad(s.id, 17)}${pad(st, 10)}${pad(outcome, 22)}${pad(`end ${clock}`, 10)}${pad(median(rows.map((r) => r.burnedHa)).toFixed(1), 8)}${pad(median(rows.map((r) => r.assetsLost)), 6)}${pad(median(rows.map((r) => r.casualties)), 4)}${pad(median(rows.map((r) => r.points)), 6)}${pad(medianGrade(rows.map((r) => r.grade)), 3)}${pad(rows.map((r) => r.grade).join(""), 8)}${pad(nearMedian(rows), 7)}${Math.round(median(rows.map((r) => r.cpuMs)))}`);
  }
}
console.log("");
console.log(`Median over seeds ${seeds.join(",")} (tick ${tickS} s):`);
const sh = `${pad("scenario", 17)}${pad("strategy", 10)}${pad("outcomes", 22)}${pad("median", 10)}${pad("ha", 8)}${pad("lost", 6)}${pad("cas", 4)}${pad("pts", 6)}${pad("gr", 3)}${pad("grades", 8)}${pad("near m", 7)}cpu ms`;
console.log(sh);
console.log("-".repeat(sh.length));
for (const line of summary) console.log(line);
