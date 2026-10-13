import { useEffect, useState } from "preact/hooks";
import { TOUR_OPEN_TOOL_EVENT } from "../tour.js";
import type { RadioLogEntry, SessionOrchestrator, SessionSnapshot } from "../../../session/orchestrator.js";

import { THINKER_MAX_QUESTION_CHARS } from "../../../session/thinker-protocol.js";
import { displayAnswerText, questionRefusal } from "../../../session/chat-display.js";
import { useLang } from "../i18n.js";
import { HakuPanel } from "./Drawers.js";
import { OpenAnswerView } from "./OpenAnswerView.js";

const panelWrap = {
  width: 360, flexShrink: 0, borderLeft: "1px solid #33383e", background: "#1b1e22",
  display: "flex", flexDirection: "column" as const, minHeight: 0,
};
/** The panel's height when stacked under the map. */
const STACKED_HEIGHT = 440;
const panelHeader = { padding: "8px 12px", fontSize: 12, fontWeight: 600, opacity: 0.7, borderBottom: "1px solid #33383e" };
const scrollArea = { flex: 1, minHeight: 0, overflowY: "auto" as const, padding: 10, display: "flex", flexDirection: "column" as const, gap: 10 };
const toolButton = (active: boolean) => ({
  padding: "6px 14px", borderRadius: 6, border: "1px solid #3a3f44", background: active ? "#3a3f44" : "#2a2f34",
  color: "#e8eaed", cursor: "pointer", fontSize: 13,
});

type Tool = "haku" | "ai" | "index" | null;

/**
 * The right column, the same in both conditions (SPEC/15 §10.2, revised 25 Sep 2026): the tools
 * on top — Haku for everyone, Thinker in the AI condition (SPEC/02 revision (o) §3, formerly
 * "Tekoäly") — and the message log always below, so the log is identical between the groups and
 * nothing opens over the map. Haku / Open Thinker redesign (researcher, 8 Oct 2026): the Haku tab is
 * the structured chat (`askAiChat`, the four parts, no directive line), the same in every cell and
 * view; the AI condition's only extra is the Open Thinker (`askOpenThinker`; since revision (am) also
 * in the practice view, where the tour opens it for the Thinker practice). Every
 * question is logged. The message log has no input: nobody can ask a unit (SPEC/02 revision (j)).
 */
