/**
 * The practice feedback screen (difficulty audit, 23 Oct 2026; `proposal.md` (b.3), `proposal-map.md` c.3; content from
 * `app/session/practice-feedback.ts`), after VP and before the training text, in both groups. Source-only: for each practice question
 * it says where the information could be found. The one exception (revision (bl), 25 Oct 2026): a question whose information a search
 * finds also shows what the search would have given — the record and, the practice being unscored, the right answer and the
 * participant's own. Only the practice item's answer is ever in the view. The two map tasks teach the skill: the head mark
 * beside the head as the practice map drew it, on the basemap's own tiles (no fire layers, no units), and the measured distance with
 * how the measure tool works. The closing line names the tools the group has. Leaving it is logged with its dwell by the session.
 */

import type { SessionOrchestrator, SessionSnapshot } from "../../../session/orchestrator.js";
import { searchLessonLines, type PracticeFeedbackItem, type PracticeFeedbackView } from "../../../session/practice-feedback.js";
import { DIFFICULTY_TEXT } from "../../../i18n/difficulty-texts.js";
import { sourceName } from "../../../i18n/text.js";
import { topoTileUrl } from "../../../i18n/place-names.js";
import { assetUrl } from "../../../session/asset-url.js";
import { basemapPx, BASEMAP_TILE_PX, tilesFor } from "../basemap-px.js";
import { useLang } from "../i18n.js";

const card = { background: "#1b1e22", border: "1px solid #33383e", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 6 } as const;

export function PracticeFeedbackScreen({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  const { lang, tr } = useLang();
  const t = DIFFICULTY_TEXT[lang].feedback;
  const view = snapshot.practiceFeedback;
  if (!view) return null;
  const records = (it: PracticeFeedbackItem) => it.records.map((r) => `${sourceName(lang, r.sourceId)} ${r.clockLabel}`).join(", ");
  const where = (it: PracticeFeedbackItem) => {
    switch (it.source) {
      case "log": return t.log(records(it));
      case "map": return t.map;
      case "records": return t.records(records(it));
      case "worked_out": return t.workedOut;
    }
  };
  return (
    <div data-testid="practice-feedback" style={{ display: "flex", height: "100%", overflowY: "auto", justifyContent: "center", padding: "24px 16px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 820, display: "flex", flexDirection: "column", gap: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{t.title}</h1>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, opacity: 0.85 }}>{t.intro}</p>
        {view.items.map((it) => (
          <section key={it.itemId} data-testid={`practice-feedback-${it.itemId}`} style={card}>
            <div style={{ fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", opacity: 0.6 }}>{t.question}</div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{tr(it.promptFi)}</p>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}>{where(it)}</p>
            {it.lesson ? <SearchLesson lesson={it.lesson} lang={lang} /> : it.exampleQuestion && <p style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>{t.example(it.exampleQuestion[lang])}</p>}
          </section>
        ))}
        <section style={card} data-testid="practice-feedback-head">
          <h2 style={{ margin: 0, fontSize: 16 }}>{t.headTitle}</h2>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}>{view.head.mark ? t.head : t.headNoMark}</p>
          <HeadMap head={view.head} lang={lang} legendMark={t.legendMark} legendHead={t.legendHead} />
        </section>
        <section style={card} data-testid="practice-feedback-measure">
          <h2 style={{ margin: 0, fontSize: 16 }}>{t.measureTitle}</h2>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}>{t.measure(view.measure.km, lang === "en" ? view.measure.directionEn : view.measure.directionFi)}</p>
        </section>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, fontWeight: 600 }}>{snapshot.aiAvailable ? t.closingThinker : t.closingHaku}</p>
        <button type="button" data-testid="practice-feedback-continue" onClick={() => void orchestrator.finishPracticeFeedback().catch(() => undefined)}
          style={{ alignSelf: "flex-end", padding: "10px 20px", borderRadius: 6, border: "1px solid #f4a261", background: "#3a3f44", color: "#e8eaed", cursor: "pointer", fontSize: 14 }}>
          {t.continue}
        </button>
      </div>
    </div>
  );
}

/** (bl) What a search would have given for a records item: the question, the record and the right answer, then the participant's own answer. */
function SearchLesson({ lesson, lang }: { readonly lesson: NonNullable<PracticeFeedbackItem["lesson"]>; readonly lang: "fi" | "en" }) {
  const lines = searchLessonLines(lang, lesson);
  return (
    <>
      <p data-testid="practice-feedback-lesson" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}>{lines.lesson}</p>
      {lines.yours !== null && <p data-testid="practice-feedback-yours" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, opacity: 0.9 }}>{lines.yours}</p>}
    </>
  );
}

/** The basemap around the head (and the mark, when it is within 2 km): the drawn outline, the head in red, the mark in blue. */
function HeadMap({ head, lang, legendMark, legendHead }: { readonly head: PracticeFeedbackView["head"]; readonly lang: "fi" | "en"; readonly legendMark: string; readonly legendHead: string }) {
  const h = basemapPx(head.head);
  const m = head.mark ? basemapPx(head.mark) : null;
  const spread = m ? Math.hypot(m.x - h.x, m.y - h.y) : 0;
  const half = Math.min(500, Math.max(150, spread * 1.3)); // 600 m to 4 km across (4 m per px)
  const x0 = h.x - half, y0 = h.y - half, size = 2 * half;
  const ring = head.outline.map(basemapPx).map((p) => `${p.x},${p.y}`).join(" ");
  const r = size / 70;
  return (
    <div>
      <svg data-testid="practice-feedback-map" viewBox={`${x0} ${y0} ${size} ${size}`} style={{ width: "100%", maxWidth: 420, aspectRatio: "1 / 1", borderRadius: 6, border: "1px solid #3a3f44", background: "#f4f1ea" }} role="img">
        {tilesFor(x0, y0, x0 + size, y0 + size).map(({ row, col }) => (
          <image key={`${row}_${col}`} href={assetUrl(topoTileUrl(`/maps/topo/${row}_${col}.webp`, lang))} x={col * BASEMAP_TILE_PX} y={row * BASEMAP_TILE_PX} width={BASEMAP_TILE_PX} height={BASEMAP_TILE_PX} preserveAspectRatio="none" />
        ))}
        {ring && <polygon points={ring} fill="none" stroke="#7a2e1a" stroke-width={r / 2.5} />}
        <circle cx={h.x} cy={h.y} r={r} fill="#d93025" stroke="#ffffff" stroke-width={r / 3} />
        {m && <circle cx={m.x} cy={m.y} r={r} fill="#1a73e8" stroke="#ffffff" stroke-width={r / 3} />}
      </svg>
      <div style={{ display: "flex", gap: 14, fontSize: 13, marginTop: 6 }}>
        <span><span style={{ color: "#d93025" }}>●</span> {legendHead}</span>
        {m && <span><span style={{ color: "#1a73e8" }}>●</span> {legendMark}</span>}
      </div>
    </div>
  );
}
