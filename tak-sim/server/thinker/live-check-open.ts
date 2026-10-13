/**
 * `npx tsx server/thinker/live-check-open.ts` — the Open Thinker's live probe (SPEC/14 revision (aq)):
 * a small fixed set of representative questions (lookups, decision questions, no-fit views, a
 * withdrawal question, a Finnish one) through `handleOpenThinkerRequest` with the live model and hybrid
 * retrieval, English unless stated (`--only=0,4,5` runs the listed checks by index). Needs `GEMINI_API_KEY`; 14 model calls; (ar) prints the authored premises by id (plus a retry on invalid JSON).
 * Each call's full log line goes to `logs/thinker/` (the proxy's own log, git-ignored); the table is printed.
 */
import { createThinkerDeps } from "./deps.js";
import { handleOpenThinkerRequest } from "./handler.js";
import type { OpenThinkerResponse, ThinkerCell } from "../../app/session/thinker-protocol.js";

if (!process.env.GEMINI_API_KEY) {
  console.error("live-check-open needs GEMINI_API_KEY in the environment (it calls the live model).");
  process.exit(1);
}

const OPTIONS = "What are my options for the main effort and its posture now? Weigh them for me.";
const FIT = "Does the directive still fit what the newest reports show? What are my options for the main effort?";
const WEAK = "What is the weakest assumption in the plan right now, and what are my options for the main effort?";
const NOFIT = [OPTIONS, FIT, WEAK] as const;
const noFit = (view: number): { label: string; view: number; cell: ThinkerCell; question: string }[] => NOFIT.map((question, i) => ({ label: `V${view} no-fit ${i + 1} (intent)`, view, cell: "reasoning_intent", question }));
const CHECKS: readonly { readonly label: string; readonly view: number; readonly cell: ThinkerCell; readonly question: string; readonly lang?: "fi" | "en" }[] = [
  ...[9, 14].flatMap((view) => [OPTIONS, FIT].map((question, i) => ({ label: `V${view} no-fit ${i + 1} (intent)`, view, cell: "reasoning_intent" as ThinkerCell, question }))),
  ...[11, 12, 13].flatMap((view) => [OPTIONS, FIT].map((question, i) => ({ label: `V${view} fit view ${i + 1} (intent)`, view, cell: "reasoning_intent" as ThinkerCell, question }))),
  { label: "V11 lookup (intent)", view: 11, cell: "reasoning_intent", question: "Where is the nearest water point?" },
  { label: "V9 Finnish (intent)", view: 9, cell: "reasoning_intent", question: "Pitääkö linjaus vielä paikkansa? Mitkä ovat vaihtoehdoni painopisteelle?", lang: "fi" },
];

const deps = await createThinkerDeps({ lexicalOnly: false });
console.log(`live-check-open — ${deps.englishNotice}`);
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",").map(Number);
for (const [i, c] of CHECKS.entries()) {
  if (only && !only.includes(i)) continue;
  const spec = c.view === 0 ? deps.scenario.practice.cycle : deps.scenario.cycles.find((x) => x.index === c.view)!;
  const logs: Record<string, unknown>[] = [];
  const probeDeps = { ...deps, appendLog: async (id: string, line: Readonly<Record<string, unknown>>) => { logs.push({ ...line }); await deps.appendLog(id, line); } };
  const r = await handleOpenThinkerRequest(probeDeps, {
    sessionId: "live-check-open", condition: "substitutive", view: c.view, virtualTimeS: spec.startsAtVirtual, question: c.question, cell: c.cell, language: c.lang ?? "en",
  });
  if (r.status !== 200) { console.log(`${c.label}: HTTP ${r.status} ${r.body.error}`); continue; }
  const b = r.body as OpenThinkerResponse;
  const log = logs[0] ?? {};
  console.log(`\n=== ${c.label} — kind ${String(log["kind"] ?? "-")}, ${String(log["words"] ?? "-")} words, verdicts ${JSON.stringify(log["verdictFields"] ?? null)}, ${b.latencyMs} ms, model ${JSON.stringify((log["usage"] as { modelVersion?: string } | undefined)?.modelVersion ?? null)}${b.fallback ? `, FALLBACK ${b.fallbackReason}` : ""}`);
  console.log(`trimmed ${JSON.stringify(log["trimmed"] ?? [])}, parseRetries ${String(log["parseRetries"] ?? 0)}, citationIssues ${JSON.stringify(log["citationIssues"])}, imperatives ${JSON.stringify(log["imperativeWords"])}`);
  const st = b.structured;
  if (st) console.log(`unforeseen ${JSON.stringify(st.unforeseen ?? null)}; premises ${JSON.stringify(st.premises.map((p) => [p.id, p.status, p.tags.join("+")]))}`);
  console.log(b.answer);
}
