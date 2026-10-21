/**
 * Game mode, SPEC/34 §4: the decision task's card beside the map — the task and its criteria while planning, the
 * run's progress, and the result: each criterion met or not with its numbers, points and grade, the expert reference on
 * the same seed beside the player's outcome (with a switch to show it on the map), and the teaching points.
 */

import type { ComponentChildren } from "preact";
import type { GameState } from "../contracts.js";
import { GRADE_COLOR } from "../ui/Debrief.js";
import { GM, TAK } from "../ui/styles.js";
import type { DecisionTask, TaskResult } from "./contracts.js";
import type { TaskOutcome } from "./runner.js";
import { TASK_TEXT } from "./text.js";

type Lang = "fi" | "en";
const pick = (lang: Lang, fi: string, en: string): string => (lang === "fi" ? fi : en);
const ha = (lang: Lang, x: number): string => `${lang === "fi" ? x.toFixed(1).replace(".", ",") : x.toFixed(1)} ha`;

const section = { display: "flex", flexDirection: "column" as const, gap: 6 };
const h3 = { margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const, color: TAK.textDim };
const para = { margin: 0, fontSize: 13.5, lineHeight: 1.45 };

function Shell({ lang, task, heading, children, foot }: {
  readonly lang: Lang; readonly task: DecisionTask; readonly heading: string; readonly children: ComponentChildren; readonly foot?: ComponentChildren;
}) {
  const t = TASK_TEXT[lang];
  return (
    <div data-testid="task-card" style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <div style={{ padding: "10px 14px", background: TAK.panelRaised, borderBottom: `2px solid ${TAK.accent}`, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: TAK.accent, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>{t.task} · {t.topic[task.topic]}</div>
        <h2 style={{ margin: "2px 0 0", fontSize: 16, lineHeight: 1.25 }}>{pick(lang, task.titleFi, task.titleEn)}</h2>
        <div style={{ fontSize: 12, color: TAK.textDim, marginTop: 2 }}>{heading}</div>
      </div>
      <div class="gm-scroll" style={{ flex: 1, minHeight: 0, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
      {foot !== undefined && <div style={{ flexShrink: 0, padding: "10px 14px", borderTop: `1px solid ${TAK.panelBorder}`, display: "flex", gap: 8, flexWrap: "wrap" }}>{foot}</div>}
    </div>
  );
}

function Prompt({ lang, task }: { readonly lang: Lang; readonly task: DecisionTask }) {
  return (
    <div style={section} data-testid="task-prompt">
      {pick(lang, task.promptFi, task.promptEn).split("\n\n").map((p, i) => <p key={i} style={para}>{p}</p>)}
    </div>
  );
}

function CriteriaList({ lang, task, result }: { readonly lang: Lang; readonly task: DecisionTask; readonly result?: TaskResult }) {
  const t = TASK_TEXT[lang];
  return (
    <div style={section}>
      <h3 style={h3}>{t.criteria}</h3>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }} data-testid="task-criteria">
        {task.criteria.map((c) => {
          const r = result?.criteria.find((x) => x.id === c.id);
          const color = r === undefined ? TAK.textDim : r.met ? GM.ok : GM.danger;
          return (
            <li key={c.id} data-testid={`task-criterion-${c.id}`} data-met={r === undefined ? undefined : String(r.met)} style={{ display: "flex", gap: 8, fontSize: 13.5, lineHeight: 1.35 }}>
              <span aria-hidden="true" style={{ color, fontWeight: 800, width: 14, flexShrink: 0 }}>{r === undefined ? "○" : r.met ? "✓" : "✗"}</span>
              <span>
                <b style={{ fontWeight: 600 }}>{pick(lang, c.labelFi, c.labelEn)}</b>
                {r !== undefined && <span style={{ display: "block", color: TAK.textDim, fontSize: 12.5 }}>{pick(lang, r.detailFi, r.detailEn)}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PlanCard({ lang, task, orders, onCommit, onBack }: {
  readonly lang: Lang; readonly task: DecisionTask; readonly orders: number; readonly onCommit: () => void; readonly onBack: () => void;
}) {
  const t = TASK_TEXT[lang];
  return (
    <Shell lang={lang} task={task} heading={t.planHeading}
      foot={<>
        <button type="button" class="gm-btn primary" onClick={onCommit} data-testid="task-commit">{t.commit}</button>
        <button type="button" class="gm-btn" onClick={onBack} data-testid="task-back">{t.back}</button>
      </>}>
      <Prompt lang={lang} task={task} />
      <CriteriaList lang={lang} task={task} />
      <div style={{ ...section, fontSize: 12.5, color: TAK.textDim }}>
        <span>{t.planHint}</span>
        <span data-testid="task-orders-given" style={{ color: TAK.text }}>{t.ordersGiven(orders)} {t.commitHint}</span>
      </div>
    </Shell>
  );
}

export function RunCard({ lang, task, state, startS, endS, onSkip }: {
  readonly lang: Lang; readonly task: DecisionTask; readonly state: GameState; readonly startS: number; readonly endS: number; readonly onSkip: () => void;
}) {
  const t = TASK_TEXT[lang];
  const pct = Math.max(0, Math.min(100, ((state.tS - startS) / Math.max(1, endS - startS)) * 100));
  return (
    <Shell lang={lang} task={task} heading={t.runHeading}
      foot={<button type="button" class="gm-btn primary" onClick={onSkip} data-testid="task-skip">{t.skip}</button>}>
      <div style={section}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: TAK.mono, fontSize: 13 }}>
          <span>{state.clockLabel}</span><span>{ha(lang, state.score.burnedHa)}</span>
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} data-testid="task-progress"
          style={{ height: 8, borderRadius: 4, background: "#000a", overflow: "hidden" }}>
          <i style={{ display: "block", height: "100%", width: `${pct}%`, background: TAK.accent }} />
        </div>
        <span style={{ fontSize: 12.5, color: TAK.textDim }}>{task.allowLaterOrders === true ? t.runOpen : t.runLocked}</span>
      </div>
      <CriteriaList lang={lang} task={task} />
    </Shell>
  );
}

function Grade({ lang, result, label }: { readonly lang: Lang; readonly result: Pick<TaskResult, "grade" | "points">; readonly label: string }) {
  const t = TASK_TEXT[lang];
  const c = GRADE_COLOR[result.grade];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div aria-label={`${t.grade} ${result.grade}`} style={{ width: 44, height: 44, flex: "none", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: c, border: `2px solid ${c}`, background: TAK.panelRaised }}>{result.grade}</div>
      <div style={{ fontSize: 12.5, color: TAK.textDim }}>{label}<br /><b style={{ color: TAK.text, fontFamily: TAK.mono, fontSize: 16 }}>{result.points}</b> {t.points.toLowerCase()}</div>
    </div>
  );
}

export function ResultCard({ lang, task, result, mine, reference, showExpert, onToggleExpert, onTryAgain, onBack }: {
  readonly lang: Lang; readonly task: DecisionTask; readonly result: TaskResult; readonly mine: GameState;
  readonly reference: TaskOutcome | null; readonly showExpert: boolean; readonly onToggleExpert: () => void;
  readonly onTryAgain: () => void; readonly onBack: () => void;
}) {
  const t = TASK_TEXT[lang];
  const met = result.criteria.filter((c) => c.met).length;
  const ref = reference?.result ?? null;
  const row = (label: string, a: string, b: string) => (
    <tr style={{ borderBottom: `1px solid ${TAK.panelBorder}` }}>
      <td style={{ padding: "4px 0" }}>{label}</td>
      <td style={{ padding: "4px 0", textAlign: "right", fontFamily: TAK.mono }}>{a}</td>
      <td style={{ padding: "4px 0", textAlign: "right", fontFamily: TAK.mono }}>{b}</td>
    </tr>
  );
  return (
    <Shell lang={lang} task={task} heading={t.resultHeading}
      foot={<>
        <button type="button" class="gm-btn primary" onClick={onTryAgain} data-testid="task-try-again">{t.tryAgain}</button>
        <button type="button" class="gm-btn" onClick={onBack} data-testid="task-back">{t.back}</button>
      </>}>
      <div style={{ ...section, gap: 10 }} data-testid="task-result" data-all-met={String(result.allMet)}>
        <div style={{ fontSize: 15, fontWeight: 700, color: result.allMet ? GM.ok : GM.fire }}>{result.allMet ? t.allMet : t.someMet(met, result.criteria.length)}</div>
        <Grade lang={lang} result={result} label={t.you} />
      </div>
      <CriteriaList lang={lang} task={task} result={result} />
      <div style={section} data-testid="task-reference">
        <h3 style={h3}>{t.expertHeading}</h3>
        {reference === null || ref === null ? <span style={{ fontSize: 13, color: TAK.textDim }}>{t.computing}</span> : (
          <>
            <Grade lang={lang} result={ref} label={`${t.expert} · ${ref.allMet ? t.allMet : t.someMet(ref.criteria.filter((c) => c.met).length, ref.criteria.length)}`} />
            <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
              <thead><tr style={{ color: TAK.textDim, fontSize: 11.5 }}><th /><th style={{ textAlign: "right", fontWeight: 600 }}>{t.you}</th><th style={{ textAlign: "right", fontWeight: 600 }}>{t.expert}</th></tr></thead>
              <tbody>
                {row(t.burned, ha(lang, mine.score.burnedHa), ha(lang, reference.final.score.burnedHa))}
                {row(t.buildingsLost, String(mine.score.assetsLost), String(reference.final.score.assetsLost))}
                {row(t.points, String(result.points), String(ref.points))}
              </tbody>
            </table>
            <button type="button" class="gm-btn" onClick={onToggleExpert} aria-pressed={showExpert} data-testid="task-toggle-expert">{showExpert ? t.showMine : t.showExpert}</button>
            <span style={{ fontSize: 12, color: TAK.textDim }}>{t.onMap(showExpert)}</span>
            <p style={para}>{pick(lang, task.reference.explanationFi, task.reference.explanationEn)}</p>
          </>
        )}
      </div>
      <div style={section} data-testid="task-debrief">
        <h3 style={h3}>{t.teaching}</h3>
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5, fontSize: 13.5, lineHeight: 1.4 }}>
          {(lang === "fi" ? task.debriefFi : task.debriefEn).map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      </div>
    </Shell>
  );
}
