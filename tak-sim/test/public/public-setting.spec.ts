/**
 * SPEC/35 §2, §4, §5 (work package P1): the setting from the URL, the public questionnaire's background items (swapped only in a
 * public session), and the public texts — the same for both groups, complete in both languages, the debrief keeping the request
 * not to discuss the session.
 */

import { describe, expect, it } from "vitest";
import { lastViewOf, scopedSchedule, sessionSettingFromUrl } from "../../app/session/public-session.js";
import { EXPERT_BACKGROUND_IDS, EXPERT_ONLY_IDS, PUBLIC_BACKGROUND_ITEMS, questionnaireItems } from "../../app/session/questionnaire.js";
import { chapterLabel, chapterOf, projectionHeldIn, PUBLIC_TEXT, studyTextFor } from "../../app/i18n/public-texts.js";
import { consentTextId, debriefTextId, STUDY_TEXT } from "../../app/i18n/study-texts.js";
import { LANGUAGES } from "../../app/i18n/lang.js";
import { planSessionResume } from "../../app/telemetry/resume.js";
import { checkpointLabel } from "../../app/telemetry/session-checkpoint.js";
import type { Cell } from "../../app/scenario/types.js";
import type { GlossarySurface as ContractSurface, HelpCardSection as ContractSection } from "../../app/render/ui/audience-context.js";
import type { GlossarySurface, HelpCardSection } from "../../app/telemetry/record-kinds.js";

const CELLS: readonly Cell[] = ["radio", "reasoning_once", "reasoning_intent"];
const LANGS = LANGUAGES.map((l) => l.id);

describe("the setting from the URL (SPEC/35 §2)", () => {
  it("`?yleiso` makes the session public, `?laajuus=a` phase A; the defaults are expert and full", () => {
    expect(sessionSettingFromUrl("")).toEqual({ audience: "expert", scope: "full" });
    expect(sessionSettingFromUrl("?tuotanto&koodi=F4H9H7")).toEqual({ audience: "expert", scope: "full" });
    expect(sessionSettingFromUrl("?tuotanto&yleiso")).toEqual({ audience: "public", scope: "full" });
    expect(sessionSettingFromUrl("?yleiso=1&laajuus=a")).toEqual({ audience: "public", scope: "phaseA" });
    expect(sessionSettingFromUrl("?laajuus=a")).toEqual({ audience: "expert", scope: "phaseA" });
  });

  it("refuses an unknown scope rather than guessing one", () => {
    expect(sessionSettingFromUrl("?yleiso&laajuus=b")).toEqual({ invalid: expect.stringMatching(/laajuus/) });
    expect(sessionSettingFromUrl("?laajuus=")).toHaveProperty("invalid");
    expect(sessionSettingFromUrl("?laajuus=__proto__")).toHaveProperty("invalid");
  });

  it("phase A's last view is the hinge view, and the resume plan reads it as the end", () => {
    const schedule = { count: 14, hingeAfter: 7 } as unknown as Parameters<typeof lastViewOf>[1];
    expect(lastViewOf("full", schedule)).toBe(14);
    expect(lastViewOf("phaseA", schedule)).toBe(7);
    const ended = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((cycle, i) => [
      { seq: 2 * i, tVirtual: 0, tWallOffsetMs: 0, kind: "cycle_start", detail: { cycle } },
      { seq: 2 * i + 1, tVirtual: 0, tWallOffsetMs: 0, kind: "cycle_end", detail: { cycle } },
    ]) as never;
    expect(planSessionResume(ended, scopedSchedule("phaseA", schedule)).target).toEqual({ kind: "complete" });
    expect(planSessionResume(ended, scopedSchedule("full", schedule)).target).toEqual({ kind: "hinge" });
  });

  it("the profile is a checkpoint once the session is at its end (DEBRIEF_HANDOFF)", () => {
    expect(checkpointLabel("profile", 14, "DEBRIEF_HANDOFF")).toBe("profile");
    expect(checkpointLabel("primer", 0, "BRIEFING")).toBeNull();
  });

  it("the record kinds' surfaces and sections are the render contract's (`audience-context.ts`; checked by the type checker)", () => {
    type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
    const surfaces: Same<GlossarySurface, ContractSurface> = true;
    const sections: Same<HelpCardSection, ContractSection> = true;
    expect([surfaces, sections]).toEqual([true, true]);
  });
});

