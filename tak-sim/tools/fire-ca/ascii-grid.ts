/**
 * Loads a real site from rasters exported from QGIS as ESRI ASCII grids (SPEC/23 §5, SPEC/24 §4):
 * a truth fuel raster, the machine's (stale) fuel raster, and optionally elevation — all in
 * ETRS-TM35FIN, same extent and cell size. Raster values are fuel codes mapped to fuel classes
 * through a legend, so the classification lives with the data, not in code.
 *
 * The grid is kept aligned to TM35 grid north. At the study area (≈27.3° E, 0.3° from the
 * central meridian) grid and true north differ by about 0.3°, i.e. ~40 m across an 8 km grid —
 * below what the scenario resolves.
 */

import { readFileSync } from "node:fs";
import type { GridFrame } from "./geometry.js";
import type { FuelClass, FuelGrid } from "./model.js";
import type { SiteModel } from "./run.js";
import { tm35ToWgs84 } from "./tm35.js";

export interface AsciiGrid {
  readonly cols: number;
  readonly rows: number;
  readonly xllcorner: number;
  readonly yllcorner: number;
  readonly cellSize: number;
  readonly nodata: number | null;
  /** Row 0 = SOUTHERN edge (flipped from the file's top-down order). */
  readonly values: Float64Array;
}

export function parseAsciiGrid(text: string): AsciiGrid {
  const lines = text.split(/\r?\n/);
  const header = new Map<string, number>();
  let li = 0;
  for (; li < lines.length; li++) {
    const m = /^\s*([A-Za-z_]+)\s+(-?[\d.eE+-]+)\s*$/.exec(lines[li]!);
    if (!m) break;
    header.set(m[1]!.toLowerCase(), Number(m[2]));
  }
  const need = (k: string) => {
    const v = header.get(k);
    if (v === undefined) throw new Error(`ASCII grid header missing "${k}"`);
    return v;
  };
  const cols = need("ncols");
  const rows = need("nrows");
  const cellSize = need("cellsize");
  const xll = header.get("xllcorner") ?? need("xllcenter") - cellSize / 2;
  const yll = header.get("yllcorner") ?? need("yllcenter") - cellSize / 2;
  const nodata = header.get("nodata_value") ?? null;
  const values = new Float64Array(cols * rows);
  let fileRow = 0;
  for (; li < lines.length && fileRow < rows; li++) {
    const parts = lines[li]!.trim().split(/\s+/);
    if (parts.length === 1 && parts[0] === "") continue;
    if (parts.length !== cols) throw new Error(`ASCII grid row ${fileRow} has ${parts.length} values, expected ${cols}`);
    const r = rows - 1 - fileRow; // flip: file is north-first
    for (let c = 0; c < cols; c++) values[r * cols + c] = Number(parts[c]);
    fileRow++;
  }
  if (fileRow !== rows) throw new Error(`ASCII grid has ${fileRow} data rows, expected ${rows}`);
  return { cols, rows, xllcorner: xll, yllcorner: yll, cellSize, nodata, values };
}

export interface RealSiteSpec {
  readonly name: string;
  readonly truthFuelPath: string;
  readonly machineFuelPath: string;
  readonly elevationPath?: string;
  /** Raster code -> fuel class id. Codes not listed (and NODATA) become the `noFuelId` class. */
  readonly legend: readonly { readonly code: number; readonly fuelId: string }[];
  readonly noFuelId: string;
  readonly classes: readonly FuelClass[];
  readonly ignitionTm35: { readonly eastM: number; readonly northM: number };
  readonly referenceFuelId: string;
}

function toFuel(grid: AsciiGrid, spec: RealSiteSpec): Uint8Array {
  const index = (id: string) => {
    const i = spec.classes.findIndex((c) => c.id === id);
    if (i < 0) throw new Error(`legend refers to unknown fuel class "${id}"`);
    return i;
  };
  const byCode = new Map<number, number>();
  for (const { code, fuelId } of spec.legend) byCode.set(code, index(fuelId));
  const fallback = index(spec.noFuelId);
  const out = new Uint8Array(grid.values.length);
  for (let i = 0; i < out.length; i++) {
    const v = grid.values[i]!;
    out[i] = grid.nodata !== null && v === grid.nodata ? fallback : byCode.get(v) ?? fallback;
  }
  return out;
}

export function loadRealSite(spec: RealSiteSpec): SiteModel {
  const truthGrid = parseAsciiGrid(readFileSync(spec.truthFuelPath, "utf8"));
  const machineGrid = parseAsciiGrid(readFileSync(spec.machineFuelPath, "utf8"));
  const sameShape = (g: AsciiGrid) =>
    g.cols === truthGrid.cols && g.rows === truthGrid.rows && g.cellSize === truthGrid.cellSize &&
    g.xllcorner === truthGrid.xllcorner && g.yllcorner === truthGrid.yllcorner;
  if (!sameShape(machineGrid)) throw new Error("machine fuel raster must match the truth raster's extent and cell size");
  let elevationM: Float32Array | null = null;
  if (spec.elevationPath) {
    const eg = parseAsciiGrid(readFileSync(spec.elevationPath, "utf8"));
    if (!sameShape(eg)) throw new Error("elevation raster must match the truth raster's extent and cell size");
    elevationM = Float32Array.from(eg.values);
  }
  const frame: GridFrame = {
    origin: tm35ToWgs84(truthGrid.xllcorner, truthGrid.yllcorner),
    cols: truthGrid.cols,
    rows: truthGrid.rows,
    cellSizeM: truthGrid.cellSize,
  };
  const grid = (fuel: Uint8Array): FuelGrid => ({ cols: frame.cols, rows: frame.rows, cellSizeM: frame.cellSizeM, fuel, classes: spec.classes, elevationM });
  return {
    name: spec.name,
    frame,
    truthFuel: grid(toFuel(truthGrid, spec)),
    machineFuel: grid(toFuel(machineGrid, spec)),
    ignitionM: { eastM: spec.ignitionTm35.eastM - truthGrid.xllcorner, northM: spec.ignitionTm35.northM - truthGrid.yllcorner },
    referenceFuelId: spec.referenceFuelId,
  };
}
