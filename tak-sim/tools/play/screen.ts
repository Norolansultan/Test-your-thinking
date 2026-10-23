/**
 * The play harness's screen (`tools/play/`): what `look` prints — the screen on show as text, in the session language with the
 * app's own strings (`UI_TEXT`, `tr`, `recordIn`, `sourceName`, the plan panel's `planSummary`), and the image requests for it.
 * Inside a view: the status strip (clock, period, the countdown when the app shows one, the units), the directive strip (V8 on),
 * Haku's "Uusia kirjauksia" badge, the consult notice, the SPAM card, a visible probe, the decision strip (the plan form, the plan
 * recorded, the plan's confidence, the plan review) and the whole message log (GeoChat, "All Chat Rooms", the TAK shell's default
 * pane), the rows that arrived since the last `look` marked; then the live map's PNG. During a freeze only the freeze screen (the
 * app blanks the map and the log): its current item, and for a map item the basemap with a pixel grid. The full-screen pages are
 * `screen-pages.ts`. Harness lines (how to answer, the period's elapsed seconds) are in English and marked `»`.
 *
 * It reads the snapshot (renderable data, no truth, I4) and the harness's own UI state; never the scenario's keys: a freeze item
 * as `screenFreezeItem` gives it, SPAM's view (`SpamView`) and the visible probe's view, which carry none.
 */

import { join } from "node:path";
import type { RadioLogEntry, SessionSnapshot } from "../../app/session/snapshot.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { recordIn, sourceName, tr } from "../../app/i18n/text.js";
import { unitCallSign } from "../../app/i18n/place-names.js";
import { chapterLabel } from "../../app/i18n/public-texts.js";
import { MAIN_VIEW_COUNT, VIEW_MAX_SECONDS, PRACTICE_VIEW_MAX_SECONDS } from "../../app/scenario/views.js";
import { DEPARTURE_NOTE_FROM_VIEW, DEPARTURE_REASONS, MAIN_EFFORT_POSTURES, PLAN_DRONE_TASK_IDS, SECONDARY_TASK_IDS } from "../../app/scenario/plan-types.js";
import { onSceneLine, planFromDraft, planSummary } from "../../app/render/ui/components/DecisionPanels.js";
import { tourSteps } from "../../app/render/ui/tour.js";
import { glossedSegments } from "../../app/render/ui/explain/glossary.js";
import { isMapItem } from "../../app/session/freeze-answers.js";
import { CONFIDENCE_SCALE } from "../../app/session/confidence.js";
import type { Lang } from "../../app/i18n/lang.js";
import type { PlaySession } from "./session.js";
import { liveMapData, type ImageRequest } from "./map-data.js";
import { openingOf, widthMetres } from "./map-camera.js";
import { pageText } from "./screen-pages.js";

/** A text with the glossary's terms marked ‹…› in a public session (the app underlines them; `glossary <term>` opens one). */
/** The letter a player types for an option (a, b, c …): the app shows option texts only, never their ids (some ids name the key). */
export function optionLetter(index: number): string {
  return String.fromCharCode(97 + index);
}

/** An option chosen by its letter or, as in runs played before the letters, by its id; null when neither. */
export function optionByArg(ids: readonly string[], arg: string | undefined): string | null {
  if (arg === undefined) return null;
  if (ids.includes(arg)) return arg;
  const i = /^[a-z]$/.test(arg) ? arg.charCodeAt(0) - 97 : -1;
  return i >= 0 && i < ids.length ? ids[i]! : null;
}

export function gl(session: PlaySession, text: string): string {
  const segs = glossedSegments(session.config.audience, session.config.lang, text);
  return segs ? segs.map((s) => (s.kind === "term" ? `‹${s.text}›` : s.text)).join("") : text;
}

/** One message-log row as `MessageLogRow` shows it: clock, source, the record's text in the session language. */
export function logRow(session: PlaySession, e: RadioLogEntry): string {
  const lang = session.config.lang;
  return `${e.clockLabel.padEnd(5)}  ${sourceName(lang, e.from)}: ${gl(session, e.id ? recordIn(lang, e.id, e.text) : tr(lang, e.text))}`;
}

