/**
 * The H2 power re-run with the difficulty audit's item classes (`tools/power/h2-items.ts`, `npm run power:h2-items`; SPEC/09 (bf)):
 * the H2 window read from the audit's `items.csv` with its classes, item-specific difficulty, an effect only on seek-dependent items,
 * the windows (all, seek-dependent, without late, without late and lure), deterministic power curves and the minimum detectable effect.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL, effectWeight, h2ItemClasses, interpolate, itemBase, itemPowerReport, minimumDetectable, powerGrid, WINDOWS, type ItemClass,
} from "../../tools/power/h2-items.js";

/** The audit's CSV as committed; the scenario work regenerates it, so only its shape is asserted here (the classes are the fixture's). */
const AUDIT_CSV = readFileSync(new URL("../../docs/audits/2026-10-23-difficulty/items.csv", import.meta.url), "utf8");

/** A synthetic audit table with the audit's columns: 24 H2 items in the 23 Oct 2026 classes (16 yes, 6 partly, 2 no; 5 late), and rows outside the window. */
const HEAD = "id,kind,view,level,goal,format,basis_kind,retrieval_dependent,prompt_en,key_en,moment_s,key_records,hand_basis_records,all_key_pushed,key_needs_search,latest_lead_s,late_lt60s,channels,passive,map_dependence,map_fact_unstated,seek_channel,note";
const row = (id: string, view: string, level: string, passive: string, late: boolean, kind = "freeze") =>
  `${id},${kind},${view},${level},g,choice,,false,"Prompt, with a comma",key,60,,,false,false,,${late},a,${passive},none,false,,note`;
const CLASSES: readonly (readonly [string, boolean])[] = [
  ...Array.from({ length: 5 }, () => ["yes", true] as const), ...Array.from({ length: 11 }, () => ["yes", false] as const),
  ...Array.from({ length: 6 }, () => ["partly", false] as const), ...Array.from({ length: 2 }, () => ["no", false] as const),
];
const VIEWS = ["V2", "V4", "V5", "V7"];
const CSV = [
  HEAD,
  ...CLASSES.map(([passive, late], k) => row(`freeze.${k}`, VIEWS[k % 4]!, k % 3 === 0 ? "L2" : "L3", passive, late)),
  row("freeze.l1", "V2", "L1", "yes", false), row("freeze.10.x", "V10", "L3", "no", false), row("probe.s.cycle_3.b", "V3", "L2", "no", false, "spam"),
].join("\n");
const LURES = new Set(["freeze.17", "freeze.22", "freeze.6"]);

describe("the H2 window from the audit's items.csv", () => {
  it("is the L2/L3 freeze items of V2, V4, V5, V7 with their passive and late classes; lures from the given ids without a lure column", () => {
    const items = h2ItemClasses(CSV, LURES);
    expect(items).toHaveLength(24); // L1, V10 and SPAM rows are outside H2's window
    const count = (f: (i: ItemClass) => boolean) => items.filter(f).length;
    expect([count((i) => i.passive === "yes"), count((i) => i.passive === "partly"), count((i) => i.passive === "no")]).toEqual([16, 6, 2]);
    expect(count((i) => i.late)).toBe(5);
    expect(items.filter((i) => i.lure).map((i) => i.id).sort()).toEqual([...LURES].sort());
  });

  it("the committed audit: 23 H2 items, every one in one of the three classes (play-test R2: V4's exploratory head_later is out)", () => {
    const items = h2ItemClasses(AUDIT_CSV);
    expect(items).toHaveLength(23);
    expect(items.map((i) => i.id)).not.toContain("freeze.4.head_later");
    expect(new Set(items.map((i) => i.view))).toEqual(new Set(VIEWS));
  });

  it("leaves out a row the audit marks scored outside the composites (`scored_for`, play-test R2)", () => {
    const head = HEAD.replace("retrieval_dependent,", "retrieval_dependent,scored_for,");
    const r = (id: string, scoredFor: string) => row(id, "V4", "L3", "partly", false).replace(",false,\"Prompt", `,false,${scoredFor},"Prompt`);
    expect(h2ItemClasses(`${head}\n${r("freeze.a", "")}\n${r("freeze.b", "exploratory")}\n`).map((i) => i.id)).toEqual(["freeze.a"]);
  });

  it("reads a lure column when the audit adds one, and refuses an unknown class", () => {
    expect(h2ItemClasses(`${HEAD},lure\n${row("freeze.a", "V4", "L3", "partly", false)},true\n`, new Set())).toMatchObject([{ id: "freeze.a", passive: "partly", lure: true }]);
    expect(() => h2ItemClasses(`${HEAD}\n${row("freeze.b", "V4", "L3", "maybe", false)}\n`)).toThrow(/passive "maybe"/);
  });
});

