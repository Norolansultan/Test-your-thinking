/**
 * The TAK shell's colours and sizes (SPEC/28 §5, after ATAK / WinTAK): near-black panels, cyan/teal accents, white
 * text, large touch targets. The map's own fire and projection colours stay `fire-theme.json`'s (SPEC/12); nothing here
 * styles them.
 */

export const TAK = {
  /** Panels and bars. */
  panel: "#0d1114",
  panelRaised: "#151b20",
  panelBorder: "#26313a",
  row: "#111619",
  rowHover: "#18222a",
  /** Text. */
  text: "#f2f5f7",
  textDim: "#9fb0bb",
  /** The accent: ATAK's cyan/teal. */
  accent: "#19c3d6",
  accentDim: "#0f7f8c",
  accentInk: "#031417",
  /** Own forces on the map (the classic shell's own-formation hue, so plan marks read as own). */
  own: "#4fb3ff",
  /** The Range & Bearing line. */
  rb: "#ffd400",
  warn: "#f4a261",
  /** Sizes, px. */
  toolbarWidth: 76,
  toolButtonHeight: 60,
  /** The side pane's width: about 380 px, never more than the map can spare. */
  paneWidth: "clamp(300px, 28vw, 380px)",
  radius: 4,
  mono: "ui-monospace, 'Cascadia Mono', Consolas, monospace",
} as const;
