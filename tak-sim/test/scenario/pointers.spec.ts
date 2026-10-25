/**
 * Revision (bm), 25 Oct 2026 (researcher decision; SPEC/18 (bm), SPEC/09 (bm)): the "report filed" pointers (`app/scenario/pointers.ts`).
 * Each is a pushed radio line that says a report was filed, never what it says. The tests hold: which records they point to (real: a
 * seek-dependent item's key or seek record; decoy: a record no item asks about), the timing (the record's step, at or after its
 * clock), the spread (no view with real pointers only), the content-free text (no content word shared with any freeze, SPAM or other
 * probe option or key, in Finnish and English), the sender (a call sign in use, no new salience for a unit an option names), H9 and
 * H10 untouched, the push cap (nothing an item rests on displaced), and that the query tools never return a pointer.
 */

import { describe, expect, it } from "vitest";
import { toRenderable } from "../../app/boundary/render-boundary.js";
import { recordIn, tr } from "../../app/i18n/text.js";
import { hybridRetrieve } from "../../app/retrieval/hybrid.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { POINTERS } from "../../app/scenario/pointers.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { H9_H10_RECORD_IDS, validateScenario } from "../../app/scenario/validator.js";
import { STEP_SECONDS, viewOfStep } from "../../app/scenario/views.js";
import { clockAt } from "../../app/session/template-answer.js";
import { PUSH_CAP_PER_VIEW } from "../../tools/fire-ca/view-traffic.js";
import { auditItems, FINDABILITY_QUERIES, itemRecordIds } from "../../tools/review/difficulty-audit.js";

const scenario = buildDemoScenario();
const audit = auditItems();
const byId = new Map(scenario.atoms.map((a) => [a.id, a] as const));
const specs = [scenario.practice.cycle, ...scenario.cycles];
const pushedIn = (id: string) => specs.filter((c) => c.pushedAtomIds.includes(id)).map((c) => c.index);
const pointers = scenario.atoms.filter((a) => a.pointer !== undefined);
const real = POINTERS.filter((p) => p.kind === "real"), decoys = POINTERS.filter((p) => p.kind === "decoy");
const viewOf = (step: number) => viewOfStep(step)!.index;

/** Every option label (and so every key option) a participant can answer with: freeze items, SPAM and other probes, the hinge check. */
function optionLabels(): { readonly id: string; readonly fi: string }[] {
  const out: { id: string; fi: string }[] = [];
  for (const f of [scenario.practice.freeze, ...scenario.freezes]) for (const it of f.items) for (const o of it.options) out.push({ id: `${it.id}.${o.id}`, fi: o.labelFi });
  const probes = [...scenario.probeSchedule.probes, scenario.practice.spam, scenario.practice.spamSecond].filter((p) => p !== undefined);
  for (const p of probes) if (p.response.kind === "categorical") for (const o of p.response.options) out.push({ id: `${p.id}.${o.id}`, fi: o.fi });
  for (const o of scenario.hinge.manipulationCheck?.options ?? []) out.push({ id: `hinge.${o.id}`, fi: o.labelFi });
  return out;
}

const TOKEN = /[\p{L}\p{N}]+/gu;
/** Function words only; every other word of an option is a content word. */
const STOP = new Set([
  "ja", "ei", "on", "ole", "se", "sen", "kun", "jos", "tai", "vain", "myös", "että", "mutta", "niin", "kuin", "jo", "klo", "noin",
  "a", "an", "the", "of", "to", "for", "and", "or", "is", "are", "in", "on", "at", "by", "as", "with", "from", "it", "its", "be", "been", "has", "have", "so", "than",
]);
const words = (t: string) => (t.toLowerCase().match(TOKEN) ?? []).filter((w) => !STOP.has(w));
/**
 * Two words share content when they are equal, share a five-letter stem, one starts with the other (four letters or more: "vesi" in
 * "vesipiste"), or one contains the other's five-letter stem (a compound's tail: "tiedot" in "tilannetiedot").
 */