export function RightPanel({ snapshot, orchestrator, condition, aiPresent, hakuFreeText, stacked = false, indexedSearch = false }: {
  readonly snapshot: SessionSnapshot;
  readonly orchestrator: SessionOrchestrator;
  readonly condition: "directed" | "substitutive";
  readonly aiPresent: boolean;
  /** Haku's free-text field, per the capability matrix. */
  readonly hakuFreeText: boolean;
  /** Under the map in a narrow window (SessionView, < 1000 px): full width, a fixed height, a top border. */
  readonly stacked?: boolean;
  /** Demonstration only (11 Oct 2026, SPEC/25 (aq)): the original index-based search as a third tab; never under ?tuotanto. */
  readonly indexedSearch?: boolean;
}) {
  const [tool, setTool] = useState<Tool>(null);
  const { t, tr } = useLang();
  // Every tab change is logged (P1-1, 8 Oct 2026): haku | open_thinker | none (closed).
  const select = (next: Tool) => {
    setTool(next);
    void orchestrator.logTabSelected(next === "ai" ? "open_thinker" : next === "index" ? "indexed_search" : next ?? "none").catch(() => undefined);
  };
  const toggle = (t: Exclude<Tool, null>) => select(tool === t ? null : t);
  // Revision (am): the practice tour's Thinker step opens the Thinker tab (logged like a click on it).
  useEffect(() => {
    const open = (e: Event) => { if ((e as CustomEvent).detail === "ai" && aiPresent && condition === "substitutive" && tool !== "ai") select("ai"); };
    window.addEventListener(TOUR_OPEN_TOOL_EVENT, open);
    return () => window.removeEventListener(TOUR_OPEN_TOOL_EVENT, open);
  });
  // While a visible probe (U) is open Haku and Thinker are locked and hidden (an answer arriving meanwhile
  // waits unseen); the message log below stays usable. Same in every cell. A SPAM item no longer locks
  // them (revision (ag), 9 Oct 2026: the question is answered with the tools at hand).
  const locked = snapshot.toolsLocked;
  return (
    <div style={stacked ? { ...panelWrap, width: "100%", height: STACKED_HEIGHT, borderLeft: "none", borderTop: "1px solid #33383e" } : panelWrap}>
      <div inert={locked} style={{ display: "flex", gap: 6, padding: "8px 10px", borderBottom: "1px solid #33383e", opacity: locked ? 0.45 : 1 }}>
        <button data-tour="haku" disabled={locked} style={toolButton(tool === "haku")} onClick={() => toggle("haku")}>{t.haku}</button>
        {aiPresent && condition === "substitutive" && (
          <button data-tour="thinker" disabled={locked} style={toolButton(tool === "ai")} onClick={() => toggle("ai")}>Thinker</button>
        )}
        {indexedSearch && <button data-tour="indexed-search" disabled={locked} style={toolButton(tool === "index")} onClick={() => toggle("index")}>{t.indexedSearch}</button>}
        {tool && <button style={{ ...toolButton(false), marginLeft: "auto" }} onClick={() => select(null)} aria-label={t.closeTool}>×</button>}
      </div>
      {/* D1 (8 Oct 2026): the command directive, persistent from V8 on, identical in every cell. */}
      {snapshot.directiveInForce !== null && (
        <div data-testid="directive-banner" style={{ padding: "8px 12px", borderBottom: "1px solid #33383e", borderLeft: "3px solid #8ab4f8", background: "#20242a" }}>
          <div style={{ fontWeight: 700, fontSize: 11, opacity: 0.8, marginBottom: 2 }}>{t.directiveBanner}</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>{tr(snapshot.directiveInForce)}</div>
        </div>
      )}
      {locked && <div data-testid="tools-locked" style={{ padding: "8px 12px", fontSize: 12, opacity: 0.7, borderBottom: "1px solid #33383e" }}>{t.spam.toolsLocked}</div>}
      {/* Hidden, not unmounted, so the tool's drafts survive the question. */}
      <div inert={locked} style={{ display: locked ? "none" : "contents" }}>
        {tool === "haku" && <HakuChat snapshot={snapshot} orchestrator={orchestrator} />}
        {tool === "ai" && <OpenAiChat snapshot={snapshot} orchestrator={orchestrator} />}
        {indexedSearch && tool === "index" && <div style={scrollArea}><HakuPanel orchestrator={orchestrator} freeText /></div>}
      </div>
      <MessageLog snapshot={snapshot} orchestrator={orchestrator} />
    </div>
  );
}

/**
 * A chat's question input (revision (ah), 9 Oct 2026; review M6). The question is checked before it is
 * sent (`questionRefusal`): a refused question keeps its text and shows why under the input. The send
 * never throws out of the click path (a session that refuses it — a tool locked — keeps the text and
 * says it was not sent), and the busy state is cleared in `finally`.
 */
function useQuestion(send: (query: string) => Promise<unknown>) {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const ask = async () => {
    const refusal = questionRefusal(query, pending);
    if (refusal) {
      setNotice(refusal.kind === "too_long" ? t.questionTooLong(THINKER_MAX_QUESTION_CHARS, refusal.length) : refusal.kind === "busy" ? t.questionNotSent : null);
      return;
    }
    const asked = query;
    setPending(true);
    setNotice(null);
    setQuery("");
    try {
      await send(asked);
    } catch {
      setQuery((typed) => (typed.trim() ? typed : asked));
      setNotice(t.questionNotSent);
    } finally {
      setPending(false);
    }
  };
  const onInput = (value: string) => {
    setQuery(value);
    setNotice(value.length > THINKER_MAX_QUESTION_CHARS ? t.questionTooLong(THINKER_MAX_QUESTION_CHARS, value.length) : null);
  };
  return { query, pending, notice, ask: () => void ask(), onInput };
}

