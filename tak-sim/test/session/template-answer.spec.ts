/**
 * B6 (SPEC/14 revision (bi), 25 Oct 2026; play-test analysis §10.3 d): Haku's template fallback (`template-answer.ts`, step 6)
 * never shows a record that is a question as the answer — the next ranked record is taken — and shows a record more than 30
 * minutes older than the period's end (the model's age reference, `ageReferenceOf`) as "epävarma (tieto klo hh.mm)" /
 * "uncertain (record from hh.mm)" instead of its own certainty. The question rule is narrow: a unit asking command (a trailing
 * question, or one it opens with), never unit-to-unit traffic, decided on the record's source text in both languages.
 */

import { describe, expect, it } from "vitest";
import { toRenderable, type RenderableAtom } from "../../app/boundary/render-boundary.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { STEP_SECONDS } from "../../app/scenario/views.js";
import { buildTemplateAnswer, isQuestionRecord, recordAgeAt, STALE_RECORD_MINUTES } from "../../app/session/template-answer.js";
import { templateThinkerAnswer } from "../../app/session/thinker-protocol.js";
import { ageReferenceOf, recordAgeMinutes } from "../../server/thinker/model.js";

const scenario = buildDemoScenario();

/** A record as the template gets it: source, time (virtual seconds; 0 is 13.20), certainty, text. */
function rec(id: string, sourceId: string, observedAt: number, text: string, certainty: RenderableAtom["provenance"]["certainty"] = { kind: "confirmed" }): RenderableAtom {
  return { id, record: { kind: "text", text } as never, provenance: { sourceId, observedAt, certainty } as never, degradationVisible: [] };
}

describe("a record that is a question is never the answer", () => {
  it.each([
    ["EK12", "EK12, kaakkoissivusta: tuulen suunta muuttui, nyt etelästä 6,0 m/s. Onko uutta ennustetta?"], // a trailing question to command
    ["KY21", "Johto, KY21, pohjoisreuna: onko vettä tulossa?"],
    ["EK14", "EK14 pohjoisreuna — onko Mökkirannan mökit tarkistettu? Emme tiedä onko siellä ihmisiä."], // opens with the question
    ["EK11", "Onko L3:lle tulossa lisää miehistöä?"],
  ])("%s: '%s' is a question", (source, text) => {
    expect(isQuestionRecord(rec("q", source, 0, text))).toBe(true);
  });

  it.each([
    ["VPK", "EK15, VPK: etelään noin 600 m päässä nousee savua. Mahdollinen uudelleensyttymä, varmistamatta. Onko teillä näkyvyys sinne?"], // to another unit
    ["VPK", "KY21, täällä VPK. Tulimme viereenne, 100 m länteen. Kumpi ottaa välin? Ehdotan että me."],
    ["KY21", "EK15, KY21: meillä vesi vähissä, enää 6 %. Voitteko syöttää meidän linjaa? Väliä noin 50 m."],
    ["VPK", "VPK täällä Lahdenkylä. Montako taloa on vielä tyhjentämättä? Poliisi on kylän pohjoispäässä."], // asks in the middle, then reports
    ["VPK", "VPK täällä Lahdenkylä. Kaksi taloa ilmoittaa jäävänsä. Pyydämme johdolta päätöstä, jatkammeko suostuttelua."], // an indirect question
    ["DR1", "DR1: kärki etenee 14 m/min koilliseen."],
  ])("%s: '%s' is not", (source, text) => {
    expect(isQuestionRecord(rec("r", source, 0, text))).toBe(false);
  });

  it("takes the next ranked record, and builds the basis over the records that are not questions", () => {
    const question = rec("q", "EK14", 2400, "EK14 pohjoisreuna — onko Mökkirannan mökit tarkistettu? Emme tiedä onko siellä ihmisiä.");
    const answer = rec("a", "JOHTOPAIKKA", 2460, "Poliisi on pyydetty tarkistamaan mökit; tietoa ei vielä ole.", { kind: "probable", basis: "poliisi" });
    const other = rec("b", "DR1", 2100, "DR1: kärki etenee koilliseen.");
    const fi = buildTemplateAnswer([question, answer, other], "fi");
    expect(fi.answerFi).toBe("Poliisi on pyydetty tarkistamaan mökit; tietoa ei vielä ole.");
    expect(fi.basisFi).toBe("JOHTOPAIKKA klo 14.01; DR1 klo 13.55");
    expect(fi.certaintyFi).toBe("todennäköinen (poliisi)");
    expect(buildTemplateAnswer([question, answer], "en").basisFi).not.toMatch(/14\.00/);
    // Only questions: nothing to answer with.
    expect(buildTemplateAnswer([question], "fi").answerFi).toBe("Ei osumia arkistossa tähän mennessä raportoidusta.");
    expect(buildTemplateAnswer([question], "en").answerFi).toMatch(/^No hits/);
  });

  it("in the corpus: a few records, none of them unit-to-unit traffic, the same in both languages", () => {
    const caught = scenario.atoms.filter((a) => isQuestionRecord(toRenderable(a)));
    expect(caught.length).toBeGreaterThan(0);
    expect(caught.length).toBeLessThan(scenario.atoms.length / 50);
    for (const a of caught) expect(a.tier, a.id).not.toBe("T4_lateral");
    // The play-test's echoed question (K15, L16; replay K14, L15) is one; VPK's 17:24 report to EK15 (K23's answer) is not.
    expect(caught.map((a) => a.id)).toContain("evt.c10.029");
    expect(caught.map((a) => a.id)).not.toContain("evt.c13.008");
  });
});

