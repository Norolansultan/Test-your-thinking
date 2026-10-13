/**
 * Video (SPEC/28 §5): one tile per drone in the air — a synthetic thermal frame of what its camera footprint covers,
 * drawn deterministically from the map's renderable data (`thermal-frame.ts`), with its call sign, the last battery level
 * the participant was told and the footprint's size and centre. No real video, no network. A tile shown, and a tile
 * enlarged, are logged (`tak_video_viewed`).
 */

import { useEffect, useRef } from "preact/hooks";
import type { RenderableCycle } from "../../../boundary/render-boundary.js";
import type { RadioLogEntry } from "../../../session/snapshot.js";
import { detectionColor } from "../fire-layers.js";
import { useLang } from "../i18n.js";
import { unitCallSign } from "../../../i18n/place-names.js";
import { toMgrs } from "./coords.js";
import { latestBattery, type VideoFeed } from "./shell.js";
import { footprintSize, renderThermalFrame, thermalSceneOf, THERMAL_FRAME_SIZE, type ThermalFrame } from "./thermal-frame.js";
import { paneScroll } from "./TakSidePane.js";
import { TAK } from "./theme.js";

/** Frames by drone and map step: the scene is fixed within a step, so a frame is drawn once (the snapshot updates every second). */
const frames = new Map<string, ThermalFrame>();
function frameFor(feed: VideoFeed, cycle: RenderableCycle): ThermalFrame | null {
  if (!feed.footprint) return null;
  const ring = feed.footprint[0] ?? [];
  const key = `${feed.platformId}|${cycle.index}|${cycle.stepShown}|${ring.length}|${ring[0]?.lat ?? 0}|${ring[0]?.lon ?? 0}`;
  let f = frames.get(key);
  if (!f) {
    if (frames.size > 48) frames.clear();
    const nowS = cycle.startsAtVirtual;
    f = renderThermalFrame(thermalSceneOf(feed.footprint, cycle.fire, (d: { readonly time: number }) => detectionColor((nowS - d.time) / 60) !== null));
    frames.set(key, f);
  }
  return f;
}

export function VideoPane({ feeds, cycle, log, selected, onSelect }: {
  readonly feeds: readonly VideoFeed[];
  readonly cycle: RenderableCycle | null;
  readonly log: readonly RadioLogEntry[];
  readonly selected: string | null;
  readonly onSelect: (platformId: string | null) => void;
}) {
  const { t } = useLang();
  const V = t.tak.video;
  // An enlarged drone that has landed (no tile any more) gives the whole list back.
  const enlarged = selected !== null && feeds.some((f) => f.platformId === selected) ? selected : null;
  const shown = enlarged ? feeds.filter((f) => f.platformId === enlarged) : feeds;
  return (
    <div data-testid="tak-video" style={paneScroll}>
      {enlarged && (
        <button type="button" onClick={() => onSelect(null)} style={{ alignSelf: "flex-start", minHeight: 36, padding: "4px 12px", borderRadius: TAK.radius, border: `1px solid ${TAK.panelBorder}`, background: TAK.row, color: TAK.text, cursor: "pointer", fontSize: 12.5 }}>
          ← {V.back}
        </button>
      )}
      {feeds.length === 0 && <div style={{ fontSize: 12.5, opacity: 0.6 }}>{V.none}</div>}
      {cycle && shown.map((feed) => <VideoTile key={feed.platformId} feed={feed} cycle={cycle} log={log} enlarged={enlarged === feed.platformId} onSelect={() => onSelect(enlarged === feed.platformId ? null : feed.platformId)} />)}
      {feeds.length > 0 && <div style={{ fontSize: 11, color: TAK.textDim }}>{V.synthetic}</div>}
    </div>
  );
}

function VideoTile({ feed, cycle, log, enlarged, onSelect }: { readonly feed: VideoFeed; readonly cycle: RenderableCycle; readonly log: readonly RadioLogEntry[]; readonly enlarged: boolean; readonly onSelect: () => void }) {
  const { t, lang } = useLang();
  const V = t.tak.video;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = frameFor(feed, cycle);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (frame) ctx.putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
    else { ctx.fillStyle = "#08090b"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  }, [frame]);
  const battery = latestBattery(log, feed.platformId);
  const size = feed.footprint ? footprintSize(feed.footprint) : null;
  const ring = feed.footprint?.[0] ?? [];
  const centre = ring.length > 0 ? { lat: ring.reduce((a, p) => a + p.lat, 0) / ring.length, lon: ring.reduce((a, p) => a + p.lon, 0) / ring.length } : feed.position;
  const hud = { position: "absolute" as const, padding: "2px 6px", background: "#000000a8", color: "#e9fffb", fontFamily: TAK.mono, fontSize: 11, lineHeight: 1.3, pointerEvents: "none" as const };
  return (
    <figure data-testid={`tak-video-${feed.platformId}`} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      <button type="button" onClick={onSelect} title={enlarged ? V.back : V.enlarge} aria-pressed={enlarged}
        style={{ position: "relative", display: "block", width: "100%", padding: 0, border: `1px solid ${enlarged ? TAK.accent : TAK.panelBorder}`, borderRadius: TAK.radius, overflow: "hidden", background: "#000", cursor: "pointer" }}>
        <canvas ref={canvasRef} width={THERMAL_FRAME_SIZE.width} height={THERMAL_FRAME_SIZE.height} style={{ display: "block", width: "100%", aspectRatio: `${THERMAL_FRAME_SIZE.width} / ${THERMAL_FRAME_SIZE.height}` }} />
        <span style={{ ...hud, top: 4, left: 4, fontWeight: 700 }}>{unitCallSign(lang, feed.platformId)} · {V.live}</span>
        <span style={{ ...hud, top: 4, right: 4 }}>{V.battery} {battery ? `${battery.pct} %` : V.unknown}</span>
        {!feed.footprint && <span style={{ ...hud, left: "50%", top: "50%", transform: "translate(-50%, -50%)", fontFamily: "inherit" }}>{V.noFootprint}</span>}
      </button>
      <figcaption style={{ fontSize: 11.5, color: TAK.textDim, fontFamily: TAK.mono, lineHeight: 1.4 }}>
        {size ? `${V.footprint} ≈ ${size.widthM} × ${size.heightM} m · ${toMgrs(centre, 4)}` : V.noFootprint}
        {battery && <span> · {V.battery} {battery.pct} % ({battery.clock})</span>}
      </figcaption>
    </figure>
  );
}