function QuestionInput({ q, placeholder }: { readonly q: ReturnType<typeof useQuestion>; readonly placeholder: string }) {
  const { t } = useLang();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, borderTop: "1px solid #33383e" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={q.query}
          onInput={(e) => q.onInput((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === "Enter" && q.ask()}
          placeholder={placeholder}
          aria-invalid={q.query.length > THINKER_MAX_QUESTION_CHARS}
          style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #3a3f44", background: "#0f1114", color: "#e8eaed" }}
        />
        <button onClick={q.ask} disabled={q.pending} style={toolButton(false)}>{t.ask}</button>
      </div>
      {q.notice && <div data-testid="question-notice" role="alert" style={{ fontSize: 12, color: "#f6c26b" }}>{q.notice}</div>}
    </div>
  );
}

/**
 * Haku's chat. Exported for the TAK shell's Haku pane (SPEC/28 §5), which shows this same component; `fill`: the chat takes
 * the whole height of the box it is given (the TAK pane's upper part, over the message log).
 */
export function HakuChat({ snapshot, orchestrator, fill = false }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator; readonly fill?: boolean }) {
  const { t } = useLang();
  const q = useQuestion((query) => orchestrator.askAiChat(query));
  const pending = q.pending;

  return (
    <div style={{ display: "flex", flexDirection: "column", ...(fill ? { flex: 1 } : { maxHeight: "58%" }), minHeight: 0, borderBottom: "1px solid #33383e" }}>
      <div style={{ ...scrollArea, flex: "0 1 auto" }}>
        {snapshot.aiChatHistory.length === 0 && <div data-testid="haku-empty" style={{ opacity: 0.4, fontSize: 12.5 }}>{t.noQuestions(t.haku)}</div>}
        {snapshot.aiChatHistory.map((turn, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ alignSelf: "flex-end", maxWidth: "85%", background: "#2a2f34", borderRadius: 8, padding: "6px 10px", fontSize: 12.5 }}>
              {turn.query}
            </div>
            <div style={{ background: "#20242a", border: "1px solid #33383e", borderRadius: 8, padding: "8px 10px", fontSize: 12, display: "grid", gridTemplateColumns: "76px 1fr", gap: "4px 8px" }}>
              {/* Review M2: the card names the tool in the session language ("Search" in English). M3: tags shown without their T-number. */}
              <div style={{ gridColumn: "1 / -1", fontWeight: 700, fontSize: 11 }}>{t.haku}</div>
              <div style={{ fontWeight: 600, opacity: 0.6, fontSize: 10.5 }}>{t.answer}</div>
              <div>{displayAnswerText(turn.answer.answerFi)}</div>
              <div style={{ fontWeight: 600, opacity: 0.6, fontSize: 10.5 }}>{t.basis}</div>
              <div style={{ opacity: 0.85 }}>{displayAnswerText(turn.answer.basisFi)}</div>
              <div style={{ fontWeight: 600, opacity: 0.6, fontSize: 10.5 }}>{t.certainty}</div>
              <div style={{ opacity: 0.85 }}>{displayAnswerText(turn.answer.certaintyFi)}</div>
              <div style={{ fontWeight: 600, opacity: 0.6, fontSize: 10.5 }}>{t.wouldChange}</div>
              <div style={{ opacity: 0.85 }}>{displayAnswerText(turn.answer.wouldChangeIfFi)}</div>
            </div>
          </div>
        ))}
        {pending && <p style={{ opacity: 0.6, fontSize: 12.5 }}>{t.searching}</p>}
      </div>
      <QuestionInput q={q} placeholder={t.askPlaceholder} />
    </div>
  );
}

