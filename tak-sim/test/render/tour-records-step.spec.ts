/**
 * The practice tour's changed steps, revision (bp), 26 Oct 2026 (SPEC/15 §bp.5): VP is the first look ("Ensikatsaus" / "First look").
 * The training incident before it teaches the map, the log, the records and how to ask for them, and the memory check, over its own
 * incident; so the tour refers back to it instead of re-teaching, and quotes no example and no VP record.
 *
 * - `welcome`, `log`, `haku`, `hakuRecords`, `freeze`, `spam`, `ready` and the start button read as §bp.5's table, word for word (Finnish
 *   DRAFT, native check). The step list and its order are unchanged: 17 steps, 18 in the Thinker cells; the radio cell's names no Thinker.
 * - The records step (was revision (bl)/(bn)'s three examples on VP records: the forecast, the water supply's log, DR1 at 12.05) names
 *   no example question, no VP record, no clock and no place: the Pike Pond / W1 subject it once shared with the scored V4 `infra` is
 *   gone, and (bn)'s VESIHUOLTO line with it. It never says that one must search, nothing on scores, nothing on the memory checks.
 * - No step of the practice tour quotes a VP record (four-word runs against every VP record in both languages) or names a scored
 *   item's subject (the list of (bl), kept).
 */

import { describe, expect, it } from "vitest";
import { UI_TEXT as UI } from "../../app/i18n/ui.js";
import { recordIn } from "../../app/i18n/text.js";
import { PRACTICE_TOUR, practiceTour, tourSteps } from "../../app/render/ui/tour.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { HAKU_CHAT_EN, HAKU_CHAT_FI, TOUR_HAKU_ASK_EN, TOUR_HAKU_ASK_FI, TOUR_SETTING_EN, TOUR_SETTING_FI } from "../../app/scenario/briefing.js";
import { PRACTICE_STEP } from "../../app/scenario/views.js";
import { recordText } from "../../app/session/template-answer.js";
import { toRenderable } from "../../app/boundary/render-boundary.js";
import { PLACE_NAMES_EN } from "../../app/i18n/place-names.js";

type Lang = "fi" | "en";

/** SPEC/15 §bp.5's table, word for word (the welcome after the setting text; the Haku step's first sentence and the unchanged rest). */
const BP = {
  fi: {
    welcome: `${TOUR_SETTING_FI} Tämä on ensimmäinen katsaus varsinaiseen tilanteeseen. Harjoituksessa kokeilit työkaluja; nyt näet, missä ne ovat tässä näkymässä. Katsausta ei pisteytetä, eikä sen aika kulu tämän esittelyn aikana.`,
    log: "Sinulle välitetyt ilmoitukset tulevat tähän lähettäjän ja kellonajan kanssa, kuten harjoituksessa. Se on vain osa liikenteestä; muu on kirjauksissa.",
    haku: `Avaa Haku tästä, kuten harjoituksessa. ${TOUR_HAKU_ASK_FI} ${HAKU_CHAT_FI}`,
    hakuRecords: "Harjoituksessa näit, mitä kirjauksista löytyy ja miten niitä kysytään: aiheen, lähteen tai kellonajan mukaan. Tässä tilanteessa kirjaukset ovat toiset, mutta kysyt niitä samalla tavalla.",
    freeze: "Seuraavissa jaksoissa kuva piilotetaan välillä ja saat kysymyksiä tilanteesta, kuten harjoituksen muistikatkossa: vastaat muistin varassa ja arvioit varmuutesi, ja kello on pysähdyksissä katkon ajan. Tässä katsauksessa muistikatkoa ei ole.",
    spamLast: "Tässä katsauksessa saat kokeilla yhtä.",
    ready: "Katsaus alkaa, kun painat Aloita. Katso rauhassa karttaa, viestilokia ja hakua.",
    button: "Aloita katsaus",
    label: "Ensikatsaus",
    recordsTitle: "Mitä kirjauksista löytyy",
  },
  en: {
    welcome: `${TOUR_SETTING_EN} This is a first look at the actual incident. In the training you tried the tools; now you see where they are in this view. The first look is not scored, and its time does not run during this introduction.`,
    log: "Reports passed to you arrive here with their sender and time, as in the training. This is only part of the traffic; the rest is in the records.",
    haku: `Open Search here, as in the training. ${TOUR_HAKU_ASK_EN} ${HAKU_CHAT_EN}`,
    hakuRecords: "In the training you saw what the records hold and how to ask for it: by topic, source or time. The records here are different, and you ask for them the same way.",
    freeze: "In the periods that follow, the picture is hidden now and then and you get questions about the situation, as in the training's memory check: you answer from memory and rate your confidence, and the clock stands still during the check. There is no memory check in this first look.",
    spamLast: "You will try one in this first look.",
    ready: "The first look starts when you press Start. Take your time with the map, the message log and the search.",
    button: "Start the first look",
    label: "First look",
    recordsTitle: "What the records hold",
  },
} as const;