describe("the model", () => {
  const it0 = (passive: ItemClass["passive"], late = false): ItemClass => ({ id: "x", view: "V2", level: "L3", passive, late, lure: false });
  it("item difficulty by class (a told item easier, a seek-only and a late one harder) and the effect only where seeking is needed", () => {
    expect([itemBase(it0("yes"), DEFAULT_MODEL), itemBase(it0("partly"), DEFAULT_MODEL), itemBase(it0("no"), DEFAULT_MODEL), itemBase(it0("yes", true), DEFAULT_MODEL)]).toEqual([-1, 0, 0.5, -0.5]);
    expect([effectWeight(it0("yes"), DEFAULT_MODEL), effectWeight(it0("partly"), DEFAULT_MODEL), effectWeight(it0("no"), DEFAULT_MODEL)]).toEqual([0, 1, 1]);
    expect(effectWeight(it0("partly"), { ...DEFAULT_MODEL, partlyWeight: 0.5 })).toBe(0.5);
    expect(effectWeight(it0("yes", true), { ...DEFAULT_MODEL, lateWeight: 0.5 })).toBe(0.5);
  });

  it("the minimum detectable effect is read off the curve by linear interpolation", () => {
    expect(minimumDetectable([0, 0.5, 1], [0.05, 0.6, 0.9])).toBeCloseTo(0.5 + (0.2 / 0.3) * 0.5, 10);
    expect(minimumDetectable([0, 0.5], [0.05, 0.6])).toBeNull();
    expect(interpolate([0, 1], [0, 0.1], 0.25)).toBeCloseTo(0.025, 10);
  });
});

describe("the power grid", () => {
  const items = h2ItemClasses(CSV, LURES);
  it("is deterministic in its seed, near α at Δ 0, rises with Δ, and the seek-dependent window beats the diluted one", () => {
    const deltas = [0, 0.8, 1.6];
    const a = powerGrid(items, 50, deltas, 120, 7);
    expect(powerGrid(items, 50, deltas, 120, 7)).toEqual(a);
    expect(a.map((c) => c.window)).toEqual(WINDOWS.map((w) => w.id));
    expect(a.map((c) => c.items)).toEqual([24, 8, 19, 16, 6]);
    const [all, seek] = [a[0]!, a[1]!];
    expect(all.power[0]!).toBeLessThan(0.15);
    expect(all.power[2]!).toBeGreaterThan(all.power[1]!);
    expect(seek.power[1]!).toBeGreaterThan(all.power[1]!);
    // The effect sits on a third of the items: the all-items Δgap is about a third of the seek-dependent one.
    expect(all.dGap[2]! / seek.dGap[2]!).toBeGreaterThan(0.2);
    expect(all.dGap[2]! / seek.dGap[2]!).toBeLessThan(0.5);
  });

  it("the report names the classes, both tables and the uniform-effect reference", () => {
    const report = itemPowerReport(items, { reps: 30, seed: 1, model: DEFAULT_MODEL, sizes: [50], deltas: [0, 0.4, 0.8, 1.6, 3.0] });
    expect(report).toContain("Items read: 24 (passive yes 16, partly 6, no 2; late 5; lure 3).");
    expect(report).toContain("**Power, effect on seek-dependent items only**");
    expect(report).toContain("**Minimum detectable effect at 80 % power**");
    expect(report).toContain("Reference (the effect on every item");
    expect(report).toContain("| all H2 items (as pre-registered) | 24 |");
  });
});
