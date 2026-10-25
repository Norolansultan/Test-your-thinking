/**
 * The map training's drawings (researcher decision 25 Oct 2026; replaces the map-reading pretest's overlay): the neutral extract
 * (Kaitajärvi, `content/pretest/map-training.json`, built by `tools/review/map-training.ts`) with what each task shows, in the
 * simulation's own symbology where one exists —
 *
 * - the road codes of the live map's overlay (`map-overlay.ts`: dark text on a white halo), never on the memory-check map;
 * - the TAK shell's scale bar (a bracket under its length, on a dark card, bottom left) and a north arrow;
 * - a fire as the live map draws one (`fire-theme.json`: the burnt fill, the red uncontained edge with its outside ticks, the
 *   head's glow) with the time it was mapped;
 * - a unit as the TAK shell draws one (its MIL-STD-2525 friendly ground-vehicle symbol, `tak-symbols.ts`, and the call sign under
 *   it in the own-forces hue);
 * - the task's marks (a red dot with its letter in a white ring; the fill points blue; ★ the pump);
 * - in the feedback, the right answer (a green ring, or the drawing that explains it) beside the participant's own mark (blue, as
 *   the practice feedback draws it).
 *
 * Pure: strings of SVG elements in the extract's own pixels (4 m each, origin at its north-west corner), the same on the
 * participant's screen (`MapTrainingScreen`), in the play harness's image and in the key checkers' preview. The memory-check map
 * (`phase: "answer"` of the memory task) is the plain tile with the scale bar only, as the freeze map is the plain basemap.
 */

import theme from "./fire-theme.json" with { type: "json" };
import type { MapTrainingSpec, Pt, TrainingAnswer, TrainingFire, TrainingMark, TrainingPhase, TrainingTask } from "../../session/map-training-spec.js";
import { isPointTask } from "../../session/map-training-spec.js";
import { sidcOf } from "../../tak/symbols.js";
import { symbolSvg } from "./tak/tak-symbols.js";
import { TAK } from "./tak/theme.js";
import type { Lang } from "../../i18n/lang.js";
import { MAP_TRAINING_TEXT } from "../../i18n/map-training-texts.js";

const INK = "#1c1b19";
const HALO = "paint-order:stroke;stroke:#ffffff;stroke-width:3px;stroke-linejoin:round";
/** The right answer (a ring) and the participant's mark (a dot, the practice feedback's blue). */
export const KEY_COLOUR = "#0b8043";
export const MARK_COLOUR = "#1a73e8";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const pts = (ps: readonly Pt[]) => ps.map((p) => `${p.x},${p.y}`).join(" ");

/** The tile clipped to the extract (`clipId` unique per document). */
export function extractImage(spec: MapTrainingSpec, tileHref: string, clipId = "training-extract"): string {
  const { size, tileX0, tileY0, tilePx } = spec.crop;
  return `<defs><clipPath id="${clipId}"><rect x="0" y="0" width="${size}" height="${size}"/></clipPath></defs>` +
    `<rect x="0" y="0" width="${size}" height="${size}" fill="#f4f1ea"/>` +
    `<image href="${esc(tileHref)}" x="${-tileX0}" y="${-tileY0}" width="${tilePx}" height="${tilePx}" clip-path="url(#${clipId})" preserveAspectRatio="none"/>`;
}

/** The road codes, as the live map's overlay draws R1–R3 (11 px, bold, a white halo). */
export function roadLabelsMarkup(spec: MapTrainingSpec): string {
  return spec.roadLabels.map((l) => `<text x="${l.x}" y="${l.y + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="${INK}" style="${HALO}">${esc(l.road)}</text>`).join("");
}

/** The boxes the scale bar's card and the north arrow cover (extract px): no mark, fire or label may sit under them. */
export function chromeBoxes(spec: Pick<MapTrainingSpec, "crop" | "scaleBarMetres">): readonly { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }[] {
  const { size, metresPerPixel } = spec.crop;
  return [{ x0: 10, y0: size - 46, x1: 28 + spec.scaleBarMetres / metresPerPixel, y1: size - 10 }, { x0: size - 34, y0: 18, x1: size - 14, y1: 64 }];
}

