/**
 * The personal results report's own texts (SPEC/36), fi and en; the profile's band labels and meanings are the on-screen profile's
 * (`app/render/ui/profile/profile-texts.ts`) and the tips are `app/telemetry/profile-tips.ts`'s. DRAFT: the Finnish awaits the native
 * check. GENERIC throughout: nothing names the scenario, an item, a key or another participant (`test/results/` scans every report
 * against the freeze banks).
 */

import type { Band, BackgroundGroup, MetricId, Relation } from "./comparison.js";

export interface ReportTexts {
  readonly title: string;
  readonly subtitle: string;
  readonly intro: string;
  readonly profileHeading: string;
  readonly comparisonHeading: string;
  readonly tipsHeading: string;
  readonly aboutHeading: string;
  readonly groupLine: (group: string) => string;
  readonly group: Readonly<Record<BackgroundGroup, string>>;
  readonly metric: Readonly<Record<MetricId, string>>;
  readonly band: Readonly<Record<MetricId, Readonly<Record<Band, string>>>>;
  readonly expert: Readonly<Record<MetricId, Readonly<Record<Relation, string>>>>;
  readonly expertPending: string;
  readonly tooFew: string;
  readonly noValue: string;
  readonly reliability: (answers: number, decisions: number) => string;
  readonly privacy: string;
  readonly noAnswers: string;
  readonly questions: (haku: number, guide: number | null) => string;
  readonly reviews: (changed: number, shown: number) => string;
  readonly footer: string;
}

const EN: ReportTexts = {
  title: "Your personal results",
  subtitle: "Wildfire command study: how commanders check machine-made forecasts",
  intro: "Thank you for taking part. This report describes how you worked during the exercise. It is about your way of working, not a test score: it does not show which of your answers were right or wrong.",
  profileHeading: "Your commander profile",
  comparisonHeading: "Compared with others",
  tipsHeading: "Development tips",
  aboutHeading: "How to read this report",
  groupLine: (group) => `You are compared with ${group} who completed the same exercise.`,
  group: { fire: "fire and rescue professionals", military: "military and other professional responders", other: "other participants" },
  metric: { calibration: "Confidence and accuracy", checking: "Checking before acting", questions: "Questions to the tools" },
  band: {
    calibration: {
      low: "Your confidence matched your accuracy more closely than for most of them (the closest quarter).",
      middle: "Your confidence matched your accuracy about as closely as for most of them (the middle half).",
      high: "Your confidence matched your accuracy less closely than for most of them (the quarter with the largest gaps).",
    },
    checking: {
      low: "You checked before acting less often than most of them (the lowest quarter).",
      middle: "You checked before acting about as often as most of them (the middle half).",
      high: "You checked before acting more often than most of them (the highest quarter).",
    },
    questions: {
      low: "You asked fewer questions than most of them (the lowest quarter).",
      middle: "You asked about as many questions as most of them (the middle half).",
      high: "You asked more questions than most of them (the highest quarter).",
    },
  },
  expert: {
    calibration: { below: "Experienced commanders' median: your match was closer.", about: "Experienced commanders' median: about the same match.", above: "Experienced commanders' median: their match was closer." },
    checking: { below: "Experienced commanders' median: they checked more often.", about: "Experienced commanders' median: about as often.", above: "Experienced commanders' median: you checked more often." },
    questions: { below: "Experienced commanders' median: they asked more questions.", about: "Experienced commanders' median: about as many.", above: "Experienced commanders' median: you asked more questions." },
  },
  expertPending: "Comparison with experienced commanders: not available yet.",
  tooFew: "Too few participants with a background like yours took part for a fair comparison.",
  noValue: "Your session had too little data for this comparison.",
  reliability: (answers, decisions) => `These are rough bands, not exact scores. Your profile rests on ${answers} answers and ${decisions} decisions from one session; one session can differ from how you usually work, and a difference of one band may well be chance.`,
  privacy: "This report is for you only. Your employer or school receives group results only, never yours. Your email address is deleted from the study once this report has been sent.",
  noAnswers: "Not enough data.",
  questions: (haku, guide) => (guide === null ? `Searches: ${haku}.` : `Searches: ${haku}; questions to the Thinker: ${guide}.`),
  reviews: (changed, shown) => `You changed your plan at ${changed} of ${shown} plan reviews.`,
  footer: "Sent after the study closed. Questions about the study: the contact in your consent information.",
};

