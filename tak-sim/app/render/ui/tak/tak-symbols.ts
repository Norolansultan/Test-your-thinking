/**
 * MIL-STD-2525C symbols for the TAK shell (SPEC/28 §2.3, §4), drawn with milsymbol (MIT) from the SIDC that
 * `app/tak/symbols.ts` gives each platform, so the map and the exported CoT never disagree about what an object is. The
 * classic shell keeps its own icons (`unit-icons.ts`).
 *
 * The call sign is drawn ATAK-style as a label under the symbol (`unit-markers.ts`), not as a 2525 text field beside it:
 * the marker keeps the box the unit declutter lays out (`unitBox`), so stacks and leader lines work as in the classic map.
 * milsymbol draws inline SVG with no network, no clock and no randomness; the same platform gives the same markup.
 */

import ms from "milsymbol";
import { sidcOf, SELF_SIDC } from "../../../tak/symbols.js";

/** The symbols' own outline: a white casing so the friendly frames hold over the basemap's blue water and bogs. */
const STYLE = { outlineColor: "white", outlineWidth: 4, strokeWidth: 4 } as const;

const cache = new Map<string, string>();

/** A 2525 symbol's SVG markup for a SIDC, scaled to fill its box (`width`/`height` 100 %). */
export function symbolSvg(sidc: string, size = 24, uniqueDesignation?: string): string {
  const key = `${sidc}|${size}|${uniqueDesignation ?? ""}`;
  let svg = cache.get(key);
  if (svg === undefined) {
    const sym = new ms.Symbol(sidc, { size, ...STYLE, ...(uniqueDesignation ? { uniqueDesignation, infoFields: false } : {}) });
    svg = sym.asSVG().replace(/^<svg([^>]*?) width="[\d.]+" height="[\d.]+"/, '<svg$1 width="100%" height="100%" style="display:block;overflow:visible"');
    cache.set(key, svg);
  }
  return svg;
}

/** A platform's map symbol (`sidcOf` its id); the call sign is carried as the symbol's unique designation, not drawn. */
export function takMarkerSvg(platformId: string, callsign: string): string {
  return symbolSvg(sidcOf(platformId), 24, callsign);
}

/** The participant's own ("self") symbol: the incident commander at the command post. */
export function selfSymbolSvg(): string {
  return symbolSvg(SELF_SIDC, 24);
}

/** Whether milsymbol accepts a SIDC (tests: every platform's SIDC is a valid 2525C symbol). */
export function isValidSidc(sidc: string): boolean {
  return new ms.Symbol(sidc, {}).isValid() === true;
}
