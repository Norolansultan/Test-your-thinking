/**
 * The play harness in the training incident (revision (bp), 26 Oct 2026; SPEC/15 (bp) §bp.7 "Play harness"): its pages and its map PNG
 * in both languages and audiences, `training-answer` (letters, or x,y read off the image's own grid: play-test B12), `continue`, `haku`
 * on the S3 cards, `measure` on its live map, and the smoke's policy through every phase to `training_completed` — on the real session
 * and the training's built content. The pure page function is also checked on a small fixture (`play-training-fixture.ts`) whose texts
 * are tagged by language. The tour's records step is still listed (`play.spec.ts` plays VP).
 */

import { afterEach, describe, expect, it } from "vitest";
import type { Lang } from "../../app/i18n/lang.js";
import type { TrainingView } from "../../app/session/training/host.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { PRACTICE_TOUR } from "../../app/render/ui/tour.js";
import { CONFIDENCE_SCALE } from "../../app/session/confidence.js";
import { PlaySession } from "../../tools/play/session.js";
import { runCommand } from "../../tools/play/commands.js";
import { dumbPolicy } from "../../tools/play/smoke.js";
import { lngLatAt } from "../../tools/play/map-camera.js";
import { LIVE_MAP_PX } from "../../tools/play/map-data.js";
import { gridSvg } from "../../tools/play/grid-svg.js";
import { FREEZE_MAP_MARGIN_PX, freezeFrame } from "../../tools/play/freeze-grid.js";
import { trainingScreen, type TrainingScreenInput } from "../../tools/play/training-pages.js";
import { inTraining, moveTrainingCamera, trainingItemOf, trainingLockBox, trainingOpening, trainingPointAt, trainingViewOf, TRAINING_GRID_MARGIN_PX, TRAINING_GRID_STEP_PX } from "../../tools/play/training-host.js";
import { TRAINING } from "../../app/session/training/spec-data.js";
import { TRAINING_TEXT } from "../../app/i18n/training-texts.js";
import { FIXTURE_SPEC, FIXTURE_TEXTS, viewOf } from "./play-training-fixture.js";

const M = TRAINING_GRID_MARGIN_PX;
const ctx = { runDir: "/nonexistent", withMap: true };
const live: PlaySession[] = [];
afterEach(() => { for (const s of live.splice(0)) s.dispose(); });

/** A real harness session played by the smoke's policy until `until` holds (the training's screens are reached on the way). */
async function playUntil(lang: Lang, audience: "expert" | "public", until: (session: PlaySession) => boolean) {
  const session = await PlaySession.create({ audience, lang, waitStopsOnMessages: true, questionnairesPlayed: true });
  live.push(session);
  const asked = new Set<number>();
  for (let guard = 0; guard < 300 && !until(session); guard++) {
    const [cmd, ...args] = dumbPolicy(session, asked);
    session.begin(null);
    await runCommand(session, cmd, args, { runDir: "/nonexistent", withMap: false });
  }
  if (!until(session)) throw new Error("playUntil: never reached");
  return session;
}
const phaseIs = (phase: TrainingView["phase"], itemId?: string) => (session: PlaySession) => {
  const v = trainingViewOf(session.snap());
  return v !== null && v.phase === phase && (itemId === undefined || v.itemId === itemId);
};
const look = async (session: PlaySession) => { session.begin(null); return runCommand(session, "look", [], ctx); };

