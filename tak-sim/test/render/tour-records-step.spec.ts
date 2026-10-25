/**
 * Revision (bl), 25 Oct 2026 (researcher): the tour's new step after Haku's, "What the records hold" (`hakuRecords`). It shows where the
 * information is and how to ask for it — by topic, by place, by source and time — and never says that one must search, that scores depend
 * on it, or anything about the memory checks. Its examples belong to the PRACTICE view (the forecast, the water-supply log, DR1 at
 * 12.05), and a lexical Haku question for each, at the practice step with the time gate, ranks the intended practice record in the top 3
 * in both languages. The step names no scored item's subject; the texts are the same for both groups and both audiences.
 *
 * Revision (bn), 25 Oct 2026 (review S6, S4): the place example ("Voivatko säiliöautot täyttää Haukilammelta?" / "Can tankers fill up
 * at Pike Pond?") was word for word V4 `infra`'s findability question; it is a SOURCE example on an unscored practice record (the water
 * supply's 12.12 log), so the three are topic, source, source and time. The kinds no longer name the road reports (the R1 series,
 * retrieval-dependent by design), and the last sentence names the command centre that acknowledges reports (the pointers).
 */

import { describe, expect, it } from "vitest";
import { UI_TEXT as UI } from "../../app/i18n/ui.js";
import { PLACE_NAMES_EN } from "../../app/i18n/place-names.js";
import { recordIn } from "../../app/i18n/text.js";
import { PRACTICE_TOUR, practiceTour, tourSteps } from "../../app/render/ui/tour.js";
import { clockAtVirtual } from "../../app/render/projection-validity.js";
import { hybridRetrieve, recordClockMinutes, retrievalConfigOf } from "../../app/retrieval/hybrid.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { PRACTICE_STEP } from "../../app/scenario/views.js";
import { recordClockLabel } from "../../app/session/message-history.js";
import { recordText } from "../../app/session/template-answer.js";
import { toRenderable } from "../../app/boundary/render-boundary.js";
import { FINDABILITY_QUERIES } from "../../tools/review/difficulty-audit.js";
import { SEEK_QUESTIONS } from "../../tools/review/seek-questions.js";

/**
 * The researcher's texts of 25 Oct 2026 with revision (bn)'s amendments (review S6, S4), word for word (the English with "Haku"; the
 * shipped English names the tool "Search", below). DRAFT, native check.
 */
const RESEARCHER = {
  en: {
    title: "What the records hold",
    body: "Besides the message log, the command post's records hold reports you are not sent automatically: drone surveys and their figures, weather forecasts, units' water and fuel status when asked, and messages from other authorities. Ask Haku as you would ask the command centre by radio — by topic (“What is the latest weather forecast?”), by source (“What has water supply recorded?”) or by source and time (“What did DR1 report at 12.05?”). When the command centre acknowledges a unit's report on the radio, the details are in the records.",
  },
  fi: {
    title: "Mitä kirjauksista löytyy",
    body: "Viestilokin lisäksi johtopaikan kirjauksissa on ilmoituksia, joita sinulle ei lähetetä automaattisesti: droonien kartoitukset lukuineen, sääennusteet, yksiköiden vesi- ja polttoainetilanne kysyttäessä sekä muiden viranomaisten viestit. Kysy Haulta kuin kysyisit johtokeskukselta radiolla: aiheen mukaan („Mikä on viimeisin sääennuste?”), lähteen mukaan („Mitä vesihuolto on kirjannut?”) tai lähteen ja kellonajan mukaan („Mitä DR1 ilmoitti klo 12.05?”). Kun johtokeskus (JOKE) kuittaa radiossa yksikön ilmoituksen, yksityiskohdat löytyvät kirjauksista.",
  },
} as const;

const scenario = buildDemoScenario();
const practiceAtoms = reachableAtoms(scenario.atoms, PRACTICE_STEP);
const step = (lang: "fi" | "en") => UI[lang].tour.steps.hakuRecords;
const textOf = (lang: "fi" | "en") => `${step(lang).title} ${step(lang).body}`;

