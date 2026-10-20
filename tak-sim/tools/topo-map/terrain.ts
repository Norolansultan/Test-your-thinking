/**
 * The generated site (SPEC/23 §11, SPEC/33): one fictional south-east Finnish landscape from which BOTH the participant's
 * topographic map and the fire model's fuel and elevation grids are derived, so the fire burns exactly the ground the map shows.
 *
 * This module is the facade the rest of the project imports. The stages live in their own modules:
 *
 *   geom.ts, terrain-base.ts   noise, geometry, the 20 m grid; the glacial base DEM (eskers, drumlins, knolls, valleys, basins)
 *   hydrology.ts, channels.ts  Priority-Flood+ε, D8, accumulation, TWI, HAND; channel tracing and carving
 *   water.ts                   lakes, Kotkanjoki, the brooks, the final DEM
 *   soil.ts                    mires (TWI / HAND / slope), drained mires, soistuma, soil, rock outcrops
 *   fields.ts, landcover.ts    farms and field parcels; land cover and forest stands
 *   roads-main.ts, roads.ts    the designed roads; the generated network (road-grid.ts routes)
 *   ditches.ts, places.ts      ditch networks; buildings and names
 */

import type { P } from "./terrain-base.js";

export * from "./terrain-base.js";
export * from "./water.js";
export * from "./water-query.js";
export * from "./soil.js";
export * from "./landcover.js";

/** The 110 kV power line: one straight cleared corridor NE–SW, 1.06 km SE of IGN at its nearest. */
export const POWER_LINE: readonly P[] = [
  { x: 1500 - 15000 * Math.sin(Math.PI / 4), y: -15000 * Math.cos(Math.PI / 4) },
  { x: 1500 + 15000 * Math.sin(Math.PI / 4), y: 15000 * Math.cos(Math.PI / 4) },
];
