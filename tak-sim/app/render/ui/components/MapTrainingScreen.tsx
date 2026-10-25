/**
 * The map training's screen (researcher decision 25 Oct 2026; SPEC/08 (bj); `app/session/map-training.ts`): the neutral extract
 * (the session's basemap tile, `topo-en` in English sessions) beside one task at a time. A task is answered once — an option, or a tap
 * on the map (a second tap moves the mark) — and its feedback follows: the right answer drawn on the map and a short explanation of how
 * it works in the simulation, then "Next task". The memory task shows the unit for a few seconds, then the blank memory-check map. A
 * two-tap measure tool mirrors the TAK shell's R&B (Mittaa): its readings on a task are logged with the answer. The countdown is the
 * session's own cap. The same for both groups and both audiences.
 */

import { useEffect, useState } from "preact/hooks";
import type { SessionOrchestrator, SessionSnapshot } from "../../../session/orchestrator.js";
import { MAP_TRAINING } from "../../../session/map-training.js";
import { isPointTask, type Pt, type TrainingTask } from "../../../session/map-training-spec.js";
import { topoTileUrl } from "../../../i18n/place-names.js";
import { assetUrl } from "../../../session/asset-url.js";
import { MAP_TRAINING_TEXT } from "../../../i18n/map-training-texts.js";
import { answerDotMarkup, extractImage, feedbackMarkup, KEY_COLOUR, MARK_COLOUR, scaleBarMarkup, taskMarkup } from "../map-training-overlay.js";
import { formatBearing, formatRange } from "../tak/RangeBearing.js";
import { TAK } from "../tak/theme.js";
import { useLang } from "../i18n.js";

const button = (disabled: boolean) => ({
  padding: "10px 20px", borderRadius: 6, fontSize: 14, cursor: disabled ? "default" : "pointer", color: "#e8eaed", opacity: disabled ? 0.45 : 1,
  border: "1px solid #f4a261", background: "#3a3f44",
});

