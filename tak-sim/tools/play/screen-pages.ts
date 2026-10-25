/**
 * The play harness's full-screen pages (`tools/play/`): the screens that take the whole window instead of the map — the primer
 * (public sessions; `PrimerScreen`, its pure flow `primer-flow.ts`), the map training in the pretest's step (`MapTrainingScreen` and
 * the extract's PNG), the intro video, the practice feedback (`PracticeFeedbackScreen` and its head map's PNG), the training text with a public
 * session's mission card (`IntroScreen`), the questionnaires' player items (`StudyShell`; B2, 25 Oct 2026: the pre-session form,
 * the post-session source-memory, self-estimate and influence items), the debrief and the
 * end — as text, with the app's own strings (`PRIMER_CONTENT`, `DIFFICULTY_TEXT`, `introTextsIn`, `PUBLIC_TEXT`, `studyTextFor`).
 * Null for a view's screen (`screen.ts` draws those). Never a key of a scored item: the primer shows right or wrong after a choice and
 * the map training its right answers in its feedback, as the app does; nothing else here is scored.
 */

import type { SessionSnapshot } from "../../app/session/snapshot.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { sourceName, tr } from "../../app/i18n/text.js";
import { DIFFICULTY_TEXT } from "../../app/i18n/difficulty-texts.js";
import { searchLessonLines } from "../../app/session/practice-feedback.js";
import { PUBLIC_TEXT, studyTextFor } from "../../app/i18n/public-texts.js";
import { introTextsIn } from "../../app/scenario/briefing.js";
import { pageOfLabel, PRIMER_CONTENT } from "../../app/render/ui/explain/primer-content.js";
import { canGoOn, isLastPage, questionPhase } from "../../app/render/ui/explain/primer-flow.js";
import { REFLECTION_SECTION, SOURCE_SECTION, type QuestionnaireItem } from "../../app/session/questionnaire.js";
import type { PlaySession } from "./session.js";
import type { ImageRequest } from "./map-data.js";
import { MAP_TRAINING_TEXT } from "../../app/i18n/map-training-texts.js";
import { MAP_TRAINING } from "../../app/session/map-training.js";
import { isPointTask } from "../../app/session/map-training-spec.js";
import { optionLetter } from "./screen.js";

const H = (s: string) => `» ${s}`;
type Page = { readonly text: string; readonly images: ImageRequest[] };

/** The page on show, or null inside a view. `name` gives an image's path. */
export function pageText(session: PlaySession, name: (what: string) => string, withMap: boolean): Page | null {
  const s = session.snap();
  switch (s.step) {
    case "primer": return { text: primerText(session), images: [] };
    case "map_pretest": return pretestText(session, s, withMap ? name("pretest-extract") : null);
    case "briefing": return { text: [UI_TEXT[session.config.lang].introVideo.play, H(`The intro video (${s.introVideo?.src ?? "—"}) plays full screen here; its content is not available as text. \`continue\` when it has ended.`)].join("\n"), images: [] };
    case "practice_feedback": return feedbackText(session, s, withMap ? name("practice-feedback-map") : null);
    case "training": return { text: trainingText(session), images: [] };
    case "questionnaire": return { text: questText(session, s), images: [] };
    case "debrief": {
      const d = studyTextFor(session.config.lang, { audience: session.o.audience, scope: session.o.scope }).debrief;
      return { text: [`== ${d.title} ==`, ...d.paragraphs(s.debrief!.cell), `[${d.finish}] → \`continue\``].join("\n\n"), images: [] };
    }
    case "profile": return { text: H("The commander profile (shown only with ?profiili=heti): `continue`."), images: [] };
    case "complete": return { text: [UI_TEXT[session.config.lang].done, H("The session is complete. The analyst may now run `score`.")].join("\n"), images: [] };
    case "consent_declined": case "preflight_refused": return { text: H(`The session ended at ${s.step}.`), images: [] };
    default: return null;
  }
}

