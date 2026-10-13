/**
 * The Video pane's synthetic thermal frame (SPEC/28 §5): what a drone's camera footprint covers, drawn white-hot on dark
 * from the map's own renderable data — the footprint polygon, the reported fire inside it (burnt area, burning zone,
 * the reported edge by status, spot fires, recent detections). No real video, no network, no clock and no randomness:
 * the ground's texture is a hash of the ground position, so the same scene gives the same pixels, byte for byte (I1).
 *
 * It shows nothing the map does not: every hot pixel is a reported shape that the fire layers draw too. The frame is
 * north-up, the footprint fitted inside it (letterboxed), so a tile reads like the map under it.
 */

import type { LatLon, Polygon } from "../../../engine/primitives.js";

export interface ThermalScene {
  /** The camera's footprint on the ground (its outer ring is used). */
  readonly footprint: Polygon;
  readonly burnt: readonly Polygon[];
  readonly burning: readonly Polygon[];
  readonly edges: readonly { readonly status: "uncontained" | "contained" | "inactive"; readonly line: readonly LatLon[] }[];
  readonly spots: readonly LatLon[];
  readonly detections: readonly LatLon[];
}

export interface ThermalFrame {
  readonly width: number;
  readonly height: number;
  /** RGBA, row-major, `width × height × 4` bytes. */
  readonly data: Uint8ClampedArray<ArrayBuffer>;
}

/** The video tile's frame size, px (4:3). */
export const THERMAL_FRAME_SIZE = { width: 192, height: 144 } as const;

const M_PER_DEG_LAT = 111_320;

interface Local { readonly x: number; readonly y: number }
interface Seg { readonly ax: number; readonly ay: number; readonly bx: number; readonly by: number; readonly peak: number; readonly sigma: number }
interface Poly { readonly rings: readonly (readonly Local[])[]; readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number }

/** Heat of an edge by status: the spreading edge white-hot, a contained edge warm, a quiet edge faint. */
const EDGE_HEAT = { uncontained: { peak: 1, sigma: 9 }, contained: { peak: 0.62, sigma: 7 }, inactive: { peak: 0.42, sigma: 6 } } as const;

