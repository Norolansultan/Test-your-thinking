/**
 * What a question says about time (SPEC/14 revision D10, 24 Oct 2026; `app/retrieval/query-cues.ts`):
 * the recency cues in Finnish and English with their inflections, the words that are NOT cues, the
 * previous cues that cancel them, clock parsing (points, relative clocks, quantities that are not
 * clocks) and the lexical query with the words the rules used taken out.
 */

import { describe, expect, it } from "vitest";
import { tokenise } from "../../app/retrieval/hybrid.js";
import { queryClocks, queryCues } from "../../app/retrieval/query-cues.js";

const latest = (q: string, lang: "fi" | "en" = "fi") => queryCues(q, lang).latest;

describe("recency cues, Finnish", () => {
  it.each([
    "Mikä on viimeisin sääennuste?",
    "Mikä on tien R1 tila viimeisimmän havainnon mukaan?",
    "Näytä viimeisimmät droonihavainnot",
    "Mitä viimeisintä tietoa EK12:sta on?",
    "Viimeinen kehäkartoitus?",
    "Mitä DR3 kertoi viimeisessä lennossa?",
    "Missä EK11 on viimeksi täyttänyt säiliönsä?",
    "Mitä on tapahtunut viime minuutteina?",
    "Uusin tieto L3:lta?",
    "Mikä on uusimman kartoituksen pinta-ala?",
    "Kerro uusinta tietoa tiestä R1",
    "Uusimmat havainnot kärjestä",
    "Tuorein sääennuste",
    "Tuoreimman havainnon mukaan",
    "Onko tuoreita havaintoja?",
    "Missä EK16 on nyt?",
    "Onko nytkin vettä riittävästi?",
    "Mitä EK12 tekee tällä hetkellä?",
    "Onko uutta sääennustetta?",
    "Mikä on nykyinen tilanne?",
    "Mikä on lohkon 2 nykytilanne?",
    "Mikä on tämänhetkinen tuulen suunta?",
  ])("'%s' asks for the latest state", (q) => {
    expect(latest(q)).toBe(true);
  });

  it.each([
    "Ehtiikö EK13 paikalle viimeistään klo 15?", // "at the latest": a deadline
    "Onko viimeistely tehty?",
    "Syttymäkohdan kaakkoispuolelle on syttynyt uusi palo.", // a new fire, not "the newest record"
    "Onko kipinöistä syntynyt uusia paloja linjan yli?",
    "Nytkähtikö linja?",
    "Mikä on tuuliennuste seuraavaksi tunniksi?",
    "Kuinka kaukana lähin asutus on palosta?",
  ])("'%s' does not", (q) => {
    expect(latest(q)).toBe(false);
  });

  it("a previous cue cancels the recency cue, and the cue word then stays in the lexical query", () => {
    const q = "Paljonko uutta palanutta alaa oli edellisessä DR3:n kehäkartoituksessa?";
    expect(queryCues(q).cueWords).toEqual(["uutta"]);
    expect(queryCues(q).latest).toBe(false);
    expect(queryCues(q).lexicalQuery).toBe(q);
    expect(latest("Mitä VPK sanoi aiemmin syttymäkohdasta?")).toBe(false);
    expect(latest("Mikä oli tilanne nyt aikaisemmassa raportissa?")).toBe(false);
  });
});

describe("recency cues, English", () => {
  it.each([
    "What is the latest weather forecast for this evening?",
    "newest road report R1",
    "the most recent perimeter mapping",
    "What has DR2 reported recently?",
    "What is the current wind direction?",
    "Where is EK12 currently?",
    "Where did EK11 last fill its tank?",
    "How far is the south-east front from road R2 now?",
    "Where is EK16 right now?",
    "What is EK12 doing at the moment?",
    "Is there any new forecast?",
    "Anything new from VOL1?",
    "What's new?",
    "What is new on the north edge?",
  ])("'%s' asks for the latest state", (q) => {
    expect(latest(q, "en")).toBe(true);
  });

  it.each([
    "Are they in danger now that the wind has turned?", // "now that" is a conjunction
    "Is the snow known?",
    "A new fire has started south-east of the origin.",
    "What are the new reports?", // "new" alone is not a cue (documented)
    "Lastly, how much water is left?",
  ])("'%s' does not", (q) => {
    expect(latest(q, "en")).toBe(false);
  });

  it("'previous' and 'earlier' cancel it", () => {
    expect(latest("What did the previous perimeter mapping say, and what is the latest?", "en")).toBe(false);
    expect(latest("What did VOL1 say earlier, and where is it now?", "en")).toBe(false);
  });
});

