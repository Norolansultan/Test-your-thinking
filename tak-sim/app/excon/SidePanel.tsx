/**
 * EXCON (SPEC/28 §8) — the side panel: the current view's truth card, then tabs for the designed events, the
 * flags of every view, the weather / wind schedule, the participant-visible traffic and the view's CoT stream.
 */

import { Fragment, type JSX } from "preact";
import { useState } from "preact/hooks";
import { viewStartVirtual } from "../scenario/views.js";
import { clockOf, type Playhead } from "./timeline.js";
import { FLAG_COLOR, FLAG_LABEL } from "./map-layers.js";
import { EVENT_GLYPH } from "./TimelineBar.js";
import { cotRowsForView } from "./cot-hook.js";
import type { ExconEvent, ExconViewInfo, ExconWorld } from "./world.js";

type Tab = "events" | "flags" | "weather" | "traffic" | "cot";
const TABS: readonly { readonly id: Tab; readonly label: string }[] = [
  { id: "events", label: "Events" }, { id: "flags", label: "Flags" }, { id: "weather", label: "Weather" }, { id: "traffic", label: "Traffic" }, { id: "cot", label: "CoT" },
];

export interface SidePanelProps {
  readonly world: ExconWorld;
  readonly head: Playhead;
  readonly onJumpView: (viewIndex: number) => void;
  readonly onJumpFrame: (frame: number) => void;
  readonly onJumpEvent: (e: ExconEvent) => void;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function FlagChip({ flag }: { readonly flag: ExconViewInfo["flag"] }): JSX.Element {
  return <span class="chip" style={{ background: FLAG_COLOR[flag], color: "#0d1117" }}>{FLAG_LABEL[flag]}</span>;
}

function TruthCard({ view, head }: { readonly view: ExconViewInfo; readonly head: Playhead }): JSX.Element {
  return (
    <div class="card truth-card">
      <div class="row-between">
        <strong class="view-title">{view.id}{view.practice ? " · practice" : ` · phase ${view.phase}`}</strong>
        <span class="mono dim">{view.clock}–{view.horizonClock} · {view.horizonMinutes} min</span>
      </div>
      <div class="row-gap">
        <FlagChip flag={view.flag} />
        <span class="dim">accuracy: {view.accuracyLabel}</span>
        {view.isOmissionCycle && <span class="chip chip-omission">OMISSION VIEW</span>}
        {view.isContradictionView && <span class="chip chip-contra">CONTRADICTION VIEW</span>}
      </div>
      <div class="kv">
        <span>CA reason</span><span>{view.flagReason || "—"}</span>
        <span>Breach</span><span>{view.breach.length > 0 ? `${view.breachHa.toFixed(2)} ha outside, up to ${Math.round(view.breachDepthM)} m beyond the envelope` : view.flag === "holds" ? "none (within tolerance)" : "no spatial breach geometry (non-spatial)"}</span>
        <span>Truth / envelope</span><span>{view.truthHa.toFixed(1)} ha / {view.envelopeHa.toFixed(1)} ha at {view.horizonClock}</span>
        <span>Step shown</span><span>{head.step.stepId}{view.steps.length === 2 ? ` (${head.step.stepShown} of 2, merged view)` : ""}</span>
      </div>
      {view.branches.length > 0 && (
        <details class="branches">
          <summary>Branch statements (truth)</summary>
          <ul>
            {view.branches.map((b) => (
              <li key={b.id}><span class={`mark ${b.actual === true ? "yes" : b.actual === false ? "no" : "na"}`}>{b.actual === true ? "TRUE" : b.actual === false ? "false" : "n/s"}</span> {b.textFi}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function EventCard({ e, startVirtual }: { readonly e: ExconEvent; readonly startVirtual: number }): JSX.Element {
  const g = EVENT_GLYPH[e.kind];
  return (
    <div class="card ev-card" style={{ borderLeftColor: g.color }}>
      <div class="row-between">
        <strong>{e.title}</strong>
        <span class="mono dim">{e.viewOffsetS !== null ? `+${mmss(e.viewOffsetS)} (${clockOf(startVirtual + e.viewOffsetS).slice(0, 5)})` : ""}</span>
      </div>
      <div class="dim small">{e.source ? `${e.source} · ` : ""}{e.reach}</div>
      <div class="truth-line">TRUTH: {e.truth}</div>
      {e.textFi && <div class="quote">“{e.textFi}”</div>}
      {e.textEn && e.textEn !== e.textFi && <div class="quote en">“{e.textEn}”</div>}
    </div>
  );
}

function EventsTab({ world, view, onJumpEvent }: { readonly world: ExconWorld; readonly view: ExconViewInfo; readonly onJumpEvent: (e: ExconEvent) => void }): JSX.Element {
  const start = viewStartVirtual(view);
  return (
    <div>
      <h4>This view ({view.id})</h4>
      {view.events.length === 0 ? <p class="dim">No designed event in this view.</p> : view.events.map((e) => <EventCard key={e.key} e={e} startVirtual={start} />)}
      <h4>All designed events</h4>
      <ul class="ev-list">
        {world.events.map((e) => {
          const g = EVENT_GLYPH[e.kind];
          return (
            <li key={e.key} class={e.viewIndex === view.index ? "current" : ""} onClick={() => onJumpEvent(e)}>
              <span class="ev-glyph" style={{ color: g.color, borderColor: g.color }}>{g.letter}</span>
              <span class="mono">V{e.viewIndex}</span> {e.title}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FlagsTab({ world, view, onJumpView }: { readonly world: ExconWorld; readonly view: ExconViewInfo; readonly onJumpView: (i: number) => void }): JSX.Element {
  return (
    <table class="tbl">
      <thead><tr><th>View</th><th>Time</th><th>Flag</th><th>Breach</th><th>CA reason</th></tr></thead>
      <tbody>
        {world.views.map((v) => (
          <tr key={v.index} class={v.index === view.index ? "current" : ""} onClick={() => onJumpView(v.index)}>
            <td class="mono">{v.id}{v.isOmissionCycle ? " O" : ""}{v.isContradictionView ? " C" : ""}</td>
            <td class="mono">{v.clock}</td>
            <td><i class="dot" style={{ background: FLAG_COLOR[v.flag] }} />{v.flag === "holds" ? "H" : v.flag === "breach_quantitative" ? "Q" : "C"}{v.expectedFlag !== null && v.expectedFlag !== v.flag ? " ≠spec" : ""}</td>
            <td class="mono">{v.breach.length > 0 ? `${v.breachHa.toFixed(1)} ha` : "—"}</td>
            <td class="small">{v.flagReason}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function WindArrow({ fromDeg }: { readonly fromDeg: number }): JSX.Element {
  // Points the way the wind blows TO.
  return <span class="wind-arrow" style={{ transform: `rotate(${(fromDeg + 180) % 360}deg)` }}>↑</span>;
}

function WeatherTab({ world, head, onJumpFrame }: { readonly world: ExconWorld; readonly head: Playhead; readonly onJumpFrame: (f: number) => void }): JSX.Element {
  return (
    <table class="tbl">
      <thead><tr><th>View</th><th>Step</th><th>Clock</th><th>Wind from</th><th>m/s (gust)</th><th>Head ROS true / env</th><th>Area</th></tr></thead>
      <tbody>
        {world.weather.map((w) => (
          <tr key={w.frame} class={w.frame === head.frame ? "current" : ""} onClick={() => onJumpFrame(w.frame)}>
            <td class="mono">{w.viewId}</td>
            <td class="mono">{w.stepId}</td>
            <td class="mono">{w.clock}</td>
            <td class="mono"><WindArrow fromDeg={w.fromDeg} /> {w.fromDeg}°</td>
            <td class="mono">{w.meanMs} ({w.gustMs})</td>
            <td class={`mono${w.headActualMpm > w.headEnvelopeMpm ? " warn" : ""}`}>{w.headActualMpm} / {w.headEnvelopeMpm} m/min</td>
            <td class="mono">{w.areaHa} ha</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TrafficTab({ view, head }: { readonly view: ExconViewInfo; readonly head: Playhead }): JSX.Element {
  const t = view.traffic;
  const start = viewStartVirtual(view);
  const delivered = t.items.filter((i) => i.viewOffsetS <= head.viewOffsetS).length;
  return (
    <div>
      <div class="kv">
        <span>Pushed to the participant</span><span><strong>{t.pushedTotal}</strong>{t.pushedPerStep.length === 2 ? ` (step 1: ${t.pushedPerStep[0]}, step 2: ${t.pushedPerStep[1]})` : ""}</span>
        <span>Delivered so far</span><span>{delivered} of {t.pushedTotal} at +{mmss(head.viewOffsetS)}</span>
        <span>Duty officer</span><span>{t.dutyMessages.length === 0 ? "—" : t.dutyMessages.map((m) => (m.guidance ? "directive" : "intent")).join(", ")}</span>
        <span>Recorded by view end</span><span>{t.recordedByEnd} searchable items (T2–T4, steps ≤ {view.steps[view.steps.length - 1]})</span>
      </div>
      <p class="dim small">Delivery is virtual time into the view, as the session schedules it; a real participant's view lasts 120–150 s and plays these in order.</p>
      {t.dutyMessages.map((m, i) => <div key={`d${i}`} class="card"><strong>P2{m.guidance ? " — directive" : " — intent"}</strong><div class="quote en">“{m.textEn}”</div></div>)}
      <ul class="msg-list">
        {t.items.map((i) => (
          <li key={i.id} class={i.viewOffsetS <= head.viewOffsetS ? "done" : ""}>
            <span class="mono dim">{clockOf(start + i.viewOffsetS).slice(0, 5)}</span> <strong>{i.source}</strong> {i.textEn ?? i.textFi}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CotTab({ world, view, head }: { readonly world: ExconWorld; readonly view: ExconViewInfo; readonly head: Playhead }): JSX.Element {
  const [open, setOpen] = useState<string | null>(null);
  const result = cotRowsForView(world, view.index, head.step.stepShown);
  if (result.status === "unavailable") {
    return <div class="card"><strong>CoT not available</strong><p class="dim small">{result.reason}</p></div>;
  }
  const kinds = new Map<string, number>();
  for (const r of result.rows) kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1);
  return (
    <div>
      <p class="dim small">
        {result.rows.length} CoT events for {view.id} step {head.step.stepShown}, compiled by <span class="mono">app/tak/compile.ts</span> from the participant's render tree (SPEC/28 §2): no truth.
        {" "}{[...kinds].map(([k, n]) => `${k} ${n}`).join(" · ")}. Click a row for its XML.
      </p>
      <table class="tbl cot">
        <thead><tr><th>kind</th><th>uid</th><th>type</th><th>time</th></tr></thead>
        <tbody>
          {result.rows.map((r) => (
            <Fragment key={r.uid}>
              <tr class={open === r.uid ? "current" : ""} onClick={() => setOpen(open === r.uid ? null : r.uid)}>
                <td class="small">{r.kind}</td><td class="mono small uid">{r.callsign ? `${r.callsign} · ` : ""}{r.uid}</td><td class="mono small">{r.type}</td><td class="mono small">{r.time.slice(11, 19)}Z</td>
              </tr>
              {open === r.uid && <tr><td colSpan={4}><pre class="xml">{r.xml}</pre></td></tr>}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SidePanel(props: SidePanelProps): JSX.Element {
  const [tab, setTab] = useState<Tab>("events");
  const view = props.world.views[props.head.step.viewIndex]!;
  return (
    <aside class="side">
      <TruthCard view={view} head={props.head} />
      <nav class="tabs">
        {TABS.map((t) => <button key={t.id} class={`tab${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </nav>
      <div class="tab-body">
        {tab === "events" && <EventsTab world={props.world} view={view} onJumpEvent={props.onJumpEvent} />}
        {tab === "flags" && <FlagsTab world={props.world} view={view} onJumpView={props.onJumpView} />}
        {tab === "weather" && <WeatherTab world={props.world} head={props.head} onJumpFrame={props.onJumpFrame} />}
        {tab === "traffic" && <TrafficTab view={view} head={props.head} />}
        {tab === "cot" && <CotTab world={props.world} view={view} head={props.head} />}
      </div>
    </aside>
  );
}
