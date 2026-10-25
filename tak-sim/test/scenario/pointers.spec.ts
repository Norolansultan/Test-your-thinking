/**
 * Revision (bm), 25 Oct 2026 (researcher decision; SPEC/18 (bm), SPEC/09 (bm)): the "report filed" pointers (`app/scenario/pointers.ts`).
 * Each is a pushed radio line that says a report was received, never what it says. The tests hold: which records they point to (real: a
 * seek-dependent item's key or seek record; decoy: a record no item asks about), the timing (the record's step, at or after its
 * clock), the spread (no view with real pointers only), the content-free text (no content word shared with any freeze, SPAM or other
 * probe option or key, in Finnish and English), the sender, H9 and H10 untouched, the push cap (nothing an item rests on displaced),
 * and that the query tools never return a pointer.
 *
 * Revision (bn), 25 Oct 2026 (review S4, S10; SPEC/18 (bn)): every pointer is the command centre's acknowledgement (JOKE, no H9 source)
 * naming the reporting source; the verbs vary across reals and decoys alike; the decoys' sources mirror the reals' mix and their windows
 * the reals' (a step boundary to a freeze too); no displaced record is an air asset's change of state, and repeats go first.
 */

import { describe, expect, it } from "vitest";
import { toRenderable } from "../../app/boundary/render-boundary.js";
import { recordIn, tr } from "../../app/i18n/text.js";
import { hybridRetrieve } from "../../app/retrieval/hybrid.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { POINTER_SENDER, POINTERS, type PointerDef } from "../../app/scenario/pointers.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { H9_H10_RECORD_IDS, validateScenario } from "../../app/scenario/validator.js";
import { STEP_SECONDS, viewOfStep } from "../../app/scenario/views.js";
import { clockAt } from "../../app/session/template-answer.js";
import { POINTER_SPECS } from "../../app/telemetry/pointer-measures.js";
import { isAirStateChange, PUSH_CAP_PER_VIEW } from "../../tools/fire-ca/view-traffic.js";
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
/**
 * The line without its address: the sender ("JOKE: …", "Command centre: …") and the source it names ("EK12:n", "EK12's", revision
 * (bn): the reporting source is the address of the acknowledgement, as the sender was in (bm)). What is left is the kind of report and
 * the verb.
 */