describe("an old record is not shown as certain", () => {
  // Step 3 ends at 14.20 (virtual 3600); 13.49 is 31 minutes before it, 13.50 is 30.
  const end = 3 * STEP_SECONDS;
  const old = rec("o", "SÄÄENNUSTE", 29 * 60, "Ennuste: tuuli kääntyy etelään.");
  const edge = rec("e", "SÄÄENNUSTE", 30 * 60, "Ennuste: tuuli kääntyy etelään.");

  it("more than 30 minutes before the period's end: 'epävarma (tieto klo hh.mm)' / 'uncertain (record from hh.mm)'", () => {
    expect(STALE_RECORD_MINUTES).toBe(30);
    expect(buildTemplateAnswer([old], "fi", end).certaintyFi).toBe("epävarma (tieto klo 13.49)");
    expect(buildTemplateAnswer([old], "en", end).certaintyFi).toBe("uncertain (record from 13.49)");
    expect(buildTemplateAnswer([edge], "fi", end).certaintyFi).toBe("varma"); // exactly 30 minutes: its own
    expect(buildTemplateAnswer([edge], "en", end).certaintyFi).toBe("certain");
    // The answer and the basis are unchanged; only the certainty.
    expect(buildTemplateAnswer([old], "fi", end).answerFi).toBe(buildTemplateAnswer([old], "fi").answerFi);
    expect(buildTemplateAnswer([old], "fi", end).basisFi).toBe("SÄÄENNUSTE klo 13.49");
  });

  it("replaces every own certainty, and without a reference (older callers) none", () => {
    for (const certainty of [{ kind: "probable", basis: "x" }, { kind: "uncertain", basis: "x" }, { kind: "unknown" }] as const) {
      expect(buildTemplateAnswer([rec("o", "DR1", 0, "t", certainty)], "fi", end).certaintyFi).toBe("epävarma (tieto klo 13.20)");
    }
    expect(buildTemplateAnswer([old], "fi").certaintyFi).toBe("varma");
    expect(templateThinkerAnswer([old], "fi", "standard", end).varmuus).toBe("epävarma (tieto klo 13.49)");
  });

  it("counts ages as the model's record lines do, to the end of the question's step", () => {
    for (const step of [-3, 1, 7, 20]) expect(ageReferenceOf(step)).toBe(step * STEP_SECONDS);
    for (const [t, ref] of [[0, 3600], [1799, 3600], [1801, 3600], [-4800, -3600]] as const) expect(recordAgeAt(t, ref)).toBe(recordAgeMinutes(t, ref));
  });
});
