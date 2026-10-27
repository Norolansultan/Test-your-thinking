/**
 * The training incident's English texts (SPEC/08 (bp) §bp.5; DRAFT like the Finnish). The lake is "Narrow Lake", as the English map
 * prints Kaitajärvi (`place-names.ts`, the one table every English place name comes from). The figures are the build's (`figure`);
 * the records and questions the lessons quote are the corpus's (`quoteRecord`, `question`). Descriptive, never directive.
 */

import { TRAINING } from "../session/training/spec-data.js";
import { decimal, figure, km, question, quoteRecord, sentence, type TrainingWords } from "./training-texts-shared.js";

const TO: Readonly<Record<string, string>> = { n: "north", ne: "north-east", e: "east", se: "south-east", s: "south", sw: "south-west", w: "west", nw: "north-west" };
const SIDE: Readonly<Record<string, string>> = { n: "North of the road", s: "South of the road" };
const minutes = Math.round(TRAINING.capMs / 60_000);
const r6To = () => TO[String(figure("training.s3.older", "r6Dir"))]!;
const quote = (id: string) => { const r = quoteRecord("en", id); return `${r.source} ${r.clock}: “${r.text}”`; };
const lesson = (qid: string) => `“${question("en", qid)}”`;
const at = (id: string) => { const r = quoteRecord("en", id); return `${r.source}, ${r.clock}`; };

