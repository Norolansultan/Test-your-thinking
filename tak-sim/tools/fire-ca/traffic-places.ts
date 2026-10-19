/**
 * Where a unit IS, as its crew and the log name it: the place of its current deployment
 * (`deployment.ts` UNIT_PLAN), not the named feature that happens to be nearest its crew.
 *
 * Review 1 Oct 2026, item 1: a crew holding the south flank stands a few hundred metres from the
 * ignition point, so "nearest named place" called it "syttymäkohta" even after it had moved to
 * Rahkasuo, and kept doing so on the north flank. A unit's place now follows its last move.
 */

import type { Anchor } from "./deployment.js";
import { UNIT_PLAN } from "./deployment.js";

/** The named place and sector label of each anchor. `sector: null` = take it from the position. */
export const ANCHOR_PLACE: Readonly<Record<string, { readonly place: string; readonly sector: string | null }>> = {
  "edge:L1": { place: "pohjoisreuna", sector: "L1-Pohjoinen" },
  "edge:L1B": { place: "pohjoisreuna, Karhujärven puoli", sector: "L1-Pohjoinen" },
  "edge:L3": { place: "syttymäkohdan eteläreuna", sector: "L3-Etelä" }, // the origin's south edge (2 Oct 2026; was Rahkasuo); lower case (TE-13, SPEC/31)
  "edge:L3SE": { place: "kaakkoisrintama", sector: "L3-Etelä" },
  "edge:L4": { place: "syttymäkohta", sector: "L4-Länsi" },
  "edge:RIDGE": { place: "Kuivakangas", sector: null },
  "edge:SPR": { place: "Kuusimäki", sector: null },
  "edge:BIRCH": { place: "Koivuoja", sector: null },
  "edge:L2SE": { place: "kaakkoissivusta", sector: "L2-Koillinen" }, // revision (aj): the lobe's south-east flank on the R1 side
  "edge:L2S": { place: "eteläsivusta", sector: "L2-Koillinen" },
  "edge:L1N": { place: "pohjoissivusta", sector: null },
  "edge:L2E": { place: "itäreuna", sector: "L2-Koillinen" },
  "at:R1_BLACK": { place: "tie R1, palanut alue", sector: null },
  "zone:R1_BLACK_MID": { place: "tie R1, palanut alue", sector: null }, // revision (aj): EK14's safety zone at 15:40–16:20
  "black:HERE": { place: "oma auto", sector: null },
  "head:L": { place: "kärki, pohjoissivusta", sector: "L2-Koillinen" },
  "head:R": { place: "kärki, eteläsivusta", sector: "L2-Koillinen" },
  "at:CP": { place: "johtopaikka", sector: null },
  "at:R1_W": { place: "tie R1", sector: null },
  "at:R1_MID": { place: "tie R1", sector: null },
  "at:R1_R2": { place: "R1/R2-risteys", sector: null },
  "at:R2_BOG": { place: "tie R2", sector: null },
  "at:R3_BRIDGE_W": { place: "R3:n silta (Kotkanjoki)", sector: null },
  "at:R3_BRIDGE_E": { place: "R3:n silta (Kotkanjoki)", sector: null },
  "at:POND_W1": { place: "Haukilampi", sector: null },
  "at:POND_W2": { place: "Lahdenkylän lampi", sector: null },
  "at:BRIDGE_W3": { place: "R3:n silta (Kotkanjoki)", sector: null },
  "at:VILLAGE": { place: "Lahdenkylä", sector: null },
  "at:CABINS": { place: "Mökkiranta", sector: null },
  "at:BOG_S": { place: "Rahkasuo", sector: "L3-Etelä" },
  // Phase-B rebuild round 2 (5 Oct 2026): the south-east front's lines on roads (deployment.ts).
  "at:FR_W": { place: "metsäautotie (Honkaharju)", sector: "L3-Etelä" },
  "at:FR_MID": { place: "metsäautotie (Honkaharju)", sector: "L3-Etelä" },
  "at:FR_E": { place: "metsäautotie (Honkaharju)", sector: "L3-Etelä" },
  "at:R2_FR": { place: "R2:n ja metsäautotien risteys", sector: null },
  "at:R2_MID": { place: "tie R2", sector: null },
  "at:R2_S": { place: "tie R2", sector: null },
  "at:ORIGIN_W": { place: "länsireuna (L4)", sector: "L4-Länsi" }, // short: "DR2 lämpökuva, <place> klo hh.mm" is a labelled header (≤ 48 chars)
  "head": { place: "kärki", sector: "L2-Koillinen" },
};

/** The anchor a unit is deployed to during step `step` (its last move at or before it), or null before it arrives. */
export function anchorAt(unit: string, step: number): Anchor | null {
  const plan = UNIT_PLAN[unit];
  if (!plan) return null;
  let a: Anchor | null = null;
  for (const mv of plan.moves) if (mv.cycle <= step) a = mv.to;
  return a;
}

/** A unit's place and sector during step `step`, or null when it is not deployed (or not a unit). */
export function deployedPlace(unit: string, step: number): { readonly place: string; readonly sector: string | null } | null {
  const a = anchorAt(unit, step);
  return a ? ANCHOR_PLACE[a] ?? null : null;
}

/** Sector of a site point by bearing from the ignition (the four sectors of SPEC/18 §5). */
export function sectorOfPoint(p: { readonly x: number; readonly y: number }): string {
  const b = ((Math.atan2(p.x, p.y) * 180) / Math.PI + 360) % 360;
  return b >= 280 || b < 20 ? "L1-Pohjoinen" : b < 100 ? "L2-Koillinen" : b < 220 ? "L3-Etelä" : "L4-Länsi";
}
