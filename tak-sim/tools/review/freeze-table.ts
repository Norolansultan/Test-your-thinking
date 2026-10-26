/**
 * `npx tsx tools/review/freeze-table.ts` — prints SPEC/08's freeze item table as Markdown, generated from the built bank (`31` F22,
 * 19 Oct 2026; the successor of revision (aa)'s `freeze-table.mts`). One row per item in the order the screen shows it (levels, map items
 * last): the view, the item's slug, level, goal, format, the key (the correct option's Finnish label, or the map key with its tolerance),
 * how the key was obtained, the forecast steps (`keySteps`), the L3 basis kind (`31` §3.9), analysis tags (retrieval-dependent,
 * verification, `h9_only`: play-test D6), and the bank's basis text (its figures computed at build time). The table contains TRUTH (the keys): for the spec and
 * the reviewers, never for participants. Deterministic: the same build prints the same table.
 */

import { pathToFileURL } from "node:url";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { FREEZE_BANK } from "../../app/scenario/freeze-bank.js";
import type { ItemDef } from "../../app/scenario/freeze-bank-core.js";
import type { FreezeItem } from "../../app/scenario/types.js";

const cell = (s: string): string => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

function keyOf(it: FreezeItem): string {
  if (it.kind === "map_point") return `map point (${it.mapKey!.toleranceM} m)`;
  return it.options.find((o) => o.correct)!.labelFi;
}

function row(view: string, it: FreezeItem, def: ItemDef | undefined): string {
  const slug = it.id.replace(/^freeze\.(practice|\d+)\./, "");
  const steps = def?.keySteps ? `${def.keySteps[0]}–${def.keySteps[1]}` : "—";
  const tags = [it.retrievalDependent ? "retrieval" : "", it.family ?? "", it.scoredFor ?? ""].filter((t) => t !== "").join(", ") || "—";
  const basis = def ? def.basis : it.id.endsWith(".f7") ? "F7: the grid operator's log and HELI1's line clearance (`demo-probes.ts` F7_ITEM)" : "direct report (`demo-probes.ts` INFRA_SCHEDULE)";
  const rule = def ? def.rule : "cited";
  return `| ${view} | \`${slug}\` | ${it.level} | ${it.goal ?? "—"} | ${it.kind ?? "choice"} | ${cell(keyOf(it))} | ${rule} | ${steps} | ${it.basisKind ?? "—"} | ${tags} | ${cell(basis)} |`;
}

/** The table's Markdown lines. */
export function freezeTable(): string[] {
  const scenario = buildDemoScenario();
  const lines = [
    "| View | Item | Level | Goal | Format | Key | Rule | Forecast steps | Basis kind | Tags | Basis |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  const defOf = (defs: readonly ItemDef[], it: FreezeItem) => defs.find((d) => it.id.endsWith(`.${d.slug}`));
  // Revision (bp), 26 Oct 2026: VP has no freeze (its practice freeze is retired), so the table has no VP rows.
  for (const f of scenario.freezes) for (const it of f.items) lines.push(row(`V${f.cycle}`, it, defOf(FREEZE_BANK[f.cycle] ?? [], it)));
  return lines;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.stdout.write(`${freezeTable().join("\n")}\n`);
