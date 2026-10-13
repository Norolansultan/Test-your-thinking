/**
 * SPEC/28 §2–§4: the CoT compiler. Turns one view step of the participant's picture into CoT events:
 * the self marker, units and aircraft (2525 types, callsign, roster remarks, battery, track, camera),
 * the reported perimeter, its detached fronts and the earlier perimeters, the projection, the sensor
 * footprints and the rate marks as drawings / spot markers, and every delivered report as GeoChat.
 *
 * I4 by construction: the input is the render tree's `Renderable*` types (built by
 * `app/boundary/render-boundary.ts`, which strips truth) plus the public unit roster and the static
 * map overlay. Nothing here imports a value from `app/scenario/`; a test walks every compiled event
 * of every view with `assertNoTruthKeysPresent` and greps the XML for the truth field names, and a
 * second test checks this module's import graph.
 *
 * I1 / I2: uids derive from scenario ids, times from virtual time only (`time.ts`), every map is
 * iterated in sorted key order, and the output is sorted by (`time`, `uid`). Geometry is rounded to
 * the serialisation's precision here, so a compiled event equals its own parse.
 *
 * DRAFT pending the domain reviewers (SPEC/11 §7.22): team colours, remark wording, shape colours.
 */

import { assertNoTruthKeysPresent, type RenderableAtom, type RenderableCycle, type RenderableEnvelope, type RenderableRateMark } from "../boundary/render-boundary.js";
import { sortedKeys } from "../engine/deterministic-object.js";
import type { LatLon, Ring } from "../engine/primitives.js";
import { clockAtVirtual, projectionValidityLabel } from "../render/projection-validity.js";
import { rateMarkText } from "../render/visual-encoding.js";
import { taskLabel, UNIT_ROSTER, UNIT_ROSTER_EN } from "../render/ui/unit-roster.js";
import fireTheme from "../render/ui/fire-theme.json" with { type: "json" };
import mapOverlay from "../render/ui/map-overlay.json" with { type: "json" };
import { CE_UNKNOWN, COT_VERSION, COORD_DECIMALS, roundTo, sortCotEvents, VALUE_DECIMALS, type CotDetail, type CotEvent, type CotPoint, type CotSensor, type CotShapeStyle, type CotTrack, type TakSimKind } from "./cot.js";
import { chatRoomOf, type ChatRoom } from "./geochat.js";
import { COT_TYPE_CHAT, COT_TYPE_DRAWING, COT_TYPE_SPOT, cotTypeOf, SELF_COT_TYPE, SELF_UID, takKindOf, type TakKind } from "./symbols.js";
import { isoOfVirtual } from "./time.js";

/** SPEC/26 §2: one world-state step is 1200 virtual seconds (`app/scenario/views.ts` STEP_SECONDS; kept here so no scenario module is imported). */
export const COT_STEP_SECONDS = 1200;

/** The participant's callsign on the TAK picture: the incident command the units report to ("JOHTO"). */
export const SELF_CALLSIGN = "JOHTO";

/**
 * The self marker's position when the caller gives none: the command post of the static map overlay
 * (`app/render/ui/map-overlay.json` `commandPost`, the same flag the live map draws), where SPEC/18 puts
 * the incident commander, the weather station and the drone team.
 */
export const DEFAULT_SELF_POSITION: LatLon = { lat: mapOverlay.commandPost.lat, lon: mapOverlay.commandPost.lon };

/** A report as it reached the participant: the atom and its delivery time (the view's start + its delivery offset). */
export interface DeliveredBubble {
  readonly atom: RenderableAtom;
  readonly deliveredAtVirtual: number;
}

/** A message that is not a corpus atom (the duty officer's intent and directive): what the message log shows. */
export interface CotChatLine {
  readonly id: string;
  readonly sourceId: string;
  readonly atVirtual: number;
  readonly text: string;
}

