/** The decision strip's shared parts: the panel frame, buttons, choice chips and the one confidence scale. */

import type { ComponentChildren } from "preact";
import { CONFIDENCE_SCALE } from "../../../session/confidence.js";
import { useLang } from "../i18n.js";
import type { HoverHandlers } from "./hover-dwell.js";

export function Panel({ children, compact = false }: { readonly children: ComponentChildren; readonly compact?: boolean }) {
  return (
    <div data-tour="decision" style={{ padding: compact ? "8px 16px" : "12px 16px", borderTop: "1px solid #33383e", background: "#20242a", flexShrink: 0 }}>
      {children}
    </div>
  );
}

export const hint = { margin: "0 0 8px 0", fontSize: 13, opacity: 0.8 };
export const label = { fontSize: 11, opacity: 0.65, margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: 0.5 } as const;

export function PrimaryButton({ children, onClick, disabled }: { readonly children: ComponentChildren; readonly onClick: () => void; readonly disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #3a3f44", background: disabled ? "#1b1e22" : "#2a2f34", color: disabled ? "#5a5f66" : "#e8eaed", cursor: disabled ? "default" : "pointer", fontSize: 13 }}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick }: { readonly children: ComponentChildren; readonly onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #33383e", background: "#1b1e22", color: "#e8eaed", cursor: "pointer", fontSize: 13, textAlign: "left" }}>
      {children}
    </button>
  );
}

/**
 * `compact`: a smaller button for the plan panel's one-line rows (6 Oct 2026: more room for the map). `hover` (SPEC/30
 * §5.4): the option's pointer handlers for its hover record (`hover-dwell.ts`).
 */
export function Choice({ children, selected, onClick, compact = false, hover }: { readonly children: ComponentChildren; readonly selected: boolean; readonly onClick: () => void; readonly compact?: boolean; readonly hover?: HoverHandlers }) {
  return (
    <button
      onClick={onClick}
      {...(hover ? { onPointerEnter: hover.onPointerEnter, onPointerLeave: hover.onPointerLeave } : {})}
      aria-pressed={selected}
      style={{ padding: compact ? "3px 7px" : "6px 8px", borderRadius: 6, fontSize: compact ? 11.5 : 12, cursor: "pointer", color: "#e8eaed", border: `1px solid ${selected ? "#8a9097" : "#33383e"}`, background: selected ? "#3a3f44" : "#1b1e22" }}
    >
      {children}
    </button>
  );
}

/** The one confidence scale (`session/confidence.ts`): all four steps every time, none preselected. */
export function ConfidencePicker({ value, onChange }: { readonly value: number | null; readonly onChange: (v: number) => void }) {
  const { t } = useLang();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, opacity: 0.8, width: 70 }}>{t.confidence}</span>
      {CONFIDENCE_SCALE.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-pressed={value === c}
          style={{
            padding: "4px 12px", borderRadius: 12, fontSize: 12, cursor: "pointer", color: "#e8eaed",
            border: `1px solid ${value === c ? "#8a9097" : "#33383e"}`, background: value === c ? "#3a3f44" : "#20242a",
          }}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

/** The confidence scale with its own confirm button. */
export function ConfidenceRow({ value, onChange, onConfirm, disabled = false, confirmLabel }: {
  readonly value: number | null; readonly onChange: (v: number) => void; readonly onConfirm: () => void; readonly disabled?: boolean; readonly confirmLabel?: string;
}) {
  const { t } = useLang();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <ConfidencePicker value={value} onChange={onChange} />
      <span style={{ flex: 1 }} />
      <PrimaryButton onClick={onConfirm} disabled={disabled || value === null}>{confirmLabel ?? t.confirm}</PrimaryButton>
    </div>
  );
}
