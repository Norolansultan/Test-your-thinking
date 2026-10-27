/**
 * The play harness's training pages (revision (bp), 26 Oct 2026; SPEC/15 (bp) §bp.2, SPEC/08 (bp)): what `look` prints while the step is
 * `training_incident` — the intro, the section cards, an item (its stem and options in the session language, the tools open for it: the
 * live map's PNG with a grid in its own pixels, the message log, the Search pane once asked; the card's 60 s; the freeze screen's confidence), the
 * memory item's exposure and blank map, the feedback after every item, S5's recording of the group's tool, and the cap's countdown —
 * with the app's own words (`TRAINING_TEXT`, `UI_TEXT`). Harness lines are in English and marked `»`.
 *
 * `trainingScreen` is pure (the spec, the texts, the view and the timers in; text and image requests out), so the spec tests it on a
 * fixture; `trainingPage` reads them from the session. The training shows its own keys in its feedback, as the app does; nothing
 * here reads a scored item.
 */

import type { Lang } from "../../app/i18n/lang.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import type { Cell } from "../../app/scenario/types.js";
import type { RadioLogEntry, SessionSnapshot } from "../../app/session/snapshot.js";
import type { Audience } from "../../app/session/public-session.js";
import type { TrainingView } from "../../app/session/training/host.js";
import type { TrainingItem, TrainingSpec } from "../../app/session/training/spec.js";
import type { TrainingTexts } from "../../app/i18n/training-texts-types.js";
import { CONFIDENCE_SCALE } from "../../app/session/confidence.js";
import { formatRange } from "../../app/render/ui/tak/RangeBearing.js";
import type { Camera } from "../../app/render/map-frame.js";
import type { RenderableCycle } from "../../app/boundary/render-boundary.js";
import { trainingMapLock } from "../../app/render/ui/training-lock.js";
import { trainingClockLabel } from "../../app/session/training/view.js";
import { displayAnswerText } from "../../app/session/chat-display.js";
import type { LatLon } from "../../app/engine/primitives.js";
import { LIVE_MAP_PX, type ImageRequest, type MapPageData } from "./map-data.js";
import { trainingItemOf, trainingLockBox, trainingOpening, trainingViewOf, TRAINING_GRID_MARGIN_PX, TRAINING_GRID_STEP_PX } from "./training-host.js";
import type { PlaySession } from "./session.js";

const H = (s: string) => `» ${s}`;
const letter = (i: number) => String.fromCharCode(97 + i);
type Page = { readonly text: string; readonly images: ImageRequest[] };

/** One Search turn in the training as its pane shows it (the answer's four parts as logged in `training_haku_answered`). */
export interface TrainingHakuTurn {
  readonly query: string;
  readonly answer: { readonly vastaus: string; readonly perusteet: string; readonly varmuus: string; readonly muuttaisi: string };
}

/** Everything the training's screen shows, gathered from the session (or a fixture). */
export interface TrainingScreenInput {
  readonly lang: Lang;
  readonly audience: Audience;
  readonly cell: Cell;
  readonly view: TrainingView;
  readonly spec: TrainingSpec;
  readonly texts: TrainingTexts;
  /** Whole seconds: the cap's countdown, a question card's window, the memory item's exposure, S5's button. */
  readonly secondsLeft: { readonly cap: number; readonly card: number; readonly study: number; readonly demo: number };
  /** The live map's scene as the session gives it (the item's; the memory unit alone during its exposure), or null. */
  readonly scene: RenderableCycle | null;
  /** The message log's rows for the section (empty when the log is closed). */
  readonly logRows: readonly string[];
  readonly camera: Camera;
  /** The R&B readings taken on this item, m, and the line on the map. */
  readonly measures: readonly number[];
  readonly rb: { readonly from: LatLon; readonly to: LatLon } | null;
  readonly haku: readonly TrainingHakuTurn[];
}

/** The training's live map, as the image request carries it (B's overlay draws the item on it). */
export function trainingMapData(input: TrainingScreenInput, item: TrainingItem | null): MapPageData {
  const b = input.spec.area.bounds;
  return {
    lang: input.lang, audience: input.audience, currentCycle: 0, clockLabel: trainingClockLabel(input.spec),
    cycleInfo: input.scene, envelope: null, recordedPlan: null,
    extent: { south: b.south, north: b.north, west: b.west, east: b.east }, widthPx: LIVE_MAP_PX.width, heightPx: LIVE_MAP_PX.height,
    camera: input.camera, legend: false, rb: input.rb,
    training: { view: input.view, item, gridMarginPx: TRAINING_GRID_MARGIN_PX, gridStepPx: TRAINING_GRID_STEP_PX, lock: trainingMapLock(input.spec, input.lang) },
  };
}

