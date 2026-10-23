/**
 * `play.ts score` — the analyst's reading of a play run (`tools/play/`), written to `<run>/score.md` and `<run>/score.json` and
 * never printed to the player: it holds TRUTH (the keys). For every freeze and SPAM item the difficulty audit lists
 * (`tools/review/difficulty-audit.ts` `auditItems`: the item's moment, its key records — `keyAtomIds` with the audit's
 * `basisAtomIds` — and where each could reach a participant by design), the player's answer, the key, right or wrong
 * (`freezeItemScores` for freezes, the scenario's invariants for SPAM, `spamKeysOf`) and the confidence; and for each key record
 * whether the player HAD it before the item's moment, read from the session's own log (`atomExposure`): pushed and delivered to
 * the message log, returned by one of their Haku questions (which one), or never seen. The moment's anchor is the freeze's
 * `freeze_started` (the screen blanks there) and a SPAM item's `spam_answered` (the tools stay usable while it is open). Then
 * every Haku question with the records it returned, and the later items those records were key to.
 */

import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LogRecord } from "../../app/telemetry/log.js";
import type { AiChatAnswerReceivedDetail, AiChatQuerySubmittedDetail } from "../../app/telemetry/record-kinds-interaction.js";
import type { FreezeStartedDetail, RecallConfidenceSubmittedDetail, SpamAnsweredDetail } from "../../app/telemetry/record-kinds.js";
import { atomExposure, firstFreezeAnswers, freezeItemScores, type FreezeContentLike } from "../../app/telemetry/freeze-measures.js";
import { spamKeysOf } from "../../app/telemetry/spam-measures.js";
import { recordClockLabel } from "../../app/session/message-history.js";
import { clockAt } from "../../app/session/template-answer.js";
import { tr } from "../../app/i18n/text.js";
import { auditItems, type AuditItem } from "../review/difficulty-audit.js";
import type { PlaySession } from "./session.js";

interface KeyRecordRow {
  readonly atomId: string; readonly source: string; readonly clock: string; readonly tier: string;
  /** By design (the audit): pushed before the moment, recorded only (Haku), after the moment, missing. */
  readonly design: string;
  /** In this run, before the item's moment: `log` (pushed, delivered), `haku`, or `never`. */
  readonly had: "log" | "haku" | "both" | "never";
  readonly hakuQuestion: string | null;
}
interface ItemRow {
  readonly id: string; readonly kind: "freeze" | "spam"; readonly view: number; readonly level: string; readonly prompt: string;
  readonly answer: string | null; readonly key: string; readonly correct: boolean | null; readonly confidence: number | null;
  readonly distanceM: number | null; readonly momentS: number; readonly keyRecords: readonly KeyRecordRow[]; readonly anchorSeq: number | null;
}
interface HakuRow { readonly n: number; readonly queryId: string; readonly view: number; readonly clock: string; readonly question: string; readonly retrieved: readonly string[]; readonly keyForLaterItems: string[]; readonly seq: number }

const detail = <T>(r: LogRecord) => r.detail as T;

/** Every Haku question with what it returned; its clock as the screen showed it (the practice view's clock reads its own start). */
function hakuRows(records: readonly LogRecord[], practiceClock: string): HakuRow[] {
  const asked = new Map<string, { r: LogRecord; d: AiChatQuerySubmittedDetail }>();
  for (const r of records) if (r.kind === "ai_chat_query_submitted") asked.set(detail<AiChatQuerySubmittedDetail>(r).queryId, { r, d: detail<AiChatQuerySubmittedDetail>(r) });
  const rows: HakuRow[] = [];
  for (const r of records) {
    if (r.kind !== "ai_chat_answer_received") continue;
    const d = detail<AiChatAnswerReceivedDetail>(r);
    if (d.tool !== "haku") continue;
    const q = asked.get(d.queryId);
    rows.push({ n: rows.length + 1, queryId: d.queryId, view: d.view, clock: d.view === 0 ? practiceClock : clockAt(q?.d.virtualTimeS ?? d.virtualTimeS), question: d.text, retrieved: d.retrieved.map((x) => x.id), keyForLaterItems: [], seq: r.seq as number });
  }
  return rows;
}

