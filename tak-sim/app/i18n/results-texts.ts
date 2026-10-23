/**
 * The texts of the step "Personal results after the study" (SPEC/36, 23 Oct 2026) and the debrief's paragraph on them, fi and en.
 * The same in every session: both audiences, every cell (the step must not differ between the groups). DRAFT: the Finnish awaits
 * the native check, and the data-protection wording the ethics board (SPEC/36 §7); the placeholder line says so on screen.
 *
 * Nothing here names the scenario, an item or an answer; the step asks for an address only, and only with the explicit consent.
 */

import type { Lang } from "./lang.js";

export interface ResultsOptInText {
  readonly title: string;
  readonly paragraphs: readonly string[];
  /** The ethics board's part, marked on screen as a placeholder. */
  readonly placeholderNote: string;
  readonly emailLabel: string;
  readonly consentCheckbox: string;
  readonly send: string;
  readonly skip: string;
  readonly sending: string;
  readonly invalidEmail: string;
  readonly failed: string;
  readonly retry: string;
  readonly continueWithout: string;
}

const EN: ResultsOptInText = {
  title: "Personal results after the study",
  paragraphs: [
    "Would you like your own results? After the study has closed, we can send you a short personal report: your commander profile (how well your confidence matched your answers, how often you checked before deciding, and how you used the tools), a few development tips chosen from your profile, and how your pattern compares with other participants with a similar background and with experienced commanders.",
    "The report is sent only after data collection has closed, so that nothing about the exercise reaches people who have not yet taken part. It never shows which answers were right or wrong.",
    "The report is for you only. If your organisation or school takes part, it receives group results only, never yours.",
    "Your email address is stored separately from your answers, used only to send this report, and deleted after sending. Giving it is voluntary and changes nothing else in the study.",
  ],
  placeholderNote: "[PLACEHOLDER, ethics board: who holds the contact details and by when they are deleted.]",
  emailLabel: "Email address",
  consentCheckbox: "Send my personal results to this address after the study closes. My address is stored separately from my answers and deleted after sending.",
  send: "Send me my results",
  skip: "Skip",
  sending: "Saving…",
  invalidEmail: "Please check the address.",
  failed: "Your address could not be saved right now (there is no connection to the study server). Your answers are safe. You can try again, or continue without personal results.",
  retry: "Try again",
  continueWithout: "Continue without results",
};

// DRAFT (SPEC/36 §7): native check.
const FI: ResultsOptInText = {
  title: "Henkilökohtaiset tulokset tutkimuksen jälkeen",
  paragraphs: [
    "Haluatko omat tuloksesi? Kun tutkimus on päättynyt, voimme lähettää sinulle lyhyen henkilökohtaisen raportin: johtajaprofiilisi (kuinka hyvin varmuutesi vastasi vastauksiasi, kuinka usein tarkistit tietoja ennen päätöstä ja miten käytit työkaluja), muutaman profiilisi perusteella valitun kehittymisvinkin sekä vertailun muihin samantaustaisiin osallistujiin ja kokeneisiin johtajiin.",
    "Raportti lähetetään vasta, kun aineistonkeruu on päättynyt, jotta harjoituksen sisältö ei kulkeudu niille, jotka eivät ole vielä osallistuneet. Raportti ei koskaan kerro, mitkä vastaukset olivat oikein tai väärin.",
    "Raportti on vain sinua varten. Jos organisaatiosi tai oppilaitoksesi osallistuu, se saa vain ryhmätason tuloksia, ei koskaan sinun tuloksiasi.",
    "Sähköpostiosoitteesi tallennetaan erillään vastauksistasi, sitä käytetään vain tämän raportin lähettämiseen, ja se poistetaan lähettämisen jälkeen. Osoitteen antaminen on vapaaehtoista eikä muuta tutkimuksessa mitään muuta.",
  ],
  placeholderNote: "[PAIKKAMERKKI, eettinen toimikunta: kuka yhteystiedot säilyttää ja mihin mennessä ne poistetaan.]",
  emailLabel: "Sähköpostiosoite",
  consentCheckbox: "Lähettäkää henkilökohtaiset tulokseni tähän osoitteeseen, kun tutkimus on päättynyt. Osoitteeni tallennetaan erillään vastauksistani ja poistetaan lähettämisen jälkeen.",
  send: "Lähetä minulle tulokseni",
  skip: "Ohita",
  sending: "Tallennetaan…",
  invalidEmail: "Tarkista osoite.",
  failed: "Osoitettasi ei voitu tallentaa juuri nyt (yhteyttä tutkimuksen palvelimeen ei ole). Vastauksesi ovat tallessa. Voit yrittää uudelleen tai jatkaa ilman henkilökohtaisia tuloksia.",
  retry: "Yritä uudelleen",
  continueWithout: "Jatka ilman tuloksia",
};

export const RESULTS_OPTIN_TEXT: Readonly<Record<Lang, ResultsOptInText>> = { fi: FI, en: EN };

/**
 * The debrief's paragraph on personal results (SPEC/36 item 6), the same in every debrief (expert and public, every cell and scope),
 * placed before the closing request not to discuss the session. It does not depend on the participant's answer on the step.
 */
export const RESULTS_DEBRIEF_PARAGRAPH: Readonly<Record<Lang, string>> = {
  fi: "Jos pyysit henkilökohtaiset tuloksesi, ne lähetetään antamaasi osoitteeseen vasta, kun tutkimus on päättynyt, ei sitä ennen. Osoitteesi säilytetään erillään vastauksistasi ja poistetaan lähettämisen jälkeen.",
  en: "If you asked for your personal results, they will be sent to the address you gave after the study has closed, not before. Your address is kept apart from your answers and deleted after sending.",
};
