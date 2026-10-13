import { useEffect, useRef, useState } from "preact/hooks";
import type { MapUseEvent } from "../../../session/orchestrator.js";
import { useLang } from "../i18n.js";

/**
 * Minimum window size (SPEC/12 revision (al), 10 Oct 2026). Below it the map is too small for its labels and symbols
 * to be placed the same way for everyone (V13's US2 label depended on the window size), so a cover asks the
 * participant to enlarge the window. The session is not paused: the cover is logged (`window_size_warning`, shown
 * and removed, with the window's size) and the analysis can account for the time. 1280 × 529 (a laptop with the
 * browser's bars) is above the minimum.
 */
export const MIN_WINDOW = { width: 1100, height: 500 } as const;

export const WINDOW_SIZE_TEXT = {
  fi: { title: "Suurenna selainikkunaa", body: `Tutkimus tarvitsee vähintään ${MIN_WINDOW.width} × ${MIN_WINDOW.height} pikselin ikkunan, jotta kartta näkyy oikein. Suurenna ikkunaa tai sulje sivupalkit; tämä ilmoitus poistuu itsestään.` },
  en: { title: "Please enlarge the browser window", body: `The study needs a window of at least ${MIN_WINDOW.width} × ${MIN_WINDOW.height} pixels so that the map is shown correctly. Enlarge the window or close side bars; this notice goes away by itself.` },
} as const;

export function tooSmall(width: number, height: number): boolean {
  return width < MIN_WINDOW.width || height < MIN_WINDOW.height;
}

export function WindowSizeGuard({ onLog }: { readonly onLog?: (event: MapUseEvent) => Promise<number> }) {
  const { lang } = useLang();
  const size = () => ({ width: typeof window === "undefined" ? 1280 : window.innerWidth, height: typeof window === "undefined" ? 720 : window.innerHeight });
  const [small, setSmall] = useState(() => { const s = size(); return tooSmall(s.width, s.height); });
  const logged = useRef<boolean | null>(null);
  useEffect(() => {
    const check = () => {
      const s = size();
      const next = tooSmall(s.width, s.height);
      setSmall(next);
      if (logged.current === next || (logged.current === null && !next)) return; // log changes, and the first state only if too small
      logged.current = next;
      void onLog?.({ kind: "window_size_warning", detail: { shown: next, width: s.width, height: s.height, minWidth: MIN_WINDOW.width, minHeight: MIN_WINDOW.height } }).catch(() => undefined);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  if (!small) return null;
  const T = WINDOW_SIZE_TEXT[lang === "en" ? "en" : "fi"];
  return (
    <div role="alertdialog" aria-label={T.title} data-testid="window-size-guard"
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "#12151af2", color: "#e8eaed", padding: 24 }}>
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{T.title}</div>
        <div style={{ fontSize: 14, lineHeight: 1.45 }}>{T.body}</div>
      </div>
    </div>
  );
}
