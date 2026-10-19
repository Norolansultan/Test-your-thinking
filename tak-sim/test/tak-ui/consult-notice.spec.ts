/**
 * SPEC/30 §4 in the TAK shell: the consult notification beside its tool's toolbar button (Haku's, or the Thinker's), the
 * same component as the classic shell; its button opens that pane once `consult_prompt_opened` is durable (and leaves it
 * open if it is); the Thinker pane carries the guide's chip because it shows the classic Thinker chat unchanged.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { consultNoticeTop, consultPaneOf, takToolbarPanes } from "../../app/render/ui/tak/shell.js";
import { TAK } from "../../app/render/ui/tak/theme.js";

const layout = readFileSync("app/render/ui/tak/TakSessionLayout.tsx", "utf8");

describe("the consult notification in the TAK shell (SPEC/30 §4)", () => {
  it("names the pane its button opens: Haku's for the Haku group, the Thinker's for the guide group", () => {
    expect(consultPaneOf("haku")).toBe("haku");
    expect(consultPaneOf("thinker")).toBe("thinker");
    expect(takToolbarPanes("directed", { indexedSearch: false })).toContain(consultPaneOf("haku"));
    expect(takToolbarPanes("substitutive", { indexedSearch: false })).toContain(consultPaneOf("thinker"));
  });

  it("sits level with its tool's button (the toolbar's padding, then a button and its gap per button above)", () => {
    const ai = takToolbarPanes("substitutive", { indexedSearch: false });
    const haku = takToolbarPanes("directed", { indexedSearch: false });
    expect(consultNoticeTop(haku, "haku", TAK.toolButtonHeight)).toBe(6 + haku.indexOf("haku") * (TAK.toolButtonHeight + 2));
    expect(consultNoticeTop(ai, "thinker", TAK.toolButtonHeight)).toBe(6 + ai.indexOf("thinker") * (TAK.toolButtonHeight + 2));
    expect(consultNoticeTop(ai, "thinker", 60)).toBeGreaterThan(consultNoticeTop(ai, "haku", 60));
  });

  it("is the shared component, left of the toolbar, opening its pane after the record (cause toolbar), never toggling it shut", () => {
    expect(layout).toMatch(/import \{ ConsultNotice \} from "\.\.\/components\/ConsultNotice\.js";/);
    expect(layout).toMatch(/snapshot\.consultPrompt && \(\s*<ConsultNotice prompt=\{snapshot\.consultPrompt\} text=\{t\.consult\} onOpen=\{openConsult\}/);
    expect(layout).toMatch(/position: "absolute", right: TAK\.toolbarWidth \+ 8, top: consultNoticeTop\(panes, snapshot\.consultPrompt\.tool, TAK\.toolButtonHeight\)/);
    expect(layout).toMatch(/orchestrator\.openConsultPrompt\(\)\.then\(\(consulted\) => \{/);
    expect(layout).toMatch(/if \(panes\.includes\(target\) && paneRef\.current !== target\) choosePane\(target, "toolbar"\)/);
    expect(layout).toMatch(/orchestrator\.dismissConsultPrompt\(\)/);
  });

  it("the Thinker pane is the classic Thinker chat, so the guide's chip comes with it", () => {
    const panes = readFileSync("app/render/ui/tak/SearchPanes.tsx", "utf8");
    expect(panes).toMatch(/<OpenAiChat snapshot=\{snapshot\} orchestrator=\{orchestrator\} fill \/>/);
  });
});