function primerText(session: PlaySession): string {
  const content = PRIMER_CONTENT[session.config.lang];
  const state = session.primer!;
  const page = content.pages[state.page]!;
  const ui = content.ui;
  const phase = questionPhase(state);
  const progress = state.progress[state.page]!;
  const out = [`== ${ui.title} · ${pageOfLabel(ui, state.page + 1, content.pages.length)} ==`, `# ${page.title}`, H(`[illustration "${page.illustration}": a schematic drawing, not shown as text]`), ...page.body, "", `-- ${ui.check} --`, page.question.stem];
  page.question.options.forEach((o, i) => out.push(`  ${i + 1}. ${o}${progress.wrong === i ? "  ✗" : ""}${progress.answered && phase === "answered" && i === lastRight(session, state.page) ? "  ✓" : ""}`));
  if (phase === "answered") out.push(ui.right);
  if (phase === "explain") out.push(`${ui.wrong} ${page.question.explanation}`, `[${ui.tryAgain}] → \`primer-retry\``);
  if (phase === "ask") out.push(H("`primer-answer <number>`."));
  if (!canGoOn(state)) out.push(ui.answerFirst);
  out.push(`${state.page > 0 ? `[${ui.back}] → \`primer-back\` · ` : ""}[${isLastPage(state) ? ui.done : ui.next}] → \`primer-next\`${canGoOn(state) ? "" : " (not yet)"}`);
  return out.join("\n");
}

/** The option the participant got right on a page (the app marks the chosen right option; the harness remembers the choice). */
function lastRight(session: PlaySession, page: number): number | null {
  return session.primerRight.get(page) ?? null;
}

/** The map training (25 Oct 2026; the pretest's step): the task on screen, its question or its feedback, with the app's words. */
function pretestText(session: PlaySession, s: SessionSnapshot, path: string | null): Page {
  const lang = session.config.lang;
  const t = MAP_TRAINING_TEXT[lang];
  const v = s.mapPretest;
  if (!v) return { text: H("The map training has ended."), images: [] };
  const task = MAP_TRAINING.tasks.find((x) => x.id === v.taskId)!;
  const out = [`== ${t.title} ==  ${t.timeLeft(session.o.mapPretestSecondsLeft())}`, t.intro(v.taskCount, Math.round(v.timeLimitMs / 60_000)), "", t.progress(v.position, v.taskCount)];
  if (v.phase === "study" && task.kind === "memory") out.push(t.study(task, Math.round(MAP_TRAINING.memoryMs / 1000)), t.studyLeft(session.o.mapPretestStudySecondsLeft()), H("`wait` until the blank map, then `look`."));
  else out.push(t.prompt(task));
  if (task.kind === "now") out.push(`[${t.logTitle}] ${task.report.clock} ${task.report.from}: ${t.report(task)}`);
  if (v.phase === "answer") {
    if (isPointTask(task)) out.push(H(`\`pretest-answer <x>,<y>\` — a point on the image's grid (extract pixels, 4 m each); once, final ("${t.answer}").`));
    else {
      task.options.forEach((o, i) => out.push(`  ${optionLetter(i)}) ${t.option(task, o.id)}`));
      out.push(H(`\`pretest-answer <letter>\` — once, final ("${t.answer}").`));
    }
  }
  if (v.phase === "feedback") {
    if (v.answer && "choiceId" in v.answer && !isPointTask(task)) out.push(`${t.yourAnswer}: ${t.option(task, v.answer.choiceId)}`, `${t.rightAnswer}: ${t.option(task, task.key)}`);
    if (v.errorM !== null) out.push(t.off(v.errorM));
    out.push(t.feedback(task), `[${v.position === v.taskCount ? t.finish : t.next}] → \`continue\``);
  }
  const legend = v.phase === "feedback" ? " (green ring: the right place; blue dot: your mark)" : task.kind === "memory" && v.phase === "answer" ? " (the blank memory-check map)" : "";
  out.push(H(path ? `Map${legend}, with an x,y grid every 50 px: ${path}` : "The map is an image, not drawn with --no-map; `look` without --no-map draws it."));
  return { text: out.join("\n"), images: path ? [{ kind: "pretest", path, lang, taskId: v.taskId, phase: v.phase, answer: v.answer }] : [] };
}

