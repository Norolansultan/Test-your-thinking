/**
 * The demonstration's version switch (SPEC/35 §2, 21 Oct 2026): one simulation for everyone; the public-audience version is the
 * same session with more explanation (primer, glossary, profile). On the demonstration start page a segmented choice above the
 * group buttons picks it for either group, default professional; under `?tuotanto` it is never shown and never applies (a study
 * link chooses the version with `?yleiso` only). It replaces the start page's game-mode button and its public-version checkbox.
 * Hook-free, so a test renders it by calling it.
 */

import type { Audience } from "../../session/public-session.js";
import type { Lang } from "../../i18n/lang.js";

/** The switch's texts. fi DRAFT (native and domain review pending). */
export const VERSION_SWITCH_TEXT: Readonly<Record<Lang, { readonly label: string; readonly professional: string; readonly public: string }>> = {
  fi: { label: "Versio", professional: "Ammattilaisversio", public: "Yleisöversio" },
  en: { label: "Version", professional: "Professional version", public: "Public version" },
};

/** The audience a start from the start page passes to the launcher: the switch's choice in a demonstration, nothing in the study. */
export function demoAudience(publicVersion: boolean, study: boolean): { readonly audience?: Audience } {
  return study ? {} : { audience: publicVersion ? "public" : "expert" };
}

const segment = (on: boolean) => ({
  padding: "8px 18px", fontSize: 14, border: "none", cursor: "pointer",
  background: on ? "#19c3d6" : "#2a2f34", color: on ? "#0d1114" : "#e8eaed", fontWeight: on ? 600 : 400,
});

/** The segmented choice: Professional version | Public version. `onChange(true)` chooses the public version. */
export function VersionSwitch({ lang, publicVersion, onChange }: {
  readonly lang: Lang; readonly publicVersion: boolean; readonly onChange: (publicVersion: boolean) => void;
}) {
  const t = VERSION_SWITCH_TEXT[lang];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
      <span id="version-switch-label">{t.label}</span>
      <div role="radiogroup" aria-labelledby="version-switch-label" data-testid="public-demo-toggle"
        style={{ display: "flex", border: "1px solid #3a3f44", borderRadius: 8, overflow: "hidden" }}>
        <button type="button" role="radio" aria-checked={!publicVersion} data-testid="version-professional" style={segment(!publicVersion)} onClick={() => onChange(false)}>{t.professional}</button>
        <button type="button" role="radio" aria-checked={publicVersion} data-testid="version-public" style={segment(publicVersion)} onClick={() => onChange(true)}>{t.public}</button>
      </div>
    </div>
  );
}
