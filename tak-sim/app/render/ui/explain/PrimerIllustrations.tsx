/**
 * SPEC/35 §3 item 1: the primer's schematic illustrations, drawn in code — never the study map, never the scenario's
 * places. One per page: the commander and the units; the unit types; the fire's shape (head, flanks, heel, wind); anchoring
 * and working along the flanks; the water shuttle; an escape route and a power line's 15 m band; the screen's parts.
 * Labels in the session language (DRAFT). Inline SVG, no request (I3).
 */

import type { JSX } from "preact";
import type { Lang } from "../../../i18n/lang.js";
import { UNIT_ICON_SVG, type UnitKind } from "../unit-icons.js";

const LABELS = {
  fi: {
    cp: "Johtopaikka", you: "Sinä", plan: "Suunnitelma", units: "Yksiköt", drone: "Drooni",
    engine: "Pelastusyksikkö", tanker: "Säiliöauto", forest: "Maastopaloyksikkö", heli: "Helikopteri", robot: "Letkurobotti",
    head: "Kärki", flank: "Sivusta", heel: "Kanta", wind: "Tuuli", origin: "Syttymäkohta",
    anchor: "Ankkuri", road: "Tie", water: "Vesipiste", shuttle: "Vesiajo", basin: "Allas", hose: "Letkulinja", fire: "Palo",
    line: "Sähkölinja", band: "15 m", escape: "Perääntymistie", safe: "Turva-alue", burnt: "Palanut alue",
    map: "Kartta", log: "Viestiloki", tools: "Haku", decision: "Suunnitelma", status: "Kello ja jakso", legend: "Selite",
  },
  en: {
    cp: "Command post", you: "You", plan: "Plan", units: "Units", drone: "Drone",
    engine: "Rescue unit", tanker: "Tanker", forest: "Forest-fire unit", heli: "Helicopter", robot: "Hose robot",
    head: "Head", flank: "Flank", heel: "Heel", wind: "Wind", origin: "Point of origin",
    anchor: "Anchor", road: "Road", water: "Water point", shuttle: "Water shuttle", basin: "Basin", hose: "Hose line", fire: "Fire",
    line: "Power line", band: "15 m", escape: "Escape route", safe: "Safety zone", burnt: "Burnt area",
    map: "Map", log: "Message log", tools: "Search", decision: "Plan", status: "Clock and period", legend: "Legend",
  },
} as const;

type L = (typeof LABELS)[Lang];

const OWN = "#4fb3ff";
const FIRE = "#e4572e";
const FIRE_SOFT = "#f4a261";
const INK = "#e8eaed";
const DIM = "#9aa0a6";
const WATER = "#5aa9e6";

const frame = (title: string, body: JSX.Element) => (
  <svg viewBox="0 0 320 180" role="img" aria-label={title} style={{ width: "100%", maxWidth: 480, height: "auto", display: "block", margin: "0 auto" }}
    font-family="system-ui, sans-serif" font-size="11">
    <rect x="0.5" y="0.5" width="319" height="179" rx="8" fill="#151a1f" stroke="#33383e" />
    {body}
  </svg>
);

const text = (x: number, y: number, s: string, opts: { anchor?: "start" | "middle" | "end"; color?: string; weight?: number } = {}) => (
  <text x={x} y={y} text-anchor={opts.anchor ?? "middle"} fill={opts.color ?? INK} font-weight={opts.weight ?? 400}>{s}</text>
);

const arrowHead = (id: string, color: string) => (
  <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0 0 10 5 0 10z" fill={color} />
  </marker>
);

/** A unit glyph (the map's own line art) in a frame, at its centre. */
const unit = (kind: UnitKind, cx: number, cy: number, size = 26) => (
  <g>
    <rect x={cx - size / 2} y={cy - size / 2} width={size} height={size} rx={4} fill="#12151a" stroke={OWN} stroke-width={1.6} />
    <foreignObject x={cx - size / 2 + 3} y={cy - size / 2 + 3} width={size - 6} height={size - 6}>
      <div style={{ width: "100%", height: "100%", color: OWN }} dangerouslySetInnerHTML={{ __html: UNIT_ICON_SVG[kind] }} />
    </foreignObject>
  </g>
);

/** The fire's shape: an egg pointing east (downwind), its head at the east end. */
const FIRE_PATH = "M70 90 C70 62 120 50 175 56 C220 61 250 76 255 90 C250 104 220 119 175 124 C120 130 70 118 70 90Z";

