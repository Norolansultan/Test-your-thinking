/**
 * Game mode, live fire model: per-fuel properties for the 13 Finnish fuel classes of
 * content/site/site.json's legend (`FUEL` in ../contracts.ts).
 *
 * EVERY NUMBER HERE IS PROVISIONAL — game-tuned from the literature named on each line, pending the
 * domain reviewer (as SPEC/24 §4.3's mapping for the offline CA). The offline CA (tools/fire-ca) has
 * no rates of its own (speed was authored per cycle, SPEC/24 §3.1); its calibrated targets that this
 * model reproduces are length-to-breadth 1.3 / 2.8 / 4.3 at 4 / 9 / 14 m/s and a head of ~4–6 m/min
 * on pine heath in the scenario's opening wind (SPEC/18 §7 W1–W3).
 *
 * Units: rate of spread m/min on flat ground, no wind, at the reference fine-fuel moisture
 * (`M_REF_PCT` in ros.ts, 8 % ≈ 20 °C and 40 % RH); fuel loads kg/m² consumed; times seconds;
 * intensities kW/m (Byram I = H·w·R); water litres per 25 m cell.
 */

import { FUEL, type FuelCode } from "../contracts.js";

/** How a non-burnable cell behaves as a barrier. */
export type BarrierKind = "none" | "water" | "road" | "brook" | "built";

export interface FuelProps {
  readonly code: number;
  readonly id: string;
  readonly burnable: boolean;
  readonly barrier: BarrierKind;
  /** Head-free base rate of spread, m/min (flat, calm, reference dryness). */
  readonly baseRosMMin: number;
  /** Minimum flaming time of a cell, s (it stays alight longer while its front still advances). */
  readonly residenceS: number;
  /** Surface fuel consumed by the flaming front, kg/m². */
  readonly surfaceLoadKgM2: number;
  /** Canopy fuel consumed in a crown fire, kg/m² (0: no crown). */
  readonly crownLoadKgM2: number;
  /** Surface intensity at which the crowns ignite, kW/m (Infinity: never). */
  readonly crownThresholdKWm: number;
  /** Rate multiplier when the fire runs in the crowns. */
  readonly crownRosFactor: number;
  /** Ground fire after flaming (humus, peat), s (0: burns out). */
  readonly smoulderS: number;
  /** Chance per minute that a smouldering cell flares up again when dry and windy. */
  readonly rekindlePerMin: number;
  /** Chance that a landing ember starts a fire, at reference dryness. */
  readonly emberReceptivity: number;
  /** Extra water per cell to drown the ground fire (mop-up), litres. */
  readonly mopUpL: number;
}

/** Byram's heat yield for forest fuels, kJ/kg (Byram 1959; 18 000 is the usual value). PROVISIONAL. */
export const HEAT_KJ_KG = 18_000;

const NO_FUEL_PROPS = {
  burnable: false, baseRosMMin: 0, residenceS: 0, surfaceLoadKgM2: 0, crownLoadKgM2: 0,
  crownThresholdKWm: Number.POSITIVE_INFINITY, crownRosFactor: 1, smoulderS: 0, rekindlePerMin: 0,
  emberReceptivity: 0, mopUpL: 0,
} as const;

