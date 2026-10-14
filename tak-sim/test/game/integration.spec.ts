import { describe, expect, it } from "vitest";
import { createGame } from "../../app/game/sim/game.js";
import { defaultDeps } from "../../app/game/sim/default-deps.js";
import { GAME_SCENARIOS, gameScenario } from "../../app/game/scenarios/index.js";
import { getWorld } from "../../app/game/world/load.js";
import { CELL } from "../../app/game/contracts.js";

// SPEC/29 §3: the game loop on the real world and the real fire model (integration, 14 Oct 2026).
const world = getWorld();

function run(game: ReturnType<typeof createGame>, seconds: number) {
  for (let t = 0; t < seconds; t += 60) game.tick(60);
}

describe("game mode on the real world", () => {
  it("every scenario starts: units, weather, a burning fire, and the protected settlement resolved", () => {
    for (const s of GAME_SCENARIOS) {
      const game = createGame(s, world, 7, defaultDeps);
      game.tick(10);
      expect(game.state.phase).toBe("running");
      expect(game.state.fire.state.some((v) => v === CELL.burning)).toBe(true);
      expect(Object.keys(game.state.assetStatus).length).toBe(world.assets.length);
    }
  });

  it("left alone for two hours the summer-afternoon fire grows to tens of hectares and the radio talks", () => {
    const game = createGame(gameScenario("summer-afternoon")!, world, 7, defaultDeps);
    run(game, 2 * 3600);
    const ha = game.state.score.burnedHa;
    expect(ha).toBeGreaterThan(5);
    expect(ha).toBeLessThan(400);
    expect(game.state.radio.length).toBeGreaterThan(5);
    expect(game.state.units.some((u) => u.status !== "en_route")).toBe(true);
  });

  it("attacking with the first crews burns less than doing nothing", () => {
    const idle = createGame(gameScenario("summer-afternoon")!, world, 7, defaultDeps);
    const played = createGame(gameScenario("summer-afternoon")!, world, 7, defaultDeps);
    const fireAt = { x: 5000, y: 5000 };
    played.tick(10);
    for (let t = 0; t < 2 * 3600; t += 60) {
      if (t % 600 === 0) {
        for (const u of played.state.units) {
          if (u.status === "en_route" || u.status === "out_of_action") continue;
          if (u.order && u.order.type !== "hold") continue;
          if (["engine", "volunteer", "forest_unit", "tanker"].includes(u.kind)) played.issue(u.id, { type: "attack", target: fireAt });
          if (u.kind === "helicopter" || u.kind === "drone_water") played.issue(u.id, { type: "drop", target: fireAt });
          if (u.kind === "drone_thermal" || u.kind === "drone_vtol" || u.kind === "spotter") played.issue(u.id, { type: "recon", centre: fireAt });
        }
      }
      played.tick(60);
      idle.tick(60);
    }
    expect(played.commands.length).toBeGreaterThan(0);
    expect(played.state.score.burnedHa).toBeLessThan(idle.state.score.burnedHa);
  });
});
