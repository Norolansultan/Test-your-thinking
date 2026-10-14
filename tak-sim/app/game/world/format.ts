/**
 * Game mode (SPEC/29): the on-disk format of `content/game/world.json` and its base64 codec — shared by the loader
 * (`load.ts`) and the build (`tools/game/build-world.ts`), which must not depend on the file it writes.
 *
 * The file is compact: the 400 × 400 rasters are base64 (elevation as little-endian Int16 decimetres, fuel as one
 * byte per cell, row 0 north), road nodes a flat `[x0, y0, x1, y1, …]` list and edges flat `[a, b, classIndex, …]`
 * triples, points `[x, y]` pairs, all in local metres (`contracts.ts`). The codec needs no Node API (no `Buffer`).
 */

import type { AssetKind, GameGrid, RoadClass, WaterPoint } from "../contracts.js";

export const WORLD_FORMAT = "tak-sim/game-world@1";
export const ROAD_CLASSES: readonly RoadClass[] = ["main", "gravel", "forest", "track", "path"];

export type Pair = readonly [number, number];

/** The on-disk shape of `content/game/world.json`. */
export interface WorldJson {
  readonly format: typeof WORLD_FORMAT;
  /** Provenance note (the loader ignores it). */
  readonly generatedBy?: string;
  readonly grid: GameGrid;
  /** Base64 of Int16 little-endian, decimetres above sea level, `cols * rows` cells, row 0 north. */
  readonly elevationDm: string;
  /** Base64 of one byte per cell (`FuelCode`), row 0 north. */
  readonly fuel: string;
  readonly roads: {
    readonly classes: readonly RoadClass[];
    /** Flat `[x0, y0, x1, y1, …]`. */
    readonly nodes: readonly number[];
    /** Flat `[a, b, classIndex, …]`. */
    readonly edges: readonly number[];
  };
  readonly waterPoints: readonly {
    readonly id: string; readonly nameFi: string; readonly nameEn: string; readonly kind: WaterPoint["kind"];
    readonly at: Pair; readonly roadNode: number | null; readonly scoop: Pair;
  }[];
  readonly assets: readonly { readonly id: string; readonly kind: AssetKind; readonly at: Pair; readonly value: number; readonly settlementId: string | null }[];
  readonly settlements: readonly { readonly id: string; readonly nameFi: string; readonly nameEn: string; readonly centre: Pair; readonly assetIds: readonly string[] }[];
  /** Flat `[x0, y0, x1, y1, …]`. */
  readonly powerLine: readonly number[];
  readonly labels: readonly { readonly fi: string; readonly en: string; readonly at: Pair; readonly style: string }[];
  readonly commandPost: Pair;
  readonly entryNodes: readonly number[];
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_INDEX: Int16Array = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

/** Standard base64 (RFC 4648, `=` padding optional) → bytes. Throws on any other character. */
export function decodeBase64(text: string): Uint8Array {
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 61 /* = */) end--;
  const out = new Uint8Array(Math.floor((end * 3) / 4));
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < end; i++) {
    const code = text.charCodeAt(i);
    const v = code < 128 ? B64_INDEX[code]! : -1;
    if (v < 0) throw new Error(`world.json: invalid base64 character at ${i}`);
    acc = ((acc << 6) | v) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return o === out.length ? out : out.subarray(0, o);
}

/** Bytes → standard base64 with padding (the inverse of `decodeBase64`; used by the build and the tests). */
export function encodeBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    parts.push(B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!);
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i]! << 16;
    parts.push(B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + "==");
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    parts.push(B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + "=");
  }
  return parts.join("");
}
