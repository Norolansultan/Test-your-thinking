/**
 * The commander-profile screen (SPEC/35 §4, `ProfileScreen.tsx`), rendered by calling it (it is hook-free): the three cards, the
 * note, Continue, the expert slot, not-enough states, and the leak guard — no rendered string, no profile value and no text of the
 * texts module contains a freeze item id, a key (option id, option label, map-key coordinate) or a freeze item's prompt, in either
 * language and for every band. Also: the screen's import graph never reaches the server-side premise table or the directive keys.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { VNode } from "preact";
import { describe, expect, it, vi } from "vitest";
import { tr } from "../../app/i18n/text.js";
import { ProfileScreen, ProfileView } from "../../app/render/ui/components/ProfileScreen.js";
import { PROFILE_TEXT } from "../../app/render/ui/profile/profile-texts.js";
import { buildFreezes, buildPracticeFreeze } from "../../app/scenario/demo-probes.js";
import type { FreezeItem } from "../../app/scenario/types.js";
import { commanderProfile, type CommanderProfile } from "../../app/telemetry/profile.js";
import type { LogRecord } from "../../app/telemetry/log.js";
import { freezeLog, guideQuestion, hakuChat, LogBuilder, plan, recordOpened, reviewClosed, reviewShown, revisePlan, sessionStarted, start, viewEnded } from "./fixtures.js";

const FREEZES = buildFreezes();
const PHASE_A = FREEZES.filter((f) => f.cycle <= 7);
const ALL_ITEMS: readonly FreezeItem[] = [...FREEZES.flatMap((f) => f.items), ...(buildPracticeFreeze()?.items ?? [])];

/** Every string a vnode tree renders (text and string props), function components called. */
function strings(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") { out.push(String(node)); return out; }
  if (Array.isArray(node)) { for (const n of node) strings(n, out); return out; }
  if (typeof node !== "object") return out;
  const v = node as VNode<Record<string, unknown>>;
  if (typeof v.type === "function") return strings((v.type as (p: unknown) => unknown)(v.props), out);
  for (const [k, p] of Object.entries(v.props ?? {})) if (k !== "children" && typeof p === "string") out.push(p);
  return strings(v.props?.children, out);
}

/** Every element with a `data-testid`, with its props. */
function byTestId(node: unknown, out = new Map<string, Record<string, unknown>>()): Map<string, Record<string, unknown>> {
  if (node === null || node === undefined || typeof node !== "object") return out;
  if (Array.isArray(node)) { for (const n of node) byTestId(n, out); return out; }
  const v = node as VNode<Record<string, unknown>>;
  if (typeof v.type === "function") return byTestId((v.type as (p: unknown) => unknown)(v.props), out);
  const id = v.props?.["data-testid"];
  if (typeof id === "string") out.set(id, v.props);
  return byTestId(v.props?.children, out);
}

/** Every string of the texts module: static ones and the functions' output with sample values. */
function textStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") out.push(node);
  else if (typeof node === "function") out.push(String((node as (...a: unknown[]) => unknown)(3, 7, "42 %")), String((node as (n: number) => unknown)(130)));
  else if (node && typeof node === "object") for (const v of Object.values(node)) textStrings(v, out);
  return out;
}

/** The forbidden strings: item ids, identifier-like option ids (whole tokens), prompts and option labels (fi, en), map-key coordinates. */
const FORBIDDEN_SUBSTRINGS: readonly string[] = [...new Set(ALL_ITEMS.flatMap((item) => [
  item.id, item.promptFi, tr("en", item.promptFi),
  ...item.options.flatMap((o) => [o.labelFi, tr("en", o.labelFi)]),
  ...(item.mapKey ? [item.mapKey.point.lat.toFixed(4), item.mapKey.point.lon.toFixed(4)] : []),
]).filter((s) => s.length >= 6).map((s) => s.toLowerCase()))];
const FORBIDDEN_TOKENS: readonly string[] = [...new Set(ALL_ITEMS.flatMap((item) => item.options.map((o) => o.id)).filter((id) => /[_\d]/.test(id)))];

function leaks(text: string): string[] {
  const lower = text.toLowerCase();
  const tokens = new Set(lower.split(/[^a-z0-9_äöå.]+/));
  return [...FORBIDDEN_SUBSTRINGS.filter((s) => lower.includes(s)), ...FORBIDDEN_TOKENS.filter((t) => tokens.has(t.toLowerCase()))];
}

function sessions(): Record<string, LogRecord[]> {
  const guide = new LogBuilder().add(sessionStarted("reasoning_once"));
  for (let v = 8; v <= 10; v++) {
    guide.add(start(v)).add(guideQuestion(v)).add(hakuChat(v)).add(plan()).add(reviewShown(v, ["atom.demo.12.0"])).add(recordOpened(v, "atom.demo.12.0"))
      .add(reviewClosed(v, v === 9 ? "revise" : "keep"));
    if (v === 9) guide.add(revisePlan(9));
    guide.add(viewEnded(v));
  }
  return {
    well: freezeLog(PHASE_A, (i) => i % 4 !== 0, (_i, ok) => (ok ? 100 : 25)),
    over: freezeLog(PHASE_A, (i) => i % 2 === 0, () => 100, "reasoning_intent"),
    under: freezeLog(PHASE_A, (i) => i % 8 !== 0, (_i, ok) => (ok ? 25 : 50)),
    allRight: freezeLog(FREEZES, () => true, () => 75),
    guide: [...freezeLog(PHASE_A, (i) => i % 3 !== 0, () => 75, "reasoning_once"), ...guide.records.slice(1)].map((r, seq) => ({ ...r, seq: seq as never })),
    empty: [],
  };
}