const scale = CONFIDENCE_SCALE.join(" | ");
const H = (s: string) => `» ${s}`;

/** The screen on show, its image requests (paths under `runDir/screens/`, numbered by `n`). Marks the log's rows as seen. */
export function lookText(session: PlaySession, runDir: string, n: number, withMap: boolean): { readonly text: string; readonly images: ImageRequest[] } {
  const s = session.snap();
  const name = (what: string) => join(runDir, "screens", `${String(n).padStart(3, "0")}-${what}.png`);
  if (s.step === "freeze" && s.freeze) return freezeText(session, s, name("freeze-map"), withMap);
  const page = pageText(session, name, withMap);
  if (page) return page;
  const camera = session.camera();
  const images: ImageRequest[] = withMap ? [{ kind: "live", path: name("map"), data: liveMapData(s, session.scenario.extent, session.config.audience, camera, session.legendOpen, session.rb && session.rb.view === s.currentCycle ? { from: session.rb.from, to: session.rb.to } : null) }] : [];
  const lines = [...statusLines(session, s), ...interactionLines(session, s), "", ...logLines(session, s)];
  const frame = camera ? `your own frame, about ${widthMetres(camera)} m across` : `the app's opening frame, about ${widthMetres(openingOf(session.scenario.extent))} m across`;
  if (withMap) lines.push("", H(`Map (TAK, north up, ${frame}; \`map alue|palo|2km|in|out|reset [center=x,y]\` moves it, \`map legend\` shows or hides the legend): ${images[0]!.path}`));
  session.seenLog = s.radioLog.length;
  return { text: lines.join("\n"), images };
}

function statusLines(session: PlaySession, s: SessionSnapshot): string[] {
  const t = UI_TEXT[session.config.lang], lang = session.config.lang;
  const view = s.practice ? t.practiceLabel : t.viewLabel(s.currentCycle, MAIN_VIEW_COUNT);
  const chapter = session.config.audience === "public" ? chapterLabel(lang, s.currentCycle) : null;
  const units = [...s.allocation.crews, ...s.allocation.droneTeams].map((u) => unitCallSign(lang, u));
  const out = [`== ${t.clock} ${s.clockLabel} · ${view}${chapter ? ` · ${chapter}` : ""} · ${t.phase[s.cyclePhase]} · ${units.map((u) => `${u} ●`).join(" ")} · ${s.renderTree.bubbles.length} ${t.newItems} ==`];
  const periodEnded = s.spam !== null && s.spam.phase !== "ready" && s.spam.forced;
  if (s.secondsLeft !== null && s.secondsLeft > 0 && !periodEnded) out.push(t.periodEndsIn(s.secondsLeft));
  if (s.tour === null && (s.step === "exploration" || s.step === "allocation" || s.step === "awaiting_view_end")) {
    const cap = s.practice ? PRACTICE_VIEW_MAX_SECONDS : VIEW_MAX_SECONDS;
    out.push(H(`Period time ${Math.floor(session.viewSeconds())} s (the app shows no clock for it). Minimum length ${s.minViewSeconds} s: ${s.minimumReached ? "reached — confirming the plan ends the period" : "not yet reached"}; the period ends at ${cap} s at the latest. The decision panel opens at ${s.decisionOpensAtSeconds} s.`));
  }
  if (s.directiveInForce !== null) out.push(`${t.directiveBanner}: ${tr(lang, s.directiveInForce)}`);
  return out;
}

