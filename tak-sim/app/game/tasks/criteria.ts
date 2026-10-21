/**
 * Game mode, SPEC/34 §4: reusable criteria of the decision tasks (and the course's exercises). Each builder returns a
 * `TaskCriterion` with its fi/en label and a judge that reads only the final state and the runner's trace
 * (`runner.ts`), and says met or not with the numbers behind it. Pure: no clock, no randomness.
 *
 * Times are game seconds (the scenario's tS, as the trace's samples); `startClockMin` turns them into the clock the
 * player reads. Every Finnish text is DRAFT for the native-speaker check.
 */

import { CELL, type GameState, type XY } from "../contracts.js";
import { clockLabel } from "../sim/geom.js";
import { cellCentre } from "../world/grid.js";
import { TRACE_EVERY_S, type TaskCriterion, type TaskTrace, type TraceSample } from "./contracts.js";

type Verdict = ReturnType<TaskCriterion["judge"]>;

/** The ground units whose crews stand on the fire ground (the ones a head can catch). */
export const CREWED_KINDS: readonly string[] = ["engine", "tanker", "forest_unit", "volunteer"];

const verdict = (met: boolean, detailFi: string, detailEn: string): Verdict => ({ met, detailFi, detailEn });

/** "12,5" / "12.5": one decimal, with the Finnish decimal comma. */
export function num(x: number, lang: "fi" | "en", digits = 1): string {
  const s = x.toFixed(digits);
  return lang === "fi" ? s.replace(".", ",") : s;
}

/** A limit as the player reads it: whole numbers without decimals. */
function lim(x: number, lang: "fi" | "en"): string {
  return num(x, lang, Number.isInteger(x) ? 0 : 1);
}

/** The samples in a window of game time, inclusive. */
export function samplesIn(trace: TaskTrace, fromS: number, toS: number): TraceSample[] {
  return trace.samples.filter((s) => s.tS >= fromS - 1e-6 && s.tS <= toS + 1e-6);
}

const reached = (s: number): boolean => s === CELL.burning || s === CELL.smouldering || s === CELL.burnedOut || s === CELL.extinguished;

/** The burned area stays at or under `maxHa` (judged at the end). */
export function maxBurnedHa(maxHa: number): TaskCriterion {
  return {
    id: "max_burned_ha",
    labelFi: `Paloala enintään ${lim(maxHa, "fi")} ha`, // DRAFT fi
    labelEn: `Burned area at most ${lim(maxHa, "en")} ha`,
    judge: (final) => {
      const ha = final.score.burnedHa;
      return verdict(ha <= maxHa, `Paloala ${num(ha, "fi")} ha (raja ${lim(maxHa, "fi")} ha).`, `Burned area ${num(ha, "en")} ha (limit ${lim(maxHa, "en")} ha).`);
    },
  };
}

/** No crew lost: no casualty all run. */
export function noCasualties(): TaskCriterion {
  return {
    id: "no_casualties",
    labelFi: "Ei loukkaantuneita", // DRAFT fi
    labelEn: "No casualties",
    judge: (final) => {
      const n = final.score.casualties;
      return verdict(n === 0, n === 0 ? "Kaikki miehistöt palasivat ehjinä." : `Loukkaantuneita miehistöjä: ${n}.`, n === 0 ? "Every crew came back unhurt." : `Crews with casualties: ${n}.`);
    },
  };
}

/** No crew ever took heat harm above `maxHarm` (0–1; the crews' own heat limit, `sim/hazards.ts`). */
export function noCrewHarm(maxHarm: number, startClockMin: number): TaskCriterion {
  return {
    id: "no_crew_harm",
    labelFi: "Kukaan miehistö ei joudu kuumuuteen", // DRAFT fi
    labelEn: "No crew caught in the heat",
    judge: (_final, trace) => {
      let worst: { tS: number; id: string; harm: number } | null = null;
      for (const s of trace.samples) for (const u of s.units) if (u.harm > (worst?.harm ?? maxHarm)) worst = { tS: s.tS, id: u.id, harm: u.harm };
      if (worst === null) return verdict(true, "Yksikään miehistö ei joutunut liian lähelle kuumaa reunaa.", "No crew got too close to a hot edge.");
      const at = clockLabel(startClockMin, worst.tS);
      return verdict(false, `${worst.id} joutui kuumuuteen (haitta ${Math.round(worst.harm * 100)} %) klo ${at}.`, `${worst.id} was caught in the heat (harm ${Math.round(worst.harm * 100)} %) at ${at}.`);
    },
  };
}