function share(p: string, o: string): boolean {
  return p === o || (p.length >= 5 && o.length >= 5 && p.slice(0, 5) === o.slice(0, 5)) || (o.length >= 4 && p.startsWith(o)) || (p.length >= 4 && o.startsWith(p))
    || (o.length >= 5 && p.includes(o.slice(0, 5))) || (p.length >= 5 && o.includes(p.slice(0, 5)));
}
/** The line without its sender ("EK12: …", "Drooniryhmä: …" / "Drone team: …"). */
const body = (text: string) => text.slice(text.indexOf(":") + 1);
const DIRECTIONS = /\b(pohjoi|etelä|itä|itään|länt|länsi|koilli|kaakko|kaakos|lounai|lounaa|luode|luote|north|south|east|west)/iu;

describe("revision (bm): the pointers and what they point to", () => {
  it("twelve pointers, six real and six decoys, each an atom marked with its record, pushed once in its record's view", () => {
    expect(real).toHaveLength(6);
    expect(decoys).toHaveLength(6);
    expect(pointers.map((a) => a.id).sort()).toEqual(POINTERS.map((p) => p.id).sort());
    for (const p of POINTERS) {
      const a = byId.get(p.id)!, to = byId.get(p.to)!;
      expect(a.pointer, p.id).toEqual({ to: p.to, kind: p.kind });
      expect(a.tier, p.id).toBe("T1_pushed");
      expect(pushedIn(p.id), p.id).toEqual([viewOf(p.step)]);
      expect(a.provenance.sourceId, p.id).toBe(p.sender);
      expect(a.navCategory, p.id).toBe(to.navCategory);
      expect(pushedIn(p.to), `${p.id} → ${p.to}`).toEqual([]); // the record is recorded: found only by a search
    }
  });

  it("a pointer arrives in the burst that makes its record reachable: the record's step, at or after its clock", () => {
    for (const p of POINTERS) {
      const a = byId.get(p.id)!, to = byId.get(p.to)!;
      expect(a.cycle, p.id).toBe(to.cycle);
      expect(a.provenance.observedAt, p.id).toBeGreaterThanOrEqual(to.provenance.observedAt);
      expect(p.atS, p.id).toBeLessThan(STEP_SECONDS);
      const spec = scenario.cycles.find((c) => c.index === viewOf(p.step))!;
      const t = spec.deliveryOffsetsSeconds[spec.pushedAtomIds.indexOf(p.id)]!;
      // A merged view's second-step records (and its pointers) arrive at the step boundary, its first step's at the view's start.
      expect(t >= STEP_SECONDS, p.id).toBe(spec.steps === 2 && p.step === spec.startsAtVirtual / STEP_SECONDS + 2);
    }
  });

  it("real: the record is a key or seek record of each item it serves, and every item served is seek-dependent (the audit's passive partly or no)", () => {
    for (const p of real) {
      expect(p.serves.length, p.id).toBeGreaterThan(0);
      for (const itemId of p.serves) {
        const a = audit.find((i) => i.id === itemId)!;
        const records = new Set([...a.atoms.map((x) => x.id), ...(FINDABILITY_QUERIES[itemId]?.records ?? [])]);
        expect(records.has(p.to), `${p.id} → ${itemId}`).toBe(true);
        expect(["partly", "no"], itemId).toContain(a.hand.passive);
      }
    }
    // The two reports and the dispatch (bk) held for seeking, and EK14's access line, each have their pointer.
    for (const id of ["evt.c03.021", "evt.c07.032", "atom.demo.7.1", "evt.c10.028"]) expect(real.map((p) => p.to), id).toContain(id);
  });

  it("decoy: no freeze or SPAM item rests on the record (key, basis, hand basis, findability or content-cited records)", () => {
    const used = itemRecordIds(audit);
    for (const p of decoys) expect(used.has(p.to), `${p.id} → ${p.to}`).toBe(false);
  });

  it("spread: every view with a real pointer has a decoy too, and decoys also come where no real pointer does", () => {
    const realViews = new Set(real.map((p) => viewOf(p.step))), decoyViews = new Set(decoys.map((p) => viewOf(p.step)));
    for (const v of realViews) expect(decoyViews.has(v), `V${v}`).toBe(true);
    expect([...decoyViews].filter((v) => !realViews.has(v)).length).toBeGreaterThanOrEqual(2);
    expect(Math.abs(real.length - decoys.length)).toBeLessThanOrEqual(1);
  });
});

