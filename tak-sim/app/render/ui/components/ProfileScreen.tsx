/**
 * SPEC/35 §4: the commander profile after the questionnaire (public sessions). Placeholder until work package P3
 * replaces it; the props are the contract's (`audience-context.ts`).
 */

import type { ProfileScreenProps } from "../audience-context.js";

export function ProfileScreen({ lang, onDone }: ProfileScreenProps) {
  return (
    <div data-testid="profile-screen" style={{ padding: 24 }}>
      <button type="button" onClick={onDone}>{lang === "fi" ? "Jatka" : "Continue"}</button>
    </div>
  );
}
