/**
 * The wildfire-skills scenario package, built in memory (path → file text) so the CLI writes it and the tests read it
 * without touching the disk. Pure for a given `version`: the same build gives the same bytes.
 *
 *   ground_truth/facts.json            every information atom (+ the duty messages), cycle_true_from, route
 *   ground_truth/cycles.json           fire, weather, events, segments, barriers, units, placements per cycle
 *   channels/radio.json                the pushed stream (both groups)
 *   channels/ai_packages.json          what Haku (both groups) and the Thinker (guide group) can retrieve, per cycle
 *   measures/items.json                every freeze, SPAM and hinge-check item with its key
 *   spatial/perimeters_scripted.geojson  CA truth (step end) and reported (step start) perimeters, EPSG:3067
 *   spatial/barriers.geojson           roads, waters, bridges, EPSG:3067
 *   DATA_SOURCES.md                    version, files, what is synthetic, mappings, nulls
 */

import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import type { ScenarioContract } from "../../app/scenario/types.js";
import { SCENARIO_18_FORCING } from "../fire-ca/scenario-18.js";
import { buildChannels } from "./facts.js";
import { buildItems } from "./items.js";
import { buildCycles } from "./cycles.js";
import { barrierLayer, barriersGeoJson, perimetersGeoJson } from "./spatial.js";
import { dataSourcesMd } from "./data-sources.js";

export const PACKAGE_FILES = [
  "ground_truth/facts.json", "ground_truth/cycles.json", "channels/radio.json", "channels/ai_packages.json",
  "measures/items.json", "spatial/perimeters_scripted.geojson", "spatial/barriers.geojson", "DATA_SOURCES.md",
] as const;

const pretty = (o: unknown): string => `${JSON.stringify(o, null, 2)}\n`;
const compact = (o: unknown): string => `${JSON.stringify(o)}\n`;

export interface ScenarioPackage {
  readonly scenario: ScenarioContract;
  readonly files: ReadonlyMap<string, string>;
}

/** Cycles where a field of `cycles.json` is null, for DATA_SOURCES.md. */
function nullsByField(cycles: readonly Record<string, unknown>[], fields: readonly string[]): Map<string, number[]> {
  return new Map(fields.map((f) => [f, cycles.filter((c) => c[f] === null).map((c) => c.cycle as number)]));
}

export function buildScenarioPackage(version: string, scenario: ScenarioContract = buildDemoScenario()): ScenarioPackage {
  const scenarioInfo = { id: scenario.id, version: scenario.version, seed: String(scenario.seed), site_seed: SITE_SCENARIO.seed };
  const { facts, radio, packages } = buildChannels(scenario);
  const items = buildItems(scenario);
  const cycles = buildCycles(SCENARIO_18_FORCING) as Record<string, unknown>[];
  const files = new Map<string, string>();
  files.set("ground_truth/facts.json", pretty({
    version, scenario: scenarioInfo, cycle_minutes: 20,
    id_convention: "our atom ids (not the skills' F###); duty.v<view> = the duty officer's messages",
    facts,
  }));
  files.set("ground_truth/cycles.json", pretty({ version, scenario: scenarioInfo, cycle_minutes: 20, crs: "EPSG:3067", cycles }));
  files.set("channels/radio.json", pretty({ version, channel: "pushed", groups: "both", messages: radio }));
  files.set("channels/ai_packages.json", pretty({ version, channel: "retrievable", tools: { haku: "both", thinker: "guide" }, packages }));
  files.set("measures/items.json", pretty({ version, items }));
  files.set("spatial/perimeters_scripted.geojson", compact(perimetersGeoJson(version, SCENARIO_18_FORCING)));
  files.set("spatial/barriers.geojson", compact(barriersGeoJson(version)));

  const units = cycles.flatMap((c) => c.units as { id: string; type: string; type_fi: string }[]);
  const unknownUnits = [...new Set(units.filter((u) => u.type === "unknown").map((u) => `${u.id} (${u.type_fi})`))];
  const counts = new Map<string, string>([
    ["ground_truth/facts.json", `${facts.length} facts`],
    ["ground_truth/cycles.json", `${cycles.length} cycles`],
    ["channels/radio.json", `${radio.length} messages`],
    ["channels/ai_packages.json", `${packages.length} packages`],
    ["measures/items.json", `${items.length} items`],
    ["spatial/perimeters_scripted.geojson", `${SITE_SCENARIO.steps.length * 2} features`],
    ["spatial/barriers.geojson", `${barrierLayer().length} features (roads, waters, bridges)`],
  ]);
  files.set("DATA_SOURCES.md", dataSourcesMd({
    version, scenarioId: scenario.id, scenarioVersion: scenario.version, seed: String(scenario.seed), siteSeed: SITE_SCENARIO.seed,
    files, counts,
    nullCycles: nullsByField(cycles, ["fire_type", "fl_head_m", "fl_flank_m", "rh_pct", "event", "spotting_m", "reignition_source", "change_reason"]),
    unknownUnits, zeroRosCycles: cycles.filter((c) => c.ros_head_m_min === 0).map((c) => c.cycle as number),
  }));
  return { scenario, files };
}
