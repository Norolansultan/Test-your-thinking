/**
 * The AI literacy questionnaire's items (researcher request, 9 Oct 2026; SPEC/15 and SPEC/09
 * revision (ac), amended the same day: SNAIL replaces AILIT-S, for comparability with Fernandes et
 * al.). **SNAIL**, the Scale for the assessment of Non-experts' AI Literacy: 31 SELF-REPORT items,
 * each rated on a 7-point scale, in three factors — Technical Understanding (TU, 14 items), Critical
 * Appraisal (CA, 10), Practical Application (PA, 7). There are no correct answers.
 *
 * SOURCE (verbatim). Laupichler, M. C., Aster, A., Haverkamp, N., & Raupach, T. (2023). Development
 * of the "Scale for the assessment of non-experts' AI literacy" – An exploratory factor analysis.
 * *Computers in Human Behavior Reports*, 12, 100338. https://doi.org/10.1016/j.chbr.2023.100338
 * The item wording and the item-to-factor assignment are those of the article's Table 1 ("List of
 * all variables sorted by factors based on the three-factor promax model"), read from the published
 * version on the authors' repository (bonndoc, University of Bonn, hdl 20.500.11811/13554,
 * `OA-2023-033.pdf`, retrieved 9 Oct 2026); the eight items Table 1 marks as eliminated (V03, V07,
 * V09, V10, V11, V26, V27, V38) are left out, which leaves the final 31. The items share the stem
 * "I can…"; `en` holds each item's completion exactly as printed (V17 has no full stop in the
 * table). The response scale is the article's: "a seven-point Likert scale from 'strongly disagree'
 * (one) to 'strongly agree' (seven)". `variable` is the article's variable number (V01–V39).
 *
 * PRECEDENT. Fernandes, D., Villa, S., Nicholls, S., Haavisto, O., Buschek, D., Schmidt, A., Kosch,
 * T., Shen, C., & Welsch, R. (2026). Performance and metacognition disconnect when reasoning in
 * human-AI interaction. *Computers in Human Behavior*, 175, 108779 (arXiv 2409.16708): SNAIL's 31
 * items, the TU/CA/PA subscales, administered at the END of their study (here: first, after consent).
 *
 * LICENCE. The article is open access under CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/,
 * per the publisher's metadata and the PDF); the authors call SNAIL freely available. Use,
 * reproduction and translation are allowed with attribution and an indication of changes.
 *
 * FINNISH: DRAFT, UNVALIDATED. Rendered by the build from the English, like the NASA-TLX wording in
 * `app/i18n/study-texts.ts`; no Finnish version of SNAIL is known (a German translation was tested
 * by the authors' group with a CFA on medical students). It must be reviewed (ideally
 * back-translated) before pilot 1 and is not the validated instrument.
 *
 * Presentation: the authors randomised the order per participant; here one fixed order for everyone
 * (identical stimulus): by variable number, which mixes the three factors. Four items per screen.
 */

/** The instrument logged in `ai_literacy_started`. */
export const AI_LITERACY_INSTRUMENT_ID = "SNAIL";
/** Changes whenever an item's wording, order, factor or the scale changes. */
export const AI_LITERACY_VERSION = "snail-31.2023.v1";

/**
 * True while the items are a placeholder (no verbatim source). The verbatim SNAIL items are in
 * place, so false; the screen shows a "placeholder" banner outside the study when true.
 */
export const AI_LITERACY_ITEMS_PENDING = false;

/** The time cap (researcher: "a 5-minute AI literacy test"). */
export const AI_LITERACY_TIME_LIMIT_MS = 5 * 60 * 1000;

/** The rating scale: 1 "strongly disagree" … 7 "strongly agree" (the anchors' text is in `study-texts.ts`). */
export const AI_LITERACY_SCALE = { min: 1, max: 7 } as const;

/** Items per screen: 31 items on 8 screens (4 × 7 + 3). */
export const AI_LITERACY_ITEMS_PER_PAGE = 4;

export type SnailFactor = "TU" | "CA" | "PA";

export interface AiLiteracyItem {
  readonly id: string;
  /** The article's variable number (V01–V39). */
  readonly variable: string;
  readonly factor: SnailFactor;
  /** The completion of the stem "I can…" (English verbatim; Finnish DRAFT). */
  readonly en: string;
  readonly fi: string;
}

const item = (variable: string, factor: SnailFactor, en: string, fi: string): AiLiteracyItem => ({ id: `snail.${variable}`, variable, factor, en, fi });

