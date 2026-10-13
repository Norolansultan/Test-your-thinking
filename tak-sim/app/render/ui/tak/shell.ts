/**
 * The TAK shell's pure model (SPEC/28 §5): which shell a session runs in, which panes its toolbar offers, the Overlay
 * Manager's rules, the Contacts list, the GeoChat rooms and the drones that have a video tile. Everything here reads the
 * snapshot's renderable data only (`RenderableCycle`, the message log, the participant's own recorded plan) — never
 * truth (I4) — and nothing reads a clock or draws a random number (I1). The components in this directory draw it.
 */

import type { LatLon, Polygon } from "../../../engine/primitives.js";
import type { RenderableCycle } from "../../../boundary/render-boundary.js";
import type { RadioLogEntry } from "../../../session/snapshot.js";
import type { TakOverlayLayer, TakPaneDetail, TakPaneId } from "../../../telemetry/record-kinds.js";
import type { UiShell } from "../../../session/header.js";
import { CAPABILITY_MATRIX } from "../../../routing/capability-matrix.js";
import { sortedKeys } from "../../../engine/deterministic-object.js";
import { CHAT_ROOMS, chatRoomOf, type ChatRoom } from "../../../tak/geochat.js";
import { SELF_SIDC, SELF_UID, sidcOf, takKindOf } from "../../../tak/symbols.js";
import { unitCallSign } from "../../../i18n/place-names.js";
import { taskLabel, UNIT_ROSTER, UNIT_ROSTER_EN } from "../unit-roster.js";

// ---------------------------------------------------------------------------
// Shell selection
// ---------------------------------------------------------------------------

/** The URL parameters that select the classic layout of SPEC/06 (`?klassinen`, or `?classic`). */
export const CLASSIC_SHELL_PARAMS = ["klassinen", "classic"] as const;

/** The TAK shell is the default of this build (SPEC/28 §5); `?klassinen` or `?classic` gives the classic layout. */
export function uiShellFromSearch(search: string): UiShell {
  const params = new URLSearchParams(search);
  return CLASSIC_SHELL_PARAMS.some((p) => params.has(p)) ? "classic" : "tak";
}

// ---------------------------------------------------------------------------
// The toolbar
// ---------------------------------------------------------------------------

/** The toolbar's order, top to bottom (ATAK's: overlays and contacts, then the tools, then the search tools). */
export const TAK_PANE_ORDER: readonly TakPaneId[] = ["overlays", "contacts", "geochat", "video", "range_bearing", "haku", "thinker", "indexed_search"];

/**
 * The panes a session's toolbar offers. Haku in every cell; the Thinker only where the capability matrix gives the AI
 * tool (`aiDrawerPresent`, the `substitutive` condition — never the Haku group: SPEC/28 §5); the index-based search only
 * in a demonstration (`indexedSearch`, never under `?tuotanto`).
 */
export function takToolbarPanes(condition: "directed" | "substitutive", opts: { readonly indexedSearch: boolean }): TakPaneId[] {
  const thinker = CAPABILITY_MATRIX[condition].aiDrawerPresent && condition === "substitutive";
  return TAK_PANE_ORDER.filter((p) => (p === "thinker" ? thinker : p === "indexed_search" ? opts.indexedSearch : true));
}

/** Haku, the Thinker and the index search are the session's search tools: locked (and closed) while a visible probe is open. */
export const SEARCH_PANES: ReadonlySet<TakPaneId> = new Set<TakPaneId>(["haku", "thinker", "indexed_search"]);

/** The `tab_selected` tool a pane stands for (the classic right panel's tab record, kept so tool use reads alike in both shells). */
export function tabToolOf(pane: TakPaneId | null): "haku" | "open_thinker" | "indexed_search" | "none" | null {
  if (pane === null) return "none";
  if (pane === "haku") return "haku";
  if (pane === "thinker") return "open_thinker";
  if (pane === "indexed_search") return "indexed_search";
  return null;
}

/**
 * Review 13 Oct 2026 (SPEC/28 §5): Haku, the Thinker and the index search open with the message log under them, as in the
 * classic right column, so using a tool never hides the pushed reports. The tool takes this share of the side pane's
 * height (per cent), the log ("All Chat Rooms", newest in view) the rest.
 */
export const SEARCH_TOOL_SHARE_PCT = 58;