/** The training's screen as text, and its images (`mapPath`: the live map's PNG; `freezePath`: the memory item's blank map). */
export function trainingScreen(input: TrainingScreenInput, mapPath: string | null, freezePath: string | null): Page {
  const { view, texts, lang } = input;
  const t = UI_TEXT[lang];
  const item = view.itemId ? input.spec.items.find((i) => i.id === view.itemId) ?? null : null;
  const out: string[] = [];
  const images: ImageRequest[] = [];
  const timer = view.phase === "demo" || view.phase === "ended" ? "" : `  ${H(`time left ${input.secondsLeft.cap} s of the ${Math.round(view.capMs / 60_000)}-minute cap`)}`;
  switch (view.phase) {
    case "intro":
      out.push(`== ${texts.intro.title} ==${timer}`, ...texts.intro.body, `[${texts.intro.start}] → \`continue\``);
      break;
    case "section": {
      const c = texts.section(view.sectionId!);
      out.push(`== ${c.title} ==${timer}`, ...c.body, `[${c.go}] → \`continue\``);
      break;
    }
    case "study":
    case "question":
    case "feedback": {
      const words = texts.item(view.itemId!);
      out.push(`== ${texts.section(view.sectionId!).title} · ${view.position} / ${view.itemCount} ==${timer}`);
      if (view.phase === "study") {
        // Round 4 (B21, 27 Oct 2026): what the app's exposure panel says ("Muista, missä yksikkö EK53 on." / "Remember where unit EK53 is.").
        out.push(texts.ui.memoryExposure ?? "memoryExposure");
        out.push(H(`The unit is shown on the map for its exposure: ${input.secondsLeft.study} s left (\`wait ${Math.max(1, input.secondsLeft.study)}\`), then the blank memory-check map with the question (\`look\`).`));
        break;
      }
      out.push(words.stem);
      if (item?.answer === "choice") item.options.forEach((o, i) => out.push(`  ${letter(i)}) ${words.options[o.id] ?? o.id}${view.phase === "feedback" && view.answer && "choiceId" in view.answer && view.answer.choiceId === o.id ? "  ◀" : ""}`));
      if (view.phase === "question") out.push(...questionLines(input, item));
      else out.push("", ...texts.feedback(view.itemId!, { answer: view.answer, key: item!.key, errorM: view.errorM, timedOut: view.timedOut, source: item!.source, numbers: item!.feedback.numbers, ...(item!.lesson ? { lesson: item!.lesson } : {}) }),
        `[${view.position === view.itemCount ? (lang === "fi" ? "Valmis" : "Done") : t.tour.next}] → \`continue\``);
      break;
    }
    case "demo": {
      const d = texts.demo(input.cell);
      if (view.endReason === "timeout") out.push(texts.ui.capEnded ?? "capEnded", ""); // the cap ended the items (review 27 Oct 2026)
      out.push(`== ${d.title} ==`, d.intro);
      d.examples.forEach((e, i) => out.push("", `${i + 1}. > ${e.question}`, ...e.answer.map((l) => `   ${l}`), e.note));
      out.push("", `[${texts.demoLines.leave}] → \`continue\``, H(`A recording, not a live query; its button is enabled after 10 s${input.secondsLeft.demo > 0 ? ` (${input.secondsLeft.demo} s left; \`continue\` waits for it)` : ""}.`));
      break;
    }
    case "ended":
      out.push(H("The training has ended."));
      break;
  }
  // The tools open for the item, as the screen has them (S1 the map and R&B, S2 and the cards the log too, S3's cards Search).
  const onMap = item !== null && item.mode !== "freeze" && (view.phase === "question" || view.phase === "feedback" || view.phase === "study") && view.tools.map;
  const memory = item !== null && item.memory !== undefined;
  if (onMap || (memory && view.phase !== "question")) {
    if (mapPath) {
      images.push({ kind: "training", path: mapPath, data: trainingMapData(input, item) });
      out.push("", H(`Map (the training's square, north up; a grid every ${TRAINING_GRID_STEP_PX} px labelled in the image's own pixels; \`map 2.5km|1km|reset [center=x,y]\`): ${mapPath}`));
    } else out.push("", H("The map is an image, not drawn with --no-map; `look` without --no-map draws it."));
  }
  if (memory && view.phase === "question" && item!.mode === "freeze") {
    if (freezePath) {
      images.push({ kind: "freeze", path: freezePath, lang, extent: trainingLockBox(input.spec) });
      out.push(H(`Blank memory-check map (the training's square, basemap only): ${freezePath}`));
    } else out.push(H("The blank map is an image, not drawn with --no-map."));
  }
  if (view.tools.log && input.logRows.length > 0 && view.phase === "question") out.push("", `-- ${t.tak.paneTitle.geochat} · ${t.tak.geochat.rooms.all} (${input.logRows.length}) --`, ...input.logRows.map((r) => `  ${r}`), t.tak.geochat.readOnly);
  // Round 4 (B20, 27 Oct 2026): the app keeps Search closed on S3's cards until the participant opens it (`seek_first`), so its pane is
  // printed only once `haku` has been used (and stays, as the app's pane stays open in the section); before that, one » line names it.
  if (view.tools.haku && view.phase === "question" && input.haku.length > 0) {
    out.push("", `-- ${t.tak.paneTitle.haku} --`);
    for (const turn of input.haku) out.push(`> ${turn.query}`, `${t.answer}: ${turn.answer.vastaus}`, `${t.basis}: ${turn.answer.perusteet}`, `${t.certainty}: ${turn.answer.varmuus}`, `${t.wouldChange}: ${turn.answer.muuttaisi}`);
  }
  return { text: out.join("\n"), images };
}

function questionLines(input: TrainingScreenInput, item: TrainingItem | null): string[] {
  const { view, lang } = input;
  const out: string[] = [];
  const confidence = item !== null && item.mode !== "live";
  if (item?.mode === "card") out.push(H(`The question card: ${input.secondsLeft.card} s left of its window; at 0 it closes unanswered and its feedback shows.`));
  if (view.tools.rb && input.measures.length > 0) out.push(`${UI_TEXT[lang].tak.rb.range}: ${input.measures.map((m) => formatRange(m, lang)).join(", ")}`);
  if (view.tools.haku) out.push(H("`haku \"<question>\"` opens Search and asks it (here it answers only from this training's records; the harness's template fallback, not the study's model)."));
  const conf = confidence ? ` <confidence ${CONFIDENCE_SCALE.join("|")}>` : "";
  if (item?.answer === "point") {
    out.push(item.mode === "freeze"
      ? H(`\`training-answer <x>,<y>${conf}\` — a point on the blank map's grid (its own pixels); once, final.`)
      : H(`\`training-answer <x>,<y>${conf}\` — a point on the map image's grid (its own pixels, the labels in the margin); once, final.${view.tools.rb ? " `measure x1,y1 x2,y2` reads a distance first." : ""}`));
  } else out.push(H(`\`training-answer <letter>${conf}\` — once, final.${view.tools.rb ? " `measure x1,y1 x2,y2` (the map image's pixels) reads a distance first." : ""}`));
  return out;
}

/**
 * The training's page from the session (null outside the training). `name` gives an image's path. While the step is on, the snapshot's
 * map scene, message log and Haku turns are the training's (`app/session/training/view.ts`).
 */
export function trainingPage(session: PlaySession, s: SessionSnapshot, name: (what: string) => string, withMap: boolean, logRow: (e: RadioLogEntry) => string): Page | null {
  const view = trainingViewOf(s);
  if (!view) return null;
  const o = session.o;
  const { spec, texts } = session.trainingContent;
  const item = trainingItemOf(view, spec);
  const d = (x: string) => displayAnswerText(x);
  const input: TrainingScreenInput = {
    lang: session.config.lang, audience: session.config.audience, cell: "radio", view, spec, texts: texts[session.config.lang],
    secondsLeft: { cap: o.trainingSecondsLeft(), card: o.trainingCardSecondsLeft(), study: o.trainingStudySecondsLeft(), demo: o.trainingDemoSecondsLeft() },
    scene: s.renderTree.cycleInfo, logRows: s.radioLog.map(logRow),
    // Round 4 (B26): the camera belongs to the item it was moved on; a new item opens on the opening frame.
    camera: (item && session.trainingUi.itemId === item.id ? session.trainingUi.camera : null) ?? trainingOpening(spec), measures: item && session.trainingUi.itemId === item.id ? session.trainingUi.measures : [],
    rb: item && session.trainingUi.itemId === item.id ? session.trainingUi.rb : null,
    haku: s.aiChatHistory.map((turn) => ({ query: turn.query, answer: { vastaus: d(turn.answer.answerFi), perusteet: d(turn.answer.basisFi), varmuus: d(turn.answer.certaintyFi), muuttaisi: d(turn.answer.wouldChangeIfFi) } })),
  };
  return trainingScreen(input, withMap ? name("training-map") : null, withMap ? name("training-blank-map") : null);
}
