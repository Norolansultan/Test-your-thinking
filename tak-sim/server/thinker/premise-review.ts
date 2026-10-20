/**
 * `POST /api/thinker/premise-review` (SPEC/32 §3, 20 Oct 2026): the guide group's premise lines at the plan review. A lookup
 * in the premise-evidence table (`premise-check.ts`, SPEC/30 §3) at the view's records clock — the same clock the Open
 * Thinker's premise check reads (`receivedUpToOf` over the records the time gate releases at the request's virtual time) —
 * shown in the same fixed template (`premiseLines`). No model call, no retrieval: the client sends no records and no text.
 *
 * Refused (HTTP 400): any cell but `reasoning_intent`, a view outside V8–V14, a virtual time outside the view, and a table code
 * whose cell is not the request's (SPEC/27 §2.2, `allocationError`). One JSON line per answered request in the session's
 * Thinker log (`tool: "premise_review"`), as every Thinker request is logged. Transport-free, so tests call it directly.
 */

import { reachableAtoms, stepAtVirtualTime } from "../../app/retrieval/time-gate.js";
import { validatePremiseReviewRequest, type PremiseReviewResponse } from "../../app/session/thinker-protocol.js";
import { loadDirectivePremises } from "./directive-premises.js";
import { allocationError, type ThinkerDeps } from "./handler.js";
import { receivedUpToOf } from "./model.js";
import { loadPremiseEvidence, premiseCheck, premiseLines, recordLookupOf } from "./premise-check.js";

export type PremiseReviewHandlerResult =
  | { readonly status: 200; readonly body: PremiseReviewResponse }
  | { readonly status: 400; readonly body: { readonly error: string } };

/** What the lookup reads from the Thinker's deps: never the model client. */
export type PremiseReviewDeps = Pick<ThinkerDeps, "scenario" | "directivePremises" | "premiseEvidence" | "appendLog" | "nowMs" | "nowIso">;

export async function handlePremiseReviewRequest(deps: PremiseReviewDeps, body: unknown): Promise<PremiseReviewHandlerResult> {
  const started = deps.nowMs();
  const valid = validatePremiseReviewRequest(body);
  if (!valid.ok) return { status: 400, body: { error: valid.error } };
  const req = valid.request;
  const refused = allocationError(req);
  if (refused) return { status: 400, body: { error: refused } };
  const view = deps.scenario.cycles.find((c) => c.index === req.view);
  const step = view ? stepAtVirtualTime(view, req.virtualTimeS) : null;
  if (step === null) return { status: 400, body: { error: "virtualTimeS is outside the view" } };

  const lang = req.language ?? "fi";
  const evidence = deps.premiseEvidence ?? loadPremiseEvidence();
  const premises = deps.directivePremises ?? loadDirectivePremises();
  // The records clock: the latest observation among the records the time gate releases at the request's virtual time.
  const recordsClockS = receivedUpToOf(reachableAtoms(deps.scenario.atoms, step), req.virtualTimeS);
  const items = premiseCheck(evidence, req.view, recordsClockS);
  if (items === null) return { status: 400, body: { error: `the premise-evidence table has no entry for V${req.view}` } };
  const response: PremiseReviewResponse = {
    lines: premiseLines(items, premises, recordLookupOf(deps.scenario.atoms), lang),
    statuses: items.map((i) => ({ premiseId: i.id, status: i.status, atomIds: [...i.atomIds] })),
    tableSha256: evidence.sha256,
  };
  await deps.appendLog(req.sessionId, {
    loggedAt: deps.nowIso(),
    tool: "premise_review",
    sessionId: req.sessionId,
    cell: req.cell,
    ...(req.participantCode !== undefined ? { participantCode: req.participantCode } : {}),
    view: req.view,
    virtualTimeS: req.virtualTimeS,
    step,
    language: lang,
    premisesSha256: premises.sha256,
    premiseEvidenceVersion: evidence.version,
    premiseEvidenceSha256: evidence.sha256,
    premiseRecordsClockS: recordsClockS,
    premiseStatuses: response.statuses,
    lines: response.lines,
    modelCalled: false,
    latencyMs: Math.round(deps.nowMs() - started),
  });
  return { status: 200, body: response };
}
