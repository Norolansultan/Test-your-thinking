/**
 * Game mode, SPEC/34: the interface strings of the start page's tracks, the training course and the instructions
 * panel, Finnish and English (same keys; `CourseText` makes a missing English string a type error). Finnish DRAFT for
 * the native-speaker check.
 */

import type { Lang } from "../../../i18n/lang.js";
import type { CourseTopic, TaskResult } from "../../tasks/contracts.js";

export interface CourseText {
  readonly instructions: string;
  readonly tracks: {
    readonly courseTitle: string; readonly courseNote: string; readonly recommended: string;
    readonly modulesPassed: (n: number, of: number) => string; readonly start: string; readonly resume: string;
    readonly tasksTitle: string; readonly tasksNote: string; readonly tasksComing: string; readonly open: string;
    readonly done: string; readonly notDone: string; readonly best: (g: TaskResult["grade"]) => string;
    readonly freeTitle: string; readonly freeNote: string;
  };
  readonly topic: Readonly<Record<CourseTopic, string>>;
  readonly course: {
    readonly title: string; readonly intro: string; readonly passed: string; readonly pages: (n: number) => string;
    readonly withExercise: string; readonly openModule: string;
  };
  readonly module: {
    readonly page: (i: number, n: number) => string; readonly next: string; readonly prev: string; readonly toCourse: string;
    readonly exerciseTitle: string; readonly exerciseIntro: string; readonly startExercise: string; readonly skipExercise: string;
    readonly exerciseBest: (g: TaskResult["grade"]) => string;
    readonly checksTitle: string; readonly question: (i: number, n: number) => string; readonly correct: string; readonly wrong: string;
    readonly tryAgain: string; readonly nextQuestion: string; readonly finish: string;
    readonly passedTitle: string; readonly passedNote: string; readonly nextModule: string; readonly mapView: string;
  };
  readonly panel: {
    readonly thisTask: string; readonly criteria: string; readonly checklist: string; readonly checklistNote: string;
    readonly ordersKeys: string; readonly symbols: string; readonly unitKinds: string; readonly unitStatus: string;
    readonly fireColours: string; readonly places: string; readonly settlement: string; readonly waterPoint: string;
    readonly commandPost: string; readonly powerLine: string; readonly close: string;
  };
}

const TOPIC_FI: Readonly<Record<CourseTopic, string>> = {
  map: "Kartta", fire: "Palo", recon: "Tiedustelu", orders: "Käskyt", water: "Vesi", safety: "Turvallisuus", protect: "Suojaus", mopup: "Jälkisammutus",
};
const TOPIC_EN: Readonly<Record<CourseTopic, string>> = {
  map: "Map", fire: "Fire", recon: "Recon", orders: "Orders", water: "Water", safety: "Safety", protect: "Protection", mopup: "Mop-up",
};

