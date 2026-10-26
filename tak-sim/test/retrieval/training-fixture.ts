/**
 * The training incident's corpus for the separation tests (revision (bp), SPEC/14 (bp) §bp.3; SPEC/08 (bp) §bp.6). Work package A
 * builds the real corpus (`app/session/training/corpus.ts`, from `content/training/corpus.json`); until it is in the tree that module
 * is an empty placeholder, so the tests use a FIXTURE: the twelve records of `08` (bp) §bp.6's table, built by the session's own
 * `trafficAtom` at the training's one step (−9) with `trn.r..` ids, as the build builds them. `TRAINING_FOR_TESTS` is the real corpus
 * once it has records and the fixture before, so every test runs on the real one after the merge with no change.
 */

import type { InfoAtom, InteractionEvent } from "../../app/scenario/types.js";
import { trafficAtom } from "../../app/scenario/traffic-atoms.js";
import { TRAINING_ATOMS, TRAINING_NOW_S, TRAINING_STEP } from "../../app/session/training/corpus.js";
import type { TrainingCorpus } from "../../server/thinker/handler.js";

type Tier = InteractionEvent["tier"];

/** 13.20 is 0; a clock "hh.mm" in seconds on that scale. */
const at = (hhmm: string): number => { const [h, m] = hhmm.split(".").map(Number); return ((h! * 60 + m!) - (13 * 60 + 20)) * 60; };

const ROWS: readonly (readonly [id: string, clock: string, actor: string, tier: Tier, fi: string])[] = [
  ["trn.r01", "09.41", "EK51", "T2_system", "EK51 hälytetty: pienpalo Kaitajärven länsipuolella, ilmoitettu koko noin 0,2 ha."],
  ["trn.r02", "09.52", "EK52", "T2_system", "EK52: tie R6 on ajettavissa risteyksestä pohjoiseen, ei esteitä."],
  ["trn.r03", "09.58", "EK51", "T1_pushed", "EK51: olemme paikalla. Pienpalo kangasmetsässä tien R5 eteläpuolella, arvio noin 0,4 ha, liekit alle metrin."],
  ["trn.r04", "10.00", "DR8", "T2_system", "DR8 anturiloki klo 10.00: lentokorkeus 120 m, akku 82 %."],
  ["trn.r05", "10.04", "EK51", "T1_pushed", "EK51: letku on vedetty palon eteläreunaan, kaksi miestä linjalla, vettä riittää."],
  ["trn.r06", "10.05", "DR8", "T2_system", "DR8 lämpökuvaus klo 10.05: palava ala noin 1,1 ha, kärki etenee koilliseen noin 10 m/min. (luotettavuus hyvä.)"],
  ["trn.r07", "10.08", "EK51", "T3_person", "EK51 tilanne kysyttäessä: vettä säiliössä noin 85 %, miehistö neljä, polttoainetta riittää."],
  ["trn.r08", "10.12", "DR8", "T1_pushed", "DR8: palon kärki on nyt tiellä R5."],
  ["trn.r09", "10.14", "EK52", "T1_pushed", "EK52: tie R6 on tukossa noin 300 m risteyksestä pohjoiseen, ajoneuvo poikittain tiellä. Käännyn takaisin risteykseen."],
  ["trn.r10", "10.15", "EK52", "T3_person", "EK52 tilanne kysyttäessä: vettä säiliössä noin 60 %, miehistö kolme."],
  ["trn.r11", "10.17", "EK51", "T1_pushed", "EK51: pumppu käy, letkua 150 m."],
  ["trn.r12", "10.10", "EK51", "T2_system", "EK51 työvuoroloki: työvuoro alkoi klo 09.58."],
];

function eventOf([id, clock, actor, tier, fi]: (typeof ROWS)[number]): InteractionEvent {
  const drone = actor.startsWith("DR");
  return {
    id, cycle: TRAINING_STEP, session_view: null, sim_time_s: at(clock), timestamp: `${clock.replace(".", ":")}:00`, actor, actor_type: drone ? "drone" : "fire_team",
    addressee: tier === "T1_pushed" ? "JOHTO" : null, location: null, place: null, lat: null, lon: null, event_type: tier === "T3_person" ? "status" : "report",
    task: null, content: fi, tier, channel: tier === "T3_person" ? "ask_unit" : drone && tier !== "T1_pushed" ? "sensor_feed" : "radio_command", nav: drone ? "palo" : "yksikot", lang: "fi",
  };
}

/** The fixture: `08` (bp) §bp.6's twelve records. */
export const FIXTURE_TRAINING_ATOMS: readonly InfoAtom[] = ROWS.map((r) => trafficAtom(eventOf(r)));
export const FIXTURE_TRAINING: TrainingCorpus = { atoms: FIXTURE_TRAINING_ATOMS, step: TRAINING_STEP, nowS: TRAINING_NOW_S };

/** The real corpus once work package A's build is in the tree; the fixture before. */
export const TRAINING_FOR_TESTS: TrainingCorpus = TRAINING_ATOMS.length > 0 ? { atoms: TRAINING_ATOMS, step: TRAINING_STEP, nowS: TRAINING_NOW_S } : FIXTURE_TRAINING;

/** The training's pre-recorded and recorded questions (`08` (bp) §bp.5–bp.6, `30` (bp) §bp.2), both languages. */
export const TRAINING_QUESTIONS: Readonly<Record<"fi" | "en", readonly string[]>> = {
  fi: ["Mitä DR8 ilmoitti klo 10.05?", "Onko tie R6 ajettavissa?", "Kuinka suuri EK51:n miehistö on?", "Paljonko vettä EK52:lla on?", "Onko palo hallinnassa?"],
  en: ["What did DR8 report at 10.05?", "Is road R6 passable?", "How large is EK51's crew?", "How much water does EK52 have?", "Is the fire under control?"],
};

/** The training's own names (`08` (bp) §bp.3): no scenario text has them. */
export const TRAINING_NAMES: readonly string[] = ["EK51", "EK52", "EK53", "DR8", "Kaitajärvi", "R5", "R6", "R7"];