/** A 32-bit integer hash of two integers (deterministic value noise, no randomness). */
function hash2(i: number, j: number): number {
  let h = (Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
/** Smooth value noise in [0, 1) at a ground point (metres), cell `cell` m: the ground's own texture, tied to the ground. */
function groundNoise(x: number, y: number, cell: number): number {
  const gx = x / cell, gy = y / cell;
  const i = Math.floor(gx), j = Math.floor(gy);
  const fx = gx - i, fy = gy - j;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const v = (a: number, b: number) => hash2(a, b) / 4294967296;
  const top = v(i, j) + (v(i + 1, j) - v(i, j)) * sx;
  const bottom = v(i, j + 1) + (v(i + 1, j + 1) - v(i, j + 1)) * sx;
  return top + (bottom - top) * sy;
}

function inRing(ring: readonly Local[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
/** Even-odd over all rings: an outer ring with its holes. */
function inPoly(p: Poly, x: number, y: number): boolean {
  if (x < p.minX || x > p.maxX || y < p.minY || y > p.maxY) return false;
  let inside = false;
  for (const r of p.rings) if (inRing(r, x, y)) inside = !inside;
  return inside;
}

function segDist2(s: Seg, x: number, y: number): number {
  const dx = s.bx - s.ax, dy = s.by - s.ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / len2));
  const px = s.ax + t * dx - x, py = s.ay + t * dy - y;
  return px * px + py * py;
}

/**
 * Renders a scene into a `width × height` RGBA frame. White-hot: heat 0 is near-black, 1 is white; outside the footprint
 * the frame is dark (the sensor's edge), with a thin reticle in the middle, as a camera feed shows it.
 */
export function renderThermalFrame(scene: ThermalScene, width: number = THERMAL_FRAME_SIZE.width, height: number = THERMAL_FRAME_SIZE.height): ThermalFrame {
  const data = new Uint8ClampedArray(width * height * 4);
  const ring = scene.footprint[0] ?? [];
  if (ring.length < 3) {
    for (let k = 0; k < width * height; k++) { data[k * 4] = 8; data[k * 4 + 1] = 9; data[k * 4 + 2] = 11; data[k * 4 + 3] = 255; }
    return { width, height, data };
  }
  // Local metres about the footprint's centre (equirectangular: the footprint is a few hundred metres across).
  let sLat = 0, sLon = 0;
  for (const p of ring) { sLat += p.lat; sLon += p.lon; }
  const c = { lat: sLat / ring.length, lon: sLon / ring.length };
  const kx = M_PER_DEG_LAT * Math.cos((c.lat * Math.PI) / 180);
  const toLocal = (p: LatLon): Local => ({ x: (p.lon - c.lon) * kx, y: (p.lat - c.lat) * M_PER_DEG_LAT });
  const poly = (pg: Polygon): Poly => {
    const rings = pg.map((r) => r.map(toLocal));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of rings) for (const q of r) { minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y); }
    return { rings, minX, minY, maxX, maxY };
  };
  const foot = poly([ring]);
  // Fit the footprint's box into the frame with a 6 % margin, north up.
  const spanX = Math.max(1, foot.maxX - foot.minX), spanY = Math.max(1, foot.maxY - foot.minY);
  const mPerPx = Math.max(spanX / (width * 0.88), spanY / (height * 0.88));
  const cx = (foot.minX + foot.maxX) / 2, cy = (foot.minY + foot.maxY) / 2;
  const margin = 60; // metres around the footprint whose shapes can still reach it
  const near = (p: Poly) => p.maxX >= foot.minX - margin && p.minX <= foot.maxX + margin && p.maxY >= foot.minY - margin && p.minY <= foot.maxY + margin;
  const burnt = scene.burnt.map(poly).filter(near);
  const burning = scene.burning.map(poly).filter(near);
  const segs: Seg[] = [];
  for (const e of scene.edges) {
    const h = EDGE_HEAT[e.status];
    for (let i = 1; i < e.line.length; i++) {
      const a = toLocal(e.line[i - 1]!), b = toLocal(e.line[i]!);
      if (Math.max(a.x, b.x) < foot.minX - margin || Math.min(a.x, b.x) > foot.maxX + margin || Math.max(a.y, b.y) < foot.minY - margin || Math.min(a.y, b.y) > foot.maxY + margin) continue;
      segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, peak: h.peak, sigma: h.sigma });
    }
  }
  const spots = scene.spots.map(toLocal);
  const dets = scene.detections.map(toLocal);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const x = cx + (px + 0.5 - width / 2) * mPerPx;
      const y = cy - (py + 0.5 - height / 2) * mPerPx; // north up
      let heat: number;
      if (!inPoly(foot, x, y)) {
        heat = 0.03 + 0.03 * groundNoise(x, y, 60);
      } else {
        // The ground: cool, textured by the terrain's own cells (25 m and 6 m), the same for every view.
        heat = 0.12 + 0.07 * groundNoise(x, y, 25) + 0.03 * groundNoise(x, y, 6);
        for (const b of burnt) if (inPoly(b, x, y)) { heat = Math.max(heat, 0.3 + 0.08 * groundNoise(x, y, 12)); break; }
        for (const b of burning) if (inPoly(b, x, y)) { heat = Math.max(heat, 0.66 + 0.16 * groundNoise(x, y, 9)); break; }
        for (const s of segs) {
          const d2 = segDist2(s, x, y);
          if (d2 > 9 * s.sigma * s.sigma) continue;
          heat = Math.max(heat, s.peak * Math.exp(-d2 / (2 * s.sigma * s.sigma)));
        }
        for (const s of spots) { const d2 = (s.x - x) ** 2 + (s.y - y) ** 2; if (d2 < 900) heat = Math.max(heat, Math.exp(-d2 / 200)); }
        for (const s of dets) { const d2 = (s.x - x) ** 2 + (s.y - y) ** 2; if (d2 < 400) heat = Math.max(heat, 0.85 * Math.exp(-d2 / 120)); }
      }
      // White-hot palette with a faint cool tint in the shadows (a thermal feed's grey ramp).
      const v = Math.min(1, Math.max(0, heat)) ** 0.9;
      const k = (py * width + px) * 4;
      data[k] = Math.round(255 * v);
      data[k + 1] = Math.round(255 * v);
      data[k + 2] = Math.round(255 * Math.min(1, v + 0.04 * (1 - v)));
      data[k + 3] = 255;
    }
  }
  // The reticle: a small open cross in the frame's middle.
  const midX = Math.floor(width / 2), midY = Math.floor(height / 2);
  for (let d = 4; d <= 10; d++) {
    for (const [x, y] of [[midX + d, midY], [midX - d, midY], [midX, midY + d], [midX, midY - d]] as const) {
      const k = (y * width + x) * 4;
      data[k] = 120; data[k + 1] = 235; data[k + 2] = 220;
    }
  }
  return { width, height, data };
}

/** FNV-1a 32-bit hash of a frame's bytes, as 8 hex digits (for tests and for logging a frame's identity). */
export function frameHash(frame: Pick<ThermalFrame, "data">): string {
  let h = 0x811c9dc5;
  const d = frame.data;
  for (let i = 0; i < d.length; i++) {
    h ^= d[i]!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * The scene of a drone's footprint from the map's renderable fire (`RenderableCycle.fire`). `detectionShown` keeps only the
 * detections the map draws now (the map hides those too old to show, `fire-layers.ts` `detectionColor`), so the tile
 * shows nothing the map does not.
 */
export function thermalSceneOf<D extends { readonly position: LatLon }>(footprint: Polygon, fire: {
  readonly burnt_area: { readonly geometry: readonly Polygon[] };
  readonly burning_zone: readonly Polygon[];
  readonly perimeter_current: readonly { readonly status: "uncontained" | "contained" | "inactive"; readonly line: readonly LatLon[] }[];
  readonly spot_fires: readonly { readonly position: LatLon }[];
  readonly detections: readonly D[];
} | null, detectionShown: (d: D) => boolean = () => true): ThermalScene {
  return {
    footprint,
    burnt: fire?.burnt_area.geometry ?? [],
    burning: fire?.burning_zone ?? [],
    edges: fire?.perimeter_current ?? [],
    spots: (fire?.spot_fires ?? []).map((s) => s.position),
    detections: (fire?.detections ?? []).filter(detectionShown).map((d) => d.position),
  };
}

/** The footprint's size on the ground, metres east–west × north–south (the tile's caption). */
export function footprintSize(footprint: Polygon): { readonly widthM: number; readonly heightM: number } {
  const ring = footprint[0] ?? [];
  if (ring.length === 0) return { widthM: 0, heightM: 0 };
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of ring) { minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat); minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon); }
  const kx = M_PER_DEG_LAT * Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  return { widthM: Math.round((maxLon - minLon) * kx), heightM: Math.round((maxLat - minLat) * M_PER_DEG_LAT) };
}
