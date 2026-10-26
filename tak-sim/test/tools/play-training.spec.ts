/**
 * The play harness in the training incident (revision (bp), 26 Oct 2026; SPEC/15 (bp) §bp.7 "Play harness"): its pages and its map PNG
 * in both languages and audiences, `training-answer` (letters, or x,y read off the image's own grid: play-test B12), `continue`, `haku`
 * on the S3 cards, `measure` and `map` on its live map, and the smoke's policy through every phase — on a fixture of the training's
 * content and a fake of work package B's orchestrator methods (`play-training-fixture.ts`), as neither is in this tree yet. The tour's
 * records step is still listed (`play.spec.ts` plays VP).
 */

import { afterEach, describe, expect, it } from "vitest";
import type { Lang } from "../../app/i18n/lang.js";
import type { TrainingView } from "../../app/session/training/host.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { PRACTICE_TOUR } from "../../app/render/ui/tour.js";
import { CONFIDENCE_SCALE } from "../../app/session/confidence.js";
import { PlayError, PlaySession } from "../../tools/play/session.js";
import { runCommand } from "../../tools/play/commands.js";
import { dumbPolicy } from "../../tools/play/smoke.js";
import { lngLatAt } from "../../tools/play/map-camera.js";
import { LIVE_MAP_PX } from "../../tools/play/map-data.js";
import { gridSvg } from "../../tools/play/grid-svg.js";
import { FREEZE_MAP_MARGIN_PX, freezeFrame } from "../../tools/play/freeze-grid.js";
import { trainingScreen, type TrainingScreenInput } from "../../tools/play/training-pages.js";
import { moveTrainingCamera, trainingHostOf, trainingLockBox, trainingOpening, trainingPointAt, TRAINING_GRID_MARGIN_PX, TRAINING_GRID_STEP_PX } from "../../tools/play/training-host.js";
import { fakeHost, FIXTURE_SPEC, FIXTURE_TEXTS, snapshotOf, viewOf } from "./play-training-fixture.js";

const M = TRAINING_GRID_MARGIN_PX;
const ctx = { runDir: "/nonexistent", withMap: true };
const live: PlaySession[] = [];
afterEach(() => { for (const s of live.splice(0)) s.dispose(); });

/** A harness session on the fixture's training screen `view` (mutable through `set`), with the fake orchestrator methods. */
async function onTraining(lang: Lang, view: TrainingView, audience: "expert" | "public" = "expert") {
  const session = await PlaySession.create({ audience, lang, waitStopsOnMessages: true, questionnairesPlayed: true });
  live.push(session);
  session.trainingContent = { spec: FIXTURE_SPEC, texts: FIXTURE_TEXTS };
  const box = { view };
  (session as unknown as { snap: () => unknown }).snap = () => snapshotOf(box.view);
  const fake = fakeHost();
  Object.assign(session.o, fake.host);
  return { session, fake, set: (v: TrainingView) => { box.view = v; } };
}

function input(lang: Lang, view: TrainingView, audience: "expert" | "public" = "expert"): TrainingScreenInput {
  return {
    lang, audience, cell: "radio", view, spec: FIXTURE_SPEC, texts: FIXTURE_TEXTS[lang], secondsLeft: { cap: 600, card: 42, study: 5 },
    logRows: ["10.12  DR8: [row]"], camera: trainingOpening(FIXTURE_SPEC), measures: [], rb: null, haku: [],
  };
}