/** Whether the open pane shows the message log: GeoChat, and the search tools with the log under them. */
export function paneShowsLog(pane: TakPaneId | null): boolean {
  return pane === "geochat" || (pane !== null && SEARCH_PANES.has(pane));
}

/**
 * A toolbar button's accessible name: its visible label first (WCAG 2.5.3, label in name), then the pane's full title when
 * it says more ("R&B, Range & Bearing"), then GeoChat's unread count when its badge shows.
 */
export function toolbarButtonName(label: string, title: string, unread: string | null): string {
  return [label, title !== label ? title : null, unread].filter((s): s is string => s !== null).join(", ");
}

// ---------------------------------------------------------------------------
// The shell's mount and unmount records (SPEC/07 revision (av))
// ---------------------------------------------------------------------------

/** The pane the shell opens on every mount: GeoChat, the classic layout's always-visible message log. */
export const DEFAULT_PANE: TakPaneId = "geochat";

/**
 * The record of the pane the shell opens when it mounts (cause `default`). It always carries the full overlay state — on
 * every mount, not only when it differs from {@link DEFAULT_OVERLAYS} — so the map's layers at any moment can be rebuilt
 * from the log alone: this record, then the `tak_overlay_toggled` records after it. (The state is kept across the remounts
 * of one session — the training screen — and starts again from the defaults in a new or resumed session.)
 */
export function mountPaneRecord(view: number, overlays: TakOverlayState): TakPaneDetail {
  return { pane: DEFAULT_PANE, view, cause: "default", overlays: overlaysForLog(overlays) };
}

/**
 * What the shell logs when it unmounts (the training screen, the session's end, a resume) with `pane` open: the pane closed
 * with cause `unmount`, and for a search tool the classic tab record `none` (as closing it with its button logs), so every
 * opening has its closing. Nothing once the session is finished (`finished`: the engine is COMPLETE or ABORTED): no record
 * may follow `session_completed`.
 */
export function unmountRecords(pane: TakPaneId | null, view: number, finished: boolean): { readonly closed: TakPaneDetail; readonly tab: "none" | null } | null {
  if (finished || pane === null) return null;
  return { closed: { pane, view, cause: "unmount" }, tab: SEARCH_PANES.has(pane) ? "none" : null };
}

// ---------------------------------------------------------------------------
// Overlay Manager
// ---------------------------------------------------------------------------

export type TakOverlayState = Readonly<Record<TakOverlayLayer, boolean>>;

/** The Overlay Manager's toggles in their order. */
export const TAK_OVERLAY_LAYERS: readonly TakOverlayLayer[] = ["labels", "footprints", "past_perimeters", "rate_marks", "plan_marks"];

/**
 * Each session starts from these, the same for everyone: call-sign labels on (they still follow the zoom, as in the classic
 * map), sensor footprints as in the classic map (only for the aircraft under the pointer), earlier perimeters on, rate marks
 * off, and the participant's own plan marks off (review 13 Oct 2026, SPEC/28 §5: SPEC/12 does not provide for them under
 * the projection, so the map starts as the classic map; the Overlay Manager can show them).
 */
export const DEFAULT_OVERLAYS: TakOverlayState = { labels: true, footprints: false, past_perimeters: true, rate_marks: false, plan_marks: false };

/** The overlay state as logged: every layer, keys in sorted order (the log's bytes must not depend on insertion order, I1). */
export function overlaysForLog(state: TakOverlayState): TakOverlayState {
  return { footprints: state.footprints, labels: state.labels, past_perimeters: state.past_perimeters, plan_marks: state.plan_marks, rate_marks: state.rate_marks };
}

/**
 * What the Overlay Manager lists but never lets the participant hide: the projection and the current (reported) perimeter
 * carry the primary DV (SPEC/28 §5). They are always drawn, by the classic layers of SPEC/12.
 */
export const LOCKED_OVERLAYS = ["projection", "current_perimeter"] as const;
export type LockedOverlay = (typeof LOCKED_OVERLAYS)[number];

/**
 * Listed but not available in this study: rate marks are not drawn on the map in any cell or view (SPEC/12 revision (y));
 * the toggle stays off and says so, so the TAK shell cannot show what the classic shell withholds.
 */
export const UNAVAILABLE_OVERLAYS: ReadonlySet<TakOverlayLayer> = new Set<TakOverlayLayer>(["rate_marks"]);

export function isToggleableOverlay(layer: string): layer is TakOverlayLayer {
  return (TAK_OVERLAY_LAYERS as readonly string[]).includes(layer) && !UNAVAILABLE_OVERLAYS.has(layer as TakOverlayLayer);
}

