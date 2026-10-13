/**
 * SPEC/28 §5: the TAK shell is the default screen of this build; `?klassinen` (or `?classic`) gives the classic layout
 * of SPEC/06. The shell is chosen on the start page from the URL, threaded through the launcher into `SessionView`, and
 * logged in the header (`uiShell`) through the launcher's annotations; a resumed session keeps the shell its header names.
 * The toolbar offers the Thinker only where the capability matrix gives the AI tool — never to the Haku group.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLASSIC_SHELL_PARAMS, SEARCH_PANES, tabToolOf, takToolbarPanes, TAK_PANE_ORDER, uiShellFromSearch } from "../../app/render/ui/tak/shell.js";
import { CAPABILITY_MATRIX } from "../../app/routing/capability-matrix.js";

const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

describe("shell selection from the URL", () => {
  it("is the TAK shell by default: no parameter, a demonstration cell, the study link, a preview", () => {
    for (const q of ["", "?", "?solu=t2", "?solu=k4&esikatselu=12", "?tuotanto&koodi=ABC123", "?tuotanto", "?tak"]) expect(uiShellFromSearch(q), q).toBe("tak");
  });

  it("is the classic layout with ?klassinen or ?classic, with or without a value, anywhere in the query", () => {
    expect([...CLASSIC_SHELL_PARAMS]).toEqual(["klassinen", "classic"]);
    for (const q of ["?klassinen", "?classic", "?klassinen=1", "?solu=m7&klassinen", "?tuotanto&koodi=X&classic=", "?esikatselu=12&classic"]) expect(uiShellFromSearch(q), q).toBe("classic");
  });

  it("is not fooled by look-alikes", () => {
    for (const q of ["?klassinenx", "?solu=klassinen", "?xclassic"]) expect(uiShellFromSearch(q), q).toBe("tak");
  });
});

describe("the shell is threaded from the start page to the screen (source)", () => {
  it("App reads it from the URL and hands it to the launcher", () => {
    expect(code("app/render/ui/App.tsx")).toMatch(/uiShell=\{uiShellFromSearch\(search\)\}/);
  });

  it("the launcher annotates the header with it, and a resume keeps the header's (a log from before the TAK shell was classic)", () => {
    const l = code("app/render/ui/SessionLauncher.tsx");
    expect(l).toMatch(/const annotations = \{ \.\.\.sessionAnnotations\(props\.scenario, browserEnvironment\(\), props\.sessionId\), uiShell: props\.uiShell \};/);
    expect(l).toMatch(/readonly uiShell: UiShell;/);
    expect(l).toMatch(/uiShell=\{header\.uiShell \?\? "classic"\}/);
    expect(l).toMatch(/<SessionView \{\.\.\.props\} guidedTour persistence=\{persistence\} \/>/);
  });

  it("SessionView draws the TAK layout or the classic one, never both; the status strip, tour, freeze and window guard serve both", () => {
    const v = code("app/render/ui/components/SessionView.tsx");
    expect(v).toMatch(/uiShell = "tak"/);
    expect(v).toMatch(/\{uiShell === "tak" && \(\s*<TakSessionLayout/);
    expect(v).toMatch(/\{uiShell === "classic" && <div inert=\{frozen\}/);
    const tak = v.indexOf("<TakSessionLayout"), strip = v.indexOf("<StatusStrip"), guard = v.indexOf("<WindowSizeGuard"), tour = v.indexOf("<GuidedTour"), freeze = v.indexOf("<FreezeScreen");
    for (const i of [strip, guard, tour, freeze]) expect(i).toBeGreaterThan(0);
    for (const i of [strip, guard, tour, freeze]) expect(i).toBeLessThan(tak);
    // The TAK layout gets the blanking flag and the held plan draft, as the classic column does.
    expect(v).toMatch(/<TakSessionLayout[^>]*frozen=\{frozen\}/);
    expect(v).toMatch(/planDraft=\{heldPlanDraft\(plan, snapshot\.currentCycle\)\} onPlanDraft=\{\(draft\) => setPlan\(\{ view: snapshot\.currentCycle, draft \}\)\} \/>/);
  });

  it("the TAK layout keeps the decision strip exactly as the classic column has it", () => {
    const t = code("app/render/ui/tak/TakSessionLayout.tsx");
    expect(t).toMatch(/snapshot\.visibleProbe && \(\s*<VisibleProbeCard probe=\{snapshot\.visibleProbe\} orchestrator=\{orchestrator\} \/>/);
    expect(t).toMatch(/\{snapshot\.spam && <SpamCard spam=\{snapshot\.spam\} orchestrator=\{orchestrator\} \/>\}/);
    expect(t).toMatch(/<div inert=\{snapshot\.decisionHeld\} aria-hidden=\{snapshot\.decisionHeld\} style=\{\{ display: snapshot\.visibleProbe \? "none" : "flex", flexDirection: "column", flexShrink: 0, opacity: snapshot\.decisionHeld \? 0\.45 : 1 \}\}>/);
    expect(t).toMatch(/<JudgementPanel snapshot=\{snapshot\} orchestrator=\{orchestrator\} planDraft=\{planDraft\} onPlanDraft=\{onPlanDraft\} \/>/);
    // A forced SPAM item covers the map column: the column is its positioning parent, as in the classic layout.
    expect(t).toMatch(/flexDirection: "column", minWidth: 0, position: "relative"/);
    // Blanking: invisible and unreachable during a freeze, but mounted (the map is not rebuilt).
    expect(t).toMatch(/<div inert=\{frozen\} aria-hidden=\{frozen\} data-testid="tak-shell"/);
    expect(t).toMatch(/visibility: frozen \? "hidden" : "visible"/);
  });
});

describe("the toolbar: the Thinker only where the capability matrix gives the AI tool", () => {
  it("the Haku group (directed) has no Thinker button; the AI group (substitutive) has one", () => {
    expect(CAPABILITY_MATRIX.directed.aiDrawerPresent).toBe(false);
    expect(takToolbarPanes("directed", { indexedSearch: false })).not.toContain("thinker");
    expect(takToolbarPanes("directed", { indexedSearch: true })).not.toContain("thinker");
    expect(takToolbarPanes("substitutive", { indexedSearch: false })).toContain("thinker");
  });

  it("everyone has the TAK tools and Haku, in ATAK's order; the index search only in a demonstration", () => {
    expect(takToolbarPanes("directed", { indexedSearch: false })).toEqual(["overlays", "contacts", "geochat", "video", "range_bearing", "haku"]);
    expect(takToolbarPanes("substitutive", { indexedSearch: true })).toEqual([...TAK_PANE_ORDER]);
    expect(takToolbarPanes("directed", { indexedSearch: true })).toEqual(["overlays", "contacts", "geochat", "video", "range_bearing", "haku", "indexed_search"]);
  });

  it("the Thinker pane can open only through the toolbar's panes (the tour's Thinker step checks it too)", () => {
    const t = code("app/render/ui/tak/TakSessionLayout.tsx");
    expect(t).toMatch(/const panes = takToolbarPanes\(condition, \{ indexedSearch \}\);/);
    expect(t).toMatch(/\(e as CustomEvent\)\.detail === "ai" && panes\.includes\("thinker"\)/);
    expect(t).toMatch(/<TakToolbar panes=\{panes\}/);
    expect(code("app/render/ui/tak/TakToolbar.tsx")).toMatch(/\{panes\.map\(\(p\) => \{/);
  });

  it("the search tools are the ones a visible probe locks, and they keep the classic tab record", () => {
    expect([...SEARCH_PANES].sort()).toEqual(["haku", "indexed_search", "thinker"]);
    expect(tabToolOf("haku")).toBe("haku");
    expect(tabToolOf("thinker")).toBe("open_thinker");
    expect(tabToolOf("indexed_search")).toBe("indexed_search");
    expect(tabToolOf(null)).toBe("none");
    for (const p of ["overlays", "contacts", "geochat", "video", "range_bearing"] as const) expect(tabToolOf(p)).toBeNull();
    expect(code("app/render/ui/tak/TakToolbar.tsx")).toMatch(/const disabled = searchLocked && SEARCH_PANES\.has\(p\);/);
  });

  it("the Haku and Thinker panes show the classic right panel's own components", () => {
    const s = code("app/render/ui/tak/SearchPanes.tsx");
    expect(s).toMatch(/import \{ HakuChat, OpenAiChat \} from "\.\.\/components\/RightPanel\.js";/);
    expect(s).toMatch(/<HakuChat snapshot=\{snapshot\} orchestrator=\{orchestrator\} fill \/>/);
    expect(s).toMatch(/<OpenAiChat snapshot=\{snapshot\} orchestrator=\{orchestrator\} fill \/>/);
  });
});