const LANGS = ["fi", "en"] as const;
const scenario = buildDemoScenario();
const step = (lang: Lang, id: keyof (typeof UI)["fi"]["tour"]["steps"]) => UI[lang].tour.steps[id];

describe("revision (bp): the tour's changed steps read as SPEC/15 §bp.5", () => {
  it.each(LANGS)("%s: welcome, log, Haku, records, memory check, SPAM's last sentence, ready, the button and VP's label", (lang) => {
    const b = BP[lang];
    expect(step(lang, "welcome").body).toBe(b.welcome);
    expect(step(lang, "log").body).toBe(b.log);
    expect(step(lang, "haku").body).toBe(b.haku);
    expect(step(lang, "hakuRecords")).toEqual({ title: b.recordsTitle, body: b.hakuRecords });
    expect(step(lang, "freeze").body).toBe(b.freeze);
    expect(step(lang, "spam").body.endsWith(` ${b.spamLast}`)).toBe(true);
    expect(step(lang, "ready").body).toBe(b.ready);
    expect(UI[lang].tour.startPractice).toBe(b.button);
    expect(UI[lang].startPractice).toBe(b.button);
    expect(UI[lang].practiceLabel).toBe(b.label);
  });

  it("the steps not in the table are unchanged in kind: they do not mention the training", () => {
    for (const lang of LANGS) {
      for (const id of ["status", "fire", "projection", "legend", "wind", "zoom", "measure", "sectors", "units", "decision"] as const) {
        expect(step(lang, id).body, `${lang} ${id}`).not.toMatch(/harjoitu|training|katsau|first look/i);
      }
    }
  });

  it("the step list and its order are unchanged: 17 steps, 18 in the Thinker cells (after both Haku steps); the radio cell's names no Thinker", () => {
    expect(PRACTICE_TOUR.map((s) => s.id)).toEqual(["welcome", "status", "fire", "projection", "legend", "wind", "zoom", "measure", "sectors", "units", "log", "haku", "hakuRecords", "decision", "freeze", "spam", "ready"]);
    expect(practiceTour("directed")).toHaveLength(17);
    const thinker = practiceTour("substitutive").map((s) => s.id);
    expect(thinker).toHaveLength(18);
    expect(thinker.slice(thinker.indexOf("haku"), thinker.indexOf("decision") + 1)).toEqual(["haku", "hakuRecords", "practiceThinker", "decision"]);
    for (const lang of LANGS) {
      for (const s of tourSteps("practice", "directed", "radio")) expect(`${step(lang, s.id).title} ${step(lang, s.id).body}`, `${lang} ${s.id}`).not.toMatch(/\b(AI|tekoäly|Thinker|LLM)\b/);
    }
    const haku = PRACTICE_TOUR.find((s) => s.id === "haku")!;
    expect(PRACTICE_TOUR.find((s) => s.id === "hakuRecords")).toEqual({ id: "hakuRecords", target: haku.target, placement: haku.placement });
  });
});

