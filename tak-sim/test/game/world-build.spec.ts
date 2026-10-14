/**
 * Game mode (SPEC/29): `npm run game:world` (`tools/game/build-world.ts`) is deterministic and the committed
 * `content/game/world.json` is what it writes today.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildWorldJson } from "../../tools/game/world/build.js";
import { loadWorld } from "../../app/game/world/load.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("game world build", () => {
  it("writes byte-identical text on every run, and the committed file is current", () => {
    const a = buildWorldJson(ROOT);
    const b = buildWorldJson(ROOT);
    expect(b.text).toBe(a.text);
    expect(readFileSync(join(ROOT, "content/game/world.json"), "utf8")).toBe(a.text);
  }, 60_000);

  it("stays compact and loads", () => {
    const { text, stats } = buildWorldJson(ROOT);
    expect(stats.bytes).toBeLessThan(1.5 * 1024 * 1024);
    const world = loadWorld(JSON.parse(text));
    expect(world.roads.nodes.length).toBe(stats.nodes);
    expect(world.roads.edges.length).toBe(stats.edges);
    expect(world.waterPoints.length).toBe(stats.waterPoints);
    expect(world.assets.length).toBe(stats.assets);
    expect(stats.entryNodes).toBe(world.entryNodes.length);
  }, 60_000);
});
