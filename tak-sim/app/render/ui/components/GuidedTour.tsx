/**
 * The guided tour overlay (SPEC/15 r.11, steps in `tour.ts`): the screen is dimmed except for the
 * element a step is about, which is ringed; a popup beside it, with an arrow pointing at it, says
 * what is found there. Steps with no target (or whose target is not on screen) sit in the middle.
 * The overlay takes every click, so nothing behind it is used while the view's time waits.
 * Enter or → goes on, ← goes back.
 */

import { useEffect, useLayoutEffect, useState } from "preact/hooks";
import type { SessionOrchestrator, SessionSnapshot } from "../../../session/orchestrator.js";
import { announceTourStep, TOUR_OPEN_TOOL_EVENT, tourSteps, type Placement } from "../tour.js";
import type { Cell } from "../../../scenario/types.js";
import { useLang } from "../i18n.js";

interface Rect { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

const POPUP_W = 340;
const GAP = 14; // between the ring and the popup; the arrow sits in it
const PAD = 6; // the ring's margin around the target

function targetRect(selector: string | null): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) return null;
  return { left: r.left - PAD, top: r.top - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD };
}

/** The side the popup goes on: the preferred one if it fits, else the roomiest. */
function sideFor(r: Rect, preferred: Placement | undefined, popupH: number): Placement {
  const room: Record<Placement, number> = {
    right: window.innerWidth - (r.left + r.width) - GAP,
    left: r.left - GAP,
    bottom: window.innerHeight - (r.top + r.height) - GAP,
    top: r.top - GAP,
  };
  const fits = (p: Placement) => (p === "left" || p === "right" ? room[p] >= POPUP_W : room[p] >= popupH);
  if (preferred && fits(preferred)) return preferred;
  return (["right", "left", "bottom", "top"] as const).find(fits) ?? (Object.entries(room).sort((a, b) => b[1] - a[1])[0]![0] as Placement);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function GuidedTour({ snapshot, orchestrator, condition, cell, allowSkip }: {
  readonly snapshot: SessionSnapshot;
  readonly orchestrator: SessionOrchestrator;
  readonly condition: "directed" | "substitutive";
  /** Revision (al): the Thinker step's text depends on the cell (`toolsTour`). */
  readonly cell?: Cell | undefined;
  /** Demonstration only: a skip button (the study runs the whole tour). */
  readonly allowSkip: boolean;
}) {
  const { t } = useLang();
  const steps = tourSteps(snapshot.tour!, condition, cell);
  const [index, setIndex] = useState(0);
  const [maxSeen, setMaxSeen] = useState(1);
  const [rect, setRect] = useState<Rect | null>(null);
  const [popupH, setPopupH] = useState(200);
  const step = steps[index]!;
  const last = index === steps.length - 1;

  useEffect(() => { setIndex(0); setMaxSeen(1); }, [snapshot.tour]);
  // Revision (am): the step on screen, for the parts that show themselves for it (the collapsed legend opens).
  useEffect(() => { announceTourStep(step.id); return () => announceTourStep(null); }, [step.id]);
  // The target can move (the map frames the fire, panels open), so it is re-measured a few times a second.
  useLayoutEffect(() => {
    const measure = () => setRect(targetRect(step.target));
    measure();
    const id = setInterval(measure, 250);
    window.addEventListener("resize", measure);
    return () => { clearInterval(id); window.removeEventListener("resize", measure); };
  }, [step.target]);

  // Revision (am): the Thinker practice step opens the Thinker tab, leaves its chat usable, and goes on once one question was answered.
  const practising = step.interactive === "thinkerPractice";
  const [example, setExample] = useState<"idle" | "sending" | "sent">("idle");
  const waiting = practising && snapshot.openThinkerHistory.length === 0;
  useEffect(() => {
    if (practising) window.dispatchEvent(new CustomEvent(TOUR_OPEN_TOOL_EVENT, { detail: "ai" }));
  }, [practising]);
  const sendExample = () => {
    if (example !== "idle") return;
    setExample("sending");
    orchestrator.askOpenThinker(t.tour.practiceThinker.example).then(() => setExample("sent"), () => setExample("idle"));
  };

  const finish = () => { orchestrator.completeTour(maxSeen).catch(() => undefined); }; // a second click finds the tour already finished
  const go = (to: number) => { setIndex(to); setMaxSeen((m) => Math.max(m, to + 1)); };
  const next = () => (waiting ? undefined : last ? finish() : go(index + 1));
  const back = () => index > 0 && go(index - 1);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Typing in the Thinker practice's own field: Enter asks there, the arrows move the caret.
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const text = t.tour.steps[step.id];
  let popup: { left: number; top: number };
  let arrow: { left: number; top: number; rotate: number } | null = null;
  if (rect) {
    const side = sideFor(rect, step.placement, popupH);
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    if (side === "right" || side === "left") {
      const left = side === "right" ? rect.left + rect.width + GAP : rect.left - GAP - POPUP_W;
      const top = clamp(cy - popupH / 2, 8, window.innerHeight - popupH - 8);
      popup = { left: clamp(left, 8, window.innerWidth - POPUP_W - 8), top };
      arrow = { left: side === "right" ? popup.left - 7 : popup.left + POPUP_W - 7, top: clamp(cy, top + 14, top + popupH - 14) - 7, rotate: side === "right" ? 45 : 225 };
    } else {
      const top = side === "bottom" ? rect.top + rect.height + GAP : rect.top - GAP - popupH;
      const left = clamp(cx - POPUP_W / 2, 8, window.innerWidth - POPUP_W - 8);
      popup = { left, top: clamp(top, 8, window.innerHeight - popupH - 8) };
      arrow = { left: clamp(cx, left + 14, left + POPUP_W - 14) - 7, top: side === "bottom" ? popup.top - 7 : popup.top + popupH - 7, rotate: side === "bottom" ? 135 : 315 };
    }
  } else {
    popup = { left: (window.innerWidth - POPUP_W) / 2, top: Math.max(8, (window.innerHeight - popupH) / 2) };
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tour-title" style={{ position: "fixed", inset: 0, zIndex: 1000, ...(practising && rect ? { pointerEvents: "none" as const } : {}) }}>
      {/* The dim layer with a hole at the target (the ring's shadow), or a plain dim layer. */}
      {rect ? (
        <div style={{ position: "fixed", left: rect.left, top: rect.top, width: rect.width, height: rect.height, borderRadius: 8, border: "2px solid #f4a261", boxShadow: "0 0 0 9999px rgba(8, 10, 12, 0.62)", pointerEvents: "none", transition: "all 0.2s ease" }} />
      ) : (
        <div style={{ position: "fixed", inset: 0, background: "rgba(8, 10, 12, 0.62)" }} />
      )}
      {/* Revision (am): in the Thinker practice only the ringed chat takes clicks; four blockers cover the rest of the screen. */}
      {practising && rect && [
        { left: 0, top: 0, right: 0, height: Math.max(0, rect.top) },
        { left: 0, top: rect.top + rect.height, right: 0, bottom: 0 },
        { left: 0, top: rect.top, width: Math.max(0, rect.left), height: rect.height },
        { left: rect.left + rect.width, top: rect.top, right: 0, height: rect.height },
      ].map((box, i) => <div key={i} data-testid="tour-blocker" style={{ position: "fixed", ...box, pointerEvents: "auto" }} />)}
      {arrow && (
        <div style={{ position: "fixed", left: arrow.left, top: arrow.top, width: 14, height: 14, background: "#2a2f34", borderLeft: "1px solid #f4a261", borderBottom: "1px solid #f4a261", transform: `rotate(${arrow.rotate}deg)`, zIndex: 2 }} />
      )}
      <div
        ref={(el) => { if (el && Math.abs(el.offsetHeight - popupH) > 2) setPopupH(el.offsetHeight); }}
        style={{ position: "fixed", left: popup.left, top: popup.top, width: POPUP_W, maxHeight: "calc(100vh - 16px)", overflowY: "auto", boxSizing: "border-box", background: "#2a2f34", color: "#e8eaed", border: "1px solid #f4a261", borderRadius: 8, padding: "14px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.45)", zIndex: 1, pointerEvents: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <h2 id="tour-title" style={{ margin: 0, fontSize: 15 }}>{text.title}</h2>
          <span style={{ fontSize: 11.5, opacity: 0.6 }}>{t.tour.progress(index + 1, steps.length)}</span>
        </div>
        <p style={{ margin: "0 0 12px 0", fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-line" }}>{text.body}</p>
        {practising && (
          <div data-testid="thinker-practice" style={{ display: "flex", flexDirection: "column", gap: 6, margin: "0 0 12px 0" }}>
            <button data-testid="thinker-practice-example" onClick={sendExample} disabled={example !== "idle"} style={{ ...button(false), textAlign: "left", lineHeight: 1.4, opacity: example === "idle" ? 1 : 0.6 }}>
              <span style={{ display: "block", fontSize: 11, opacity: 0.7, marginBottom: 2 }}>{t.tour.practiceThinker.send}</span>
              “{t.tour.practiceThinker.example}”
            </button>
            {example === "sending" && <span role="status" style={{ fontSize: 12, opacity: 0.75 }}>{t.tour.practiceThinker.answering}</span>}
            {waiting && example !== "sending" && <span style={{ fontSize: 12, opacity: 0.75 }}>{t.tour.practiceThinker.askFirst}</span>}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {allowSkip && !last && <button onClick={finish} style={linkButton}>{t.tour.skip}</button>}
          <span style={{ flex: 1 }} />
          {index > 0 && <button onClick={back} style={button(false)}>{t.tour.back}</button>}
          <button onClick={next} disabled={waiting} style={{ ...button(true), opacity: waiting ? 0.5 : 1 }} autoFocus>
            {last ? (snapshot.tour === "practice" ? t.tour.startPractice : t.tour.startView) : t.tour.next}
          </button>
        </div>
      </div>
    </div>
  );
}

const button = (primary: boolean) => ({
  padding: "7px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#e8eaed",
  border: `1px solid ${primary ? "#f4a261" : "#3a3f44"}`, background: primary ? "#3a3f44" : "#20242a",
});
const linkButton = { background: "none", border: "none", color: "#e8eaed", opacity: 0.6, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" };
