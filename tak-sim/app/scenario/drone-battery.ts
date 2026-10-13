/**
 * The drone battery model (consistency review 1 Oct 2026, items 2–3): one deterministic timeline per
 * platform, from the steps it flies. The generator's battery lines (`tools/fire-ca/traffic-drones.ts`)
 * and the allocation roster (`allocation.ts`) both read it, so what the log says about a battery and
 * whether the participant can task the drone never disagree.
 *
 * A pack drains linearly over the platform's endurance (DR1/DR2 35 min ≈ 2.9 %/min, the VTOL DR3
 * 150 min); at 20 % the drone lands for a swap and flies again `swapGapMin` later on a full pack.
 * A swapped-out pack goes to the charger at the command post and is full again `rechargeMin` later.
 * If no charged pack is left at a swap, the drone lands with every pack empty and cannot fly (or be
 * tasked) until the first pack is charged. With three packs and a 90-minute charge, DR2's 100-minute
 * sortie (steps 4–8) runs dry at its third swap, which is the step-9 grounding of SPEC/18 §8.2.
 *
 * Times are simulation seconds (0 = start of step 1, 13:20); step n spans [(n−1)·1200, n·1200).
 */

export interface BatterySpec {
  readonly enduranceMin: number;
  readonly packs: number;
  readonly rechargeMin: number;
  readonly swapGapMin: number;
}

export const DRONE_BATTERY: Readonly<Record<string, BatterySpec>> = {
  DR1: { enduranceMin: 35, packs: 4, rechargeMin: 90, swapGapMin: 5 },
  DR2: { enduranceMin: 35, packs: 3, rechargeMin: 90, swapGapMin: 5 },
  DR3: { enduranceMin: 150, packs: 2, rechargeMin: 90, swapGapMin: 10 },
  VD1: { enduranceMin: 25, packs: 6, rechargeMin: 90, swapGapMin: 4 },
};
/**
 * The drone team's kit from the company-level reinforcements on (fix pass 2, 7 Oct 2026, FC3; current kit): a
 * generator at the command post charges a pack in about 45 min, and the spare packs come with it (six per
 * thermal multicopter), so DR1 and DR2 can stay up through the evening in battery swaps. Before 16.40 the
 * day's kit stands: DR2's sortie of steps 4–8 still runs dry at 15.54.
 */
export const KIT_UPGRADE: Readonly<Record<string, { readonly atS: number; readonly packs: number; readonly rechargeMin: number }>> = {
  DR1: { atS: 10 * 1200, packs: 6, rechargeMin: 45 },
  DR2: { atS: 10 * 1200, packs: 6, rechargeMin: 45 },
};
/** The level at which a drone lands to swap. */
export const SWAP_AT_PCT = 20;
const STEP_S = 1200;

/**
 * DR1 is already up at the handover (SPEC/18 §8.2: launched at W2, battery swap at W4): its pack
 * went in at 13:03 after a swap at 12:58; the pack it replaced is on the charger.
 */
const AT_HANDOVER: Readonly<Record<string, { readonly levelPct: number; readonly chargingSinceS: readonly number[] }>> = {
  DR1: { levelPct: 51, chargingSinceS: [-1320] },
};

export interface BatterySwap { readonly atS: number; readonly backS: number }
export interface DryLanding { readonly atS: number; readonly chargedAtS: number }

export interface BatteryTimeline {
  readonly id: string;
  /** Swaps: landed at 20 % at `atS`, up again on a full pack at `backS`. */
  readonly swaps: readonly BatterySwap[];
  /** Landings with every pack empty, and when the first pack is charged again. */
  readonly dry: readonly DryLanding[];
  /** Battery percentage in the air at `s` (rounded); null on the ground (swap, grounded, not flying). */
  levelAt(s: number): number | null;
  /** Whether the drone can be tasked at `s`: false only while every pack is empty and charging. */
  taskableAt(s: number): boolean;
}

interface Segment { readonly fromS: number; readonly toS: number; readonly fromPct: number }

