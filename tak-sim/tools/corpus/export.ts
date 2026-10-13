/**
 * `npm run corpus:export` — writes the whole scenario corpus as an interaction log in JSON Lines
 * (SPEC/18 revision (n)): one flat JSON object per line, `content` to vectorise, every other
 * field a scalar usable as a metadata filter. Also writes the JSON Schema of one line.
 *
 * Generated traffic is exported as built (`site-scenario.json` `traffic`); authored items (story
 * bubbles, move/crossing radio, load-bearing lateral items, register data, the F7 and rekindle
 * records of `designed-events.ts`) are mapped into the same shape. No truth annotation is exported. The log is identical on every run (no randomness here;
 * everything upstream is seeded and frozen).
 *
 * `cycle` is the world-state step; `session_view` the map view it belongs to (SPEC/26 §6): the
 * practice view is 0, the main views 1-14, prologue history W1-W4 null.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { COMMAND_POST_SOURCE, DESIGNED_LOG, GRID_OPERATOR_SOURCE } from "../../app/scenario/designed-events.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import type { InfoAtom, InteractionEvent } from "../../app/scenario/types.js";
import { viewOfStep } from "../../app/scenario/views.js";
import { AIR_KIND } from "../fire-ca/deployment.js";
import { actorTypeOf, clockAt, siteTrafficHelpers } from "../fire-ca/traffic.js";
import { wgs84ToTm35 } from "../fire-ca/tm35.js";
import { deployedPlace } from "../fire-ca/traffic-places.js";

const OUT_DIR = "content/corpus";
const scenario = buildDemoScenario();
const byId = new Map(SITE_SCENARIO.traffic.map((e) => [e.id, e]));
const { sectorOf, placeNear } = siteTrafficHelpers();
const ign = wgs84ToTm35(SITE_SCENARIO.ignition);
/** Sources that are not units or aircraft: register data, the grid operator, the command-post operator. */
const NON_UNIT_SOURCES = new Set(["register", GRID_OPERATOR_SOURCE, COMMAND_POST_SOURCE]);

function authored(a: InfoAtom): InteractionEvent {
  const actor = a.provenance.sourceId;
  const designed = DESIGNED_LOG[a.id]; // F7 and the rekindle (designed-events.ts)
  const stepIndex = designed?.positionStep ?? a.cycle;
  const step = SITE_SCENARIO.steps.find((x) => x.index === stepIndex);
  // A unit's place and sector follow its deployment (traffic-places.ts), not the nearest named feature.
  const deployed = deployedPlace(actor, stepIndex);
  const pos = step?.units[actor] ?? step?.aircraft.find((x) => x.platformId === actor)?.position ?? null;
  const site = pos ? (() => { const t = wgs84ToTm35(pos); return { x: t.eastM - ign.eastM, y: t.northM - ign.northM }; })() : null;
  const r = a.record;
  const lateral = r.kind === "lateral_traffic";
  // Radio to command stays radio to command when a view records it rather than pushing it (SPEC/26 §6):
  // a merged view's routine first-step radio, and the routine story beats of over-full views.
  const toCommand = a.tier === "T1_pushed" || /^atom\.(radio\.|demo\.\d)/.test(a.id);
  const content = "text" in r ? r.text : "content" in r && typeof r.content === "string" ? r.content : r.kind === "reference" ? `${r.surface}: ${JSON.stringify(r.fields)}` : `(${r.kind})`;
  return {
    id: a.id, cycle: a.cycle, session_view: viewOfStep(a.cycle)?.index ?? null, sim_time_s: a.provenance.observedAt, timestamp: clockAt(a.provenance.observedAt),
    actor, actor_type: NON_UNIT_SOURCES.has(actor) ? "command" : actorTypeOf(actor, AIR_KIND[actor] ?? null),
    addressee: designed ? designed.addressee : lateral ? r.addresseeUnitId : toCommand ? "JOHTO" : null,
    location: deployed?.sector ?? (site ? sectorOf(site) : null), place: deployed?.place ?? (site ? placeNear(site) : null), lat: pos?.lat ?? null, lon: pos?.lon ?? null,
    event_type: designed ? designed.event_type : r.kind === "reference" ? "status" : lateral ? "coordination" : a.origin === "sensor" ? "detection" : "report",
    task: null, content, tier: a.tier,
    channel: designed ? designed.channel : lateral ? "radio_lateral" : toCommand ? "radio_command" : a.tier === "T3_person" ? "ask_unit" : "system_log",
    nav: a.navCategory, lang: "fi",
  };
}

const lines = scenario.atoms
  .map((a) => byId.get(a.id) ?? authored(a))
  .sort((p, q) => p.sim_time_s - q.sim_time_s || (p.id < q.id ? -1 : 1));

const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Interaction log event (SPEC/18 revision (n))",
  type: "object",
  additionalProperties: false,
  required: ["id", "cycle", "session_view", "sim_time_s", "timestamp", "actor", "actor_type", "addressee", "location", "place", "lat", "lon", "event_type", "task", "content", "tier", "channel", "nav", "lang"],
  properties: {
    id: { type: "string", description: "Stable id; equals the corpus atom id" },
    cycle: { type: "integer", minimum: -4, maximum: 20, description: "World-state step: 1-20, W1-W5 as -4..0 (SPEC/26 §2)" },
    session_view: { type: ["integer", "null"], minimum: 0, maximum: 14, description: "Map view (SPEC/26 §3): 0 = practice view VP (step W5), 1-14 = V1-V14; null = prologue history W1-W4" },
    sim_time_s: { type: "integer", description: "Seconds from the start of step 1 (13:20)" },
    timestamp: { type: "string", pattern: "^\\d{2}:\\d{2}:\\d{2}$" },
    actor: { type: "string" },
    actor_type: { enum: ["fire_team", "volunteer_brigade", "forest_fire_unit", "robot", "drone", "water_drone", "helicopter", "spotter_aircraft", "weather_station", "command"] },
    addressee: { type: ["string", "null"], description: "JOHTO for reports up, a unit id for lateral traffic, null for feeds" },
    location: { type: ["string", "null"], description: "Sector, e.g. L2-Kärki" },
    place: { type: ["string", "null"], description: "A unit's place of deployment (its current sector edge or point); for others the nearest named place within 700 m" },
    lat: { type: ["number", "null"] },
    lon: { type: ["number", "null"] },
    event_type: { enum: ["size_up", "observation", "report", "warning", "coordination", "request", "status", "detection", "water_drop", "weather", "task_update"] },
    task: { type: ["string", "null"] },
    content: { type: "string", description: "Finnish; the text to embed" },
    tier: { enum: ["T1_pushed", "T2_system", "T3_person", "T4_lateral"] },
    channel: { enum: ["radio_command", "radio_lateral", "sensor_feed", "ask_unit", "system_log"] },
    nav: { type: "string" },
    lang: { const: "fi" },
  },
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "interaction-log.jsonl"), lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
writeFileSync(join(OUT_DIR, "interaction-log.schema.json"), JSON.stringify(schema, null, 2) + "\n");
console.log(`Wrote ${OUT_DIR}/interaction-log.jsonl (${lines.length} events) and interaction-log.schema.json`);
