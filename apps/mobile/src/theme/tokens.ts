/**
 * Crucible design tokens — "cold steel cockpit". Ported from the HTML prototype
 * (crucible-scan-capture.html). Dark-default; mono for all numbers (instrument feel).
 */
export const color = {
  void: "#0B0E12",
  slate: "#141921",
  slate2: "#1C232E",
  line: "#2A333F",
  ash: "#6B7787",
  fog: "#9DA9B7",
  bone: "#EAEEF3",
  endure: "#3DA5D9",
  strength: "#E8703A",
  green: "#4ADE80",
  amber: "#F5B544",
  red: "#F2545B",
} as const;

/** Verdict colour by readiness. */
export const verdictColor = {
  green: color.green,
  amber: color.amber,
  red: color.red,
} as const;

/**
 * Font families. On web these resolve to the Google Fonts loaded in _layout.
 * (Native will switch to @expo-google-fonts when we turn on iOS.)
 */
export const font = {
  ui: "Archivo, system-ui, sans-serif",
  display: "Archivo Expanded, Archivo, system-ui, sans-serif",
  mono: "Space Mono, ui-monospace, monospace",
} as const;

export const radius = { sm: 10, md: 12, lg: 18, pill: 999 } as const;
