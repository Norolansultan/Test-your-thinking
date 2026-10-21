/**
 * SPEC/35 §3 item 1: the primer's flow, pure (the screen is `components/PrimerScreen.tsx`). Seven pages, one check question
 * each. A choice is reported with its attempt number (`onCheck(questionId, chosen, correct, attempt)`); a wrong one shows
 * the explanation, and "try again" asks the same question again; a right one lets the participant go on. Back is always
 * possible, and a page already answered stays answered. Leaving a page reports its dwell (`onPage(pageId, dwellMs)`);
 * after the last page's check, "start" leaves it and ends the primer (`onDone`).
 *
 * The dwell is measured without reading a clock (I1, as `pointer-tracker.ts`): from the timestamp of the first animation
 * frame the page is on screen to the timestamp of the click that leaves it — both on the page's own time origin.
 */

export interface PrimerQuestion {
  readonly id: string;
  readonly stem: string;
  readonly options: readonly string[];
  /** The option that is right (index into `options`). */
  readonly correct: number;
  /** Shown after a wrong answer, before the question is asked again. */
  readonly explanation: string;
}

export interface PrimerPage {
  readonly id: string;
  readonly illustration: string;
  readonly title: string;
  readonly body: readonly string[];
  readonly question: PrimerQuestion;
}

/** Where the participant is with one page's question. */
export interface PageProgress {
  readonly answered: boolean;
  /** Choices made so far (the next choice is attempt `attempts + 1`). */
  readonly attempts: number;
  /** The wrong option last chosen while its explanation is on screen; null otherwise. */
  readonly wrong: number | null;
}

export interface PrimerState {
  readonly page: number;
  readonly progress: readonly PageProgress[];
}

export type QuestionPhase = "ask" | "explain" | "answered";

export interface CheckRecord {
  readonly questionId: string;
  readonly chosen: number;
  readonly correct: boolean;
  readonly attempt: number;
}

export function initialPrimerState(pageCount: number): PrimerState {
  return { page: 0, progress: Array.from({ length: pageCount }, () => ({ answered: false, attempts: 0, wrong: null })) };
}

const current = (s: PrimerState): PageProgress => s.progress[s.page]!;
const withProgress = (s: PrimerState, p: PageProgress): PrimerState => ({ ...s, progress: s.progress.map((x, i) => (i === s.page ? p : x)) });

export function questionPhase(s: PrimerState): QuestionPhase {
  const p = current(s);
  return p.answered ? "answered" : p.wrong !== null ? "explain" : "ask";
}

/** A choice on the current page: the next state and the record to report; null when the question is not being asked. */
export function choose(s: PrimerState, pages: readonly PrimerPage[], chosen: number): { readonly state: PrimerState; readonly record: CheckRecord } | null {
  if (questionPhase(s) !== "ask") return null;
  const q = pages[s.page]!.question;
  if (!Number.isInteger(chosen) || chosen < 0 || chosen >= q.options.length) return null;
  const p = current(s);
  const correct = chosen === q.correct;
  const attempt = p.attempts + 1;
  return {
    state: withProgress(s, { answered: correct, attempts: attempt, wrong: correct ? null : chosen }),
    record: { questionId: q.id, chosen, correct, attempt },
  };
}

/** After the explanation: the question is asked again. */
export function retry(s: PrimerState): PrimerState {
  return questionPhase(s) === "explain" ? withProgress(s, { ...current(s), wrong: null }) : s;
}

export function canGoOn(s: PrimerState): boolean {
  return current(s).answered;
}

export function isLastPage(s: PrimerState): boolean {
  return s.page >= s.progress.length - 1;
}

/** Forward: the next page (null after the last page — the primer is done), or the same state while the question is open. */
export function next(s: PrimerState): PrimerState | null {
  if (!canGoOn(s)) return s;
  return isLastPage(s) ? null : { ...s, page: s.page + 1 };
}

export function back(s: PrimerState): PrimerState {
  return s.page > 0 ? { ...s, page: s.page - 1 } : s;
}

/** A page's dwell from its first frame's timestamp to the leaving click's (ms, whole, never negative); 0 when no frame was seen. */
export function dwellMs(enteredAt: number | null, leftAt: number): number {
  return enteredAt === null ? 0 : Math.max(0, Math.round(leftAt - enteredAt));
}

/** The content's own check (`test/explain`): ids unique, every page with a question, its right option among its options. */
export function primerProblems(pages: readonly PrimerPage[]): string[] {
  const problems: string[] = [];
  const pageIds = new Set<string>();
  const questionIds = new Set<string>();
  for (const p of pages) {
    if (pageIds.has(p.id)) problems.push(`page "${p.id}" twice`);
    pageIds.add(p.id);
    if (questionIds.has(p.question.id)) problems.push(`question "${p.question.id}" twice`);
    questionIds.add(p.question.id);
    if (!p.title.trim() || p.body.length === 0) problems.push(`page "${p.id}" has no title or text`);
    const q = p.question;
    if (q.options.length < 2) problems.push(`question "${q.id}" has fewer than two options`);
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) problems.push(`question "${q.id}": the right option is not one of its options`);
    if (!q.explanation.trim()) problems.push(`question "${q.id}" has no explanation`);
  }
  return problems;
}
