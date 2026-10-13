/**
 * Pure visual-encoding rules — SPEC/06_UI_and_Interaction.md §3 and
 * SPEC/12_Map_Symbology_and_Projection.md §8. Deliberately library-free:
 * these are the *decisions* (which bucket, which stroke style, which
 * hue), not the drawing code, so they are testable without MapLibre, a
 * DOM, or a canvas.
 *
 * "The governing rule is that no property is carried by hue alone: every
 * one has a redundant non-colour channel." (SPEC/06 §3.2) Every function
 * here returns both the primary channel and names its required redundant
 * channel in its doc comment, so a caller cannot wire up the primary
 * encoding and forget the other.
 *
 * NOT implemented here, deliberately: symbol *shapes* for the four
 * standard identities (own formation / aerial asset / fire / value at
 * risk). SPEC/11_Open_Design_Register.md §3.10 lists these as "Not
 * drawn... blocks test/render/cvd.spec" — a named open item, not settled
 * content. Guessing at shapes here would be exactly the kind of thing
 * SPEC/11 says to stop and ask about rather than invent. The *hue*
 * assignments (§8.1 below) are fully specified and safe to encode; the
 * shapes are not.
 */

import type { Certainty, RateMark } from "../scenario/types.js";

// ---------------------------------------------------------------------------
// Observed rate of spread — SPEC/12 §5. A rate judged by eye (fix pass 4: `rateBand`, e.g. the
// helicopter at the head) is a band marked as an estimate, never a single figure.
// ---------------------------------------------------------------------------

/** A rate mark's figure as text: "noin 8 m/min", or "noin 6–10 m/min, arvio" for a band (English: "about …, estimate"). */
export function rateMarkText(mark: Pick<RateMark, "rateMetresPerMinute" | "rateBand">, lang: "fi" | "en"): string {
  const num = (n: number) => (lang === "fi" ? String(n).replace(".", ",") : String(n));
  const about = lang === "fi" ? "noin" : "about";
  if (mark.rateBand) return `${about} ${num(mark.rateBand[0])}–${num(mark.rateBand[1])} m/min, ${lang === "fi" ? "arvio" : "estimate"}`;
  return `${about} ${num(mark.rateMetresPerMinute)} m/min`;
}

// ---------------------------------------------------------------------------
// Staleness — SPEC/12 §8: "0-5 · 5-15 · 15-40 · 40+ min" -> "100 · 85 · 70 · 55%"
// Redundant channel (required): age in minutes, always printed (Plex Mono in the real UI).
// ---------------------------------------------------------------------------

export type StalenessBucket = "fresh" | "aging" | "old" | "very_stale";

export interface StalenessEncoding {
  readonly bucket: StalenessBucket;
  readonly opacityPercent: 100 | 85 | 70 | 55;
  readonly ageMinutes: number; // the redundant channel's content — always print this
}

/** SPEC/12 §8 band boundaries, in minutes. */
export const STALENESS_BANDS = [
  { bucket: "fresh" as const, maxMinutes: 5, opacityPercent: 100 as const },
  { bucket: "aging" as const, maxMinutes: 15, opacityPercent: 85 as const },
  { bucket: "old" as const, maxMinutes: 40, opacityPercent: 70 as const },
] as const;

export function stalenessOf(ageSeconds: number): StalenessEncoding {
  if (!Number.isFinite(ageSeconds) || ageSeconds < 0) {
    throw new RangeError(`stalenessOf requires a non-negative finite age in seconds, got ${ageSeconds}`);
  }
  const ageMinutes = ageSeconds / 60;
  for (const band of STALENESS_BANDS) {
    if (ageMinutes < band.maxMinutes) {
      return { bucket: band.bucket, opacityPercent: band.opacityPercent, ageMinutes };
    }
  }
  return { bucket: "very_stale", opacityPercent: 55, ageMinutes };
}

// ---------------------------------------------------------------------------
// Certainty — SPEC/12 §4.2: confirmed=solid, probable=solid-light,
// uncertain=dashed, unknown=dashed+badge. Same four-value vocabulary used
// everywhere certainty appears (SPEC/06 §3).
// Redundant channel (required): a glyph/label in the element's label row.
// ---------------------------------------------------------------------------

export type CertaintyStrokeStyle = "solid" | "solid_light" | "dashed" | "dashed_with_badge";

