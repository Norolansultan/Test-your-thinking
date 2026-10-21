/**
 * Game mode, SPEC/34 §5: the instructions panel ("Ohjeet / Instructions") — the same four sections wherever it opens
 * (the game's toolbar, the course, the start page):
 *   1. This task — the task's text and criteria, when a task is passed;
 *   2. Checklist — the commander's generic situation check (`course/checklist.ts`), never a hint for the task;
 *   3. Orders and keys — the game's help list;
 *   4. Map symbols — unit symbols, the status ring, fire colours and places.
 */

import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { CELL, type UnitKind, type UnitStatus } from "../../contracts.js";
import type { Lang } from "../../../i18n/lang.js";
import { CHECKLIST } from "../../course/checklist.js";
import type { DecisionTask } from "../../tasks/contracts.js";
import { stateCss } from "../fire-colors.js";
import { STATUS_COLOR, unitSymbolSvg } from "../markers.js";
import { GM, TAK } from "../styles.js";
import { GAME_TEXT, inLang } from "../text.js";
import { COURSE_TEXT } from "./course-text.js";

const KINDS: readonly UnitKind[] = ["engine", "volunteer", "tanker", "forest_unit", "ugv", "drone_thermal", "drone_vtol", "drone_water", "helicopter", "spotter"];
const STATUSES: readonly UnitStatus[] = ["idle", "moving", "working", "refilling", "returning", "en_route", "out_of_action"];

// The map's own place glyphs (markers.ts), redrawn for the legend.
const DROPLET = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2.5C9 7 5.5 10.6 5.5 14.6a6.5 6.5 0 0 0 13 0C18.5 10.6 15 7 12 2.5z" fill="#2f8fe8" stroke="#e8f4ff" stroke-width="1.6"/></svg>';
const HOUSE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5V20H3z" fill="#f2f5f7" stroke="#0d1114" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 20v-5h4v5" fill="none" stroke="#0d1114" stroke-width="1.6"/></svg>';

const h3 = { margin: "4px 0 2px", fontSize: 11.5, color: TAK.accent, textTransform: "uppercase" as const, letterSpacing: 0.5 };
const row = { display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 };
const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 10px" };

