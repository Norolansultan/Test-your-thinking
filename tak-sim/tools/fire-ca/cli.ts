/**
 * `npm run fire:ca -- [--site generated|template] [--out <dir>] [--seed <u64>] [--ensemble <n>] [--cell <m>]`
 *
 * Runs the SPEC/18 incident through the CA (25 steps) and reports, per step, the achieved head
 * rate against the authored one and the derived flag against SPEC/18 §7's; then builds the
 * session's views from step spans (SPEC/26 §3, `views.ts`) and reports each view's flag against
 * SPEC/26's canonical sequence. Writes `fire-ca.json` (polygons and evidence) and `fire-ca.geojson` (open in
 * QGIS). Exit code 0 always: a flag mismatch is authoring information, not a build failure —
 * the scenario validator enforces the canonical sequence on the frozen output instead.
 *
 * `--site generated` (default) runs on the generated site's grids (`content/site`, SPEC/23 §11),
 * the terrain the app's basemap shows, and also writes the app's frozen scenario bundle
 * (`app/scenario/site-scenario.json`, SPEC/24 §9). `--site template` runs on the synthetic
 * template of SPEC/24 §7 (`--cell` applies to it only).
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadRealSite } from "./ascii-grid.js";
import { DEFAULT_RUN_OPTIONS, runScenario, toGeoJson } from "./run.js";
import { SCENARIO_18_FORCING } from "./scenario-18.js";
import { passesSpreadScreen, spreadCapacity, SPREAD_THRESHOLDS } from "./screen.js";
import { exportSiteScenario } from "./site-export.js";
import { buildTemplateSite, FUEL_CLASSES } from "./template-site.js";
import { buildViews, describeView } from "./views.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const siteKind = arg("site", "generated");
if (siteKind !== "generated" && siteKind !== "template") throw new Error(`--site must be "generated" or "template", got "${siteKind}"`);
const outDir = arg("out", siteKind === "generated" ? "content/site/build" : "content/demo/fire-ca");
const appBundlePath = "app/scenario/site-scenario.json";
const seed = BigInt(arg("seed", "20080101"));
const ensembleSize = Number(arg("ensemble", String(DEFAULT_RUN_OPTIONS.ensembleSize)));
const cellSizeM = Number(arg("cell", "25"));
const pH = Number(arg("ph", String(DEFAULT_RUN_OPTIONS.params.pH)));
const c2 = Number(arg("c2", String(DEFAULT_RUN_OPTIONS.params.c2)));
const toleranceM = Number(arg("tolerance", String(DEFAULT_RUN_OPTIONS.flagRule.toleranceM)));
const envelopeBurnShare = Number(arg("burn-share", String(DEFAULT_RUN_OPTIONS.envelopeBurnShare)));

const SITE_DIR = "content/site";
const siteJson = JSON.parse(readFileSync(join(SITE_DIR, "site.json"), "utf8")) as {
  name: string; ignitionTm35: { eastM: number; northM: number }; truthFuel: string; machineFuel: string; elevation: string;
  legend: { code: number; fuelId: string }[];
};
const site = siteKind === "generated"
  ? loadRealSite({
    name: siteJson.name,
    truthFuelPath: join(SITE_DIR, siteJson.truthFuel),
    machineFuelPath: join(SITE_DIR, siteJson.machineFuel),
    elevationPath: join(SITE_DIR, siteJson.elevation),
    legend: siteJson.legend,
    noFuelId: "water",
    classes: FUEL_CLASSES,
    ignitionTm35: siteJson.ignitionTm35,
    referenceFuelId: "pine_heath",
  })
  : buildTemplateSite(cellSizeM);
const runOptions = {
  ...DEFAULT_RUN_OPTIONS,
  seed,
  scenarioId: "fin-wildfire-2030",
  ensembleSize,
  envelopeBurnShare,
  params: { ...DEFAULT_RUN_OPTIONS.params, pH, c2 },
  flagRule: { ...DEFAULT_RUN_OPTIONS.flagRule, toleranceM },
};
const result = runScenario(site, SCENARIO_18_FORCING, runOptions);

const pad = (s: string | number, n: number) => String(s).padEnd(n);

const capacity = spreadCapacity(site);
console.log(`Spread capacity: connected burnable patch ${Math.round(capacity.connectedHa)} ha (need ≥ ${SPREAD_THRESHOLDS.minConnectedHa}); ` +
  capacity.bySector.map((s) => `${s.label} ${Math.round(s.share * 100)}%`).join(", ") +
  ` → ${passesSpreadScreen(capacity) ? "PASS" : "FAIL"}`);
console.log(`Site: ${result.site}   seed ${result.seed}   ensemble ${ensembleSize}   cell ${site.frame.cellSizeM} m   p_h ${pH}   c2 ${c2}   tolerance ${toleranceM} m\n`);
console.log(pad("cycle", 6) + pad("clock", 7) + pad("ROS tgt", 9) + pad("achieved", 10) + pad("env ROS", 9) + pad("area ha", 9) + pad("expected", 22) + pad("derived", 22) + "evidence");
for (const c of result.cycles) {
  console.log(
    pad(c.id, 6) + pad(c.clock, 7) + pad(c.targetHeadRosMpm, 9) + pad(c.achievedHeadRosMpm, 10) + pad(c.envelopeAssumedRosMpm, 9) +
    pad(c.areaHa, 9) + pad(c.expectedFlag, 22) + pad(c.derived.flag + (c.matches ? "" : "  ✗"), 22) + c.derived.reason,
  );
}
console.log(`\nStep flags matching SPEC/18 §7: ${result.flagMatches} / ${result.cycles.length}`);

// SPEC/26 §3: the session's views from step spans; the scored flags are these.
const views = buildViews(site, SCENARIO_18_FORCING, result, runOptions);
console.log("\nview steps  horizon env ROS  expected             derived");
for (const v of views) {
  const last = SCENARIO_18_FORCING.find((f) => f.id === v.stepIds[v.stepIds.length - 1])!;
  console.log(describeView(site, v, (last.windFromDeg + 180) % 360));
}
console.log(`\nView flags matching SPEC/26 §3: ${views.filter((v) => !v.view.practice && v.matches).length} / ${views.filter((v) => !v.view.practice).length}`);

mkdirSync(outDir, { recursive: true });
const serialisable = {
  ...result,
  cycles: result.cycles.map(({ masks: _masks, ...rest }) => rest),
};
writeFileSync(join(outDir, "fire-ca.json"), JSON.stringify(serialisable, null, 1));
writeFileSync(join(outDir, "fire-ca.geojson"), JSON.stringify(toGeoJson(result)));
console.log(`Wrote ${join(outDir, "fire-ca.json")} and fire-ca.geojson`);

if (siteKind === "generated") {
  // No stale bundle (8 Oct 2026: a failing export left the previous run's bytes in place, which then passed for a fresh
  // build): the old bundle goes first, so a throw below leaves none and the process exits non-zero.
  rmSync(appBundlePath, { force: true });
  const bundle = exportSiteScenario({ site, ignitionTm35: siteJson.ignitionTm35, forcing: SCENARIO_18_FORCING, result, views });
  writeFileSync(appBundlePath, JSON.stringify(bundle));
  console.log(`Wrote ${appBundlePath} (steps W2 (practice) and 1–20, views VP and V1–V14, units, aircraft, wind, traffic)`);
}