// DRAFT (SPEC/36 §7): native check.
const FI: ReportTexts = {
  title: "Henkilökohtaiset tuloksesi",
  subtitle: "Maastopalon johtamisen tutkimus: miten johtajat tarkistavat koneen tuottamia ennusteita",
  intro: "Kiitos osallistumisesta. Tämä raportti kuvaa, miten työskentelit harjoituksen aikana. Se kertoo toimintatavastasi, ei ole koetulos, eikä se kerro, mitkä vastauksistasi olivat oikein tai väärin.",
  profileHeading: "Johtajaprofiilisi",
  comparisonHeading: "Vertailu muihin",
  tipsHeading: "Kehittymisvinkit",
  aboutHeading: "Näin luet raporttia",
  groupLine: (group) => `Vertailuryhmäsi: ${group}, jotka tekivät saman harjoituksen.`,
  group: { fire: "pelastusalan ammattilaiset", military: "sotilaat ja muut ammattimaiset turvallisuusalan toimijat", other: "muut osallistujat" },
  metric: { calibration: "Varmuus ja osuvuus", checking: "Tarkistaminen ennen toimintaa", questions: "Kysymykset työkaluille" },
  band: {
    calibration: {
      low: "Varmuutesi vastasi osuvuuttasi tarkemmin kuin useimmilla heistä (tarkimpien neljännes).",
      middle: "Varmuutesi vastasi osuvuuttasi suunnilleen yhtä tarkasti kuin useimmilla heistä (keskimmäinen puolikas).",
      high: "Varmuutesi vastasi osuvuuttasi väljemmin kuin useimmilla heistä (suurimpien erojen neljännes).",
    },
    checking: {
      low: "Tarkistit tietoja ennen toimintaa harvemmin kuin useimmat heistä (alin neljännes).",
      middle: "Tarkistit tietoja ennen toimintaa suunnilleen yhtä usein kuin useimmat heistä (keskimmäinen puolikas).",
      high: "Tarkistit tietoja ennen toimintaa useammin kuin useimmat heistä (ylin neljännes).",
    },
    questions: {
      low: "Kysyit vähemmän kuin useimmat heistä (alin neljännes).",
      middle: "Kysyit suunnilleen yhtä paljon kuin useimmat heistä (keskimmäinen puolikas).",
      high: "Kysyit enemmän kuin useimmat heistä (ylin neljännes).",
    },
  },
  expert: {
    calibration: { below: "Kokeneiden johtajien mediaani: sinun vastaavuutesi oli tarkempi.", about: "Kokeneiden johtajien mediaani: suunnilleen sama vastaavuus.", above: "Kokeneiden johtajien mediaani: heidän vastaavuutensa oli tarkempi." },
    checking: { below: "Kokeneiden johtajien mediaani: he tarkistivat useammin.", about: "Kokeneiden johtajien mediaani: suunnilleen yhtä usein.", above: "Kokeneiden johtajien mediaani: sinä tarkistit useammin." },
    questions: { below: "Kokeneiden johtajien mediaani: he kysyivät enemmän.", about: "Kokeneiden johtajien mediaani: suunnilleen yhtä paljon.", above: "Kokeneiden johtajien mediaani: sinä kysyit enemmän." },
  },
  expertPending: "Vertailu kokeneisiin johtajiin: ei vielä saatavilla.",
  tooFew: "Kaltaisiasi osallistujia oli liian vähän reilun vertailun tekemiseen.",
  noValue: "Istunnossasi oli liian vähän tietoa tähän vertailuun.",
  reliability: (answers, decisions) => `Nämä ovat karkeita luokkia, eivät tarkkoja pisteitä. Profiilisi perustuu ${answers} vastaukseen ja ${decisions} päätökseen yhdestä istunnosta; yksi istunto voi poiketa tavallisesta tavastasi toimia, ja yhden luokan ero voi hyvin olla sattumaa.`,
  privacy: "Raportti on vain sinua varten. Työnantajasi tai oppilaitoksesi saa vain ryhmätason tuloksia, ei koskaan sinun tuloksiasi. Sähköpostiosoitteesi poistetaan tutkimuksesta, kun tämä raportti on lähetetty.",
  noAnswers: "Tietoa ei ole tarpeeksi.",
  questions: (haku, guide) => (guide === null ? `Haut: ${haku}.` : `Haut: ${haku}; kysymykset Thinkerille: ${guide}.`),
  reviews: (changed, shown) => `Muutit suunnitelmaasi ${changed}/${shown} suunnitelman tarkistuksessa.`,
  footer: "Lähetetty tutkimuksen päätyttyä. Kysymykset tutkimuksesta: suostumustiedoissa mainittu yhteyshenkilö.",
};

export const REPORT_TEXT: Readonly<Record<"fi" | "en", ReportTexts>> = { fi: FI, en: EN };