/**
 * The structures `assetIds` (a named group: "the farm", "Koivuranta's cabins") do not burn; at least `minIntact` of them
 * (default all) still stand at the end.
 */
export function assetsIntact(id: string, assetIds: readonly string[], nameFi: string, nameEn: string, minIntact = assetIds.length): TaskCriterion {
  const all = minIntact >= assetIds.length;
  return {
    id,
    labelFi: all ? `${nameFi} säilyy` : `${nameFi}: vähintään ${minIntact}/${assetIds.length} säilyy`, // DRAFT fi
    labelEn: all ? `${nameEn} saved` : `${nameEn}: at least ${minIntact} of ${assetIds.length} saved`,
    judge: (final) => {
      const burned = assetIds.filter((a) => final.assetStatus[a] === "burned");
      const intact = assetIds.length - burned.length;
      const list = burned.join(", ");
      if (assetIds.length === 1) {
        return verdict(intact >= minIntact, burned.length === 0 ? "Rakennus säilyi." : `Rakennus paloi (${list}).`, burned.length === 0 ? "The building stands." : `The building burned (${list}).`);
      }
      return verdict(
        intact >= minIntact,
        burned.length === 0 ? `Kaikki ${assetIds.length} rakennusta säilyivät.` : `${intact}/${assetIds.length} säilyi; paloi: ${list}.`,
        burned.length === 0 ? `All ${assetIds.length} buildings stand.` : `${intact} of ${assetIds.length} stand; burned: ${list}.`,
      );
    },
  };
}

/** No unit put water (or tried to) within `POWER_LINE_SAFE_M` of the 20 kV line while it was live. */
export function noWaterNearLiveLine(startClockMin: number): TaskCriterion {
  return {
    id: "no_water_near_live_line",
    labelFi: "Ei vettä 15 m sisällä jännitteisestä johdosta", // DRAFT fi
    labelEn: "No water within 15 m of the live line",
    judge: (_final, trace) => {
      const w = trace.waterNearLiveLine;
      if (w.length === 0) return verdict(true, "Kukaan ei käyttänyt vettä jännitteisen johdon lähellä.", "Nobody used water near the live line.");
      const first = w[0]!;
      const units = [...new Set(w.map((x) => x.unitId))].join(", ");
      const at = clockLabel(startClockMin, first.tS);
      return verdict(false, `${units}: vettä johdon lähellä sen ollessa jännitteinen (ensimmäinen klo ${at}).`, `${units}: water near the line while it was live (first at ${at}).`);
    },
  };
}

/**
 * A unit stays on the line with water from `fromS` to `toS`: working in at least `minWorkingShare` of the samples, and
 * without water (tank dry, or away filling it) for at most `maxDryMin` minutes in all (samples are a minute apart).
 */
export function keptSupplied(unitId: string, fromS: number, toS: number, startClockMin: number, maxDryMin = 0, minWorkingShare = 0.6): TaskCriterion {
  const span = `${clockLabel(startClockMin, fromS)}–${clockLabel(startClockMin, toS)}`;
  return {
    id: `supplied_${unitId}`,
    labelFi: `${unitId} työssä ja vedessä ${span}`, // DRAFT fi
    labelEn: `${unitId} working and in water ${span}`,
    judge: (_final, trace) => {
      const ss = samplesIn(trace, fromS, toS);
      let working = 0;
      let dry = 0;
      let firstDry: number | null = null;
      for (const s of ss) {
        const u = s.units.find((x) => x.id === unitId);
        if (u === undefined) continue;
        if (u.status === "working") working++;
        if (u.waterL <= 0.5 || u.status === "refilling" || u.status === "returning") {
          dry++;
          firstDry ??= s.tS;
        }
      }
      const share = ss.length === 0 ? 0 : working / ss.length;
      const pct = Math.round(share * 100);
      const dryMin = Math.round((dry * TRACE_EVERY_S) / 60);
      if (dryMin > maxDryMin && firstDry !== null) {
        const at = clockLabel(startClockMin, firstDry);
        return verdict(false, `${unitId} oli ilman vettä ${dryMin} min (sallittu ${maxDryMin}); säiliö tyhjeni ensin klo ${at}.`, `${unitId} was without water for ${dryMin} min (allowed ${maxDryMin}); first dry at ${at}.`);
      }
      const dryFi = dryMin === 0 ? "vesi ei loppunut" : `ilman vettä ${dryMin} min`;
      const dryEn = dryMin === 0 ? "never ran dry" : `without water for ${dryMin} min`;
      return verdict(share >= minWorkingShare, `${unitId} oli työssä ${pct} % ajasta, ${dryFi}.`, `${unitId} was working ${pct} % of the time, ${dryEn}.`);
    },
  };
}