describe("the training's pages (pure: the spec, the texts, the view in; text and image requests out)", () => {
  for (const lang of ["fi", "en"] as const) {
    const other = lang === "fi" ? "[en]" : "[fi]";
    for (const audience of ["expert", "public"] as const) {
      it(`${lang}/${audience}: intro, section, items, feedback and S5 in the session language only, with the cap's countdown`, () => {
        const pages = [
          trainingScreen(input(lang, viewOf("intro", null), audience), "/m.png", "/b.png"),
          trainingScreen(input(lang, viewOf("section", null, { sectionId: "s3" }), audience), "/m.png", "/b.png"),
          ...FIXTURE_SPEC.items.map((it) => trainingScreen(input(lang, viewOf("question", it.id), audience), "/m.png", "/b.png")),
          trainingScreen(input(lang, viewOf("feedback", "training.s3.records1", { answer: { choiceId: "training.s3.records1.o1", confidence: 50 } }), audience), "/m.png", "/b.png"),
          trainingScreen(input(lang, viewOf("demo", null), audience), "/m.png", "/b.png"),
        ];
        const all = pages.map((p) => p.text).join("\n");
        expect(all).toContain(`[${lang}] Harjoitus`);
        expect(all).not.toContain(other);
        expect(pages[0]!.text).toMatch(/time left 600 s of the 12-minute cap/);
        expect(all).toContain(`[${lang}] demo Haku`);
        expect(all).not.toContain("demo Thinker");
      });
    }

    it(`${lang}: a choice item lists its options by letter (no option id); a point item asks for x,y on the image's own grid`, () => {
      const choice = trainingScreen(input(lang, viewOf("question", "training.s1.measure")), "/m.png", null).text;
      expect(choice).toContain(`  a) [${lang}] option 1\n  b) [${lang}] option 2\n  c) [${lang}] option 3`);
      expect(choice).not.toMatch(/training\.s1\.measure\.o/);
      expect(choice).toMatch(/`training-answer <letter>` — once, final\. `measure x1,y1 x2,y2`/);
      const point = trainingScreen(input(lang, viewOf("question", "training.s1.place")), "/m.png", null);
      expect(point.text).toMatch(/`training-answer <x>,<y>` — a point on the map image's grid \(its own pixels/);
      expect(point.images).toHaveLength(1);
      expect(point.images[0]).toMatchObject({ kind: "training", path: "/m.png", data: { lang, legend: false, widthPx: LIVE_MAP_PX.width, heightPx: LIVE_MAP_PX.height, training: { gridMarginPx: M, gridStepPx: TRAINING_GRID_STEP_PX, item: { id: "training.s1.place" } } } });
    });

    it(`${lang}: S3's card shows its 60 s window, the message log and Search, and asks for the confidence`, () => {
      const text = trainingScreen({ ...input(lang, viewOf("question", "training.s3.records1")), haku: [{ query: "q?", answer: { vastaus: "V", perusteet: "P", varmuus: "C", muuttaisi: "W" } }] }, "/m.png", null).text;
      const t = UI_TEXT[lang];
      expect(text).toContain("The question card: 42 s left of its window");
      expect(text).toContain(`-- ${t.tak.paneTitle.geochat}`);
      expect(text).toContain("10.12  DR8: [row]");
      expect(text).toContain(`-- ${t.tak.paneTitle.haku} --\n> q?\n${t.answer}: V\n${t.basis}: P\n${t.certainty}: C\n${t.wouldChange}: W`);
      expect(text).toContain(`<confidence ${CONFIDENCE_SCALE.join("|")}>`);
    });

    it(`${lang}: the memory item — the unit on the live map for its exposure, then the blank map of the lock box with confidence`, () => {
      const study = trainingScreen(input(lang, viewOf("study", "training.s4.memory")), "/m.png", "/b.png");
      expect(study.text).toMatch(/5 s left \(`wait 5`\)/);
      expect(study.images.map((i) => i.kind)).toEqual(["training"]);
      const blank = trainingScreen(input(lang, viewOf("question", "training.s4.memory")), "/m.png", "/b.png");
      expect(blank.images).toEqual([{ kind: "freeze", path: "/b.png", lang, extent: trainingLockBox(FIXTURE_SPEC) }]);
      expect(blank.text).toMatch(/`training-answer <x>,<y> <confidence 25\|50\|75\|100>` — a point on the blank map's grid/);
      const choice = trainingScreen(input(lang, viewOf("question", "training.s4.log")), "/m.png", "/b.png");
      expect(choice.images).toEqual([]); // the freeze screen: no map, no log, no Search
      expect(choice.text).not.toContain(UI_TEXT[lang].tak.paneTitle.geochat);
    });

    it(`${lang}: the feedback is the texts' own, filled from the logged answer and the key, with "Next" or, on the last item, "Done"`, () => {
      const fb = trainingScreen(input(lang, viewOf("feedback", "training.s3.records1", { answer: { choiceId: "training.s3.records1.o1", confidence: 50 } })), null, null).text;
      expect(fb).toContain(`[${lang}] key training.s3.records1.o2; error —; timed out false; source records; m 42; lesson q.dr8`);
      expect(fb).toContain(`  a) [${lang}] option 1  ◀`);
      expect(fb).toContain(`[${UI_TEXT[lang].tour.next}] → \`continue\``);
      const last = trainingScreen(input(lang, viewOf("feedback", "training.s4.log")), null, null).text;
      expect(last).toContain(`[${lang === "fi" ? "Valmis" : "Done"}] → \`continue\``);
    });
  }
});

describe("the training map's grid in the PNG's own pixels (play-test B12)", () => {
  it("labels every second line with its own PNG coordinate, in the margin", () => {
    const svg = gridSvg(LIVE_MAP_PX.width, LIVE_MAP_PX.height, M, TRAINING_GRID_STEP_PX);
    expect(svg).toMatch(new RegExp(`<text x="100" y="${M - 8}"[^>]*>100</text>`));
    expect(svg).toMatch(new RegExp(`<text x="${M - 6}" y="104"[^>]*>100</text>`));
    expect(svg).toContain(`<line x1="50" y1="${M}"`);
  });

  it("reads back the point the image shows at a grid x,y: the map's middle is the camera's centre; off the map or outside the lock is refused", () => {
    const camera = trainingOpening(FIXTURE_SPEC);
    const mid = trainingPointAt(M + LIVE_MAP_PX.width / 2, M + LIVE_MAP_PX.height / 2, camera, FIXTURE_SPEC);
    expect("point" in mid && Math.abs(mid.point.lon - camera.center[0]) < 1e-5 && Math.abs(mid.point.lat - camera.center[1]) < 1e-5).toBe(true);
    const at = trainingPointAt(M + 400, M + 200, camera, FIXTURE_SPEC);
    const [lon, lat] = lngLatAt(camera, 400, 200);
    expect(at).toEqual({ point: { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 } });
    expect(trainingPointAt(10, 10, camera, FIXTURE_SPEC)).toMatchObject({ error: expect.stringMatching(/must lie on the map/) });
    // The opening frame fits the square's height: the map's left and right edges lie beyond the lock (the square plus 100 m).
    expect(trainingPointAt(M + 20, M + 340, camera, FIXTURE_SPEC)).toMatchObject({ error: expect.stringMatching(/outside the training's area/) });
    const far = moveTrainingCamera(camera, "1km", null, FIXTURE_SPEC);
    expect(far.zoom).toBeGreaterThan(camera.zoom);
    expect(moveTrainingCamera(far, "reset", null, FIXTURE_SPEC)).toEqual(camera);
  });
});

describe("the training's commands, on a fake of the orchestrator's training methods", () => {
  it("refuses a training screen when the orchestrator has no training methods (work package B not in the tree)", () => {
    expect(() => trainingHostOf({} as never)).toThrow(PlayError);
    expect(() => trainingHostOf({} as never)).toThrow(/work package B/);
  });

  it("`continue` leaves the intro, a section card, the feedback and S5 through their methods", async () => {
    const { session, fake, set } = await onTraining("fi", viewOf("intro", null));
    for (const [view, call] of [[viewOf("intro", null), ["trainingStart"]], [viewOf("section", null, { sectionId: "s1" }), ["trainingLeaveSection"]], [viewOf("feedback", "training.s1.place"), ["leaveTrainingFeedback", "training.s1.place"]], [viewOf("demo", null), ["leaveTrainingDemo"]]] as const) {
      set(view);
      session.begin(null);
      await runCommand(session, "continue", [], ctx);
      expect(fake.calls.at(-1)).toEqual(call);
    }
    set(viewOf("question", "training.s1.place"));
    session.begin(null);
    await expect(runCommand(session, "continue", [], ctx)).rejects.toThrow(/answer the item first/);
  });

  it("`training-answer`: a letter's option, a grid point's WGS84 with the R&B readings, the confidence where asked; refusals otherwise", async () => {
    const { session, fake, set } = await onTraining("en", viewOf("question", "training.s1.measure"));
    session.begin(null);
    await runCommand(session, "measure", [`${M + 300},${M + 100}`, `${M + 600},${M + 100}`], ctx);
    session.begin(null);
    await runCommand(session, "training-answer", ["b"], ctx);
    const [, id, answer, measures] = fake.calls.at(-1)! as [string, string, unknown, number[]];
    expect([id, answer]).toEqual(["training.s1.measure", { choiceId: "training.s1.measure.o2" }]);
    expect(measures).toHaveLength(1);
    expect(measures[0]!).toBeGreaterThan(100);
    set(viewOf("question", "training.s1.place"));
    session.begin(null);
    await runCommand(session, "training-answer", [`${M + 500},${M + 340}`], ctx);
    expect(fake.calls.at(-1)).toEqual(["answerTraining", "training.s1.place", trainingPointAt(M + 500, M + 340, trainingOpening(FIXTURE_SPEC), FIXTURE_SPEC), []]);
    expect(session.images.map((i) => i.kind)).toEqual(["training"]);
    set(viewOf("question", "training.s3.records1"));
    session.begin(null);
    await expect(runCommand(session, "training-answer", ["a"], ctx)).rejects.toThrow(/confidence/);
    await runCommand(session, "training-answer", ["a", "75"], ctx);
    expect(fake.calls.at(-1)).toEqual(["answerTraining", "training.s3.records1", { choiceId: "training.s3.records1.o1", confidence: 75 }, []]);
    set(viewOf("question", "training.s4.memory"));
    const f = freezeFrame(trainingLockBox(FIXTURE_SPEC));
    session.begin(null);
    await runCommand(session, "training-answer", [`${FREEZE_MAP_MARGIN_PX + 20},${FREEZE_MAP_MARGIN_PX + 30}`, "50"], ctx);
    expect(fake.calls.at(-1)![2]).toMatchObject({ point: expect.any(Object), confidence: 50 });
    expect(f.widthPx).toBeGreaterThan(100);
    set(viewOf("study", "training.s4.memory"));
    await expect(runCommand(session, "training-answer", ["1,1", "50"], ctx)).rejects.toThrow(/still on the map/);
  });

  it("`haku` on an S3 card asks through the orchestrator and prints the logged answer; refused where Search is closed", async () => {
    const { session, fake, set } = await onTraining("fi", viewOf("question", "training.s3.records1"));
    session.begin(null);
    const out = await runCommand(session, "haku", ["Mitä", "DR8", "ilmoitti?"], ctx);
    expect(fake.calls.at(-1)).toEqual(["askTrainingHaku", "Mitä DR8 ilmoitti?"]);
    expect(out).toContain("TEMPLATE FALLBACK");
    expect(out).toContain(`${UI_TEXT.fi.answer}: 1,1 ha`);
    expect(session.trainingUi.haku).toHaveLength(1);
    set(viewOf("question", "training.s1.measure"));
    session.begin(null);
    await expect(runCommand(session, "haku", ["x"], ctx)).rejects.toThrow(/S3 question cards/);
  });

  it("the smoke's policy plays every phase: continue, wait out the unit, one Search question, answers with confidence where asked", async () => {
    const { session, set } = await onTraining("en", viewOf("intro", null));
    const asked = new Set<number>();
    const policy = (v: TrainingView) => { set(v); return dumbPolicy(session, asked); };
    expect(policy(viewOf("intro", null))).toEqual(["continue"]);
    expect(policy(viewOf("study", "training.s4.memory"))).toEqual(["wait", "5"]);
    expect(policy(viewOf("question", "training.s1.place"))).toEqual(["training-answer", `${M + LIVE_MAP_PX.width / 2},${M + LIVE_MAP_PX.height / 2}`]);
    expect(policy(viewOf("question", "training.s3.records1"))).toEqual(["haku", "What did DR8 report at 10.05?"]);
    session.trainingUi.haku.push({ itemId: "training.s3.records1", query: "q", answer: { vastaus: "", perusteet: "", varmuus: "", muuttaisi: "" } });
    expect(policy(viewOf("question", "training.s3.records1"))).toEqual(["training-answer", "a", "50"]);
    expect(policy(viewOf("question", "training.s4.log"))).toEqual(["training-answer", "a", "50"]);
    expect(policy(viewOf("demo", null))).toEqual(["continue"]);
  });
});

describe("the practice tour in the harness", () => {
  it("still lists the records step right after Haku's (its text now refers back to the training)", async () => {
    const session = await PlaySession.create({ audience: "expert", lang: "en" });
    live.push(session);
    const asked = new Set<number>();
    for (let guard = 0; guard < 100 && session.snap().tour !== "practice"; guard++) {
      const [cmd, ...args] = dumbPolicy(session, asked);
      session.begin(null);
      await runCommand(session, cmd, args, { runDir: "/nonexistent", withMap: false });
    }
    session.begin(null);
    const tour = await runCommand(session, "look", [], { runDir: "/nonexistent", withMap: false });
    const at = PRACTICE_TOUR.findIndex((s) => s.id === "hakuRecords");
    const step = UI_TEXT.en.tour.steps.hakuRecords;
    expect(tour).toContain(`[${at + 1} / ${PRACTICE_TOUR.length}] ${step.title}\n${step.body}`);
    expect(tour).toContain(UI_TEXT.en.tour.startPractice);
  });
});