/** The seq the item's moment is read at: the view's (last) `freeze_started` before its answers, or the SPAM item's answer. */
function anchorOf(item: AuditItem, records: readonly LogRecord[]): number | null {
  if (item.kind === "spam") return (records.find((r) => r.kind === "spam_answered" && detail<SpamAnsweredDetail>(r).probeId === item.id)?.seq as number | undefined) ?? null;
  const starts = records.filter((r) => r.kind === "freeze_started" && detail<FreezeStartedDetail>(r).cycle === item.view);
  return (starts[0]?.seq as number | undefined) ?? null;
}

function designOf(status: string, view: number | null): string {
  switch (status) {
    case "pushed_before": return `pushed (V${view})`;
    case "recorded_before": return `recorded only, Haku (from V${view})`;
    case "after_moment": return "after the moment";
    default: return status;
  }
}

export function scoreRun(session: PlaySession, records: readonly LogRecord[]): { readonly items: ItemRow[]; readonly haku: HakuRow[] } {
  const s = session.scenario;
  const atoms = new Map(s.atoms.map((a) => [a.id, a]));
  const freezes: FreezeContentLike[] = [{ cycle: 0, items: s.practice.freeze.items }, ...s.freezes];
  const scores = new Map(freezeItemScores(records, freezes).map((x) => [`${x.view}::${x.itemId}`, x]));
  const answers = new Map(firstFreezeAnswers(records).map((a) => [`${a.view}::${a.answer.itemId}`, a.answer]));
  const spamKeys = spamKeysOf(s.probeSchedule.probes, s.invariants);
  const spamProbes = new Map(s.probeSchedule.probes.map((p) => [p.id, p]));
  const haku = hakuRows(records, s.practice.cycle.clockLabel);
  const items: ItemRow[] = auditItems().map((item) => {
    const anchor = anchorOf(item, records);
    const ids = item.atoms.map((a) => a.id);
    const exposure = anchor === null ? [] : atomExposure(records, ids, anchor, { includeModelContext: false });
    const keyRecords: KeyRecordRow[] = item.atoms.map((a, i) => {
      const atom = atoms.get(a.id);
      const e = exposure[i];
      const log = e?.routes.includes("bubble") ?? false;
      const viaHaku = e?.routes.includes("haku_chat") ?? false;
      const q = viaHaku ? haku.find((h) => h.seq < anchor! && h.retrieved.includes(a.id)) : undefined;
      return {
        atomId: a.id, source: atom?.provenance.sourceId ?? "?", clock: atom ? recordClockLabel(atom) : "?", tier: a.tier, design: designOf(a.status, a.view),
        had: log && viaHaku ? "both" : log ? "log" : viaHaku ? "haku" : "never", hakuQuestion: q ? `#${q.n} "${q.question}"` : null,
      };
    });
    if (item.kind === "freeze") {
      const k = `${item.view}::${item.id}`;
      const ans = answers.get(k), sc = scores.get(k);
      const spec = freezes.find((f) => f.cycle === item.view)!.items.find((x) => x.id === item.id)!;
      const key = spec.kind === "map_point" ? `${item.keyEn}: ${spec.mapKey!.point.lat}, ${spec.mapKey!.point.lon}` : `${spec.options.find((o) => o.correct)!.id}: ${item.keyEn}`;
      const answer = !ans ? null : ans.point ? `${ans.point.lat}, ${ans.point.lon}` : `${ans.optionId}: ${tr("en", spec.options.find((o) => o.id === ans.optionId)?.labelFi ?? "")}`;
      return { id: item.id, kind: "freeze", view: item.view, level: item.level, prompt: item.promptEn, answer, key, correct: sc?.correct ?? null, confidence: ans?.confidence ?? null, distanceM: sc?.distanceM === null || sc?.distanceM === undefined ? null : Math.round(sc.distanceM), momentS: item.momentS, keyRecords, anchorSeq: anchor };
    }
    const answered = records.find((r) => r.kind === "spam_answered" && detail<SpamAnsweredDetail>(r).probeId === item.id);
    const response = answered ? detail<SpamAnsweredDetail>(answered).response : null;
    const conf = records.find((r) => r.kind === "recall_confidence_submitted" && detail<RecallConfidenceSubmittedDetail>(r).probeId === item.id);
    const keyId = spamKeys.get(item.id) ?? null;
    const probe = spamProbes.get(item.id);
    const label = (id: string | null) => (id && probe?.response.kind === "categorical" ? tr("en", probe.response.options.find((o) => o.id === id)?.fi ?? "") : "");
    return {
      id: item.id, kind: "spam", view: item.view, level: item.level, prompt: item.promptEn, answer: response ? `${response}: ${label(response)}` : null,
      key: keyId ? `${keyId}: ${label(keyId) || item.keyEn}` : item.keyEn, correct: response && keyId ? response === keyId : null,
      confidence: conf ? detail<RecallConfidenceSubmittedDetail>(conf).value : null, distanceM: null, momentS: item.momentS, keyRecords, anchorSeq: anchor,
    };
  });
  for (const h of haku) {
    h.keyForLaterItems.push(...items.filter((it) => it.anchorSeq !== null && it.anchorSeq > h.seq && it.keyRecords.some((k) => h.retrieved.includes(k.atomId))).map((it) => it.id));
  }
  return { items, haku };
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

function markdown(score: ReturnType<typeof scoreRun>): string {
  const out = ["# Play run — score (ANALYST ONLY: contains the answer keys)", ""];
  const answered = score.items.filter((i) => i.answer !== null);
  out.push(`Answered ${answered.length} of ${score.items.length} items; right ${answered.filter((i) => i.correct).length}. Freeze anchor: \`freeze_started\`; SPAM anchor: \`spam_answered\`.`, "");
  out.push("## Items", "", "| item | V | level | prompt | answer | key | right | conf | key records: had before the moment (design) |", "|---|---|---|---|---|---|---|---|---|");
  for (const i of score.items) {
    const recs = i.keyRecords.map((k) => `${k.atomId} ${k.source} ${k.clock}: **${k.had}**${k.hakuQuestion ? ` ${k.hakuQuestion}` : ""} (${k.design})`).join("<br>") || "—";
    out.push(`| ${i.id} | ${i.view} | ${i.level} | ${cell(i.prompt)} | ${cell(i.answer ?? "—")}${i.distanceM !== null ? ` (${i.distanceM} m)` : ""} | ${cell(i.key)} | ${i.correct === null ? "—" : i.correct ? "yes" : "no"} | ${i.confidence ?? "—"} | ${cell(recs)} |`);
  }
  out.push("", "## Haku questions", "", "| # | V | clock | question | records returned | key record of a later item |", "|---|---|---|---|---|---|");
  for (const h of score.haku) out.push(`| ${h.n} | ${h.view} | ${h.clock} | ${cell(h.question)} | ${h.retrieved.join(", ") || "—"} | ${h.keyForLaterItems.join(", ") || "—"} |`);
  return `${out.join("\n")}\n`;
}

/** Writes `score.md` and `score.json` into the run; notes it (without the keys) in the transcript. Returns the paths. */
export async function writeScore(dir: string, session: PlaySession): Promise<string[]> {
  const records = await session.o.logRecords();
  const score = scoreRun(session, records);
  const md = join(dir, "score.md"), json = join(dir, "score.json");
  writeFileSync(md, markdown(score));
  writeFileSync(json, `${JSON.stringify({ items: score.items, haku: score.haku.map(({ seq: _seq, ...h }) => h) }, null, 1)}\n`);
  appendFileSync(join(dir, "transcript.md"), "\n## score\n\nThe analyst's score was written to score.md and score.json (answer keys; not shown here).\n");
  return [md, json];
}
