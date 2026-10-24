/**
 * Query-aware recency and clock-aware matching (SPEC/14 revision D10, 24 Oct 2026; `hybrid.ts`):
 * the latest-state preference and the clock match on synthetic records, then on play-test questions
 * (`docs/audits/2026-10-23-playtest/haku.csv`, lexical as the play harness runs Haku), and the
 * guarantees that must not move: the time gate, the routine collapse for questions without a clock,
 * the per-source cap, determinism, and an unchanged result for questions with neither a cue nor a clock.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  clockBoosts, hybridRetrieve, latestBoosts, namesSource, passageText, recordClockMinutes, retrievalConfigOf, THINKER_RETRIEVAL_CONFIG, tokenise, vectorIndexOf,
  type HybridConfig, type VectorIndexFile,
} from "../../app/retrieval/hybrid.js";
import { collapseRoutine } from "../../app/retrieval/routine-collapse.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { trafficAtom } from "../../app/scenario/traffic-atoms.js";
import type { InfoAtom, InteractionEvent } from "../../app/scenario/types.js";
import { bestRank, loadPlaytestCases, playtestCases, rankSummary, stepOfClock, withoutD10 } from "../../tools/thinker/playtest-cases.js";

function event(id: string, cycle: number, simTimeS: number, actor: string, content: string): InteractionEvent {
  return {
    id, cycle, session_view: cycle, sim_time_s: simTimeS, timestamp: "13:20:00", actor, actor_type: "fire_team", addressee: null,
    location: null, place: null, lat: null, lon: null, event_type: "status", task: null, content, tier: "T3_person", channel: "ask_unit", nav: "yksikot", lang: "fi",
  } as InteractionEvent;
}
const atom = (id: string, cycle: number, t: number, actor: string, content: string): InfoAtom => trafficAtom(event(id, cycle, t, actor, content));
const ids = (rs: readonly { atom: InfoAtom }[]) => rs.map((r) => r.atom.id);

const LATEST = THINKER_RETRIEVAL_CONFIG.recencyBoost!.latest!;
const CLOCK = THINKER_RETRIEVAL_CONFIG.clockMatch!;
const PLAIN: HybridConfig = { ...THINKER_RETRIEVAL_CONFIG, routineCollapse: null };

describe("the latest-state preference", () => {
  // 13:20 is virtual 0: 600 s is 13:30, 3000 s is 14:10.
  const old = atom("a.old", 1, 600, "DR3", "DR3 kehäkartoitus valmis: palanut ala noin 18 ha.");
  const fresh = atom("a.new", 3, 3000, "DR3", "DR3 kartoitus: palanut ala 24 ha.");
  const other = atom("b.noise", 3, 3100, "EK11", "EK11: letku vaihdettu.");

  it("adds up to `graded` by time among the relevant candidates only", () => {
    const base = [1, 0.6, 0.2];
    const b = latestBoosts([old, fresh, other], base, LATEST);
    expect(b[0]).toBe(0); // the oldest relevant record
    expect(b[1]).toBeCloseTo(LATEST.graded, 9); // the newest relevant record
    expect(b[2]).toBe(0); // below relevance x the best: newer, but not relevant
  });

  it("lifts the newer relevant record when the question asks for the latest, not otherwise", () => {
    const plain = ids(hybridRetrieve("DR3 kehäkartoitus palanut ala", [old, fresh, other], null, PLAIN));
    const now = ids(hybridRetrieve("DR3 viimeisin kehäkartoitus palanut ala", [old, fresh, other], null, PLAIN));
    expect(plain[0]).toBe("a.old");
    expect(now[0]).toBe("a.new");
    expect(now).not.toContain("b.noise");
  });

  it("is off when a previous cue is in the question", () => {
    const prev = ids(hybridRetrieve("DR3 edellinen kehäkartoitus, palanut ala nyt", [old, fresh, other], null, PLAIN));
    expect(prev[0]).toBe("a.old");
  });
});

describe("the clock match", () => {
  // 14688 s is 17:24 (as Haku shows it); 14400 s is 17:20; 13000 s is 16:56.
  const vpk = atom("v.1724", 13, 14688, "VPK", "EK15, VPK: etelään noin 600 m päässä nousee savua.");
  const battery = atom("d.batt", 13, 14600, "VD1", "VD1 akkuloki: akku 20 %, vaihto klo 17.24.");
  const alarm = atom("h.alarm", -3, -4800, "HÄTÄKESKUS", "Hätäkeskus: hälytetty EK11, VPK ja EK12. VPK ilmoittaa saapuvansa.");
  const near = atom("e.1720", 13, 14400, "EK15", "EK15: matkalla.");
  const far = atom("e.1656", 12, 13000, "EK15", "EK15: matkalla.");

  it("reads the record's clock as Haku shows it", () => {
    expect(recordClockMinutes(vpk)).toBe(17 * 60 + 24);
    expect(recordClockMinutes(alarm)).toBe(12 * 60);
  });

  it("gives near (+namedSource when the question names the source) within ±2 min, far within ±10 min, else nothing", () => {
    const q = "Mitä VPK ilmoitti";
    const b = clockBoosts([vpk, battery, near, far, alarm], [17 * 60 + 24], CLOCK, q, "fi");
    expect(b).toEqual([CLOCK.near + CLOCK.namedSource, CLOCK.near, CLOCK.far, 0, 0]);
  });

  it("ranks the named source's record at that time first; the clock in another record's text no longer matches", () => {
    const pool = [battery, alarm, vpk, near, far];
    expect(ids(hybridRetrieve("Mitä VPK ilmoitti klo 17.24?", pool, null, PLAIN))[0]).toBe("v.1724");
    // Before D10 the text's "17.24" and "VPK" decided.
    const before = ids(hybridRetrieve("Mitä VPK ilmoitti klo 17.24?", pool, null, withoutD10(PLAIN)));
    expect(before.indexOf("v.1724")).toBeGreaterThan(0);
  });

  it("a record matched by its clock alone counts as matched", () => {
    expect(ids(hybridRetrieve("klo 17.24", [vpk, alarm, far], null, PLAIN))).toEqual(["v.1724"]);
  });

  it("names a source by the name Haku shows, every word or a code in it", () => {
    const t = (q: string, lang: "fi" | "en" = "fi") => new Set(tokenise(q, lang));
    expect(namesSource(t("Mitä VPK ilmoitti"), "VPK", "fi")).toBe(true);
    expect(namesSource(t("What did VOL1 report", "en"), "VPK", "en")).toBe(true);
    expect(namesSource(t("What did the volunteer fire brigade report", "en"), "VPK", "en")).toBe(true);
    expect(namesSource(t("Mistä EK13 saa vettä"), "SAA", "fi")).toBe(false); // the verb "saa" is not the weather station
    expect(namesSource(t("Mitä sääasema näyttää"), "SAA", "fi")).toBe(true);
    expect(namesSource(t("Water supply", "en"), "VESIHUOLTO", "en")).toBe(true);
    expect(namesSource(t("How much water is left", "en"), "VESIHUOLTO", "en")).toBe(false);
  });
});

describe("on the play-test questions (lexical, as the play harness runs Haku)", () => {
  const scenario = buildDemoScenario();
  const cases = loadPlaytestCases();
  const byId = new Map(cases.map((c) => [c.id, c] as const));
  const rankAt = (id: string, config?: HybridConfig) => {
    const c = byId.get(id)!;
    const cfg = config ?? retrievalConfigOf(c.lang);
    const ranked = hybridRetrieve(c.question, reachableAtoms(scenario.atoms, c.step), null, { ...cfg, topK: Number.MAX_SAFE_INTEGER }, c.lang);
    return bestRank(ids(ranked), c.targets);
  };

  it("reads the play-test file: 45 questions with a right record, gated at their clock's step", () => {
    expect(cases).toHaveLength(45);
    expect(stepOfClock("13.20")).toBe(1);
    expect(stepOfClock("12:00")).toBe(-3);
    expect(byId.get("K23")).toMatchObject({ lang: "fi", step: 13, targets: ["evt.c13.008"] });
    expect(playtestCases('run,n,clock,question,top_record,judgement,should_have_returned\ncommander-fi,1,13.20,"a, b",x,miss,y / z\n')).toEqual([
      { id: "K1", lang: "fi", clock: "13.20", step: 1, question: "a, b", judgement: "miss", targets: ["y", "z"] },
    ]);
  });

  it.each([
    ["K23", "Mitä VPK ilmoitti klo 17.24?"],
    ["K16", "Mitä johtopaikka kirjasi klo 16.20?"],
    ["K18", "Mitä Ilmatieteen laitoksen klo 16.01 ennuste sanoo illan tuulesta?"],
    ["L18", "Weather forecast at 16.01"],
    ["K28", "Näytä tilannekuva klo 18.35."],
  ])("%s (%s): the source's record at that time is first", (id) => {
    expect(rankAt(id)).toBe(1);
  });

  it("K25, K27 (VPK at 17.58 and 18.38): a VPK record at that minute is first, the asked-for status second", () => {
    for (const id of ["K25", "K27"]) {
      const c = byId.get(id)!;
      const top = hybridRetrieve(c.question, reachableAtoms(scenario.atoms, c.step), null, undefined, c.lang);
      expect(top[0]!.atom.provenance.sourceId).toBe("VPK");
      expect(recordClockMinutes(top[0]!.atom)).toBe(c.id === "K25" ? 17 * 60 + 58 : 18 * 60 + 38);
      expect(rankAt(id)).toBeLessThanOrEqual(2);
    }
  });

  it("K28: the 18.35 situation picture is reached although the routine collapse alone drops it", () => {
    const c = byId.get("K28")!;
    const gated = reachableAtoms(scenario.atoms, c.step);
    expect(collapseRoutine(gated, THINKER_RETRIEVAL_CONFIG.routineCollapse!).map((a) => a.id)).not.toContain(c.targets[0]);
    expect(rankAt("K28", withoutD10())).toBe(0);
  });

  it.each(["L15", "L17", "L20"])("%s (a 'latest' question): the newest right record is now first, and was not before", (id) => {
    expect(rankAt(id)).toBe(1);
    expect(rankAt(id, withoutD10(retrievalConfigOf("en")))).toBeGreaterThan(1);
  });

  it("over all 45: more first and top-8 hits, a higher MRR@8", () => {
    const before = cases.map((c) => bestRank(ids(hybridRetrieve(c.question, reachableAtoms(scenario.atoms, c.step), null, { ...withoutD10(retrievalConfigOf(c.lang)), topK: 1e9 }, c.lang)), c.targets));
    const after = cases.map((c) => bestRank(ids(hybridRetrieve(c.question, reachableAtoms(scenario.atoms, c.step), null, { ...retrievalConfigOf(c.lang), topK: 1e9 }, c.lang)), c.targets));
    const b = rankSummary(before, 8);
    const a = rankSummary(after, 8);
    expect(a.top1).toBeGreaterThan(b.top1);
    expect(a.topK).toBeGreaterThanOrEqual(b.topK);
    expect(a.mrrAtK).toBeGreaterThan(b.mrrAtK);
  });

  it("never returns a record from a later step, whatever clock the question names", () => {
    for (const c of cases) {
      for (const q of [c.question, `${c.question} klo 19.58`, `${c.question} nyt`]) {
        for (const r of hybridRetrieve(q, reachableAtoms(scenario.atoms, c.step), null, { ...retrievalConfigOf(c.lang), topK: 50 }, c.lang)) {
          expect(r.atom.cycle, `${c.id} "${q}"`).toBeLessThanOrEqual(c.step);
        }
      }
    }
  });

  it("a question with neither a cue nor a clock ranks exactly as before D10", () => {
    for (const q of ["Onko kärjen lähellä lähempää vedenottopaikkaa kuin Haukilampi?", "EK11", "vettä säiliössä", "sähkölinja"]) {
      for (const step of [4, 10, 16]) {
        const gated = reachableAtoms(scenario.atoms, step);
        const a = hybridRetrieve(q, gated, null).map((r) => [r.atom.id, r.score]);
        expect(a).toEqual(hybridRetrieve(q, gated, null, withoutD10()).map((r) => [r.atom.id, r.score]));
      }
    }
  });

  it("keeps a declared per-source cap, and only routine-family survivors or the named minute's records", () => {
    const c = byId.get("K27")!;
    const gated = reachableAtoms(scenario.atoms, c.step);
    const capped = hybridRetrieve(`${c.question} nyt`, gated, null, { ...THINKER_RETRIEVAL_CONFIG, maxPerSource: 2 });
    const perSource = new Map<string, number>();
    for (const r of capped) perSource.set(r.atom.provenance.sourceId, (perSource.get(r.atom.provenance.sourceId) ?? 0) + 1);
    for (const n of perSource.values()) expect(n).toBeLessThanOrEqual(2);
    const kept = new Set(collapseRoutine(gated, THINKER_RETRIEVAL_CONFIG.routineCollapse!));
    for (const r of hybridRetrieve(c.question, gated, null, { ...THINKER_RETRIEVAL_CONFIG, topK: 1e9 })) {
      expect(kept.has(r.atom) || Math.abs(recordClockMinutes(r.atom) - (18 * 60 + 38)) <= CLOCK.nearMinutes).toBe(true);
    }
  });

  it("is deterministic and independent of the candidates' order", () => {
    const c = byId.get("L20")!;
    const gated = reachableAtoms(scenario.atoms, c.step);
    const a = hybridRetrieve(c.question, gated, null, undefined, "en").map((r) => [r.atom.id, r.score]);
    expect(hybridRetrieve(c.question, gated, null, undefined, "en").map((r) => [r.atom.id, r.score])).toEqual(a);
    expect(hybridRetrieve(c.question, [...gated].reverse(), null, undefined, "en").map((r) => [r.atom.id, r.score])).toEqual(a);
  });

  it("leaves the embedded passage as it was (the frozen vectors stay valid)", () => {
    const a = scenario.atoms.find((x) => x.id === "evt.c13.008")!;
    expect(passageText(a)).toBe(`VPK: ${"content" in a.record ? a.record.content : ""}`);
    for (const file of ["content/thinker/index.json", "content/thinker/index.en.json"]) {
      const index = vectorIndexOf(JSON.parse(readFileSync(new URL(`../../${file}`, import.meta.url), "utf8")) as VectorIndexFile);
      for (const atom of scenario.atoms) expect(() => index.vectorOf(atom), `${file} ${atom.id}`).not.toThrow();
    }
  });
});

describe("the manifest declares D10 (`npm run thinker:index -- --manifest-only`)", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../content/thinker/manifest.json", import.meta.url), "utf8")) as {
    retrieval: { recencyBoost: Record<string, unknown>; clockMatch: Record<string, unknown> };
    retrievalEn: { recencyBoost: Record<string, unknown>; clockMatch: Record<string, unknown> };
  };

  it.each(["retrieval", "retrievalEn"] as const)("%s: the recency boost, the latest-state preference and the clock match", (block) => {
    const cfg = retrievalConfigOf(block === "retrievalEn" ? "en" : "fi");
    expect(manifest[block].recencyBoost).toMatchObject({ source: cfg.recencyBoost!.source, sector: cfg.recencyBoost!.sector, latest: cfg.recencyBoost!.latest! });
    expect(manifest[block].clockMatch).toMatchObject(cfg.clockMatch!);
  });
});
