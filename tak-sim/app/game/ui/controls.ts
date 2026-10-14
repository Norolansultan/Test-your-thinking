/**
 * Game mode screen: selection and order issuing (pure apart from `game.issue`, tested).
 */

import type { Game, Order, Unit } from "../contracts.js";
import { canDo } from "./orders.js";

/** Click on a unit: alone it replaces the selection; with Shift it toggles that unit in it. */
export function nextSelection(cur: readonly string[], id: string, add: boolean): string[] {
  if (!add) return [id];
  return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
}

export type IssueOutcome =
  | { readonly unitId: string; readonly ok: true }
  | { readonly unitId: string; readonly ok: false; readonly reasonFi: string; readonly reasonEn: string };

/**
 * Issues `order` (or, per unit, what `order(u)` gives) to each selected unit whose kind can take it, through
 * `game.issue`; the game's own validation decides. Units whose kind cannot take it are skipped silently, unless none
 * can — then the first selected unit is still asked, so the player hears why.
 */
export function issueToSelection(game: Pick<Game, "issue">, units: readonly Unit[], ids: readonly string[], order: Order | ((u: Unit) => Order | null)): IssueOutcome[] {
  const sel = ids.map((id) => units.find((u) => u.id === id)).filter((u): u is Unit => u !== undefined);
  const make = (u: Unit) => (typeof order === "function" ? order(u) : order);
  const able = sel.filter((u) => { const o = make(u); return o !== null && canDo(u.kind, o.type); });
  const targets = able.length > 0 ? able : sel.slice(0, 1);
  const out: IssueOutcome[] = [];
  for (const u of targets) {
    const o = make(u);
    if (o === null) continue;
    const r = game.issue(u.id, o);
    out.push(r.ok ? { unitId: u.id, ok: true } : { unitId: u.id, ok: false, reasonFi: r.reasonFi, reasonEn: r.reasonEn });
  }
  return out;
}
