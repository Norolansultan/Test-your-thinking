/**
 * Scenario data that phase 3's WP-1 adds before Gate A (SPEC/31 §5): the station's T/RH/dew-point series (D3, in the
 * records) and the flame-length table per step and segment (D1, a module in `tools/fire-ca/`). The export reads each
 * through the scenario's own sources when it is there and falls back to today's behaviour when it is not:
 *
 * - Station weather: the weather station's records (`site-scenario.json` `traffic`, actor `SAA`, "Sääasema …:
 *   lämpötila T °C, ilmankosteus RH %[, kastepiste Td °C]"). Today they give T/RH at the practice step and steps 10, 15
 *   and 19; with D3 every step. Nothing is interpolated: a step without a reading is null.
 * - Flame table: `tools/fire-ca/flame-table.ts`, when it exists, is imported and adapted (`adaptFlameTable`); its value
 *   for a step and segment (head, flank, rear) then replaces the band quoted from the records (which D1's records follow
 *   anyway). Without the module, the bands are quoted from the records, as before. A module that is there but has no
 *   shape this adapter knows is an error, never a silent fallback.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";

// ---------------------------------------------------------------------------------------------------
// Station weather (D3)
// ---------------------------------------------------------------------------------------------------

export interface StationRecord {
  readonly id: string;
  readonly cycle: number;
  readonly actor: string;
  readonly content: string;
}

export interface StationReading {
  readonly rhPct: number | null;
  readonly tempC: number | null;
  readonly dewPointC: number | null;
  readonly sourceId: string | null;
}

const num = (s: string): number => Number(s.replace(",", ".").replace("−", "-"));

/** The station's records of the scenario (actor `SAA`, the weather station; its display name may change, its id stays). */
export function stationRecords(): StationRecord[] {
  return SITE_SCENARIO.traffic.filter((t) => t.actor === "SAA").map((t) => ({ id: t.id, cycle: t.cycle, actor: t.actor, content: t.content }));
}

/** The station's first reading in `step` that gives the relative humidity (with T and dew point when it gives them). */
export function stationReading(step: number, records: readonly StationRecord[]): StationReading {
  const rec = records.find((t) => t.cycle === step && /ilmankosteus [−-]?\d+(?:,\d+)? %/.test(t.content));
  if (!rec) return { rhPct: null, tempC: null, dewPointC: null, sourceId: null };
  const rh = rec.content.match(/ilmankosteus ([−-]?\d+(?:,\d+)?) %/);
  const t = rec.content.match(/lämpötila ([−-]?\d+(?:,\d+)?) °C/);
  const td = rec.content.match(/kastepiste ([−-]?\d+(?:,\d+)?) °C/);
  return { rhPct: rh ? num(rh[1]!) : null, tempC: t ? num(t[1]!) : null, dewPointC: td ? num(td[1]!) : null, sourceId: rec.id };
}

// ---------------------------------------------------------------------------------------------------
// Flame table (D1)
// ---------------------------------------------------------------------------------------------------

export type FlameSegment = "head" | "flank" | "rear";

export interface FlameEntry {
  readonly loM: number;
  readonly hiM: number;
  /** "surface" | "passive_crown" | "active_crown", when the table states it. */
  readonly fireType?: string;
}

export interface FlameTable {
  /** Where the values come from (module and, when it states one, its version). */
  readonly source: string;
  /** The flame length over step `step`'s 20 minutes on `segment`; null where the table has no value. */
  at(step: number, segment: FlameSegment): FlameEntry | null;
}

/** The module D1 adds (SPEC/31 §5: "`tools/fire-ca/` (new module read by the traffic generators)"). */
export const FLAME_TABLE_MODULE = new URL("../fire-ca/flame-table.ts", import.meta.url);