/** The bearing from a to b on the extract (north up, y down), degrees. */
const bearingOf = (a: Pt, b: Pt) => ((Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI + 360) % 360;

export function MapTrainingScreen({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  const { lang, t: ui } = useLang();
  const t = MAP_TRAINING_TEXT[lang];
  const view = snapshot.mapPretest;
  const [secondsLeft, setSecondsLeft] = useState(() => orchestrator.mapPretestSecondsLeft());
  const [studyLeft, setStudyLeft] = useState(() => orchestrator.mapPretestStudySecondsLeft());
  const [choice, setChoice] = useState<string | null>(null);
  const [mark, setMark] = useState<Pt | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [rb, setRb] = useState<{ from: Pt; to: Pt | null } | null>(null);
  const [measures, setMeasures] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = setInterval(() => { setSecondsLeft(orchestrator.mapPretestSecondsLeft()); setStudyLeft(orchestrator.mapPretestStudySecondsLeft()); }, 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { setChoice(null); setMark(null); setMeasuring(false); setRb(null); setMeasures([]); setBusy(false); }, [view?.taskId]);
  useEffect(() => { setBusy(false); setMeasuring(false); setRb(null); }, [view?.phase]);
  if (!view) return null; // ended: the intro video and the practice view follow

  const task = MAP_TRAINING.tasks.find((x) => x.id === view.taskId)!;
  const spec = MAP_TRAINING;
  const size = spec.crop.size, mpp = spec.crop.metresPerPixel;
  const tile = assetUrl(topoTileUrl(`/maps/topo/${spec.crop.tile}.webp`, lang));
  const memory = task.kind === "memory";
  const blank = memory && view.phase !== "study";
  const asking = view.phase === "answer";
  const toolOn = !memory && asking;
  const last = view.position === view.taskCount;
  const ready = isPointTask(task) ? mark !== null : choice !== null;

  // The extract's drawing (authored markup from the build's JSON and the app's own strings: no participant text, so innerHTML is safe).
  const markup = extractImage(spec, tile) + (blank ? "" : taskMarkup(spec, task, view.phase, lang)) +
    (view.phase === "feedback" ? feedbackMarkup(spec, task, view.answer, lang) : "") + scaleBarMarkup(spec);

  const onMap = (e: MouseEvent) => {
    if (!asking || busy) return;
    const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const p = { x: Math.round(((e.clientX - box.left) / box.width) * size * 10) / 10, y: Math.round(((e.clientY - box.top) / box.height) * size * 10) / 10 };
    if (p.x < 0 || p.y < 0 || p.x > size || p.y > size) return;
    if (measuring) {
      if (!rb || rb.to) setRb({ from: p, to: null });
      else { setRb({ from: rb.from, to: p }); setMeasures([...measures, Math.round(Math.hypot(p.x - rb.from.x, p.y - rb.from.y) * mpp)]); }
      return;
    }
    if (isPointTask(task)) setMark(p);
  };
  const submit = () => {
    if (!ready || busy) return;
    setBusy(true);
    void orchestrator.answerMapPretest(view.taskId, isPointTask(task) ? { point: mark! } : { choiceId: choice! }, measures).catch(() => setBusy(false));
  };
  const leave = () => {
    if (busy) return;
    setBusy(true);
    void orchestrator.leaveMapPretestFeedback(view.taskId).catch(() => setBusy(false));
  };
  const rbMetres = rb?.to ? Math.hypot(rb.to.x - rb.from.x, rb.to.y - rb.from.y) * mpp : null;

  return (
    <div data-testid="map-training" style={{ display: "flex", height: "100%", overflowY: "auto", justifyContent: "center", padding: "20px 16px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 1180, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{t.title}</h1>
          <span role="timer" aria-live="off" style={{ fontSize: 15, fontVariantNumeric: "tabular-nums", color: secondsLeft <= 30 ? "#f4a261" : "#e8eaed" }}>{t.timeLeft(secondsLeft)}</span>
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, opacity: 0.85 }}>{t.intro(view.taskCount, Math.round(view.timeLimitMs / 60_000))}</p>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 520px", maxWidth: 680, display: "flex", flexDirection: "column", gap: 8 }}>
            {/* The measure tool's row keeps its height in every phase, so the map does not move between the question and its feedback. */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minHeight: 34 }}>
              {toolOn && (<>
                <button type="button" data-testid="map-training-measure" aria-pressed={measuring} onClick={() => { setMeasuring(!measuring); setRb(null); }}
                  style={{ padding: "6px 14px", borderRadius: TAK.radius, fontSize: 13, fontWeight: 700, cursor: "pointer", color: measuring ? TAK.accentInk : TAK.text, background: measuring ? TAK.accent : TAK.panelRaised, border: `1px solid ${measuring ? TAK.accent : TAK.panelBorder}` }}>
                  {ui.tak.toolbar.range_bearing}
                </button>
                {measuring && <span style={{ fontSize: 13, opacity: 0.85 }}>{rb && !rb.to ? ui.tak.rb.hintSecond : rbMetres !== null ? "" : ui.tak.rb.hintFirst}</span>}
                {measuring && rbMetres !== null && (
                  <span data-testid="map-training-rb" style={{ fontFamily: TAK.mono, fontSize: 13 }}>
                    {ui.tak.rb.range} {formatRange(rbMetres, lang)} · {ui.tak.rb.bearing} {formatBearing(bearingOf(rb!.from, rb!.to!))}
                  </span>
                )}
                {measuring && rb && <button type="button" onClick={() => setRb(null)} style={{ padding: "4px 10px", borderRadius: TAK.radius, fontSize: 12, cursor: "pointer", color: TAK.text, background: "transparent", border: `1px solid ${TAK.panelBorder}` }}>{ui.tak.rb.clear}</button>}
              </>)}
            </div>
            <svg data-testid="map-training-map" viewBox={`0 0 ${size} ${size}`} onClick={onMap} role="img" aria-label={t.title}
              style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 6, border: "1px solid #3a3f44", background: "#f4f1ea", cursor: asking && (measuring || isPointTask(task)) ? "crosshair" : "default", display: "block" }}>
              <g dangerouslySetInnerHTML={{ __html: markup }} />
              {asking && mark && <g dangerouslySetInnerHTML={{ __html: answerDotMarkup(mark) }} />}
              {asking && measuring && rb && (
                <g>
                  {rb.to && <line x1={rb.from.x} y1={rb.from.y} x2={rb.to.x} y2={rb.to.y} stroke="#ffffff" stroke-width={5} />}
                  {rb.to && <line x1={rb.from.x} y1={rb.from.y} x2={rb.to.x} y2={rb.to.y} stroke={TAK.rb} stroke-width={2.5} />}
                  <circle cx={rb.from.x} cy={rb.from.y} r={4} fill={TAK.rb} stroke="#1c1b19" stroke-width={1.2} />
                  {rb.to && <circle cx={rb.to.x} cy={rb.to.y} r={4} fill={TAK.rb} stroke="#1c1b19" stroke-width={1.2} />}
                </g>
              )}
            </svg>
          </div>
          <section aria-labelledby="map-training-prompt" style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12.5, opacity: 0.7 }}>{t.progress(view.position, view.taskCount)}</div>
            <p id="map-training-prompt" data-testid="map-training-prompt" style={{ margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.45 }}>
              {view.phase === "study" && task.kind === "memory" ? t.study(task, Math.round(spec.memoryMs / 1000)) : t.prompt(task)}
            </p>
            {task.kind === "now" && <ReportRow title={t.logTitle} clock={task.report.clock} from={task.report.from} text={t.report(task)} lang={lang} />}
            {view.phase === "study" && <div role="status" style={{ fontSize: 14, color: "#f4a261" }}>{t.studyLeft(studyLeft)}</div>}
            {asking && !isPointTask(task) && <Options task={task} choice={choice} busy={busy} onChoose={setChoice} label={(id) => t.option(task, id)} />}
            {asking && isPointTask(task) && <div style={{ fontSize: 13.5, opacity: 0.85 }}>{mark ? t.marked : t.markHint}</div>}
            {asking && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {!ready && !isPointTask(task) && <span style={{ fontSize: 13, opacity: 0.7 }}>{t.chooseFirst}</span>}
                <span style={{ flex: 1 }} />
                <button type="button" data-testid="map-training-answer" disabled={!ready || busy} onClick={submit} style={button(!ready || busy)}>{t.answer}</button>
              </div>
            )}
            {view.phase === "feedback" && (
              <div data-testid="map-training-feedback" style={{ display: "flex", flexDirection: "column", gap: 10, background: "#1b1e22", border: "1px solid #33383e", borderRadius: 10, padding: 14 }}>
                {view.answer && "choiceId" in view.answer && !isPointTask(task) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14.5 }}>
                    <span><span style={{ opacity: 0.7 }}>{t.yourAnswer}:</span> {t.option(task, view.answer.choiceId)}</span>
                    <span><span style={{ opacity: 0.7 }}>{t.rightAnswer}:</span> <strong style={{ color: "#81c995" }}>{t.option(task, task.key)}</strong></span>
                  </div>
                )}
                {view.errorM !== null && <div style={{ fontSize: 14.5, fontWeight: 600 }}>{t.off(view.errorM)}</div>}
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}>{t.feedback(task)}</p>
                {isPointTask(task) && (
                  <div style={{ display: "flex", gap: 14, fontSize: 13 }}>
                    <span><span style={{ color: KEY_COLOUR, fontWeight: 800 }}>◯</span> {t.rightPlace}</span>
                    {view.answer && <span><span style={{ color: MARK_COLOUR }}>●</span> {t.yourMark}</span>}
                  </div>
                )}
                <div style={{ display: "flex" }}>
                  <span style={{ flex: 1 }} />
                  <button type="button" data-testid="map-training-next" disabled={busy} onClick={leave} style={button(busy)}>{last ? t.finish : t.next}</button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Options({ task, choice, busy, onChoose, label }: { readonly task: TrainingTask; readonly choice: string | null; readonly busy: boolean; readonly onChoose: (id: string) => void; readonly label: (id: string) => string }) {
  const options = "options" in task ? task.options : [];
  return (
    <div role="radiogroup" aria-labelledby="map-training-prompt" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={choice === o.id} data-testid={`map-training-option-${o.id}`} onClick={() => !busy && onChoose(o.id)}
          style={{ textAlign: "left", padding: "10px 12px", borderRadius: 8, fontSize: 15, color: "#e8eaed", cursor: "pointer", border: `1px solid ${choice === o.id ? "#f4a261" : "#3a3f44"}`, background: choice === o.id ? "#3a2c1f" : "#20242a" }}>
          {label(o.id)}
        </button>
      ))}
    </div>
  );
}

/** The "now" task's report, drawn as a message-log row (clock, sender, text). */
function ReportRow({ title, clock, from, text, lang }: { readonly title: string; readonly clock: string; readonly from: string; readonly text: string; readonly lang: "fi" | "en" }) {
  return (
    <div style={{ background: TAK.panel, border: `1px solid ${TAK.panelBorder}`, borderRadius: TAK.radius }}>
      <div style={{ padding: "5px 10px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: TAK.accent, borderBottom: `1px solid ${TAK.panelBorder}` }}>{title}</div>
      <div data-testid="map-training-report" style={{ display: "grid", gridTemplateColumns: `40px ${lang === "en" ? 48 : 40}px 1fr`, gap: 8, fontSize: 13, lineHeight: 1.4, padding: "8px 10px" }}>
        <div style={{ opacity: 0.6, fontFamily: "monospace" }}>{clock}</div>
        <div style={{ fontWeight: 600, fontFamily: "monospace" }}>{from}</div>
        <div>{text}</div>
      </div>
    </div>
  );
}
