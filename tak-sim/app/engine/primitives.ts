/**
 * Core branded primitives shared across the engine.
 * Canonical source: SPEC/04_Data_Model.md §1.
 */

/** Virtual seconds from scenario start. The only time any logic reads. */
export type VirtualTime = number & { readonly __brand: "VirtualTime" };

/** Monotonic, gapless record index within a session. */
export type Seq = number & { readonly __brand: "Seq" };

export type EpsgCode = number & { readonly __brand: "EPSG" };
export const WGS84 = 4326 as EpsgCode;
export const ETRS_TM35FIN = 3067 as EpsgCode;
export const WEB_MERCATOR = 3857 as EpsgCode;

export type AltitudeDatum = "MSL" | "WGS84_ELLIPSOID" | "AGL";

export interface LatLon {
  readonly lat: number;
  readonly lon: number;
} // always WGS84

export type Ring = readonly LatLon[]; // closed, CCW
export type Polygon = readonly Ring[]; // [outer, ...holes]

export interface GeoExtent {
  readonly crs: EpsgCode; // WGS84 for authored content
  readonly south: number;
  readonly north: number;
  readonly west: number;
  readonly east: number;
}

export type CycleIndex =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

/** Prologue cycles (SPEC/04 amendment 2026-09-17 §1). */
export type WarmupIndex = "W1" | "W2" | "W3" | "W4" | "W5";

export type Phase = "A" | "B";

export type Certainty =
  | { readonly kind: "confirmed" }
  | { readonly kind: "probable"; readonly basis: string }
  | { readonly kind: "uncertain"; readonly basis: string }
  | { readonly kind: "unknown" }; // MUST be representable and renderable

export type Tier = "T1_pushed" | "T2_system" | "T3_person" | "T4_lateral";
export type Origin = "below" | "lateral" | "above" | "sensor";
export type SourceReliability = "known-good" | "unproven" | "degraded";

/** Brands a raw number as VirtualTime. Internal helper; never used with a wall-clock value. */
export function asVirtualTime(seconds: number): VirtualTime {
  return seconds as VirtualTime;
}

export function asSeq(n: number): Seq {
  return n as Seq;
}