describe("revision (bp): the records step quotes no example and teaches how, never that", () => {
  it.each(LANGS)("%s: no quoted question, no clock, no call sign, no place, no VP record's source", (lang) => {
    const body = step(lang, "hakuRecords").body;
    expect(body).not.toMatch(/[„“”"«»]/);
    expect(body).not.toMatch(/\d/);
    expect(body).not.toMatch(/\b[A-ZÅÄÖ]{2,}\d*\b/);
    expect(Object.keys(PLACE_NAMES_EN).filter((n) => body.includes(n.length > 6 ? n.slice(0, 6) : n))).toEqual([]);
    expect(Object.values(PLACE_NAMES_EN).filter((n) => body.includes(n))).toEqual([]);
    expect(body).not.toMatch(/Haukilamp|Pike Pond|\bW1\b|vesihuolto|water supply|sääennuste|forecast|DR1/i);
  });

  it("never tells the participant to search, never mentions scores, and names no AI tool", () => {
    const MUST_SEARCH = /ennen kuin vastaat|ennen vastaamista|pisteit|pisteyt|tulos|kannattaa|täytyy|pitää (?:hakea|käyttää)|älä unohda|before you answer|before answering|\bscor|\bpoints?\b|\bmust\b|\bshould\b|\bneed to\b|remember to|do not forget/i;
    for (const lang of LANGS) {
      const text = `${step(lang, "hakuRecords").title} ${step(lang, "hakuRecords").body}`;
      expect(text, lang).not.toMatch(MUST_SEARCH);
      expect(text, lang).not.toMatch(/\b(AI|tekoäly|Thinker|agentti|analyysiagentti|LLM)\b/i);
    }
  });
});

describe("revision (bp): no practice-tour step quotes a VP record or names a scored item's subject", () => {
  const vpAtoms = reachableAtoms(scenario.atoms, PRACTICE_STEP);
  const words = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w !== "");
  const runs = (t: string) => { const w = words(t); return new Set(w.slice(0, Math.max(0, w.length - 3)).map((_, i) => w.slice(i, i + 4).join(" "))); };

  it.each(LANGS)("%s: no four-word run of any VP record in the changed steps", (lang) => {
    const recordRuns = new Set(vpAtoms.flatMap((a) => [...runs(recordIn(lang, a.id, recordText(toRenderable(a).record)))]));
    expect(recordRuns.size).toBeGreaterThan(50);
    for (const id of ["welcome", "log", "haku", "hakuRecords", "freeze", "spam", "ready"] as const) {
      const shared = [...runs(id === "welcome" ? step(lang, id).body.replace(lang === "fi" ? TOUR_SETTING_FI : TOUR_SETTING_EN, "") : step(lang, id).body)].filter((r) => recordRuns.has(r));
      expect(shared, `${lang} ${id}`).toEqual([]);
    }
  });

  it("names no scored item's subject in the changed steps: no power line or company, police, cabins, village, evacuation, bridge, roads by name, rekindle, aircraft, W1 or the forecast", () => {
    const SCORED_SUBJECTS = /sähk|voima(?:johto|yhtiö)|20 kV|\bF7\b|power|electric|poliis|police|mökki|cabin|cottage|Lahdenkylä|Bay Village|evakuoi|evacuat|silta|sillan|bridge|\bR[123]\b|uudelleen syty|rekindl|kytö|smoulder|helikopteri|ilma-alus|helicopter|aircraft|\bHELI|Haukilamp|Pike Pond|\bW1\b|sääennuste|forecast/i;
    for (const lang of LANGS) {
      for (const id of ["log", "haku", "hakuRecords", "freeze", "spam", "ready"] as const) {
        const body = id === "haku" ? step(lang, id).body.replace(lang === "fi" ? HAKU_CHAT_FI : HAKU_CHAT_EN, "") : step(lang, id).body;
        expect(body, `${lang} ${id}`).not.toMatch(SCORED_SUBJECTS);
      }
    }
  });
});
