/**
 * The incident on the generated site, as frozen at build time by `npm run fire:ca`
 * (`tools/fire-ca/site-export.ts`): CA fire geometry and flags (SPEC/24), wind (SPEC/18 §6), and
 * unit, drone and aircraft positions (SPEC/18 §8.2, `tools/fire-ca/deployment.ts`). All
 * coordinates are WGS84, converted through ETRS-TM35FIN at build time (SPEC/03 §1.1), so nothing
 * here projects anything in the participant's browser.
 *
 * This is scenario CONTENT, truth included (`truthAtEnd`, `derivedFlag`). Only
 * `demo-scenario.ts` reads it, and only through the contract does anything reach the render layer.
 */

import type { LatLon, Polygon } from "../engine/primitives.js";
import type { AirKind, FireDisplay, Flag, InteractionEvent, Isochrone, ProjectionBand, UnitWork } from "./types.js";
import bundle from "./site-scenario.json" with { type: "json" };

export interface SiteAircraft {
  readonly platformId: string;
  readonly kind: AirKind;
  readonly position: LatLon;
  /** Where it flies this step: transit from the launch point, then its orbit or loop. */
  readonly track: readonly LatLon[];
  /** Ground covered by its sensor; null for platforms without one (helicopter, spotter). */
  readonly footprint: Polygon | null;
}

/**
 * One world-state step (SPEC/26 §2): the practice step W5 (`index` 0) and steps 1–20. What the
 * map shows at the step's start — reported fire, units, aircraft, wind — and the truth at its end.
 * Projections and flags belong to views ({@link SiteView}), not steps.
 */
export interface SiteStep {
  readonly index: number; // step number: 0 = W5, 1–20
  readonly id: string; // "W5", "1".."20" — the CA and forcing id
  readonly clock: string;
  readonly areaHa: number;
  /** SPEC/18 §6: direction the wind blows FROM, mean and gust. */
  readonly wind: { readonly fromDeg: number; readonly meanMs: number; readonly gustMs: number };
  /** Authored truth and envelope-assumed rates (SPEC/18 §7) and the CA's achieved head rate. */
  readonly headRos: { readonly actualMpm: number; readonly envelopeMpm: number; readonly achievedMpm: number };
  /**
   * The head as observed at the start of the step: position, direction of travel, rate over the last 20 min, and
   * who measured it (fix pass 2, 7 Oct 2026, FC9: a drone over the head, the mapping loop, the spotter aircraft or
   * the crew at the head; `tools/fire-ca/site-export.ts`).
   */
  readonly observedHead: {
    readonly anchor: LatLon; readonly bearingDeg: number; readonly rateMpm: number; readonly observerId: string;
    /** A visual estimate's band (m/min) when the observer judged the rate by eye, not by two images (the helicopter; fix pass 4): "noin 5–10 m/min, arvio". */
    readonly rateBand?: readonly [number, number];
  };
  readonly reported: Polygon;
  readonly reportedDetached: readonly Polygon[];
  /** TRUTH at the end of this step. */
  readonly truthAtEnd: Polygon;
  readonly truthDetached: readonly Polygon[];
  /** Where each ground unit works: its crew, on the fire edge or with the vehicle. */
  readonly units: Readonly<Record<string, LatLon>>;
  /** Task, parked vehicle and hose line per unit (SPEC/18 revision (m)); same keys as `units`. */
  readonly unitWork: Readonly<Record<string, UnitWork>>;
  readonly aircraft: readonly SiteAircraft[];
  /** What the fire layers draw (SPEC/12 revision 24 Sep (c)); observed only. */
  readonly fire: FireDisplay;
}

/**
 * One map view (SPEC/26 §3): VP (`index` 0, practice, not scored) and V1–V14. Its map state is the
 * first step's; its envelope projects to the end of its last step (20 or 40 minutes) and its flag
 * is derived from that envelope against the truth then (SPEC/24 revision (p)).
 */
