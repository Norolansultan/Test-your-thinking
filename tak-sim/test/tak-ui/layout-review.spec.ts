/**
 * The TAK shell after the review of 13 Oct 2026 (SPEC/28 §5): the message log stays on screen under Haku, the Thinker and
 * the index search; the directive is a full-width strip above the map, never over it, and still blanked by a freeze; a
 * forced situation question covers all of the map's chrome in both shells (the freeze and the tour stay above it); the
 * classic message log is unchanged; the toolbar's buttons have accessible names. Source checks and pure functions, as the
 * other TAK shell specs (no DOM in the test run); the screenshots in `docs/screenshots/fix-*.png` show the result.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { paneShowsLog, SEARCH_PANES, SEARCH_TOOL_SHARE_PCT, TAK_PANE_ORDER, toolbarButtonName } from "../../app/render/ui/tak/shell.js";
import { UI_TEXT } from "../../app/i18n/ui.js";

const raw = (f: string) => readFileSync(f, "utf8");
const code = (f: string) => raw(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
/** The source between two markers (both must be there). */
function between(src: string, from: string, to: string): string {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a + from.length);
  expect(a, from).toBeGreaterThanOrEqual(0);
  expect(b, to).toBeGreaterThan(a);
  return src.slice(a, b);
}

describe("the message log stays visible while a search tool is open", () => {
  it("Haku, the Thinker and the index search each sit over the whole log, the tool taking 55–60 % of the pane", () => {
    expect(SEARCH_TOOL_SHARE_PCT).toBeGreaterThanOrEqual(55);
    expect(SEARCH_TOOL_SHARE_PCT).toBeLessThanOrEqual(60);
    const s = code("app/render/ui/tak/SearchPanes.tsx");
    expect(s).toMatch(/<ToolOverLog snapshot=\{snapshot\}><HakuChat snapshot=\{snapshot\} orchestrator=\{orchestrator\} fill \/><\/ToolOverLog>/);
    expect(s).toMatch(/<ToolOverLog snapshot=\{snapshot\}><OpenAiChat snapshot=\{snapshot\} orchestrator=\{orchestrator\} fill \/><\/ToolOverLog>/);
    expect(s).toMatch(/<ToolOverLog snapshot=\{snapshot\}><div style=\{paneScroll\}><HakuPanel orchestrator=\{orchestrator\} freeText \/><\/div><\/ToolOverLog>/);
    // The tool on top with its share (all of its own height while locked), the log under it, the whole log.
    const wrap = between(s, "function ToolOverLog(", "export function HakuPane(");
    expect(wrap).toMatch(/flex: locked \? "0 0 auto" : `0 0 \$\{SEARCH_TOOL_SHARE_PCT\}%`/);
    expect(wrap.indexOf("<Locked locked={locked}>{children}</Locked>")).toBeLessThan(wrap.indexOf("<TakMessageLog log={snapshot.radioLog} />"));
  });

  it("the log under a tool is every message (all rooms), in the log's order, the newest in view and following new ones", () => {
    const g = code("app/render/ui/tak/GeoChatPane.tsx");
    const log = g.slice(g.indexOf("export function TakMessageLog("));
    expect(log).toMatch(/\{log\.map\(\(entry, index\) => <MessageLogRow key=\{index\} entry=\{entry\} wrapSource \/>\)\}/);
    expect(log).not.toMatch(/geoChatRooms|filter\(/);
    expect(log).toMatch(/useLayoutEffect\(\(\) => \{\s*const el = scrollRef\.current;\s*if \(el && atEnd\.current\) el\.scrollTop = el\.scrollHeight;\s*\}, \[log\.length\]\);/);
    expect(log).toMatch(/overflowY|paneScroll/); // it scrolls
    expect(log).toMatch(/data-tour="log"/); // the tour's log step finds it when a tool is open
  });

  it("the panes that show the log are GeoChat and the three search tools; the unread count and the tour target follow them", () => {
    for (const p of TAK_PANE_ORDER) expect(paneShowsLog(p), p).toBe(p === "geochat" || SEARCH_PANES.has(p));
    expect(paneShowsLog(null)).toBe(false);
    const t = code("app/render/ui/tak/TakSessionLayout.tsx");
    expect(t).toMatch(/useEffect\(\(\) => \{ if \(paneShowsLog\(pane\)\) setSeen\(snapshot\.radioLog\.length\); \}, \[pane, snapshot\.radioLog\.length\]\);/);
    expect(t).toMatch(/logTarget=\{!paneShowsLog\(pane\)\}/);
  });
});

describe("the directive: a full-width strip above the map, from V8, blanked by a freeze", () => {
  const t = code("app/render/ui/tak/TakSessionLayout.tsx");

  it("is drawn by the layout above the map's row, inside the blanked root, only when a directive is in force", () => {
    const root = t.indexOf('<div inert={frozen} aria-hidden={frozen} data-testid="tak-shell"');
    const strip = t.indexOf("{snapshot.directiveInForce !== null && <TakDirectiveStrip directive={snapshot.directiveInForce} />}");
    const row = t.indexOf('<div style={{ display: "flex", flexDirection: "row", flex: 1, minHeight: 0 }}>');
    const map = t.indexOf("<MapView ");
    expect(root).toBeGreaterThan(0);
    expect(strip).toBeGreaterThan(root);
    expect(row).toBeGreaterThan(strip);
    expect(map).toBeGreaterThan(row);
    // The root stacks the strip over the row (a column), and stays the freeze's blanked box.
    expect(between(t, 'data-testid="tak-shell"', "<style>")).toMatch(/flexDirection: "column"[\s\S]*visibility: frozen \? "hidden" : "visible"/);
  });

  it("is no longer map chrome: not inside the map, not positioned over it; the info card has no directive", () => {
    const inMap = between(t, "<MapView ", "</MapView>");
    expect(inMap).not.toMatch(/directive/i);
    expect(inMap).toMatch(/<TakInfoCard clockLabel=\{snapshot\.clockLabel\} wind=\{snapshot\.renderTree\.cycleInfo\?\.wind\} \/>/);
    const chrome = code("app/render/ui/tak/TakMapChrome.tsx");
    const card = between(chrome, "export function TakInfoCard(", "export function TakDirectiveStrip(");
    expect(card).not.toMatch(/directive/i);
    const strip = between(chrome, "export function TakDirectiveStrip(", "export function TakCoordReadout(");
    expect(strip).toMatch(/data-testid="directive-banner"/);
    expect(strip).not.toMatch(/position: "absolute"|zIndex|data-map-chrome/);
    expect(strip).toMatch(/\{t\.directiveBanner\}/); // the classic line's label
    expect(strip).toMatch(/\{tr\(directive\)\}/); // and its wording, unchanged
    expect(code("app/render/ui/components/RightPanel.tsx")).toMatch(/<div style=\{\{ fontSize: 12\.5, lineHeight: 1\.4 \}\}>\{tr\(snapshot\.directiveInForce\)\}<\/div>/);
  });

  it("its display is logged by the session as before (`directive_shown`), never by the shell", () => {
    for (const f of ["TakSessionLayout.tsx", "TakMapChrome.tsx"]) expect(code(`app/render/ui/tak/${f}`), f).not.toMatch(/directive_shown/);
    expect(code("app/session/orchestrator.ts")).toMatch(/if \(isStrategicGuidance\) await this\.event\(\{ kind: "directive_shown", detail: \{ view: index, messageId, clockLabel: cycleSpec\.clockLabel \} \}\);/);
  });
});

describe("a forced situation question covers all of the map's chrome, in both shells", () => {
  /** Every `zIndex: N` in a piece of source. */
  const zs = (src: string): number[] => [...src.matchAll(/zIndex: (\d+)/g)].map((m) => Number(m[1]));
  /** The z-index of the element whose markup starts at `marker`. */
  const zAt = (src: string, marker: string): number => zs(between(src, marker, "\n"))[0] ?? NaN;

  /** The map's chrome: everything with a z-index drawn inside MapView — its zoom buttons, the legend, the classic wind box,
   *  and the TAK shell's info card and coordinate readout (MapView's children). */
  function mapChrome(): Record<string, number> {
    const mv = code("app/render/ui/components/MapView.tsx");
    const tak = zs(code("app/render/ui/tak/TakMapChrome.tsx"));
    expect(tak).toHaveLength(2); // the info card and the readout
    expect(between(code("app/render/ui/tak/TakSessionLayout.tsx"), "<MapView ", "</MapView>")).toMatch(/<TakInfoCard [^>]*\/>\s*<TakCoordReadout [^>]*\/>/);
    return {
      zoom: zAt(mv, '<div data-tour="zoom"'),
      legend: zs(code("app/render/ui/components/Legend.tsx"))[0]!,
      wind: zs(code("app/render/ui/components/WindIndicator.tsx"))[0]!,
      takInfo: tak[0]!, takCoords: tak[1]!,
    };
  }

  it("finds the map's chrome (sanity: the comparison below is not vacuous)", () => {
    expect(mapChrome()).toEqual({ zoom: 20, legend: 20, wind: 20, takInfo: 21, takCoords: 21 });
    // The fire labels and unit markers stack below all of it (MapLibre markers, `MARKER_Z`).
    expect(code("app/render/ui/fire-layers.ts")).toMatch(/export const MARKER_Z = \{ overlay: 1, unit: 2, label: 3, spotLabel: 4, hover: 10 \} as const;/);
  });

  it("stacks map chrome < forced situation question < freeze screen < guided tour", () => {
    const spam = code("app/render/ui/components/SpamCard.tsx");
    const forced = zs(between(spam, "if (!spam.forced) return item;", "</div>"))[0]!;
    const freeze = zAt(code("app/render/ui/components/FreezeScreen.tsx"), '<div style={{ position: "absolute", inset: 0, background: "#0f1114"');
    const tour = zAt(code("app/render/ui/components/GuidedTour.tsx"), '<div role="dialog" aria-modal="true" aria-labelledby="tour-title"');
    expect({ forced, freeze, tour }).toEqual({ forced: 25, freeze: 30, tour: 1000 });
    for (const [name, z] of Object.entries(mapChrome())) expect(z, name).toBeLessThan(forced);
    expect(forced).toBeLessThan(freeze); // a freeze may interrupt the question: it stays on top
    expect(freeze).toBeLessThan(tour);
  });

  it("none of them makes a stacking context that would trap its children (all compare in the page's own stacking order)", () => {
    // The map's root is positioned without a z-index, isolation, transform or opacity: its chrome's z-index counts in the
    // same stacking context as the forced item's overlay (a sibling after the map in the same column).
    const root = between(code("app/render/ui/components/MapView.tsx"), "  return (\n    <div style={{ position: \"relative\", flex: 1, minHeight: MAP_MIN_HEIGHT_PX", "\n");
    expect(root).not.toMatch(/zIndex|isolation|transform|opacity|filter/);
    for (const f of ["app/render/ui/tak/TakSessionLayout.tsx", "app/render/ui/components/SessionView.tsx"]) {
      const src = code(f);
      const map = src.indexOf("<MapView "), spam = src.indexOf("<SpamCard spam={snapshot.spam}");
      expect(map, f).toBeGreaterThan(0);
      expect(spam, f).toBeGreaterThan(map);
    }
  });
});

describe("the classic message log is unchanged", () => {
  it("the classic log draws the shared row without the TAK shell's wrapping; the row wraps only when asked", () => {
    const rp = code("app/render/ui/components/RightPanel.tsx");
    expect(rp).toMatch(/\{snapshot\.radioLog\.map\(\(entry, i\) => <MessageLogRow key=\{i\} entry=\{entry\} \/>\)\}/);
    expect(rp).toMatch(/export function MessageLogRow\(\{ entry, wrapSource = false \}/);
    // The source column as before the TAK shell (`{ fontWeight: 600, fontFamily: "monospace" }`), plus nothing unless asked.
    expect(rp).toMatch(/<div style=\{\{ fontWeight: 600, fontFamily: "monospace", \.\.\.\(wrapSource \? \{ overflowWrap: "anywhere" as const \} : \{\}\) \}\}>\{src\(entry\.from\)\}<\/div>/);
    expect(rp.match(/overflowWrap/g)).toHaveLength(1);
  });
});

describe("accessible names", () => {
  it("every toolbar button is named by its visible label first, then the pane's title, then GeoChat's unread count", () => {
    expect(toolbarButtonName("R&B", "Range & Bearing", null)).toBe("R&B, Range & Bearing");
    expect(toolbarButtonName("GeoChat", "GeoChat", "3 new messages")).toBe("GeoChat, 3 new messages");
    expect(toolbarButtonName("Thinker", "Thinker", null)).toBe("Thinker");
    for (const lang of ["fi", "en"] as const) {
      const T = UI_TEXT[lang].tak;
      for (const p of TAK_PANE_ORDER) {
        const name = toolbarButtonName(T.toolbar[p], T.paneTitle[p], null);
        expect(name.startsWith(T.toolbar[p]), `${lang} ${p}`).toBe(true);
        expect(name).toContain(T.paneTitle[p]);
      }
    }
    const bar = code("app/render/ui/tak/TakToolbar.tsx");
    expect(bar).toMatch(/aria-label=\{toolbarButtonName\(t\.tak\.toolbar\[p\], t\.tak\.paneTitle\[p\], badge \? t\.tak\.geochat\.unread\(unread\) : null\)\}/);
    expect(bar).toMatch(/data-testid="tak-unread" aria-hidden="true"/); // its count is in the button's name
    expect(bar).toMatch(/\{TAK_PANE_ICON\[p\]\}/);
    expect(raw("app/render/ui/tak/TakToolbar.tsx")).toMatch(/aria-hidden="true">\{body\}<\/svg>/); // icons are decoration
  });
});
