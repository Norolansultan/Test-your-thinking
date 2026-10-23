/**
 * The information rule (difficulty audit, 23 Oct 2026; `proposal.md` (a)): the tour's log, Haku and V1 steps and the public primer say
 * that the message log shows only part of the traffic and that the rest is in the records, found with Haku — and no tour or primer
 * sentence says any longer that the units' reports arrive in the message log. Generic (no scenario name), the same in both groups.
 * The measure tool has its tour step (`proposal-map.md` d5). The map pretest's and the feedback's frames name nothing of the scenario.
 */

import { describe, expect, it } from "vitest";
import { UI_TEXT as UI } from "../../app/i18n/ui.js";
import { PRACTICE_TOUR, toolsTour } from "../../app/render/ui/tour.js";
import { PRIMER_CONTENT } from "../../app/render/ui/explain/primer-content.js";
import { RECORDS_RULE_EN, RECORDS_RULE_FI, TOUR_HAKU_ASK_EN, TOUR_HAKU_ASK_FI } from "../../app/scenario/briefing.js";
import { DIFFICULTY_TEXT } from "../../app/i18n/difficulty-texts.js";
import { finnishNamesIn } from "../../app/i18n/place-names.js";
import { basemapPx } from "../../app/render/ui/basemap-px.js";
import siteMeta from "../../app/scenario/site-meta.json" with { type: "json" };

const ALL_ARRIVE = /(?:ilmoitukset tulevat viestilokiin|reports? (?:from the units )?(?:and other actors )?arrive in the message log|message log, where the units' reports arrive|viestiloki, johon yksiköiden ilmoitukset tulevat)/i;

describe("the information rule in the tour and the primer (difficulty audit (a))", () => {
  it("the tour's log step says the log is only part of the traffic, names the kinds kept in the records, and Haku", () => {
    expect(UI.fi.tour.steps.log.title).toMatch(/vain osa liikenteestä/);
    expect(UI.en.tour.steps.log.title).toMatch(/only part of the traffic/);
    expect(UI.fi.tour.steps.log.body).toMatch(/vain osa liikenteestä.*kirjauksissa.*Hausta/s);
    expect(UI.en.tour.steps.log.body).toMatch(/only part of the traffic.*records.*Search/s);
    expect(UI.fi.tour.steps.haku.body).toContain(TOUR_HAKU_ASK_FI);
    expect(UI.en.tour.steps.haku.body).toContain(TOUR_HAKU_ASK_EN);
    expect(UI.fi.tour.steps.toolsHaku.body).toMatch(/viestiloki näyttää vain osan liikenteestä/);
    expect(UI.en.tour.steps.toolsHaku.body).toMatch(/the message log shows only part of the traffic/);
    expect(toolsTour("directed").map((s) => s.id)).toEqual(["toolsHaku"]); // both groups see it
  });

  it("no tour step or primer sentence says the units' reports (all) arrive in the message log", () => {
    for (const lang of ["fi", "en"] as const) {
      for (const [id, s] of Object.entries(UI[lang].tour.steps)) expect(`${s.title} ${s.body}`, `${lang} ${id}`).not.toMatch(ALL_ARRIVE); // determinism-lint-allow: test only
      for (const p of PRIMER_CONTENT[lang].pages) for (const t of [...p.body, p.question.stem, ...p.question.options, p.question.explanation]) expect(t, `${lang} ${p.id}`).not.toMatch(ALL_ARRIVE);
    }
  });

  it("the public primer's screen page carries the rule and its new check question (a new id, so old and new answers never pool)", () => {
    for (const lang of ["fi", "en"] as const) {
      const screen = PRIMER_CONTENT[lang].pages.find((p) => p.id === "screen")!;
      expect(screen.question.id).toBe("primer.q.records");
      expect(screen.question.correct).toBe(1);
      expect(screen.body[1]).toMatch(lang === "fi" ? /vain osan liikenteestä.*kirjauksissa.*Hausta/s : /only part of the traffic.*records.*Search/s);
    }
    expect(PRIMER_CONTENT.fi.pages.flatMap((p) => [p.question.id])).not.toContain("primer.q.screen");
  });

  it("the rule is generic and the same for both groups: no place name, no AI tool", () => {
    expect(finnishNamesIn(RECORDS_RULE_EN)).toEqual([]);
    for (const t of [RECORDS_RULE_FI, RECORDS_RULE_EN, TOUR_HAKU_ASK_FI, TOUR_HAKU_ASK_EN]) expect(t).not.toMatch(/\b(AI|tekoäly|Thinker|LLM)\b/);
    for (const step of PRACTICE_TOUR) for (const lang of ["fi", "en"] as const) expect(UI[lang].tour.steps[step.id].body, step.id).not.toMatch(/\b(AI|tekoäly|Thinker|LLM)\b/);
  });

  it("the measure tool has a tour step after the zoom step, pointing at the TAK shell's R&B button (d5)", () => {
    const ids = PRACTICE_TOUR.map((s) => s.id);
    expect(ids.indexOf("measure")).toBe(ids.indexOf("zoom") + 1);
    expect(PRACTICE_TOUR.find((s) => s.id === "measure")!.target).toBe('[data-testid="tak-tool-range_bearing"]');
    expect(UI.fi.tour.steps.measure.body).toMatch(/Mittaa/);
    expect(UI.en.tour.steps.measure.body).toMatch(/R&B/);
  });

  it("the pretest's and the feedback's frames name no place of the scenario", () => {
    for (const lang of ["fi", "en"] as const) {
      const t = DIFFICULTY_TEXT[lang];
      const texts = [t.pretest.title, t.pretest.intro(6), t.feedback.title, t.feedback.intro, t.feedback.map, t.feedback.workedOut, t.feedback.head, t.feedback.headNoMark, t.feedback.closingHaku, t.feedback.closingThinker];
      for (const s of texts) expect(s).not.toMatch(/Haukilampi|Pike Pond|Mökkiranta|Lakeside|Lahdenkylä|Bay Village|Kuivakangas|Dry Heath/);
    }
  });
});

describe("WGS84 to the basemap's pixels (the feedback's small map)", () => {
  it("is exact at the image's corners and lands the tiles' own corners on their pixel positions", () => {
    const size = siteMeta.sizePx;
    const corners = siteMeta.cornersWgs84 as unknown as [number, number][];
    const expected = [[0, 0], [size, 0], [size, size], [0, size]];
    corners.forEach(([lon, lat], i) => {
      const p = basemapPx({ lat, lon });
      expect(Math.abs(p.x - expected[i]![0]!)).toBeLessThan(0.01);
      expect(Math.abs(p.y - expected[i]![1]!)).toBeLessThan(0.01);
    });
    for (const t of siteMeta.tiles) {
      const [row, col] = t.url.match(/(\d)_(\d)\.webp$/)!.slice(1).map(Number);
      const [lon, lat] = (t.corners as unknown as [number, number][])[0]!;
      const p = basemapPx({ lat, lon });
      expect(Math.abs(p.x - col! * 1250), t.url).toBeLessThan(0.05);
      expect(Math.abs(p.y - row! * 1250), t.url).toBeLessThan(0.05);
    }
  });
});
