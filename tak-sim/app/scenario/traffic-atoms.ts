/**
 * The incident's traffic corpus (SPEC/18 revision (n), `site-scenario.json` `traffic`) as corpus
 * atoms. One flat InteractionEvent becomes one atom with the same id, so an atom and its log line
 * (JSON Lines export, `npm run corpus:export`) can always be joined.
 *
 * Tier decides the route: T1 is pushed to the log, T2 is browsed or searched, T3 is asked of the
 * unit, T4 is requested as unit-to-unit traffic (SPEC/02 §3).
 */

import { asVirtualTime, type CycleIndex } from "../engine/primitives.js";
import type { InfoAtom, InteractionEvent, Origin, Routes } from "./types.js";

const SENSOR_ACTORS = new Set(["drone", "water_drone", "helicopter", "weather_station"]);

function originOf(e: InteractionEvent): Origin {
  if (e.channel === "radio_lateral") return "lateral";
  if (e.actor_type === "spotter_aircraft") return "above";
  if (SENSOR_ACTORS.has(e.actor_type)) return "sensor";
  return "below";
}

function routesOf(e: InteractionEvent): Routes {
  switch (e.tier) {
    case "T1_pushed":
      return { directed: { kind: "pushed" }, assistive: { kind: "browse", surface: "situation_log" }, substitutive: { kind: "pushed" } };
    case "T2_system":
      return { directed: { kind: "browse", surface: "situation_log" }, assistive: { kind: "browse", surface: "situation_log" }, substitutive: { kind: "free_text", exampleQueries: [e.place ?? e.actor.toLowerCase()] } };
    case "T3_person":
      return { directed: { kind: "ask_unit", unitId: e.actor }, assistive: { kind: "ask_unit", unitId: e.actor }, substitutive: { kind: "free_text", exampleQueries: [e.actor] } };
    case "T4_lateral":
      return { directed: { kind: "request_traffic", selector: { byUnit: e.actor } }, assistive: { kind: "free_text", exampleQueries: [e.actor] }, substitutive: { kind: "free_text", exampleQueries: [e.actor] } };
  }
}

/** Search keys: who, where, what kind, and the content's own words (four letters or more). */
function keysOf(e: InteractionEvent): string[] {
  const words = e.content.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4);
  return [...new Set([e.actor.toLowerCase(), e.event_type, e.nav, ...(e.place ? [e.place.toLowerCase()] : []), ...(e.location ? [e.location.toLowerCase()] : []), ...words])];
}

export function trafficAtom(e: InteractionEvent): InfoAtom {
  const at = asVirtualTime(e.sim_time_s);
  const sensor = SENSOR_ACTORS.has(e.actor_type) || e.channel === "system_log";
  return {
    id: e.id,
    tier: e.tier,
    origin: originOf(e),
    cycle: e.cycle as CycleIndex,
    loadBearing: false,
    navCategory: e.nav,
    routes: routesOf(e),
    record: e.channel === "radio_lateral"
      ? { kind: "lateral_traffic", speakerUnitId: e.actor, addresseeUnitId: e.addressee ?? "", at, content: e.content, droppedFromChannelSummary: false }
      : { kind: "situation_log", entryId: `log.${e.id}`, authorUnitId: e.actor, text: e.content },
    provenance: {
      sourceId: e.actor, sourceClassId: sensor ? "sc.sensor" : "sc.experienced", sourceReliability: "known-good",
      observedAt: at, recordedAt: asVirtualTime(e.sim_time_s + 10), deliveredAt: e.tier === "T1_pushed" ? at : null,
      certainty: { kind: "confirmed" }, supports: [], contradicts: [],
    },
    degradation: [],
    retrievalKeys: keysOf(e),
    truth: { isGroundTruth: true, isDecoy: false, relevantInvariants: [] },
  };
}
