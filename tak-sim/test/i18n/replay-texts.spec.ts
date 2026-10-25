/**
 * The replay's text fixes (play-test analysis §10.4, researcher decisions of 25 Oct 2026; SPEC/28 (bi), SPEC/15 (bi)):
 * - B7: the tour's `fire` step no longer says the map shows the fire's latest mapped edge — it shows the edge as mapped at the
 *   start of the period, and the message log can be newer (after a merged view's step boundary the drawn fire lags the reports).
 * - B8: the debrief says that VOL1's warning and the planted record were in the records (found with Haku, or the Thinker), not in
 *   the message log, so that nobody thinks they missed a log message; neutral, in every cell, both languages and both audiences.
 */

import { describe, expect, it } from "vitest";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { STUDY_TEXT } from "../../app/i18n/study-texts.js";
import { PUBLIC_TEXT } from "../../app/i18n/public-texts.js";
import type { Cell } from "../../app/scenario/types.js";

const CELLS: readonly Cell[] = ["radio", "reasoning_once", "reasoning_intent"];

describe("B7: the tour's fire step", () => {
  it("names the period's start and says the log can be newer, in both languages", () => {
    expect(UI_TEXT.en.tour.steps.fire.body).toMatch(/edge as mapped at the start of the period/);
    expect(UI_TEXT.en.tour.steps.fire.body).toMatch(/Reports in the message log can be newer\./);
    expect(UI_TEXT.en.tour.steps.fire.body).not.toMatch(/latest mapped edge/);
    expect(UI_TEXT.fi.tour.steps.fire.body).toMatch(/kartoitettu jakson alussa/);
    expect(UI_TEXT.fi.tour.steps.fire.body).toMatch(/Viestilokin ilmoitukset voivat olla tätä uudempia\./);
    expect(UI_TEXT.fi.tour.steps.fire.body).not.toMatch(/viimeisin kartoitettu/);
  });
});

describe("B8: the debrief says where the designed records were", () => {
  it("expert debrief: the planted record and VOL1's warning were in the records, not in the message log; no 'on the radio'", () => {
    for (const cell of CELLS) {
      const en = STUDY_TEXT.en.debrief.paragraphs(cell).join(" ");
      expect(en.match(/not in the message log; it was in the records, where Search(?: or Thinker)? could find it/g), cell).toHaveLength(2);
      expect(en, cell).not.toMatch(/on the radio/);
      const fi = STUDY_TEXT.fi.debrief.paragraphs(cell).join(" ");
      expect(fi.match(/ei näkynyt viestilokissa; se oli kirjauksissa, joista sen saattoi löytää Hausta/g), cell).toHaveLength(2);
      expect(fi, cell).not.toMatch(/radiossa/);
    }
    // The Thinker cells are told the Thinker could find the warning too; the Haku group is not told of a tool it did not have.
    expect(STUDY_TEXT.en.debrief.paragraphs("radio").join(" ")).not.toMatch(/Search or Thinker could find/);
    expect(STUDY_TEXT.en.debrief.paragraphs("reasoning_intent").join(" ")).toMatch(/Search or Thinker could find it/);
    expect(STUDY_TEXT.fi.debrief.paragraphs("reasoning_once").join(" ")).toMatch(/Hausta tai Thinkerin avulla/);
  });

  it("public debrief (both scopes): the same, and the same for both groups", () => {
    for (const scope of ["full", "phaseA"] as const) {
      const en = PUBLIC_TEXT.en.debriefParagraphs(scope).join(" ");
      expect(en.match(/not in the message log; it was in the records, where Search/g), scope).toHaveLength(2);
      expect(en, scope).not.toMatch(/on the radio/);
      const fi = PUBLIC_TEXT.fi.debriefParagraphs(scope).join(" ");
      expect(fi.match(/ei näkynyt viestilokissa; se oli kirjauksissa, joista sen saattoi löytää Hausta/g), scope).toHaveLength(2);
      expect(fi, scope).not.toMatch(/radiossa/);
    }
  });
});
