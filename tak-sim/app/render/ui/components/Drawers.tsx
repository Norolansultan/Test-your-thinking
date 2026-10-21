import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import type { RenderableAtom } from "../../../boundary/render-boundary.js";
import type { SessionOrchestrator } from "../../../session/orchestrator.js";
import {
  NAV_CATEGORIES,
  NAV_RESPONSE_DELAY_MS,
  NAV_TIME_WINDOWS,
  type NavTimeWindow,
} from "../../../retrieval/navigation.js";
import type { NavCategoryId } from "../../../scenario/types.js";
import { useLang } from "../i18n.js";
import { useQueryTelemetry } from "../useQueryTelemetry.js";
import { Glossed } from "../explain/Glossed.js";

/** Observation time as a scenario clock label; the scenario starts at 13:20 (SPEC/18 §2). */
function clockAt(observedAtSeconds: number, start = "13:20"): string {
  const [h, m] = start.split(":").map(Number) as [number, number];
  const total = h * 60 + m + Math.floor(observedAtSeconds / 60);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}.${String(total % 60).padStart(2, "0")}`;
}

function ResultList({ results }: { readonly results: readonly RenderableAtom[] }) {
  const { t, rec, src } = useLang();
  if (results.length === 0) return <p style={{ opacity: 0.5, fontSize: 12.5 }}>{t.noResults}</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
      {results.map((atom) => (
        <div key={atom.id} style={{ padding: 8, borderRadius: 6, background: "#1b1e22", border: "1px solid #33383e", fontSize: 12.5 }}>
          <div style={{ opacity: 0.6, marginBottom: 2, fontFamily: "monospace" }}>
            {src(atom.provenance.sourceId)} · {t.clock} {clockAt(atom.provenance.observedAt)} · {atom.record.kind}
          </div>
          <div><Glossed text={rec(atom.id, "text" in atom.record ? atom.record.text : "content" in atom.record && atom.record.content ? atom.record.content : atom.id)} surface="search" /></div>
        </div>
      ))}
    </div>
  );
}

/** Shows results only after the fixed response delay shared by every query surface (SPEC/25 §5). */
function useDelayedResults() {
  const [results, setResults] = useState<readonly RenderableAtom[] | null>(null);
  const [pending, setPending] = useState(false);
  const deliver = (get: () => Promise<readonly RenderableAtom[]> | readonly RenderableAtom[]) => {
    setPending(true);
    setResults(null);
    void Promise.resolve(get()).then((r) => {
      setTimeout(() => { setResults(r); setPending(false); }, NAV_RESPONSE_DELAY_MS);
    });
  };
  return { results, pending, deliver };
}

const inputStyle = { width: "100%", padding: 8, borderRadius: 6, border: "1px solid #3a3f44", background: "#1b1e22", color: "#e8eaed", marginBottom: 10, boxSizing: "border-box" as const };
const buttonStyle = { padding: "6px 12px", borderRadius: 6, border: "1px solid #3a3f44", background: "#2a2f34", color: "#e8eaed", cursor: "pointer", fontSize: 13 };

const slotLabel = { fontSize: 11.5, opacity: 0.6, margin: "8px 0 4px" };

function Chip({ selected, onClick, children }: { readonly selected: boolean; readonly onClick: () => void; readonly children: ComponentChildren }) {
  return (
    <button style={{ ...buttonStyle, fontSize: 12, padding: "4px 9px", background: selected ? "#3a3f44" : buttonStyle.background, borderColor: selected ? "#8a9097" : "#3a3f44" }} onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * Haku — the structured query builder (SPEC/25), identical in every group: MITÄ (topic) ×
 * KUKA (source) × MILLOIN (time window), answered from the closed corpus after a fixed delay.
 * Both groups get the free-text field below the builder (search parity, researcher decision 6 Oct 2026;
 * was the AI group's only, SPEC/06 §2.3).
 * Rendered inside the right column (RightPanel), never over the map.
 * SPEC/30 §5.4 (19 Oct 2026): the free-text field's focus, first keystroke and deletion runs are logged
 * (`useQueryTelemetry`, field `haku_search`); `cycle`, the view on screen, when the parent has the snapshot.
 */
export function HakuPanel({ orchestrator, freeText, cycle }: { readonly orchestrator: SessionOrchestrator; readonly freeText: boolean; readonly cycle?: number }) {
  const [category, setCategory] = useState<NavCategoryId | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<NavTimeWindow>("last_cycle");
  const [text, setText] = useState("");
  const typing = useQueryTelemetry("haku_search", orchestrator, cycle, text);
  const { results, pending, deliver } = useDelayedResults();
  const { t, tr, src } = useLang();
  const sources = orchestrator.navigationSources();

  const pick = <T,>(slot: "category" | "source" | "window", value: T, set: (v: T) => void) => {
    set(value);
    void orchestrator.logNavSlot(slot, value === null ? null : String(value));
  };

  return (
    <div>
      <div style={{ ...slotLabel, marginTop: 0 }}>{t.what}</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {NAV_CATEGORIES.map((c) => (
          <Chip key={c.id} selected={category === c.id} onClick={() => pick("category", c.id, setCategory)}>{tr(c.labelFi)}</Chip>
        ))}
      </div>
      <div style={slotLabel}>{t.who}</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        <Chip selected={source === null} onClick={() => pick<string | null>("source", null, setSource)}>{t.all}</Chip>
        {sources.map((s) => (
          <Chip key={s} selected={source === s} onClick={() => pick<string | null>("source", s, setSource)}>{src(s)}</Chip>
        ))}
      </div>
      <div style={slotLabel}>{t.when}</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        {NAV_TIME_WINDOWS.map((w) => (
          <Chip key={w.id} selected={timeWindow === w.id} onClick={() => pick("window", w.id, setTimeWindow)}>{tr(w.labelFi)}</Chip>
        ))}
      </div>
      <button
        style={{ ...buttonStyle, marginBottom: 10, opacity: category ? 1 : 0.5 }}
        disabled={!category || pending}
        onClick={() => category && deliver(() => orchestrator.navigateQuery({ category, sourceId: source, window: timeWindow }))}
      >
        {t.search}
      </button>
      {freeText && (
        <div style={{ borderTop: "1px solid #33383e", paddingTop: 10 }}>
          <input style={inputStyle} placeholder={t.freeTextPlaceholder} value={text} {...typing.props(setText)} />
          <button style={{ ...buttonStyle, marginBottom: 10 }} disabled={pending} onClick={() => deliver(() => orchestrator.searchAtoms(text))}>{t.searchText}</button>
        </div>
      )}
      {pending && <p style={{ opacity: 0.6, fontSize: 12.5 }}>{t.searching}</p>}
      {results && <ResultList results={results} />}
    </div>
  );
}
