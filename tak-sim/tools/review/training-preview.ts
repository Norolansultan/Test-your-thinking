/**
 * The key checkers' preview of the training incident (SPEC/08 (bp) §bp.9, `docs/audits/2026-10-26-training/preview.svg`): one panel
 * per item, its feedback picture over the Finnish tile — the 400 m band around the 20 kV line (hatched red), the roads the build
 * uses (R5–R7 cut at the band, in orange), the road codes, the item's marks, the scene's fire and unit, and what the feedback draws
 * (the right place in a green ring, the measured line in yellow, the route in blue) — with the key and its figures under the title.
 * The choice items without a map list their options in order, the key starred. Deterministic; drawn from the built spec.
 */

import type { LatLon } from "../../app/engine/primitives.js";
import { basemapPx } from "../../app/render/ui/basemap-px.js";
import type { TrainingItem, TrainingSpec } from "../../app/session/training/spec.js";
import { AREA, type Site } from "./training-site.js";

const S = AREA.size, GAP = 24, HEAD = 64, COLS = 4;
const r1 = (v: number) => Math.round(v * 10) / 10;
const px = (p: LatLon) => { const q = basemapPx(p); return { x: r1(q.x), y: r1(q.y) }; };
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pts = (ps: readonly LatLon[]) => ps.map((p) => { const q = px(p); return `${q.x},${q.y}`; }).join(" ");

function mapPanel(spec: TrainingSpec, site: Site, item: TrainingItem, i: number, href: string): string {
  const out: string[] = [];
  out.push(`<image href="${href}" x="${AREA.x0 - AREA.tileX0}" y="${AREA.y0 - AREA.tileY0}" width="${AREA.tilePx}" height="${AREA.tilePx}" preserveAspectRatio="none"/>`);
  const [a, b] = [site.line[0]!, site.line.at(-1)!];
  out.push(`<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}" stroke="url(#band-${i})" stroke-width="${2 * (400 / site.mpp)}" opacity="0.45"/>`);
  for (const n of site.named) out.push(`<polyline points="${n.piece.pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join(" ")}" fill="none" stroke="#e8820c" stroke-width="3" opacity="0.8"/>`);
  for (const l of spec.roadLabels) { const q = px(l.at); out.push(`<text x="${q.x}" y="${q.y}" font-size="13" font-weight="700" fill="#5a2d00" stroke="#fff" stroke-width="3" paint-order="stroke" text-anchor="middle">${l.road}</text>`); }
  const scene = item.memory ? null : spec.scenes[item.scene];
  if (scene && scene.perimeter.length > 0) {
    for (const g of scene.fire.burnt_area.geometry) out.push(`<polygon points="${pts(g[0]!)}" fill="#333" opacity="0.5"/>`);
    out.push(`<polygon points="${pts(scene.perimeter[0]!)}" fill="#f2a43a" fill-opacity="0.45" stroke="#d40000" stroke-width="2"/>`);
    // determinism-lint-allow: drawing order only; the SVG is a review preview
    for (const [u, at] of Object.entries(scene.unitPositions)) { const q = px(at); out.push(`<rect x="${q.x - 6}" y="${q.y - 4}" width="12" height="8" fill="#6cf" stroke="#000"/><text x="${q.x + 8}" y="${q.y + 4}" font-size="11">${u}</text>`); }
  }
  if (item.memory) { const q = px(item.memory.at); out.push(`<rect x="${q.x - 6}" y="${q.y - 4}" width="12" height="8" fill="#6cf" stroke="#000"/><text x="${q.x + 8}" y="${q.y + 4}" font-size="11">${item.memory.unit}</text>`); }
  for (const r of item.feedback.routes ?? []) out.push(`<polyline points="${pts(r)}" fill="none" stroke="#1d4ed8" stroke-width="4" opacity="0.8"/>`);
  if (item.feedback.line) out.push(`<polyline points="${pts(item.feedback.line)}" fill="none" stroke="#facc15" stroke-width="3"/>`);
  for (const m of item.marks) {
    const q = px(m.at), colour = m.kind === "head" ? "#d40000" : m.kind === "water" ? "#0369a1" : "#111";
    out.push(`<circle cx="${q.x}" cy="${q.y}" r="5" fill="${colour}"/><text x="${q.x + 7}" y="${q.y - 6}" font-size="14" font-weight="700" fill="${colour}" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(m.label)}</text>`);
  }
  for (const g of item.feedback.ring ?? []) { const q = px(g); out.push(`<circle cx="${q.x}" cy="${q.y}" r="10" fill="none" stroke="#16a34a" stroke-width="3"/>`); }
  if ("point" in item.key) { const q = px(item.key.point); out.push(`<circle cx="${q.x}" cy="${q.y}" r="2.5" fill="#16a34a"/>`); }
  const defs = `<defs><pattern id="band-${i}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#fca5a5"/><line x1="0" y1="0" x2="0" y2="8" stroke="#b91c1c" stroke-width="3"/></pattern></defs>`;
  return `<svg width="${S}" height="${S}" viewBox="${AREA.x0} ${AREA.y0} ${S} ${S}">${defs}${out.join("")}</svg>`;
}

function listPanel(item: TrainingItem): string {
  const key = "optionId" in item.key ? item.key.optionId : "";
  const lines = [`options in order (★ the key):`, ...item.options.map((o, k) => `${k + 1}. ${o.id}${o.id === key ? "  ★" : ""}`)];
  if (item.lesson) lines.push("", `lesson: ${item.lesson.questionId}`, `records: ${item.lesson.recordIds.join(", ")}`);
  if (item.source) lines.push("", `source: ${item.source}`);
  return `<rect width="${S}" height="${S}" fill="#f8fafc" stroke="#cbd5e1"/>${lines.map((l, k) => `<text x="16" y="${32 + k * 22}" font-size="16">${esc(l)}</text>`).join("")}`;
}

export function previewSvg(spec: TrainingSpec, site: Site, figures: Readonly<Record<string, unknown>>, href: string): string {
  const rows = Math.ceil(spec.items.length / COLS);
  const panels = spec.items.map((it, i) => {
    const x = (i % COLS) * (S + GAP), y = Math.floor(i / COLS) * (S + GAP + HEAD);
    const fig = JSON.stringify(figures[it.id] ?? {}).replace(/"/g, "");
    const head = [`${it.position}. ${it.id} (${it.mode}, ${it.answer})`, fig.slice(0, 96), fig.slice(96, 192)].filter((t) => t !== "");
    const title = head.map((t, k) => `<text x="${x}" y="${y + 16 + k * 16}" font-size="${k === 0 ? 15 : 11}" font-weight="${k === 0 ? 700 : 400}">${esc(t)}</text>`).join("");
    const map = it.mode === "live" || it.memory || it.id === "training.s4.map";
    const body = map ? mapPanel(spec, site, it, i, href) : listPanel(it);
    return `${title}<g transform="translate(${x} ${y + HEAD})">${body}</g>`;
  });
  const W = COLS * (S + GAP), H = rows * (S + GAP + HEAD);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${panels.join("")}</svg>\n`;
}