export interface SiteView {
  readonly index: number; // 0 = VP, 1–14
  readonly id: string; // "VP", "V1".."V14"
  readonly steps: readonly number[]; // step numbers, one or two
  readonly practice: boolean;
  readonly clock: string; // start of the first step
  readonly horizonClock: string; // end of the last step
  readonly horizonMinutes: number; // 20 or 40
  /** The mean of the steps' authored envelope-assumed rates (what the projection assumes over the horizon). */
  readonly envelopeRosMpm: number;
  /** SPEC/26 §3; null for the practice view (not scored, not checked). */
  readonly expectedFlag: Flag | null;
  readonly derivedFlag: Flag;
  readonly flagReason: string;
  readonly envelope: Polygon;
  readonly envelopeDetached: readonly Polygon[];
  /** TRUTH at the end of the view's last step. */
  readonly truthAtEnd: Polygon;
  readonly truthDetached: readonly Polygon[];
  /** The projection at ½, 1 (= `envelope`) and 1½ of the horizon: T+10/20/30, or T+20/40/60 when merged. */
  readonly isochrones: readonly Isochrone[];
  /** Arrival-time bands between the reported fire and each isochrone. */
  readonly projectionBands: readonly ProjectionBand[];
}

/**
 * A radio/log message the incident itself produces (SPEC/18 revision (l)): a unit moving (and
 * why), the fire crossing a road or brook (how, and whether anyone could act), or a crew holding a
 * line. `cycle` is the step it happens in; `atOffsetS` is seconds into its VIEW (a merged view's
 * second step starts at 1200). `pushed` is false for a routine item of a merged view's first step,
 * recorded rather than pushed (SPEC/26 §6).
 */
export interface SiteRadio {
  readonly cycle: number;
  readonly view: number;
  readonly atOffsetS: number;
  readonly pushed: boolean;
  readonly from: string;
  readonly kind: "move" | "crossing" | "stopped" | "hold";
  readonly text: string;
  readonly at?: LatLon;
}

export interface SiteScenarioBundle {
  readonly generatedBy: string;
  readonly site: string;
  readonly seed: string;
  /** Main views whose derived flag matches SPEC/26 §3 (of `MAIN_VIEW_COUNT`). */
  readonly flagMatches: number;
  readonly viewCount: number; // main views, 14
  readonly ignition: LatLon;
  readonly extent: { readonly south: number; readonly west: number; readonly north: number; readonly east: number };
  readonly features: Readonly<Record<string, LatLon>>;
  readonly sectors: readonly { readonly id: string; readonly label: string; readonly geometry: Polygon }[];
  /** The region's other two fires (revision (al)): static, for the live map's Area level; P2's directive names three fires. */
  readonly regionFires?: readonly { readonly id: string; readonly nameFi: string; readonly nameEn: string; readonly haFi: string; readonly haEn: string; readonly at: LatLon }[];
  readonly units: readonly { readonly id: string; readonly type: string; readonly availableFromCycle: number }[];
  /** W5 and steps 1–20, in order. */
  readonly steps: readonly SiteStep[];
  /** VP and V1–V14, in order. */
  readonly views: readonly SiteView[];
  readonly radio: readonly SiteRadio[];
  /** The incident's traffic corpus (SPEC/18 revision (n)): flat InteractionEvents, also exported as JSON Lines. */
  readonly traffic: readonly InteractionEvent[];
  /**
   * Revision (bm), 25 Oct 2026: the generated records that the "report filed" pointers displaced from the stream (recorded, T2): the
   * push cap's next routine records in a view the pointers took over the cap, never one a freeze or SPAM item rests on
   * (`tools/fire-ca/view-traffic.ts` `displaceForPointers`).
   */
  readonly pointerDisplaced?: readonly string[];
  /** English of every generated record and radio atom, by record id (`tools/fire-ca/traffic-english.ts`). */
  readonly english?: Readonly<Record<string, string>>;
}

export const SITE_SCENARIO = bundle as unknown as SiteScenarioBundle;
