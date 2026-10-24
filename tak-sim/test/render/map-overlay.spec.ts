/**
 * SPEC/12 revision (al): the live map's reference overlay (grid, sectors, roads, bridge, water points, 20 kV (was 110 kV), command
 * post, the region's other fires) and what must hold for it: live map only (never on the memory-check map), static
 * (reads nothing from the view), no label near the old fire's north edge or V13's US2, both languages without
 * Finnish names in English, the grid on whole ETRS-TM35FIN kilometres, the region's fires never on the opening frame.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { BROOK_LABEL_GAP_PX, CP_OFFSET_PX, OVERLAY, OVERLAY_FONT_PX, overlayAnchor, overlayLabels, regionFiresVisible, sectorLabelPoint } from "../../app/render/ui/map-overlay.js";
import { extentCamera, mercatorProjector, openingCamera, zoomForWidth } from "../../app/render/map-frame.js";
import { COMPACT_FRAME } from "../../app/render/unit-declutter.js";
import { finnishNamesIn } from "../../app/i18n/place-names.js";
import { tm35ToWgs84, wgs84ToTm35 } from "../../tools/fire-ca/tm35.js";
import { IGN_TM35 } from "../../tools/topo-map/geom.js";

const scenario = buildDemoScenario();
const v13 = scenario.cycles.find((c) => c.index === 13)!;
const metres = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const k = (Math.PI / 180) * 6_371_000;
  return Math.hypot((b.lat - a.lat) * k, (b.lon - a.lon) * k * Math.cos((a.lat * Math.PI) / 180));
};
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

describe("the reference overlay (revision (al))", () => {
  it("is drawn on the live map only: the memory-check map imports none of it", () => {
    const fm = code("app/render/ui/components/FreezeMap.tsx");
    for (const gone of [/map-overlay/, /addOverlay/, /unit-stacks/, /sectors/, /regionFires/, /fire-layers/]) expect(fm, String(gone)).not.toMatch(gone);
    const mv = code("app/render/ui/components/MapView.tsx");
    expect(mv).toMatch(/addOverlayLines\(map\);/);
    expect(mv).toMatch(/addOverlayLabels\(map, lang,/);
  });

  it("reads nothing from the view: its labels and lines come from the scenario export and map-overlay.json alone", () => {
    const ov = code("app/render/ui/map-overlay.ts");
    for (const gone of [/snapshot/i, /cycleInfo/, /renderTree/, /currentCycle/, /spot_fires/, /perimeter/]) expect(ov, String(gone)).not.toMatch(gone);
  });

  it("puts no label within 600 m of V13's US2 or within 400 m of the old fire's north edge", () => {
    const us2 = v13.fire.spot_fires.find((s) => s.callsign === "US2")!.position;
    const ign = SITE_SCENARIO.ignition;
    const northEdge = v13.fire.perimeter_current.flatMap((s) => s.line).filter((p) => p.lat > ign.lat + 0.002);
    expect(northEdge.length).toBeGreaterThan(10);
    for (const lang of ["fi", "en"] as const) {
      for (const l of overlayLabels(lang)) {
        expect(metres(l.at, us2), `${l.key} to US2`).toBeGreaterThan(600);
        const nearest = Math.min(...northEdge.map((p) => metres(l.at, p)));
        expect(nearest, `${l.key} to the north edge`).toBeGreaterThan(400);
      }
    }
  });

  it("labels R1, R2, R3, the bridge, 20 kV (SPEC/33 (bc): was 110 kV), the command post and the four sector codes, in both languages, small; never the water points (revision (am))", () => {
    const fi = overlayLabels("fi"), en = overlayLabels("en");
    expect(fi.map((l) => l.key)).toEqual(en.map((l) => l.key));
    const keys = fi.map((l) => l.key);
    for (const k of ["road:R1:0", "road:R2:1", "road:R3:2", "road:R3:3", "bridge", "power", "cp", "sector:L1", "sector:L2", "sector:L3", "sector:L4"]) expect(keys).toContain(k);
    // Revision (am): the map does not point out the water-taking places; they stay in the radio texts only.
    for (const l of [...fi, ...en]) {
      expect(l.key, l.key).not.toMatch(/^water/);
      expect(l.html.replace(/<[^>]+>/g, " "), l.key).not.toMatch(/\bW[123]\b|vesipiste|water point/i);
    }
    const ov = code("app/render/ui/map-overlay.ts");
    expect(ov).not.toMatch(/POND_W|BRIDGE_W3|WATER_SVG/);
    // Difficulty audit (23 Oct 2026, `proposal-map.md` d1): 11 px with the white halo (was 9 px since revision (am)); never larger.
    expect(OVERLAY_FONT_PX).toBe(11);
    for (const l of fi.filter((x) => x.kind !== "region")) expect(l.html, l.key).not.toMatch(/font:\s*\d+ (1[2-9])px/);
    expect(fi.find((l) => l.key === "bridge")!.html).toContain("R3:n silta (Kotkanjoki)");
    expect(en.find((l) => l.key === "bridge")!.html).toContain("R3 bridge (Eagle River)");
    // The bridge's load limit is V14's infrastructure key and first appears in the 18:20 records: never on the map.
    for (const l of [...fi, ...en]) expect(l.html.replace(/<[^>]+>/g, " "), l.key).not.toMatch(/\d+\s*t\b|tonn|kuorma|load|paino|weight/i);
    expect(fi.find((l) => l.key === "cp")!.html).toContain(">JP<");
    expect(en.find((l) => l.key === "cp")!.html).toContain(">CP<");
    for (const l of en) expect(finnishNamesIn(l.html.replace(/<[^>]+>/g, " ")), l.key).toEqual([]);
    // "20 kV" only: never the line's state.
    expect(fi.find((l) => l.key === "power")!.html.replace(/<[^>]+>/g, "")).toBe("20 kV");
  });

  it("labels Korpioja a second time, on the drawn brook east of the crown run's crossing, above its line and clear of the L2 code (play-test D8, 24 Oct 2026)", () => {
    const fi = overlayLabels("fi").find((l) => l.key === "brook:korpioja")!, en = overlayLabels("en").find((l) => l.key === "brook:korpioja")!;
    expect(fi.html.replace(/<[^>]+>/g, "")).toBe("Korpioja");
    expect(en.html.replace(/<[^>]+>/g, "")).toBe("Alder Creek");
    expect(overlayAnchor("brook")).toEqual({ anchor: "bottom", offset: [0, -BROOK_LABEL_GAP_PX] });
    // On the brook: within 15 m of the site contract's (simplified) Korpioja line, east of the crossing (~1500, 1480 site metres).
    const contract = JSON.parse(readFileSync("content/site/contract.json", "utf8")) as { features: { id: string; geometry: { coordinates: [number, number][] } }[] };
    const line = contract.features.find((f) => f.id === "KORPIOJA")!.geometry.coordinates.map(([x, y]) => tm35ToWgs84(IGN_TM35.eastM + x, IGN_TM35.northM + y));
    type Ll = { lat: number; lon: number };
    const toSegment = (p: Ll, a: Ll, b: Ll) => Math.min(...Array.from({ length: 51 }, (_, i) => metres(p, { lat: a.lat + ((b.lat - a.lat) * i) / 50, lon: a.lon + ((b.lon - a.lon) * i) / 50 })));
    expect(Math.min(...line.slice(1).map((b, i) => toSegment(fi.at, line[i]!, b)))).toBeLessThan(15);
    const site = wgs84ToTm35(fi.at);
    expect(site.eastM - IGN_TM35.eastM).toBeGreaterThan(2_000);
    expect(site.eastM - IGN_TM35.eastM).toBeLessThan(2_400); // as near the crossing as the distances above allow
    // Its text sits above the line, so it never covers the "L2 Koillinen" code ~60 m south of it, at any of the presets' zooms.
    const l2 = overlayLabels("fi").find((l) => l.key === "sector:L2")!;
    const e = scenario.extent;
    for (const [w, h] of [[920, 420], [920, 300], [1280, 720], [1000, 680]] as const) {
      for (const cam of [openingCamera(e, w, h, 16), extentCamera(e, w, h, 16)]) {
        const p = mercatorProjector(cam, w, h);
        const textBottom = p(fi.at).y - BROOK_LABEL_GAP_PX, codeTop = p(l2.at).y - (OVERLAY_FONT_PX + 1) / 2;
        expect(textBottom, `${w}×${h}`).toBeLessThanOrEqual(codeTop);
      }
    }
  });

  it("the command post's flag sits up and left of its point, clear of the R1 label and of a unit staged on the point (revision (am))", () => {
    const e = scenario.extent;
    const cpLabel = overlayLabels("en").find((l) => l.key === "cp")!;
    const r1 = OVERLAY.roads.find((r) => r.id === "R1")!.at;
    // The flag: "CP" (2 × ~0.62 em at OVERLAY_FONT_PX) + 1 px + the 10 × 12 flag; anchored bottom-right at CP_OFFSET_PX.
    const em = OVERLAY_FONT_PX / 9; // the R1 box below was measured at 9 px
    const cpW = 2 * 5.6 * em + 1 + 10, cpH = 12;
    for (const [w, h] of [[920, 420], [920, 300], [1280, 720], [920, 560]] as const) {
      for (const cam of [openingCamera(e, w, h, 16), extentCamera(e, w, h, 16)]) {
        const p = mercatorProjector(cam, w, h);
        const c = p(cpLabel.at), r = p(r1);
        const cp = { left: c.x + CP_OFFSET_PX[0] - cpW, right: c.x + CP_OFFSET_PX[0], top: c.y + CP_OFFSET_PX[1] - cpH, bottom: c.y + CP_OFFSET_PX[1] };
        const road = { left: r.x - 8 * em, right: r.x + 8 * em, top: r.y - 6 * em, bottom: r.y + 6 * em }; // "R1" in its box, scaled from 9 px
        const unit = { left: c.x - COMPACT_FRAME.w / 2, right: c.x + COMPACT_FRAME.w / 2, top: c.y - COMPACT_FRAME.h / 2, bottom: c.y + COMPACT_FRAME.h / 2 };
        const hit = (a: typeof cp, b: typeof cp) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        expect(hit(cp, road), `${w}×${h} R1`).toBe(false);
        // A compact unit on the point overlaps at most the flag's corner (1 × 1 px).
        const ox = Math.min(cp.right, unit.right) - Math.max(cp.left, unit.left), oy = Math.min(cp.bottom, unit.bottom) - Math.max(cp.top, unit.top);
        expect(Math.max(0, ox) * Math.max(0, oy), `${w}×${h} unit`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("the road labels sit on their roads near the designed points; the bridge and the command post on theirs", () => {
    const f = SITE_SCENARIO.features;
    expect(metres(OVERLAY.commandPost, f.CP!)).toBeLessThan(5);
    expect(metres(OVERLAY.bridge.at, f.R3_BRIDGE_W!)).toBeGreaterThan(300); // the deck, between the approach and the east end
    expect(metres(OVERLAY.bridge.at, f.R3_BRIDGE_E!)).toBeLessThan(150);
    const r1 = OVERLAY.roads.find((r) => r.id === "R1")!.at;
    // R1 runs east from the command post along ~400 m north; on the rebuilt map (SPEC/33) it bends ~50 m north of the command post's
    // latitude where the script snaps the label onto it (`scripts/build-map-overlay.ts`, regenerated 20 Oct 2026; was within 30 m).
    expect(Math.abs(r1.lat - f.CP!.lat) * 111_320).toBeLessThan(80);
  });

  it("sector codes sit 2.6 km from the ignition, each inside its own sector's outline direction", () => {
    for (const s of SITE_SCENARIO.sectors) {
      const p = sectorLabelPoint(s.geometry, SITE_SCENARIO.ignition);
      expect(metres(p, SITE_SCENARIO.ignition)).toBeCloseTo(2_600, -1);
    }
  });

  it("draws no 1 km grid any more (revision (am)); the build's grid data stays on whole ETRS-TM35FIN kilometres", () => {
    const ov = code("app/render/ui/map-overlay.ts");
    expect(ov).not.toMatch(/ref-grid|OVERLAY\.grid|GRID_LINE/);
    for (const g of OVERLAY.grid.slice(0, 3)) for (const p of g.line) {
      const t = wgs84ToTm35(p);
      expect(Math.abs((g.axis === "E" ? t.eastM : t.northM) - g.km * 1000)).toBeLessThan(0.5);
    }
  });

  it("the region's other fires show at the widest zoom only, never on the opening (Palo) frame", () => {
    const e = scenario.extent, lat = (e.south + e.north) / 2;
    for (const [w, h] of [[920, 450], [920, 300], [1280, 720], [1280, 529], [600, 900]] as const) {
      const palo = extentCamera(e, w, h, 16).zoom, area = zoomForWidth(20_000, w, lat);
      expect(regionFiresVisible(palo, area, palo), `${w}×${h} Palo`).toBe(false);
      expect(regionFiresVisible(openingCamera(e, w, h, 16).zoom, area, palo), `${w}×${h} opening`).toBe(false);
      expect(regionFiresVisible(Math.min(area, palo) - 0.5, area, palo), `${w}×${h} zoomed out`).toBe(true);
      if (area < palo) expect(regionFiresVisible(area, area, palo), `${w}×${h} Area`).toBe(true);
    }
  });

  it("the legend names the units and the map's symbols in both languages, starts collapsed for everyone, opens for the tour's legend step, and logs the participant's toggles (revision (am))", async () => {
    const { LEGEND_MAP_TEXT } = await import("../../app/render/ui/components/Legend.js");
    expect(Object.keys(LEGEND_MAP_TEXT.en)).toEqual(Object.keys(LEGEND_MAP_TEXT.fi));
    for (const k of ["unit", "crew", "hose", "stack", "air", "sector", "road", "power", "region"] as const) {
      expect(LEGEND_MAP_TEXT.fi[k].length, k).toBeGreaterThan(3);
      expect(finnishNamesIn(LEGEND_MAP_TEXT.en[k]), k).toEqual([]);
    }
    for (const gone of ["water", "cp", "lake", "grid", "units"]) expect(Object.keys(LEGEND_MAP_TEXT.fi), gone).not.toContain(gone);
    const lg = code("app/render/ui/components/Legend.tsx");
    expect(lg).toMatch(/const \[open, setOpen\] = useState\(false\);/);
    expect(lg).toMatch(/const shown = open \|\| tourOpen;/);
    expect(lg).toMatch(/aria-expanded=\{shown\}/);
    expect(lg).toMatch(/onToggle\?\.\(next\)/);
    expect(lg).toMatch(/detail === "legend"/);
    // One column, only the rows drawn now.
    expect(lg).toMatch(/rows\.filter\(\(\[k\]\) => drawn\.has\(k\)\)/);
    expect(lg).not.toMatch(/column\(/);
    expect(code("app/render/ui/components/GuidedTour.tsx")).toMatch(/announceTourStep\(step\.id\)/);
    expect(code("app/render/ui/components/MapView.tsx")).toMatch(/layerId: "legend", newState: open/);
  });

  it("the legend lists only what the map draws: per view, the fire's symbols present, the projection once revealed, stacks and region fires when drawn", async () => {
    const { legendPresence, LEGEND_ROWS } = await import("../../app/render/ui/components/Legend.js");
    const none = { stacks: false, region: false };
    const vp = legendPresence(scenario.practice.cycle, false, none);
    expect(vp.has("projection")).toBe(false);
    expect(vp.has("spotConfirmed") || vp.has("spotUnconfirmed")).toBe(false);
    expect(vp.has("stack")).toBe(false);
    expect(vp.has("region")).toBe(false);
    for (const k of ["sector", "road", "power", "unit"] as const) expect(vp.has(k), k).toBe(true);
    // V13: US2 and the other spot fire are drawn, so their symbols are listed; the projection once revealed.
    const v13rows = legendPresence(v13, true, { stacks: true, region: false });
    expect(v13rows.has("spotConfirmed") || v13rows.has("spotUnconfirmed")).toBe(true);
    expect(v13rows.has("projection")).toBe(true);
    expect(v13rows.has("stack")).toBe(true);
    // V9 has no burning zone (the fire stood still): not listed.
    expect(legendPresence(scenario.cycles.find((c) => c.index === 9)!, true, none).has("burningZone")).toBe(false);
    expect(legendPresence(null, false, { stacks: false, region: true }).has("region")).toBe(true);
    // Rows keep one fixed order.
    const order = [...v13rows];
    expect(order).toEqual(LEGEND_ROWS.filter((k) => v13rows.has(k)));
  });

  it("sectors are drawn as neutral grey dashed outlines with their codes and names (difficulty audit d2), under the fire layers", () => {
    const ov = code("app/render/ui/map-overlay.ts");
    expect(ov).toMatch(/"line-dasharray": \[\.\.\.SECTOR_LINE\.dash\]/);
    expect(ov).not.toMatch(/fill-color/);
    const mv = code("app/render/ui/components/MapView.tsx");
    expect(mv.indexOf("addOverlayLines(map);")).toBeLessThan(mv.indexOf("addFireLayers(map);"));
    const text = (lang: "fi" | "en", id: string) => overlayLabels(lang).find((l) => l.key === `sector:${id}`)!.html.replace(/<[^>]+>/g, "");
    expect(SITE_SCENARIO.sectors.map((s) => text("fi", s.id))).toEqual(["L1 Pohjoinen", "L2 Koillinen", "L3 Etelä", "L4 Länsi"]);
    expect(SITE_SCENARIO.sectors.map((s) => text("en", s.id))).toEqual(["L1 North", "L2 North-east", "L3 South", "L4 West"]);
  });

  it("difficulty audit d4: the two settlements are labelled at their points, in both languages; nothing else is added", () => {
    for (const [key, feature, fi, en] of [["settlement:cabins", "CABINS", "Mökkiranta (loma-asuntoja)", "Lakeside Cottages (holiday homes)"], ["settlement:village", "VILLAGE", "Lahdenkylä", "Bay Village"]] as const) {
      const f = overlayLabels("fi").find((l) => l.key === key)!, e = overlayLabels("en").find((l) => l.key === key)!;
      expect(f.at).toEqual(SITE_SCENARIO.features[feature]);
      expect(f.html.replace(/<[^>]+>/g, "")).toBe(fi);
      expect(e.html.replace(/<[^>]+>/g, "")).toBe(en);
    }
    expect(overlayLabels("fi").filter((l) => l.kind === "settlement")).toHaveLength(2);
  });
});
