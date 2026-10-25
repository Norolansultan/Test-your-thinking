/**
 * `31` §3.5, §3.8, §3.9 (19 Oct 2026; sagat F01, F03, F08, F11, F18, F30): the rules every freeze item now keeps, checked on the built bank.
 * (1) A report-keyed key's basis is DELIVERED by the freeze: each step its extrapolation reads is drawn on the map of the freeze's view or an
 * earlier one, or stated by a pushed record of that step in its `basisAtomIds`. (2) An L3 map key lies ≥ 2 × its tolerance from the head drawn
 * at "now" (the view's map) and from the head at the freeze's clock. (3) Every L3 item's interval starts at "now" (`keySteps`, `nowStepOf`)
 * and its stem names the interval's end by its clock only (play-test R1, 25 Oct 2026). (4) Ordinal bands are shown ascending, outside the position balance. (5) Every L3 item carries its
 * `basisKind` and, for a record basis, the delivered records. (6) `retrievalDependent` exactly when every key record is recorded-only.
 * The level mixes (2/2/4, 2/2/2) and the 1.3× rule are in `freeze-items.spec.ts`; the keyStatements in `freeze-key-statements.spec.ts`.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { FREEZE_BANK, PRACTICE_BANK } from "../../app/scenario/freeze-bank.js";
import { bandsAscending, inMinutesFi, isOrdinal, minutesAhead, nowStepOf, stepEndClockFi, withinMinutesFi, type ItemDef } from "../../app/scenario/freeze-bank-core.js";
import { distanceM, drawnSteps, headNow } from "../../app/scenario/freeze-keys.js";
import { MAIN_VIEWS } from "../../app/scenario/views.js";
import type { FreezeItem } from "../../app/scenario/types.js";

const scenario = buildDemoScenario();
const atom = (id: string) => scenario.atoms.find((a) => a.id === id);
const steps = (view: number) => MAIN_VIEWS.find((v) => v.index === view)!.steps;
const pushedIds = new Set([...scenario.cycles, scenario.practice.cycle].flatMap((c) => c.pushedAtomIds));
const pushedAtStep = new Map<string, number>(scenario.atoms.filter((a) => pushedIds.has(a.id)).map((a) => [a.id, Number(a.cycle)]));
const mainDefs = Object.entries(FREEZE_BANK).flatMap(([v, ds]) => ds.map((d) => ({ view: Number(v), d })));
const built = (view: number, d: ItemDef): FreezeItem =>
  scenario.freezes.find((f) => f.cycle === view)!.items.find((it) => it.id === `freeze.${view}.${d.slug}`)!;

describe("`31` rule (1): a report-keyed basis is delivered by the freeze", () => {
  it("each basis step is drawn on a map up to the freeze's view, or stated by a pushed basis record of that step", () => {
    const withSteps = mainDefs.filter(({ d }) => d.basisSteps !== undefined);
    expect(withSteps.map(({ view, d }) => `${view}.${d.slug}`)).toEqual(expect.arrayContaining(["2.area_40", "2.junction_hour", "5.area_hour", "10.area_growth_hour", "10.front_r2_80", "12.village_distance"]));
    for (const { view, d } of withSteps) {
      const drawn = new Set(drawnSteps(view));
      for (const s of d.basisSteps!) {
        const pushedThere = (d.basisAtomIds ?? []).some((id) => pushedAtStep.get(id) === s);
        expect(drawn.has(s) || pushedThere, `V${view} ${d.slug}: step ${s} neither drawn (${[...drawn]}) nor pushed in its basis`).toBe(true);
        expect(s, `V${view} ${d.slug}`).toBeLessThanOrEqual(steps(view).at(-1)!);
      }
    }
    expect(PRACTICE_BANK.find((d) => d.slug === "r1_arrival")!.basisSteps).toEqual([-3]); // VP's map draws W2 (step −3)
  });

  it("a merged view's second step is never drawn (the map shows the view's first step), so it can be a basis only through a pushed record", () => {
    for (const v of MAIN_VIEWS.filter((x) => x.steps.length > 1)) expect(drawnSteps(v.index), `V${v.index}`).not.toContain(v.steps[1]);
  });
});

describe("`31` rule (2), F03: an L3 map key lies ≥ 2 × its tolerance from the head drawn at now", () => {
  it("from the head the view's map draws (its first step) and from the head at the freeze's clock", () => {
    const maps = mainDefs.filter(({ d }) => d.level === "L3" && d.kind === "map_point");
    expect(maps.map(({ view }) => view)).toEqual([2, 4, 12]); // V14's gave way to a non-map item (no truth after 20.00)
    for (const { view, d } of maps) {
      if (d.kind !== "map_point") continue;
      for (const s of [steps(view)[0]!, nowStepOf(view)]) {
        const m = distanceM(d.point, headNow(s));
        expect(m, `V${view} ${d.slug}: ${Math.round(m)} m from the head of step ${s}, tolerance ${d.toleranceM} m`).toBeGreaterThanOrEqual(2 * d.toleranceM);
      }
    }
  });
});

describe("`31` rule (3), F08, §3.8: every L3 stem names its horizon from now", () => {
  it("now is the freeze's screen clock: the view's last step, or the step after it for a freeze at the view's end (V10, V12, V14)", () => {
    expect([2, 4, 5, 7, 10, 12, 14].map((v) => [v, nowStepOf(v)])).toEqual([2, 4, 5, 7, 10, 12, 14].map((v) => [v, steps(v).at(-1)! + ([10, 12, 14].includes(v) ? 1 : 0)]));
  });

  it("each L3 item's interval starts at now, and its stem names the interval's end by its clock only (play-test R1)", () => {
    for (const { view, d } of mainDefs.filter(({ d }) => d.level === "L3")) {
      expect(d.keySteps, `V${view} ${d.slug}`).toBeDefined();
      expect(d.keySteps![0], `V${view} ${d.slug}`).toBe(nowStepOf(view));
      const m = minutesAhead(view, d.keySteps![1]);
      expect(m, `V${view} ${d.slug}`).toBeGreaterThan(0);
      // Play-test R1 (researcher 25 Oct 2026): the clock the key is read at (the end of its last step), "klo 14.40" or "klo 15.40
      // mennessä", and no minutes from now: those ran from the start of the header's span in phase A, a step before its "now".
      expect(d.promptFi, `V${view} ${d.slug}`).toMatch(new RegExp(` klo ${stepEndClockFi(d.keySteps![1]).replace(".", "\\.")}(?: mennessä)?[?.,]`));
      expect([inMinutesFi(m), withinMinutesFi(m)].some((h) => d.promptFi.includes(h)), `V${view} ${d.slug}: "${d.promptFi}" still names ${m} min`).toBe(false);
      expect(d.promptFi, `V${view} ${d.slug}`).not.toMatch(/kuluttua|aikana|\(klo/);
    }
  });
});

describe("`31` rule (4), F11: ordinal bands", () => {
  it("are shown in ascending order, as authored (no draw), in every freeze", () => {
    const ordinal = [...scenario.freezes, scenario.practice.freeze].flatMap((f) => f.items).filter(isOrdinal);
    expect(ordinal.length).toBeGreaterThanOrEqual(8);
    for (const it of ordinal) expect(bandsAscending(it), it.id).toBe(true);
    for (const { view, d } of mainDefs) if (d.kind === "choice" && isOrdinal(built(view, d))) expect(built(view, d).options.map((o) => o.id), d.slug).toEqual(d.options.map(([id]) => id));
  });
});

describe("`31` rule (5), §3.9: the L3 basis metadata (analysis only)", () => {
  it("every L3 item carries its basisKind; a record basis names delivered records (pushed or recorded by the freeze's view)", () => {
    for (const { view, d } of mainDefs.filter(({ d }) => d.level === "L3")) {
      const it = built(view, d);
      expect(["record", "map", "knowledge", "ca_truth"], `V${view} ${d.slug}`).toContain(it.basisKind);
      if (it.basisKind === "record") {
        expect(it.basisAtomIds?.length, `V${view} ${d.slug}`).toBeGreaterThan(0);
        for (const id of it.basisAtomIds!) {
          expect(atom(id), `V${view} ${d.slug}: ${id}`).toBeDefined();
          expect(Number(atom(id)!.cycle), `V${view} ${d.slug}: ${id}`).toBeLessThanOrEqual(steps(view).at(-1)!);
        }
      }
      if (it.basisKind === "knowledge" || it.basisKind === "ca_truth") expect(it.basisAtomIds ?? [], `V${view} ${d.slug}`).toEqual([]);
    }
  });

  it("a report-keyed band item whose fire-model band differs names it (`truthOptionId`, the dual key); every band key and its truth agree in this build", () => {
    for (const { view, d } of mainDefs) if (d.kind === "choice") expect(built(view, d).truthOptionId, `V${view} ${d.slug}`).toBeUndefined();
  });
});

describe("`31` rule (6), F18, F30: retrieval-dependent items", () => {
  it("carry the flag exactly when every key record is recorded-only (none pushed), the bank's items and the infrastructure slot alike", () => {
    const flagged: string[] = [];
    for (const f of [...scenario.freezes, scenario.practice.freeze]) for (const it of f.items) {
      const ids = it.keyAtomIds ?? [];
      const expected = ids.length > 0 && ids.every((id) => !pushedIds.has(id));
      expect(it.retrievalDependent === true, it.id).toBe(expected);
      if (expected) flagged.push(it.id);
    }
    // F18's R1 items (V2, V5) among them; V12's F7 (its records are T2 by design).
    expect(flagged).toEqual(expect.arrayContaining(["freeze.2.infra", "freeze.5.infra", "freeze.12.f7"]));
  });
});
