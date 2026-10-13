/**
 * SPEC/28 §5 Overlay Manager: the call-sign labels, sensor footprints, earlier perimeters and the participant's own plan
 * marks can be switched; the projection and the current perimeter cannot — they carry the primary DV and stay drawn by
 * SPEC/12's layers whatever the state. Rate marks are listed but stay off: they are not drawn in this study (SPEC/12 (y)).
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_OVERLAYS, isToggleableOverlay, LOCKED_OVERLAYS, overlayLayerVisibility, PROTECTED_MAP_LAYER_PREFIXES, TAK_OVERLAY_LAYERS, toggleOverlay,
  type TakOverlayState,
} from "../../app/render/ui/tak/shell.js";
import { TAK_MAP_CSS } from "../../app/render/ui/tak/tak-map.js";

const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/** Every overlay state there is (2⁵). */
function allStates(): TakOverlayState[] {
  const out: TakOverlayState[] = [];
  for (let bits = 0; bits < 1 << TAK_OVERLAY_LAYERS.length; bits++) {
    const s: Record<string, boolean> = {};
    TAK_OVERLAY_LAYERS.forEach((l, i) => { s[l] = ((bits >> i) & 1) === 1; });
    out.push(s as TakOverlayState);
  }
  return out;
}

/** The layer ids `addFireLayers` creates (the fire and the projection, SPEC/12). */
function fireLayerIds(): string[] {
  const src = readFileSync("app/render/ui/fire-layers.ts", "utf8");
  const body = src.slice(src.indexOf("export function addFireLayers"), src.indexOf("export function detectionColor"));
  return [...body.matchAll(/id: [`"]([a-z0-9-]+)/g)].map((m) => m[1]!);
}

describe("what can and cannot be switched", () => {
  it("the projection and the current perimeter have no switch: toggling them changes nothing, in any state", () => {
    expect([...LOCKED_OVERLAYS]).toEqual(["projection", "current_perimeter"]);
    for (const s of allStates()) {
      for (const locked of [...LOCKED_OVERLAYS, "proj-bands-fill", "fire-edge-uncontained", "perimeter", "envelope"]) {
        expect(toggleOverlay(s, locked), locked).toBeNull();
        expect(isToggleableOverlay(locked)).toBe(false);
      }
    }
  });

  it("rate marks are listed but cannot be turned on (not drawn in this study, SPEC/12 (y))", () => {
    expect(TAK_OVERLAY_LAYERS).toContain("rate_marks");
    expect(DEFAULT_OVERLAYS.rate_marks).toBe(false);
    for (const s of allStates()) expect(toggleOverlay(s, "rate_marks")).toBeNull();
  });

  it("a switch flips its own layer only", () => {
    for (const layer of ["labels", "footprints", "past_perimeters", "plan_marks"] as const) {
      const next = toggleOverlay(DEFAULT_OVERLAYS, layer)!;
      expect(next[layer]).toBe(!DEFAULT_OVERLAYS[layer]);
      for (const other of TAK_OVERLAY_LAYERS.filter((l) => l !== layer)) expect(next[other]).toBe(DEFAULT_OVERLAYS[other]);
      expect(toggleOverlay(next, layer)).toEqual(DEFAULT_OVERLAYS);
    }
  });

  it("every session starts from the same state: labels, earlier perimeters and plan marks on; footprints as in the classic map; rate marks off", () => {
    expect(DEFAULT_OVERLAYS).toEqual({ labels: true, footprints: false, past_perimeters: true, rate_marks: false, plan_marks: true });
  });
});

describe("no overlay state can hide the projection or the current perimeter", () => {
  const fire = fireLayerIds();

  it("the fire layers are found (sanity: the check below is not vacuous)", () => {
    for (const id of ["fire-edge-uncontained", "fire-edge-contained", "proj-bands-fill", "fire-past-line", "fire-zone-fill", "fire-spots"]) expect(fire).toContain(id);
    expect(fire.some((id) => id.startsWith("proj-line"))).toBe(true);
  });

  it("the only fire layer any state names is the earlier perimeters' line; no protected layer is ever named", () => {
    for (const s of allStates()) {
      const ids = overlayLayerVisibility(s).map(([id]) => id);
      for (const id of ids) {
        expect(PROTECTED_MAP_LAYER_PREFIXES.some((p) => id.startsWith(p)), id).toBe(false);
        if (fire.includes(id)) expect(id).toBe("fire-past-line");
      }
    }
  });

  it("the map glue touches no projection, edge, burnt, zone, spot or detection layer, and its CSS hides only the earlier perimeters' times and the plan labels", () => {
    const glue = code("app/render/ui/tak/tak-map.ts");
    // The one fire layer it names is the burnt area's, as the insertion point that keeps the plan marks under the fire.
    const named = [...glue.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]!).filter((id) => PROTECTED_MAP_LAYER_PREFIXES.some((p) => id.startsWith(p)));
    expect(new Set(named)).toEqual(new Set(["fire-burnt-fill"]));
    expect(glue).toMatch(/const below = map\.getLayer\("fire-burnt-fill"\) \? "fire-burnt-fill" : undefined;/);
    expect(glue).not.toMatch(/setPaintProperty|removeLayer|moveLayer/);
    expect(TAK_MAP_CSS).toMatch(/\.fire-label-past\{display:none!important\}/);
    expect(TAK_MAP_CSS).not.toMatch(/fire-label-(iso|spot)|proj|edge/);
  });

  it("the Overlay Manager draws the projection and the current perimeter as locked rows, not switches", () => {
    const pane = code("app/render/ui/tak/OverlayManagerPane.tsx");
    const locked = pane.slice(pane.indexOf("O.lockedTitle"), pane.indexOf("O.layersTitle"));
    expect(locked).toMatch(/"projection", O\.projection\], \["current_perimeter", O\.currentPerimeter\]/);
    expect(locked).not.toMatch(/onClick|role="switch"|onToggle/);
    expect(pane).toMatch(/TAK_OVERLAY_LAYERS\.map/);
    expect(pane).toMatch(/disabled=\{unavailable\}/);
  });

  it("the shell toggles through `toggleOverlay` and logs each switch", () => {
    const layout = code("app/render/ui/tak/TakSessionLayout.tsx");
    expect(layout).toMatch(/const next = toggleOverlay\(overlays, layer\);\s*if \(!next\) return;/);
    expect(layout).toMatch(/kind: "tak_overlay_toggled", detail: \{ layer, on: next\[layer\], view \}/);
  });
});
