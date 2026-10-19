/**
 * `DATA_SOURCES.md` of the wildfire-skills package: the version it was built from, every file with its size, record count
 * and SHA-256, what is synthetic, every mapping decision and every null, counted from the files themselves. Generated, so
 * it cannot drift from what was written.
 */

import { sha256Hex } from "../../app/telemetry/sha256.js";

export interface SourceSummary {
  readonly version: string;
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly seed: string;
  readonly siteSeed: string;
  /** Path → content of every other file of the package. */
  readonly files: ReadonlyMap<string, string>;
  readonly counts: ReadonlyMap<string, string>;
  /** Field → the cycles where it is null (cycles.json). */
  readonly nullCycles: ReadonlyMap<string, readonly number[]>;
  readonly unknownUnits: readonly string[];
  readonly zeroRosCycles: readonly number[];
}

const list = (xs: readonly (string | number)[]): string => (xs.length === 0 ? "none" : xs.join(", "));

export function dataSourcesMd(s: SourceSummary): string {
  const rows = [...s.files.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).map((p) => {
    const text = s.files.get(p)!;
    return `| \`${p}\` | ${s.counts.get(p) ?? ""} | ${Buffer.byteLength(text, "utf8")} | \`${sha256Hex(text).slice(0, 16)}\` |`;
  });
  const nulls = [...s.nullCycles.keys()].map((k) => `| \`${k}\` | ${list(s.nullCycles.get(k)!)} |`);
  return [
    "# DATA_SOURCES — tak-sim scenario as the wildfire skills' data contract",
    "",
    `- **Version:** \`${s.version}\` (git commit of tak-sim the export ran on; \`-dirty\` = uncommitted changes in the worktree).`,
    `- **Scenario:** \`${s.scenarioId}\` ${s.scenarioVersion}, scenario seed ${s.seed}; fire model on the generated site, seed ${s.siteSeed}.`,
    "- **Built by:** `npm run skills:export` (`tak-sim/tools/skills/`); deterministic: the same commit writes the same bytes.",
    "- **CRS:** ETRS-TM35FIN (EPSG:3067), metres, 0.1 m, for every coordinate (converted from the bundle's WGS84 by `tools/fire-ca/tm35.ts`).",
    "- **Clock:** step 1 starts 13:20; a step (the skills' cycle) is 20 minutes; `cycle` = main step 1–20, the practice view (step W2, 12:00) and the prologue = cycle 0.",
    "- **Licence / retrieval:** everything is generated in this repository (MIT, see LICENSE); nothing is retrieved from MML, Metsäkeskus, FMI or Syke.",
    "",
    "## Files",
    "",
    "| File | Records | Bytes | SHA-256 (first 16) |",
    "|---|---|---|---|",
    ...rows,
    "",
    "## What is synthetic",
    "",
    "- **Terrain:** fictional (SPEC/23 §11), `content/site/` (fuel, elevation) and the basemap vectors `content/site/build/topo-features.json`; no MML DEM, no FBP fuel grid, no Metsäkeskus risk maps. `spatial/barriers.geojson` is that basemap: roads by class, lakes, ponds, the river, brooks, bridges (ditches left out).",
    "- **Fire:** an Alexandridis-type cellular automaton (SPEC/24, `tools/fire-ca/`), forced by authored weather and head rates (SPEC/18 §6–§7, `tools/fire-ca/scenario-18.ts`) and scripted events (spots, rekindles, sector control). It models spread only: there is no flame length, intensity, fire type, FWI/ISI or smoke field anywhere in the scenario.",
    "- **Records:** generated (`tools/fire-ca/traffic*.ts`) and authored (story bubbles, designed events, duty messages): DRAFT Finnish, not domain-reviewed; English from `site-scenario.json` `english`, `content/i18n/*.en.json`.",
    "- **Units:** the scripted roster and positions (SPEC/18 §8, `tools/fire-ca/deployment.ts`).",
    "",
    "## Mapping decisions",
    "",
    "### Facts and channels (`ground_truth/facts.json`, `channels/*.json`)",
    "",
    "- **Ids:** our atom ids are kept (`evt.c07.011`, `atom.radio.8.3`, `atom.demo.12.0`, `f7.*`, `t4.*`, `ref.*`), not the skills' `F###`; the duty officer's two messages (V1's intent, the hinge directive) are added as `duty.v1`, `duty.v8` (pushed to both groups; not corpus atoms, so not retrievable).",
    "- **`cycle_true_from`** = the atom's step (the time gate's unit: `app/retrieval/time-gate.ts` makes an atom reachable once its step is reached); `time` = when it was observed; `route` = `pushed` when it is in a view's pushed list, else `recorded`. `is_ground_truth: false` marks the planted false record (F7).",
    "- **\"Radio vs AI\" parity → \"pushed vs retrievable\".** In this study both groups receive the same pushed stream (message log: story bubbles, incident radio, pushed traffic, duty messages) and both have Haku; the guide group (`reasoning_intent`) also has the Thinker. `channels/radio.json` is the PUSHED stream (one message per delivery, its cycle from the view start + delivery offset); `channels/ai_packages.json` is what the tools can RETRIEVE, one package per cycle and tool (`haku.cNN`, group `both`; `thinker.cNN`, group `guide`, the same records behind the same gate). A recorded fact is therefore retrievable only, never pushed: `parity_check.py` reports every recorded fact as `channel_missing` and every item keyed on one as `item_uses_unavailable_fact` — by design here (SPEC/27 §7.1: deciding quantities are recorded, not pushed), not an error.",
    "",
    "### Items (`measures/items.json`)",
    "",
    "- The bank: the practice freeze (4), the main freezes V2, V4, V5, V7 (8 each), V10, V12, V14 (6 each), the SPAM items V3, V6, V8, V11, their second items `.b` (V3, V6) and the practice SPAM item, and the hinge manipulation check.",
    "- `cycle` = the step the answer is due at: a freeze's view's last step (VP: 0); a SPAM item's view's first step (25 s in); the hinge check 11 (16:40, the directive's moment, after V7). `freeze_id` groups an occasion (`freeze.V2`, `spam.V3`, `hinge`).",
    "- `type`: `choice` (`correct` = the key option's id; SPAM and hinge: the key letter from the scenario's invariants) or `point` (`correct` = [E, N], `tolerance.m` = `mapKey.toleranceM`).",
    "- `fact_ids` = `keyAtomIds` / `SPAM_KEY_ATOMS` / `SPAM_SECOND_KEY_ATOMS` / the practice key record; empty where the key is computed from the fire model (the L3 items) and for the hinge check (its key is the directive, `duty.v8`, shown to everyone).",
    "- `family`: `situation` (freezes, SPAM: their `contentKind`), `intent` (the hinge check). `scope`: `own` for the freezes (display blanked) and the hinge check; `team` for every SPAM item — SPEC/30 §5.2 reads SPAM as team understanding because Haku and the Thinker stay usable during an item since revision (ag); the second items are the ones whose key needs a tool.",
    "",
    "### Fire per cycle (`ground_truth/cycles.json`)",
    "",
    "- `ros_head_m_min`: the CA's achieved head rate over the step (truth). Beside it: `ros_head_authored_m_min` (forcing), `ros_head_projected_m_min` (the projection's assumption), `observed_head` (at the step's start, measured over the previous 20 min).",
    "- `head_bearing_deg`: the observed head's direction at the step's start (`observedHead.bearingDeg`).",
    "- `fl_head_m`, `fl_flank_m`: QUOTED flame bands from the step's records, the band's upper bound as the single value (conservative for the intensity limits); the band, its phrase and its record id are kept. The head: the band of the step's head observer (`observedHead.observerId`), its measurement first; else the highest band on the head segment. The flanks: the highest band among positioned records on either flank. \"Flames above the treetops\" has no number: the value is null and the fire type is `active_crown`.",
    "- `fire_type`: from the head's intensity class (\"Intensiteettiluokka k/5\" or implied by its band): 5 → `active_crown`; 1–4 → `surface` (class 4, the generator's \"intense surface fire with torching\", is kept surface as SPEC/18 §7 says of step 7; a reviewer may read it `passive_crown`); no head band → null.",
    "- **Segments** (`segments`, placements' `segment_id`): a geometric convention of this export, on the axis from the ignition point in the observed head's direction — head: within 300 m of the observed head or ahead of it (±45° of its bearing, seen from the head); rear: behind the origin (±45° of the back bearing); otherwise the right or left flank (seen from the origin toward the head). A segment's flame value is the highest band among the step's positioned records on it, its rate the highest quoted m/min. The scenario itself names sectors L1–L4, not segments.",
    "- `rh_pct`: the weather station's reading in the step, when it gave one; never interpolated from the forecasts (which give 25–40 % ranges).",
    "- `event` / `events`: the CA's scripted events (ignite → `spotting`, or `reignition` for a rekindle; `control_sector` → `control`; fuel removal / knock-down → `suppression`), the radio's crossings (`barrier_crossed`) and stops (`stop_at_barrier`) dated by the interval they name, `crown` where the head burns above the treetops, and the forcing's categorical basis (`deep_burning` for depth, `regime_change` for mechanism); `event` is the first of reignition, crown, spotting, stop_at_barrier, barrier_crossed, deep_burning, regime_change, suppression, control. `spotting_m` = the scripted spot distance ahead of the head; `reignition_source` and `change_reason` = the scripted events' notes.",
    "- `barriers`: roads (main, gravel, forest) and waters with a vertex within 1 km ahead of the observed head (±45°), nearest-vertex distance.",
    "- `smouldering_spots`: records of the step that say so (stumps and litter smoking, residual heat, burning deep in the humus, smouldering) and the rekindle flare-ups on the map (`US1`–`US3`).",
    "- **Units:** ids kept. `Pelastusyksikkö…` → `engine`; `Säiliöauto…` and `VPK, säiliöauto` → `tanker`; drones → `drone`; HELI1 → `helicopter`; uncertain → `unknown`: " + list(s.unknownUnits) + ".",
    "- **Placements:** each unit's scripted position (`xy`, crew on foot) and task; `attack` from the task: hose/pump attack and mop-up → `direct`, firebreak and road line → `indirect`, evacuation → `point_protection`, drones → `lookout`, anything else (staging, transit, refill, shuttle, rest, withdrawn, hose laying, blocked) → null. `hose_length_needed_m` = the scripted hose line; `access_distance_m` = crew to vehicle; `distance_ahead_of_head_m` only for a placement on the head segment ahead of the head.",
    "- **Perimeters:** `kind: \"truth\"` = the CA at the step's END (main fire + detached fronts, one MultiPolygon), `kind: \"reported\"` = the reported perimeter at the step's START; `suppressed` = the step has a control / fuel-removal / knock-down event or is step 10 or later (sectors in hand). From step 12 the new fronts share the old fire's edge (revision (aj)), so a MultiPolygon's parts touch along a line: OGC-invalid (self-intersection); `perimeter_compare.py` repairs them with `buffer(0)`, other readers should too. `perimeter_compare.py` unions all features of a cycle: keep one kind first, e.g. `jq '.features |= map(select(.properties.kind == \"truth\"))'`.",
    "- `tactical_check.py` reads ONE cycle: extract it, e.g. `jq '.cycles[] | select(.cycle == 13)' ground_truth/cycles.json > cycle13.json`.",
    "",
    "## Nulls in `cycles.json`",
    "",
    "| Field | Null in cycles |",
    "|---|---|",
    ...nulls,
    "",
    `Always null (not modelled): \`isi\`; per unit \`persons\`, \`hose_available_m\`, \`hours_on_shift\`; per placement \`escape_route\`, \`safety_zone\`, \`comms\`, \`downwind\`, \`co_ppm\`, \`water_confirmed\`. Note: \`tactical_check.py\` treats a null LACES field as missing (\"no escape route\"), so every placement fails LACES until those are authored. Cycles where the CA's head did not advance (\`ros_head_m_min\` 0): ${list(s.zeroRosCycles)}.`,
    "",
    "## Responses (`npm run skills:export -- --responses <session files…>`)",
    "",
    "`responses.csv` (participant, item_id, answer, confidence, rt_s) and `exposure.csv` (participant, fact_id, first_seen_cycle) from session logs (`fire-sim-session-jsonl/1`): the first answer per freeze item (`firstFreezeAnswers`; a replayed view dropped), each SPAM probe's first answer (`spamMeasures`; a second item `.b`, which has no prompt of its own, from its `spam_answered` and `recall_confidence_submitted`, timed from the first item's last record), the hinge check (`hingeCheckMeasure`). Unanswered items (timed out, missing) get no row: missing is not wrong. Practice items are included (`practice: true` in items.json; drop them in the analysis). Confidence 25/50/75/100 → 0.25–1.00; a map answer as `E;N` (EPSG:3067); `rt_s` = time on the freeze item (from `msSinceFreezeOpened`), the SPAM answer latency, the hinge answer latency. Exposure is the freeze measures' fold (`atomExposure`, `app/telemetry/freeze-measures.ts`: pushed bubbles, Haku results, Haku-chat and Thinker retrievals); `first_seen_cycle` = the first cycle by whose end the atom had reached the participant (records placed in cycles by their view and virtual time).",
    "",
  ].join("\n");
}