/** The TAK shell's scale bar (bottom left: the length over a bracket, on a dark card) and a north arrow (top right). */
export function scaleBarMarkup(spec: MapTrainingSpec): string {
  const { size, metresPerPixel } = spec.crop;
  const bar = spec.scaleBarMetres / metresPerPixel, x = 18, y = size - 16;
  return `<rect x="10" y="${y - 30}" width="${bar + 18}" height="36" rx="4" fill="#0d1114" fill-opacity="0.9" stroke="${TAK.panelBorder}"/>` +
    `<text x="${x}" y="${y - 14}" font-size="11" font-family="${TAK.mono}" fill="${TAK.text}">${spec.scaleBarMetres} m</text>` +
    `<path d="M${x} ${y - 7} V${y} H${x + bar} V${y - 7}" fill="none" stroke="${TAK.text}" stroke-width="2"/>` +
    `<g transform="translate(${size - 24},40)"><path d="M0 -18 L7 6 L0 1 L-7 6 Z" fill="${INK}" stroke="#ffffff" stroke-width="1.2"/><text x="0" y="20" text-anchor="middle" font-size="12" font-weight="700" fill="${INK}" style="${HALO}">N</text></g>`;
}

function markMarkup(m: TrainingMark): string {
  const colour = m.kind === "water" ? "#1a5fb4" : "#b3261e";
  if (m.kind === "star") {
    return `<text x="${m.x}" y="${m.y + 8}" text-anchor="middle" font-size="24" fill="#b3261e" style="${HALO}">★</text>`;
  }
  return `<circle cx="${m.x}" cy="${m.y}" r="3.4" fill="${colour}" stroke="#ffffff" stroke-width="1.2"/>` +
    `<circle cx="${m.x + 13}" cy="${m.y - 13}" r="10" fill="#ffffff" stroke="${colour}" stroke-width="1.8"/>` +
    `<text x="${m.x + 13}" y="${m.y - 8.5}" text-anchor="middle" font-size="13" font-weight="800" fill="${colour}">${esc(m.label)}</text>`;
}

/** A fire as the live map draws the current edge: burnt fill, the head's glow, the outside ticks, the red edge; its mapped time. */
export function fireMarkup(fire: TrainingFire, label: string): string {
  const ring = pts(fire.polygon), u = theme.uncontained, g = theme.headGlow;
  // The ticks: a dashed stroke as wide as the edge and a tick on each side, masked to the outside (`tickSide` "outside").
  return `<defs><filter id="training-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${g.blurPx / 2}"/></filter>` +
    `<mask id="training-outside" maskUnits="userSpaceOnUse" x="-1000" y="-1000" width="3000" height="3000"><rect x="-1000" y="-1000" width="3000" height="3000" fill="#ffffff"/><polygon points="${ring}" fill="#000000"/></mask></defs>` +
    `<circle cx="${fire.head.x}" cy="${fire.head.y}" r="${g.widthPx * 0.9}" fill="${g.color}" opacity="${g.opacity}" filter="url(#training-glow)"/>` +
    `<polygon points="${ring}" fill="none" stroke="${u.color}" stroke-width="${2 * u.tickLengthPx + u.widthPx}" stroke-dasharray="${u.tickWidthPx} ${u.tickSpacingPx - u.tickWidthPx}" mask="url(#training-outside)"/>` +
    `<polygon points="${ring}" fill="${theme.burnt.color}" fill-opacity="${theme.burnt.opacity}" stroke="none"/>` +
    `<polygon points="${ring}" fill="none" stroke="${u.color}" stroke-width="${u.widthPx}" stroke-linejoin="round"/>` +
    `<text x="${fire.label.x}" y="${fire.label.y}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${theme.past.labelColor}" style="${HALO}">${esc(label)}</text>`;
}

/** The fire's head at a reported time: a red dot with a white ring and the clock beside it. */
function headPointMarkup(p: Pt, clock: string, colour = theme.uncontained.color): string {
  return `<circle cx="${p.x}" cy="${p.y}" r="5.5" fill="${colour}" stroke="#ffffff" stroke-width="2"/>` +
    `<text x="${p.x + 9}" y="${p.y - 7}" font-size="12" font-weight="700" fill="${colour}" style="${HALO}">${esc(clock)}</text>`;
}

/** A unit as the TAK shell draws it: the 2525 friendly ground vehicle and its call sign under it. */
export function unitMarkup(unit: { readonly callsign: string; readonly x: number; readonly y: number }): string {
  const w = 34, h = 25;
  const symbol = symbolSvg(sidcOf(unit.callsign), 24, unit.callsign).replace('width="100%" height="100%"', `x="${unit.x - w / 2}" y="${unit.y - h / 2}" width="${w}" height="${h}"`);
  return symbol +
    `<rect x="${unit.x - 17}" y="${unit.y + h / 2 + 1}" width="34" height="13" rx="2" fill="#12151a" fill-opacity="0.8" stroke="#ffffff" stroke-opacity="0.7"/>` +
    `<text x="${unit.x}" y="${unit.y + h / 2 + 11}" text-anchor="middle" font-size="10.5" font-weight="600" font-family="monospace" fill="${TAK.own}">${esc(unit.callsign)}</text>`;
}