describe("clocks", () => {
  it.each([
    ["Mitä VPK ilmoitti klo 17.24?", "fi", [17 * 60 + 24]],
    ["Mitä VPK ilmoitti kello 17.24?", "fi", [17 * 60 + 24]],
    ["VPK 17.58", "fi", [17 * 60 + 58]],
    ["What did VOL1 report at 17:24?", "en", [17 * 60 + 24]],
    ["DR3 perimeter mapping at 14.15", "en", [14 * 60 + 15]],
    ["Näytä tilannekuva klo 9.05.", "fi", [9 * 60 + 5]],
    ["Mitä tapahtui 18.40–19.00?", "fi", [18 * 60 + 40, 19 * 60]],
    ["klo 17.24 ja klo 17.24", "fi", [17 * 60 + 24]],
  ] as const)("'%s' names %j", (q, lang, minutes) => {
    expect(queryCues(q, lang).clocks).toEqual(minutes);
  });

  it.each([
    ["Onko palanut ala 12.50 ha?", "fi"],
    ["Etenemisnopeus 7.6 m/min?", "fi"],
    ["Paljonko 24,3 ha on?", "fi"],
    ["Is the 20 kV line de-energised?", "en"],
    ["Onko EK11.20 paikalla?", "fi"],
    ["Mitä tapahtui klo 25.30?", "fi"],
    ["Mitä tapahtui klo 17?", "fi"],
  ] as const)("'%s' names no clock", (q, lang) => {
    expect(queryCues(q, lang).clocks).toEqual([]);
  });

  it("a relative clock names no record time but leaves the lexical query", () => {
    for (const [q, lang] of [
      ["What did the previous perimeter mapping before 14.35 say?", "en"],
      ["What is new since 17.00?", "en"],
      ["Mitä DR3 ilmoitti ennen klo 14.35?", "fi"],
      ["Mitä on tullut klo 17.00 jälkeen?", "fi"],
      ["Mitä on tapahtunut klo 17.00 lähtien?", "fi"],
    ] as const) {
      const c = queryCues(q, lang);
      expect(c.clocks, q).toEqual([]);
      expect(tokenise(c.lexicalQuery, lang), q).not.toContain("14");
      expect(tokenise(c.lexicalQuery, lang), q).not.toContain("17");
    }
    expect(queryClocks("before 14.35", "en").spans).toHaveLength(1);
  });
});

describe("the lexical query", () => {
  it("drops the clock expression, 'klo' and 'at' with it", () => {
    expect(tokenise(queryCues("Mitä VPK ilmoitti klo 17.24?").lexicalQuery)).toEqual(["mitä", "vpk", "ilmoi"]);
    expect(tokenise(queryCues("Water supply at 14.47", "en").lexicalQuery, "en")).toEqual(["water", "suppl"]);
  });

  it("drops the cue words used", () => {
    expect(queryCues("Mikä on viimeisin sääennuste?").lexicalQuery).toBe("Mikä on sääennuste?");
    expect(queryCues("What is EK12 doing at the moment?", "en").lexicalQuery).toBe("What is EK12 doing ?");
  });

  it("keeps 'at' that is not a clock's", () => {
    expect(queryCues("Are there people at the Lakeside Cottages now?", "en").lexicalQuery).toBe("Are there people at the Lakeside Cottages ?");
  });

  it("a clock alone leaves nothing; a cue alone keeps the question", () => {
    expect(tokenise(queryCues("klo 17.24").lexicalQuery)).toEqual([]);
    expect(queryCues("uusin?").lexicalQuery).toBe("uusin?");
  });

  it("a rule not declared changes nothing", () => {
    const q = "Mitä VPK ilmoitti nyt klo 17.24?";
    const off = queryCues(q, "fi", { latest: false, clocks: false });
    expect(off).toMatchObject({ latest: false, clocks: [], lexicalQuery: q });
    expect(queryCues(q, "fi", { latest: true, clocks: false })).toMatchObject({ latest: true, clocks: [] });
    expect(queryCues(q, "fi", { latest: false, clocks: true })).toMatchObject({ latest: false, clocks: [17 * 60 + 24] });
  });

  it("is deterministic", () => {
    const q = "Onko uutta? Mitä DR3 ilmoitti klo 14.15 ja nyt?";
    expect(queryCues(q)).toEqual(queryCues(q));
  });
});

describe("a latest-state question that names no topic (D10 addendum, 24 Oct 2026)", () => {
  const topicFree = (q: string, lang: "fi" | "en" = "fi") => queryCues(q, lang).topicFree;
  it.each([
    ["Mitä uutta tällä jaksolla on kirjattu?", "fi"],
    ["Onko uutta?", "fi"],
    ["Mitä uutta?", "fi"],
    ["Uusimmat ilmoitukset?", "fi"],
    ["What is new in this period's records?", "en"],
    ["Any new reports?", "en"],
    ["Anything new?", "en"],
    ["What are the latest reports?", "en"],
  ] as const)("%s → newest records", (q, lang) => expect(topicFree(q, lang)).toBe(true));
  it.each([
    ["Onko uutta sääennustetta?", "fi"],
    ["Mitä uutta EK12:sta?", "fi"],
    ["Mitä VPK ilmoitti klo 17.24?", "fi"],
    ["Mitä uutta klo 16.40 jälkeen?", "fi"],
    ["Mitä jaksolla on kirjattu?", "fi"],
    ["latest road report road R1", "en"],
    ["Any new reports from DR3?", "en"],
    ["What has been recorded in this period?", "en"],
  ] as const)("%s → not topic-free", (q, lang) => expect(topicFree(q, lang)).toBe(false));
});