// DRAFT fi
const FI: CourseText = {
  instructions: "Ohjeet",
  tracks: {
    courseTitle: "Perehdytys", courseNote: "Seitsemän lyhyttä moduulia: mitä palopaikan johtajan pitää tarkistaa ja miksi. Jokaisessa on pieni harjoitus ja tarkistuskysymykset.",
    recommended: "Suositeltu ensin", modulesPassed: (n, of) => `${n} / ${of} moduulia suoritettu`, start: "Aloita", resume: "Jatka",
    tasksTitle: "Tehtävät", tasksNote: "Kiinteitä tilanteita, yksi tehtävä kussakin, kaikille samat. Suunnittele, toteuta ja vertaa ratkaisuasi asiantuntijan ratkaisuun.",
    tasksComing: "Tehtävät ovat tulossa. Aloita sillä välin perehdytyksestä tai vapaasta pelistä.", open: "Avaa",
    done: "Tehty", notDone: "Tekemättä", best: (g) => `Paras: ${g}`,
    freeTitle: "Vapaa peli", freeNote: "Kokonaiset tilanteet omaan tahtiin.",
  },
  topic: TOPIC_FI,
  course: {
    title: "Perehdytys", intro: "Käy moduulit järjestyksessä tai valitse aihe. Mitään ei ole lukittu. Moduuli on suoritettu, kun olet vastannut jokaiseen tarkistuskysymykseen oikein.",
    passed: "Suoritettu", pages: (n) => `${n} sivua`, withExercise: "harjoitus", openModule: "Avaa",
  },
  module: {
    page: (i, n) => `Sivu ${i} / ${n}`, next: "Seuraava", prev: "Edellinen", toCourse: "Kurssille",
    exerciseTitle: "Harjoitus", exerciseIntro: "Kokeile opittua pienessä tilanteessa. Suunnittelet käskyt, ja peli ajaa tilanteen loppuun. Voit myös ohittaa harjoituksen.",
    startExercise: "Aloita harjoitus", skipExercise: "Ohita harjoitus", exerciseBest: (g) => `Paras tuloksesi: ${g}`,
    checksTitle: "Tarkistuskysymykset", question: (i, n) => `Kysymys ${i} / ${n}`, correct: "Oikein!", wrong: "Ei aivan.",
    tryAgain: "Yritä uudelleen", nextQuestion: "Seuraava kysymys", finish: "Valmis",
    passedTitle: "Moduuli suoritettu", passedNote: "Hyvä. Voit palata moduuliin milloin tahansa.", nextModule: "Seuraava moduuli", mapView: "Karttanäkymä",
  },
  panel: {
    thisTask: "Tämä tehtävä", criteria: "Onnistumisen ehdot", checklist: "Tarkistuslista", checklistNote: "Johtajan yleinen tilannetarkistus — ei vihje tähän tehtävään.",
    ordersKeys: "Käskyt ja näppäimet", symbols: "Karttamerkit", unitKinds: "Yksiköt", unitStatus: "Tilarengas",
    fireColours: "Palon värit", places: "Paikat", settlement: "Kylä / rakennus", waterPoint: "Vesipiste", commandPost: "Johtopaikka",
    powerLine: "20 kV voimajohto (puupylväät)", close: "Sulje",
  },
};

const EN: CourseText = {
  instructions: "Instructions",
  tracks: {
    courseTitle: "Training course", courseNote: "Seven short modules: what a fire-ground commander has to check, and why. Each has a small exercise and check questions.",
    recommended: "Recommended first", modulesPassed: (n, of) => `${n} of ${of} modules passed`, start: "Start", resume: "Continue",
    tasksTitle: "Decision tasks", tasksNote: "Fixed situations, one task each, the same for everyone. Plan, commit, and compare your outcome with the expert's.",
    tasksComing: "The decision tasks are coming. Meanwhile start with the training course or free play.", open: "Open",
    done: "Done", notDone: "Not done", best: (g) => `Best: ${g}`,
    freeTitle: "Free play", freeNote: "Whole scenarios at your own pace.",
  },
  topic: TOPIC_EN,
  course: {
    title: "Training course", intro: "Take the modules in order or pick a topic. Nothing is locked. A module is passed once you have answered each check question right.",
    passed: "Passed", pages: (n) => `${n} pages`, withExercise: "exercise", openModule: "Open",
  },
  module: {
    page: (i, n) => `Page ${i} of ${n}`, next: "Next", prev: "Back", toCourse: "To the course",
    exerciseTitle: "Exercise", exerciseIntro: "Try what you learned in a small situation. You plan the orders and the game runs it to the end. You may also skip the exercise.",
    startExercise: "Start the exercise", skipExercise: "Skip the exercise", exerciseBest: (g) => `Your best: ${g}`,
    checksTitle: "Check questions", question: (i, n) => `Question ${i} of ${n}`, correct: "Correct!", wrong: "Not quite.",
    tryAgain: "Try again", nextQuestion: "Next question", finish: "Done",
    passedTitle: "Module passed", passedNote: "Well done. You can come back to the module at any time.", nextModule: "Next module", mapView: "Map view",
  },
  panel: {
    thisTask: "This task", criteria: "What counts as success", checklist: "Checklist", checklistNote: "The commander's generic situation check — not a hint for this task.",
    ordersKeys: "Orders and keys", symbols: "Map symbols", unitKinds: "Units", unitStatus: "Status ring",
    fireColours: "Fire colours", places: "Places", settlement: "Village / building", waterPoint: "Water point", commandPost: "Command post",
    powerLine: "20 kV power line (wooden poles)", close: "Close",
  },
};

export const COURSE_TEXT: Readonly<Record<Lang, CourseText>> = { fi: FI, en: EN };