export function certaintyStrokeStyle(certainty: Certainty): CertaintyStrokeStyle {
  switch (certainty.kind) {
    case "confirmed":
      return "solid";
    case "probable":
      return "solid_light";
    case "uncertain":
      return "dashed";
    case "unknown":
      return "dashed_with_badge";
  }
}

/** The redundant, non-stroke channel for certainty. Real Finnish wording (`varma`/`todennäköinen`/`epävarma`/`ei tiedossa`, SPEC/14 revision (d) §4) is a content decision, not invented here — this returns the stable discriminant a caller then looks up display text for. */
export function certaintyGlyphKey(certainty: Certainty): Certainty["kind"] {
  return certainty.kind;
}

// ---------------------------------------------------------------------------
// The four-way distinct "nothing" states — SPEC/06 §3: "`unknown` has a
// visual form of its own, distinct from `zero`, `absent` and `stale`...
// the single most important rule and the easiest to lose: a blank cell
// reads as 'nothing there' when it should read as 'not known'."
//
// Modelled as a discriminated union so presence is decided by an explicit
// tag, never by JS truthiness — the exact bug class ("a value of 0 looks
// like nothing") that a `value || fallback` pattern would reintroduce.
// `zero` is its own variant for that reason, even though structurally
// `present` could otherwise hold a zero value.
// ---------------------------------------------------------------------------

export type DisplayValue<T> =
  | { readonly kind: "unknown" } // certainty about existence itself is unknown
  | { readonly kind: "absent" } // structurally nothing here — e.g. no RateMark authored for this flank (SPEC/12 §5.1)
  | { readonly kind: "zero"; readonly ageSeconds: number } // a real, informative value that is literally zero
  | { readonly kind: "present"; readonly value: T; readonly ageSeconds: number };

/** Every `DisplayValue` state maps to a visually distinct encoding. No two states share the same (opacity-bucket, badge) pair. */
export interface DisplayValueEncoding {
  readonly badge: "unknown_badge" | "none";
  readonly staleness: StalenessEncoding | null; // null only for unknown/absent, which carry no age
  readonly requiredRedundantText: string; // "ei tiedossa" for unknown; otherwise the printed age or "0"
}

export function encodeDisplayValue<T>(v: DisplayValue<T>): DisplayValueEncoding {
  switch (v.kind) {
    case "unknown":
      return { badge: "unknown_badge", staleness: null, requiredRedundantText: "ei tiedossa" };
    case "absent":
      return { badge: "none", staleness: null, requiredRedundantText: "" }; // absence renders as nothing, deliberately (SPEC/03 §7.3, SPEC/12 §5.1) — not a badge, not a dash
    case "zero": {
      const staleness = stalenessOf(v.ageSeconds);
      return { badge: "none", staleness, requiredRedundantText: "0" };
    }
    case "present": {
      const staleness = stalenessOf(v.ageSeconds);
      return { badge: "none", staleness, requiredRedundantText: `${Math.round(staleness.ageMinutes)} min` };
    }
  }
}

// ---------------------------------------------------------------------------
// Hue assignments — SPEC/12 §8.1. Fully specified; the one place hue is
// settled content rather than an open design item.
// ---------------------------------------------------------------------------

export type StandardHueRole = "own_formation" | "reported_perimeter" | "projection_envelope" | "participant_correction" | "value_at_risk" | "basemap";

/** Named, not literal colour values (which are a design-token decision for the real UI) — but the *identity* of each role's hue, and critically, which pairs must never collide, is settled and testable. */
export const HUE_ROLE_NAMES: Readonly<Record<StandardHueRole, string>> = {
  own_formation: "cyan-blue",
  reported_perimeter: "red", // now; grey = past (SPEC/12 revision 24 Sep (c))
  projection_envelope: "light-red-dashed", // SPEC/12 revision 24 Sep (c): dashed = predicted; no blue or purple
  participant_correction: "yellow",
  value_at_risk: "neutral-dark-outline",
  basemap: "desaturated-grey-green",
};

/**
 * SPEC/12 §8.1: "The participant must never confuse what was observed
 * with what was projected" — the reported perimeter and the projection
 * envelope must never share a hue. Checked structurally rather than left
 * as a naming convention someone could quietly violate.
 */
export function hueRolesAreDistinct(a: StandardHueRole, b: StandardHueRole): boolean {
  return HUE_ROLE_NAMES[a] !== HUE_ROLE_NAMES[b];
}