const body = (p: PointerDef, lang: "fi" | "en") => {
  const line = recordIn(lang, p.id, p.fi);
  return ` ${line.slice(line.indexOf(":") + 1)}`.replace(` ${p.name[lang]} `, " ");
};
const DIRECTIONS = /\b(pohjoi|etelä|itä|itään|länt|länsi|koilli|kaakko|kaakos|lounai|lounaa|luode|luote|north|south|east|west)/iu;
/** The acknowledging verbs (revision (bn)): each is used by real and decoy pointers alike. */
const VERBS = { fi: ["vastaanotettu", "kuitattu", "kirjattu"], en: ["received", "acknowledged", "logged"] } as const;
/** How a participant would name the source in a follow-up question. */
const SPOKEN: Readonly<Record<string, { readonly fi: string; readonly en: string }>> = { DRONERYHMÄ: { fi: "drooniryhmä", en: "the drone team" }, TILANNEKUVA: { fi: "tilannekuva", en: "the situation picture" } };
/** A source's kind, for the sender mix: a ground unit, an air source (drones, the drone team, the spotter), a command source. */
const kindOfSource = (id: string) => (/^(?:DR\d|DRONERYHMÄ|SPOT|VD\d|HELI\d)$/.test(id) ? "air" : /^(?:P\d|TILANNEKUVA|HÄTÄKESKUS)$/.test(id) ? "command" : "ground");

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
      expect(a.provenance.sourceId, p.id).toBe(POINTER_SENDER); // revision (bn): the command centre acknowledges
      expect(to.provenance.sourceId, p.id).toBe(p.about); // ... the report of the source it names
      expect(a.navCategory, p.id).toBe(to.navCategory);
      expect(pushedIn(p.to), `${p.id} → ${p.to}`).toEqual([]); // the record is recorded: found only by a search
    }
  });

  it("a pointer arrives in the burst that makes its record reachable: the record's step, at or after its clock, within a minute", () => {
    for (const p of POINTERS) {
      const a = byId.get(p.id)!, to = byId.get(p.to)!;
      expect(a.cycle, p.id).toBe(to.cycle);
      expect(a.provenance.observedAt, p.id).toBeGreaterThanOrEqual(to.provenance.observedAt);
      expect(a.provenance.observedAt - to.provenance.observedAt, p.id).toBeLessThanOrEqual(60);
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

  it("revision (bn): no decoy points to an access line (KY23's line to KY21 was a template twin of EK14's real one)", () => {
    for (const p of decoys) expect(byId.get(p.to)!.record.kind === "lateral_traffic" ? JSON.stringify(byId.get(p.to)!.record) : "", p.id).not.toMatch(/ei pääse|pääsee meistä/);
    expect(decoys.map((p) => p.to)).not.toContain("evt.c12.050");
  });

  it("spread: every view with a real pointer has a decoy too, and decoys also come where no real pointer does", () => {
    const realViews = new Set(real.map((p) => viewOf(p.step))), decoyViews = new Set(decoys.map((p) => viewOf(p.step)));
    for (const v of realViews) expect(decoyViews.has(v), `V${v}`).toBe(true);
    expect([...decoyViews].filter((v) => !realViews.has(v)).length).toBeGreaterThanOrEqual(2);
    expect(Math.abs(real.length - decoys.length)).toBeLessThanOrEqual(1);
  });

  it("revision (bn): the decoys' sources mirror the reals' mix (ground units, air sources, a command source)", () => {
    const mix = (ps: readonly PointerDef[]) => ({ ground: ps.filter((p) => kindOfSource(p.about) === "ground").length, air: ps.filter((p) => kindOfSource(p.about) === "air").length, command: ps.filter((p) => kindOfSource(p.about) === "command").length });
    expect(mix(real)).toEqual({ ground: 3, air: 2, command: 1 });
    expect(mix(decoys)).toEqual(mix(real));
  });

  it("revision (bn): decoys share the reals' window classes (a view's start to its freeze, and a step boundary to the freeze)", () => {
    const freezeViews = new Set(scenario.freezes.map((f) => f.cycle as number));
    const cls = (p: PointerDef) => `${POINTER_SPECS.find((s) => s.atomId === p.id)!.windowStart}→${freezeViews.has(viewOf(p.step)) ? "freeze" : "view_end"}`;
    const realClasses = new Set(real.map(cls));
    expect([...realClasses].sort()).toEqual(["step_boundary→freeze", "view_start→freeze"]);
    for (const c of realClasses) expect(decoys.some((p) => cls(p) === c), c).toBe(true);
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
    it(`${lang}: no content word of a pointer's line (its sender and the source it names aside) is shared with any option or key`, () => {
      const hits: string[] = [];
      for (const p of POINTERS) {
        if (lang === "en") expect(recordIn(lang, p.id, p.fi), p.id).not.toBe(p.fi); // the English exists
        expect(recordIn(lang, p.id, p.fi), p.id).toContain(p.name[lang]); // the line names its source as `name` says
        for (const w of words(body(p, lang))) {
          for (const l of labels) for (const o of words(lang === "fi" ? l.fi : tr("en", l.fi))) if (share(w, o)) hits.push(`${p.id} "${w}" ~ ${l.id} "${o}"`);
        }
      }
      expect(hits).toEqual([]);
    });

    it(`${lang}: no figure, no direction, no call sign in a pointer's line beyond its sender and the source it names`, () => {
      for (const p of POINTERS) {
        const b = body(p, lang);
        expect(b, p.id).not.toMatch(/\d/);
        expect(b, p.id).not.toMatch(DIRECTIONS);
        expect(b, p.id).not.toMatch(/johto|command post/i); // "johto-" shares a stem with V7 cp_safe's "johtopaikka" (review S4)
        expect(b.trim().split(/\s+/).length, p.id).toBeLessThanOrEqual(5); // one breath
      }
    });

    it(`${lang}: revision (bn): the acknowledging verbs vary, each used by real and decoy pointers alike`, () => {
      for (const v of VERBS[lang]) {
        const uses = POINTERS.filter((p) => recordIn(lang, p.id, p.fi).endsWith(` ${v}.`));
        expect(uses.some((p) => p.kind === "real"), `${lang} ${v}`).toBe(true);
        expect(uses.some((p) => p.kind === "decoy"), `${lang} ${v}`).toBe(true);
      }
      for (const p of POINTERS) expect(VERBS[lang].some((v) => recordIn(lang, p.id, p.fi).endsWith(` ${v}.`)), p.id).toBe(true);
    });
  }

  it("the sender comes first and is the command centre JOKE (no H9 source); the source it names is in use (records before the pointer)", () => {
    for (const p of POINTERS) {
      expect(p.fi.startsWith(`${POINTER_SENDER}: `), p.id).toBe(true);
      expect(recordIn("en", p.id, p.fi).startsWith(`${tr("en", POINTER_SENDER)}: `), p.id).toBe(true);
      const own = scenario.atoms.filter((a) => a.provenance.sourceId === p.about && !a.pointer);
      expect(own.some((a) => a.provenance.observedAt < byId.get(p.id)!.provenance.observedAt), p.id).toBe(true);
    }
    expect(tr("en", POINTER_SENDER)).toBe("Command centre");
    // JOKE says nothing but the acknowledgements: no other record has it as its source.
    expect(scenario.atoms.filter((a) => a.provenance.sourceId === POINTER_SENDER && !a.pointer)).toEqual([]);
  });

  it("revision (bn): the English names a replenishment order, not an 'equipment order filed' (review S4; 'supply request' shares 'resupplied' and 'requested' with SPAM options)", () => {
    expect(recordIn("en", "atom.ptr.7.0", "")).toBe("Command centre: EK11's replenishment order received.");
    for (const p of POINTERS) expect(recordIn("en", p.id, p.fi), p.id).not.toMatch(/\bfiled\b/);
  });

  it("no new salience for a unit an option names: in the pointer's view, an item whose options name the source names it in its stem, or the source is already in that view's stream", () => {
    for (const p of POINTERS) {
      const view = viewOf(p.step);
      const spec = scenario.cycles.find((c) => c.index === view)!;
      const heard = spec.pushedAtomIds.some((id) => !byId.get(id)!.pointer && byId.get(id)!.provenance.sourceId === p.about);
      const re = new RegExp(`\\b${p.about}\\b`, "u");
      for (const it of scenario.freezes.find((f) => f.cycle === view)?.items ?? []) {
        if (!it.options.some((o) => re.test(o.labelFi))) continue;
        expect(re.test(it.promptFi) || heard, `${p.id} and ${it.id}`).toBe(true);
      }
    }
  });
});

describe("revision (bm): H9 and H10 untouched", () => {
  it("no pointer to an H9 or H10 record, none said by or naming their sources, none naming VPK or KY21 in V7–V8 (the rekindle arc)", () => {
    for (const p of POINTERS) {
      expect(H9_H10_RECORD_IDS, p.id).not.toContain(p.to);
      for (const id of [POINTER_SENDER, p.about]) expect(["VERKKOYHTIÖ", "JOHTOPAIKKA", "HELI1"], p.id).not.toContain(id);
      if (p.step === 10 || p.step === 11) expect(["VPK", "KY21"], p.id).not.toContain(p.about);
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
    // Revision (bn) (review S10): V11 and V12 displace KY23's repeated north-edge reports (18.10, 18.45), no longer VD1's 18.13 drops and
    // its 18.51 pause (an air asset's change of state, which the V12 wind picture includes).
    expect(displaced).toEqual(["evt.c03.039", "evt.c03.029", "evt.c07.036", "evt.c10.025", "evt.c10.020", "evt.c15.027", "evt.c17.010"]);
    const used = itemRecordIds(audit);
    const counted = new Set(POINTERS.filter((p) => !p.takesHeldSlot).map((p) => viewOf(p.step)));
    for (const id of displaced) {
      const a = byId.get(id)!;
      expect(used.has(id), id).toBe(false);
      expect(a.tier, id).toBe("T2_system");
      expect(counted.has(viewOf(a.cycle)), id).toBe(true);
    }
  });

  it("revision (bn): no air asset's change of state is displaced — VD1's 18.51 pause is in V12's stream — and a repeat goes first", () => {
    const traffic = new Map(SITE_SCENARIO.traffic.map((e) => [e.id, e] as const));
    for (const id of SITE_SCENARIO.pointerDisplaced ?? []) expect(isAirStateChange(traffic.get(id)!), id).toBe(false);
    expect(isAirStateChange(traffic.get("evt.c17.028")!)).toBe(true);
    expect(pushedIn("evt.c17.028")).toEqual([12]);
    // The two KY23 reports repeat what KY23 said before, figures aside (its 17.09 and 17.28 reports): nothing new leaves the stream.
    const gist = (t: string) => t.replace(/\d+(?:[,.]\d+)?/gu, "#");
    for (const id of ["evt.c15.027", "evt.c17.010"]) {
      const e = traffic.get(id)!;
      expect(SITE_SCENARIO.traffic.some((x) => x.id !== id && x.actor === e.actor && x.sim_time_s < e.sim_time_s && x.tier === "T1_pushed" && gist(x.content) === gist(e.content)), id).toBe(true);
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

  it("a participant can follow each pointer: 'what did <the source it names> report at <the pointer's clock>' retrieves its record (rank ≤ 8, lexical) in both languages, and never an H9 or H10 record", () => {
    for (const p of POINTERS) {
      const clock = clockAt(byId.get(p.id)!.provenance.observedAt); // as the message log shows it
      const who = SPOKEN[p.about] ?? { fi: p.about, en: p.about };
      const questions = { fi: `Mitä ${who.fi} ilmoitti klo ${clock}?`, en: `What did ${who.en} report at ${clock}?` };
      for (const lang of ["fi", "en"] as const) {
        const ids = hybridRetrieve(questions[lang], reachableAtoms(scenario.atoms, p.step), null, undefined, lang).map((r) => r.atom.id);
        expect(ids.indexOf(p.to), `${p.id} ${lang}: ${questions[lang]}`).toBeGreaterThanOrEqual(0);
        expect(ids.filter((id) => H9_H10_RECORD_IDS.includes(id)), `${p.id} ${lang}`).toEqual([]);
      }
    }
  });
});
