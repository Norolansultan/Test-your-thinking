import { createContext } from "preact";
import { useContext, useEffect } from "preact/hooks";
import { DEFAULT_LANG, type Lang } from "../../i18n/lang.js";
import { recordIn, sourceName, tr } from "../../i18n/text.js";
import { UI_TEXT } from "../../i18n/ui.js";

/** The session language for every component under `SessionView` (`app/i18n/lang.ts`). */
export const LangContext = createContext<Lang>(DEFAULT_LANG);

/**
 * The page's declared language and the browser tab's title follow the session language (final review,
 * 6 Oct 2026): `index.html` is static, so an English session otherwise ran under `lang="fi"` and a
 * Finnish tab title — and a browser may offer to "translate from Finnish", rewriting the page.
 */
export function useDocumentLanguage(lang: Lang): void {
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = UI_TEXT[lang].pageTitle;
  }, [lang]);
}

/** The language, its interface strings (`t`), scenario labels (`tr`), record texts (`rec`) and source names (`src`). */
export function useLang() {
  const lang = useContext(LangContext);
  return {
    lang,
    t: UI_TEXT[lang],
    tr: (fi: string) => tr(lang, fi),
    rec: (id: string | undefined, fi: string) => (id ? recordIn(lang, id, fi) : tr(lang, fi)),
    src: (sourceId: string) => sourceName(lang, sourceId),
  };
}
