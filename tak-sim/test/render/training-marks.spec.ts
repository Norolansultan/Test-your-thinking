/**
 * Play-test round 4 (B17, 27 Oct 2026): every training mark's glyph is drawn centred on its projected point. Both players measured
 * S2.2's 300 m from the "▲" of "▲ 10.12", which sat about 25 px (100 m) west of the head point because the whole label was centred
 * on it; the "point" dot sat about 6 px left of its point and a unit's symbol above it.
 *
 * The marker's element is now the glyph's box (`markGlyph`), which MapLibre's default anchor ("center") puts centred on the point; so
 * the glyph's centre must be the box's centre, and every label must be out of the flow (absolutely positioned), where it cannot move the
 * box. Checked here on the declared geometry (no DOM in this suite): each kind's box, its glyph's own size or its SVG shape's bounding
 * box and centroid — within 3 px. The real layout was checked in Chromium on the built app (the round-4 fix's report).
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { markGlyph, MARK_SHAPES } from "../../app/render/ui/training-overlay.js";
import type { TrainingMark } from "../../app/session/training/spec.js";
import { TRAINING } from "../../app/session/training/spec-data.js";
import key from "../../content/training/key.json" with { type: "json" };
import { trainingOpening } from "../../tools/play/training-host.js";

const TOLERANCE_PX = 3;

/** The glyph's centre in its box's pixels: a full-box element's middle, or an SVG polygon's bounding-box centre and its centroid. */
function glyphCentres(html: string, size: number): { x: number; y: number }[] {
  const svg = html.match(/^<svg data-mark-glyph width="(\d+)" height="(\d+)" viewBox="0 0 (\d+) (\d+)"[^>]*><polygon points="([^"]+)"/);
  if (svg) {
    expect([svg[1], svg[2], svg[3], svg[4]].map(Number)).toEqual([size, size, size, size]); // drawn 1:1 in the whole box
    const p = svg[5]!.trim().split(/\s+/).map((xy) => xy.split(",").map(Number) as [number, number]);
    const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < p.length; i++) {
      const [x0, y0] = p[i]!, [x1, y1] = p[(i + 1) % p.length]!;
      const c = x0 * y1 - x1 * y0;
      a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
    }
    return [{ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }, { x: cx / (3 * a), y: cy / (3 * a) }];
  }
  const div = html.match(/^<div data-mark-glyph style="([^"]*)"/);
  expect(div, html.slice(0, 80)).not.toBeNull();
  const w = Number(div![1]!.match(/(?:^|;)width:(\d+)px/)![1]), h = Number(div![1]!.match(/(?:^|;)height:(\d+)px/)![1]);
  if (/border/.test(div![1]!)) expect(div![1]).toMatch(/box-sizing:border-box/); // its border inside its size
  expect([w, h]).toEqual([size, size]); // the glyph fills the box: its middle is the box's
  return [{ x: w / 2, y: h / 2 }];
}

const KINDS: readonly TrainingMark["kind"][] = ["point", "star", "water", "unit", "head"];
const sample = (kind: TrainingMark["kind"]): TrainingMark => ({ id: `m.${kind}`, kind, label: kind === "unit" ? "EK53" : kind === "head" ? "10.12" : kind === "water" ? "2" : kind === "star" ? "★" : "A", at: { lat: 60.92, lon: 27.5 } });

describe("round 4 (B17): every training mark's glyph is centred on its point", () => {
  it("the training's own marks, and every kind (the unit's too, which no item uses today), have their glyph's centre within 3 px of the point", () => {
    const marks = [...TRAINING.items.flatMap((i) => i.marks), ...KINDS.map(sample)];
    expect(new Set(marks.map((m) => m.kind))).toEqual(new Set(KINDS));
    for (const m of marks) {
      const { size, html } = markGlyph(m);
      for (const c of glyphCentres(html, size)) {
        const off = Math.hypot(c.x - size / 2, c.y - size / 2);
        expect(off, `${m.kind} ${m.label}: the glyph's centre is ${off.toFixed(2)} px from the point`).toBeLessThanOrEqual(TOLERANCE_PX);
      }
    }
  });

  it("the drawn shapes are centred more tightly than that: ▲'s and ★'s box centre and centroid each within 1.2 px", () => {
    for (const s of Object.values(MARK_SHAPES)) {
      const html = `<svg data-mark-glyph width="${s.size}" height="${s.size}" viewBox="0 0 ${s.size} ${s.size}"><polygon points="${s.points}"/></svg>`;
      for (const c of glyphCentres(html, s.size)) expect(Math.hypot(c.x - s.size / 2, c.y - s.size / 2)).toBeLessThanOrEqual(1.2);
    }
  });

  it("every label is out of the flow (absolutely positioned) and no glyph is a text character (no ▲ or ★ typed)", () => {
    for (const kind of KINDS) {
      const { html } = markGlyph(sample(kind));
      const labels = [...html.matchAll(/<div data-mark-label style="([^"]*)"/g)];
      if (kind !== "star" && kind !== "water") expect(labels.length, kind).toBe(1); // the water's number is inside its circle
      for (const l of labels) expect(l[1], kind).toMatch(/^position:absolute;/);
      expect(html).not.toMatch(/[▲★]/);
    }
    // MapLibre's default anchor puts the element's centre on the point: the marks' markers set no anchor and no offset.
    const src = readFileSync("app/render/ui/training-overlay.ts", "utf8");
    expect(src).toMatch(/for \(const m of item\.marks\) markers\.push\(new maplibregl\.Marker\(\{ element: markElement\(m\) \}\)\.setLngLat\(\[m\.at\.lon, m\.at\.lat\]\)/);
    expect(src).toMatch(/const el = labelElement\(html, `width:\$\{size\}px;height:\$\{size\}px`\);/);
  });

  it("S2.2's margin holds: the lure is ≥ 100 m from the key, more than 3 px of drawing error can cover at the opening frame", () => {
    const f = key.items["training.s2.project"];
    expect(f.metres).toBe(300);
    expect(f.lureOffM).toBeGreaterThanOrEqual(100);
    const camera = trainingOpening(TRAINING); // the harness's 1000 × 680 frame; the app's at 1440 × 900 is larger, so finer
    const metresPerPx = (78_271.517 * Math.cos((camera.center[1] * Math.PI) / 180)) / 2 ** camera.zoom;
    expect(metresPerPx).toBeLessThan(5);
    expect(f.lureOffM - TOLERANCE_PX * metresPerPx).toBeGreaterThanOrEqual(100);
  });
});