/** What a task's map shows before its answer (`study`: the memory task's unit; `answer`: its marks, its fire, the head point). */
export function taskMarkup(spec: MapTrainingSpec, task: TrainingTask, phase: TrainingPhase, lang: Lang): string {
  const out: string[] = [];
  const mapped = (f: TrainingFire) => MAP_TRAINING_TEXT[lang].mapped(f.mappedAt);
  if (task.kind === "memory") {
    if (phase === "study") out.push(roadLabelsMarkup(spec), unitMarkup(task.unit));
    return out.join(""); // the memory-check map: the plain tile (and the scale bar), no labels, no unit
  }
  out.push(roadLabelsMarkup(spec));
  if (task.kind === "now" || task.kind === "project") out.push(fireMarkup(task.fire, mapped(task.fire)));
  if (task.kind === "project") out.push(headPointMarkup(task.headAt, task.fromClock));
  for (const m of task.marks) out.push(markMarkup(m));
  return out.join("");
}

/** The participant's mark: a blue dot with a white ring. */
export function answerDotMarkup(p: Pt): string {
  return `<circle cx="${p.x}" cy="${p.y}" r="6" fill="${MARK_COLOUR}" stroke="#ffffff" stroke-width="2"/>`;
}

/** The right place: a green ring on a white casing (with a centre dot unless it rings a symbol). */
function keyRing(p: Pt, r = 11, dot = true): string {
  return `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="none" stroke="#ffffff" stroke-width="5"/><circle cx="${p.x}" cy="${p.y}" r="${r}" fill="none" stroke="${KEY_COLOUR}" stroke-width="3"/>` +
    (dot ? `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="${KEY_COLOUR}"/>` : "");
}

/** The participant's mark joined to the right place (the distance is in the feedback's text, not on the map). */
function errorLine(from: Pt, to: Pt): string {
  return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${MARK_COLOUR}" stroke-width="2" stroke-dasharray="5 4"/>`;
}

function routeLine(route: readonly Pt[], colour: string, dashed: boolean): string {
  return `<polyline points="${pts(route)}" fill="none" stroke="#ffffff" stroke-width="7" stroke-linejoin="round" stroke-opacity="0.8"/>` +
    `<polyline points="${pts(route)}" fill="none" stroke="${colour}" stroke-width="4" stroke-linejoin="round"${dashed ? ' stroke-dasharray="8 6"' : ""}/>`;
}

const kmText = (km: number, lang: Lang) => `${lang === "fi" ? km.toFixed(1).replace(".", ",") : km.toFixed(1)} km`;

/**
 * The feedback's drawing: the right answer and why (the junction ringed; the measured line; the slope's rise; both road routes with
 * their lengths; the head at the road at the report's time; the projected head; the unit where it was) and the participant's own
 * point answer with the distance between them. Drawn over `taskMarkup` (the memory task: over the blank map).
 */
