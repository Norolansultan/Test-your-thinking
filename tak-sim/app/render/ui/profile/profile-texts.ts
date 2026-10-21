/**
 * The commander profile's texts (SPEC/35 §4), fi and en. DRAFT (SPEC/35 §8 item 2): the Finnish needs the native check, and the
 * interpretations and tips a domain read. Every text is GENERIC: what a pattern means in general and how to work on it, never a fact
 * of the scenario, an item, a key or a correct answer (`test/profile/profile-leak.spec.ts` scans them against the freeze banks).
 * Numbers are formatted by hand (no `Intl`: the determinism lint covers app/).
 */

import type { CalibrationBand, CheckingBand, ResolutionBand } from "../../../telemetry/profile.js";

export type ProfileLang = "fi" | "en";

export interface CardTexts {
  readonly title: string;
  readonly notEnough: string;
  readonly unavailable: string;
}

export interface ProfileTexts {
  readonly title: string;
  readonly intro: string;
  readonly privacyNote: string;
  readonly continue: string;
  readonly expertPending: string;
  readonly expertMedian: (value: string) => string;
  readonly yourValue: string;
  readonly meaning: string;
  readonly tip: string;
  readonly calibration: CardTexts & {
    readonly values: (meanConfidence: string, percentCorrect: string) => string;
    readonly band: Readonly<Record<CalibrationBand, string>>;
    readonly resolution: Readonly<Record<ResolutionBand, string>>;
    readonly resolutionNotEnough: string;
    readonly resolutionCaveat: string;
    readonly meaningOf: Readonly<Record<CalibrationBand, string>>;
    readonly tipOf: Readonly<Record<CalibrationBand, string>>;
    readonly gap: (points: string) => string;
  };
  readonly checking: CardTexts & {
    readonly values: (checked: number, decisions: number, percent: string) => string;
    readonly band: Readonly<Record<CheckingBand, string>>;
    readonly latency: (duration: string) => string;
    readonly meaningOf: Readonly<Record<CheckingBand, string>>;
    readonly tip: string;
  };
  readonly toolUse: CardTexts & {
    readonly haku: (n: number) => string;
    readonly guide: (n: number) => string;
    readonly reviews: (changed: number, shown: number) => string;
    readonly noReviews: string;
    readonly meaning: string;
    readonly tip: string;
  };
  readonly percent: (value: number) => string;
  readonly duration: (seconds: number) => string;
}

/** Plain units: under a minute to the nearest 5 s, then to the nearest minute. */
function duration(seconds: number, units: { readonly under5: string; readonly s: (n: number) => string; readonly min: (n: number) => string }): string {
  if (seconds < 5) return units.under5;
  if (seconds < 60) return units.s(Math.min(55, Math.round(seconds / 5) * 5));
  return units.min(Math.round(seconds / 60));
}

