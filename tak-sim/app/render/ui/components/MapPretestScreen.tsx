/**
 * The map-reading pretest's screen (difficulty audit, 23 Oct 2026; `proposal-map.md` c.2; `app/session/map-pretest.ts`): the
 * extract with its grid and marks (`pretest-overlay.ts`, the session's basemap tile: `topo-en` in English sessions) beside one item at a
 * time. A choice is final once "Next" is pressed; no going back, no confidence, no feedback. The countdown is the session's own cap.
 * The same for both groups and both audiences.
 */

import { useEffect, useState } from "preact/hooks";
import type { SessionOrchestrator, SessionSnapshot } from "../../../session/orchestrator.js";
import { MAP_PRETEST } from "../../../session/map-pretest.js";
import { topoTileUrl } from "../../../i18n/place-names.js";
import { assetUrl } from "../../../session/asset-url.js";
import { DIFFICULTY_TEXT } from "../../../i18n/difficulty-texts.js";
import { pretestSvg } from "../pretest-overlay.js";
import { useLang } from "../i18n.js";

const button = (disabled: boolean) => ({
  padding: "10px 20px", borderRadius: 6, fontSize: 14, cursor: disabled ? "default" : "pointer", color: "#e8eaed", opacity: disabled ? 0.45 : 1,
  border: "1px solid #f4a261", background: "#3a3f44",
});

export function MapPretestScreen({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  const { lang } = useLang();
  const t = DIFFICULTY_TEXT[lang].pretest;
  const view = snapshot.mapPretest;
  const [secondsLeft, setSecondsLeft] = useState(() => orchestrator.mapPretestSecondsLeft());
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setSecondsLeft(orchestrator.mapPretestSecondsLeft()), 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { setChoice(null); setBusy(false); }, [view?.itemId]);
  if (!view) return null; // ended: the intro video and the practice view follow

  const tile = assetUrl(topoTileUrl(`/maps/topo/${MAP_PRETEST.crop.tile}.webp`, lang));
  const last = view.position === view.itemCount;
  const submit = () => {
    if (choice === null || busy) return;
    setBusy(true);
    void orchestrator.answerMapPretest(view.itemId, choice).catch(() => setBusy(false));
  };
  return (
    <div data-testid="map-pretest" style={{ display: "flex", height: "100%", overflowY: "auto", justifyContent: "center", padding: "20px 16px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 1180, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{t.title}</h1>
          <span role="timer" aria-live="off" style={{ fontSize: 15, fontVariantNumeric: "tabular-nums", color: secondsLeft <= 30 ? "#f4a261" : "#e8eaed" }}>{t.timeLeft(secondsLeft)}</span>
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, opacity: 0.85 }}>{t.intro(view.itemCount)}</p>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* The extract: authored markup from the build's JSON (no participant text), so innerHTML is safe here. */}
          <div data-testid="map-pretest-extract" style={{ flex: "1 1 520px", maxWidth: 680, aspectRatio: "1 / 1", borderRadius: 6, overflow: "hidden", border: "1px solid #3a3f44" }}
            dangerouslySetInnerHTML={{ __html: pretestSvg(MAP_PRETEST, tile) }} />
          <section aria-labelledby="map-pretest-stem" style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12.5, opacity: 0.7 }}>{t.progress(view.position, view.itemCount)}</div>
            <p id="map-pretest-stem" style={{ margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.45 }}>{view.stem}</p>
            <div role="radiogroup" aria-labelledby="map-pretest-stem" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {view.options.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={choice === o.id} data-testid={`map-pretest-option-${o.id}`} onClick={() => !busy && setChoice(o.id)}
                  style={{ textAlign: "left", padding: "10px 12px", borderRadius: 8, fontSize: 15, color: "#e8eaed", cursor: "pointer", border: `1px solid ${choice === o.id ? "#f4a261" : "#3a3f44"}`, background: choice === o.id ? "#3a2c1f" : "#20242a" }}>
                  {o.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {choice === null && <span style={{ fontSize: 13, opacity: 0.7 }}>{t.chooseFirst}</span>}
              <span style={{ flex: 1 }} />
              <button type="button" data-testid="map-pretest-next" disabled={choice === null || busy} onClick={submit} style={button(choice === null || busy)}>{last ? t.finish : t.next}</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
