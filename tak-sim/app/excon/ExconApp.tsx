/**
 * EXCON (SPEC/28 §8) — the white cell's display: two synchronised maps (truth | the participant's picture),
 * the timeline with playback, and the side panel. RESEARCHER-ONLY: it shows truth.
 *
 * Playback runs on requestAnimationFrame; the rAF timestamp is passed into the pure `advance` (playback.ts),
 * so no wall clock is read anywhere in the EXCON logic. The maps are updated imperatively (the truth map at
 * most ~30 times a second, the participant map only when the view or its step changes); Preact re-renders the
 * panels at most ~10 times a second.
 */

import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Map as MapLibreMap } from "maplibre-gl";
import { clockOf, frameStartPosition, locate, timelineLengthS, viewStartPosition, type Playhead } from "./timeline.js";
import { advance, pause, play, seek, setSpeed, SPEEDS, type Playback } from "./playback.js";
import { truthAt } from "./motion.js";
import { boundsOf, createExconMap, linkCameras } from "./map-base.js";
import { addParticipantLayers, addTruthLayers, FLAG_COLOR, FLAG_LABEL, TRUTH_COLORS, updateParticipant, updateTruthFrame, updateTruthView } from "./map-layers.js";
import { TimelineBar } from "./TimelineBar.js";
import { SidePanel } from "./SidePanel.js";
import { EXCON_MARKER, participantPicture, type ExconEvent, type ExconWorld } from "./world.js";

const MAP_MIN_INTERVAL_MS = 33;
const UI_MIN_INTERVAL_MS = 100;

export interface ExconAppProps {
  readonly world: ExconWorld;
  readonly initial: Playback;
}

function Legend({ items }: { readonly items: readonly { readonly label: string; readonly swatch: JSX.Element }[] }): JSX.Element {
  return (
    <div class="legend">
      {items.map((i) => <div key={i.label} class="legend-row">{i.swatch}<span>{i.label}</span></div>)}
    </div>
  );
}
const fillSw = (c: string, o = 0.5) => <i class="sw" style={{ background: c, opacity: o }} />;
const lineSw = (c: string, dashed = false) => <i class="sw sw-line" style={{ borderTop: `2px ${dashed ? "dashed" : "solid"} ${c}` }} />;