const EN: ProfileTexts = {
  title: "Your commander profile",
  intro: "This page describes how you worked during the exercise: how well your confidence matched your answers, how often you checked before acting, and how you used the tools.",
  privacyNote: "This profile is for you only. It is not a test score, and it does not show which of your answers were right or wrong.",
  continue: "Continue",
  expertPending: "Comparison with experienced commanders: available after the expert study.",
  expertMedian: (value) => `Experienced commanders (median): ${value}`,
  yourValue: "Your pattern",
  meaning: "What it means",
  tip: "One thing to try",
  calibration: {
    title: "Calibration",
    notEnough: "Not enough answers to say.",
    unavailable: "This part could not be worked out from your session.",
    values: (c, p) => `Your average confidence was ${c}; ${p} of your answers were correct.`,
    gap: (points) => `Difference: ${points} percentage points.`,
    band: { well: "Well calibrated", over: "More confident than accurate", under: "Less confident than accurate" },
    resolution: {
      higher_when_right: "You tended to be more confident when you were right than when you were wrong.",
      about_same: "Your confidence was about the same whether you were right or wrong.",
      higher_when_wrong: "You tended to be more confident when you were wrong than when you were right.",
    },
    resolutionNotEnough: "There were too few right or wrong answers to say whether your confidence told them apart.",
    resolutionCaveat: "With a few dozen answers this is only a rough indication.",
    meaningOf: {
      well: "People who are well calibrated know when they don't know: their confidence is a signal others can rely on.",
      over: "Feeling surer than the facts allow is common when information is incomplete. It can make us stop looking too early.",
      under: "You knew more than you gave yourself credit for. Caution is safer than overconfidence, but it can slow decisions or make us defer to others too readily.",
    },
    tipOf: {
      well: "Keep asking yourself what would change your mind, and say how sure you are when you report.",
      over: "Before you commit, name one thing that could prove you wrong, and check it.",
      under: "When you have checked the facts, trust them a little more: state your judgement and the reason for it.",
    },
  },
  checking: {
    title: "Checking",
    notEnough: "Too few decisions to say.",
    unavailable: "This part could not be worked out from your session.",
    values: (k, n, p) => `You looked something up before acting in ${k} of ${n} decisions (${p}).`,
    band: { often: "Checked often", sometimes: "Checked sometimes", rarely: "Checked rarely" },
    latency: (d) => `When you did, your first look-up came ${d} into the period.`,
    meaningOf: {
      often: "Checking before acting catches changes before they become surprises. It is what careful decision makers do when the situation moves.",
      sometimes: "You checked in some decisions and not in others. Under time pressure, people tend to check when something feels off, and that can miss quiet changes.",
      rarely: "Acting on the picture you already have is fast, but a situation can change without anything feeling different.",
    },
    tip: "Before you commit, take a short look at what has changed since your last decision.",
  },
  toolUse: {
    title: "Tool use",
    notEnough: "Not enough to say.",
    unavailable: "This part could not be worked out from your session.",
    haku: (n) => `Searches in Search (Haku): ${n}`,
    guide: (n) => `Questions to the Thinker: ${n}`,
    reviews: (k, n) => `You changed your plan at ${k} of ${n} plan reviews.`,
    noReviews: "Your session had no plan reviews.",
    meaning: "More questions are not better or worse in themselves. Tools help most when you know what you need to find out, and a changed plan is a strength when new information calls for it.",
    tip: "Ask one focused question about the thing your next decision depends on.",
  },
  percent: (v) => `${Math.round(v)}%`,
  duration: (s) => duration(s, { under5: "within 5 seconds", s: (n) => `about ${n} seconds`, min: (n) => `about ${n} minute${n === 1 ? "" : "s"}` }),
};