/** One view step of the participant's picture: the render tree's content plus what the message log shows. */
export interface ViewCotInput {
  /** The map state of the step (`toRenderableCycle(view, stepShown)`). */
  readonly cycle: RenderableCycle;
  readonly envelope: RenderableEnvelope | null;
  /**
   * The reports delivered in this step. A bare atom is timed by `provenance.deliveredAt` (else
   * `observedAt`); a {@link DeliveredBubble} by its own delivery time.
   */
  readonly bubbles: readonly (RenderableAtom | DeliveredBubble)[];
  /** Other messages delivered in this step (the duty officer's). */
  readonly chatLines?: readonly CotChatLine[];
  /** Battery percentage per airborne drone at the step's start (`app/scenario/drone-battery.ts`'s model); absent or null: not stated. */
  readonly batteryPct?: Readonly<Record<string, number | null>>;
  /** The self marker's position; default {@link DEFAULT_SELF_POSITION}. */
  readonly selfPosition?: LatLon;
  /** Language of the roster remarks and labels; message texts stay as delivered. Default Finnish. */
  readonly lang?: "fi" | "en";
}

// ---------------------------------------------------------------------------
// ids, labels and styles
// ---------------------------------------------------------------------------

/** `V00` (the practice view) … `V14`: the view label in uids, `__taksim@view` and the export's file names. */
export function viewLabel(index: number): string {
  return `V${String(index).padStart(2, "0")}`;
}

const AIR_KINDS: ReadonlySet<TakKind> = new Set<TakKind>(["uav_rotary", "uav_fixed", "helicopter", "fixed_wing"]);

/** `TAKSIM-AIR-<id>` for aircraft and drones, `TAKSIM-UNIT-<id>` for ground units and the robot. */
export function platformUid(platformId: string): string {
  return `${AIR_KINDS.has(takKindOf(platformId)) ? "TAKSIM-AIR" : "TAKSIM-UNIT"}-${platformId}`;
}

function isRosterPlatform(id: string): boolean {
  return UNIT_ROSTER[id] !== undefined;
}

/** The uid a message's sender has: its platform's, else `TAKSIM-SRC-<sourceId>` (P2, the emergency centre, the weather station…). */
export function senderUid(sourceId: string): string {
  return isRosterPlatform(sourceId) ? platformUid(sourceId) : `TAKSIM-SRC-${sourceId}`;
}

function senderType(sourceId: string, room: ChatRoom): string {
  if (isRosterPlatform(sourceId)) return cotTypeOf(sourceId);
  return room === "command" ? SELF_COT_TYPE : "a-f-G";
}

/** The GeoChat uid of SPEC/28 §3: `GeoChat.<senderUid>.<room>.<atomId>`. */
export function geoChatUid(sourceId: string, messageId: string): string {
  return `GeoChat.${senderUid(sourceId)}.${chatRoomOf(sourceId)}.${messageId}`;
}

/** TAK team colours (`__group@name`) by GeoChat room, so the contact list and the chat group alike. DRAFT. */
const TEAM_BY_ROOM: Readonly<Record<ChatRoom, string>> = { ground: "Red", air: "Cyan", command: "Dark Blue", support: "Yellow" };

function argb(hex: string, alpha: number): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) throw new RangeError(`not a #RRGGBB colour: ${hex}`);
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  return ((a << 24) | parseInt(m[1]!, 16)) | 0;
}

/** Drawing styles, from the map's own theme (`fire-theme.json`) so the CoT mirror and the live map agree. */
const PERIMETER_STYLE: CotShapeStyle = { strokeColor: argb(fireTheme.uncontained.color, 1), strokeWeight: 3, fillColor: argb(fireTheme.uncontained.color, 0.25), labelsOn: true };
const PAST_STYLE: CotShapeStyle = { strokeColor: argb(fireTheme.past.color, 1), strokeWeight: 1, fillColor: argb(fireTheme.past.color, 0), labelsOn: false };
/** The projection's line: the theme's colour at the opacity the map gives its certainty; no fill (SPEC/12: one boundary, no gradient). */
function projectionStyle(certainty: RenderableEnvelope["projectionCertainty"]): CotShapeStyle {
  return { strokeColor: argb(fireTheme.projection.color, fireTheme.projection.certaintyOpacity[certainty]), strokeWeight: 2, fillColor: argb(fireTheme.projection.color, 0), labelsOn: true };
}
/** Sensor footprints: the own-formation hue of the live map (`unit-markers.ts` OWN_FORMATION_HUE, fill at 8 %, `MapView.tsx`). */
const FOOTPRINT_HUE = "#4FB3FF";
const FOOTPRINT_STYLE: CotShapeStyle = { strokeColor: argb(FOOTPRINT_HUE, 0.8), strokeWeight: 1, fillColor: argb(FOOTPRINT_HUE, 0.08), labelsOn: false };
const RATE_MARK_COLOR = argb(fireTheme.uncontained.color, 1);