function commander(t: L) {
  return frame(t.cp, (
    <>
      <defs>{arrowHead("pc-a", DIM)}</defs>
      <rect x="20" y="60" width="96" height="60" rx="6" fill="#1f2a38" stroke="#8ab4f8" />
      {text(68, 82, t.cp, { weight: 700 })}
      {text(68, 100, t.you, { color: "#dbe7fb" })}
      <rect x="40" y="128" width="56" height="34" rx="3" fill="#f4f1ec" />
      {[136, 143, 150].map((y) => <line key={y} x1="46" y1={y} x2="90" y2={y} stroke="#1c1b19" stroke-width="1.5" />)}
      {text(68, 176, t.plan, { color: DIM })}
      {[[230, 40], [250, 90], [230, 140]].map(([x, y]) => <line key={`${x}-${y}`} x1="118" y1="90" x2={x! - 18} y2={y} stroke={DIM} stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#pc-a)" />)}
      {unit("truck", 230, 40)}
      {unit("truck", 250, 90)}
      {unit("drone", 230, 140)}
      {text(282, 94, t.units, { anchor: "start", color: DIM })}
    </>
  ));
}

function units(t: L) {
  const items: [UnitKind, string, string][] = [["truck", "EK", t.engine], ["truck", "EK", t.tanker], ["truck", "EK", t.forest], ["drone", "DR", t.drone], ["helicopter", "HELI", t.heli]];
  return frame(t.units, (
    <>
      {items.map(([k, cs, label], i) => {
        const x = 34 + i * 63;
        return (
          <g key={label}>
            {unit(k, x, 70, 36)}
            {text(x, 108, cs, { weight: 700 })}
            {label.split(" ").map((w, j) => <g key={j}>{text(x, 126 + j * 13, w, { color: DIM })}</g>)}
          </g>
        );
      })}
    </>
  ));
}

function fireShape(t: L) {
  return frame(t.fire, (
    <>
      <defs>{arrowHead("pf-w", WATER)}{arrowHead("pf-d", DIM)}</defs>
      <line x1="16" y1="28" x2="76" y2="28" stroke={WATER} stroke-width="3" marker-end="url(#pf-w)" />
      {text(46, 18, t.wind, { color: WATER, weight: 700 })}
      <path d={FIRE_PATH} fill="#5a3a2e" stroke={FIRE} stroke-width="3" />
      <path d="M232 70 C250 78 256 86 255 90 C254 96 248 103 232 110" fill="none" stroke={FIRE_SOFT} stroke-width="7" opacity="0.8" />
      <circle cx="96" cy="90" r="4" fill={INK} />
      {text(96, 82, t.origin, { color: DIM })}
      {text(286, 94, t.head, { weight: 700, color: FIRE_SOFT })}
      {text(170, 44, t.flank, { weight: 700 })}
      {text(170, 145, t.flank, { weight: 700 })}
      {text(40, 94, t.heel, { weight: 700 })}
      <line x1="170" y1="48" x2="170" y2="56" stroke={DIM} />
      <line x1="170" y1="133" x2="170" y2="124" stroke={DIM} />
    </>
  ));
}

function anchorFlank(t: L) {
  return frame(t.anchor, (
    <>
      <defs>{arrowHead("pa-a", OWN)}</defs>
      <rect x="40" y="20" width="14" height="150" fill="#3a3a3a" />
      <line x1="47" y1="20" x2="47" y2="170" stroke="#fff4d6" stroke-width="1.2" stroke-dasharray="6 6" />
      {text(47, 14, t.road, { color: DIM })}
      <path d={FIRE_PATH} fill="#5a3a2e" stroke={FIRE} stroke-width="3" />
      <circle cx="62" cy="90" r="9" fill="#12151a" stroke={OWN} stroke-width="2" />
      <path d="M62 84v12M57 92c1 3 3 4 5 4s4-1 5-4M58 86h8" stroke={OWN} stroke-width="1.6" fill="none" />
      {text(62, 116, t.anchor, { weight: 700, color: OWN })}
      <path d="M70 82 C100 58 150 46 205 52" fill="none" stroke={OWN} stroke-width="2.5" marker-end="url(#pa-a)" />
      <path d="M70 98 C100 122 150 134 205 128" fill="none" stroke={OWN} stroke-width="2.5" marker-end="url(#pa-a)" />
      {text(282, 94, t.head, { weight: 700, color: FIRE_SOFT })}
    </>
  ));
}

function water(t: L) {
  return frame(t.shuttle, (
    <>
      <defs>{arrowHead("pw-a", INK)}</defs>
      <ellipse cx="52" cy="96" rx="40" ry="26" fill={WATER} opacity="0.75" />
      {text(52, 140, t.water, { color: DIM })}
      <path d="M100 82 H190" stroke={INK} stroke-width="2" marker-end="url(#pw-a)" />
      <path d="M190 110 H100" stroke={INK} stroke-width="2" marker-end="url(#pw-a)" />
      {unit("truck", 145, 64, 24)}
      {text(145, 132, t.shuttle, { weight: 700 })}
      <rect x="198" y="80" width="34" height="30" rx="4" fill="none" stroke={WATER} stroke-width="2.5" />
      <rect x="200" y="92" width="30" height="16" fill={WATER} opacity="0.6" />
      {text(215, 126, t.basin, { color: DIM })}
      <path d="M232 95 C250 95 255 70 278 66" fill="none" stroke={OWN} stroke-width="2.5" />
      {text(262, 96, t.hose, { color: DIM, anchor: "start" })}
      <path d="M282 40 C300 46 306 62 300 78 C294 92 280 88 278 70 C276 56 272 44 282 40Z" fill={FIRE} opacity="0.85" />
    </>
  ));
}

function safety(t: L) {
  return frame(t.escape, (
    <>
      <defs>{arrowHead("ps-a", "#7bd88f")}</defs>
      <rect x="196" y="16" width="44" height="150" fill="#f6c26b" opacity="0.18" />
      <line x1="218" y1="16" x2="218" y2="166" stroke="#c9c3ba" stroke-width="1.5" />
      {[30, 90, 150].map((y) => <path key={y} d={`M210 ${y}h16M212 ${y + 6}h12`} stroke="#c9c3ba" stroke-width="1.5" />)}
      {text(218, 176, `${t.line} · ${t.band}`, { color: DIM })}
      <line x1="196" y1="60" x2="218" y2="60" stroke="#f6c26b" stroke-width="1" />
      {text(207, 56, t.band, { color: "#f6c26b" })}
      <path d="M20 30 C50 20 90 30 110 46 C116 70 100 86 70 84 C40 82 20 60 20 30Z" fill="#5a3a2e" stroke={FIRE} stroke-width="2.5" />
      {unit("truck", 120, 104, 24)}
      <path d="M132 112 C150 132 150 150 136 160" fill="none" stroke="#7bd88f" stroke-width="2.5" stroke-dasharray="5 3" marker-end="url(#ps-a)" />
      {text(170, 140, t.escape, { color: "#7bd88f", anchor: "start" })}
      <rect x="40" y="138" width="80" height="30" rx="4" fill="#2d4a32" stroke="#7bd88f" />
      {text(80, 157, t.safe, { color: "#c9f0d1" })}
      {text(64, 60, t.burnt, { color: DIM })}
    </>
  ));
}

function screen(t: L) {
  const box = (x: number, y: number, w: number, h: number, label: string, fill = "#1f2a38") => (
    <g><rect x={x} y={y} width={w} height={h} rx="4" fill={fill} stroke="#8ab4f8" />{text(x + w / 2, y + h / 2 + 4, label)}</g>
  );
  return frame(t.map, (
    <>
      {box(12, 10, 296, 20, t.status, "#20242a")}
      {box(12, 36, 206, 100, t.map, "#22302a")}
      <rect x="18" y="104" width="46" height="26" rx="3" fill="#f4f1ec" />
      {text(41, 121, t.legend, { color: "#1c1b19" })}
      {box(224, 36, 84, 30, t.tools)}
      {box(224, 70, 84, 104, t.log)}
      {box(12, 142, 206, 32, t.decision, "#20242a")}
    </>
  ));
}

const DRAW: Readonly<Record<string, (t: L) => JSX.Element>> = {
  commander, units, fire_shape: fireShape, anchor_flank: anchorFlank, water, safety, screen,
};

export const PRIMER_ILLUSTRATIONS: readonly string[] = ["commander", "units", "fire_shape", "anchor_flank", "water", "safety", "screen"];

export function PrimerIllustration({ id, lang }: { readonly id: string; readonly lang: Lang }) {
  const draw = DRAW[id];
  return draw ? draw(LABELS[lang]) : null;
}
