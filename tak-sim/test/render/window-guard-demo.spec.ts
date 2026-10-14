import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

// 14 Oct 2026: the minimum-window cover (SPEC/12 (al)) applies to the study (`?tuotanto`) only; a demonstration and the
// web demo run at any window size, and on a narrow window the TAK side pane lies over the map instead of squeezing it.
describe("minimum window size: study only", () => {
  it("SessionView renders the cover only when asked, and asks by default (the study's behaviour)", () => {
    const v = src("app/render/ui/components/SessionView.tsx");
    expect(v).toMatch(/minWindowGuard = true/);
    expect(v).toMatch(/\{minWindowGuard && <WindowSizeGuard /);
  });
  it("the start page turns it on for a study link only; a resumed demonstration keeps it off", () => {
    expect(src("app/render/ui/App.tsx")).toMatch(/minWindowGuard=\{study\}/);
    expect(src("app/render/ui/SessionLauncher.tsx")).toMatch(/minWindowGuard=\{!demo\}/);
  });
  it("a narrow window lays the TAK side pane over the map, beside the toolbar, under the forced question (25) and the freeze (30)", () => {
    const layout = src("app/render/ui/tak/TakSessionLayout.tsx");
    expect(layout).toMatch(/export const TAK_OVERLAY_BELOW_PX = 760;/);
    expect(layout).toMatch(/overlay=\{narrow\}/);
    const pane = src("app/render/ui/tak/TakSidePane.tsx");
    expect(pane).toMatch(/position: "absolute" as const, top: 0, bottom: 0, left: 0, right: TAK\.toolbarWidth, zIndex: 22/);
  });
});
