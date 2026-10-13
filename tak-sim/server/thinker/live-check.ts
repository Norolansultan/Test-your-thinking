/**
 * `npm run thinker:live-check` — runs the authored questions through the real pipeline and the live
 * model, printing the retrieved ids and the answers (for the researcher once a key is provided;
 * SPEC/10 revision (q)'s pilot check starts from this). Needs `GEMINI_API_KEY`; every call is
 * logged to `logs/thinker/live-check.jsonl`. Makes 14 model calls: 11 in the `reasoning_once` cell,
 * and V12's power-line questions again in `reasoning_intent` (the strategy-guided prompt, D2).
 *
 *   npm run thinker:live-check -- --lang en   # the English questions, English retrieval (SPEC/14 revision (v))
 */

import { authoredQuestionsOf } from "../../tools/thinker/authored-questions.js";
import { langArg } from "../../tools/thinker/eval-common.js";
import { createThinkerDeps } from "./deps.js";
import { handleThinkerRequest } from "./handler.js";
import type { ThinkerCell } from "../../app/session/thinker-protocol.js";

if (!process.env.GEMINI_API_KEY) {
  console.error("thinker:live-check needs GEMINI_API_KEY in the environment (it calls the live model).");
  process.exit(1);
}

const lang = langArg(process.argv.slice(2));
const AUTHORED_QUESTIONS = authoredQuestionsOf(lang);
const CHECKS: readonly { readonly view: number; readonly questions: readonly string[]; readonly cell: ThinkerCell }[] = [
  { view: 6, questions: AUTHORED_QUESTIONS.powerLine, cell: "reasoning_once" },
  { view: 7, questions: [...AUTHORED_QUESTIONS.broadBog, ...AUTHORED_QUESTIONS.narrowBog, ...AUTHORED_QUESTIONS.powerLine], cell: "reasoning_once" },
  { view: 12, questions: AUTHORED_QUESTIONS.powerLine, cell: "reasoning_once" },
  { view: 12, questions: AUTHORED_QUESTIONS.powerLine, cell: "reasoning_intent" },
];

const deps = await createThinkerDeps({ lexicalOnly: false });
console.log(`live-check — language ${lang}; ${deps.englishNotice}`);
for (const { view, questions, cell } of CHECKS) {
  const spec = deps.scenario.cycles.find((c) => c.index === view)!;
  for (const question of questions) {
    const result = await handleThinkerRequest(deps, {
      sessionId: "live-check", condition: "substitutive", view, virtualTimeS: spec.startsAtVirtual, question, cell, language: lang,
    });
    if (result.status !== 200) {
      console.log(`V${view} "${question}": HTTP ${result.status} ${result.body.error}`);
      continue;
    }
    const r = result.body;
    console.log(`\n=== V${view} "${question}" — retrieval ${r.retrievalMode}/${r.retrievalLanguage ?? "fi"}, ${r.latencyMs} ms${r.fallback ? `, FALLBACK ${r.fallbackReason}` : ""}`);
    console.log(`retrieved: ${r.retrieved.map((x, i) => `T${i + 1}=${x.id} (${x.score})`).join(", ")}`);
    console.log(`VASTAUS:   ${r.answer.vastaus}`);
    console.log(`PERUSTEET: ${r.answer.perusteet}`);
    console.log(`VARMUUS:   ${r.answer.varmuus}`);
    console.log(`MUUTTAISI: ${r.answer.muuttaisi}`);
    if (r.answer.linjaus) console.log(`LINJAUS:   ${r.answer.linjaus.tila} — ${r.answer.linjaus.perustelu}`);
  }
}