type Raw = Record<string, unknown>;
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** An entry from the shapes a table may use: `{loM, hiM}`, `{lo, hi}`, `{minM, maxM}`, `[lo, hi]`, a single metre value. */
function entryOf(v: unknown): FlameEntry | null {
  if (isNum(v)) return { loM: v, hiM: v };
  if (Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1])) return { loM: v[0], hiM: v[1] };
  if (v && typeof v === "object") {
    const o = v as Raw;
    const lo = [o.loM, o.lo, o.minM, o.min].find(isNum);
    const hi = [o.hiM, o.hi, o.maxM, o.max, o.flameLengthM, o.lengthM].find(isNum);
    const ft = typeof o.fireType === "string" ? o.fireType : typeof o.fire_type === "string" ? o.fire_type : undefined;
    if (hi !== undefined) return { loM: lo ?? hi, hiM: hi, ...(ft ? { fireType: ft } : {}) };
  }
  return null;
}

const SEGMENT_KEYS: Readonly<Record<FlameSegment, readonly string[]>> = {
  head: ["head"], flank: ["flank", "flanks", "left_flank", "right_flank"], rear: ["rear", "back"],
};

/**
 * A FlameTable from the module's exports: a function `flameLengthAt(step, segment)` / `flameAt(step, segment)`, or data
 * `FLAME_TABLE` / `flameTable`: rows `{ step, segment, … }`, or a record by step of `{ head, flank, rear }`. Null when
 * no export has one of these shapes.
 */
export function adaptFlameTable(mod: Raw, source: string): FlameTable | null {
  const version = typeof mod.FLAME_TABLE_VERSION === "string" ? ` ${mod.FLAME_TABLE_VERSION}` : "";
  const label = `${source}${version}`;
  // WP-1's module (SPEC/31 §5 D1): `flameTable(steps)` builds the rows from the steps' head rates (its `flameAt(rate, landCover)` is
  // not a step lookup). Its values are used only where the records follow the table (`recordsFollow`: phase B); elsewhere the
  // export keeps quoting the records, so a phase-A record whose band its rate cannot give stays visible to the fire check.
  if (typeof mod.flameTable === "function") {
    const rows = (mod.flameTable as (steps: typeof SITE_SCENARIO.steps) => Raw[])(SITE_SCENARIO.steps);
    const field = { head: "headM", flank: "flankM", rear: "rearM" } as const;
    return {
      source: label,
      at: (step, segment) => {
        const row = rows.find((r) => r.step === step && r.recordsFollow !== false);
        const m = row?.[field[segment]];
        return row && isNum(m) ? { loM: m, hiM: m, fireType: row.crown === true ? "active_crown" : "surface" } : null;
      },
    };
  }
  const fn = [mod.flameLengthAt, mod.flameAt].find((f): f is (step: number, segment: string) => unknown => typeof f === "function");
  if (fn) return { source: label, at: (step, segment) => entryOf(fn(step, segment)) };
  const data = mod.FLAME_TABLE ?? mod.flameTable;
  if (Array.isArray(data)) {
    const rows = data as Raw[];
    return {
      source: label,
      at: (step, segment) => {
        const row = rows.find((r) => r.step === step && SEGMENT_KEYS[segment].includes(String(r.segment)));
        return row ? entryOf(row) : null;
      },
    };
  }
  if (data && typeof data === "object") {
    const byStep = data as Raw;
    return {
      source: label,
      at: (step, segment) => {
        const row = byStep[String(step)] as Raw | undefined;
        if (!row) return null;
        for (const k of SEGMENT_KEYS[segment]) if (row[k] !== undefined) return entryOf(row[k]);
        return null;
      },
    };
  }
  return null;
}

/** D1's table when its module exists (adapted), else null (the export quotes the records' bands). */
export async function loadFlameTable(moduleUrl: URL = FLAME_TABLE_MODULE): Promise<FlameTable | null> {
  if (!existsSync(fileURLToPath(moduleUrl))) return null;
  const mod = (await import(moduleUrl.href)) as Raw;
  const table = adaptFlameTable(mod, "tools/fire-ca/flame-table.ts");
  if (!table) throw new Error(`${fileURLToPath(moduleUrl)} exists but exports no flame table this export can read (tools/skills/scenario-extras.ts adaptFlameTable)`);
  return table;
}
