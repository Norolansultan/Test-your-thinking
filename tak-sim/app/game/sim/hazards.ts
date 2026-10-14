/**
 * Game mode: what the fire does to people and buildings. A building burns when a front above its
 * threshold reaches its cell or a neighbour, unless it is protected or wet (a protected building only
 * yields to a front above the moderate band); a settlement is lost when more than half of its
 * buildings burn. A crew in heat above its limit, or with the fire around it, takes harm; harm 1 is a
 * casualty and a MAYDAY.
 */

import { CELL, type Asset, type AssetKind } from "../contracts.js";
import { say, unitSay, active, type Ctx, type UnitRt } from "./runtime.js";
import { T } from "./texts.js";

/** An unprotected building ignites from a front of this intensity next to it, kW/m (low-intensity surface fire spares it). */
export const HOUSE_IGNITE_KWM = 800;
/** A protected or wet building survives fronts up to this intensity (low and moderate), kW/m. */
export const PROTECTED_MAX_KWM = 4000;
/** Wetness at or above this counts as a wet building. */
export const WET_ENOUGH = 0.5;
/** A settlement is lost when more than this share of its buildings has burned. */
export const SETTLEMENT_LOST_SHARE = 0.5;

const STRUCTURES: readonly AssetKind[] = ["house", "cabin", "farm", "barn", "other"];

/** Harm per minute: heat above the crew's limit (× intensity / limit), flames underfoot, fire all round (× intensity / limit, 0.25–1). */
export const HARM_HEAT_PER_MIN = 0.25;
export const HARM_UNDERFOOT_PER_MIN = 0.02;
export const HARM_SURROUNDED_PER_MIN = 0.2;
export const HARM_RECOVERY_PER_MIN = 0.01;
/** The crew's urgent call goes out at this harm. */
export const HARM_WARN = 0.4;
/** Radius of the heat a crew feels, m. */
export const HEAT_RADIUS_M = 30;

export function neighbours(cols: number, rows: number, cell: number): number[] {
  const r = Math.floor(cell / cols);
  const c = cell % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(rr * cols + cc);
    }
  }
  return out;
}

export class AssetWatch {
  private readonly cells: (number | null)[];
  readonly lostSettlements: string[] = [];
  lostValue = 0;

  constructor(private readonly ctx: Ctx) {
    this.cells = ctx.world.assets.map((a) => ctx.deps.cellOf(ctx.world.grid, a.at));
  }

  isProtected(a: Asset): boolean {
    const until = this.ctx.protectedUntil.get(a.id);
    return until !== undefined && until >= this.ctx.tS;
  }

  /** After a fire step: buildings that catch, settlements that fall. */
  step(): void {
    const ctx = this.ctx;
    const { cols, rows } = ctx.world.grid;
    ctx.world.assets.forEach((a, i) => {
      if (ctx.burnedAssets.has(a.id) || !STRUCTURES.includes(a.kind)) return;
      const cell = this.cells[i];
      if (cell === null || cell === undefined) return;
      let kw = 0;
      for (const c of [cell, ...neighbours(cols, rows, cell)]) {
        if (ctx.fire.state[c] === CELL.burning) kw = Math.max(kw, ctx.fire.intensity[c] ?? 0);
      }
      if (kw <= 0) return;
      const shielded = this.isProtected(a) || (ctx.fire.wetness[cell] ?? 0) >= WET_ENOUGH;
      if (kw <= (shielded ? PROTECTED_MAX_KWM : HOUSE_IGNITE_KWM)) return;
      ctx.burnedAssets.add(a.id);
      this.lostValue += a.value;
      const s = a.settlementId === null ? undefined : ctx.world.settlements.find((x) => x.id === a.settlementId);
      const text = T.buildingOnFire(s?.nameFi ?? a.id, s?.nameEn ?? a.id, a.id);
      say(ctx, { from: "HÄTÄKESKUS", room: "command", text: { fi: `HÄTÄKESKUS: ${text.fi}`, en: `EMERGENCY CENTRE: ${text.en}` }, priority: "urgent", key: `asset_${a.id}`, at: a.at, force: true });
    });
    for (const s of ctx.world.settlements) {
      if (this.lostSettlements.includes(s.id)) continue;
      const own = ctx.world.assets.filter((a) => s.assetIds.includes(a.id));
      const structures = own.filter((a) => STRUCTURES.includes(a.kind));
      const counted = structures.length > 0 ? structures : own;
      if (counted.length === 0) continue;
      const burned = counted.filter((a) => ctx.burnedAssets.has(a.id)).length;
      if (burned / counted.length <= SETTLEMENT_LOST_SHARE) continue;
      this.lostSettlements.push(s.id);
      const text = T.settlementLost(s.nameFi, s.nameEn);
      say(ctx, { from: "P3", room: "command", text: { fi: `P3: ${text.fi}`, en: `P3: ${text.en}` }, priority: "urgent", key: `settlement_${s.id}`, at: s.centre, force: true });
    }
  }
}

/** One step of crew safety for a unit; true when it became a casualty this step. */
export function stepCrewSafety(ctx: Ctx, u: UnitRt, dtS: number): boolean {
  if (!active(u) || u.spec.air || !u.spec.crewExposed) return false;
  const idx = ctx.fireIdx;
  const hot = idx.hottestWithin(u.pos, HEAT_RADIUS_M);
  const cell = ctx.deps.cellOf(ctx.world.grid, u.pos);
  let underfoot = false;
  let around = 0;
  if (cell !== null) {
    underfoot = ctx.fire.state[cell] === CELL.burning;
    for (const n of neighbours(ctx.world.grid.cols, ctx.world.grid.rows, cell)) if (ctx.fire.state[n] === CELL.burning) around++;
  }
  const limit = Math.max(1, u.spec.maxSafeKwM);
  let rate = 0;
  if (hot.kwM > limit) rate += HARM_HEAT_PER_MIN * (hot.kwM / limit);
  else if (underfoot) rate += HARM_UNDERFOOT_PER_MIN;
  if (around >= 6) rate += HARM_SURROUNDED_PER_MIN * Math.min(1, Math.max(0.25, hot.kwM / limit));
  const before = u.harm;
  if (rate > 0) u.harm = Math.min(1, u.harm + (rate * dtS) / 60);
  else if (idx.nearestBurning(u.pos, 60) < 0) u.harm = Math.max(0, u.harm - (HARM_RECOVERY_PER_MIN * dtS) / 60);
  if (before < HARM_WARN && u.harm >= HARM_WARN && u.harm < 1) {
    say(ctx, unitSay(u, { text: T.heatDanger(), priority: "urgent", key: "heat", at: u.pos }));
  }
  if (u.harm < 1) return false;
  u.harm = 1;
  u.casualty = true;
  u.status = "out_of_action";
  u.order = null;
  u.legs = [];
  u.dest = null;
  u.etaS = null;
  u.logistics = null;
  const m = T.mayday(u.id);
  say(ctx, { from: u.id, room: "command", text: m, priority: "urgent", key: "mayday", at: u.pos, force: true });
  return true;
}