/**
 * The tanker's shuttle draws from `waterPointId` at the end of the run (the plan's choice of water: the nearest by road,
 * not the nearest on the map). `whyFi` / `whyEn` say why that one.
 */
export function shuttleDrawsFrom(unitId: string, waterPointId: string, nameFi: string, nameEn: string, whyFi: string, whyEn: string): TaskCriterion {
  return {
    id: `shuttle_${unitId}`,
    labelFi: `${unitId} hakee vetensä: ${nameFi}`, // DRAFT fi
    labelEn: `${unitId} draws its water at ${nameEn}`,
    judge: (final) => {
      const u = final.units.find((x) => x.id === unitId);
      const o = u?.order ?? null;
      const from = o !== null && o.type === "shuttle" ? o.waterPointId : o !== null && o.type === "refill" ? o.waterPointId : null;
      if (from === waterPointId) return verdict(true, `${unitId} ajoi vettä: ${nameFi}. ${whyFi}`, `${unitId} shuttled from ${nameEn}. ${whyEn}`);
      return verdict(false, from === null ? `${unitId} ei ajanut vettä. ${whyFi}` : `${unitId} haki vetensä muualta (${from}). ${whyFi}`, from === null ? `${unitId} was not shuttling. ${whyEn}` : `${unitId} drew its water elsewhere (${from}). ${whyEn}`);
    },
  };
}

/**
 * A fire found and sized: of the ground it has reached within `radiusM` of `centre`, at least `minShare` has been seen by
 * the player's units (`everObserved`) and is on the player's map as burned or burning at the end.
 */
export function fireMapped(id: string, nameFi: string, nameEn: string, centre: XY, radiusM: number, minShare = 0.7): TaskCriterion {
  return {
    id,
    labelFi: `${nameFi} löydetty ja kartoitettu`, // DRAFT fi
    labelEn: `${nameEn} found and mapped`,
    judge: (final, trace) => {
      const grid = trace.grid;
      if (grid === undefined) return verdict(false, "Ei karttaa arvioitavaksi.", "No grid to judge on.");
      let total = 0;
      let seen = 0;
      const st = final.fire.state;
      for (let c = 0; c < st.length; c++) {
        if (!reached(st[c]!)) continue;
        const p = cellCentre(grid, c);
        if (Math.hypot(p.x - centre.x, p.y - centre.y) > radiusM) continue;
        total++;
        if (trace.everObserved.has(c) && reached(final.known[c]!)) seen++;
      }
      const share = total === 0 ? 0 : seen / total;
      const pct = Math.round(share * 100);
      const ha = (total * grid.cellM * grid.cellM) / 10_000;
      return verdict(total > 0 && share >= minShare,
        `Palosta (${num(ha, "fi")} ha) on kartalla ${pct} % (vaatimus ${Math.round(minShare * 100)} %).`,
        `${pct} % of the fire (${num(ha, "en")} ha) is on your map (needed ${Math.round(minShare * 100)} %).`);
    },
  };
}

/** Nothing flames at the end, and at most `maxSmouldering` cells still smoulder. */
export function nothingLeftBurning(maxSmouldering: number): TaskCriterion {
  return {
    id: "nothing_left_burning",
    labelFi: maxSmouldering === 0 ? "Lopussa ei liekkejä eikä kytevää" : `Lopussa ei liekkejä, kytevää enintään ${maxSmouldering} ruutua`, // DRAFT fi
    labelEn: maxSmouldering === 0 ? "Nothing flaming or smouldering at the end" : `No flames at the end, at most ${maxSmouldering} cells smouldering`,
    judge: (final) => {
      const { flaming, smouldering } = fireCounts(final);
      return verdict(flaming === 0 && smouldering <= maxSmouldering,
        `Lopussa liekeissä ${flaming} ja kytee ${smouldering} ruutua (25 × 25 m).`,
        `At the end ${flaming} cells flaming and ${smouldering} smouldering (25 × 25 m each).`);
    },
  };
}

