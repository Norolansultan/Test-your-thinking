/**
 * EXCON (SPEC/28 §8) — the bottom timeline: VP + V1–V14 as segments as wide as their steps, coloured by the
 * TRUE flag, with the designed events, the hinge and a playhead; play/pause, speed and step/view jumps.
 */

import type { JSX } from "preact";
import { HINGE_AFTER_VIEW, STEP_SECONDS } from "../scenario/views.js";
import { clockOf, timelineLengthS, viewSpans } from "./timeline.js";
import { SPEEDS, type Speed } from "./playback.js";
import { FLAG_COLOR } from "./map-layers.js";
import type { ExconEvent, ExconEventKind, ExconWorld } from "./world.js";

export const EVENT_GLYPH: Readonly<Record<ExconEventKind, { readonly letter: string; readonly color: string; readonly label: string }>> = {
  intent: { letter: "I", color: "#8b949e", label: "P2 intent" },
  f7: { letter: "F7", color: "#d2a8ff", label: "F7 (20 kV)" },
  rekindle: { letter: "R", color: "#ffa657", label: "rekindle arc" },
  t4: { letter: "T4", color: "#79c0ff", label: "load-bearing T4" },
  hinge: { letter: "H", color: "#f0f6fc", label: "hinge" },
  directive: { letter: "D", color: "#56d364", label: "directive" },
  omission: { letter: "O", color: "#ff7b72", label: "omission" },
  contradiction: { letter: "C", color: "#ff2bd6", label: "contradiction" },
};

export interface TimelineBarProps {
  readonly world: ExconWorld;
  readonly positionS: number;
  readonly playing: boolean;
  readonly speed: Speed;
  readonly onTogglePlay: () => void;
  readonly onSpeed: (s: Speed) => void;
  readonly onSeek: (positionS: number) => void;
  readonly onStep: (delta: -1 | 1) => void;
  readonly onView: (delta: -1 | 1) => void;
}

function eventPosition(world: ExconWorld, e: ExconEvent): number | null {
  const first = world.timeline.find((t) => t.viewIndex === e.viewIndex && t.stepShown === 1);
  if (!first) return null;
  if (e.kind === "hinge") {
    const last = [...world.timeline].reverse().find((t) => t.viewIndex === e.viewIndex)!;
    return (last.frame + 1) * STEP_SECONDS;
  }
  return first.frame * STEP_SECONDS + (e.viewOffsetS ?? 0);
}

export function TimelineBar(props: TimelineBarProps): JSX.Element {
  const { world } = props;
  const length = timelineLengthS(world.timeline);
  const pct = (s: number) => `${(100 * s) / length}%`;
  const spans = viewSpans(world.timeline);
  const onTrackClick = (ev: MouseEvent) => {
    const el = ev.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    props.onSeek(((ev.clientX - r.left) / r.width) * length);
  };
  // Events at the same spot (the three "in hand" reports) share one glyph.
  const glyphs = new Map<string, { at: number; kind: ExconEventKind; titles: string[] }>();
  // The hinge is the white line between V7 and V8, not a glyph (it would sit on the directive's).
  for (const e of world.events.filter((x) => x.kind !== "hinge")) {
    const at = eventPosition(world, e);
    if (at === null) continue;
    const key = `${e.kind}:${Math.round(at / 120)}`;
    const g = glyphs.get(key);
    if (g) g.titles.push(e.title);
    else glyphs.set(key, { at, kind: e.kind, titles: [e.title] });
  }
  const head = Math.min(props.positionS, length);
  const frame = Math.min(Math.floor(head / STEP_SECONDS), world.timeline.length - 1);
  const step = world.timeline[frame]!;
  return (
    <div class="tl">
      <div class="tl-controls">
        <button class="btn" title="Previous view (Shift+←)" onClick={() => props.onView(-1)}>⏮</button>
        <button class="btn" title="Previous step (←)" onClick={() => props.onStep(-1)}>◀</button>
        <button class="btn btn-play" title="Play / pause (Space)" onClick={props.onTogglePlay}>{props.playing ? "❚❚ Pause" : "▶ Play"}</button>
        <button class="btn" title="Next step (→)" onClick={() => props.onStep(1)}>▶</button>
        <button class="btn" title="Next view (Shift+→)" onClick={() => props.onView(1)}>⏭</button>
        <span class="tl-sep" />
        {SPEEDS.map((s) => (
          <button key={s} class={`btn btn-speed${props.speed === s ? " on" : ""}`} onClick={() => props.onSpeed(s)} title={`${s}× virtual time`}>{s}×</button>
        ))}
        <span class="tl-sep" />
        <span class="tl-readout mono">
          {step.viewId} · step {step.stepId}{step.stepsInView === 2 ? ` (${step.stepShown}/2)` : ""} · {clockOf(step.startVirtual + (head - frame * STEP_SECONDS))}
        </span>
        <span class="tl-legend">
          {(["holds", "breach_quantitative", "breach_categorical"] as const).map((f) => (
            <span key={f} class="tl-legend-item"><i style={{ background: FLAG_COLOR[f] }} />{f === "holds" ? "holds" : f === "breach_quantitative" ? "breach Q" : "breach C"}</span>
          ))}
        </span>
      </div>
      <div class="tl-track" onClick={onTrackClick} data-testid="excon-timeline">
        <div class="tl-events">
          {[...glyphs.values()].map((g, i) => {
            const glyph = EVENT_GLYPH[g.kind];
            return (
              <span key={i} class="tl-ev" style={{ left: pct(g.at), borderColor: glyph.color, color: glyph.color }} title={g.titles.join("\n")}>
                {glyph.letter}
              </span>
            );
          })}
        </div>
        <div class="tl-views">
          {spans.map((v) => {
            const info = world.views[v.viewIndex]!;
            return (
              <div key={v.viewIndex} class={`tl-view${info.practice ? " practice" : ""}`} style={{ flexGrow: v.steps, background: info.practice ? "#30363d" : FLAG_COLOR[info.flag] }}
                title={`${info.id} ${info.clock}–${info.horizonClock} · ${info.flag}${info.isOmissionCycle ? " · OMISSION" : ""}`}>
                <span class="tl-view-label">{v.viewId}</span>
                {v.steps === 2 && <span class="tl-step-split" />}
              </div>
            );
          })}
        </div>
        <div class="tl-hinge" title={world.events.find((e) => e.kind === "hinge")?.title ?? "hinge"} style={{ left: pct((spans.find((s) => s.viewIndex === HINGE_AFTER_VIEW + 1)?.firstFrame ?? 0) * STEP_SECONDS) }}><span>HINGE</span></div>
        <div class="tl-clocks mono">
          {world.timeline.map((t) => (
            <span key={t.frame} style={{ left: pct(t.frame * STEP_SECONDS) }}>{world.weather[t.frame]?.clock ?? ""}</span>
          ))}
        </div>
        <div class="tl-head" style={{ left: pct(head) }} />
      </div>
    </div>
  );
}