const FLANK_LABEL: Readonly<Record<RenderableRateMark["flank"], { readonly fi: string; readonly en: string }>> = {
  head: { fi: "Kärki", en: "Head" },
  north: { fi: "Pohjoisreuna", en: "North flank" },
  south: { fi: "Eteläreuna", en: "South flank" },
  east: { fi: "Itäreuna", en: "East flank" },
  west: { fi: "Länsireuna", en: "West flank" },
  rear: { fi: "Perä", en: "Rear" },
};

// ---------------------------------------------------------------------------
// geometry (degrees, metres; spherical Earth — positions only, never a measurement the study scores)
// ---------------------------------------------------------------------------

const EARTH_RADIUS_M = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function distanceM(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing a → b, degrees true in [0, 360). */
function bearingDeg(a: LatLon, b: LatLon): number {
  const dLon = rad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLon);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** A bearing rounded to the serialisation's precision, in [0, 360). */
function roundBearing(b: number): number {
  const r = roundTo(b, VALUE_DECIMALS);
  return r >= 360 ? roundTo(r - 360, VALUE_DECIMALS) : r;
}

/** The ring's distinct vertices: a closed ring's repeated last vertex dropped. */
function openRing(ring: Ring): readonly LatLon[] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  return ring.length > 1 && first && last && first.lat === last.lat && first.lon === last.lon ? ring.slice(0, -1) : ring;
}

/** The vertex average (arithmetic only, so exact on every machine): the drawing's anchor point. */
function vertexCentroid(ring: Ring): LatLon {
  const pts = openRing(ring);
  let lat = 0;
  let lon = 0;
  for (const p of pts) {
    lat += p.lat;
    lon += p.lon;
  }
  return { lat: lat / pts.length, lon: lon / pts.length };
}

/** Ray casting on lat/lon (the rings are a few kilometres across). */
function insideRing(p: LatLon, ring: Ring): boolean {
  const pts = openRing(ring);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    if (a.lat > p.lat !== b.lat > p.lat && p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon) inside = !inside;
  }
  return inside;
}

/**
 * `track`: course = the bearing from the platform's position towards the next vertex of the track it
 * flies this step (the vertex after the one nearest to it); speed = the drawn track's length over the
 * step (m/s) — the mean ground speed if the track is flown once in the step. DRAFT: the scenario
 * states no speeds, so this is a display value only.
 */
function trackOf(position: LatLon, track: readonly LatLon[]): CotTrack {
  if (track.length < 2) return { course: 0, speed: 0 };
  let nearest = 0;
  let best = Infinity;
  track.forEach((p, i) => {
    const d = distanceM(position, p);
    if (d < best) {
      best = d;
      nearest = i;
    }
  });
  const ahead = track.slice(nearest + 1).find((p) => distanceM(position, p) > 1);
  const course = ahead ? bearingDeg(position, ahead) : bearingDeg(track[Math.max(0, nearest - 1)]!, track[nearest]!);
  let length = 0;
  for (let i = 1; i < track.length; i++) length += distanceM(track[i - 1]!, track[i]!);
  return { course: roundBearing(course), speed: roundTo(length / COT_STEP_SECONDS, VALUE_DECIMALS) };
}

/**
 * `sensor` from the footprint the platform's camera covers: azimuth towards the footprint's centre,
 * range to its farthest vertex, field of view = the angle the footprint subtends from the platform
 * (360 when the platform is over its own footprint, as a downward-looking camera is).
 */