describe("revision (bm): a pointer is content-free", () => {
  const labels = optionLabels();

  it("reads the options of every freeze, SPAM and other probe item and the hinge check (a sanity floor)", () => {
    expect(labels.length).toBeGreaterThan(200);
    expect(labels.some((l) => l.id === "freeze.5.reinforcements.three")).toBe(true);
    expect(labels.some((l) => l.id.startsWith("probe.s.cycle_3.b."))).toBe(true);
  });

  for (const lang of ["fi", "en"] as const) {
    it(`${lang}: no content word of a pointer's line (its sender aside) is shared with any option or key`, () => {
      const hits: string[] = [];
      for (const p of POINTERS) {
        const line = recordIn(lang, p.id, p.fi);
        if (lang === "en") expect(line, p.id).not.toBe(p.fi); // the English exists
        for (const w of words(body(line))) {
          for (const l of labels) for (const o of words(lang === "fi" ? l.fi : tr("en", l.fi))) if (share(w, o)) hits.push(`${p.id} "${w}" ~ ${l.id} "${o}"`);
        }
      }
      expect(hits).toEqual([]);
    });

    it(`${lang}: no figure, no direction, no call sign in a pointer's line beyond its sender`, () => {
      for (const p of POINTERS) {
        const b = body(recordIn(lang, p.id, p.fi));
        expect(b, p.id).not.toMatch(/\d/);
        expect(b, p.id).not.toMatch(DIRECTIONS);
        expect(b.trim().split(/\s+/).length, p.id).toBeLessThanOrEqual(5); // one breath
      }
    });
  }

  it("the sender comes first and is a call sign in use: it has records before the pointer, and is heard in the stream by then", () => {
    for (const p of POINTERS) {
      const name = p.sender === "DRONERYHMÄ" ? "Drooniryhmä" : p.sender;
      expect(p.fi.startsWith(`${name}: `), p.id).toBe(true);
      const own = scenario.atoms.filter((a) => a.provenance.sourceId === p.sender && !a.pointer);
      expect(own.some((a) => a.provenance.observedAt < byId.get(p.id)!.provenance.observedAt), p.id).toBe(true);
    }
  });

  it("no new salience for a unit an option names: in the pointer's view, an item whose options name the sender names it in its stem, or the sender is already in that view's stream", () => {
    for (const p of POINTERS) {
      const view = viewOf(p.step);
      const spec = scenario.cycles.find((c) => c.index === view)!;
      const heard = spec.pushedAtomIds.some((id) => !byId.get(id)!.pointer && byId.get(id)!.provenance.sourceId === p.sender);
      const re = new RegExp(`\\b${p.sender}\\b`, "u");
      for (const it of scenario.freezes.find((f) => f.cycle === view)?.items ?? []) {
        if (!it.options.some((o) => re.test(o.labelFi))) continue;
        expect(re.test(it.promptFi) || heard, `${p.id} and ${it.id}`).toBe(true);
      }
    }
  });
});

