/**
 * The study shell's texts (`app/i18n/study-texts.ts`, 5 Oct 2026): both languages for every screen
 * and item, the consent placeholder marked, the debrief's content and its cell differences. The English
 * glossary (R2) is gone since revision (ae): an English session needs none (`place-names.spec.ts`).
 */

import { describe, expect, it } from "vitest";
import { DEBRIEF_PROJECTION_HELD, DEBRIEF_VIEW_COUNT, STUDY_TEXT } from "../../app/i18n/study-texts.js";
import { ALL_QUESTIONNAIRE_ITEMS } from "../../app/session/questionnaire.js";
import { PREFLIGHT_FAILURES } from "../../app/session/preflight.js";
import { CANONICAL_FLAG_SEQUENCE } from "../../app/scenario/types.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { recordEn, sourceName } from "../../app/i18n/text.js";

const CELLS = ["radio", "reasoning_once", "reasoning_intent"] as const;

describe("consent and preflight texts", () => {
  it("the consent text is marked as a placeholder for the ethics board, in both languages, and names what is sent to the AI service", () => {
    for (const lang of ["fi", "en"] as const) {
      const c = STUDY_TEXT[lang].consent;
      expect(c.placeholderBanner).toMatch(/PAIKKAMERKKI|PLACEHOLDER/);
      expect(c.paragraphs.join(" ")).toMatch(/Google Gemini/); // 8 Oct 2026: the model provider (was Anthropic)
      // Both groups' Haku questions go to the model; the English text names the tool as the English screen does (revision (ah), review M2).
      expect(c.paragraphs.join(" ")).toMatch(lang === "fi" ? /Haku/ : /\(Search and/);
      if (lang === "en") expect(c.paragraphs.join(" ")).not.toMatch(/Haku/);
      expect(c.paragraphs.join(" ")).toMatch(/\[(Eettinen toimikunta|Ethics board)/);
      for (const v of [c.title, c.consentCheckbox, c.attestCheckbox, c.accept, c.decline, c.declinedTitle, c.declinedBody]) expect(v).not.toBe("");
    }
  });

  it("every preflight failure has a title and what to change, in both languages", () => {
    for (const lang of ["fi", "en"] as const) for (const f of PREFLIGHT_FAILURES) {
      expect(STUDY_TEXT[lang].preflight.failures[f].title, `${lang} ${f}`).not.toBe("");
      expect(STUDY_TEXT[lang].preflight.failures[f].fix, `${lang} ${f}`).not.toBe("");
    }
  });
});

describe("questionnaire texts", () => {
  it("every item has a prompt, every option a label and every scale its anchors, in both languages", () => {
    for (const lang of ["fi", "en"] as const) {
      const q = STUDY_TEXT[lang].questionnaire;
      for (const item of ALL_QUESTIONNAIRE_ITEMS) {
        const t = q.items[item.id];
        expect(t?.prompt, `${lang} ${item.id}`).toBeTruthy();
        expect(q.sections[item.section], `${lang} section ${item.section}`).toBeTruthy();
        if (item.kind === "choice") for (const o of item.options) expect(t!.options?.[o], `${lang} ${item.id}.${o}`).toBeTruthy();
        if (item.kind === "scale") { expect(t!.low).toBeTruthy(); expect(t!.high).toBeTruthy(); }
      }
      expect(Object.keys(q.items).sort()).toEqual(ALL_QUESTIONNAIRE_ITEMS.map((i) => i.id).sort());
    }
  });

  it("asks nothing that names a designed event before the debrief", () => {
    const all = JSON.stringify(STUDY_TEXT.en.questionnaire) + JSON.stringify(STUDY_TEXT.fi.questionnaire);
    expect(all).not.toMatch(/110|20 kV|power line|voimajohto|sähkölinj|planted|istutet|rekindl|flare|smoulder|kyte/i);
  });
});

describe("the debrief (SPEC/09 §5.1, revisions (o), (p), (t), (u))", () => {
  it("states the projection's accuracy rate from the scenario's flag sequence", () => {
    expect(CANONICAL_FLAG_SEQUENCE.length).toBe(DEBRIEF_VIEW_COUNT);
    expect(CANONICAL_FLAG_SEQUENCE.filter((f) => f === "holds").length).toBe(DEBRIEF_PROJECTION_HELD);
    expect(STUDY_TEXT.en.debrief.paragraphs("radio").join(" ")).toContain(`${DEBRIEF_PROJECTION_HELD} of the ${DEBRIEF_VIEW_COUNT} periods`);
  });

  it("explains F7, the rekindle and the directive in every cell and both languages; the withdrawal route is a placeholder; ends with the no-discussion request", () => {
    for (const cell of CELLS) {
      const en = STUDY_TEXT.en.debrief.paragraphs(cell).join(" ");
      expect(en).toMatch(/20 kV power line/); // SPEC/33 (bc): was 110 kV
      expect(en).toMatch(/flared up/);
      expect(en).toMatch(/directive did not fit all of them/);
      expect(en).toMatch(/PLACEHOLDER/);
      expect(STUDY_TEXT.en.debrief.paragraphs(cell).at(-1)).toMatch(/do not describe the session/);
      const fi = STUDY_TEXT.fi.debrief.paragraphs(cell).join(" ");
      expect(fi).toMatch(/20 kV:n sähkölinja/); // SPEC/33 (bc): was "110 kV voimajohto"
      expect(fi).toMatch(/syttyi myöhemmin uudelleen/);
      expect(fi).toMatch(/linjaus ei sopinut niihin kaikkiin/);
      expect(STUDY_TEXT.fi.debrief.paragraphs(cell).length).toBe(STUDY_TEXT.en.debrief.paragraphs(cell).length);
    }
  });

  it("describes no Directive line in any cell (8 Oct 2026); only the Thinker cells are told that Thinker could pass on the false record", () => {
    for (const cell of CELLS) expect(STUDY_TEXT.en.debrief.paragraphs(cell).join(" ")).not.toMatch(/line Directive/);
    expect(STUDY_TEXT.en.debrief.paragraphs("radio").join(" ")).not.toMatch(/Thinker read the same records/);
    expect(STUDY_TEXT.en.debrief.paragraphs("reasoning_once").join(" ")).toMatch(/Thinker read the same records/);
  });
});

describe("no glossary (revision (ae), 9 Oct 2026)", () => {
  it("neither language carries one", () => {
    for (const lang of ["fi", "en"] as const) expect("glossary" in STUDY_TEXT[lang]).toBe(false);
  });

  it("every Finnish word-named source an English session shows is named in English", () => {
    const sources = new Set(buildDemoScenario().atoms.map((a) => a.provenance.sourceId));
    const finnishSources = [...sources].filter((id) => /^[A-ZÄÖ]{3,}$/.test(id) && !["SPOT"].includes(id) && sourceName("en", id) === id);
    expect(finnishSources).toEqual([]);
  });

  it("the English records say VOL1 and vehicle location, not VPK and AVL", () => {
    const english = buildDemoScenario().atoms.map((a) => recordEn(a.id) ?? "").join("\n");
    expect(english).not.toMatch(/\bVPK\b|\bAVL\b/);
    expect(english).toMatch(/\bVOL1\b/);
    expect(Object.values(SITE_SCENARIO.english ?? {}).join(" ")).toMatch(/Vehicle location EK11:/);
  });
});
