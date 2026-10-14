/**
 * Game mode: binding a scenario to the world it is played on. Scenarios name settlements, not world
 * ids ("Lahdenkylä"), so they do not depend on the world file: at game creation each name resolves to
 * the world's settlement by id or name, and if the world has no such place, to the settlement nearest
 * the fire.
 */

import type { GameScenario, GameWorld, Objective, Settlement, XY } from "../contracts.js";
import { dist, normaliseName } from "./geom.js";

/** The settlement a scenario's key names: by id, then by Finnish or English name (diacritics ignored). */
export function findSettlement(world: GameWorld, key: string): Settlement | undefined {
  const exact = world.settlements.find((s) => s.id === key);
  if (exact !== undefined) return exact;
  const k = normaliseName(key);
  if (k.length === 0) return undefined;
  const named = world.settlements.find((s) => normaliseName(s.id) === k || normaliseName(s.nameFi) === k || normaliseName(s.nameEn) === k);
  if (named !== undefined) return named;
  if (k.length < 4) return undefined;
  return world.settlements.find((s) => {
    const names = [normaliseName(s.nameFi), normaliseName(s.nameEn), normaliseName(s.id)];
    return names.some((n) => n.length >= 4 && (n.startsWith(k) || k.startsWith(n)));
  });
}

/** Where the scenario's fire starts: the mean of its ignitions (or of its ignite events). */
export function fireOrigin(scenario: GameScenario, world: GameWorld): XY {
  const pts: XY[] = [...scenario.ignitions];
  if (pts.length === 0) for (const e of scenario.events) if (e.kind === "ignite" && e.at !== undefined) pts.push(e.at);
  if (pts.length === 0) return world.commandPost;
  let x = 0;
  let y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

export function nearestSettlement(world: GameWorld, p: XY): Settlement | undefined {
  let best: Settlement | undefined;
  let bestD = Infinity;
  for (const s of world.settlements) {
    const d = dist(s.centre, p);
    if (d < bestD) { best = s; bestD = d; }
  }
  return best;
}

/**
 * The scenario as played on this world: every `protect_settlement` names a real settlement id
 * (by name, else the settlement nearest the fire); a protect objective is dropped only when the world
 * has no settlement at all.
 */
export function resolveScenario(scenario: GameScenario, world: GameWorld): GameScenario {
  const origin = fireOrigin(scenario, world);
  const objectives: Objective[] = [];
  for (const o of scenario.objectives) {
    if (o.kind !== "protect_settlement") {
      objectives.push(o);
      continue;
    }
    const s = findSettlement(world, o.settlementId) ?? nearestSettlement(world, origin);
    if (s === undefined) continue;
    if (objectives.some((x) => x.kind === "protect_settlement" && x.settlementId === s.id)) continue;
    objectives.push({ kind: "protect_settlement", settlementId: s.id });
  }
  return { ...scenario, objectives };
}
