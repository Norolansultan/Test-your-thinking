/**
 * `31` F22: SPEC/08's freeze item table is generated from the built bank (`tools/review/freeze-table.ts`), so it cannot go stale again:
 * one row per item of the practice and main freezes, in screen order, the same on every run.
 */

import { describe, expect, it } from "vitest";
import { freezeTable } from "../../tools/review/freeze-table.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";

describe("the generated item table (`31` F22)", () => {
  it("has its header and one row per item, in the screen's order, deterministically", () => {
    const scenario = buildDemoScenario();
    const lines = freezeTable();
    expect(lines[0]).toBe("| View | Item | Level | Goal | Format | Key | Rule | Forecast steps | Basis kind | Tags | Basis |");
    const items = [scenario.practice.freeze, ...scenario.freezes].flatMap((f) => f.items);
    expect(lines).toHaveLength(2 + items.length);
    lines.slice(2).forEach((l, k) => expect(l, items[k]!.id).toContain(`\`${items[k]!.id.replace(/^freeze\.(practice|\d+)\./, "")}\``));
    for (const l of lines.slice(2)) expect(l.split(/(?<!\\)\|/)).toHaveLength(13); // 11 cells; a pipe inside a cell is escaped
    expect(freezeTable()).toEqual(lines);
  });

  it("states every L3 item's basis kind and the regenerated keys of `31` (V4 ek12_where, the V10 and V12 bands, V14's new items)", () => {
    const rows = freezeTable().slice(2);
    for (const r of rows.filter((x) => x.includes("| L3 |"))) expect(r, r.slice(0, 40)).toMatch(/\| (record|map|knowledge|ca_truth) \|/);
    const row = (view: string, slug: string) => rows.find((r) => r.startsWith(`| ${view} | \`${slug}\``))!;
    expect(row("V4", "ek12_where")).toContain("Tiellä R1 palaneella alueella");
    expect(row("V10", "area_total_hour")).toContain("129–138");
    expect(row("V12", "village_distance")).toContain("1600–2100");
    expect(row("V14", "se_front_r2")).toContain("| 21–21 |");
    expect(row("V14", "flare_next")).toBeDefined();
  });
});
