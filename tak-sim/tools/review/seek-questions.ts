/**
 * Revision (bk), 25 Oct 2026 (researcher decision; SPEC/30 (bk) criterion b): the natural questions that find each converted
 * seek-dependent H2 item's key record. Each item has at least two questions per language that rank a key record in the lexical top 3
 * at the item's moment (the time gate's step, as `difficulty-audit.ts` computes it; lexical, as the play harness runs Haku). Fixed
 * before any pilot-2 data; `test/retrieval/seek-items-retrieval.spec.ts` holds them to it, and the difficulty audit's findability
 * table reports them (`FINDABILITY_QUERIES`).
 *
 * The questions are what a commander who does not know the answer would ask: they name the unit or the topic the stem names, never
 * the key. DRAFT Finnish (native check), the English its analogue, not a translation of the record.
 */

export interface SeekQuestions {
  /** The freeze item's id. */
  readonly itemId: string;
  /** Its key records that a question must find (any of them, when `anyOf`): the recorded ones, never a pushed one. */
  readonly records: readonly string[];
  /** Either record states the key (V2 south_flank: EK12's 13.51 and 14.08 reports). */
  readonly anyOf?: true;
  readonly fi: readonly string[];
  readonly en: readonly string[];
}

/** The rank a question must reach: a key record among the first three results. */
export const SEEK_TOP_K = 3;

export const SEEK_QUESTIONS: readonly SeekQuestions[] = [
  {
    itemId: "freeze.2.south_flank", records: ["evt.c02.022", "evt.c03.021"], anyOf: true,
    fi: ["Miten kärki etenee EK12:n kohdalla?", "Millaista paloa EK12:n kohdalla on?", "Miten kärki käyttäytyy eteläsivustalla?"],
    en: ["How is the fire behaving on EK12's flank?", "What is EK12 reporting from the south flank?", "What is the fire doing at EK12's section?"],
  },
  {
    itemId: "freeze.5.hose_short", records: ["evt.c07.032"],
    fi: ["Mitä EK11 tarvitsee?", "Mitä tarvikkeita EK11 tarvitsee?"],
    en: ["What equipment does EK11 need?", "What does EK11 need on its line?"],
  },
  {
    itemId: "freeze.5.reinforcements", records: ["atom.demo.7.1"],
    fi: ["Milloin lisäyksiköt saapuvat?", "Onko lisäyksiköitä tulossa?"],
    en: ["Have reinforcements been dispatched?", "Are reinforcements coming?"],
  },
  {
    itemId: "freeze.7.north_help", records: ["evt.c10.028"],
    fi: ["Miten EK14:n linjalle pääsee?", "Kuinka lähelle EK14:ää pääsee?", "Pääseekö EK14:n linjalle?"],
    // Revision (bn) (review B1): EK14's re-worded line says no "closer"; the second English question asks whether vehicles get through.
    en: ["Can a fire engine get to EK14?", "Can vehicles get through to EK14's line?"],
  },
];
