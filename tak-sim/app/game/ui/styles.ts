/**
 * Game mode screen: the dark TAK look (the study's TAK shell colours, `render/ui/tak/theme.ts`) and the few CSS rules
 * the DOM markers and the touch layout need, injected once under the `gm-` prefix.
 */

import { TAK } from "../../render/ui/tak/theme.js";

export { TAK };

/** Game-only accents. */
export const GM = {
  fire: "#ff7a1a",
  danger: "#e53935",
  ok: "#4caf50",
  select: "#ffd400",
  water: "#4fb3ff",
  energy: "#ffc14d",
  forecast20: "#ff8a80",
  forecast40: "#ffd0cc",
  hose: "#2f8fe8",
  fireBreak: "#a0682e",
} as const;

const CSS = `
.gm-root { position: fixed; inset: 0; z-index: 1000; background: ${TAK.panel}; color: ${TAK.text}; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; overflow: hidden; }
.gm-root button { font-family: inherit; }
.gm-root button:focus-visible { outline: 2px solid ${TAK.accent}; outline-offset: 1px; }
.gm-btn { min-height: 40px; padding: 8px 16px; border-radius: ${TAK.radius}px; border: 1px solid ${TAK.panelBorder}; background: ${TAK.panelRaised}; color: ${TAK.text}; font-size: 14px; font-weight: 600; cursor: pointer; }
.gm-btn:hover { background: ${TAK.rowHover}; }
.gm-btn.primary { background: ${TAK.accentDim}; border-color: ${TAK.accent}; color: #fff; }
.gm-btn.primary:hover { background: ${TAK.accent}; color: ${TAK.accentInk}; }
.gm-scroll { overflow-y: auto; -webkit-overflow-scrolling: touch; }
.gm-marker { cursor: pointer; }
.gm-unit { width: 44px; height: 44px; z-index: 5; } /* position stays MapLibre's (absolute): the children are laid out against it */
.gm-unit.sel { z-index: 6; }
.gm-place, .gm-water, .gm-cp { z-index: 2; }
.gm-fclabel { z-index: 1; }
.gm-unit .ring { position: absolute; left: 5px; top: 5px; width: 34px; height: 34px; box-sizing: border-box; border-radius: 50%; border: 3px solid #d5dde2; background: rgba(13,17,20,.62); display: flex; align-items: center; justify-content: center; transition: box-shadow .15s; }
.gm-unit .sym { width: 24px; height: 18px; }
.gm-unit.sel .ring { box-shadow: 0 0 0 3px ${GM.select}, 0 0 14px 5px rgba(255,212,0,.55); }
.gm-unit.work .ring { animation: gm-pulse 1.4s ease-in-out infinite; }
.gm-unit.out { opacity: .6; }
.gm-unit.dead .ring::after { content: ""; position: absolute; inset: 3px; background: linear-gradient(45deg, transparent 45%, ${GM.danger} 45%, ${GM.danger} 55%, transparent 55%), linear-gradient(-45deg, transparent 45%, ${GM.danger} 45%, ${GM.danger} 55%, transparent 55%); }
.gm-unit .bars { position: absolute; left: 9px; right: 9px; top: 38px; display: flex; flex-direction: column; gap: 1px; }
.gm-unit .bar { height: 3px; background: rgba(0,0,0,.7); border-radius: 2px; overflow: hidden; }
.gm-unit .bar > i { display: block; height: 100%; }
.gm-unit .bar.water > i { background: ${GM.water}; }
.gm-unit .bar.energy > i { background: ${GM.energy}; }
.gm-unit .cs { position: absolute; top: 46px; left: 50%; transform: translateX(-50%); font: 700 11px ${TAK.mono}; color: #fff; background: rgba(13,17,20,.78); padding: 0 4px; border-radius: 2px; white-space: nowrap; pointer-events: none; }
.gm-unit.sel .cs { color: ${GM.select}; }
@keyframes gm-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
.gm-place { display: flex; align-items: center; gap: 4px; padding: 2px 6px 2px 3px; border-radius: 10px; background: rgba(13,17,20,.72); border: 1px solid ${TAK.panelBorder}; font-size: 11.5px; font-weight: 600; white-space: nowrap; color: #fff; }
.gm-place.prot { border-color: ${TAK.accent}; box-shadow: 0 0 0 1px ${TAK.accent}; }
.gm-water { display: flex; align-items: center; gap: 3px; font-size: 11px; color: #d8ecff; text-shadow: 0 0 3px #000, 0 0 2px #000; white-space: nowrap; }
.gm-water .nm { opacity: .9; }
.gm-cp .sym { display: block; width: 30px; height: 22px; }
.gm-fclabel { font: 700 11px ${TAK.mono}; color: #1c1b19; background: ${GM.forecast20}; padding: 1px 5px; border-radius: 3px; white-space: nowrap; pointer-events: none; }
.gm-fclabel.h40 { background: ${GM.forecast40}; }
.gm-map.targeting .maplibregl-canvas-container { cursor: crosshair; }
.gm-map.targeting .gm-marker { cursor: crosshair; }
.gm-map .maplibregl-ctrl-attrib { font-size: 10px; }
.gm-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 12px; font-size: 12px; font-weight: 600; border: 1px solid ${TAK.panelBorder}; background: ${TAK.row}; white-space: nowrap; }
.gm-kbd { font: 700 10px ${TAK.mono}; padding: 1px 4px; border-radius: 3px; border: 1px solid #5c6b75; color: ${TAK.textDim}; }
.gm-toast { pointer-events: auto; padding: 9px 14px; border-radius: ${TAK.radius}px; background: #1b2329f2; border: 1px solid ${TAK.panelBorder}; border-left: 4px solid ${TAK.accent}; box-shadow: 0 4px 16px #000a; font-size: 13px; max-width: min(520px, calc(100vw - 32px)); }
.gm-toast.bad { border-left-color: ${GM.danger}; }
.gm-toast.urgent { border-left-color: ${GM.fire}; }
.gm-hud-stats { order: 2; flex: 1; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; row-gap: 4px; min-width: 0; }
.gm-hud-quit { order: 3; margin-left: auto; }
.gm-orderbar { display: flex; align-items: stretch; gap: 8px; }
.gm-orderbar .who { display: flex; align-items: center; gap: 8px; padding: 0 6px 0 2px; flex-shrink: 0; border-right: 1px solid ${TAK.panelBorder}; }
.gm-orderbar .cmds { display: flex; gap: 4px; flex-shrink: 0; }
@media (max-width: 700px) {
  .gm-hide-narrow { display: none !important; }
  .gm-hud-quit { order: 1; }
  .gm-hud-stats { flex-basis: 100%; gap: 7px; justify-content: space-between; }
  .gm-orderbar { flex-direction: column; gap: 4px; width: 100%; box-sizing: border-box; }
  .gm-orderbar .who { border-right: none; border-bottom: 1px solid ${TAK.panelBorder}; padding: 0 2px 4px; }
  .gm-orderbar .cmds { overflow-x: auto; flex-shrink: 1; }
}
@media (min-width: 701px) {
  .gm-only-narrow { display: none !important; }
}
`;

let injected = false;

/** Adds the game's stylesheet to the document once. */
export function injectGameCss(): void {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const el = document.createElement("style");
  el.dataset["game"] = "1";
  el.textContent = CSS;
  document.head.appendChild(el);
}