// DRAFT (SPEC/35 §8 item 2, 21 Oct 2026): native check.
const FI: ProfileTexts = {
  title: "Johtajaprofiilisi",
  intro: "Tällä sivulla kuvataan, miten työskentelit harjoituksen aikana: kuinka hyvin varmuutesi vastasi vastauksiasi, kuinka usein tarkistit tietoja ennen toimintaa ja miten käytit työkaluja.",
  privacyNote: "Profiili on vain sinua varten. Se ei ole koetulos, eikä se kerro, mitkä vastauksistasi olivat oikein tai väärin.",
  continue: "Jatka",
  expertPending: "Vertailu kokeneisiin johtajiin: saatavilla asiantuntijatutkimuksen jälkeen.",
  expertMedian: (value) => `Kokeneet johtajat (mediaani): ${value}`,
  yourValue: "Toimintatapasi",
  meaning: "Mitä se tarkoittaa",
  tip: "Kokeile tätä",
  calibration: {
    title: "Kalibrointi",
    notEnough: "Vastauksia on liian vähän arvion tekemiseen.",
    unavailable: "Tätä osaa ei voitu laskea istunnostasi.",
    values: (c, p) => `Keskimääräinen varmuutesi oli ${c}; vastauksistasi ${p} oli oikein.`,
    gap: (points) => `Ero: ${points} prosenttiyksikköä.`,
    band: { well: "Hyvin kalibroitu", over: "Varmempi kuin osuva", under: "Osuvampi kuin varma" },
    resolution: {
      higher_when_right: "Olit yleensä varmempi silloin, kun vastasit oikein, kuin silloin, kun vastasit väärin.",
      about_same: "Varmuutesi oli suunnilleen sama, vastasitpa oikein tai väärin.",
      higher_when_wrong: "Olit yleensä varmempi silloin, kun vastasit väärin, kuin silloin, kun vastasit oikein.",
    },
    resolutionNotEnough: "Oikeita tai vääriä vastauksia oli liian vähän sen arvioimiseen, erottiko varmuutesi ne toisistaan.",
    resolutionCaveat: "Muutaman kymmenen vastauksen perusteella tämä on vain suuntaa antava.",
    meaningOf: {
      well: "Hyvin kalibroitunut ihminen tietää, milloin ei tiedä: hänen varmuuteensa voi luottaa.",
      over: "Tunne siitä, että tietää enemmän kuin tiedot kertovat, on tavallinen, kun tieto on puutteellista. Se voi saada lopettamaan tiedonhaun liian aikaisin.",
      under: "Tiesit enemmän kuin annoit itsellesi tunnustusta. Varovaisuus on turvallisempaa kuin liika varmuus, mutta se voi hidastaa päätöksiä tai saada nojaamaan muihin liian helposti.",
    },
    tipOf: {
      well: "Kysy itseltäsi jatkossakin, mikä muuttaisi käsitystäsi, ja kerro raportoidessasi, kuinka varma olet.",
      over: "Nimeä ennen päätöstä yksi asia, joka voisi osoittaa sinut vääräksi, ja tarkista se.",
      under: "Kun olet tarkistanut tiedot, luota niihin hieman enemmän: sano arviosi ja sen peruste.",
    },
  },
  checking: {
    title: "Tarkistaminen",
    notEnough: "Päätöksiä on liian vähän arvion tekemiseen.",
    unavailable: "Tätä osaa ei voitu laskea istunnostasi.",
    values: (k, n, p) => `Etsit tietoa ennen toimintaa ${k}/${n} päätöksessä (${p}).`,
    band: { often: "Tarkistit usein", sometimes: "Tarkistit joskus", rarely: "Tarkistit harvoin" },
    latency: (d) => `Kun tarkistit, ensimmäinen haku tuli ${d} jakson alusta.`,
    meaningOf: {
      often: "Tarkistaminen ennen toimintaa paljastaa muutokset ennen kuin ne yllättävät. Näin huolelliset päätöksentekijät toimivat, kun tilanne elää.",
      sometimes: "Tarkistit joissakin päätöksissä ja toisissa et. Kiireessä tarkistetaan usein vasta, kun jokin tuntuu oudolta, ja hiljaiset muutokset voivat jäädä huomaamatta.",
      rarely: "Toimiminen jo muodostuneen kuvan varassa on nopeaa, mutta tilanne voi muuttua ilman, että mikään tuntuu erilaiselta.",
    },
    tip: "Katso ennen päätöstä lyhyesti, mikä on muuttunut edellisen päätöksesi jälkeen.",
  },
  toolUse: {
    title: "Työkalujen käyttö",
    notEnough: "Tietoa on liian vähän arvion tekemiseen.",
    unavailable: "Tätä osaa ei voitu laskea istunnostasi.",
    haku: (n) => `Haut Haussa: ${n}`,
    guide: (n) => `Kysymykset Thinkerille: ${n}`,
    reviews: (k, n) => `Muutit suunnitelmaasi ${k}/${n} suunnitelman tarkistuksessa.`,
    noReviews: "Istunnossasi ei ollut suunnitelman tarkistuksia.",
    meaning: "Kysymysten määrä ei sinänsä ole hyvä tai huono. Työkaluista on eniten hyötyä, kun tietää, mitä pitää selvittää, ja suunnitelman muuttaminen on vahvuus, kun uusi tieto sitä vaatii.",
    tip: "Kysy yksi tarkka kysymys siitä, mistä seuraava päätöksesi riippuu.",
  },
  percent: (v) => `${Math.round(v)} %`,
  duration: (s) => duration(s, { under5: "alle 5 sekunnissa", s: (n) => `noin ${n} sekunnin kuluttua`, min: (n) => `noin ${n} minuutin kuluttua` }),
};

export const PROFILE_TEXT: Readonly<Record<ProfileLang, ProfileTexts>> = { fi: FI, en: EN };