function interactionLines(session: PlaySession, s: SessionSnapshot): string[] {
  const t = UI_TEXT[session.config.lang];
  const out: string[] = [];
  if (s.tour !== null) {
    const steps = tourSteps(s.tour, s.conditionLabel, "radio");
    out.push("", `-- ${s.tour === "practice" ? "Esittely / guided tour" : "Työkalumuistutus / tool reminder"} (${steps.length}) --`);
    steps.forEach((step, i) => { const st = t.tour.steps[step.id]; out.push(`[${t.tour.progress(i + 1, steps.length)}] ${st.title}`, st.body); });
    out.push(H(`The period's time waits until the tour is finished: \`continue\` ("${s.tour === "practice" ? t.tour.startPractice : t.tour.startView}").`));
    return out;
  }
  out.push("", `${t.tak.toolbar.haku}${s.recordsBadge ? ` [${t.recordsBadge}]` : ""}${s.toolsLocked ? " (lukittu / locked)" : ""}  ·  ${t.tak.paneTitle.geochat}`);
  if (session.config.audience === "public") out.push(H("Glossary & help (public): `glossary <term>` for a ‹marked› word, `help [glossary|roster|legend]`."));
  if (s.consultPrompt) out.push(`[${t.consult.notice}]  ${t.consult.openHaku} → \`consult open\` · ${t.consult.close} → \`consult dismiss\``);
  if (s.spam) out.push("", ...spamLines(session, s));
  if (s.visibleProbe) out.push("", ...probeLines(session, s));
  out.push("", ...decisionLines(session, s));
  return out;
}

function spamLines(session: PlaySession, s: SessionSnapshot): string[] {
  const t = UI_TEXT[session.config.lang], lang = session.config.lang;
  const spam = s.spam!;
  if (spam.phase === "ready") {
    return spam.collapsed
      ? [`● ${t.spam.waiting}`, H("`spam-expand` shows the prompt again; `spam-ready` answers.")]
      : [`${t.spam.readyPrompt}  [${t.spam.ready}] [${t.spam.collapse}]`, H("`spam-ready` shows the question (the tools stay usable); `spam-collapse` hides the prompt. It waits for you, but is forced before the period ends.")];
  }
  const out = [`-- ${t.spam.title}${spam.itemCount > 1 ? ` · ${t.spam.itemOf(spam.itemIndex, spam.itemCount)}` : ""} --`];
  if (spam.forced) out.unshift(t.spam.forcedTitle);
  out.push(gl(session, tr(lang, spam.promptFi)));
  spam.options.forEach((o, i) => out.push(`  ${optionLetter(i)}) ${gl(session, tr(lang, o.fi))}${spam.chosen === o.id ? "  ◀" : ""}`));
  if (spam.phase === "confidence") out.push(`${t.spam.confidencePrompt} (${scale})`);
  out.push(spam.forced ? t.spam.forcedNote : t.spam.note);
  out.push(H(spam.phase === "item" ? "`spam-answer <letter> <confidence 25|50|75|100>` — the choice is final." : "`spam-answer <confidence>` gives the confidence."));
  return out;
}

function probeLines(session: PlaySession, s: SessionSnapshot): string[] {
  const t = UI_TEXT[session.config.lang], lang = session.config.lang;
  const p = s.visibleProbe!;
  const out = [`-- ${t.visibleProbe.title[p.type]} --`, gl(session, tr(lang, p.promptFi))];
  if (p.kind === "area") {
    out.push(`  ${t.visibleProbe.yes} / ${t.visibleProbe.no}`);
    if (p.followUpFi) out.push(`  (${t.visibleProbe.yes} →) ${gl(session, tr(lang, p.followUpFi))}`);
    p.options.forEach((o, i) => out.push(`    ${optionLetter(i)}) ${gl(session, tr(lang, o.fi))}`));
    out.push(H("`probe-answer no`, or `probe-answer yes <letter>[,<letter>…]` (any number, in your order)."));
  } else if (p.kind === "choice") {
    p.options.forEach((o, i) => out.push(`  ${optionLetter(i)}) ${gl(session, tr(lang, o.fi))}`));
    out.push(H(`\`probe-answer <letter>${p.collectsConfidence ? " <confidence 25|50|75|100>" : ""}\`.`));
  } else out.push(`  ${scale}`, H("`probe-answer <25|50|75|100>`."));
  out.push(t.visibleProbe.note);
  return out;
}