function input(lang: Lang, view: TrainingView, audience: "expert" | "public" = "expert"): TrainingScreenInput {
  return {
    lang, audience, cell: "radio", view, spec: FIXTURE_SPEC, texts: FIXTURE_TEXTS[lang], secondsLeft: { cap: 600, card: 42, study: 5, demo: 0 },
    scene: null, logRows: ["10.12  DR8: [row]"], camera: trainingOpening(FIXTURE_SPEC), measures: [], rb: null, haku: [],
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

    it(`${lang}: round 4 (B20) — S3's card prints no Search pane until \`haku\` is used, only a » line naming the command`, () => {
      const text = trainingScreen(input(lang, viewOf("question", "training.s3.records1")), "/m.png", null).text;
      const t = UI_TEXT[lang];
      expect(text).not.toContain(`-- ${t.tak.paneTitle.haku} --`); // the app keeps Search closed (\`seek_first\`)
      expect(text).toContain(`-- ${t.tak.paneTitle.geochat}`); // the log is open, as the app opens it
      expect(text.split("\n").filter((l) => l.includes("`haku")).map((l) => l.slice(0, 2))).toEqual(["» "]);
      const s1 = trainingScreen(input(lang, viewOf("question", "training.s1.measure")), "/m.png", null).text;
      expect(s1).not.toContain("`haku");
    });

    it(`${lang}: the memory item — the unit on the live map for its exposure, then the blank map of the lock box with confidence`, () => {
      const study = trainingScreen(input(lang, viewOf("study", "training.s4.memory")), "/m.png", "/b.png");
      expect(study.text).toMatch(/5 s left \(`wait 5`\)/);
      expect(study.text).toContain("\nmemoryExposure\n» The unit is shown"); // round 4 (B21): the app's line (the fixture's texts have none)
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

describe("the training on the real session, through the harness's commands", () => {
  for (const [lang, audience] of [["fi", "expert"], ["en", "public"]] as const) {
    it(`${lang}/${audience}: the policy plays it through — every page in the session language, the training's records only — to its end`, async () => {
      const texts = TRAINING_TEXT[lang];
      const session = await PlaySession.create({ audience, lang, waitStopsOnMessages: true, questionnairesPlayed: true });
      live.push(session);
      const asked = new Set<number>();
      const seen = new Set<string>();
      for (let guard = 0; guard < 300 && session.snap().step !== "briefing"; guard++) {
        const v = trainingViewOf(session.snap());
        if (v) {
          const text = await look(session);
          seen.add(v.phase);
          if (v.phase === "intro") expect(text).toContain(texts.intro.title);
          if (v.phase === "question" || v.phase === "feedback") expect(text).toContain(texts.item(v.itemId!).stem);
          if (v.phase === "feedback") for (const line of texts.feedback(v.itemId!, { answer: v.answer, key: trainingItemOf(v)!.key, errorM: v.errorM, timedOut: v.timedOut, source: trainingItemOf(v)!.source, numbers: trainingItemOf(v)!.feedback.numbers, ...(trainingItemOf(v)!.lesson ? { lesson: trainingItemOf(v)!.lesson! } : {}) })) expect(text).toContain(line);
          if (v.phase === "demo") expect(text).toContain(texts.demo("radio").title);
        }
        const [cmd, ...args] = dumbPolicy(session, asked);
        session.begin(null);
        await runCommand(session, cmd, args, ctx);
      }
      expect([...seen].sort()).toEqual(["demo", "feedback", "intro", "question", "section", "study"]);
      const records = await session.o.logRecords();
      const kinds = records.map((r) => r.kind);
      expect(kinds.filter((k) => k === "training_answer")).toHaveLength(TRAINING.items.length);
      expect(kinds.filter((k) => k === "training_haku_asked")).toHaveLength(1); // the policy's one Search question, on the first S3 card
      expect(records.find((r) => r.kind === "training_completed")!.detail).toMatchObject({ endReason: "completed", answeredCount: TRAINING.items.length, missingItemIds: [] });
      const answered = records.find((r) => r.kind === "training_haku_answered")!.detail as { retrieved: { id: string }[]; retrievalMode: string; answerSource: string };
      expect(answered.retrieved.every((x) => x.id.startsWith("trn."))).toBe(true);
      expect(answered.retrievalMode).toBe("lexical_only");
      expect(kinds.filter((k) => k.startsWith("ai_chat_") || k.startsWith("map_pretest_"))).toEqual([]);
      expect(session.snap().step).toBe("briefing");
    });
  }

  it("draws the live map PNG with the item and a grid, and the memory item's blank map of the lock box", async () => {
    const session = await playUntil("en", "expert", phaseIs("question", "training.s1.place"));
    session.begin(null);
    await runCommand(session, "look", [], ctx);
    expect(session.images).toHaveLength(1);
    expect(session.images[0]).toMatchObject({ kind: "training", data: { lang: "en", legend: false, training: { gridMarginPx: M, item: { id: "training.s1.place" }, lock: { area: TRAINING.area.bounds } } } });
    expect((session.images[0] as { data: { cycleInfo: unknown } }).data.cycleInfo).toBe(session.snap().renderTree.cycleInfo);
    const memory = await playUntil("fi", "expert", phaseIs("question", "training.s4.memory"));
    memory.begin(null);
    await runCommand(memory, "look", [], ctx);
    expect(memory.images).toEqual([expect.objectContaining({ kind: "freeze", lang: "fi", extent: trainingLockBox(TRAINING) })]);
  });

  it("`training-answer x,y` answers the grid's point (its error logged), `measure` notes its reading for the answer; refusals otherwise", async () => {
    const session = await playUntil("en", "expert", phaseIs("question", "training.s1.place"));
    const camera = trainingOpening(TRAINING);
    session.begin(null);
    await expect(runCommand(session, "training-answer", ["a"], ctx)).rejects.toThrow(/must lie on the map/);
    await expect(runCommand(session, "continue", [], ctx)).rejects.toThrow(/answer the item first/);
    await runCommand(session, "training-answer", [`${M + 500},${M + 340}`], ctx);
    const answer = (await session.o.logRecords()).filter((r) => r.kind === "training_answer").at(-1)!.detail as { itemId: string; point: unknown; errorM: number };
    const at = trainingPointAt(M + 500, M + 340, camera, TRAINING);
    expect(answer).toMatchObject({ itemId: "training.s1.place", point: "point" in at ? at.point : null });
    expect(answer.errorM).toBeGreaterThanOrEqual(0);
    const measure = await playUntil("fi", "expert", phaseIs("question", "training.s1.measure"));
    measure.begin(null);
    await runCommand(measure, "measure", [`${M + 400},${M + 300}`, `${M + 600},${M + 300}`], ctx);
    measure.begin(null);
    await expect(runCommand(measure, "training-answer", ["z"], ctx)).rejects.toThrow(/options: a, b/);
    await runCommand(measure, "training-answer", ["b"], ctx);
    const d = (await measure.o.logRecords()).filter((r) => r.kind === "training_answer").at(-1)!.detail as { itemId: string; measures: number[]; choiceId: string };
    expect(d.itemId).toBe("training.s1.measure");
    expect(d.choiceId).toBe(TRAINING.items.find((i) => i.id === "training.s1.measure")!.options[1]!.id);
    expect(d.measures).toHaveLength(1);
    expect(d.measures[0]!).toBeGreaterThan(100);
  });

  it("S3: `haku` on the card answers over the training's records; the card asks for the confidence; Search is closed elsewhere", async () => {
    const session = await playUntil("fi", "expert", phaseIs("question", "training.s3.records1"));
    session.begin(null);
    const out = await runCommand(session, "haku", ["Mitä", "DR8", "ilmoitti", "klo", "10.05?"], ctx);
    expect(out).toContain("> Mitä DR8 ilmoitti klo 10.05?");
    expect(out).toContain(`${UI_TEXT.fi.answer}: `);
    expect(await look(session)).toContain(`-- ${UI_TEXT.fi.tak.paneTitle.haku} --\n> Mitä DR8 ilmoitti klo 10.05?`);
    session.begin(null);
    await expect(runCommand(session, "training-answer", ["a"], ctx)).rejects.toThrow(/confidence/);
    await runCommand(session, "training-answer", ["a", "75"], ctx);
    expect((await session.o.logRecords()).filter((r) => r.kind === "training_answer").at(-1)!.detail).toMatchObject({ itemId: "training.s3.records1", confidence: 75, hakuBefore: 1 });
    const s1 = await playUntil("en", "expert", phaseIs("question", "training.s1.measure"));
    s1.begin(null);
    await expect(runCommand(s1, "haku", ["x"], ctx)).rejects.toThrow(/S3 question cards/);
    expect(inTraining(s1.snap())).toBe(true);
  });

  it("round 4 (B21): the exposure prints the app's own line, \"Remember where unit EK53 is.\"", async () => {
    const session = await playUntil("en", "expert", phaseIs("study", "training.s4.memory"));
    expect(await look(session)).toContain(`${TRAINING_TEXT.en.ui.memoryExposure}\n» The unit is shown on the map`);
    expect(TRAINING_TEXT.en.ui.memoryExposure).toBe("Remember where unit EK53 is.");
  });

  it("round 4 (B26): each new item opens on the opening frame — T1's 1 km zoom is kept through its feedback, not into T2", async () => {
    const session = await playUntil("en", "expert", phaseIs("question", "training.s1.place"));
    const opening = trainingOpening(TRAINING);
    session.begin(null);
    await runCommand(session, "map", ["1km", `center=${M + 500},${M + 340}`], ctx);
    const zoomed = session.trainingUi.camera!;
    expect(zoomed.zoom).toBeGreaterThan(opening.zoom);
    session.begin(null);
    await runCommand(session, "training-answer", [`${M + 500},${M + 340}`], ctx);
    expect((session.images.at(-1) as { data: { camera: unknown } }).data.camera).toEqual(zoomed); // the feedback: the item's own camera
    session.begin(null);
    await runCommand(session, "continue", [], ctx);
    expect(trainingViewOf(session.snap())).toMatchObject({ phase: "question", itemId: "training.s1.measure" });
    await look(session);
    expect((session.images.at(-1) as { data: { camera: unknown } }).data.camera).toEqual(opening); // T2: the opening frame again
    session.begin(null);
    await runCommand(session, "measure", [`${M + 400},${M + 300}`, `${M + 600},${M + 300}`], ctx);
    expect(session.trainingUi).toMatchObject({ itemId: "training.s1.measure", camera: null }); // read on the opening frame
  });

  it("`map 1km` and `map reset` move the training's live map within its lock", async () => {
    const session = await playUntil("en", "expert", phaseIs("question", "training.s1.place"));
    session.begin(null);
    await runCommand(session, "map", ["1km", `center=${M + 500},${M + 340}`], ctx);
    expect(session.trainingUi.camera!.zoom).toBeGreaterThan(trainingOpening(TRAINING).zoom);
    session.begin(null);
    await runCommand(session, "map", ["reset"], ctx);
    expect(session.trainingUi.camera).toEqual(trainingOpening(TRAINING));
  });
});

describe("the smoke's policy on the training's phases (fixture views)", () => {
  it("continue, wait out the unit, one Search question, answers with confidence where asked", async () => {
    const session = await playUntil("en", "expert", phaseIs("intro"));
    session.trainingContent = { spec: FIXTURE_SPEC, texts: FIXTURE_TEXTS };
    const box: { view: TrainingView } = { view: viewOf("intro", null) };
    const real = session.snap.bind(session);
    (session as unknown as { snap: () => unknown }).snap = () => ({ ...real(), training: box.view, aiChatHistory: [] });
    const asked = new Set<number>();
    const policy = (v: TrainingView) => { box.view = v; return dumbPolicy(session, asked); };
    expect(policy(viewOf("intro", null))).toEqual(["continue"]);
    expect(policy(viewOf("question", "training.s1.place"))).toEqual(["training-answer", `${M + LIVE_MAP_PX.width / 2},${M + LIVE_MAP_PX.height / 2}`]);
    expect(policy(viewOf("question", "training.s3.records1"))).toEqual(["haku", "What did DR8 report at 10.05?"]);
    expect(policy(viewOf("question", "training.s4.log"))).toEqual(["training-answer", "a", "50"]);
    const f = freezeFrame(trainingLockBox(FIXTURE_SPEC));
    expect(policy(viewOf("question", "training.s4.memory"))).toEqual(["training-answer", `${Math.round(FREEZE_MAP_MARGIN_PX + f.widthPx / 2)},${Math.round(FREEZE_MAP_MARGIN_PX + f.heightPx / 2)}`, "50"]);
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