function feedbackText(session: PlaySession, s: SessionSnapshot, path: string | null): Page {
  const lang = session.config.lang;
  const t = DIFFICULTY_TEXT[lang].feedback;
  const v = s.practiceFeedback;
  if (!v) return { text: "", images: [] };
  const out = [`== ${t.title} ==`, t.intro];
  for (const it of v.items) {
    const records = it.records.map((r) => `${sourceName(lang, r.sourceId)} ${r.clockLabel}`).join(", ");
    const where = it.source === "log" ? t.log(records) : it.source === "map" ? t.map : it.source === "records" ? t.records(records) : t.workedOut;
    // (bl) A records item shows what a search would have given and its answer (the screen's `SearchLesson`, the same lines); else its example question.
    const lesson = it.lesson ? searchLessonLines(lang, it.lesson) : null;
    out.push("", `${t.question}: ${tr(lang, it.promptFi)}`, where, ...(lesson ? [lesson.lesson, ...(lesson.yours !== null ? [lesson.yours] : [])] : it.exampleQuestion ? [t.example(it.exampleQuestion[lang])] : []));
  }
  out.push("", `# ${t.headTitle}`, v.head.mark ? t.head : t.headNoMark);
  // The head map is an image (24 Oct 2026: a player on `--no-map` read "shown in blue" and saw no picture): its path, or how to get it.
  const legend = `red ● ${t.legendHead}${v.head.mark ? `, blue ● ${t.legendMark}` : ""}`;
  out.push(H(path ? `Map (${legend}): ${path}` : `Map (${legend}): an image, not drawn with --no-map; \`look\` without --no-map draws it.`));
  out.push("", `# ${t.measureTitle}`, t.measure(v.measure.km, lang === "en" ? v.measure.directionEn : v.measure.directionFi), "", s.aiAvailable ? t.closingThinker : t.closingHaku, `[${t.continue}] → \`continue\``);
  return { text: out.join("\n"), images: path ? [{ kind: "head", path, lang, head: v.head }] : [] };
}

function trainingText(session: PlaySession): string {
  const lang = session.config.lang;
  const texts = introTextsIn("directed", lang, "radio");
  const out: string[] = [];
  if (session.config.audience === "public") { const m = PUBLIC_TEXT[lang].mission; out.push(`== ${m.title} ==`, ...m.paragraphs, ""); }
  out.push(`== ${texts.trainingTitle} ==`, texts.training, `[${UI_TEXT[lang].startTask}] → \`continue\``);
  return out.join("\n");
}

/**
 * The questionnaire items the player answers (B2, 25 Oct 2026): the whole pre-session form (fatigue, sleep and, in an expert session,
 * the recent shift); in the post-session form the source-memory items and the self-estimate and perceived-influence items after them.
 * Every other post-session item is left blank (all are optional). The items as the screen resolves them (cell, audience).
 */
export function playerQuestItems(view: NonNullable<SessionSnapshot["questionnaire"]>): readonly QuestionnaireItem[] {
  return view.id === "pre" ? view.items : view.items.filter((i) => i.section === SOURCE_SECTION || i.section === REFLECTION_SECTION);
}

/** The points of a scale item ("1 | 2 | … | 7"). */
export function scalePoints(item: Extract<QuestionnaireItem, { kind: "scale" }>): number[] {
  const step = item.step ?? 1;
  return Array.from({ length: Math.floor((item.max - item.min) / step) + 1 }, (_, i) => item.min + i * step);
}

/** A questionnaire (pre- or post-session): the player's items with their answers so far; the rest of the post-session form blank. */
function questText(session: PlaySession, s: SessionSnapshot): string {
  const q = studyTextFor(session.config.lang, { audience: session.o.audience, scope: session.o.scope }).questionnaire;
  const view = s.questionnaire!;
  const out = [`== ${view.id === "pre" ? q.preTitle : q.postTitle} ==`, `${view.id === "pre" ? q.preIntro : q.postIntro} ${q.optionalNote}`];
  let section = "";
  for (const item of playerQuestItems(view)) {
    if (item.section !== section) { section = item.section; out.push("", `-- ${q.sections[section] ?? section} --`); }
    const text = q.items[item.id]!;
    const given = session.quest.get(item.id);
    out.push(`[${item.id}] ${text.prompt}`);
    if (item.kind === "choice") out.push(`  ${item.options.map((o) => `${o}: ${text.options?.[o] ?? o}${given === o ? " ◀" : ""}`).join(" | ")}`);
    else if (item.kind === "scale") out.push(`  ${scalePoints(item).map((p) => `${p}${given === p ? " ◀" : ""}`).join(" | ")}${text.low && text.high ? `  (${text.low} … ${text.high})` : ""}`);
    else if (item.kind === "number") out.push(`  ${item.min}–${item.max}${given !== undefined ? `: ${given} ◀` : ""}`);
  }
  const rest = view.id === "pre" ? "" : " the rest of the form is left blank (every item is optional);";
  out.push("", H(`The items above are yours to answer (\`quest-answer <item id> <option id | number>\`; every item is optional);${rest} \`quest-submit\` sends the form.`), `[${q.submit}]`);
  return out.join("\n");
}
