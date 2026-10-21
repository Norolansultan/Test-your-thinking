/**
 * Game mode, SPEC/34 §4: the decision-task screen — planning (paused), commit, run to the horizon, result with the
 * reference. Placeholder until the tasks work package replaces it; the props are the contract's.
 */

import type { TaskScreenProps } from "./contracts.js";

export function TaskScreen({ lang, task, onBack }: TaskScreenProps) {
  return (
    <div data-testid="task-screen" style={{ padding: 24 }}>
      <h2>{lang === "fi" ? task.titleFi : task.titleEn}</h2>
      <button type="button" onClick={onBack}>{lang === "fi" ? "Takaisin" : "Back"}</button>
    </div>
  );
}