export function ExconApp({ world, initial }: ExconAppProps): JSX.Element {
  const length = timelineLengthS(world.timeline);
  const truthEl = useRef<HTMLDivElement>(null);
  const partEl = useRef<HTMLDivElement>(null);
  const maps = useRef<{ truth: MapLibreMap | null; part: MapLibreMap | null; truthReady: boolean; partReady: boolean }>({ truth: null, part: null, truthReady: false, partReady: false });
  const pb = useRef<Playback>(initial);
  const drawn = useRef({ positionS: -1, truthView: -1, partKey: "", mapAt: -Infinity, uiAt: -Infinity, frame: -1, lastTs: 0 });
  const [head, setHead] = useState<Playhead>(() => locate(world.timeline, initial.positionS));
  const [ui, setUi] = useState({ playing: initial.playing, speed: initial.speed });

  /** Brings both maps and the panels to the playback position; `force` ignores the frame-rate throttles. */
  const draw = (force: boolean, ts: number) => {
    const p = pb.current;
    const h = locate(world.timeline, p.positionS);
    const d = drawn.current;
    const m = maps.current;
    if (m.truth && m.truthReady) {
      if (d.truthView !== h.step.viewIndex) { updateTruthView(m.truth, world.views[h.step.viewIndex]!); d.truthView = h.step.viewIndex; }
      if (p.positionS !== d.positionS && (force || ts - d.mapAt >= MAP_MIN_INTERVAL_MS)) {
        updateTruthFrame(m.truth, truthAt(world, h));
        d.positionS = p.positionS;
        d.mapAt = ts;
      }
    }
    const partKey = `${h.step.viewIndex}:${h.step.stepShown}`;
    if (m.part && m.partReady && d.partKey !== partKey) {
      updateParticipant(m.part, participantPicture(world.scenario, h.step.viewIndex, h.step.stepShown));
      d.partKey = partKey;
    }
    if (force || h.frame !== d.frame || ts - d.uiAt >= UI_MIN_INTERVAL_MS) {
      setHead(h);
      d.uiAt = ts;
      d.frame = h.frame;
    }
    if (ui.playing !== p.playing || ui.speed !== p.speed) setUi({ playing: p.playing, speed: p.speed });
  };
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const update = (next: Playback) => {
    pb.current = next;
    drawRef.current(true, drawn.current.lastTs);
  };

  // The animation loop: the rAF timestamp drives `advance` (no wall clock read here).
  useEffect(() => {
    let raf = 0;
    const tick = (ts: number) => {
      drawn.current.lastTs = ts;
      pb.current = advance(pb.current, ts, length);
      drawRef.current(false, ts);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // The two maps, on the participant's basemap, cameras linked.
  useEffect(() => {
    if (!truthEl.current || !partEl.current) return;
    const bounds = boundsOf(world.site.steps.flatMap((s) => [s.truthAtEnd, ...s.truthDetached]), 450);
    const truth = createExconMap(truthEl.current, { dim: true, bounds });
    const part = createExconMap(partEl.current, { dim: false, bounds });
    maps.current.truth = truth;
    maps.current.part = part;
    linkCameras(truth, part);
    truth.on("load", () => {
      addTruthLayers(truth);
      maps.current.truthReady = true;
      drawn.current.truthView = -1;
      drawn.current.positionS = -1;
      drawRef.current(true, drawn.current.lastTs);
      truth.once("idle", () => truthEl.current?.setAttribute("data-ready", "1"));
    });
    part.on("load", () => {
      addParticipantLayers(part);
      maps.current.partReady = true;
      drawn.current.partKey = "";
      drawRef.current(true, drawn.current.lastTs);
      part.once("idle", () => partEl.current?.setAttribute("data-ready", "1"));
    });
    return () => { truth.remove(); part.remove(); maps.current = { truth: null, part: null, truthReady: false, partReady: false }; };
  }, []);

  const togglePlay = () => update(pb.current.playing ? pause(pb.current) : play(pb.current, length));
  const seekTo = (s: number) => update(seek(pb.current, s, length));
  const stepBy = (delta: -1 | 1) => {
    const h = locate(world.timeline, pb.current.positionS);
    // Back from inside a step returns to its start first.
    const target = delta < 0 && h.fraction > 0.02 ? h.frame : h.frame + delta;
    seekTo(frameStartPosition(Math.min(Math.max(target, 0), world.timeline.length - 1)));
  };
  const viewBy = (delta: -1 | 1) => {
    const h = locate(world.timeline, pb.current.positionS);
    const atStart = h.step.stepShown === 1 && h.fraction < 0.02;
    const target = delta < 0 && !atStart ? h.step.viewIndex : h.step.viewIndex + delta;
    seekTo(viewStartPosition(world.timeline, Math.min(Math.max(target, 0), world.views.length - 1)));
  };
  const jumpEvent = (e: ExconEvent) => {
    const first = viewStartPosition(world.timeline, e.viewIndex);
    seekTo(e.kind === "hinge" ? viewStartPosition(world.timeline, Math.min(e.viewIndex + 1, world.views.length - 1)) : first + Math.max(0, (e.viewOffsetS ?? 0) - 5));
  };

  // Keyboard: Space play/pause, ←/→ step, Shift+←/→ view, 1/2/3 speed. One listener; it calls the latest handlers.
  const keys = useRef({ togglePlay, stepBy, viewBy, update });
  keys.current = { togglePlay, stepBy, viewBy, update };
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      const k = keys.current;
      if (ev.key === " ") { ev.preventDefault(); k.togglePlay(); }
      else if (ev.key === "ArrowRight") { ev.preventDefault(); if (ev.shiftKey) k.viewBy(1); else k.stepBy(1); }
      else if (ev.key === "ArrowLeft") { ev.preventDefault(); if (ev.shiftKey) k.viewBy(-1); else k.stepBy(-1); }
      else if (ev.key === "1" || ev.key === "2" || ev.key === "3") k.update(setSpeed(pb.current, SPEEDS[Number(ev.key) - 1]!));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const view = world.views[head.step.viewIndex]!;
  const clock = clockOf(head.virtualS);
  return (
    <div class="excon" data-excon={EXCON_MARKER}>
      <header class="hdr">
        <span class="badge-excon" data-testid="excon-banner">EXCON — researcher only — shows truth</span>
        <span class="hdr-mid mono">
          <strong>{view.id}</strong> · step {head.step.stepId}{head.step.stepsInView === 2 ? ` (${head.step.stepShown}/2)` : ""} · <strong class="clock">{clock}</strong> · {ui.speed}× {ui.playing ? "▶" : "❚❚"}
          <span class="chip" style={{ background: FLAG_COLOR[view.flag], color: "#0d1117", marginLeft: 10 }}>{FLAG_LABEL[view.flag]}</span>
        </span>
        <span class="hdr-right dim small">{world.scenario.id} {world.scenario.version} · dev server only · never in the study build</span>
      </header>
      <main class="maps">
        <section class="map-pane">
          <div ref={truthEl} class="map" data-testid="excon-truth-map" data-ready="0" />
          <div class="map-title truth"><strong>TRUTH (EXCON)</strong><span>CA fire now · horizon truth · envelope &amp; breach · true positions</span></div>
          <Legend items={[
            { label: "Fire now (CA truth, continuous)", swatch: fillSw(TRUTH_COLORS.fireFill, 0.6) },
            { label: "Truth at step end", swatch: lineSw(TRUTH_COLORS.stepEnd, true) },
            { label: `Truth at horizon ${view.horizonClock}`, swatch: lineSw(TRUTH_COLORS.horizon) },
            { label: "Envelope (flag colour)", swatch: lineSw(FLAG_COLOR[view.flag], true) },
            { label: "Breach geometry", swatch: fillSw(TRUTH_COLORS.breach, 0.7) },
            { label: "Reported perimeter (participant)", swatch: lineSw(TRUTH_COLORS.reported) },
            { label: "Sensor footprints (true)", swatch: lineSw(TRUTH_COLORS.footprint, true) },
          ]} />
        </section>
        <section class="map-pane">
          <div ref={partEl} class="map" data-testid="excon-participant-map" data-ready="0" />
          <div class="map-title part"><strong>PARTICIPANT PICTURE</strong><span>render tree via the render boundary · step {head.step.stepShown === 2 ? "2" : "1"} of {view.id} · {head.step.stepShown === 2 ? view.spec.stepBoundary?.clockLabel ?? view.clock : view.clock}</span></div>
          <Legend items={[
            { label: "Reported fire (participant's layers)", swatch: lineSw("#e0301e") },
            { label: "Projection (participant's layers)", swatch: lineSw("#ff8a80", true) },
            { label: "Sensor footprints (all shown here)", swatch: lineSw(TRUTH_COLORS.footprint, true) },
            { label: "Units / aircraft: reported (AVL)", swatch: fillSw("#80e0ff", 0.9) },
          ]} />
        </section>
      </main>
      <TimelineBar world={world} positionS={head.positionS} playing={ui.playing} speed={ui.speed}
        onTogglePlay={togglePlay} onSpeed={(s) => update(setSpeed(pb.current, s))} onSeek={seekTo} onStep={stepBy} onView={viewBy} />
      <SidePanel world={world} head={head} onJumpView={(i) => seekTo(viewStartPosition(world.timeline, i))}
        onJumpFrame={(f) => seekTo(frameStartPosition(f))} onJumpEvent={jumpEvent} />
    </div>
  );
}

/** The opening playback state from the page's query (`?view=V9&at=600&speed=10&play=1`); researcher convenience. */
export function initialPlayback(world: ExconWorld, search: string): Playback {
  const q = new URLSearchParams(search);
  const id = (q.get("view") ?? "").toUpperCase();
  const view = world.views.find((v) => v.id === id);
  const at = Number(q.get("at") ?? "0");
  const speed = Number(q.get("speed") ?? "60");
  const base = view ? viewStartPosition(world.timeline, view.index) : 0;
  return {
    positionS: Math.min(Math.max(base + (Number.isFinite(at) ? at : 0), 0), timelineLengthS(world.timeline)),
    playing: q.get("play") === "1",
    speed: speed === 1 || speed === 10 || speed === 60 ? speed : 60,
    lastFrameMs: null,
  };
}