describe("revision (bm): H9 and H10 untouched", () => {
  it("no pointer to an H9 or H10 record, none from their sources, none from VPK or KY21 in V7–V8 (the rekindle arc)", () => {
    for (const p of POINTERS) {
      expect(H9_H10_RECORD_IDS, p.id).not.toContain(p.to);
      expect(["VERKKOYHTIÖ", "JOHTOPAIKKA", "HELI1"], p.id).not.toContain(p.sender);
      if (p.step === 10 || p.step === 11) expect(["VPK", "KY21"], p.id).not.toContain(p.sender);
      expect(p.to.startsWith("f7.") || p.to.startsWith("rekindle.") || p.to.startsWith("t4."), p.id).toBe(false);
    }
    // The 16.00 forecast (V7 rekindle_sector, cp_safe) gets no pointer: its turn would cue H10's items.
    expect(POINTERS.some((p) => byId.get(p.to)!.provenance.sourceId === "SÄÄENNUSTE")).toBe(false);
  });

  it("the validator's pointer check (#17) passes on the scenario", () => {
    expect(validateScenario(scenario).failures.filter((f) => f.check === "pointers")).toEqual([]);
  });
});

describe("revision (bm): the push cap", () => {
  it("no view pushes more than the cap", () => {
    for (const c of scenario.cycles) expect(c.pushedAtomIds.length, `V${c.index}`).toBeLessThanOrEqual(PUSH_CAP_PER_VIEW);
  });

  it("the displaced records are recorded, in a view with a counted pointer, and none is a record a freeze or SPAM item rests on", () => {
    const displaced = SITE_SCENARIO.pointerDisplaced ?? [];
    expect(displaced).toEqual(["evt.c03.039", "evt.c03.029", "evt.c07.036", "evt.c10.025", "evt.c10.020", "evt.c15.035", "evt.c17.028"]);
    const used = itemRecordIds(audit);
    const counted = new Set(POINTERS.filter((p) => !p.takesHeldSlot).map((p) => viewOf(p.step)));
    for (const id of displaced) {
      const a = byId.get(id)!;
      expect(used.has(id), id).toBe(false);
      expect(a.tier, id).toBe("T2_system");
      expect(counted.has(viewOf(a.cycle)), id).toBe(true);
    }
  });

  it("a pointer to a record held for seeking takes the slot that record kept ((bk))", () => {
    expect(POINTERS.filter((p) => p.takesHeldSlot).map((p) => p.to).sort()).toEqual(["atom.demo.7.1", "evt.c03.021", "evt.c07.032"]);
  });
});

describe("revision (bm): the query tools never return a pointer, and its mark never reaches the screen", () => {
  it("the time gate leaves every pointer out and every other record in", () => {
    for (const step of [3, 7, 10, 20]) {
      const gated = reachableAtoms(scenario.atoms, step);
      expect(gated.some((a) => a.pointer)).toBe(false);
      expect(gated.length).toBe(scenario.atoms.filter((a) => a.cycle <= step && !a.pointer).length);
    }
  });

  it("the renderable form carries no pointer mark", () => {
    for (const a of pointers) expect(Object.keys(toRenderable(a))).not.toContain("pointer");
  });

  it("a participant can follow each pointer: 'what did <sender> report at <the pointer's clock>' retrieves its record (rank ≤ 8, lexical) in both languages, and never an H9 or H10 record", () => {
    for (const p of POINTERS) {
      const clock = clockAt(byId.get(p.id)!.provenance.observedAt); // as the message log shows it
      const who = p.sender === "DRONERYHMÄ" ? { fi: "drooniryhmä", en: "the drone team" } : { fi: p.sender, en: p.sender };
      const questions = { fi: `Mitä ${who.fi} ilmoitti klo ${clock}?`, en: `What did ${who.en} report at ${clock}?` };
      for (const lang of ["fi", "en"] as const) {
        const ids = hybridRetrieve(questions[lang], reachableAtoms(scenario.atoms, p.step), null, undefined, lang).map((r) => r.atom.id);
        expect(ids.indexOf(p.to), `${p.id} ${lang}: ${questions[lang]}`).toBeGreaterThanOrEqual(0);
        expect(ids.filter((id) => H9_H10_RECORD_IDS.includes(id)), `${p.id} ${lang}`).toEqual([]);
      }
    }
  });
});
