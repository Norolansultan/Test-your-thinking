/**
 * The map-reading pretest's extract overlay (difficulty audit, 23 Oct 2026, `proposal-map.md` c.2): the 4 × 4 grid of 625 m squares
 * (A–D west to east along the top, 1–4 north to south down the left), the point marks (a ringed label on a dot), the area mark X (a
 * dashed ring), a 500 m scale bar and a north arrow — the same drawing on the participant's screen (`MapPretestScreen`) and in the key
 * checkers' preview (`tools/review/map-pretest.ts`). The spec comes from the tool's output (`content/pretest/map-pretest.json`), which
 * carries no key. Pure: a string of SVG elements in the extract's own pixels.
 */

export interface PretestMark {
  readonly id: string;
  /** What the stems call it: "1", "2", "★", "X", "A", "B". */
  readonly label: string;
  readonly kind: "point" | "area";
  /** Extract pixels (4 m), origin at its north-west corner. */
  readonly x: number;
  readonly y: number;
}

export interface PretestOption { readonly id: string; readonly fi: string; readonly en: string }
export interface PretestItem {
  readonly id: string;
  readonly skill: string;
  readonly stem: { readonly fi: string; readonly en: string };
  readonly options: readonly PretestOption[];
}

export interface MapPretestSpec {
  readonly generatedBy: string;
  readonly version: string;
  /** The extract: basemap pixels x0…x0+size, y0…y0+size, which lie in tile `tile` at tileX0, tileY0 (a tile is tilePx square). */
  readonly crop: {
    readonly x0: number; readonly y0: number; readonly size: number; readonly tile: string; readonly tileX0: number; readonly tileY0: number;
    readonly tilePx: number; readonly metresPerPixel: number; readonly squarePx: number;
  };
  readonly scaleBarMetres: number;
  readonly timeLimitMs: number;
  readonly marks: readonly PretestMark[];
  readonly items: readonly PretestItem[];
}

const INK = "#1c1b19";
const HALO = "paint-order:stroke;stroke:#ffffff;stroke-width:3px;stroke-linejoin:round";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The frame around the extract that holds the grid's letters and numbers, px (outside the map, so no label covers a feature). */
export const PRETEST_FRAME_PX = 24;

/**
 * The whole picture as one SVG document: the tile clipped to the extract, the overlay over it, the grid labels in the frame. `tileHref`
 * is the tile's URL (`/maps/topo/<tile>.webp`, or `topo-en` in English sessions).
 */
export function pretestSvg(spec: MapPretestSpec, tileHref: string): string {
  const { size, tileX0, tileY0, tilePx } = spec.crop, f = PRETEST_FRAME_PX;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-f} ${-f} ${size + 2 * f} ${size + 2 * f}" width="100%" height="100%" role="img">` +
    `<rect x="${-f}" y="${-f}" width="${size + 2 * f}" height="${size + 2 * f}" fill="#f4f1ea"/>` +
    `<defs><clipPath id="pretest-extract"><rect x="0" y="0" width="${size}" height="${size}"/></clipPath></defs>` +
    `<image href="${esc(tileHref)}" x="${-tileX0}" y="${-tileY0}" width="${tilePx}" height="${tilePx}" clip-path="url(#pretest-extract)" preserveAspectRatio="none"/>` +
    `${pretestOverlayMarkup(spec)}</svg>`;
}

/** The overlay's SVG elements (no `<svg>` wrapper), in the extract's pixels; the grid labels sit in the frame (negative coordinates). */
export function pretestOverlayMarkup(spec: MapPretestSpec): string {
  const { size, squarePx, metresPerPixel } = spec.crop;
  const out: string[] = [];
  // The grid: interior lines, the outline, then the column letters above and the row numbers left of each square, in the frame.
  for (let k = 1; k < size / squarePx; k++) {
    const v = k * squarePx;
    out.push(`<line x1="${v}" y1="0" x2="${v}" y2="${size}" stroke="${INK}" stroke-opacity="0.6" stroke-width="1.3"/>`, `<line x1="0" y1="${v}" x2="${size}" y2="${v}" stroke="${INK}" stroke-opacity="0.6" stroke-width="1.3"/>`);
  }
  out.push(`<rect x="0" y="0" width="${size}" height="${size}" fill="none" stroke="${INK}" stroke-width="1.5"/>`);
  ["A", "B", "C", "D"].forEach((c, i) => out.push(`<text x="${(i + 0.5) * squarePx}" y="-7" text-anchor="middle" font-size="16" font-weight="700" fill="${INK}">${c}</text>`));
  [1, 2, 3, 4].forEach((r, i) => out.push(`<text x="-12" y="${(i + 0.5) * squarePx + 6}" text-anchor="middle" font-size="16" font-weight="700" fill="${INK}">${r}</text>`));
  // The marks: a red dot with its label in a white ring; the area mark a dashed ring around its X.
  for (const m of spec.marks) {
    if (m.kind === "area") {
      out.push(`<circle cx="${m.x}" cy="${m.y}" r="22" fill="none" stroke="#b3261e" stroke-width="2.2" stroke-dasharray="5 3"/>`,
        `<text x="${m.x}" y="${m.y + 6}" text-anchor="middle" font-size="17" font-weight="800" fill="#b3261e" style="${HALO}">${esc(m.label)}</text>`);
    } else {
      out.push(`<circle cx="${m.x}" cy="${m.y}" r="3.2" fill="#b3261e" stroke="#ffffff" stroke-width="1.2"/>`,
        `<circle cx="${m.x + 13}" cy="${m.y - 13}" r="10" fill="#ffffff" stroke="#b3261e" stroke-width="1.8"/>`,
        `<text x="${m.x + 13}" y="${m.y - 8.5}" text-anchor="middle" font-size="13" font-weight="800" fill="#b3261e">${esc(m.label)}</text>`);
    }
  }
  // The scale bar (0 – scaleBarMetres) at the bottom left, and a north arrow at the top right.
  const bar = spec.scaleBarMetres / metresPerPixel, y = size - 18;
  out.push(`<rect x="14" y="${y - 22}" width="${bar + 44}" height="34" fill="#ffffff" fill-opacity="0.85" rx="3"/>`,
    `<rect x="22" y="${y}" width="${bar / 2}" height="6" fill="${INK}"/>`, `<rect x="${22 + bar / 2}" y="${y}" width="${bar / 2}" height="6" fill="#ffffff" stroke="${INK}" stroke-width="1"/>`,
    `<text x="22" y="${y - 5}" text-anchor="middle" font-size="11" fill="${INK}">0</text>`,
    `<text x="${22 + bar}" y="${y - 5}" text-anchor="middle" font-size="11" fill="${INK}">${spec.scaleBarMetres} m</text>`);
  out.push(`<g transform="translate(${size - 26},44)"><path d="M0 -18 L7 6 L0 1 L-7 6 Z" fill="${INK}" stroke="#ffffff" stroke-width="1.2"/><text x="0" y="20" text-anchor="middle" font-size="12" font-weight="700" fill="${INK}" style="${HALO}">N</text></g>`);
  return out.join("\n");
}
