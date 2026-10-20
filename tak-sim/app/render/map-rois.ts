/**
 * Map regions of interest (SPEC/09 revision (al), map-use covariates): fixed boxes on the ground, per view, for which
 * the analysis computes from the `viewport_changed` log how long the region was on the participant's screen, when it
 * first came into view and at what zoom (`app/telemetry/map-use-measures.ts`). Analysis only: nothing on the map
 * reads these, so they cannot cue anyone. Data, identical for every participant; `test/telemetry/map-use.spec.ts`
 * checks each box against the scenario (US2's position at V13, the head's segments at V4–V6, the origin's south
 * edge and US1 at V9–V10).
 */

export interface RoiBox { readonly south: number; readonly north: number; readonly west: number; readonly east: number }

export interface MapRoi {
  readonly id: string;
  /** The box per view index; the region is measured only in these views. */
  readonly boxes: Readonly<Record<number, RoiBox>>;
  readonly note: string;
}

/** V13's planted holdover US2 on the old fire's north edge, ±150 m (`18` ah.2; the planted contradiction). */
// SPEC/33 stage 9 (20 Oct 2026): re-centred on US2 of the fire re-run on the rebuilt map (was 60.856772–60.859468, 27.356693–27.362227).
const US2: RoiBox = { south: 60.856903, north: 60.859617, west: 27.356404, east: 27.361938 };
/** The origin's south edge (~25 m south of the ignition), where the rekindle starts (V9: not yet on the map; V10: US1), ±150–400 m. */
const ORIGIN_SOUTH: RoiBox = { south: 60.8455, north: 60.8495, west: 27.3455, east: 27.3545 };

export const MAP_ROIS: readonly MapRoi[] = [
  { id: "us2", boxes: { 13: US2 }, note: "V13's spot fire US2 (the north-edge holdover), ±150 m" },
  { id: "origin_south_edge", boxes: { 9: ORIGIN_SOUTH, 10: ORIGIN_SOUTH }, note: "the origin's south edge (rekindle; US1 at V10)" },
  {
    id: "head",
    boxes: {
      // The head segments' bounding box (`perimeter_current` with `is_head`) at each view, +100 m. SPEC/33 stage 9 (20 Oct 2026): recomputed
      // from the fire re-run on the rebuilt map (the V5 and V6 heads moved north-east).
      4: { south: 60.854899, north: 60.857747, west: 27.360643, east: 27.368153 },
      5: { south: 60.860022, north: 60.865348, west: 27.372641, east: 27.382383 },
      6: { south: 60.866329, north: 60.869407, west: 27.383611, east: 27.390401 },
    },
    note: "the running head, V4–V6 (the crown run and the backed wind)",
  },
];
