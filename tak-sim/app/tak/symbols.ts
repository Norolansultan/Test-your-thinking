/**
 * SPEC/28 §4: which CoT type and MIL-STD-2525C symbol each object of the scenario carries.
 * DRAFT pending the domain reviewers (SPEC/11 §7.22) — it changes symbols only, never content.
 *
 * Shared by the CoT compiler (`compile.ts`) and the TAK shell's map symbols, so the map and the
 * exported CoT can never disagree about what an object is.
 */

export type TakKind =
  | "ground_vehicle" // rescue units, tankers, forest-fire units, the water shuttle
  | "ugv" // the hose-laying robot
  | "uav_rotary" // thermal multicopters, the water drone
  | "uav_fixed" // the VTOL mapping drone
  | "helicopter"
  | "fixed_wing" // the spotter aircraft
  | "command_post"; // the participant (TAK "self")

/** Explicit kinds for the platforms whose id does not tell; everything else is a ground vehicle. */
const KIND_BY_ID: Readonly<Record<string, TakKind>> = {
  UGV1: "ugv",
  DR1: "uav_rotary",
  DR2: "uav_rotary",
  VD1: "uav_rotary",
  DR3: "uav_fixed",
  HELI1: "helicopter",
  SPOT: "fixed_wing",
};

export function takKindOf(platformId: string): TakKind {
  return KIND_BY_ID[platformId] ?? "ground_vehicle";
}

export const COT_TYPE_BY_KIND: Readonly<Record<TakKind, string>> = {
  ground_vehicle: "a-f-G-E-V",
  ugv: "a-f-G-E-X",
  uav_rotary: "a-f-A-M-H-Q",
  uav_fixed: "a-f-A-M-F-Q",
  helicopter: "a-f-A-C-H",
  fixed_wing: "a-f-A-C-F",
  command_post: "a-f-G-U-C",
};

export function cotTypeOf(platformId: string): string {
  return COT_TYPE_BY_KIND[takKindOf(platformId)];
}

/** CoT shape and message types (SPEC/28 §4). */
export const COT_TYPE_DRAWING = "u-d-f";
export const COT_TYPE_SPOT = "b-m-p-s-m";
export const COT_TYPE_CHAT = "b-t-f";

const AFFILIATION: Readonly<Record<string, string>> = { f: "F", h: "H", n: "N", u: "U", p: "P", a: "A", s: "S" };

/**
 * A CoT atom type (`a-f-G-E-V`) to a 15-character 2525C letter SIDC (`SFGPEV---------`), the
 * conventional TAK mapping: S(coding) + affiliation + battle dimension + P(resent) + function id.
 * Returns null for non-atom types (drawings, chat, markers).
 */
export function sidcOfCotType(cotType: string): string | null {
  const parts = cotType.split("-");
  if (parts[0] !== "a" || parts.length < 3) return null;
  const affiliation = AFFILIATION[parts[1] ?? ""] ?? "U";
  const dimension = parts[2] ?? "Z";
  const fn = parts.slice(3).join("");
  return `S${affiliation}${dimension}P${fn}`.padEnd(15, "-").slice(0, 15);
}

export function sidcOf(platformId: string): string {
  // Every platform type is an atom, so this never falls back in practice.
  return sidcOfCotType(cotTypeOf(platformId)) ?? "SFGP-----------";
}

/** The participant's own marker: the incident commander at the command post. */
export const SELF_UID = "TAKSIM-SELF";
export const SELF_COT_TYPE = COT_TYPE_BY_KIND.command_post;
export const SELF_SIDC = sidcOfCotType(SELF_COT_TYPE) ?? "SFGPUC---------";
