/**
 * Game mode: what each kind of unit can do and how fast. Every number is PROVISIONAL (pending the
 * same domain review as SPEC/18 §8) and chosen to agree with `app/render/ui/unit-roster.ts` and
 * SPEC/18 (revisions m, y, aa, ab). Each line carries a one-line rationale.
 */

import type { Order, RoadClass, UnitKind } from "../contracts.js";
import type { SpeedByRoadClass } from "./ports.js";

export type OrderType = Order["type"];

export interface UnitSpec {
  readonly kind: UnitKind;
  readonly nameFi: string;
  readonly nameEn: string;
  readonly air: boolean;
  /** Road speed by class, km/h (ground units; aircraft ignore it). */
  readonly roadKmh: SpeedByRoadClass;
  /** Off-road speed, km/h: the crew on foot for road vehicles, the vehicle itself for terrain units. */
  readonly offRoadKmh: number;
  /** Cruise speed, km/h (aircraft only; 0 on the ground). */
  readonly airKmh: number;
  /** Tank or bucket, litres (0 = carries none). */
  readonly waterL: number;
  /** Attack / pump rate, l/min (for a tanker: transfer rate to another unit). */
  readonly pumpLpm: number;
  /** Fill rate at a water point, l/min. */
  readonly fillLpm: number;
  /** Water draw of a structure-protection set-up (sprinklers and a hose), l/min. */
  readonly protectLpm: number;
  /** Effective reach of the nozzle from the crew, m. */
  readonly reachM: number;
  /** Hose carried, m (0 = cannot lay a line). */
  readonly hoseM: number;
  /** Hose-laying speed, m/min. */
  readonly hoseLayMpm: number;
  /** Fire-break cutting speed, m/min (0 = cannot cut). */
  readonly breakMpm: number;
  /** Radius within which it observes the fire, m (clear air). */
  readonly sensorM: number;
  /** Whether its sensor sees through smoke (thermal imaging from the air). */
  readonly seesThroughSmoke: boolean;
  /** Endurance, min: battery or fuel for aircraft; the shift length for ground crews. */
  readonly enduranceMin: number;
  /** Battery swap or refuel time at the command post, min (aircraft). */
  readonly rechargeMin: number;
  /** Scoop / bucket fill time, s (helicopter and water drone). */
  readonly scoopS: number;
  /** Length of a drop strip on the ground, m. */
  readonly dropStripM: number;
  readonly crew: number;
  /** Whether the crew stands on the fire ground (and can be harmed there). */
  readonly crewExposed: boolean;
  /** Highest fireline intensity the crew will attack directly, kW/m. */
  readonly maxSafeKwM: number;
  /** Orders this kind can take. */
  readonly can: readonly OrderType[];
}

const roads = (main: number, gravel: number, forest: number, track: number, path: number): Record<RoadClass, number> => ({ main, gravel, forest, track, path });

const AIR_ROADS = roads(0, 0, 0, 0, 0);