function Section({ id, title, open, children }: { readonly id: string; readonly title: string; readonly open: boolean; readonly children: ComponentChildren }) {
  return (
    <details open={open} data-testid={`game-instructions-${id}`} style={{ background: TAK.row, borderRadius: TAK.radius, border: `1px solid ${TAK.panelBorder}` }}>
      <summary style={{ cursor: "pointer", padding: "9px 10px", fontSize: 13.5, fontWeight: 700, minHeight: 24 }}>{title}</summary>
      <div style={{ padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </details>
  );
}

const swatch = (css: string) => <span style={{ width: 14, height: 14, flex: "none", borderRadius: 2, background: css, border: "1px solid #0008" }} />;

/** The panel's four sections; `task` adds "This task" on top (open). */
export function InstructionsBody({ lang, task }: { readonly lang: Lang; readonly task?: DecisionTask | undefined }) {
  const g = GAME_TEXT[lang];
  const c = COURSE_TEXT[lang].panel;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="game-instructions">
      {task && (
        <Section id="task" title={`${c.thisTask}: ${inLang(lang, task.titleFi, task.titleEn)}`} open>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{inLang(lang, task.promptFi, task.promptEn)}</p>
          <h3 style={h3}>{c.criteria}</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.45 }}>
            {task.criteria.map((k) => <li key={k.id}>{inLang(lang, k.labelFi, k.labelEn)}</li>)}
          </ul>
        </Section>
      )}
      <Section id="checklist" title={c.checklist} open={!task}>
        <p style={{ margin: 0, fontSize: 11.5, color: TAK.textDim }}>{c.checklistNote}</p>
        {CHECKLIST.map((item) => (
          <div key={item.id}>
            <h3 style={h3}>{inLang(lang, item.headingFi, item.headingEn)}</h3>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.4 }}>
              {(lang === "fi" ? item.pointsFi : item.pointsEn).map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
        ))}
      </Section>
      <Section id="keys" title={c.ordersKeys} open={false}>
        {g.help.map(([k, what]) => (
          <div key={k} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 12.5 }}>
            <span style={{ fontFamily: TAK.mono, fontWeight: 700, color: TAK.accent, minWidth: 110 }}>{k}</span>
            <span style={{ lineHeight: 1.35 }}>{what}</span>
          </div>
        ))}
      </Section>
      <Section id="symbols" title={c.symbols} open={false}>
        <h3 style={h3}>{c.unitKinds}</h3>
        <div style={grid2}>
          {KINDS.map((k) => (
            <span key={k} style={row}>
              <span style={{ width: 24, height: 18, flex: "none" }} dangerouslySetInnerHTML={{ __html: unitSymbolSvg(k) }} />{g.kind[k]}
            </span>
          ))}
        </div>
        <h3 style={h3}>{c.unitStatus}</h3>
        <div style={grid2}>
          {STATUSES.map((s) => (
            <span key={s} style={row}><span style={{ width: 14, height: 14, flex: "none", borderRadius: "50%", border: `3px solid ${STATUS_COLOR[s]}`, boxSizing: "border-box" }} />{g.status[s]}</span>
          ))}
        </div>
        <h3 style={h3}>{c.fireColours}</h3>
        <div style={grid2}>
          {([[CELL.burning, g.fireStates.burning], [CELL.smouldering, g.fireStates.smouldering], [CELL.burnedOut, g.fireStates.burnedOut], [CELL.extinguished, g.fireStates.extinguished]] as const).map(([s, label]) => (
            <span key={s} style={row}>{swatch(stateCss(s))}{label}</span>
          ))}
          <span style={row}>{swatch("rgb(255, 230, 170)")}{g.fireStates.crown}</span>
          <span style={row}>{swatch("linear-gradient(90deg, rgb(255,150,30), rgb(150,130,110))")}{g.fireStates.stale}</span>
          <span style={row}>{swatch(GM.forecast20)}{g.forecastLabel(20)}</span>
          <span style={row}>{swatch(GM.hose)}{g.order.hose_line}</span>
          <span style={row}>{swatch(GM.fireBreak)}{g.order.fire_break}</span>
        </div>
        <h3 style={h3}>{c.places}</h3>
        <div style={grid2}>
          <span style={row}><span style={{ display: "flex" }} dangerouslySetInnerHTML={{ __html: HOUSE }} />{c.settlement}</span>
          <span style={row}><span style={{ display: "flex" }} dangerouslySetInnerHTML={{ __html: DROPLET }} />{c.waterPoint}</span>
          <span style={row}><span style={{ width: 26, height: 3, flex: "none", background: "repeating-linear-gradient(90deg, #ffd400 0 8px, transparent 8px 12px)" }} />{c.powerLine}</span>
        </div>
      </Section>
    </div>
  );
}

/** The panel as an overlay on the right (the start page and the course have no toolbar). */
export function InstructionsOverlay({ lang, task, onClose }: { readonly lang: Lang; readonly task?: DecisionTask | undefined; readonly onClose: () => void }) {
  const c = COURSE_TEXT[lang];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "#0008", display: "flex", justifyContent: "flex-end" }} onClick={onClose} data-testid="game-instructions-overlay">
      <aside aria-label={c.instructions} onClick={(e) => e.stopPropagation()}
        style={{ width: "min(420px, 100vw)", height: "100%", display: "flex", flexDirection: "column", background: TAK.panel, color: TAK.text, borderLeft: `1px solid ${TAK.panelBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 4px 0 14px", background: TAK.panelRaised, borderBottom: `2px solid ${TAK.accent}`, flexShrink: 0 }}>
          <h2 style={{ margin: 0, flex: 1, fontSize: 14, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>{c.instructions}</h2>
          <button type="button" onClick={onClose} aria-label={c.panel.close} title={c.panel.close} data-testid="game-instructions-close"
            style={{ width: 44, height: 40, border: "none", borderRadius: TAK.radius, background: "transparent", color: TAK.text, fontSize: 22, lineHeight: 1, cursor: "pointer" }}>×</button>
        </div>
        <div class="gm-scroll" style={{ flex: 1, minHeight: 0, padding: 10 }}><InstructionsBody lang={lang} task={task} /></div>
      </aside>
    </div>
  );
}
