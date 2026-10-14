/**
 * Game mode: the order bar under the map — the selected unit(s), the orders their kind takes (with the key for each),
 * and while targeting, what to click and how to cancel. At phone width it spans the bottom and scrolls sideways.
 */

import type { Unit } from "../contracts.js";
import type { Lang } from "../../i18n/lang.js";
import { isCasualty, statusColor, unitSymbolSvg } from "./markers.js";
import { ORDER_KEY, type OrderType, type Targeting } from "./orders.js";
import { GM, TAK } from "./styles.js";
import { clockAt, GAME_TEXT, type GameText, type TargetHintId } from "./text.js";

/** A unit's status as shown: out of action tells a casualty from a unit the region took away. */
export function statusLabel(t: GameText, u: Pick<Unit, "status" | "harm">): string {
  if (u.status !== "out_of_action") return t.status[u.status];
  return isCasualty(u) ? t.casualty : t.released;
}

/** The order a targeting mode belongs to (to light its button). */
export function activeOrder(t: Targeting): OrderType | null {
  switch (t.kind) {
    case "none": return null;
    case "point": return t.order;
    case "break_from": case "break_to": return "fire_break";
    case "water": return "refill";
    case "shuttle_water": case "shuttle_unit": return "shuttle";
    case "protect": return "protect";
  }
}

/** What the cursor hint says in a targeting mode. */
export function hintOf(t: Targeting): TargetHintId | null {
  switch (t.kind) {
    case "none": return null;
    case "point": return `point_${t.order}`;
    default: return t.kind;
  }
}

export function OrderBar({ lang, units, orders, targeting, startClockMin, onChoose, onNearestWater, onCancel, onDeselect }: {
  readonly lang: Lang;
  readonly units: readonly Unit[];
  readonly orders: readonly OrderType[];
  readonly targeting: Targeting;
  readonly startClockMin: number;
  readonly onChoose: (o: OrderType) => void;
  readonly onNearestWater: () => void;
  readonly onCancel: () => void;
  readonly onDeselect: () => void;
}) {
  const t = GAME_TEXT[lang];
  const active = activeOrder(targeting);
  const hint = hintOf(targeting);
  const one = units.length === 1 ? units[0]! : null;
  return (
    <div data-testid="game-orderbar" style={{ position: "absolute", left: 8, right: 8, bottom: 8, zIndex: 15, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, pointerEvents: "none" }}>
      {hint && (
        <div data-testid="game-target-hint" role="status" style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center", padding: "7px 12px", borderRadius: TAK.radius, background: "#1b2329f2", border: `1px solid ${GM.select}`, color: TAK.text, fontSize: 13.5, boxShadow: "0 4px 16px #000a" }}>
          <span style={{ color: GM.select, fontWeight: 700 }}>⌖</span>
          <span>{t.hint[hint]}</span>
          {(targeting.kind === "water" || targeting.kind === "shuttle_water") && (
            <button type="button" class="gm-btn" style={{ minHeight: 30, padding: "3px 10px", fontSize: 12.5 }} onClick={onNearestWater} data-testid="game-nearest-water">💧 {t.nearestWater}</button>
          )}
          <button type="button" class="gm-btn" style={{ minHeight: 30, padding: "3px 10px", fontSize: 12.5 }} onClick={onCancel}>{t.cancel} <span class="gm-kbd gm-hide-narrow">Esc</span></button>
        </div>
      )}
      <div class="gm-orderbar" style={{ pointerEvents: "auto", maxWidth: "100%", padding: 6, borderRadius: TAK.radius, background: "#0d1114ee", border: `1px solid ${TAK.panelBorder}`, boxShadow: "0 4px 18px #000b", overflowX: "auto" }}>
        <div class="who">
          {one ? (
            <>
              <span style={{ width: 30, height: 24, flex: "none", borderRadius: "50%", boxShadow: `0 0 0 2px ${statusColor(one)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ width: 22, height: 17 }} dangerouslySetInnerHTML={{ __html: unitSymbolSvg(one.kind) }} />
              </span>
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, flexShrink: 0 }}>
                <span style={{ fontFamily: TAK.mono, fontWeight: 800, fontSize: 14, color: GM.select }}>{one.callsign}</span>
                <span style={{ fontSize: 11, color: TAK.textDim, whiteSpace: "nowrap" }}>
                  {statusLabel(t, one)}
                  {one.etaS !== null && (one.status === "moving" || one.status === "en_route") ? ` · ${t.eta(clockAt(startClockMin, one.etaS))}` : ""}
                  {one.waterMaxL > 0 ? ` · ${Math.round(one.waterL)} l` : ""}
                </span>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: GM.select }}>{t.selected(units.length)}</span>
              <span style={{ fontSize: 11, color: TAK.textDim, fontFamily: TAK.mono, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{units.map((u) => u.callsign).join(" ")}</span>
            </div>
          )}
          <button type="button" onClick={onDeselect} aria-label={t.deselect} title={t.deselect}
            style={{ marginLeft: "auto", width: 30, height: 30, border: "none", borderRadius: TAK.radius, background: "transparent", color: TAK.textDim, fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
        <div role="toolbar" aria-label={t.units} class="cmds">
          {orders.map((o) => {
            const on = active === o;
            return (
              <button key={o} type="button" data-testid={`game-order-${o}`} aria-pressed={on} onClick={() => onChoose(o)} title={`${t.order[o]} (${ORDER_KEY[o]})`}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, minWidth: 62, minHeight: 46, padding: "4px 8px",
                  borderRadius: TAK.radius, cursor: "pointer", border: `1px solid ${on ? GM.select : TAK.panelBorder}`,
                  background: on ? "#3a3200" : TAK.panelRaised, color: on ? GM.select : TAK.text, fontSize: 12.5, fontWeight: 700 }}>
                <span style={{ whiteSpace: "nowrap" }}>{t.order[o]}</span>
                <span class="gm-kbd">{ORDER_KEY[o]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