function decisionLines(session: PlaySession, s: SessionSnapshot): string[] {
  const t = UI_TEXT[session.config.lang], lang = session.config.lang;
  const trl = (fi: string) => tr(lang, fi);
  const hasDrones = s.allocation.droneTeams.length > 0;
  const held = s.decisionHeld ? ["(Päätösosio odottaa kysymyksen ajan / the decision strip is held while the question is open.)"] : [];
  switch (s.step) {
    case "exploration":
      return [...(s.previousViewTimedOutWithoutPlan ? [t.timeUpNoPlan] : []), `${s.practice ? t.practiceNotScored : ""}${t.explorationHint(s.aiAvailable)}`];
    case "awaiting_view_end":
      return [...held, t.periodConfirmedWait, ...(s.recordedPlan ? [`${t.planRecorded} ${gl(session, planSummary(s.recordedPlan, s.allocation.sectors, hasDrones, t, trl))}`] : []), `[${t.reviseAllocation}] → \`revise\``];
    case "plan_confidence":
      return [t.planConfidence.note, ...(s.planConfidence ? [`${t.planConfidence.prompt} (${scale})`, H("`plan-confidence <25|50|75|100>`.")] : [])];
    case "plan_review": {
      const r = t.planReview;
      if (!s.planReview) return [r.loading];
      return [r.title, r.note, ...(s.recordedPlan ? [`${r.planLabel} ${gl(session, planSummary(s.recordedPlan, s.allocation.sectors, hasDrones, t, trl))}`] : []), `[${r.keep}] → \`review keep\` · [${r.revise}] → \`review change\``];
    }
    case "allocation": return [...held, ...planFormLines(session, s)];
    case "hinge_pause": {
      const check = s.hingeCheck;
      const out = [t.hinge];
      if (s.hingeDirective !== null) out.push(`${t.hingeDirectiveFrom}: ${gl(session, tr(lang, s.hingeDirective))}`);
      if (check?.phase === "directive") out.push(`[${t.hingeCheck.read}] → \`continue\``);
      if (check && check.phase !== "directive") {
        out.push(gl(session, tr(lang, check.promptFi)), ...check.options.map((o, i) => `  ${optionLetter(i)}) ${gl(session, tr(lang, o.labelFi))}${check.chosen === o.id ? "  ◀" : ""}`));
        if (check.phase === "item") out.push(t.hingeCheck.note, H("`hinge-answer <letter>`."));
      }
      if (!check || check.phase === "answered") out.push(`[${t.continue}] → \`continue\``);
      return out;
    }
    default: return [];
  }
}

function planFormLines(session: PlaySession, s: SessionSnapshot): string[] {
  const t = UI_TEXT[session.config.lang], lang = session.config.lang;
  const d = session.planDraft();
  const hasDrones = s.allocation.droneTeams.length > 0;
  const departure = s.currentCycle >= DEPARTURE_NOTE_FROM_VIEW;
  const mark = (on: boolean) => (on ? " ◀" : "");
  const sector = (id: string) => gl(session, tr(lang, s.allocation.sectors.find((x) => x.id === id)?.labelFi ?? id));
  const g = (text: string) => gl(session, text);
  const out = [`-- ${g(t.allocationHint)} --`, onSceneLine(t, s.allocation, lang)];
  if (s.revisingAllocation) out.push(t.revisionHint);
  out.push(`${g(t.mainEffortLabel)} (main=): ${s.allocation.sectors.map((x) => `${sector(x.id)}${mark(d.mainEffort === x.id)}`).join(" | ")}`);
  out.push(`${g(t.postureLabel)} (posture=): ${MAIN_EFFORT_POSTURES.map((p) => `${p}: ${g(t.postures[p])}${mark(d.posture === p)}`).join(" | ")}`);
  out.push(`${g(t.secondaryLabel)} (secondary=): none: ${g(t.noSecondary)}${mark(d.secondarySector === null)} | ${s.allocation.sectors.filter((x) => x.id !== d.mainEffort).map((x) => `${x.id}${mark(d.secondarySector === x.id)}`).join(" | ")}`);
  out.push(`    → ${SECONDARY_TASK_IDS.map((k) => `${k}: ${g(t.secondaryTasks[k])}${mark(d.secondaryTask === k)}`).join(" | ")}`);
  if (hasDrones) {
    out.push(`${g(t.dronesLabel)} (drones=): carry_on: ${g(t.dronesCarryOn)}${mark(d.droneSector === null)} | ${s.allocation.sectors.map((x) => `${x.id}${mark(d.droneSector === x.id)}`).join(" | ")}`);
    out.push(`    → ${PLAN_DRONE_TASK_IDS.map((k) => `${k}: ${g(t.droneTasks[k])}${mark(d.droneTask === k)}`).join(" | ")}`);
  }
  if (departure) out.push(`${g(t.departureLabel)} (departure=yes|no)${mark(d.departureNoted)}; ${g(t.departureReasonLabel)} (reason=): ${DEPARTURE_REASONS.map((r) => `${r}: ${g(t.departureReasons[r])}${mark(d.departureReason === r)}`).join(" | ")}`);
  const plan = planFromDraft(d, hasDrones, departure);
  out.push(plan ? `[${t.confirmAllocation}] → \`confirm\`  (${gl(session, planSummary(plan, s.allocation.sectors, hasDrones, t, (fi) => tr(lang, fi)))})` : `[${t.confirmAllocation}] (not yet: choose the main effort, its posture${hasDrones ? ", the secondary sector and the drones" : " and the secondary sector"})`);
  out.push(H(`\`plan main=L2 posture=direct_attack secondary=none|L3:task.hold-line${hasDrones ? " drones=carry_on|L1:task.thermal-survey" : ""}${departure ? " [departure=yes reason=crew_safety]" : ""}\` sets the form; \`confirm\` records it.`));
  return out;
}

