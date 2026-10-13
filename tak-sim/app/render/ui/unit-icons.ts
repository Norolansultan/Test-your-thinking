/**
 * Type glyphs drawn inside the unit frames (SPEC/12 revision 24 Sep, "type glyphs"). Single-colour
 * line art in `currentColor`, so they take the own-formation hue from the frame and render the same
 * on every machine — colour emoji would not (OS font) and a red truck would collide with the fire
 * hues. Inline, so no request is made during a run (I3). The drone is the user-supplied Drone.svg
 * (200×200), redrawn as outline only.
 */

import type { AirKind } from "../../scenario/types.js";

export type UnitKind = "truck" | "robot" | "drone" | "helicopter" | "plane" | "water_drone";
/** Glyphs for a crew working on foot away from its vehicle: what it is doing (SPEC/18 revision (m)). */
export type TaskGlyph = "water" | "pump" | "peat" | "cut" | "dig";

const svg = (viewBox: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const UNIT_ICON_SVG: Readonly<Record<UnitKind, string>> = {
  // Fire engine: body with cab, ladder on the roof, two wheels.
  truck: svg(
    "0 0 24 24",
    `<g stroke-width="2"><path d="M2 17V9h11v8"/><path d="M13 11h4.5l3.5 3.5V17"/><path d="M3 6.5h9M4.5 5v3M7.5 5v3M10.5 5v3"/><path d="M2 17h19"/></g><g stroke-width="1.8"><circle cx="6.5" cy="18.5" r="2"/><circle cx="16.5" cy="18.5" r="2"/></g>`,
  ),
  // Hose-laying robot: tracked chassis with a hose reel.
  robot: svg(
    "0 0 24 24",
    `<g stroke-width="2"><rect x="3" y="14" width="18" height="6" rx="3"/><path d="M7 14v-3h10v3"/><circle cx="12" cy="7" r="3"/></g><g stroke-width="1.6"><circle cx="7" cy="17" r="1"/><circle cx="12" cy="17" r="1"/><circle cx="17" cy="17" r="1"/></g>`,
  ),
  drone: svg(
    "0 0 200 200",
    `<g stroke-width="14"><rect x="85" y="70" width="30" height="60" rx="15"/><line x1="88" y1="78" x2="62" y2="52"/><line x1="112" y1="78" x2="138" y2="52"/><line x1="88" y1="122" x2="62" y2="148"/><line x1="112" y1="122" x2="138" y2="148"/><path d="M 64,66 A 22,22 0 1,1 66,38"/><path d="M 134,38 A 22,22 0 1,1 136,66"/><path d="M 38,134 A 22,22 0 1,1 66,134"/><path d="M 134,162 A 22,22 0 1,1 162,134"/></g>`,
  ),
  // Helicopter: main rotor, cabin, tail boom and skids.
  helicopter: svg(
    "0 0 24 24",
    `<g stroke-width="2"><path d="M3 5h16M11 5v3"/><path d="M5 12.5c0-2.5 2.5-4.5 6-4.5 3 0 5 2 5 4.5 0 1.5-1 2.5-3 2.5H8c-2 0-3-1-3-2.5z"/><path d="M16 11h6M22 9v4"/><path d="M7 19h9M9 15v4M13 15v4"/></g>`,
  ),
  // Water drone: the drone frame with a water load slung beneath.
  water_drone: svg(
    "0 0 24 24",
    `<g stroke-width="1.8"><path d="M4 5h5M15 5h5M6.5 5v2.5M17.5 5v2.5"/><rect x="7" y="7" width="10" height="4" rx="2"/><path d="M12 11v2"/><path d="M12 13.5c-1.8 2.6-3.2 4.2-3.2 5.6a3.2 3.2 0 0 0 6.4 0c0-1.4-1.4-3-3.2-5.6z"/></g>`,
  ),
  // Fixed-wing spotting aircraft, seen from above.
  plane: svg(
    "0 0 24 24",
    `<g stroke-width="2"><path d="M12 2.5c1 0 1.5 1 1.5 2.5v14c0 1.5-.5 2.5-1.5 2.5s-1.5-1-1.5-2.5V5c0-1.5.5-2.5 1.5-2.5z"/><path d="M2.5 10.5h19"/><path d="M8 19.5h8"/></g>`,
  ),
};

export const TASK_ICON_SVG: Readonly<Record<TaskGlyph, string>> = {
  // Hose attack: a water drop.
  water: svg("0 0 24 24", `<path stroke-width="2" d="M12 2.5c-3.2 4.6-6.5 7.9-6.5 11.5a6.5 6.5 0 0 0 13 0c0-3.6-3.3-6.9-6.5-11.5z"/>`),
  // Portable pump from natural water: a drop over a water line.
  pump: svg("0 0 24 24", `<g stroke-width="2"><path d="M12 2.5c-2.4 3.4-4.8 5.9-4.8 8.6a4.8 4.8 0 0 0 9.6 0c0-2.7-2.4-5.2-4.8-8.6z"/><path d="M2.5 20c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6.5 0"/></g>`),
  // Peat fire: a drop soaking into layered ground.
  peat: svg("0 0 24 24", `<g stroke-width="2"><path d="M12 2.5c-2 2.9-4 5-4 7.3a4 4 0 0 0 8 0c0-2.3-2-4.4-4-7.3z"/><path d="M3 16.5h18M5 20.5h4M11 20.5h3M17 20.5h3"/></g>`),
  // Fire break: a felled tree.
  cut: svg("0 0 24 24", `<g stroke-width="2"><path d="M8 3l-5 8h3.5L3 16.5h10L9.5 11H13z"/><path d="M8 16.5v4"/><path d="M13.5 21l8-5.5M15 13l6 4.5"/></g>`),
  // Mop-up with hand tools: a shovel.
  dig: svg("0 0 24 24", `<g stroke-width="2"><path d="M9 2.5h6M12 2.5v11"/><path d="M7.5 13.5h9l-1 5.2c-.3 1.6-1.7 2.8-3.5 2.8s-3.2-1.2-3.5-2.8z"/></g>`),
};

/** Ground units are engines except the hose-laying robot; aircraft kinds come from the scenario. */
export function unitKind(id: string, air: AirKind | null): UnitKind {
  if (air === "drone") return "drone";
  if (air === "helicopter") return "helicopter";
  if (air === "fixed_wing") return "plane";
  if (air === "water_drone") return "water_drone";
  return id.startsWith("UGV") ? "robot" : "truck";
}

/** The glyph a crew on foot shows for its task; null when the task keeps the unit with its vehicle. */
export function taskGlyph(task: string): TaskGlyph | null {
  switch (task) {
    case "hose_attack": return "water";
    case "pump_attack": return "pump";
    case "peat_soak": return "peat";
    case "firebreak": return "cut";
    // road_line (fix pass 7): the crew is with its vehicle on the road, no glyph.
    case "mop_up": return "dig";
    default: return null;
  }
}