function sensorOf(position: LatLon, ring: Ring): CotSensor {
  const pts = openRing(ring);
  const centre = vertexCentroid(ring);
  const azimuth = distanceM(position, centre) < 1 ? 0 : bearingDeg(position, centre);
  let range = 0;
  let spread = 0;
  for (const p of pts) {
    range = Math.max(range, distanceM(position, p));
    const diff = Math.abs(((bearingDeg(position, p) - azimuth + 540) % 360) - 180);
    spread = Math.max(spread, diff);
  }
  const fov = insideRing(position, ring) ? 360 : Math.min(360, Math.max(1, 2 * spread));
  return { fov: roundTo(fov, VALUE_DECIMALS), azimuth: roundBearing(azimuth), range: roundTo(range, VALUE_DECIMALS) };
}

function roundPoint(p: LatLon): LatLon {
  return { lat: roundTo(p.lat, COORD_DECIMALS), lon: roundTo(p.lon, COORD_DECIMALS) };
}

function cotPoint(p: LatLon | null): CotPoint {
  if (!p) return { lat: 0, lon: 0, hae: 0, ce: CE_UNKNOWN, le: CE_UNKNOWN };
  const r = roundPoint(p);
  return { lat: r.lat, lon: r.lon, hae: 0, ce: CE_UNKNOWN, le: CE_UNKNOWN };
}

// ---------------------------------------------------------------------------
// texts
// ---------------------------------------------------------------------------

