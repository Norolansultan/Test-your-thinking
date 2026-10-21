/**
 * SPEC/35 §3 item 1: the primer before the practice view (public sessions). Placeholder until work package P2
 * replaces it; the props are the contract's (`audience-context.ts`).
 */

import type { PrimerScreenProps } from "../audience-context.js";

export function PrimerScreen({ lang, onDone }: PrimerScreenProps) {
  return (
    <div data-testid="primer-screen" style={{ padding: 24 }}>
      <button type="button" onClick={onDone}>{lang === "fi" ? "Jatka" : "Continue"}</button>
    </div>
  );
}
