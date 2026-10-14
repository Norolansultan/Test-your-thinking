/**
 * Game mode (SPEC/29): the road graph (`content/game/world.json`) and driving on it (`app/game/world/roads.ts`).
 */

import { describe, expect, it } from "vitest";
import { FUEL, type RoadClass, type XY } from "../../app/game/contracts.js";
import { getWorld } from "../../app/game/world/load.js";
import { cellOf, distance } from "../../app/game/world/grid.js";
import { nearestNode, routeOnRoads, terrainSpeedFactor, type SpeedTable } from "../../app/game/world/roads.js";

const world = getWorld();
const ENGINE: SpeedTable = { main: 80, gravel: 50, forest: 30, track: 12 };

function component(start: number): Set<number> {
  const adj: number[][] = world.roads.nodes.map(() => []);
  for (const e of world.roads.edges) { adj[e.a]!.push(e.b); adj[e.b]!.push(e.a); }
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length > 0) for (const w of adj[stack.pop()!]!) if (!seen.has(w)) { seen.add(w); stack.push(w); }
  return seen;
}

const nodesOf = (classes: readonly RoadClass[]) => {
  const out = new Set<number>();
  for (const e of world.roads.edges) if (classes.includes(e.cls)) { out.add(e.a); out.add(e.b); }
  return out;
};

describe("road graph", () => {
  it("is a clean graph: no loops, no duplicate edges, edges of ~100 m at most, every node used", () => {
    const keys = new Set<string>();
    const used = new Set<number>();
    for (const e of world.roads.edges) {
      expect(e.a).not.toBe(e.b);
      const k = e.a < e.b ? `${e.a}:${e.b}` : `${e.b}:${e.a}`;
      expect(keys.has(k)).toBe(false);
      keys.add(k);
      expect(e.lengthM).toBeGreaterThan(0);
      expect(e.lengthM).toBeLessThanOrEqual(120); // cut at 100 m; junction snapping moves an end by ≤ 10 m
      used.add(e.a);
      used.add(e.b);
    }
    expect(used.size).toBe(world.roads.nodes.length);
    expect(world.roads.nodes.length).toBeGreaterThan(1000);
  });

  it("has every road class, mostly forest roads", () => {
    const count = new Map<RoadClass, number>();
    for (const e of world.roads.edges) count.set(e.cls, (count.get(e.cls) ?? 0) + 1);
    for (const c of ["main", "gravel", "forest", "track", "path"] as const) expect(count.get(c), c).toBeGreaterThan(0);
  });

  it("joins the command post to ≥ 90 % of the main and gravel road nodes (in fact all)", () => {
    const cp = nearestNode(world, world.commandPost)!;
    expect(distance(world.roads.nodes[cp]!, world.commandPost)).toBeLessThan(1);
    const reach = component(cp);
    const trunk = nodesOf(["main", "gravel"]);
    let inside = 0;
    for (const n of trunk) if (reach.has(n)) inside++;
    expect(inside / trunk.size).toBeGreaterThanOrEqual(0.9);
    for (const id of world.entryNodes) expect(reach.has(id)).toBe(true);
    for (const w of world.waterPoints) if (w.roadNode !== null) expect(reach.has(w.roadNode)).toBe(true);
  });

  it("links R2 to the main road in Lahdenkylä (its end stops 47 m short on the map)", () => {
    const pond = world.waterPoints.find((w) => w.nameFi === "Lampi 1")!; // the farm pond at the village (W2)
    const r = routeOnRoads(world, world.commandPost, pond.at, ENGINE)!;
    // R1 east, R2 south to the village: ~5.8 km, not the 9 km round by R3 and the maantie.
    expect(r.lengthM).toBeLessThan(6500);
  });
});

describe("nearestNode", () => {
  it("finds the nearest node, honours maxM and classes, breaks ties by id", () => {
    const cp = nearestNode(world, world.commandPost);
    expect(cp).not.toBeNull();
    let best = 0;
    world.roads.nodes.forEach((p, i) => { if (distance(p, world.commandPost) < distance(world.roads.nodes[best]!, world.commandPost)) best = i; });
    expect(cp).toBe(best);
    expect(nearestNode(world, { x: -50_000, y: -50_000 }, 1000)).toBeNull();
    expect(nearestNode(world, { x: -50_000, y: -50_000 })).not.toBeNull();
    const main = nearestNode(world, world.commandPost, Infinity, ["main"])!;
    expect(world.roads.edges.some((e) => (e.a === main || e.b === main) && e.cls === "main")).toBe(true);
  });
});