export const TRAINING_WORDS_EN: TrainingWords = {
  lang: "en",
  intro: {
    title: "Training: a small forest fire at Narrow Lake",
    body: [
      "This is a separate training fire in the map's north-east corner. Nothing in it concerns the session itself.",
      "You use the same tools as in the session: the map, the message log and Search. After each task you see where the information could be found and what the right answer was.",
      `The training is not scored. You have at most ${minutes} minutes.`,
    ],
    start: "Start the training",
  },
  sections: {
    s1: { title: "The map", body: ["You do three or four short tasks on the map. The road codes R5, R6 and R7 belong to this training only."], go: "Continue" },
    s2: { title: "The log is newer than the map", body: ["The map shows the fire as mapped at the start of the period, at 10.00. The message log holds newer reports."], go: "Continue" },
    s3: { title: "Records and search", body: ["In this part Search and the message log are open. Here Search answers only from this training's records."], go: "Continue" },
    s4: { title: "Memory-check rehearsal", body: ["The picture is hidden and you answer from memory: the map, the message log and Search are not available. You rate your confidence after each answer. After an answer you see where the information could be found."], go: "Continue" },
    s5: { title: "The tools", body: [], go: "Done" },
  },
  stems: {
    "training.s1.place": "Reports and Search use place names and road codes. Mark the junction of roads R5 and R6 on the map.",
    "training.s1.measure": `How far is A from road ${figure("training.s1.measure", "road")}? The R&B tool at the right edge measures distances, and so does the scale bar.`,
    "training.s1.slope": "There is no wind. A fire is burning at A. From A to B the ground rises (the brown contour lines); from A to C it is level. Will the fire spread faster towards B or towards C?",
    "training.s1.water": "A pump stands at the star (★), and a tanker brings it water by road. The roads shown on the map are the only links. Which fill point should the tanker use?",
    "training.s2.now": "The map shows the fire's edge as it was mapped at 10.00. The message log holds newer reports. Where is the head of the fire now?",
    "training.s2.project": `At 10.12 the head of the fire is at road R5 and advances ${TO[String(figure("training.s2.project", "dir"))]}, speed about 10 m/min. Mark where the head will be at 10.42.`,
    "training.s3.records1": "What is the size of the burning area according to DR8's latest survey?",
    "training.s3.older": "What do the latest reports say about road R6 for a tanker?",
    "training.s3.records2": "How many people are in EK51's crew?",
    "training.s4.memory": "Mark where EK53 was.",
    "training.s4.log": "Who reported that the head of the fire is at road R5?",
    "training.s4.map": "On the map mapped at 10.00, on which side of road R5 was the fire?",
    "training.s4.records": "How fast did DR8's survey say the head of the fire was advancing?",
  },
  options: {
    "training.s1.measure": { m150: "about 150 m", m300: "about 300 m", m600: "about 600 m", m1200: "about 1,200 m" },
    "training.s1.slope": { towards_b: "Faster towards B", towards_c: "Faster towards C", equal: "Equally fast both ways" },
    "training.s1.water": { fill_1: "Fill point 1", fill_2: "Fill point 2", either: "It makes no difference" },
    "training.s2.now": { map_edge: "Where the map draws it", at_road: "At road R5, as the report says", cannot_tell: "There is no way to tell" },
    "training.s3.records1": { ha02: "about 0.2 ha", ha04: "about 0.4 ha", ha11: "about 1.1 ha", ha25: "about 2.5 ha" },
    "training.s3.older": {
      passable: `Passable ${r6To()} from the junction with no obstacles`, blocked: `Blocked about 300 m ${r6To()} of the junction`,
      cut_by_fire: "Closed because of the fire", light_only: "Fine, but only for light vehicles",
    },
    "training.s3.records2": { two: "two", three: "three", four: "four", six: "six" },
    "training.s4.log": { ek51: "EK51", ek52: "EK52", dr8: "DR8", nobody: "Nobody" },
    "training.s4.map": { north: SIDE.n!, south: SIDE.s!, both: "On both sides of the road", none: "The map showed no fire" },
    "training.s4.records": { mpm4: "about 4 m/min", mpm10: "about 10 m/min", mpm20: "about 20 m/min", mpm40: "about 40 m/min" },
  },
  source: (c) => `Source: ${{ log: "the message log", map: "the map", records: "the records", reasoning: "worked out from the latest report and the rate" }[c]}.`,
  chose: (label) => `Your answer: ${label}.`,
  markedAway: (m) => `Your mark was ${Math.round(m)} m from the right place.`,
  noMark: "You marked no place.",
  timedOut: "The time ran out before an answer.",
  noAnswer: "No answer was given.",
  feedback: {
    "training.s1.place": () => ({
      answer: "The junction of roads R5 and R6 is at the green ring.",
      explain: ["The map's names and codes – road codes, the names of lakes and brooks – help you find the places that reports and Search name."],
    }),
    "training.s1.measure": ({ item }) => ({
      answer: `The shortest distance from A to road ${item.feedback.numbers.road} is about ${item.feedback.numbers.m} m (the yellow line).`,
      explain: ["The R&B tool measures it: choose R&B among the tools on the right edge and tap two points on the map. The scale bar tells distances too."],
    }),
    "training.s1.slope": ({ keyLabel, item }) => ({
      answer: sentence(keyLabel),
      explain: [`With no wind a fire spreads faster uphill, because the flames lean towards the slope and dry and heat the unburnt fuel ahead of them. The brown contour lines show slopes: the closer together they are, the steeper the slope. From A to B the ground rises about ${item.feedback.numbers.m} m.`],
    }),
    "training.s1.water": ({ keyLabel, item }) => {
      const n = item.feedback.numbers;
      return {
        answer: sentence(keyLabel),
        explain: [`Fill point ${n.other} is nearer in a straight line (${km("en", Number(n.a))} km), but no road leads there and a tanker cannot reach it. Fill point ${n.key} is ${km("en", Number(n.b))} km away by road. Tankers carry water by road: what counts is that a road reaches the water and how long the drive is.`],
      };
    },
    "training.s2.now": ({ item }) => ({
      answer: `At road ${item.feedback.numbers.road}.`,
      explain: [`The map shows the edge as it was mapped at the start of the period (${item.feedback.numbers.mapped}); the newer report in the log tells where the head is now (${item.feedback.numbers.from}, ${item.feedback.numbers.report}). In the memory checks, “now” means the situation the latest reports give.`],
    }),
    "training.s2.project": ({ item }) => {
      const n = item.feedback.numbers;
      return {
        answer: `About ${n.m} m ${TO[String(n.dir)]} of road R5: ${n.from} to ${n.to} is ${n.minutes} minutes, and ${n.minutes} min × ${n.rate} m/min = ${Number(n.minutes) * Number(n.rate)} m.`,
        explain: ["In a projection question the clock time is counted from the latest report, not from the edge the map draws."],
      };
    },
    "training.s3.records1": ({ keyLabel, item }) => ({
      answer: sentence(keyLabel),
      explain: [
        "The figure was in the records, not in the message log. The message log shows only part of the traffic: drone surveys, units' status and other filed information are in the records, and Search finds them.",
        `A Search question such as ${lesson(item.lesson!.questionId)} would have shown this: ${quote(item.lesson!.recordIds[0]!)}`,
        `The ${decimal("en", Number(item.feedback.numbers.lureHa))} ha in the message log (${at(String(item.feedback.numbers.lureRecord))}) was an earlier estimate.`,
      ],
    }),
    "training.s3.older": ({ keyLabel, item }) => ({
      answer: sentence(keyLabel),
      explain: [
        `The Search question ${lesson(item.lesson!.questionId)} would show the older record first: ${quote(item.lesson!.recordIds[0]!)}`,
        `The message log holds a newer report: ${quote(item.lesson!.recordIds[1]!)}`,
        "The newer report tells the situation now; a record can be older than the message log.",
      ],
    }),
    "training.s3.records2": ({ keyLabel, item }) => ({
      answer: sentence(keyLabel),
      explain: [
        "A unit's status is filed when it is asked.",
        `A Search question such as ${lesson(item.lesson!.questionId)} would have shown this: ${quote(item.lesson!.recordIds[0]!)}`,
        `The message log's “two men on the line” (${at(String(item.feedback.numbers.lureRecord))}) told only of those on the line.`,
      ],
    }),
    "training.s4.memory": ({ item }) => ({
      answer: `${item.memory!.unit} was here.`,
      explain: ["The memory-check map shows no fire, no units and no road codes, so a place can be fixed in memory by the road, the water and the names: on which road, by which lake or brook."],
    }),
    "training.s4.log": ({ keyLabel, item }) => ({
      answer: `${keyLabel}, at ${quoteRecord("en", String(item.feedback.numbers.record)).clock}.`,
      explain: ["The sender and the time are at the start of the line."],
    }),
    "training.s4.map": ({ keyLabel }) => ({
      answer: sentence(keyLabel),
      explain: ["The map shows the fire as it was mapped; newer reports in the message log can tell more."],
    }),
    "training.s4.records": ({ keyLabel, item }) => ({
      answer: sentence(keyLabel),
      explain: [
        `The figure was in the records (${at(item.lesson!.recordIds[0]!)}), and it was also in an earlier task's feedback.`,
        `A Search question such as ${lesson(item.lesson!.questionId)} finds it.`,
      ],
    }),
  },
  ui: {
    progress: "Task {n}/{of}",
    timeLeft: "Training time left {t}",
    answer: "Answer",
    markHint: "Mark the place by tapping the map.",
    marked: "Marked",
    chooseFirst: "Choose an answer.",
    memoryExposure: "Remember where unit EK53 is.",
    studyLeft: "The map is hidden in {s} s.",
    freezeNote: "Answer from memory. The training's time keeps running.",
    yourAnswer: "Your answer",
    noAnswer: "No answer: the time ran out.",
    next: "Next",
    done: "Done",
    capEnded: "The training's time is up. The remaining tasks are skipped.",
    question: "Question",
    recorded: "Recorded",
    demoWait: "The button is enabled in {s} s.",
  },
};
