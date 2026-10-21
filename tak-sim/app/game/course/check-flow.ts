/**
 * Game mode, SPEC/34 §3: the check questions' flow — one question at a time; a wrong answer shows the explanation and
 * the same question again; the module is passed when every question has been answered right once.
 */

import type { CheckQuestion } from "../tasks/contracts.js";

export interface CheckState {
  /** The question shown. */
  readonly index: number;
  /** The option picked for it (null: not answered yet). */
  readonly picked: number | null;
  /** Per question: answered right once. */
  readonly right: readonly boolean[];
}

export function startChecks(n: number): CheckState {
  return { index: 0, picked: null, right: new Array<boolean>(n).fill(false) };
}

/** The player picks `option` for the shown question. */
export function pickOption(s: CheckState, questions: readonly CheckQuestion[], option: number): CheckState {
  if (s.picked !== null) return s;
  const q = questions[s.index];
  if (q === undefined) return s;
  const right = q.correct === option ? s.right.map((r, i) => (i === s.index ? true : r)) : s.right;
  return { ...s, picked: option, right };
}

/** After the feedback: a wrong answer asks the same question again; a right one moves to the next not yet answered right. */
export function nextQuestion(s: CheckState, questions: readonly CheckQuestion[]): CheckState {
  if (s.picked === null) return s;
  const q = questions[s.index];
  if (q === undefined || s.picked !== q.correct) return { ...s, picked: null };
  for (let k = 1; k <= questions.length; k++) {
    const i = (s.index + k) % questions.length;
    if (!s.right[i]) return { ...s, index: i, picked: null };
  }
  return { ...s, picked: null };
}

export function checksPassed(s: CheckState): boolean {
  return s.right.length > 0 && s.right.every((r) => r);
}