function unitRemarks(id: string, work: RenderableCycle["unitWork"][string] | undefined, lang: "fi" | "en"): string {
  const parts: string[] = [];
  if (lang === "en") {
    const r = UNIT_ROSTER_EN[id];
    if (r) parts.push(r.type, ...(r.crew ? [`crew ${r.crew}`] : []), ...(r.detail ? [r.detail] : []));
    if (work) {
      parts.push(`Task: ${taskLabel(id, work.task, "en")}`);
      if (work.hoseM !== null) parts.push(`hose ${work.hoseM} m`);
      if (work.waterPct !== undefined && work.waterPct !== null) parts.push(`water ${work.waterPct} %`);
    }
  } else {
    const r = UNIT_ROSTER[id];
    if (r) parts.push(r.typeFi, ...(r.crew ? [`miehistö ${r.crew}`] : []), ...(r.detailFi ? [r.detailFi] : []));
    if (work) {
      parts.push(`Tehtävä: ${taskLabel(id, work.task, "fi")}`);
      if (work.hoseM !== null) parts.push(`letku ${work.hoseM} m`);
      if (work.waterPct !== undefined && work.waterPct !== null) parts.push(`vesi ${work.waterPct} %`);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : id;
}

/** A record's text as the message log shows it (`app/session/template-answer.ts` recordText): its text, else its content, else its kind. */
export function recordTextOf(record: RenderableAtom["record"]): string {
  if ("text" in record) return record.text;
  if ("content" in record && record.content) return record.content;
  if (record.kind === "radio_traffic" && record.transcriptFi) return record.transcriptFi;
  return `(${record.kind})`;
}

// ---------------------------------------------------------------------------
// the compiler
// ---------------------------------------------------------------------------

interface StepContext {
  readonly view: string;
  readonly step: number;
  readonly time: string;
  readonly stale: string;
}

function event(ctx: StepContext, fields: { uid: string; type: string; how: string; point: CotPoint; kind: TakSimKind; source: string; time?: string; stale?: string; step?: number; detail?: Omit<CotDetail, "taksim"> }): CotEvent {
  const time = fields.time ?? ctx.time;
  return {
    version: COT_VERSION,
    uid: fields.uid,
    type: fields.type,
    how: fields.how,
    time,
    start: time,
    stale: fields.stale ?? ctx.stale,
    point: fields.point,
    detail: { ...(fields.detail ?? {}), taksim: { view: ctx.view, step: fields.step ?? ctx.step, kind: fields.kind, source: fields.source } },
  };
}

function shapeEvent(ctx: StepContext, uid: string, ring: Ring, kind: TakSimKind, source: string, style: CotShapeStyle, callsign: string, remarks: string, how = "h-e", stale?: string): CotEvent | null {
  if (openRing(ring).length < 3) return null;
  return event(ctx, {
    uid, type: COT_TYPE_DRAWING, how, point: cotPoint(vertexCentroid(ring)), kind, source, ...(stale !== undefined ? { stale } : {}),
    detail: { contact: { callsign }, vertices: ring.map(roundPoint), style, remarks: { text: remarks } },
  });
}

function chatEvent(cycle: RenderableCycle, ctx: StepContext, message: { id: string; sourceId: string; atVirtual: number; text: string }, positions: (id: string) => LatLon | null): CotEvent {
  const room = chatRoomOf(message.sourceId);
  const uid = senderUid(message.sourceId);
  const iso = isoOfVirtual(message.atVirtual);
  // The step the message arrived in (a merged view's second step from 1200 s on), and that step's end.
  const step = cycle.steps === 2 && message.atVirtual >= cycle.startsAtVirtual + COT_STEP_SECONDS ? 2 : 1;
  return event(ctx, {
    uid: geoChatUid(message.sourceId, message.id), type: COT_TYPE_CHAT, how: "h-e", point: cotPoint(positions(message.sourceId)),
    kind: "chat", source: message.sourceId, time: iso, stale: isoOfVirtual(cycle.startsAtVirtual + step * COT_STEP_SECONDS), step,
    detail: {
      chat: {
        parent: "RootContactGroup", groupOwner: false, messageId: message.id, chatroom: room, id: room, senderCallsign: message.sourceId,
        chatgrp: { uid0: uid, uid1: SELF_UID, id: room },
      },
      linkRef: { uid, type: senderType(message.sourceId, room), relation: "p-p" },
      remarks: { source: `TAKSIM.${uid}`, to: room, time: iso, text: message.text },
    },
  });
}

function bubbleMessage(b: RenderableAtom | DeliveredBubble): { id: string; sourceId: string; atVirtual: number; text: string } {
  const atom = "atom" in b ? b.atom : b;
  const at = "atom" in b ? b.deliveredAtVirtual : atom.provenance.deliveredAt ?? atom.provenance.observedAt;
  return { id: atom.id, sourceId: atom.provenance.sourceId, atVirtual: at, text: recordTextOf(atom.record) };
}

/**
 * Compiles one view step (SPEC/28 §3: one event per object per view step) into CoT events, sorted
 * by (`time`, `uid`). Map objects carry the step's start as `time` and the next step's start as
 * `stale`; the projection's `stale` is its validity horizon; a message carries its delivery time.
 */
export function compileViewCot(input: ViewCotInput): CotEvent[] {
  assertNoTruthKeysPresent(input); // the render boundary's presence assertion, again at the CoT boundary
  const { cycle, envelope } = input;
  const lang = input.lang ?? "fi";
  const stepStart = cycle.startsAtVirtual + (cycle.stepShown - 1) * COT_STEP_SECONDS;
  const view = viewLabel(cycle.index);
  const ctx: StepContext = { view, step: cycle.stepShown, time: isoOfVirtual(stepStart), stale: isoOfVirtual(stepStart + COT_STEP_SECONDS) };
  const events: CotEvent[] = [];
  const aircraft = [...cycle.aircraft].sort((a, b) => (a.platformId < b.platformId ? -1 : a.platformId > b.platformId ? 1 : 0));
  const positionOf = (id: string): LatLon | null => cycle.unitPositions[id] ?? aircraft.find((a) => a.platformId === id)?.position ?? (id === SELF_CALLSIGN ? input.selfPosition ?? DEFAULT_SELF_POSITION : null);

  // The participant: the incident commander at the command post, with the wind reading the map shows.
  const w = cycle.wind;
  events.push(event(ctx, {
    uid: SELF_UID, type: SELF_COT_TYPE, how: "h-e", point: cotPoint(input.selfPosition ?? DEFAULT_SELF_POSITION), kind: "self", source: SELF_CALLSIGN,
    detail: {
      contact: { callsign: SELF_CALLSIGN },
      group: { name: TEAM_BY_ROOM.command, role: "HQ" },
      remarks: { text: lang === "en" ? `Incident commander (you), command post · wind from ${w.fromDeg}°, ${w.meanMs} m/s` : `Tilannejohtaja (sinä), johtopaikka · tuuli ${w.fromDeg}°, ${w.meanMs} m/s (${w.sourceFi})` },
    },
  }));

  // Ground units and the robot: where the crew works (the hover card's facts in the remarks).
  for (const id of sortedKeys(cycle.unitPositions)) {
    const position = cycle.unitPositions[id]!;
    events.push(event(ctx, {
      uid: platformUid(id), type: cotTypeOf(id), how: "m-g", point: cotPoint(position), kind: "unit", source: id,
      detail: { contact: { callsign: id }, group: { name: TEAM_BY_ROOM[chatRoomOf(id)], role: "Team Member" }, remarks: { text: unitRemarks(id, cycle.unitWork[id], lang) } },
    }));
  }

  // Aircraft and drones in the air: battery, track, and the camera of those with a footprint.
  for (const a of aircraft) {
    const footprint = cycle.sensorFootprints.find((f) => f.platformId === a.platformId)?.geometry?.[0] ?? null;
    const battery = input.batteryPct?.[a.platformId];
    events.push(event(ctx, {
      uid: platformUid(a.platformId), type: cotTypeOf(a.platformId), how: "m-g", point: cotPoint(a.position), kind: "aircraft", source: a.platformId,
      detail: {
        contact: { callsign: a.platformId },
        group: { name: TEAM_BY_ROOM[chatRoomOf(a.platformId)], role: "Team Member" },
        ...(battery !== undefined && battery !== null ? { status: { battery: Math.round(battery) } } : {}),
        track: trackOf(a.position, a.track),
        ...(footprint && openRing(footprint).length >= 3 ? { sensor: sensorOf(a.position, footprint) } : {}),
        remarks: { text: unitRemarks(a.platformId, undefined, lang) },
      },
    }));
  }

  // The reported fire: perimeter (outer ring; u-d-f has no holes), detached fronts, earlier perimeters.
  const reportedAt = clockAtVirtual(cycle.startsAtVirtual);
  const perimeterRing = cycle.perimeter[0];
  const shapes: (CotEvent | null)[] = [];
  if (perimeterRing) {
    shapes.push(shapeEvent(ctx, `TAKSIM-SHAPE-PERIM-${view}`, perimeterRing, "perimeter", "reported", PERIMETER_STYLE,
      lang === "en" ? `Fire ${reportedAt}` : `Palo ${reportedAt}`,
      lang === "en" ? `Reported fire perimeter, ${reportedAt}` : `Ilmoitettu palon reuna, klo ${reportedAt}`));
  }
  cycle.detachedFronts.forEach((front, k) => {
    const ring = front[0];
    if (ring) shapes.push(shapeEvent(ctx, `TAKSIM-SHAPE-FRONT-${view}-${k + 1}`, ring, "front", "reported", PERIMETER_STYLE,
      lang === "en" ? `Front ${k + 1} ${reportedAt}` : `Rintama ${k + 1} ${reportedAt}`,
      lang === "en" ? `Reported detached fire front, ${reportedAt}` : `Ilmoitettu erillinen palorintama, klo ${reportedAt}`));
  });
  cycle.fire.perimeters_past.forEach((past, i) => {
    past.geometry.forEach((ring, j) => {
      shapes.push(shapeEvent(ctx, `TAKSIM-SHAPE-PAST-${view}-${i + 1}-${j + 1}`, ring, "past_perimeter", "reported", PAST_STYLE,
        past.time, lang === "en" ? `Earlier perimeter, ${past.time}` : `Aiempi rajaus, klo ${past.time}`));
    });
  });

  // The projection: machine-predicted, stale at its validity horizon (SPEC/12 §4's label as callsign).
  if (envelope) {
    const label = projectionValidityLabel(envelope, lang);
    const horizon = envelope.horizonVirtual > stepStart ? envelope.horizonVirtual : stepStart + COT_STEP_SECONDS;
    const style = projectionStyle(envelope.projectionCertainty);
    const remarks = `${label} · ${envelope.attribution}`;
    const outer = envelope.polygon[0];
    if (outer) shapes.push(shapeEvent(ctx, `TAKSIM-SHAPE-PROJ-${view}`, outer, "projection", envelope.attribution, style, label, remarks, "m-p", isoOfVirtual(horizon)));
    envelope.detachedParts.forEach((part, k) => {
      const ring = part[0];
      if (ring) shapes.push(shapeEvent(ctx, `TAKSIM-SHAPE-PROJ-${view}-${k + 1}`, ring, "projection", envelope.attribution, style, label, remarks, "m-p", isoOfVirtual(horizon)));
    });
  }

  // Sensor footprints of the platforms in the air (a grounded one has none: absence is the signal).
  for (const f of [...cycle.sensorFootprints].sort((a, b) => (a.platformId < b.platformId ? -1 : a.platformId > b.platformId ? 1 : 0))) {
    const ring = f.geometry?.[0];
    if (ring) shapes.push(shapeEvent(ctx, `TAKSIM-SHAPE-FOOT-${f.platformId}`, ring, "footprint", f.platformId, FOOTPRINT_STYLE,
      lang === "en" ? `${f.platformId} camera` : `${f.platformId} kamera`,
      lang === "en" ? `Ground covered by ${f.platformId}'s camera` : `${f.platformId}:n kameran kattama alue`));
  }
  for (const s of shapes) if (s) events.push(s);

  // Rate marks: spot markers with flank, rate and bearing.
  for (const mark of cycle.rateMarks) {
    const flank = FLANK_LABEL[mark.flank][lang];
    const rate = rateMarkText(mark, lang);
    const observed = clockAtVirtual(mark.provenance.observedAt);
    events.push(event(ctx, {
      uid: `TAKSIM-RATE-${mark.id}`, type: COT_TYPE_SPOT, how: "h-e", point: cotPoint(mark.anchor), kind: "rate", source: mark.provenance.sourceId,
      detail: {
        contact: { callsign: `${flank} ${rate}` },
        color: RATE_MARK_COLOR,
        remarks: {
          text: lang === "en"
            ? `${flank}: ${rate}, towards ${roundBearing(mark.bearingDeg)}° · ${mark.provenance.sourceId}, observed ${observed}`
            : `${flank}: ${rate}, suuntaan ${roundBearing(mark.bearingDeg)}° · ${mark.provenance.sourceId}, havainto klo ${observed}`,
        },
      },
    }));
  }

  // GeoChat: every report delivered in the step, and the duty officer's messages.
  for (const b of input.bubbles) events.push(chatEvent(cycle, ctx, bubbleMessage(b), positionOf));
  for (const line of input.chatLines ?? []) events.push(chatEvent(cycle, ctx, line, positionOf));

  return sortCotEvents(events);
}

/** A (`time`, `uid`) pair seen twice in one stream: two different events would claim the same object at the same instant. */
export class DuplicateCotEventError extends Error {
  constructor(readonly uid: string, readonly time: string) {
    super(`two CoT events share uid ${uid} at ${time}`);
    this.name = "DuplicateCotEventError";
  }
}

/**
 * Compiles a whole session: each view step's input (the practice view and V1–V14, both steps of a
 * merged view) in turn, the events sorted by (`time`, `uid`). The inputs come from the render tree
 * (`tools/tak/export.ts` `sessionCotInputs` drives `applyRenderEvent` over the scenario headlessly).
 */
export function compileSessionCot(inputs: readonly ViewCotInput[]): CotEvent[] {
  const events = sortCotEvents(inputs.flatMap(compileViewCot));
  for (let i = 1; i < events.length; i++) {
    const a = events[i - 1]!;
    const b = events[i]!;
    if (a.uid === b.uid && a.time === b.time) throw new DuplicateCotEventError(b.uid, b.time);
  }
  return events;
}
