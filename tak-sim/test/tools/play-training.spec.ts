/**
 * The play harness prints the two training additions of revision (bl), 25 Oct 2026, in the session's language: the tour's new step
 * after Haku's ("What the records hold") and, on the practice feedback, the records item's search lesson with the right answer and the
 * participant's own — and nothing of the other items' options. The lines are the screen's (`searchLessonLines`).
 */

import { describe, expect, it } from "vitest";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { DIFFICULTY_TEXT } from "../../app/i18n/difficulty-texts.js";
import { tr } from "../../app/i18n/text.js";
import { PRACTICE_TOUR } from "../../app/render/ui/tour.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { searchLessonLines } from "../../app/session/practice-feedback.js";
import { PlaySession } from "../../tools/play/session.js";
import { runCommand } from "../../tools/play/commands.js";
import { dumbPolicy } from "../../tools/play/smoke.js";

const scenario = buildDemoScenario();

/** Plays the dumb policy to the practice feedback, a `look` at the practice tour and at the feedback; their outputs and the feedback's view. */
async function screens(lang: "fi" | "en") {
  const session = await PlaySession.create({ audience: "expert", lang });
  const ctx = { runDir: "/nonexistent", withMap: false };
  const asked = new Set<number>();
  let tour: string | null = null;
  try {
    for (let guard = 0; guard < 300; guard++) {
      session.begin(null);
      const s = session.snap();
      if (s.tour === "practice" && tour === null) tour = await runCommand(session, "look", [], ctx);
      if (s.step === "practice_feedback") return { tour: tour!, feedback: await runCommand(session, "look", [], ctx), view: s.practiceFeedback! };
      const [cmd, ...args] = dumbPolicy(session, asked);
      session.begin(null);
      await runCommand(session, cmd, args, ctx);
    }
  } finally { session.dispose(); }
  throw new Error("the practice feedback was never reached");
}

describe.each(["fi", "en"] as const)("the harness in %s", (lang) => {
  const other = lang === "fi" ? "en" : "fi";
  it("lists the tour with the records step right after Haku's, in the session language only", async () => {
    const { tour } = await screens(lang);
    const n = PRACTICE_TOUR.length;
    const at = PRACTICE_TOUR.findIndex((s) => s.id === "hakuRecords");
    expect(PRACTICE_TOUR[at - 1]!.id).toBe("haku");
    const step = UI_TEXT[lang].tour.steps.hakuRecords;
    expect(tour).toContain(`-- ${lang === "fi" ? "Esittely" : "Guided tour"} (${n}) --`);
    expect(tour).toContain(`[${at + 1} / ${n}] ${step.title}\n${step.body}`);
    expect(tour.indexOf(`[${at} / ${n}] ${UI_TEXT[lang].tour.steps.haku.title}`)).toBeLessThan(tour.indexOf(step.title));
    expect(tour).not.toContain(UI_TEXT[other].tour.steps.hakuRecords.title);
    expect(tour).not.toContain(UI_TEXT[other].tour.steps.hakuRecords.body);
  });

  it("prints the records item's lesson and the participant's answer on the feedback, in the session language, and no other item's option", async () => {
    const { feedback, view } = await screens(lang);
    const lesson = view.items.find((i) => i.lesson !== null)!.lesson!;
    expect(lesson.yourFi).not.toBeNull(); // the dumb policy answered the practice item
    const lines = searchLessonLines(lang, lesson);
    const t = DIFFICULTY_TEXT[lang].feedback;
    const rows = feedback.split("\n");
    const at = rows.indexOf(lines.lesson);
    expect(at).toBeGreaterThan(0);
    expect(rows[at - 1]).toMatch(lang === "fi" ? /^Tämä ei ollut viestilokissa\./ : /^This was not in the message log\./); // after its source line, as before
    expect(rows[at + 1]).toBe(lines.yours);
    expect(lines.lesson).toContain(lang === "fi" ? "Haun kysymys kuten „" : "A Search question such as “");
    expect(lines.yours).toMatch(lang === "fi" ? /^Vastauksesi: / : /^Your answer: /);
    expect(feedback).toContain(t.intro);
    expect(feedback).not.toContain(t.example(view.items.find((i) => i.lesson !== null)!.exampleQuestion![lang])); // replaced by the lesson
    expect(feedback).not.toContain(lang === "fi" ? "A Search question" : "Haun kysymys"); // the other language's lesson is not printed
    // The log, map and worked-out items stay source-only: none of their options is on the page.
    for (const it of scenario.practice.freeze.items.filter((x) => x.id !== "freeze.practice.forecast")) {
      for (const o of it.options) expect(feedback, `${it.id} ${o.id}`).not.toContain(tr(lang, o.labelFi));
    }
  });
});
