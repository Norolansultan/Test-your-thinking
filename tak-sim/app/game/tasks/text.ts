/**
 * Game mode, SPEC/34 §4: the decision-task screen's own strings (the tasks' texts are in their data,
 * `app/game/scenarios/tasks/*`). Every Finnish string is DRAFT for the native-speaker check.
 */

import type { CourseTopic } from "./contracts.js";

export interface TaskText {
  readonly task: string;
  readonly topic: Readonly<Record<CourseTopic, string>>;
  readonly planHeading: string;
  readonly planHint: string;
  readonly criteria: string;
  readonly ordersGiven: (n: number) => string;
  readonly commit: string;
  readonly commitHint: string;
  readonly runHeading: string;
  readonly runLocked: string;
  readonly runOpen: string;
  readonly skip: string;
  readonly resultHeading: string;
  readonly allMet: string;
  readonly someMet: (met: number, of: number) => string;
  readonly points: string;
  readonly grade: string;
  readonly burned: string;
  readonly buildingsLost: string;
  readonly you: string;
  readonly expert: string;
  readonly expertHeading: string;
  readonly computing: string;
  readonly showExpert: string;
  readonly showMine: string;
  readonly onMap: (expert: boolean) => string;
  readonly teaching: string;
  readonly tryAgain: string;
  readonly back: string;
}

// DRAFT fi
const FI: TaskText = {
  task: "Tehtävä",
  topic: { map: "Kartta", fire: "Palokäyttäytyminen", recon: "Tilannekuva", orders: "Käskyt", water: "Vesihuolto", safety: "Turvallisuus", protect: "Kohdesuojaus", mopup: "Jälkisammutus" },
  planHeading: "Suunnittelu – kello on pysäytetty",
  planHint: "Anna käskyt kuten vapaassa pelissä: valitse yksikkö kartalta tai yksikkölistasta ja sitten käsky. Kello käy vasta, kun toteutat suunnitelman.",
  criteria: "Onnistumisen ehdot",
  ordersGiven: (n) => (n === 0 ? "Ei vielä käskyjä." : `Käskyjä annettu: ${n}.`),
  commit: "Toteuta suunnitelma",
  commitHint: "Toteutuksen jälkeen käskyjä ei voi enää muuttaa.",
  runHeading: "Suunnitelma käynnissä",
  runLocked: "Käskyjä ei voi enää antaa: seuraa, miten suunnitelma toimii.",
  runOpen: "Tässä tehtävässä voit antaa käskyjä myös ajon aikana.",
  skip: "Siirry loppuun",
  resultHeading: "Tulos",
  allMet: "Kaikki ehdot täyttyivät",
  someMet: (met, of) => `${met}/${of} ehtoa täyttyi`,
  points: "Pisteet",
  grade: "Arvosana",
  burned: "Paloala",
  buildingsLost: "Rakennuksia menetetty",
  you: "Sinä",
  expert: "Asiantuntija",
  expertHeading: "Asiantuntijan ratkaisu samalla siemenellä",
  computing: "Lasketaan asiantuntijan ratkaisua…",
  showExpert: "Näytä asiantuntijan lopputilanne kartalla",
  showMine: "Näytä oma lopputilanteesi kartalla",
  onMap: (expert) => (expert ? "Kartalla: asiantuntijan lopputilanne (todellinen palo)." : "Kartalla: oma lopputilanteesi (todellinen palo)."),
  teaching: "Opetuskohdat",
  tryAgain: "Yritä uudelleen",
  back: "Takaisin",
};

const EN: TaskText = {
  task: "Task",
  topic: { map: "Map", fire: "Fire behaviour", recon: "The picture", orders: "Orders", water: "Water supply", safety: "Safety", protect: "Structure protection", mopup: "Mop-up" },
  planHeading: "Planning — the clock is stopped",
  planHint: "Give orders as in free play: select a unit on the map or in the unit list, then an order. The clock runs only when you commit the plan.",
  criteria: "Success criteria",
  ordersGiven: (n) => (n === 0 ? "No orders yet." : `Orders given: ${n}.`),
  commit: "Commit plan",
  commitHint: "Once committed, the orders cannot be changed.",
  runHeading: "The plan is running",
  runLocked: "No further orders: watch how the plan works.",
  runOpen: "In this task you may also give orders during the run.",
  skip: "Skip to the end",
  resultHeading: "Result",
  allMet: "Every criterion met",
  someMet: (met, of) => `${met} of ${of} criteria met`,
  points: "Points",
  grade: "Grade",
  burned: "Burned",
  buildingsLost: "Buildings lost",
  you: "You",
  expert: "Expert",
  expertHeading: "The expert's plan on the same seed",
  computing: "Working out the expert's plan…",
  showExpert: "Show the expert's outcome on the map",
  showMine: "Show your outcome on the map",
  onMap: (expert) => (expert ? "On the map: the expert's outcome (the true fire)." : "On the map: your outcome (the true fire)."),
  teaching: "Teaching points",
  tryAgain: "Try again",
  back: "Back",
};

export const TASK_TEXT: Readonly<Record<"fi" | "en", TaskText>> = { fi: FI, en: EN };