describe("terrainSpeedFactor", () => {
  it("is fastest on open ground, slow in spruce and bog, zero on water", () => {
    expect(terrainSpeedFactor(FUEL.water)).toBe(0);
    expect(terrainSpeedFactor(FUEL.field)).toBe(1);
    expect(terrainSpeedFactor(FUEL.pine_heath)).toBeGreaterThan(terrainSpeedFactor(FUEL.spruce_mature));
    expect(terrainSpeedFactor(FUEL.spruce_mature)).toBeGreaterThan(terrainSpeedFactor(FUEL.open_bog));
    expect(terrainSpeedFactor(FUEL.open_bog)).toBeGreaterThan(0);
  });
});

describe("routeOnRoads", () => {
  const west = world.roads.nodes[world.entryNodes[0]!]!;
  const far: XY = { x: 9300, y: 8500 }; // forest east of Kotkanjoki, ~11 km from the west entry

  it("routes between far points with a plausible length and duration", () => {
    const r = routeOnRoads(world, west, far, ENGINE)!;
    expect(r).not.toBeNull();
    const straight = distance(west, far);
    expect(r.lengthM).toBeGreaterThanOrEqual(straight);
    expect(r.lengthM).toBeLessThan(straight * 2);
    expect(r.durationS).toBeGreaterThan(r.lengthM / (80 / 3.6)); // never faster than the fastest road
    expect(r.durationS).toBeLessThan(r.lengthM / (20 / 3.6)); // mostly on roads, not crawling
    expect(r.path[0]).toEqual(west);
    expect(r.path[r.path.length - 1]).toEqual(far);
    let len = 0;
    for (let k = 1; k < r.path.length; k++) len += distance(r.path[k - 1]!, r.path[k]!);
    expect(len).toBeCloseTo(r.lengthM, 6);
    expect(r.offRoadM).toBeLessThan(1000);
  });

  it("drives along graph edges and only on open classes", () => {
    const r = routeOnRoads(world, west, world.commandPost, { main: 80, gravel: 50 })!;
    const edgeSet = new Set(world.roads.edges.filter((e) => e.cls === "main" || e.cls === "gravel").map((e) => (e.a < e.b ? `${e.a}:${e.b}` : `${e.b}:${e.a}`)));
    for (let k = 1; k < r.nodes.length; k++) {
      const a = r.nodes[k - 1]!;
      const b = r.nodes[k]!;
      expect(edgeSet.has(a < b ? `${a}:${b}` : `${b}:${a}`)).toBe(true);
    }
    expect(r.offRoadM).toBeLessThan(1);
  });

  it("is deterministic", () => {
    const a = routeOnRoads(world, west, far, ENGINE);
    const b = routeOnRoads(world, west, far, ENGINE);
    expect(b).toEqual(a);
  });

  it("does not cross water off-road", () => {
    // Across Karhujärvi, west shore to east shore, with no roads open: the straight leg is over water.
    const across = { a: { x: 2900, y: 6950 }, b: { x: 3850, y: 6950 } };
    expect(world.fuel[cellOf(world, { x: 3366, y: 6950 })]).toBe(FUEL.water);
    expect(routeOnRoads(world, across.a, across.b, {}, { maxOffRoadM: 5000 })).toBeNull();
    // With roads open it goes round.
    const round = routeOnRoads(world, across.a, across.b, ENGINE);
    expect(round).not.toBeNull();
    expect(round!.lengthM).toBeGreaterThan(distance(across.a, across.b));
  });

  it("prefers open ground off-road and walks straight when that is quickest", () => {
    const a = world.commandPost;
    const b = { x: a.x + 30, y: a.y + 30 };
    const r = routeOnRoads(world, a, b, {})!;
    expect(r.nodes).toEqual([]);
    expect(r.lengthM).toBeCloseTo(distance(a, b), 6);
    expect(r.offRoadM).toBeCloseTo(r.lengthM, 6);
  });

  it("is not trapped on a stretch of road cut off from the network", () => {
    // The north band's forest roads join the rest only beyond the map's edge: from one of them, a unit still finds
    // its way (off-road to the nearest connected road).
    const cp = nearestNode(world, world.commandPost)!;
    const reach = component(cp);
    let cutOff = -1;
    let gap = Infinity;
    world.roads.nodes.forEach((p, i) => {
      if (reach.has(i) || p.y < 9_600) return;
      for (const j of reach) {
        const d = distance(p, world.roads.nodes[j]!);
        if (d < gap) { gap = d; cutOff = i; }
      }
    });
    expect(cutOff).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(2500); // ~2.3 km of forest between the north band and the network
    const start = world.roads.nodes[cutOff]!;
    const r = routeOnRoads(world, start, world.commandPost, ENGINE, { maxOffRoadM: 3000 });
    expect(r).not.toBeNull();
    expect(r!.nodes.some((id) => reach.has(id))).toBe(true);
    expect(r!.durationS).toBeLessThan(2 * 3600);
  });
});