/** The Open Thinker's chat. Exported for the TAK shell's Thinker pane (SPEC/28 §5), as `HakuChat`. */
export function OpenAiChat({ snapshot, orchestrator, fill = false }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator; readonly fill?: boolean }) {
  const { t, lang } = useLang();
  const q = useQuestion((query) => orchestrator.askOpenThinker(query));
  const pending = q.pending;

  return (
    <div data-tour="thinker-chat" style={{ display: "flex", flexDirection: "column", ...(fill ? { flex: 1 } : { maxHeight: "58%" }), minHeight: 0, borderBottom: "1px solid #33383e" }}>
      <div style={{ ...scrollArea, flex: "0 1 auto" }}>
        {snapshot.openThinkerHistory.length === 0 && <div data-testid="thinker-empty" style={{ opacity: 0.4, fontSize: 12.5 }}>{t.noQuestions("Thinker")}</div>}
        {snapshot.openThinkerHistory.map((turn, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ alignSelf: "flex-end", maxWidth: "85%", background: "#2a2f34", borderRadius: 8, padding: "6px 10px", fontSize: 12.5 }}>
              {turn.query}
            </div>
            <div style={{ background: "#20242a", border: "1px solid #33383e", borderRadius: 8, padding: "8px 10px", fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 11 }}>Thinker</div>
              {turn.unavailable
                ? <div data-testid="thinker-unavailable" role="status" style={{ opacity: 0.85, fontStyle: "italic" }}>{t.thinkerUnavailable}</div>
                : turn.structured
                  ? <OpenAnswerView answer={turn.structured} lang={lang} />
                  : <div style={{ whiteSpace: "pre-wrap" }}>{displayAnswerText(turn.answer)}</div>}
            </div>
          </div>
        ))}
        {pending && <p style={{ opacity: 0.6, fontSize: 12.5 }}>{t.searching}</p>}
      </div>
      <QuestionInput q={q} placeholder={t.openThinkerPlaceholder} />
    </div>
  );
}

function MessageLog({ snapshot }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  const { t } = useLang();
  return (
    <div data-tour="log" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ ...panelHeader, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{t.messageLog} ({snapshot.radioLog.length})</span>
      </div>
      <div style={scrollArea}>
        {snapshot.radioLog.length === 0 && <div style={{ opacity: 0.4, fontSize: 12.5 }}>{t.noMessages}</div>}
        {snapshot.radioLog.map((entry, i) => <MessageLogRow key={i} entry={entry} />)}
      </div>
    </div>
  );
}

/**
 * One message of the log: its time, its source and its text, in the session language. Shared with the TAK shell's GeoChat
 * pane (SPEC/28 §5), so a message reads the same in both shells — its wording, time and source are never changed.
 * `wrapSource`: the TAK shell's narrower pane breaks a long source name inside its column; the classic log leaves it as it
 * always was (review 13 Oct 2026: the classic layout must not change).
 */
export function MessageLogRow({ entry, wrapSource = false }: { readonly entry: RadioLogEntry; readonly wrapSource?: boolean }) {
  const { rec, src, lang } = useLang();
  return (
    <div style={{ display: "grid", gridTemplateColumns: `40px ${lang === "en" ? 104 : 56}px 1fr`, gap: 8, fontSize: 12.5, lineHeight: 1.4, borderBottom: "1px solid #262b31", paddingBottom: 6 }}>
      <div style={{ opacity: 0.5, fontFamily: "monospace" }}>{entry.clockLabel}</div>
      <div style={{ fontWeight: 600, fontFamily: "monospace", ...(wrapSource ? { overflowWrap: "anywhere" as const } : {}) }}>{src(entry.from)}</div>
      <div>{rec(entry.id, entry.text)}</div>
    </div>
  );
}
