/**
 * SPEC/34 §2: the progress store — modules passed, tasks done with their best grade — under the `tak-game.` prefix;
 * every read and write in try/catch, so a storage that throws (blocked site data) or holds garbage leaves the page
 * working.
 */

import { describe, expect, it } from "vitest";
import {
  bestGrade, EMPTY_PROGRESS, loadProgress, memoryStorage, modulePassed, parseProgress, PROGRESS_KEY, saveProgress,
  withModulePassed, withTaskResult, type ProgressStorage,
} from "../../app/game/course/progress.js";
import { PROGRESS_KEY_PREFIX } from "../../app/game/tasks/contracts.js";

const throwing: ProgressStorage = {
  getItem: () => { throw new Error("SecurityError: storage is blocked"); },
  setItem: () => { throw new Error("QuotaExceededError"); },
};

describe("the progress store", () => {
  it("keeps its one key under the game's prefix", () => {
    expect(PROGRESS_KEY.startsWith(PROGRESS_KEY_PREFIX)).toBe(true);
    expect(PROGRESS_KEY_PREFIX).toBe("tak-game.");
  });

  it("round-trips modules passed and the best grade per task", () => {
    const store = memoryStorage();
    let p = withModulePassed(EMPTY_PROGRESS, "map");
    p = withModulePassed(p, "map");
    p = withTaskResult(p, "course-map", "C");
    p = withTaskResult(p, "course-map", "A");
    p = withTaskResult(p, "course-map", "D"); // a worse later run keeps the best
    expect(saveProgress(p, store)).toBe(true);
    const back = loadProgress(store);
    expect(back.modulesPassed).toEqual(["map"]);
    expect(modulePassed(back, "map")).toBe(true);
    expect(modulePassed(back, "fire")).toBe(false);
    expect(bestGrade(back, "course-map")).toBe("A");
    expect(bestGrade(back, "nope")).toBeNull();
  });

  it("survives a storage that throws on every read and write", () => {
    expect(loadProgress(throwing)).toEqual(EMPTY_PROGRESS);
    expect(saveProgress(withModulePassed(EMPTY_PROGRESS, "map"), throwing)).toBe(false);
    expect(loadProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(saveProgress(EMPTY_PROGRESS, null)).toBe(false);
  });

  it("drops malformed stored values instead of failing", () => {
    expect(parseProgress("{not json")).toEqual(EMPTY_PROGRESS);
    expect(parseProgress("42")).toEqual(EMPTY_PROGRESS);
    expect(parseProgress("null")).toEqual(EMPTY_PROGRESS);
    const p = parseProgress(JSON.stringify({ modulesPassed: ["map", 3, "map", "fire"], tasks: [{ id: "a", best: "B" }, { id: "b", best: "Z" }, null, { id: 5, best: "A" }] }));
    expect(p.modulesPassed).toEqual(["map", "fire"]);
    expect(p.tasks).toEqual([{ id: "a", best: "B" }]);
  });

  it("works with the game's default (the visit's memory) when no storage is passed", () => {
    const p = withModulePassed(EMPTY_PROGRESS, "recon");
    expect(saveProgress(p)).toBe(true);
    expect(modulePassed(loadProgress(), "recon")).toBe(true);
  });
});