describe("the records step's texts (revision (bl))", () => {
  it("is the researcher's Finnish word for word, and the researcher's English with the tool named as the English screen names it", () => {
    expect(step("fi")).toEqual(RESEARCHER.fi);
    // The one substitution: "Haku" is "Search" on the English screen (its tab, the step before it, the consent text), so "Ask Haku as" reads "Ask Search as".
    expect(UI.en.haku).toBe("Search");
    expect(step("en")).toEqual({ title: RESEARCHER.en.title, body: RESEARCHER.en.body.replace("Ask Haku as", "Ask Search as") });
    expect(step("en").body).not.toMatch(/Haku/);
    expect(step("en").body).toContain(`Ask ${UI.en.haku} as you would ask the command centre by radio`);
  });

  it("follows the tour's style: a short title, a body that is plain running text ending in a full stop, no markup, no ids", () => {
    for (const lang of ["fi", "en"] as const) {
      expect(step(lang).title.length, lang).toBeLessThanOrEqual(40);
      expect(step(lang).body, lang).toMatch(/\.$/);
      expect(textOf(lang), lang).not.toMatch(/[<>*#`]|evt\.|freeze\.|probe\./);
    }
  });
});

describe("the records step in the practice tour (revision (bl))", () => {
  it("comes right after the Haku step, points at the Haku pane as the Haku step does, and is in every cell's tour", () => {
    const ids = PRACTICE_TOUR.map((s) => s.id);
    expect(ids.indexOf("hakuRecords")).toBe(ids.indexOf("haku") + 1);
    expect(ids.slice(ids.indexOf("log"), ids.indexOf("decision") + 1)).toEqual(["log", "haku", "hakuRecords", "decision"]);
    const haku = PRACTICE_TOUR.find((s) => s.id === "haku")!;
    expect(PRACTICE_TOUR.find((s) => s.id === "hakuRecords")).toEqual({ id: "hakuRecords", target: haku.target, placement: haku.placement });
    expect(haku.target).toBe('[data-tour="haku"]');
    for (const cell of ["radio", "reasoning_once", "reasoning_intent"] as const) {
      expect(tourSteps("practice", cell === "radio" ? "directed" : "substitutive", cell).map((s) => s.id), cell).toContain("hakuRecords");
    }
  });

  it("makes the practice tour one step longer: 17 steps, 18 with the Thinker practice (after the two Haku steps)", () => {
    expect(PRACTICE_TOUR).toHaveLength(17);
    expect(practiceTour("directed")).toHaveLength(17);
    const thinker = practiceTour("substitutive").map((s) => s.id);
    expect(thinker).toHaveLength(18);
    expect(thinker.slice(thinker.indexOf("haku"), thinker.indexOf("decision") + 1)).toEqual(["haku", "hakuRecords", "practiceThinker", "decision"]);
  });

  it("is one step for everyone: the same in the Haku and the Thinker cells (the texts are one table, both audiences)", () => {
    const radio = tourSteps("practice", "directed", "radio").find((s) => s.id === "hakuRecords");
    for (const cell of ["reasoning_once", "reasoning_intent"] as const) expect(tourSteps("practice", "substitutive", cell).find((s) => s.id === "hakuRecords")).toEqual(radio);
  });
});

describe("what the step must not say (the researcher's principle: teach HOW to search, not THAT one must)", () => {
  it("never tells the participant to search, never mentions the memory checks or scores, and names no AI tool", () => {
    const MUST_SEARCH = /ennen kuin vastaat|ennen vastaamista|muistikatko|muistin varassa|pisteit|pisteyt|tulos|kannattaa|täytyy|pitää (?:hakea|käyttää)|älä unohda|before you answer|before answering|memory check|from memory|\bscor|\bpoints?\b|\bmust\b|\bshould\b|\bneed to\b|remember to|do not forget/i;
    for (const lang of ["fi", "en"] as const) {
      expect(textOf(lang), lang).not.toMatch(MUST_SEARCH);
      expect(textOf(lang), lang).not.toMatch(/\b(AI|tekoäly|Thinker|agentti|analyysiagentti|LLM)\b/i);
    }
  });

  it("names no scored item's subject: no power line or company, police, cabins, village, evacuation, bridge, roads by name, rekindle or aircraft; only 'other authorities'", () => {
    const SCORED_SUBJECTS = /sähk|voima(?:johto|yhtiö)|20 kV|\bF7\b|power|electric|poliis|police|mökki|cabin|cottage|Lahdenkylä|Bay Village|evakuoi|evacuat|lähde(?:tä|vät) pois|silta|sillan|bridge|\bR[123]\b|uudelleen syty|rekindl|kytö|smoulder|helikopteri|ilma-alus|helicopter|aircraft|\bHELI/i;
    for (const lang of ["fi", "en"] as const) expect(textOf(lang), lang).not.toMatch(SCORED_SUBJECTS);
    expect(step("fi").body).toContain("muiden viranomaisten viestit");
    expect(step("en").body).toContain("messages from other authorities");
  });
});

describe("the step's examples belong to the practice view", () => {
  const recordsAt = (lang: "fi" | "en") => practiceAtomsText(lang);

  it("the sources and times it names are all in the practice view's records: DR1, the water supply, 12.05, the forecast; it names no place (revision (bn))", () => {
    // Sources: the call signs in the text (DR1) have records in the practice view.
    for (const lang of ["fi", "en"] as const) {
      for (const sign of new Set(step(lang).body.match(/\b[A-Z]{2,}\d+\b/g) ?? [])) {
        expect(practiceAtoms.some((a) => a.provenance.sourceId === sign), `${lang} ${sign}`).toBe(true);
      }
    }
    // Places: revision (bn) took the place example out (it was V4 `infra`'s findability question), so the text names no place of the site.
    const fiNamed = Object.keys(PLACE_NAMES_EN).filter((n) => step("fi").body.includes(n.length > 6 ? n.slice(0, 6) : n));
    const enNamed = Object.values(PLACE_NAMES_EN).filter((n) => step("en").body.includes(n));
    expect(fiNamed).toEqual([]);
    expect(enNamed).toEqual([]);
    // The source example's source keeps a log in the practice view (the water supply's 12.12 tank levels), shown in both languages.
    expect(practiceAtoms.filter((a) => a.provenance.sourceId === "VESIHUOLTO").map((a) => a.id)).toEqual(["evt.vp.016"]);
    expect(recordsAt("fi").some((t) => t.startsWith("Vesihuoltoloki"))).toBe(true);
    expect(recordsAt("en").some((t) => t.startsWith("Water supply log"))).toBe(true);
    // Times: the clock it names (12.05) is a practice DR1 record's, observed and shown at 12:05; the forecast is a practice record too.
    const dr1 = practiceAtoms.filter((a) => a.provenance.sourceId === "DR1" && recordClockLabel(a) === "12:05");
    expect(dr1.map((a) => a.id)).toEqual(["evt.vp.008"]);
    expect(clockAtVirtual(dr1[0]!.provenance.observedAt)).toBe("12:05");
    expect(recordClockMinutes(dr1[0]!)).toBe(12 * 60 + 5);
    expect(practiceAtoms.find((a) => a.id === "evt.wx.01")!.provenance.sourceId).toBe("SÄÄENNUSTE");
    for (const lang of ["fi", "en"] as const) expect(step(lang).body).toMatch(/12\.05/);
    expect(step("fi").body.match(/klo \d+\.\d+/g)).toEqual(["klo 12.05"]);
  });

  /** Each example, from the shipped text (so that the text and this test cannot drift apart), with the practice record it should find. */
  const EXAMPLES: ReadonlyArray<{ readonly kind: string; readonly intended: string }> = [
    { kind: "topic: the forecast", intended: "evt.wx.01" },
    { kind: "source: the water supply's 12.12 log (revision (bn); was the place Pike Pond, V4 infra's findability question)", intended: "evt.vp.016" },
    { kind: "source and time: DR1 at 12.05 (the thermal image)", intended: "evt.vp.008" },
  ];
  const questionsIn = (lang: "fi" | "en") => (step(lang).body.match(lang === "fi" ? /„[^”]+”/g : /“[^”]+”/g) ?? []).map((q) => q.slice(1, -1));

  it.each(["fi", "en"] as const)("%s: the body gives one example question per kind, as the researcher wrote them", (lang) => {
    expect(questionsIn(lang)).toEqual(lang === "fi"
      ? ["Mikä on viimeisin sääennuste?", "Mitä vesihuolto on kirjannut?", "Mitä DR1 ilmoitti klo 12.05?"]
      : ["What is the latest weather forecast?", "What has water supply recorded?", "What did DR1 report at 12.05?"]);
  });

  it.each(["fi", "en"] as const)("%s: revision (bn): no example is a scored item's findability or seek question, and the kinds name no road reports", (lang) => {
    const scored = new Set([...Object.values(FINDABILITY_QUERIES).flatMap((q) => q[lang]), ...SEEK_QUESTIONS.flatMap((q) => q[lang])].map((q) => q.toLowerCase()));
    expect(scored.size).toBeGreaterThan(10);
    for (const q of questionsIn(lang)) expect(scored.has(q.toLowerCase()), q).toBe(false);
    expect(step(lang).body).not.toMatch(/tieilmoitu|road report/i);
    expect(step(lang).body).toMatch(lang === "fi" ? /johtokeskus \(JOKE\) kuittaa/ : /the command centre acknowledges/);
  });

  it.each(["fi", "en"] as const)("%s: a lexical Haku question for each example, at the practice step with the time gate, ranks the intended record in the top 3", (lang) => {
    const cfg = { ...retrievalConfigOf(lang), topK: Number.MAX_SAFE_INTEGER }; // lexical only (no vector), as the d10 retrieval tests and the play harness run Haku
    questionsIn(lang).forEach((q, i) => {
      const ranked = hybridRetrieve(q, practiceAtoms, null, cfg, lang).map((r) => r.atom.id);
      const rank = ranked.indexOf(EXAMPLES[i]!.intended) + 1;
      expect(rank, `${lang} "${q}" (${EXAMPLES[i]!.kind}) → ${ranked.slice(0, 4).join(", ")}`).toBeGreaterThanOrEqual(1);
      expect(rank, `${lang} "${q}" (${EXAMPLES[i]!.kind}) → ${ranked.slice(0, 4).join(", ")}`).toBeLessThanOrEqual(3);
    });
  });
});

/** The practice view's records as Haku shows them in the session language. */
function practiceAtomsText(lang: "fi" | "en"): string[] {
  return practiceAtoms.map((a) => recordIn(lang, a.id, recordText(toRenderable(a).record)));
}