/** Indexed by fuel code. */
export const FUEL_PROPS: readonly FuelProps[] = [
  // 0 water: lakes and ponds stop everything; embers do not cross more than 2 cells of it (game rule, spread.ts).
  { code: FUEL.water, id: "water", barrier: "water", ...NO_FUEL_PROPS },
  // 1 gravel road (6–8 m): stops the surface front; a strong head may spot across (SPEC/24 §12).
  { code: FUEL.road_gravel, id: "road_gravel", barrier: "road", ...NO_FUEL_PROPS },
  {
    code: FUEL.field, id: "field", burnable: true, barrier: "none",
    baseRosMMin: 2.0, // cured grass/stubble spreads fastest at no wind (McArthur grassland, low end). PROVISIONAL
    residenceS: 30, // fine grass flames ~20–40 s (Anderson 1969 τ ≈ 8·d). PROVISIONAL
    surfaceLoadKgM2: 0.3, // cured grass 0.2–0.4 kg/m². PROVISIONAL
    crownLoadKgM2: 0, crownThresholdKWm: Number.POSITIVE_INFINITY, crownRosFactor: 1, // no canopy
    smoulderS: 0, rekindlePerMin: 0, // mineral soil, no duff
    emberReceptivity: 0.6, // cured grass catches readily. PROVISIONAL
    mopUpL: 0,
  },
  {
    code: FUEL.pine_heath, id: "pine_heath", burnable: true, barrier: "none",
    baseRosMMin: 1.2, // lichen/litter/dwarf-shrub floor; gives ~5 m/min head at 5 m/s, 30 % RH (SPEC/18 W1–W3: 3–6). PROVISIONAL
    residenceS: 120, // litter + shrubs flame ~1–3 min. PROVISIONAL
    surfaceLoadKgM2: 1.0, // dry heath floor consumed 0.8–1.5 kg/m². PROVISIONAL
    crownLoadKgM2: 0.8, // Scots pine canopy fuel load ~0.6–1.0 kg/m². PROVISIONAL
    crownThresholdKWm: 3500, // Van Wagner (1977) I0 with CBH ~7 m, FMC 100 % ≈ 3 100 kW/m. PROVISIONAL
    crownRosFactor: 2.0, // active crown ~2 × surface: ~37 m/min at 14 m/s, 30 % RH (FBP C-3 at ISI ~30: ~30 m/min). PROVISIONAL
    smoulderS: 1200, // thin humus on sandy heath. PROVISIONAL
    rekindlePerMin: 0.003, // little holdover on mineral soil. PROVISIONAL
    emberReceptivity: 0.6, // lichen and needle litter are receptive. PROVISIONAL
    mopUpL: 80,
  },
  {
    code: FUEL.spruce_mature, id: "spruce_mature", burnable: true, barrier: "none",
    baseRosMMin: 0.6, // moist moss floor, sheltered: slow surface fire. PROVISIONAL
    residenceS: 240, // deeper moss/litter, dead branches. PROVISIONAL
    surfaceLoadKgM2: 1.5, // moss, litter and dead lower branches. PROVISIONAL
    crownLoadKgM2: 1.2, // dense unthinned Norway spruce canopy. PROVISIONAL
    crownThresholdKWm: 1500, // ladder fuels to the ground, CBH ~2–3 m: I0 ≈ 900–1 200 kW/m (Van Wagner 1977); crowns at ~7 m/s, 30 % RH (SPEC/18 cycle 6). PROVISIONAL
    crownRosFactor: 3.5, // FBP C-2 active crown 22–31 m/min at ISI 15–20 vs surface (SPEC/24 ah.7). PROVISIONAL
    smoulderS: 3600, // thick moss and humus hold fire for an hour. PROVISIONAL
    rekindlePerMin: 0.005, // PROVISIONAL
    emberReceptivity: 0.5, // dry feather moss. PROVISIONAL
    mopUpL: 250,
  },
  {
    code: FUEL.spruce_thinned, id: "spruce_thinned", burnable: true, barrier: "none",
    baseRosMMin: 0.8, // more wind and sun reach a drier floor. PROVISIONAL
    residenceS: 200, // PROVISIONAL
    surfaceLoadKgM2: 1.2, // thinning slash partly removed. PROVISIONAL
    crownLoadKgM2: 0.9, // PROVISIONAL
    crownThresholdKWm: 2500, // lower branches pruned, CBH ~4–5 m. PROVISIONAL
    crownRosFactor: 3.0, // PROVISIONAL
    smoulderS: 2400, // PROVISIONAL
    rekindlePerMin: 0.004, // PROVISIONAL
    emberReceptivity: 0.5, // PROVISIONAL
    mopUpL: 200,
  },
  {
    code: FUEL.birch_aspen, id: "birch_aspen", burnable: true, barrier: "none",
    baseRosMMin: 0.4, // green herb layer, deciduous litter: the crown run drops here (SPEC/24 §11). PROVISIONAL
    residenceS: 90, // PROVISIONAL
    surfaceLoadKgM2: 0.6, // PROVISIONAL
    crownLoadKgM2: 0, crownThresholdKWm: Number.POSITIVE_INFINITY, crownRosFactor: 1, // broadleaf crowns do not carry fire
    smoulderS: 600, // PROVISIONAL
    rekindlePerMin: 0.001, // PROVISIONAL
    emberReceptivity: 0.25, // moist litter. PROVISIONAL
    mopUpL: 50,
  },
  {
    code: FUEL.drained_peat, id: "drained_peat", burnable: true, barrier: "none",
    baseRosMMin: 0.5, // drained pine mire: sparse surface fuel (Kalajoki 2–3 m/min on peat in wind, SPEC/24 ah.7). PROVISIONAL
    residenceS: 180, // PROVISIONAL
    surfaceLoadKgM2: 1.2, // moss, dwarf shrubs and the dry top of the peat. PROVISIONAL
    crownLoadKgM2: 0.5, // sparse stunted pine. PROVISIONAL
    crownThresholdKWm: 4000, // high, open canopy. PROVISIONAL
    crownRosFactor: 2.0, // PROVISIONAL
    smoulderS: 21_600, // drained peat smoulders for hours to days; 6 h in game time (SPEC/18 the Rahkasuo holdover). PROVISIONAL
    rekindlePerMin: 0.02, // the omission fire of the study: peat flares up again in dry wind. PROVISIONAL
    emberReceptivity: 0.5, // PROVISIONAL
    mopUpL: 600, // peat soaks water up and burns underground: long mop-up. PROVISIONAL
  },
  {
    code: FUEL.cleared_corridor, id: "cleared_corridor", burnable: true, barrier: "none",
    baseRosMMin: 1.5, // power-line corridor: grass, shrubs, cleared slash. PROVISIONAL
    residenceS: 90, // PROVISIONAL
    surfaceLoadKgM2: 0.8, // PROVISIONAL
    crownLoadKgM2: 0, crownThresholdKWm: Number.POSITIVE_INFINITY, crownRosFactor: 1, // cleared: no canopy
    smoulderS: 900, // slash piles. PROVISIONAL
    rekindlePerMin: 0.002, // PROVISIONAL
    emberReceptivity: 0.6, // PROVISIONAL
    mopUpL: 80,
  },
  // 9 built-up ground: not burnable here; structures are scored by the game from nearby fire.
  { code: FUEL.built, id: "built", barrier: "built", ...NO_FUEL_PROPS },
  {
    code: FUEL.open_bog, id: "open_bog", burnable: true, barrier: "none",
    baseRosMMin: 0.8, // sedge and sphagnum when dry (a drought bog); wet bogs are held back by moisture. PROVISIONAL
    residenceS: 60, // PROVISIONAL
    surfaceLoadKgM2: 0.5, // PROVISIONAL
    crownLoadKgM2: 0, crownThresholdKWm: Number.POSITIVE_INFINITY, crownRosFactor: 1, // treeless
    smoulderS: 3600, // surface peat. PROVISIONAL
    rekindlePerMin: 0.004, // PROVISIONAL
    emberReceptivity: 0.35, // PROVISIONAL
    mopUpL: 300,
  },
  // 11 forest road (4–5 m): stops the surface front; spotted over by a strong head (SPEC/24 §12).
  { code: FUEL.road_forest, id: "road_forest", barrier: "road", ...NO_FUEL_PROPS },
  // 12 brook: wet banks stop the surface front, but embers leak across now and then (SPEC/24 §12, leak 3 %).
  { code: FUEL.brook, id: "brook", barrier: "brook", ...NO_FUEL_PROPS },
];

const UNKNOWN: FuelProps = { code: -1, id: "unknown", barrier: "built", ...NO_FUEL_PROPS };

/** Properties of a fuel code; unknown codes are treated as not burnable. */
export function fuelProps(code: number): FuelProps {
  return FUEL_PROPS[code] ?? UNKNOWN;
}

export function isBurnable(code: number): boolean {
  return fuelProps(code).burnable;
}

/** True when the fuel's crowns can carry a fire. */
export function isCrownCapable(code: number): boolean {
  return Number.isFinite(fuelProps(code).crownThresholdKWm);
}

/** Every legend code has a row, in code order (checked by the tests). */
export const FUEL_CODES: readonly FuelCode[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
