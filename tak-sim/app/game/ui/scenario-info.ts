/**
 * Game mode screen: small look-ups shared by the briefing, the HUD and the panes (pure).
 */

import type { GameWorld, Settlement, Unit, Weather } from "../contracts.js";
import type { Lang } from "../../i18n/lang.js";
import { compassIndex } from "../weather/weather.js";

/** A settlement by id or by its Finnish or English name (scenarios name them; the game resolves them to ids). */
export function settlementOf(world: Pick<GameWorld, "settlements">, key: string): Settlement | null {
  return world.settlements.find((s) => s.id === key || s.nameFi === key || s.nameEn === key) ?? null;
}

const POINTS: Readonly<Record<Lang, readonly string[]>> = {
  fi: ["P", "KO", "I", "KA", "E", "LO", "L", "LU"],
  en: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
};

/** The wind's source as a short compass point ("LO" / "SW"). */
export function windPoint(w: Pick<Weather, "windFromDeg">, lang: Lang): string {
  return POINTS[lang][compassIndex(w.windFromDeg)]!;
}

/** Units in the list's order: on scene (by id order as given), then en route by arrival, then out of action. */
export function unitListOrder(units: readonly Unit[]): Unit[] {
  const rank = (u: Unit) => (u.status === "out_of_action" ? 2 : u.status === "en_route" ? 1 : 0);
  return units.map((u, i) => ({ u, i })).sort((a, b) => rank(a.u) - rank(b.u) || (rank(a.u) === 1 ? (a.u.etaS ?? 0) - (b.u.etaS ?? 0) : 0) || a.i - b.i).map((x) => x.u);
}