/** The state after a toggle; null when the layer cannot be toggled (the projection, the current perimeter, rate marks, anything unknown). */
export function toggleOverlay(state: TakOverlayState, layer: string): TakOverlayState | null {
  if (!isToggleableOverlay(layer)) return null;
  return { ...state, [layer]: !state[layer] };
}

/**
 * The map layers an overlay state shows or hides (`tak-map.ts` applies them): only the earlier perimeters' line layer, the
 * sensor footprints and the plan marks. No state ever names a fire-edge, burnt, burning-zone, spot, detection or projection
 * layer: those are drawn by `fire-layers.ts` exactly as in the classic shell.
 */
export function overlayLayerVisibility(state: TakOverlayState): readonly (readonly [string, boolean])[] {
  return [
    ["fire-past-line", state.past_perimeters],
    ["tak-plan-line", state.plan_marks],
    ["tak-plan-fill", state.plan_marks],
  ];
}

/** The map layers that carry the primary DV and must stay visible whatever the overlays (`fire-layers.ts` ids). */
export const PROTECTED_MAP_LAYER_PREFIXES = ["fire-edge", "fire-head", "fire-zone", "fire-burnt", "fire-spots", "fire-detections", "proj-"] as const;

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

/** SPEC/28 §3's uid of a platform's CoT event: `TAKSIM-UNIT-<id>` for a ground unit, `TAKSIM-AIR-<id>` for an aircraft. */
export function contactUid(platformId: string, air: boolean): string {
  return `TAKSIM-${air ? "AIR" : "UNIT"}-${platformId}`;
}

export interface TakContact {
  readonly uid: string;
  /** The scenario's id (`EK11`, `DR2`), or `SELF`. */
  readonly id: string;
  readonly kind: "self" | "ground" | "air";
  readonly callsign: string;
  /** The roster's type in the session language; null when the roster has none. */
  readonly type: string | null;
  /** What the unit is doing now (`unitWork`), in the session language; null for aircraft and units without work. */
  readonly task: string | null;
  readonly waterPct: number | null;
  /** The clock of the platform's last message in the log; null when it has sent none. */
  readonly lastReport: string | null;
  readonly at: LatLon;
  readonly sidc: string;
}

/** The clock of a source's last message in the log, or null. */
export function lastReportOf(log: readonly RadioLogEntry[], sourceId: string): string | null {
  let clock: string | null = null;
  for (const e of log) if (e.from.trim().toUpperCase() === sourceId) clock = e.clockLabel;
  return clock;
}

type ContactCycle = Pick<RenderableCycle, "unitPositions" | "unitWork" | "aircraft">;

/**
 * Every unit and aircraft on the map now, after the participant's own "self" entry (the incident commander at the command
 * post): ground units by id, then aircraft by id. Positions are the map's (the crew's position for a crew on foot).
 * No battery level (QA 13 Oct 2026, SPEC/28 §5): the drones' battery reports are Haku-only records, never pushed, so
 * showing one would hand the participant what the design makes them search for.
 */