function logLines(session: PlaySession, s: SessionSnapshot): string[] {
  const t = UI_TEXT[session.config.lang];
  const out = [`-- ${t.tak.paneTitle.geochat} · ${t.tak.geochat.rooms.all} (${s.radioLog.length}) --`];
  if (s.radioLog.length === 0) out.push(t.noMessages);
  s.radioLog.forEach((e, i) => out.push(`${i >= session.seenLog ? "* " : "  "}${logRow(session, e)}`));
  if (s.radioLog.length > session.seenLog) out.push(H(`* = new since your last look (${s.radioLog.length - session.seenLog}).`));
  out.push(t.tak.geochat.readOnly);
  return out;
}

/** The freeze screen: its header, the current item (one at a time, no going back), the map item's grid image. */
function freezeText(session: PlaySession, s: SessionSnapshot, mapPath: string, withMap: boolean): { readonly text: string; readonly images: ImageRequest[] } {
  const t = UI_TEXT[session.config.lang], lang: Lang = session.config.lang;
  const items = s.freeze!.items;
  const state = session.freezeState();
  const now = session.o.freezeNowLabel();
  const out = [`== ${t.freezeTitle} ==`, t.freezeNote, ...(now ? [t.freezeNow(now)] : [])];
  const images: ImageRequest[] = [];
  const done = state.index >= items.length - 1 && state.drafts.get(items[items.length - 1]!.id)?.confidence !== undefined;
  if (done) {
    out.push("", `${t.freezeProgress(items.length, items.length)} · ${t.freezeNoReturn}`, H(`Every item answered: \`freeze-submit\` ("${t.freezeSubmit}").`));
    return { text: out.join("\n"), images };
  }
  const item = items[state.index]!;
  out.push("", `${t.freezeProgress(state.index + 1, items.length)} · ${t.freezeNoReturn}`, gl(session, tr(lang, item.promptFi)));
  if (isMapItem(item)) {
    out.push(t.freezeMapHint);
    if (withMap) { images.push({ kind: "freeze", path: mapPath, lang }); out.push(H(`Map (basemap only, as the app's memory-check map): ${mapPath}`)); }
    out.push(H(`Answer with the image's pixel coordinates read off its grid: \`freeze-answer <x>,<y> <confidence 25|50|75|100>\`. The point must lie inside the study area (unshaded).`));
  } else {
    item.options.forEach((o, i) => out.push(`  ${optionLetter(i)}) ${gl(session, tr(lang, o.labelFi))}`));
    out.push(H(`\`freeze-answer <letter> <confidence 25|50|75|100>\` (${t.confidence}); the answer moves you on (${t.freezeNext}).`));
  }
  out.push(`${t.confidence}: ${scale}`);
  return { text: out.join("\n"), images };
}