export function feedbackMarkup(spec: MapTrainingSpec, task: TrainingTask, answer: TrainingAnswer | null, lang: Lang): string {
  const mark = answer && "point" in answer ? answer.point : null;
  const out: string[] = [];
  switch (task.kind) {
    case "place": out.push(keyRing(task.key)); break;
    case "measure": {
      const a = task.marks[0]!;
      const mid = { x: (a.x + task.foot.x) / 2, y: (a.y + task.foot.y) / 2 };
      out.push(`<line x1="${a.x}" y1="${a.y}" x2="${task.foot.x}" y2="${task.foot.y}" stroke="#ffffff" stroke-width="6"/><line x1="${a.x}" y1="${a.y}" x2="${task.foot.x}" y2="${task.foot.y}" stroke="${TAK.rb}" stroke-width="3"/>`,
        `<circle cx="${task.foot.x}" cy="${task.foot.y}" r="4" fill="${TAK.rb}" stroke="${INK}" stroke-width="1.2"/>`,
        `<text x="${mid.x + 8}" y="${mid.y + 4}" font-size="13" font-weight="800" fill="${INK}" style="${HALO}">${task.metres} m</text>`);
      break;
    }
    case "slope": {
      const [a, b, c] = [task.marks[0]!, task.marks[1]!, task.marks[2]!];
      const len = Math.hypot(b.x - a.x, b.y - a.y), tip = { x: b.x - ((b.x - a.x) * 9) / len, y: b.y - ((b.y - a.y) * 9) / len }; // stops short of B's dot
      out.push(`<defs><marker id="training-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${KEY_COLOUR}"/></marker></defs>`,
        `<line x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" stroke="#5f646b" stroke-width="2" stroke-dasharray="4 4"/>`,
        `<line x1="${a.x}" y1="${a.y}" x2="${tip.x}" y2="${tip.y}" stroke="${KEY_COLOUR}" stroke-width="4" marker-end="url(#training-arrow)"/>`,
        ...task.marks.map(markMarkup), // the letters over the arrows
        `<text x="${b.x}" y="${b.y + 22}" text-anchor="middle" font-size="12" font-weight="700" fill="${KEY_COLOUR}" style="${HALO}">+${task.riseB.toFixed(0)} m</text>`);
      break;
    }
    case "water": {
      const key = task.key === "fill_1" ? 0 : 1;
      task.routes.forEach((r, i) => { if (i !== key) out.push(routeLine(r, "#8a8f96", true)); });
      out.push(routeLine(task.routes[key]!, KEY_COLOUR, false), roadLabelsMarkup(spec), ...task.marks.map(markMarkup)); // the codes and marks over the routes
      // Each fill point's road distance beside its number (to its left near the extract's east edge).
      task.marks.filter((m) => m.kind === "water").forEach((m, i) => {
        const left = m.x > spec.crop.size - 80;
        out.push(`<text x="${left ? m.x - 6 : m.x + 26}" y="${left ? m.y - 18 : m.y - 8}" text-anchor="${left ? "end" : "start"}" font-size="12" font-weight="700" fill="${i === key ? KEY_COLOUR : "#5f646b"}" style="${HALO}">${kmText(task.roadKm[i]!, lang)}</text>`);
      });
      break;
    }
    case "now": out.push(headPointMarkup(task.headAt, task.report.clock), keyRing(task.headAt)); break;
    case "project": {
      out.push(`<line x1="${task.headAt.x}" y1="${task.headAt.y}" x2="${task.key.x}" y2="${task.key.y}" stroke="${theme.uncontained.color}" stroke-width="2.5" stroke-dasharray="6 4"/>`,
        headPointMarkup(task.key, task.toClock), keyRing(task.key));
      break;
    }
    case "memory": out.push(unitMarkup(task.unit), keyRing(task.key, 21, false)); break;
  }
  const key = isPointTask(task) ? task.key : null;
  if (mark) out.push(...(key ? [errorLine(mark, key)] : []), answerDotMarkup(mark));
  return out.join("");
}

/**
 * A whole task's picture as one SVG document (the play harness's image, the key checkers' preview): the tile, then what the phase
 * shows, then the scale bar. `grid`: a labelled pixel grid every 50 px over it (the harness only, so a player can answer with x,y).
 */
export function trainingSvg(spec: MapTrainingSpec, task: TrainingTask, phase: TrainingPhase, tileHref: string, lang: Lang, answer: TrainingAnswer | null, opts: { readonly grid?: boolean } = {}): string {
  const { size } = spec.crop, m = opts.grid ? 28 : 0;
  const blank = task.kind === "memory" && phase !== "study";
  const grid: string[] = [];
  if (opts.grid) {
    for (let v = 0; v <= size; v += 50) {
      grid.push(`<line x1="${v}" y1="0" x2="${v}" y2="${size}" stroke="#d000d0" stroke-opacity="${v % 100 === 0 ? 0.55 : 0.25}" stroke-width="0.8"/>`, `<line x1="0" y1="${v}" x2="${size}" y2="${v}" stroke="#d000d0" stroke-opacity="${v % 100 === 0 ? 0.55 : 0.25}" stroke-width="0.8"/>`);
      if (v % 100 === 0) grid.push(`<text x="${v}" y="-9" font-size="11" text-anchor="middle" fill="${INK}">${v}</text>`, `<text x="-6" y="${v + 4}" font-size="11" text-anchor="end" fill="${INK}">${v}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-m} ${-m} ${size + 2 * m} ${size + 2 * m}" width="${size + 2 * m}" height="${size + 2 * m}" role="img">` +
    `<rect x="${-m}" y="${-m}" width="${size + 2 * m}" height="${size + 2 * m}" fill="#ffffff"/>` + extractImage(spec, tileHref) +
    (blank ? "" : taskMarkup(spec, task, phase, lang)) + (phase === "feedback" ? feedbackMarkup(spec, task, answer, lang) : "") +
    scaleBarMarkup(spec) + grid.join("") + `</svg>`;
}
