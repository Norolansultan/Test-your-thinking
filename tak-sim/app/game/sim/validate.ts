/**
 * Game mode: whether an order can be given, with the reason in Finnish and English when it cannot —
 * the unit exists and can act, its kind can do the task (an engine cuts no fire break, a drone attacks
 * nothing), the target lies on the map, and no water goes within `POWER_LINE_SAFE_M` (15 m) of the live 20 kV line.
 */

import { POWER_LINE_SAFE_M, type GamePhase, type Order, type XY } from "../contracts.js";
import { dist, groupThousands, insideMap, polylineDist, segmentPolylineDist } from "./geom.js";
import { findSettlement } from "./resolve.js";
import type { Ctx, UnitRt } from "./runtime.js";
import { canDo, ORDER_NAME_EN, ORDER_NAME_FI, ORDER_TYPES } from "./unit-specs.js";

export type IssueResult = { readonly ok: true } | { readonly ok: false; readonly reasonFi: string; readonly reasonEn: string };

const no = (reasonFi: string, reasonEn: string): IssueResult => ({ ok: false, reasonFi, reasonEn });

export const MIN_BREAK_M = 25;
export const MAX_BREAK_M = 2000;

export const POWER_LINE_REASON = {
  fi: `20 kV voimajohto on jännitteinen — vettä ei saa käyttää ${POWER_LINE_SAFE_M} m sisällä`,
  en: `The 20 kV power line is live — no water may be used within ${POWER_LINE_SAFE_M} m of it`,
} as const;

/** The points of an order that must lie on the map. */
function orderPoints(o: Order): XY[] {
  switch (o.type) {
    case "move": return [o.to];
    case "attack": return [o.target];
    case "hose_line": return [o.to];
    case "fire_break": return [o.from, o.to];
    case "recon": return [o.centre];
    case "drop": return [o.target];
    default: return [];
  }
}

/** The protect target's id as the world knows it (asset id, settlement id, or a settlement's name). */
export function resolveProtectId(ctx: Ctx, key: string): string | null {
  if (ctx.world.assets.some((a) => a.id === key)) return key;
  return findSettlement(ctx.world, key)?.id ?? null;
}

function protectCentre(ctx: Ctx, id: string): XY | null {
  const s = ctx.world.settlements.find((x) => x.id === id);
  if (s !== undefined) return s.centre;
  return ctx.world.assets.find((a) => a.id === id)?.at ?? null;
}

export function validateOrder(ctx: Ctx, phase: GamePhase, unitId: string, u: UnitRt | undefined, order: Order): IssueResult {
  if (phase === "won" || phase === "lost" || phase === "ended") return no("Peli on päättynyt.", "The game is over.");
  if (u === undefined) return no(`Yksikköä ${unitId} ei ole.`, `There is no unit ${unitId}.`);
  if (u.casualty) return no(`${u.id} on poissa toiminnasta: miehistössä loukkaantuneita.`, `${u.id} is out of action: the crew has casualties.`);
  if (u.recalled) return no(`${u.id} on irrotettu toiselle palolle.`, `${u.id} has been released to another fire.`);
  if (u.status === "out_of_action") return no(`${u.id} ei ole toimintakykyinen.`, `${u.id} is out of action.`);
  if (typeof order !== "object" || order === null || !ORDER_TYPES.includes(order.type)) return no("Tuntematon käsky.", "Unknown order.");
  if (!canDo(u.kind, order.type)) {
    return no(`${u.spec.nameFi} ei voi tehdä tehtävää: ${ORDER_NAME_FI[order.type]}.`, `A ${u.spec.nameEn.toLowerCase()} cannot do this task: ${ORDER_NAME_EN[order.type]}.`);
  }
  for (const p of orderPoints(order)) {
    if (!insideMap(ctx.world.grid, p)) return no("Kohde on kartan ulkopuolella.", "The target is outside the map.");
  }
  const line = ctx.world.powerLine;
  const nearLine = (p: XY): boolean => ctx.powerLineLive && polylineDist(p, line) <= POWER_LINE_SAFE_M;
  const lineRefusal = no(`${POWER_LINE_REASON.fi}.`, `${POWER_LINE_REASON.en}.`);
  switch (order.type) {
    case "attack":
    case "drop":
      if (nearLine(order.target)) return lineRefusal;
      if (order.type === "drop" && ctx.world.waterPoints.length === 0) return no("Kauhalle ei ole vesipistettä.", "There is no water to scoop.");
      return { ok: true };
    case "hose_line":
      if (ctx.powerLineLive && segmentPolylineDist(u.pos, order.to, line) <= POWER_LINE_SAFE_M) return lineRefusal;
      return { ok: true };
    case "fire_break": {
      const len = dist(order.from, order.to);
      if (len < MIN_BREAK_M || len > MAX_BREAK_M) {
        return no(`Palokatkon pituuden on oltava ${MIN_BREAK_M}–${groupThousands(MAX_BREAK_M, "fi")} m.`, `A fire break must be ${MIN_BREAK_M}–${groupThousands(MAX_BREAK_M, "en")} m long.`);
      }
      return { ok: true };
    }
    case "refill":
      if (!ctx.world.waterPoints.some((w) => w.id === order.waterPointId)) return no(`Vesipistettä ${order.waterPointId} ei ole.`, `There is no water point ${order.waterPointId}.`);
      return { ok: true };
    case "shuttle": {
      if (!ctx.world.waterPoints.some((w) => w.id === order.waterPointId)) return no(`Vesipistettä ${order.waterPointId} ei ole.`, `There is no water point ${order.waterPointId}.`);
      const t = ctx.unitById.get(order.toUnitId);
      if (t === undefined) return no(`Yksikköä ${order.toUnitId} ei ole.`, `There is no unit ${order.toUnitId}.`);
      if (t === u) return no("Säiliöauto ei voi ajaa vettä itselleen.", "A tanker cannot shuttle water to itself.");
      if (t.spec.air || t.spec.waterL <= 0) return no(`${t.id}:lla ei ole säiliötä, johon ajaa vettä.`, `${t.id} has no tank to supply.`);
      if (t.status === "out_of_action" || t.recalled) return no(`${t.id} ei ole enää linjalla.`, `${t.id} is no longer on the line.`);
      return { ok: true };
    }
    case "protect": {
      const id = resolveProtectId(ctx, order.assetOrSettlementId);
      if (id === null) return no(`Kohdetta ${order.assetOrSettlementId} ei löydy.`, `There is no asset or settlement ${order.assetOrSettlementId}.`);
      const c = protectCentre(ctx, id);
      if (c !== null && nearLine(c)) return lineRefusal;
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}