export function takContacts(cycle: ContactCycle | null, log: readonly RadioLogEntry[], lang: "fi" | "en", self: { readonly at: LatLon; readonly callsign: string; readonly role: string }): TakContact[] {
  const out: TakContact[] = [{
    uid: SELF_UID, id: "SELF", kind: "self", callsign: self.callsign, type: self.role, task: null, waterPct: null, lastReport: null, at: self.at, sidc: SELF_SIDC,
  }];
  const typeOf = (id: string) => (lang === "en" ? UNIT_ROSTER_EN[id]?.type : UNIT_ROSTER[id]?.typeFi) ?? null;
  if (!cycle) return out;
  for (const id of sortedKeys(cycle.unitPositions)) {
    const work = cycle.unitWork[id] ?? null;
    out.push({
      uid: contactUid(id, false), id, kind: "ground", callsign: unitCallSign(lang, id), type: typeOf(id),
      task: work ? taskLabel(id, work.task, lang) : null, waterPct: typeof work?.waterPct === "number" ? work.waterPct : null,
      lastReport: lastReportOf(log, id), at: cycle.unitPositions[id]!, sidc: sidcOf(id),
    });
  }
  const air = [...cycle.aircraft].sort((a, b) => (a.platformId < b.platformId ? -1 : a.platformId > b.platformId ? 1 : 0));
  for (const a of air) {
    out.push({
      uid: contactUid(a.platformId, true), id: a.platformId, kind: "air", callsign: unitCallSign(lang, a.platformId), type: typeOf(a.platformId),
      task: null, waterPct: null, lastReport: lastReportOf(log, a.platformId), at: a.position, sidc: sidcOf(a.platformId),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// GeoChat
// ---------------------------------------------------------------------------

export type GeoChatRoomId = "all" | ChatRoom;
export const GEOCHAT_ROOM_ORDER: readonly GeoChatRoomId[] = ["all", ...CHAT_ROOMS];

export interface GeoChatRoomView {
  readonly room: GeoChatRoomId;
  /** The log's entries in this room, in the log's own order; `index` is the entry's place in the whole log. */
  readonly entries: readonly { readonly entry: RadioLogEntry; readonly index: number }[];
}

/**
 * The message log as GeoChat rooms (SPEC/28 §5, `app/tak/geochat.ts`): "All Chat Rooms" first, holding every message, then
 * the rooms by source. A room only groups: every entry is the log's own object (wording, time, source unchanged), in the
 * log's order, and each entry is in exactly one source room.
 */
export function geoChatRooms(log: readonly RadioLogEntry[]): GeoChatRoomView[] {
  const all = log.map((entry, index) => ({ entry, index }));
  return GEOCHAT_ROOM_ORDER.map((room) => ({ room, entries: room === "all" ? all : all.filter((x) => chatRoomOf(x.entry.from) === room) }));
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

export interface VideoFeed {
  readonly platformId: string;
  /** Rotary or fixed-wing UAV (`app/tak/symbols.ts`). */
  readonly takKind: "uav_rotary" | "uav_fixed";
  readonly position: LatLon;
  /** Its sensor footprint now, or null when it has none (the water drone carries no thermal camera footprint). */
  readonly footprint: Polygon | null;
}

/** The drones in the air now, one video tile each, by id. A grounded drone has no tile (it is not in `aircraft`). */
export function videoFeeds(cycle: Pick<RenderableCycle, "aircraft" | "sensorFootprints"> | null): VideoFeed[] {
  if (!cycle) return [];
  const drones = cycle.aircraft.filter((a) => a.kind === "drone" || a.kind === "water_drone");
  const sorted = [...drones].sort((a, b) => (a.platformId < b.platformId ? -1 : a.platformId > b.platformId ? 1 : 0));
  return sorted.map((a) => {
    const kind = takKindOf(a.platformId);
    return {
      platformId: a.platformId, takKind: kind === "uav_fixed" ? "uav_fixed" : "uav_rotary", position: a.position,
      footprint: cycle.sensorFootprints.find((f) => f.platformId === a.platformId)?.geometry ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Coordinates and scale
// ---------------------------------------------------------------------------

/** "60.84881° N 27.34963° E" — the lat/lon line under the MGRS readout. */
export function formatLatLon(p: LatLon): string {
  const lat = `${Math.abs(p.lat).toFixed(5)}° ${p.lat >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(p.lon).toFixed(5)}° ${p.lon >= 0 ? "E" : "W"}`;
  return `${lat} ${lon}`;
}

/** An MGRS string ("35VNG1234567890") spaced as ATAK shows it ("35V NG 12345 67890"). */
export function spaceMgrs(mgrs: string): string {
  const m = /^(\d{1,2}[C-X])([A-Z]{2})(\d*)$/.exec(mgrs.replace(/\s+/g, ""));
  if (!m) return mgrs;
  const digits = m[3] ?? "";
  const half = digits.length / 2;
  return [m[1], m[2], digits.slice(0, half), digits.slice(half)].filter((s) => s).join(" ");
}

/** A scale bar for `metresPerPx`: the longest round length (1, 2 or 5 × 10ⁿ m) that fits `maxPx`, and its width in px. */
export function scaleBar(metresPerPx: number, maxPx = 110): { readonly metres: number; readonly px: number; readonly label: string } {
  const maxM = metresPerPx * maxPx;
  const pow = 10 ** Math.floor(Math.log10(Math.max(maxM, 1e-6)));
  const step = [5, 2, 1].map((k) => k * pow).find((m) => m <= maxM) ?? pow;
  const px = step / metresPerPx;
  return { metres: step, px, label: step >= 1000 ? `${step / 1000} km` : `${step} m` };
}