/** No flaming front from `fromS` on (judged on the samples): a mopped-up edge that does not rekindle. */
export function noFlamesFrom(fromS: number, startClockMin: number): TaskCriterion {
  const at = clockLabel(startClockMin, fromS);
  return {
    id: "no_flames_from",
    labelFi: `Ei liekkejä klo ${at} jälkeen`, // DRAFT fi
    labelEn: `No flames after ${at}`,
    judge: (_final, trace) => {
      const ss = samplesIn(trace, fromS, Infinity);
      const bad = ss.find((s) => s.flamingCells > 0);
      if (bad === undefined) return verdict(ss.length > 0, `Palo pysyi liekittömänä klo ${at} jälkeen.`, `No flames after ${at}.`);
      const t = clockLabel(startClockMin, bad.tS);
      return verdict(false, `Liekkejä klo ${t}: ${bad.flamingCells} ruutua palaa.`, `Flames at ${t}: ${bad.flamingCells} cells burning.`);
    },
  };
}

/** No flaming front at `atS` (the first sample at or after it): contained by then. */
export function containedBy(atS: number, startClockMin: number): TaskCriterion {
  const at = clockLabel(startClockMin, atS);
  return {
    id: "contained_by",
    labelFi: `Palo rajattu klo ${at} mennessä`, // DRAFT fi
    labelEn: `Fire contained by ${at}`,
    judge: (_final, trace) => {
      const s = trace.samples.find((x) => x.tS >= atS - 1e-6);
      if (s === undefined) return verdict(false, "Ajo ei ulottunut niin pitkälle.", "The run did not reach that time.");
      return verdict(s.flamingCells === 0,
        s.flamingCells === 0 ? `Klo ${at} liekkejä ei ollut.` : `Klo ${at} paloi vielä ${s.flamingCells} ruutua.`,
        s.flamingCells === 0 ? `No flames at ${at}.` : `At ${at}, ${s.flamingCells} cells still burned.`);
    },
  };
}

/** An axis-aligned zone on the map, local metres (the "head's path" a task names). */
export interface Zone { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number }

export function inZone(p: XY, z: Zone): boolean {
  return p.x >= z.minX && p.x <= z.maxX && p.y >= z.minY && p.y <= z.maxY;
}

/** No crewed ground unit inside `zone` (the path the head will take) between `fromS` and `toS`. */
export function crewsClearOf(id: string, zone: Zone, fromS: number, toS: number, nameFi: string, nameEn: string, startClockMin: number, units: readonly { readonly id: string; readonly kind: string }[]): TaskCriterion {
  const crewed = new Set(units.filter((u) => CREWED_KINDS.includes(u.kind)).map((u) => u.id));
  const span = `${clockLabel(startClockMin, fromS)}–${clockLabel(startClockMin, toS)}`;
  return {
    id,
    labelFi: `Ei miehistöjä ${nameFi} ${span}`, // DRAFT fi
    labelEn: `No crews ${nameEn} ${span}`,
    judge: (_final, trace) => {
      const inside = new Set<string>();
      let first: number | null = null;
      for (const s of samplesIn(trace, fromS, toS)) {
        for (const u of s.units) {
          if (!crewed.has(u.id) || u.status === "en_route" || u.status === "out_of_action" || !inZone(u.pos, zone)) continue;
          inside.add(u.id);
          first ??= s.tS;
        }
      }
      if (first === null) return verdict(true, "Yksikään miehistö ei ollut kärjen tiellä tuulen kääntyessä.", "No crew stood in the head's path when the wind turned.");
      const names = [...inside].join(", ");
      const at = clockLabel(startClockMin, first);
      return verdict(false, `Kärjen tiellä: ${names} (ensimmäisen kerran klo ${at}).`, `In the head's path: ${names} (first at ${at}).`);
    },
  };
}

/** The state's flaming and smouldering cells (for the trace and the result). */
export function fireCounts(final: Pick<GameState, "fire">): { readonly flaming: number; readonly smouldering: number } {
  let flaming = 0;
  let smouldering = 0;
  for (const s of final.fire.state) {
    if (s === CELL.burning) flaming++;
    else if (s === CELL.smouldering) smouldering++;
  }
  return { flaming, smouldering };
}