export const AI_LITERACY_ITEMS: readonly AiLiteracyItem[] = [
  item("V01", "PA", "tell if the technologies I use are supported by artificial intelligence.", "tunnistaa, perustuvatko käyttämäni teknologiat tekoälyyn."),
  item("V02", "PA", "name examples of technical applications that are supported by artificial intelligence.", "nimetä esimerkkejä teknisistä sovelluksista, jotka perustuvat tekoälyyn."),
  item("V04", "TU", "explain the difference between general (or strong) and narrow (or weak) artificial intelligence.", "selittää yleisen (eli vahvan) ja kapean (eli heikon) tekoälyn eron."),
  item("V05", "TU", "evaluate whether media representations of AI (e.g., in movies or video games) go beyond the current capabilities of AI technologies.", "arvioida, menevätkö tekoälyn kuvaukset mediassa (esim. elokuvissa tai videopeleissä) nykyisten tekoälyteknologioiden kykyjen yli."),
  item("V06", "CA", "name weaknesses of artificial intelligence.", "nimetä tekoälyn heikkouksia."),
  item("V08", "CA", "describe risks that may arise when using artificial intelligence systems.", "kuvata riskejä, joita tekoälyjärjestelmien käytöstä voi syntyä."),
  item("V12", "TU", "explain how AI applications make decisions.", "selittää, miten tekoälysovellukset tekevät päätöksiä."),
  item("V13", "TU", "explain how machine learning works at a general level.", "selittää yleisellä tasolla, miten koneoppiminen toimii."),
  item("V14", "TU", "describe how machine learning models are trained, validated, and tested.", "kuvata, miten koneoppimismalleja opetetaan, validoidaan ja testataan."),
  item("V15", "TU", "explain the difference between 'supervised learning' and 'unsupervised learning' (in the context of machine learning).", "selittää ohjatun oppimisen ja ohjaamattoman oppimisen eron (koneoppimisessa)."),
  item("V16", "TU", "explain how 'reinforcement learning' works on a basic level (in the context of machine learning).", "selittää perustasolla, miten vahvistusoppiminen toimii (koneoppimisessa)."),
  item("V17", "TU", "explain how deep learning relates to machine learning", "selittää, miten syväoppiminen liittyy koneoppimiseen"),
  item("V18", "TU", "explain what the term 'artificial neural network' means.", "selittää, mitä termi 'keinotekoinen neuroverkko' tarkoittaa."),
  item("V19", "PA", "critically evaluate the implications of artificial intelligence applications in at least one subject area.", "arvioida kriittisesti tekoälysovellusten seurauksia ainakin yhdellä alalla."),
  item("V20", "CA", "explain why data plays an important role in the development and application of artificial intelligence.", "selittää, miksi datalla on tärkeä rooli tekoälyn kehittämisessä ja soveltamisessa."),
  item("V21", "CA", "describe why humans play an important role in the development of artificial intelligence systems.", "kuvata, miksi ihmisillä on tärkeä rooli tekoälyjärjestelmien kehittämisessä."),
  item("V22", "TU", "describe how some artificial intelligence systems can act in their environment and react to their environment.", "kuvata, miten jotkin tekoälyjärjestelmät voivat toimia ympäristössään ja reagoida siihen."),
  item("V23", "TU", "explain how sensors are used by computers to collect data that can be used for AI purposes.", "selittää, miten tietokoneet käyttävät antureita kerätäkseen dataa, jota voidaan käyttää tekoälyn tarpeisiin."),
  item("V24", "PA", "name applications in which AI-assisted natural language processing/understanding is used.", "nimetä sovelluksia, joissa käytetään tekoälyavusteista luonnollisen kielen käsittelyä tai ymmärtämistä."),
  item("V25", "CA", "identify ethical issues surrounding artificial intelligence.", "tunnistaa tekoälyyn liittyviä eettisiä kysymyksiä."),
  item("V28", "CA", "critically reflect on the potential impact of artificial intelligence on individuals and society.", "pohtia kriittisesti tekoälyn mahdollisia vaikutuksia yksilöihin ja yhteiskuntaan."),
  item("V29", "PA", "explain why AI has recently become increasingly important.", "selittää, miksi tekoäly on viime aikoina tullut yhä tärkeämmäksi."),
  item("V30", "TU", "explain how rule-based systems differ from machine learning systems.", "selittää, miten sääntöpohjaiset järjestelmät eroavat koneoppimisjärjestelmistä."),
  item("V31", "PA", "assess if a problem in my field can and should be solved with artificial intelligence methods.", "arvioida, voiko ja kannattaako oman alani ongelmaa ratkaista tekoälymenetelmin."),
  item("V32", "CA", "describe what artificial intelligence is.", "kuvata, mitä tekoäly on."),
  item("V33", "TU", "describe the concept of explainable AI.", "kuvata selitettävän tekoälyn käsitteen."),
  item("V34", "CA", "explain why data security must be considered when developing and using artificial intelligence applications.", "selittää, miksi tietoturva on otettava huomioon tekoälysovelluksia kehitettäessä ja käytettäessä."),
  item("V35", "CA", "explain why data privacy must be considered when developing and using artificial intelligence applications.", "selittää, miksi tietosuoja on otettava huomioon tekoälysovelluksia kehitettäessä ja käytettäessä."),
  item("V36", "TU", "describe the concept of big data.", "kuvata massadatan (big data) käsitteen."),
  item("V37", "PA", "give examples from my daily life (personal or professional) where I might be in contact with artificial intelligence.", "antaa arjestani (henkilökohtaisesta elämästä tai työstä) esimerkkejä tilanteista, joissa saatan olla tekemisissä tekoälyn kanssa."),
  item("V39", "CA", "describe potential legal problems that may arise when using artificial intelligence.", "kuvata mahdollisia oikeudellisia ongelmia, joita tekoälyn käytöstä voi syntyä."),
];

/** The screens: the items in order, `AI_LITERACY_ITEMS_PER_PAGE` at a time. */
export const AI_LITERACY_PAGES: readonly (readonly AiLiteracyItem[])[] = Array.from(
  { length: Math.ceil(AI_LITERACY_ITEMS.length / AI_LITERACY_ITEMS_PER_PAGE) },
  (_, p) => AI_LITERACY_ITEMS.slice(p * AI_LITERACY_ITEMS_PER_PAGE, (p + 1) * AI_LITERACY_ITEMS_PER_PAGE),
);
