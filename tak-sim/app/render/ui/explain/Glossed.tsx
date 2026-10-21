/**
 * SPEC/35 §3 item 2: a participant-visible text with its glossary terms marked. In an expert session it renders the text
 * exactly as before (one text node, no wrapper); in a public session each term's first occurrence gets a dotted
 * underline, and its plain-language definition opens in a small tooltip — on hover with a mouse (after a short rest, so
 * sweeping across a text opens nothing), on a tap with touch or a pen, on Enter or Space from the keyboard (the term is
 * focusable); Esc, a tap elsewhere, leaving it or scrolling closes it. Each opening is reported once
 * (`onGlossaryOpened(termId, surface)`; the shell writes `glossary_opened`).
 *
 * The text is never changed (`markTerms`), and the marking is the same in both groups. The tooltip never blocks an
 * answer: it takes no pointer events, prefers the space above its term (a freeze item's options sit below its stem),
 * and a tap on a term inside an option (a freeze label, a SPAM button) opens the definition without choosing the option;
 * a mouse click there still chooses it, as on plain text. The tooltip is drawn in `document.body` (a portal), so a dimmed
 * label or a clipped panel never dims or cuts it, and it is closed as soon as its term is no longer visible (a freeze
 * blanks the screen under it). Timers only, no clock read (I1).
 */

import { createContext } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import type { JSX } from "preact";
import { useAudience, type GlossarySurface } from "../audience-context.js";
import { LangContext } from "../i18n.js";
import type { Lang } from "../../../i18n/lang.js";
import { glossedSegments, termIn } from "./glossary.js";

/** How long the mouse rests on a term before its definition opens (ms). */
export const HOVER_OPEN_MS = 300;
const TIP_WIDTH = 300;
const TIP_GAP = 6;
/** Room wanted above a term to put the tooltip there (px). */
const ROOM_ABOVE = 130;

export interface TipPosition {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  /** Drawn above the term (its bottom edge at `top`), else below it. */
  readonly above: boolean;
}

/** Where the tooltip goes for a term at `rect` in a `vw` × `vh` window: above when there is room (or more room than below), inside the window. */
export function tipPosition(rect: { readonly left: number; readonly top: number; readonly bottom: number }, vw: number, vh: number): TipPosition {
  const width = Math.max(160, Math.min(TIP_WIDTH, vw - 16));
  const above = rect.top >= ROOM_ABOVE || rect.top > vh - rect.bottom;
  const left = Math.max(8, Math.min(rect.left, vw - width - 8));
  return { left, top: above ? rect.top - TIP_GAP : rect.bottom + TIP_GAP, width, above };
}

const TERM_STYLE: JSX.CSSProperties = {
  textDecorationLine: "underline", textDecorationStyle: "dotted", textDecorationThickness: "1px", textUnderlineOffset: "3px", cursor: "help",
};

const tipStyle = (p: TipPosition): JSX.CSSProperties => ({
  position: "fixed", left: p.left, top: p.top, width: p.width, transform: p.above ? "translateY(-100%)" : "none", zIndex: 1001, pointerEvents: "none",
  boxSizing: "border-box", padding: "8px 10px", borderRadius: 6, background: "#f4f1ec", color: "#1c1b19", border: "1px solid #c9c3ba",
  boxShadow: "0 4px 14px rgba(0,0,0,0.45)", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontSize: 12.5, lineHeight: 1.4,
  fontWeight: 400, fontStyle: "normal", textTransform: "none", letterSpacing: "normal", textAlign: "left", whiteSpace: "normal", opacity: 1,
});

/** Whether the term is on screen: laid out and not under `visibility: hidden` (the freeze's blanking). */
function termVisible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
}

/** Tooltip ids, for `aria-describedby` (a counter, not a random draw). */
let tipCount = 0;

/**
 * Overrides the surface the `Glossed` texts below report (a shared component shown elsewhere: the message-log row the plan
 * review opens is a "record"). Null: each text's own surface.
 */
export const GlossSurfaceContext = createContext<GlossarySurface | null>(null);

/** `text` as the participant sees it, its glossary terms marked in a public session. */
export function Glossed({ text, surface: own }: { readonly text: string; readonly surface: GlossarySurface }) {
  const { audience } = useAudience();
  const lang = useContext(LangContext);
  const surface = useContext(GlossSurfaceContext) ?? own;
  const segments = glossedSegments(audience, lang, text);
  if (segments === null) return <>{text}</>;
  return <>{segments.map((s, i) => (s.kind === "plain" ? s.text : <GlossTerm key={i} termId={s.termId} text={s.text} surface={surface} lang={lang} />))}</>;
}

function GlossTerm({ termId, text, surface, lang }: { readonly termId: string; readonly text: string; readonly surface: GlossarySurface; readonly lang: Lang }) {
  const { onGlossaryOpened } = useAudience();
  const [tip, setTip] = useState<TipPosition | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointer = useRef("mouse");
  const id = useRef("");
  if (!id.current) id.current = `gloss-tip-${++tipCount}`;
  const open = useRef(false);
  open.current = tip !== null;

  const stopHover = () => { if (hover.current !== null) { clearTimeout(hover.current); hover.current = null; } };
  const show = () => {
    stopHover();
    const el = ref.current;
    if (open.current || !el) return;
    setTip(tipPosition(el.getBoundingClientRect(), window.innerWidth, window.innerHeight));
    onGlossaryOpened(termId, surface);
  };
  const hide = () => { stopHover(); setTip(null); };

  useEffect(() => stopHover, []);
  // A term hidden under the open tooltip (the freeze's blanking, a closed pane) closes it.
  useEffect(() => { if (tip && ref.current && !termVisible(ref.current)) hide(); });
  // While open: a press elsewhere, Esc or a scroll closes it.
  useEffect(() => {
    if (!tip) return undefined;
    const onDown = (e: Event) => { if (!ref.current?.contains(e.target as Node)) hide(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") hide(); };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", hide, true);
    };
  }, [tip !== null]);

  const term = termIn(lang, termId);
  return (
    <span
      ref={ref} role="button" tabIndex={0} aria-expanded={tip !== null} aria-describedby={tip ? id.current : undefined} data-gloss-term={termId} style={TERM_STYLE}
      onPointerEnter={(e) => { pointer.current = e.pointerType; if (e.pointerType === "mouse" && !open.current) hover.current = setTimeout(show, HOVER_OPEN_MS); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") hide(); }}
      onPointerDown={(e) => { pointer.current = e.pointerType; }}
      onClick={(e) => {
        if (pointer.current === "mouse") { show(); return; } // the option under the text is still chosen, as on plain text
        e.preventDefault(); // a tap opens the definition only: a label's radio, a button's choice stay untouched
        e.stopPropagation();
        if (open.current) hide(); else show();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); if (open.current) hide(); else show(); }
        else if (e.key === "Escape" && open.current) { e.stopPropagation(); hide(); }
      }}
      onBlur={hide}
    >
      {text}
      {tip && term && createPortal(
        <span id={id.current} role="tooltip" data-testid="gloss-tooltip" style={tipStyle(tip)}>
          <strong style={{ display: "block", marginBottom: 2 }}>{term.term}</strong>
          {term.definition}
        </span>,
        document.body,
      )}
    </span>
  );
}
