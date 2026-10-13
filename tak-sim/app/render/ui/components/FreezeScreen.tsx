import { useState } from "preact/hooks";
import type { FreezeView, SessionOrchestrator } from "../../../session/orchestrator.js";
import type { LatLon } from "../../../engine/primitives.js";
import { draftComplete, isMapItem, responsesFromDrafts, skippedResponses, type FreezeDraft } from "../../../session/freeze-answers.js";
import { FreezeMap } from "./FreezeMap.js";

import { CONFIDENCE_SCALE as CONFIDENCE_STEPS } from "../../../session/confidence.js";
import { useLang } from "../i18n.js";

/**
 * The SAGAT-style freeze (Type R) — SPEC/15 revision (r): it interrupts at its
 * pre-planned moment, whatever the participant is doing, and they continue where
 * they were afterwards. `PROBING_BLANKED` (SPEC/08 §4): the map,
 * rail and drawers are removed while this is on screen.
 *
 * One item at a time, in the freeze's order, with no going back (2 Oct 2026):
 * the blank map of a `map_point` item is on screen only during its own item,
 * and map items come last (`demo-probes.ts`), so the map's roads, lakes and
 * names can never help another answer, and no answer is revised after it.
 * Each item: the answer — one of four options, or one tap on the blank map
 * (`FreezeMap`, basemap only) — then its confidence. No source question (withdrawn
 * 2 Oct 2026, SPEC/08 amendment). "Seuraava" moves on once the item is complete; the
 * last item's button sends the freeze. The session notes each item's answer moment when it is
 * left (`markFreezeItemAnswered`; the last item's is the submission). The screen is the same in both groups.
 */
/** `showLevels`: the SA level tag (L1/L2) — shown for demonstration only; the study hides it (`?tuotanto`). */
/**
 * `allowSkip` (demonstration only, 6 Oct 2026): "skip this freeze" submits only the items answered in full
 * so far (`skippedResponses`), logged `skipped: true`; an item half-answered is left out, never sent incomplete.
 */