describe("the profile screen", () => {
  it("three cards, the private-not-a-score note and Continue calling onDone, in both languages", () => {
    for (const lang of ["fi", "en"] as const) {
      const onDone = vi.fn();
      const tree = ProfileScreen({ lang, records: sessions()["well"]!, onDone });
      const ids = byTestId(tree);
      for (const id of ["profile-screen", "profile-calibration", "profile-checking", "profile-tooluse", "profile-note", "profile-continue"]) expect(ids.has(id), id).toBe(true);
      (ids.get("profile-continue")!["onClick"] as () => void)();
      expect(onDone).toHaveBeenCalledTimes(1);
      const text = strings(tree).join(" ");
      const t = PROFILE_TEXT[lang];
      for (const s of [t.title, t.privacyNote, t.continue, t.calibration.title, t.checking.title, t.toolUse.title, t.calibration.band.well, t.calibration.meaningOf.well]) expect(text).toContain(s);
    }
  });

  it("the participant's values: calibration numbers, the checking share, the tool counts, the reviews", () => {
    const text = strings(ProfileScreen({ lang: "en", records: sessions()["guide"]!, onDone: () => undefined })).join(" ");
    expect(text).toContain("Your average confidence was 75%; 66% of your answers were correct.");
    expect(text).toContain("Questions to the Thinker: 3");
    expect(text).toContain("Searches in Search (Haku): 3");
    expect(text).toContain("You changed your plan at 1 of 3 plan reviews.");
    expect(text).toMatch(/You looked something up before acting in \d+ of \d+ decisions/);
  });

  it("the Haku group sees no Thinker line; a phase-A session says it had no plan reviews", () => {
    const text = strings(ProfileScreen({ lang: "en", records: sessions()["well"]!, onDone: () => undefined })).join(" ");
    expect(text).not.toContain("Thinker");
    expect(text).toContain(PROFILE_TEXT.en.toolUse.noReviews);
  });

  it("missing data: not-enough messages instead of numbers; the expert comparison is pending on every card", () => {
    for (const lang of ["fi", "en"] as const) {
      const tree = ProfileScreen({ lang, records: [], onDone: () => undefined });
      const text = strings(tree).join(" ");
      expect(text).toContain(PROFILE_TEXT[lang].calibration.notEnough);
      expect(text).toContain(PROFILE_TEXT[lang].checking.notEnough);
      expect(text).not.toMatch(/\d+ ?%/);
      const ids = byTestId(tree);
      for (const card of ["calibration", "checking", "tooluse"]) expect(strings(ids.get(`profile-${card}-expert`)!["children"])).toEqual([PROFILE_TEXT[lang].expertPending]);
    }
  });

  it("an expert reference, once it exists, is shown in place of the pending line", () => {
    const profile: CommanderProfile = { ...commanderProfile(sessions()["well"]!), expert: { calibrationGapPoints: 4, checkingShare: 0.8, hakuSearches: 12, guideQuestions: null, reviewChangeShare: 0.25 } };
    const ids = byTestId(ProfileView({ lang: "en", profile, onDone: () => undefined }));
    expect(strings(ids.get("profile-calibration-expert")!["children"]).join("")).toBe("Experienced commanders (median): Difference: +4 percentage points.");
    expect(strings(ids.get("profile-checking-expert")!["children"]).join("")).toBe("Experienced commanders (median): 80%");
  });
});

describe("the profile never shows an item, a key or a correct answer", () => {
  it("the forbidden lists are real (ids, identifier-like keys, prompts and labels from the banks)", () => {
    expect(ALL_ITEMS.length).toBeGreaterThan(40);
    expect(FORBIDDEN_TOKENS.length).toBeGreaterThan(10);
    expect(leaks(`see ${ALL_ITEMS[0]!.id}`)).not.toEqual([]);
    expect(leaks(ALL_ITEMS[5]!.promptFi)).not.toEqual([]);
  });

  it("no rendered string, in either language and for every session above, and no profile value", () => {
    for (const [name, records] of Object.entries(sessions())) {
      expect(leaks(JSON.stringify(commanderProfile(records))), `${name} profile`).toEqual([]);
      for (const lang of ["fi", "en"] as const) {
        const text = strings(ProfileScreen({ lang, records, onDone: () => undefined })).join("\n");
        expect(leaks(text), `${name} ${lang}`).toEqual([]);
      }
    }
  });

  it("no text of the texts module (every band, every message)", () => {
    for (const lang of ["fi", "en"] as const) expect(leaks(textStrings(PROFILE_TEXT[lang]).join("\n"))).toEqual([]);
  });

  it("the screen's import graph never reaches the premise table, the roadblock module or the directive keys (they stay out of the browser)", () => {
    const seen = new Set<string>();
    const IMPORT = /^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']/gm;
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      if (!/\.(ts|tsx)$/.test(file)) return;
      for (const m of readFileSync(file, "utf8").matchAll(IMPORT)) {
        const spec = m[1] ?? m[2]!;
        if (!spec.startsWith(".")) continue;
        const base = join(dirname(file), spec);
        const candidates = base.endsWith(".js") ? [base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".tsx")] : [base];
        const found = candidates.find((c) => { try { readFileSync(c); return true; } catch { return false; } });
        if (found) visit(found);
      }
    };
    visit("app/render/ui/components/ProfileScreen.tsx");
    expect(seen.has("app/telemetry/profile.ts")).toBe(true);
    expect(seen.has("app/telemetry/freeze-measures.ts")).toBe(true);
    const reached = [...seen].filter((f) => /roadblock-measures|demo-directive|premise-evidence/.test(f));
    expect(reached).toEqual([]);
  });
});
