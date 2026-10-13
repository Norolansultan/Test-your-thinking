/**
 * The Thinker card's structured answer (SPEC/14 revision (aq), 11 Oct 2026): light structure — small
 * headings for premises, options, the inference and the questions, one row per option — drawn from the
 * proxy's structured answer. A turn without it (an older proxy, a resumed session) is drawn as text by
 * the card. The words are the proxy's rendering's (`renderOpenAnswer`); nothing is added or re-judged here.
 */

import {
  OPEN_ANSWER_HEADINGS, OPEN_PREMISE_STATUS_TEXT, OPEN_VERDICT_TEXT, type OpenStructuredView,
} from "../../../session/open-answer.js";
import { displayAnswerText } from "../../../session/chat-display.js";

const heading = { fontSize: 10.5, fontWeight: 700, opacity: 0.6, textTransform: "uppercase" as const, letterSpacing: 0.3, marginTop: 2 };
const row = { display: "flex", flexDirection: "column" as const, gap: 1, paddingLeft: 8, borderLeft: "2px solid #3a3f44" };
const cite = { opacity: 0.55, fontFamily: "monospace", fontSize: 11 };

/** The times of the tags an item cites, "(15.40)", or nothing. */
function Cite({ tags, tagTimes }: { readonly tags: readonly string[]; readonly tagTimes: Readonly<Record<string, string>> }) {
  const times = [...new Set(tags.map((t) => tagTimes[t]).filter((t): t is string => t !== undefined))];
  return times.length === 0 ? null : <span style={cite}> ({times.join(", ")})</span>;
}

export function OpenAnswerView({ answer, lang }: { readonly answer: OpenStructuredView; readonly lang: "fi" | "en" }) {
  const h = OPEN_ANSWER_HEADINGS[lang];
  const label = (s: string) => s.replace(/:$/, "");
  return (
    <div data-testid="thinker-structured" data-kind={answer.kind} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {answer.facts.map((f, i) => (
        <div key={`f${i}`}>{displayAnswerText(f.text)}<Cite tags={f.tags} tagTimes={answer.tagTimes} /></div>
      ))}
      {answer.premises.length > 0 && <div style={heading}>{label(h.premises)}</div>}
      {answer.premises.map((p, i) => (
        <div key={`p${i}`} style={row}>
          <span>{displayAnswerText(p.premise)} <em style={{ opacity: 0.75 }}>({OPEN_PREMISE_STATUS_TEXT[lang][p.status]})</em><Cite tags={p.tags} tagTimes={answer.tagTimes} /></span>
        </div>
      ))}
      {answer.options.length > 0 && <div style={heading}>{label(h.options)}</div>}
      {answer.options.map((o, i) => (
        <div key={`o${i}`} data-testid="thinker-option" style={row}>
          <span><strong>{i + 1}. {displayAnswerText(o.option)}</strong><Cite tags={o.tags} tagTimes={answer.tagTimes} /></span>
          <span>{displayAnswerText(o.tradeoffs)}</span>
          {o.verdict && <span style={{ opacity: 0.8, fontStyle: "italic" }}>{OPEN_VERDICT_TEXT[lang][o.verdict]}</span>}
        </div>
      ))}
      {answer.inference && <div><span style={{ opacity: 0.7, fontStyle: "italic" }}>{h.inference}</span> {displayAnswerText(answer.inference)}</div>}
      {answer.questionsForYou.length > 0 && <div style={heading}>{label(h.questions)}</div>}
      {answer.questionsForYou.map((q, i) => <div key={`q${i}`} style={row}>{displayAnswerText(q)}</div>)}
    </div>
  );
}