export function FreezeScreen({ freeze, orchestrator, showLevels = false, allowSkip = false }: { readonly freeze: FreezeView; readonly orchestrator: SessionOrchestrator; readonly showLevels?: boolean; readonly allowSkip?: boolean }) {
  const { t, tr } = useLang();
  const [drafts, setDrafts] = useState<Record<string, FreezeDraft>>({});
  const [sent, setSent] = useState(false); // one submission: the button is disabled once clicked
  const [current, setCurrent] = useState(0); // the item on screen; earlier ones cannot be reopened
  const extent = orchestrator.mapExtent; // the whole study area, the live map's opening frame (SPEC/12 revision (aj)); never framed on the fire

  const item = freeze.items[Math.min(current, freeze.items.length - 1)]!;
  const last = current >= freeze.items.length - 1;
  const itemDone = draftComplete(item, drafts[item.id]);
  const mapItem = isMapItem(item);
  const allAnswered = freeze.items.every((it) => draftComplete(it, drafts[it.id]));
  const update = (id: string, patch: Partial<FreezeDraft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const confidenceRow = (id: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.8 }}>
      <span style={{ width: 70 }}>{t.confidence}</span>
      {CONFIDENCE_STEPS.map((c) => (
        <button key={c} onClick={() => update(id, { confidence: c })} style={pill(drafts[id]?.confidence === c)}>
          {c}
        </button>
      ))}
    </div>
  );

  const submit = () => {
    setSent(true);
    orchestrator.submitFreeze(responsesFromDrafts(freeze.items, drafts)).catch(() => setSent(false)); // refused: the participant can submit again
  };
  const skip = () => {
    setSent(true);
    orchestrator.submitFreeze(skippedResponses(freeze.items, drafts), { skipped: true }).catch(() => setSent(false));
  };

  const pill = (active: boolean) => ({
    padding: "4px 10px", borderRadius: 12, fontSize: 12, cursor: "pointer",
    border: `1px solid ${active ? "#8a9097" : "#33383e"}`,
    background: active ? "#3a3f44" : "#20242a", color: "#e8eaed",
  });

  // z-index 30: above everything in the session's screen, the forced situation question (25) included — a freeze may
  // interrupt it (review 13 Oct 2026; was 20, level with the map's chrome). Only the guided tour and the window-size cover
  // (1000) are higher.
  return (
    <div style={{ position: "absolute", inset: 0, background: "#0f1114", zIndex: 30, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "16px 28px", borderBottom: "1px solid #33383e", display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, opacity: 0.6, letterSpacing: "0.06em" }}>{t.freezeTitle}</div>
          <div style={{ fontSize: 15, marginTop: 4 }}>{t.freezeNote}</div>
        </div>
        {allowSkip && (
          <button
            data-testid="skip-freeze" disabled={sent} onClick={skip}
            style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #f4a261", background: "none", color: "#f4a261", fontSize: 12, cursor: "pointer" }}
          >{t.skipFreeze}</button>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 28px", display: "flex", flexDirection: "column" }}>
        {/* A map item fills the screen, its question at the top left; an option item stays a centred card. */}
        {/* A map item's card never shrinks below its content (flex-basis auto, min-height auto): at 1280×529 the
            map's min-height overflowed a shrunk card and the confidence pills sat on the map (review 9 Oct 2026).
            When the window is too low the panel scrolls instead. */}
        <div style={mapItem ? { flex: "1 0 auto", display: "flex", flexDirection: "column" } : { width: "100%", maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        {[item].map((item) => (
          <div key={item.id} style={{ background: "#1b1e22", border: `1px solid ${itemDone ? "#4a5058" : "#33383e"}`, borderRadius: 8, padding: 16, ...(mapItem ? { flex: "1 0 auto", display: "flex", flexDirection: "column" } : {}) }}>
            {/* Revision (ap): a map item's confidence row sits beside its question, so the map gets the height. */}
            <div style={mapItem ? { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 6 } : {}}>
              <div>
                <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 6 }}>{current + 1}/{freeze.items.length}{showLevels ? ` · ${item.level}` : ""}</div>
                <div style={{ fontSize: 14, marginBottom: mapItem ? 0 : 10 }}>{tr(item.promptFi)}</div>
              </div>
              {mapItem && confidenceRow(item.id)}
            </div>
            {isMapItem(item) ? (
              <FreezeMap extent={extent} point={drafts[item.id]?.point ?? null} onPick={(p: LatLon, camera) => { update(item.id, { point: p }); void orchestrator.logFreezeMapPick(item.id, p, camera).catch(() => undefined); }} />
            ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 12 }}>
              {item.options.map((opt) => (
                <label
                  key={opt.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, fontSize: 13, cursor: "pointer",
                    border: `1px solid ${drafts[item.id]?.optionId === opt.id ? "#8a9097" : "#3a3f44"}`,
                    background: drafts[item.id]?.optionId === opt.id ? "#2a2f34" : "#20242a",
                  }}
                >
                  <input
                    type="radio" name={item.id} style={{ margin: 0 }}
                    checked={drafts[item.id]?.optionId === opt.id}
                    onChange={() => update(item.id, { optionId: opt.id })}
                  />
                  {tr(opt.labelFi)}
                </label>
              ))}
            </div>
            )}
            {!mapItem && confidenceRow(item.id)}
          </div>
        ))}
        </div>
      </div>
      <div style={{ padding: "14px 28px", borderTop: "1px solid #33383e", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <button
          onClick={() => { if (last) submit(); else { void orchestrator.markFreezeItemAnswered(item.id, responsesFromDrafts([item], drafts)[0]); setCurrent((c) => c + 1); } }}
          disabled={!itemDone || (last && (!allAnswered || sent))}
          style={{
            padding: "10px 20px", borderRadius: 6, border: "none", fontSize: 15, fontWeight: 600, cursor: itemDone ? "pointer" : "default",
            background: itemDone ? "#f4a261" : "#3a3f44", color: itemDone ? "#1c1b19" : "#8a8f96",
          }}
        >
          {last ? t.freezeSubmit : t.freezeNext}
        </button>
        <span style={{ fontSize: 13, opacity: 0.7 }}>{t.freezeProgress(current + 1, freeze.items.length)} · {t.freezeNoReturn}</span>
      </div>
    </div>
  );
}
