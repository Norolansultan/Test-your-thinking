/**
 * `npm run game:world` — writes the game mode's world (SPEC/29), `content/game/world.json`, from the generated site
 * (`tools/game/world/build.ts` says what goes in). Deterministic: re-running on the same inputs rewrites the same
 * bytes. Run from `tak-sim/`.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildWorldJson } from "./world/build.js";

const root = process.cwd();
const { text, stats } = buildWorldJson(root);
mkdirSync(join(root, "content/game"), { recursive: true });
writeFileSync(join(root, "content/game/world.json"), text);
console.log(`content/game/world.json: ${(stats.bytes / 1024).toFixed(0)} KiB`);
console.log(`  roads: ${stats.nodes} nodes, ${stats.edges} edges (${stats.edgesByClass.map(([c, k]) => `${c} ${k}`).join(", ")}); ` +
  `${stats.roadGraph.tJunctions} T-junctions, ${stats.roadGraph.crossings} crossings, ${stats.roadGraph.connectors} connectors; ` +
  `${stats.roadGraph.links} outside links (${(stats.roadGraph.linkM / 1000).toFixed(1)} km), ${stats.roadGraph.unlinked} unlinked; ${stats.entryNodes} entry nodes`);
console.log(`  water points: ${stats.waterPoints} (${stats.waterWithRoad} with road access)`);
console.log(`  assets: ${stats.assets}; settlements: ${stats.settlements.join(", ")}`);
