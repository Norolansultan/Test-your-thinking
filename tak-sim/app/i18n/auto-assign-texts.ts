/**
 * The shared study link's start-page messages (revision (af), 9 Oct 2026; `app/session/auto-assign.ts`).
 * Kept apart from `ui.ts`. The "not active" message is shown in both languages at once: it appears
 * before any session language is fixed, and the participant must be able to read it either way.
 */

import type { Lang } from "./lang.js";

export const LINK_INACTIVE_BOTH = [
  "Tämä linkki ei ole käytössä. Ota yhteyttä tutkijaan.",
  "This link is not active; please contact the researcher.",
] as const;

export const AUTO_ASSIGN_TEXT: Readonly<Record<Lang, { readonly assigning: string; readonly alreadyDone: string }>> = {
  fi: {
    assigning: "Valmistellaan istuntoa…",
    alreadyDone: "Tällä selaimella on jo tehty tämän linkin tutkimusistunto. Kiitos osallistumisesta! Jos tämä on virhe, ota yhteyttä tutkijaan.",
  },
  en: {
    assigning: "Preparing the session…",
    alreadyDone: "This browser has already completed the study session for this link. Thank you for taking part! If this is a mistake, please contact the researcher.",
  },
};