export const UNIT_SPECS: Readonly<Record<UnitKind, UnitSpec>> = {
  engine: {
    kind: "engine", nameFi: "Pelastusyksikkö", nameEn: "Rescue engine", air: false,
    roadKmh: roads(80, 55, 35, 12, 4), // a loaded 18 t engine: main road at speed, forest roads slow, a path only on foot
    offRoadKmh: 3, // the vehicle stays on the road; the crew walks in with hose
    airKmh: 0,
    waterL: 3000, // SPEC/18: "2–3 m³ tank, hose attack"
    pumpLpm: 300, // two 25 mm forest-fire lines at ~150 l/min each
    fillLpm: 1000, // own pump from a water point or a hydrant
    protectLpm: 150, // a sprinkler line of 6–8 heads plus one hose
    reachM: 30, // a 25 mm nozzle's useful throw in forest
    hoseM: 600, // forest-fire hose packs; SPEC/18 (m) caps a line at 800 m (MAX_HOSE_M)
    hoseLayMpm: 20, // crews lay ~1.2 km/h through forest with packs
    breakMpm: 0, // no saws or scraper as a task (SPEC/18: firebreaks are the forest units')
    sensorM: 250, seesThroughSmoke: false, // what a crew sees through the trees and smoke
    enduranceMin: 480, // a crew's shift; EK11 is relieved after ~7.5 h (SPEC/18 §8.2 cycle 19)
    rechargeMin: 0, scoopS: 0, dropStripM: 0,
    crew: 5, crewExposed: true, // 1+4 (EK11 1+5)
    maxSafeKwM: 4000, // direct attack with hose lines is limited to ~4 000 kW/m (flames ~3 m)
    can: ["move", "attack", "hose_line", "refill", "protect", "hold"],
  },
  tanker: {
    kind: "tanker", nameFi: "Säiliöauto", nameEn: "Water tanker", air: false,
    roadKmh: roads(75, 50, 30, 8, 0), // heavy 14 m³ tanker: slow on forest roads, not on tracks off-road
    offRoadKmh: 2, // the crew of two only walks a supply hose out
    airKmh: 0,
    waterL: 14000, // EK13: about 14 m³ (SPEC/18 y.1)
    pumpLpm: 1000, // transfer pump to an engine or a basin
    fillLpm: 1500, // fills fast at W1/W2 with its own pump
    protectLpm: 300, // a monitor and sprinklers on a building group
    reachM: 20, hoseM: 200, hoseLayMpm: 15, breakMpm: 0,
    sensorM: 200, seesThroughSmoke: false,
    enduranceMin: 480, rechargeMin: 0, scoopS: 0, dropStripM: 0,
    crew: 2, crewExposed: true, // 1+1 (SPEC/18 roster)
    maxSafeKwM: 2000, // not an attack unit; keeps clear of an active edge
    can: ["move", "refill", "shuttle", "protect", "hold"],
  },
  forest_unit: {
    kind: "forest_unit", nameFi: "Maastopaloyksikkö", nameEn: "Forest-fire unit", air: false,
    roadKmh: roads(70, 50, 35, 20, 10), // terrain vehicle with trailer
    offRoadKmh: 8, // drives into the forest behind its crew (SPEC/18 (m))
    airKmh: 0,
    waterL: 600, // trailer tank; it lives on natural water
    pumpLpm: 400, // portable pump from natural water (a forest-fire pump on a long 25–38 mm line: ~400 l/min)
    fillLpm: 400, protectLpm: 150,
    reachM: 30,
    hoseM: 1000, // a trailer full of forest hose
    hoseLayMpm: 25, breakMpm: 2.5, // saws, 150 m/h (SPEC/18 ab.2: 150–250 m/h)
    sensorM: 250, seesThroughSmoke: false,
    enduranceMin: 480, rechargeMin: 0, scoopS: 0, dropStripM: 0,
    crew: 4, crewExposed: true, // 1+3
    maxSafeKwM: 2000, // a hand crew with a portable pump: ~2 000 kW/m, flames under 2.5 m
    can: ["move", "attack", "hose_line", "fire_break", "refill", "protect", "hold"],
  },
  volunteer: {
    kind: "volunteer", nameFi: "VPK", nameEn: "Volunteer brigade", air: false,
    roadKmh: roads(75, 50, 35, 12, 4), offRoadKmh: 3, airKmh: 0,
    waterL: 5000, // a VPK tank truck (SPEC/18 roster: "VPK, säiliöauto")
    pumpLpm: 250, fillLpm: 1000, protectLpm: 150,
    reachM: 25, hoseM: 400, hoseLayMpm: 15, breakMpm: 0,
    sensorM: 250, seesThroughSmoke: false, // knows the ground, sees no further
    enduranceMin: 480, rechargeMin: 0, scoopS: 0, dropStripM: 0,
    crew: 4, crewExposed: true, // 1+3
    maxSafeKwM: 2000, // volunteer hand crews: the hand-crew limit
    can: ["move", "attack", "hose_line", "refill", "protect", "hold"],
  },
  ugv: {
    kind: "ugv", nameFi: "Letkunvetorobotti", nameEn: "Hose-laying robot", air: false,
    roadKmh: roads(10, 10, 8, 8, 5), // a tracked robot, slow everywhere
    offRoadKmh: 5, airKmh: 0,
    waterL: 0, pumpLpm: 300, // carries no water; its line runs at the feeding engine's rate
    fillLpm: 0, protectLpm: 0,
    reachM: 20, hoseM: 500, hoseLayMpm: 40, // pulls hose faster than a crew on foot
    breakMpm: 4, // a blade scrapes mineral soil
    sensorM: 150, seesThroughSmoke: false, // its cameras
    enduranceMin: 300, rechargeMin: 0, scoopS: 0, dropStripM: 0,
    crew: 1, crewExposed: false, // the operator stays back (SPEC/18 roster: "1 (käyttäjä)")
    maxSafeKwM: 8000, // a machine; it still backs off a crown fire
    can: ["move", "hose_line", "fire_break", "hold"],
  },
  drone_thermal: {
    kind: "drone_thermal", nameFi: "Lämpökamerakopteri", nameEn: "Thermal drone", air: true,
    roadKmh: AIR_ROADS, offRoadKmh: 0, airKmh: 50,
    waterL: 0, pumpLpm: 0, fillLpm: 0, protectLpm: 0, reachM: 0, hoseM: 0, hoseLayMpm: 0, breakMpm: 0,
    sensorM: 600, seesThroughSmoke: true, // thermal at 100–120 m sees through smoke (SPEC/18 aa.2)
    enduranceMin: 35, rechargeMin: 5, // "Akku n. 35 min"; a battery swap at the command post
    scoopS: 0, dropStripM: 0,
    crew: 3, crewExposed: false, // the drone team is at the command post
    maxSafeKwM: 0, can: ["move", "recon", "hold"],
  },
  drone_vtol: {
    kind: "drone_vtol", nameFi: "VTOL-drooni", nameEn: "VTOL mapping drone", air: true,
    roadKmh: AIR_ROADS, offRoadKmh: 0, airKmh: 80,
    waterL: 0, pumpLpm: 0, fillLpm: 0, protectLpm: 0, reachM: 0, hoseM: 0, hoseLayMpm: 0, breakMpm: 0,
    sensorM: 800, seesThroughSmoke: true, // perimeter mapping, footprint perimeter + 300 m (SPEC/18 k.3)
    enduranceMin: 150, rechargeMin: 20, // "Toiminta-aika n. 2,5 h"
    scoopS: 0, dropStripM: 0, crew: 3, crewExposed: false,
    maxSafeKwM: 0, can: ["move", "recon", "hold"],
  },
  drone_water: {
    kind: "drone_water", nameFi: "Vesidrooni", nameEn: "Water drone", air: true,
    roadKmh: AIR_ROADS, offRoadKmh: 0, airKmh: 40,
    waterL: 80, // 80 l per round (SPEC/18 aa.2)
    pumpLpm: 0, fillLpm: 0, protectLpm: 0, reachM: 0, hoseM: 0, hoseLayMpm: 0, breakMpm: 0,
    sensorM: 200, seesThroughSmoke: false,
    enduranceMin: 25, rechargeMin: 10, // heavy-lift batteries drain fast
    scoopS: 60, dropStripM: 15,
    crew: 0, crewExposed: false, // supervisor at the command post
    maxSafeKwM: 0, can: ["move", "drop", "hold"],
  },
  helicopter: {
    kind: "helicopter", nameFi: "Sammutushelikopteri", nameEn: "Firefighting helicopter", air: true,
    roadKmh: AIR_ROADS, offRoadKmh: 0, airKmh: 150, // with a slung bucket
    waterL: 1000, // ~1 000 l bucket
    pumpLpm: 0, fillLpm: 0, protectLpm: 0, reachM: 0, hoseM: 0, hoseLayMpm: 0, breakMpm: 0,
    sensorM: 500, seesThroughSmoke: false,
    enduranceMin: 150, rechargeMin: 30, // ~2.5 h of fuel, refuelling at the landing site
    scoopS: 45, dropStripM: 60,
    crew: 2, crewExposed: false,
    maxSafeKwM: 0, can: ["move", "drop", "recon", "hold"],
  },
  spotter: {
    kind: "spotter", nameFi: "Palovartiolentokone", nameEn: "Fire-spotting aircraft", air: true,
    roadKmh: AIR_ROADS, offRoadKmh: 0, airKmh: 180,
    waterL: 0, pumpLpm: 0, fillLpm: 0, protectLpm: 0, reachM: 0, hoseM: 0, hoseLayMpm: 0, breakMpm: 0,
    sensorM: 1500, seesThroughSmoke: false, // eyes from 500 m on a 2.5 km circuit (SPEC/18 k.3)
    enduranceMin: 240, rechargeMin: 30, scoopS: 0, dropStripM: 0,
    crew: 2, crewExposed: false,
    maxSafeKwM: 0, can: ["move", "recon", "hold"],
  },
};

export function specOf(kind: UnitKind): UnitSpec {
  return UNIT_SPECS[kind];
}

export function canDo(kind: UnitKind, order: OrderType): boolean {
  return UNIT_SPECS[kind].can.includes(order);
}

/** Orders in a fixed order, for validation messages. */
export const ORDER_TYPES: readonly OrderType[] = ["move", "attack", "hose_line", "fire_break", "refill", "shuttle", "recon", "drop", "protect", "hold"];

export const ORDER_NAME_FI: Readonly<Record<OrderType, string>> = {
  move: "siirtyminen", attack: "suora hyökkäys", hose_line: "letkulinja", fire_break: "palokatko", refill: "veden täydennys",
  shuttle: "vesiajo", recon: "tiedustelu", drop: "vesipudotus", protect: "kohteen suojaus", hold: "paikallaan pysyminen",
};

export const ORDER_NAME_EN: Readonly<Record<OrderType, string>> = {
  move: "move", attack: "direct attack", hose_line: "hose line", fire_break: "fire break", refill: "refill",
  shuttle: "water shuttle", recon: "reconnaissance", drop: "water drop", protect: "structure protection", hold: "hold",
};
