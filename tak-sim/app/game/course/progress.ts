/**
 * Game mode, SPEC/34 §2: the player's progress — modules passed, decision tasks done and their best grade — under the
 * key `PROGRESS_KEY` (prefix `PROGRESS_KEY_PREFIX`) in a `ProgressStorage`. Every read and write is in try/catch, and
 * the page works without a storage: progress then lasts the visit (`memoryStorage`). Nothing here goes to the study's
 * stores, its telemetry or a server.
 *
 * The one browser store the game may use (`test/game-ui/isolation.spec.ts` allows this file only, and only the
 * `localStorage` key under `PROGRESS_KEY_PREFIX`): the study's IndexedDB store and its session keys are never touched.
 */

import { PROGRESS_KEY_PREFIX, type TaskResult } from "../tasks/contracts.js";

export type Grade = TaskResult["grade"];

export interface GameProgress {
  /** Module ids, in the order they were passed. */
  readonly modulesPassed: readonly string[];
  /** Decision tasks (and course exercises) done, with the best grade so far. */
  /** `passed`: every criterion met in at least one run. */
  readonly tasks: readonly { readonly id: string; readonly best: Grade; readonly passed?: boolean }[];
}

/** The one storage key. */
export const PROGRESS_KEY = `${PROGRESS_KEY_PREFIX}progress`;

export const EMPTY_PROGRESS: GameProgress = { modulesPassed: [], tasks: [] };

const GRADES: readonly Grade[] = ["S", "A", "B", "C", "D", "F"];

/** The part of `Storage` the store uses (tests pass a fake). */
export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** A storage that lasts as long as the page (the visit). */
export function memoryStorage(): ProgressStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => { items.set(key, value); },
  };
}

const VISIT = memoryStorage();

/** The browser's `localStorage` when it can be reached, else the visit's memory (private windows, blocked storage). */
export function defaultStorage(): ProgressStorage | null {
  try {
    const ls = globalThis.localStorage;
    if (ls) return ls;
  } catch {
    // blocked: fall through to the visit's memory
  }
  return VISIT;
}

const isString = (v: unknown): v is string => typeof v === "string";

/** A stored value checked field by field; anything malformed is dropped. */
export function parseProgress(raw: string | null): GameProgress {
  if (raw === null) return EMPTY_PROGRESS;
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return EMPTY_PROGRESS;
  }
  if (typeof j !== "object" || j === null) return EMPTY_PROGRESS;
  const o = j as { modulesPassed?: unknown; tasks?: unknown };
  const modulesPassed = Array.isArray(o.modulesPassed) ? o.modulesPassed.filter(isString) : [];
  const tasks: { id: string; best: Grade }[] = [];
  if (Array.isArray(o.tasks)) {
    for (const t of o.tasks as unknown[]) {
      const r = t as { id?: unknown; best?: unknown } | null;
      if (r && isString(r.id) && isString(r.best) && GRADES.includes(r.best as Grade)) {
        tasks.push({ id: r.id, best: r.best as Grade, ...((r as { passed?: unknown }).passed === true ? { passed: true } : {}) });
      }
    }
  }
  return { modulesPassed: [...new Set(modulesPassed)], tasks };
}

export function loadProgress(storage: ProgressStorage | null = defaultStorage()): GameProgress {
  if (storage === null) return EMPTY_PROGRESS;
  try {
    return parseProgress(storage.getItem(PROGRESS_KEY));
  } catch {
    return EMPTY_PROGRESS;
  }
}

/** Saves; false when the browser would not keep it (the page carries on with the progress in memory). */
export function saveProgress(p: GameProgress, storage: ProgressStorage | null = defaultStorage()): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

export function modulePassed(p: GameProgress, id: string): boolean {
  return p.modulesPassed.includes(id);
}

export function withModulePassed(p: GameProgress, id: string): GameProgress {
  return modulePassed(p, id) ? p : { ...p, modulesPassed: [...p.modulesPassed, id] };
}

export function bestGrade(p: GameProgress, id: string): Grade | null {
  return p.tasks.find((t) => t.id === id)?.best ?? null;
}

/** The better of two grades (S best, F worst). */
export function better(a: Grade, b: Grade): Grade {
  return GRADES.indexOf(a) <= GRADES.indexOf(b) ? a : b;
}

export function withTaskResult(p: GameProgress, id: string, grade: Grade, passed = false): GameProgress {
  const prevRow = p.tasks.find((t) => t.id === id);
  const best = prevRow === undefined ? grade : better(prevRow.best, grade);
  const everPassed = passed || prevRow?.passed === true;
  if (prevRow !== undefined && prevRow.best === best && (prevRow.passed === true) === everPassed) return p;
  return { ...p, tasks: [...p.tasks.filter((t) => t.id !== id), { id, best, ...(everPassed ? { passed: true } : {}) }] };
}

/** Whether task `id` has been passed (every criterion met) at least once. */
export function taskPassed(p: GameProgress, id: string): boolean {
  return p.tasks.find((t) => t.id === id)?.passed === true;
}