/** Maximal runs of consecutive steps: [start, end) in seconds. */
function sorties(steps: readonly number[]): { startS: number; endS: number }[] {
  const sorted = [...new Set(steps)].sort((a, b) => a - b);
  const out: { startS: number; endS: number }[] = [];
  for (const n of sorted) {
    const last = out[out.length - 1];
    if (last && last.endS === (n - 1) * STEP_S) out[out.length - 1] = { startS: last.startS, endS: n * STEP_S };
    else out.push({ startS: (n - 1) * STEP_S, endS: n * STEP_S });
  }
  return out;
}

/** The platform's battery over the day, from the steps it is in the air (`AIR_PLAN`, or the bundle's aircraft). */
export function batteryTimeline(id: string, flightSteps: readonly number[]): BatteryTimeline {
  const spec = DRONE_BATTERY[id];
  if (!spec) throw new Error(`no battery spec for ${id}`);
  const ratePerS = 100 / (spec.enduranceMin * 60);
  const rechargeS = spec.rechargeMin * 60;
  const gapS = spec.swapGapMin * 60;
  const up = KIT_UPGRADE[id];
  /** When a pack put on the charger at `t` for a full charge's share `share` is full: the generator's charge from the upgrade on. */
  const chargedBy = (t: number, share: number): number => {
    if (!up) return t + Math.round(rechargeS * share);
    const fast = Math.round(up.rechargeMin * 60 * share);
    return t >= up.atS ? t + fast : Math.min(t + Math.round(rechargeS * share), up.atS + fast);
  };
  /** When each pack is full again (−Infinity: full from the start); the upgrade's spare packs are there from its time. */
  const readyAt: number[] = Array.from({ length: Math.max(spec.packs, up?.packs ?? 0) }, (_, k) => (k < spec.packs ? -Infinity : up!.atS));
  const segments: Segment[] = [];
  const swaps: BatterySwap[] = [];
  const dry: DryLanding[] = [];
  const handover = AT_HANDOVER[id];
  const chargedPack = (t: number, not: number) => {
    let best = -1;
    readyAt.forEach((r, k) => { if (k !== not && r <= t && (best < 0 || r < readyAt[best]!)) best = k; });
    return best;
  };

  sorties(flightSteps).forEach(({ startS, endS }, i) => {
    let t = startS;
    let level = 100;
    let pack: number;
    if (i === 0 && handover && startS === 0) {
      pack = 0;
      level = handover.levelPct;
      handover.chargingSinceS.forEach((since, k) => { readyAt[k + 1] = chargedBy(since, 1); });
    } else {
      pack = chargedPack(t, -1);
      if (pack < 0) throw new Error(`${id}: launched at ${t} s with no charged pack (AIR_PLAN contradicts the battery model)`);
    }
    for (;;) {
      const swapAt = Math.round(t + (level - SWAP_AT_PCT) / ratePerS);
      if (swapAt >= endS) {
        segments.push({ fromS: t, toS: endS, fromPct: level });
        const left = level - (endS - t) * ratePerS;
        readyAt[pack] = chargedBy(endS, (100 - left) / (100 - SWAP_AT_PCT));
        return;
      }
      segments.push({ fromS: t, toS: swapAt, fromPct: level });
      readyAt[pack] = chargedBy(swapAt, 1);
      const next = chargedPack(swapAt, pack);
      if (next < 0) {
        dry.push({ atS: swapAt, chargedAtS: Math.min(...readyAt) });
        return;
      }
      swaps.push({ atS: swapAt, backS: swapAt + gapS });
      pack = next;
      t = swapAt + gapS;
      level = 100;
    }
  });

  return {
    id, swaps, dry,
    levelAt(s) {
      const seg = segments.find((g) => g.fromS <= s && s < g.toS);
      return seg ? Math.round(Math.max(SWAP_AT_PCT, seg.fromPct - (s - seg.fromS) * ratePerS)) : null;
    },
    taskableAt(s) {
      return !dry.some((d) => d.atS <= s && s < d.chargedAtS);
    },
  };
}