describe("the public questionnaire (SPEC/35 §5)", () => {
  it("swaps the firefighter background items for the public ones, where `role.rank` stood, in public sessions only", () => {
    for (const cell of CELLS) {
      const expert = questionnaireItems("post", cell).map((i) => i.id);
      const pub = questionnaireItems("post", cell, undefined, { audience: "public", scope: "full" }).map((i) => i.id);
      for (const id of EXPERT_BACKGROUND_IDS) {
        expect(expert).toContain(id);
        expect(pub).not.toContain(id);
      }
      const publicIds = PUBLIC_BACKGROUND_ITEMS.map((i) => i.id);
      expect(publicIds).toEqual(["public.age_band", "public.education", "public.management", "public.responder", "public.gaming", "public.ai_use"]);
      for (const id of publicIds) expect(expert).not.toContain(id);
      const at = expert.indexOf("role.rank");
      expect(pub.slice(at, at + publicIds.length)).toEqual(publicIds);
      // Every other item is the same, in the same order.
      expect(pub.filter((id) => !publicIds.includes(id))).toEqual(expert.filter((id) => !EXPERT_BACKGROUND_IDS.includes(id)));
      // Revision (bf), 24 Oct 2026: the pre-session items are the same but for the professionals' `shift.recent` (EXPERT_ONLY_IDS).
      expect(questionnaireItems("pre", cell, undefined, { audience: "public", scope: "full" })).toEqual(questionnaireItems("pre", cell).filter((i) => !EXPERT_ONLY_IDS.includes(i.id)));
    }
    const options = (id: string) => { const item = PUBLIC_BACKGROUND_ITEMS.find((i) => i.id === id)!; return item.kind === "choice" ? item.options : []; };
    expect(options("public.management")).toEqual(["none", "team_lead", "manager", "executive"]);
    expect(options("public.responder")).toEqual(["none", "some", "professional"]);
  });

  it("every public item and option has its text in both languages; the public texts replace no expert item's text", () => {
    for (const lang of LANGS) {
      const items = studyTextFor(lang, { audience: "public", scope: "full" }).questionnaire.items;
      for (const item of PUBLIC_BACKGROUND_ITEMS) {
        expect(items[item.id]?.prompt).toBeTruthy();
        if (item.kind === "choice") for (const o of item.options) expect(items[item.id]!.options?.[o]).toBeTruthy();
      }
      for (const [id, text] of Object.entries(STUDY_TEXT[lang].questionnaire.items)) expect(items[id]).toEqual(text);
    }
  });

  it("a phase-A session is not asked about the directive (it ends before it is given)", () => {
    const ids = questionnaireItems("post", "reasoning_intent", undefined, { audience: "public", scope: "phaseA" }).map((i) => i.id);
    for (const id of ["retention.hinge", "ai.directive_relation", "directive.fit"]) expect(ids).not.toContain(id);
    const basis = questionnaireItems("post", "radio", undefined, { audience: "expert", scope: "phaseA" }).find((i) => i.id === "last.basis")!;
    expect(basis.kind === "multi" && basis.options.map((o) => o.id)).not.toContain("directive");
  });
});

describe("the public texts (SPEC/35 §4, §5)", () => {
  it("are the same for both groups: consent, debrief, mission card and chapters do not depend on the cell", () => {
    for (const lang of LANGS) for (const scope of ["full", "phaseA"] as const) {
      const texts = CELLS.map(() => studyTextFor(lang, { audience: "public", scope }));
      const debriefs = CELLS.map((cell, i) => texts[i]!.debrief.paragraphs(cell));
      for (const d of debriefs) expect(d).toEqual(debriefs[0]);
      expect(debriefTextId("radio", { audience: "public", scope })).toBe(debriefTextId("reasoning_intent", { audience: "public", scope }));
      // The expert debrief differs by cell (the Thinker sentence); the public one does not.
      expect(STUDY_TEXT[lang].debrief.paragraphs("radio")).not.toEqual(STUDY_TEXT[lang].debrief.paragraphs("reasoning_intent"));
    }
    expect(consentTextId("public")).not.toBe(consentTextId("expert"));
    expect(consentTextId()).toBe("consent.placeholder.v0");
    expect(debriefTextId("radio")).toBe("debrief.radio");
  });

  it("assume no fire-rescue background and keep the request not to discuss the session", () => {
    for (const lang of LANGS) for (const scope of ["full", "phaseA"] as const) {
      const t = studyTextFor(lang, { audience: "public", scope });
      const consent = t.consent.paragraphs.join(" ");
      expect(consent).not.toMatch(/wildfire commanders assess|maastopalon johtajat arvioivat|colleague|kollega/i);
      expect(t.consent.attestCheckbox).not.toMatch(/colleague|kollegoilta/i);
      expect(t.debrief.paragraphs("radio").at(-1)).toMatch(lang === "fi" ? /ettet kerro istunnon kulusta/ : /Please do not describe the session/);
      expect(t.consent.placeholderBanner).toBe(STUDY_TEXT[lang].consent.placeholderBanner);
    }
    expect(studyTextFor("en", { audience: "expert", scope: "full" })).toBe(STUDY_TEXT.en);
  });

  it("the debrief matches the scope: phase A's 4 of 7 periods and no directive; the full session's 7 of 14 and the directive", () => {
    expect(projectionHeldIn("phaseA")).toEqual({ held: 4, views: 7 });
    expect(projectionHeldIn("full")).toEqual({ held: 7, views: 14 });
    const a = studyTextFor("en", { audience: "public", scope: "phaseA" }).debrief.paragraphs("radio").join(" ");
    const full = studyTextFor("en", { audience: "public", scope: "full" }).debrief.paragraphs("radio").join(" ");
    expect(a).toContain("4 of the 7 periods");
    expect(a).not.toMatch(/directive/);
    expect(full).toContain("7 of the 14 periods");
    expect(full).toMatch(/directive/);
    expect(studyTextFor("fi", { audience: "public", scope: "phaseA" }).debrief.paragraphs("radio").join(" ")).toContain("4 jaksossa 7:stä");
  });

  it("the chapters: by the clock only, none for VP; a phase-A session has chapters 1 and 2", () => {
    expect([0, 1, 2, 3, 4, 7, 8, 11, 12, 14, 15].map(chapterOf)).toEqual([null, 1, 1, 1, 2, 2, 3, 3, 4, 4, null]);
    expect(chapterLabel("fi", 0)).toBeNull();
    expect(chapterLabel("fi", 5)).toBe("Luku 2 · Iltapäivä");
    expect(chapterLabel("en", 13)).toBe("Chapter 4 · Evening");
    for (const lang of LANGS) {
      expect(PUBLIC_TEXT[lang].mission.paragraphs.length).toBeGreaterThan(0);
      expect(PUBLIC_TEXT[lang].chapterTitles.join(" ")).not.toMatch(/\d|fire|palo|line|linja/i);
    }
    expect(PUBLIC_TEXT.en.mission.paragraphs[0]).toMatch(/^You are the incident commander/);
  });
});
