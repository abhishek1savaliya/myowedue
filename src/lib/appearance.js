export const FONT_PRESETS = [
  {
    key: "manrope",
    label: "Manrope Editorial",
    body: 'var(--font-body), "Avenir Next", "Segoe UI", sans-serif',
    display: 'var(--font-display), Georgia, serif',
    pdfFamily: "helvetica",
  },
  {
    key: "executive",
    label: "Executive Sans",
    body: '"Avenir Next", "Segoe UI", Arial, sans-serif',
    display: '"Avenir Next", "Segoe UI", Arial, sans-serif',
    pdfFamily: "helvetica",
  },
  {
    key: "garamond",
    label: "Garamond Prestige",
    body: 'Garamond, Baskerville, "Times New Roman", serif',
    display: 'Garamond, Baskerville, "Times New Roman", serif',
    pdfFamily: "times",
  },
  {
    key: "palatino",
    label: "Palatino Ledger",
    body: '"Palatino Linotype", Palatino, "Book Antiqua", serif',
    display: '"Palatino Linotype", Palatino, "Book Antiqua", serif',
    pdfFamily: "times",
  },
  {
    key: "newsroom",
    label: "Newsroom Sans",
    body: '"Lucida Sans", "Lucida Grande", "Trebuchet MS", sans-serif',
    display: '"Lucida Sans", "Lucida Grande", "Trebuchet MS", sans-serif',
    pdfFamily: "helvetica",
  },
  {
    key: "gillsans",
    label: "Gill Sans Luxe",
    body: '"Gill Sans", "Trebuchet MS", sans-serif',
    display: '"Gill Sans", "Trebuchet MS", sans-serif',
    pdfFamily: "helvetica",
  },
  {
    key: "verdana",
    label: "Verdana Clarity",
    body: 'Verdana, Geneva, sans-serif',
    display: 'Verdana, Geneva, sans-serif',
    pdfFamily: "helvetica",
  },
  {
    key: "georgia",
    label: "Georgia Classic",
    body: 'Georgia, "Times New Roman", serif',
    display: 'Georgia, "Times New Roman", serif',
    pdfFamily: "times",
  },
  {
    key: "times",
    label: "Times Signature",
    body: '"Times New Roman", Times, serif',
    display: '"Times New Roman", Times, serif',
    pdfFamily: "times",
  },
  {
    key: "monoluxe",
    label: "Mono Luxe",
    body: '"Courier New", Courier, monospace',
    display: '"Courier New", Courier, monospace',
    pdfFamily: "courier",
  },
];

export const FONT_SIZE_PRESETS = [
  { key: "size-1", label: "Compact 1", scale: 0.78 },
  { key: "size-2", label: "Compact 2", scale: 0.86 },
  { key: "size-3", label: "Compact 3", scale: 0.93 },
  { key: "size-4", label: "Default", scale: 1 },
  { key: "size-5", label: "Comfort 1", scale: 1.08 },
  { key: "size-6", label: "Comfort 2", scale: 1.16 },
  { key: "size-7", label: "Comfort 3", scale: 1.26 },
  { key: "size-8", label: "Large 1", scale: 1.38 },
  { key: "size-9", label: "Large 2", scale: 1.5 },
  { key: "size-10", label: "Large 3", scale: 1.64 },
];

export const DEFAULT_FONT_PRESET = "manrope";
export const DEFAULT_FONT_SIZE_PRESET = "size-4";

export function getFontPreset(key) {
  return FONT_PRESETS.find((item) => item.key === key) || FONT_PRESETS[0];
}

export function getFontSizePreset(key) {
  return FONT_SIZE_PRESETS.find((item) => item.key === key) || FONT_SIZE_PRESETS[3];
}

export function isValidFontPreset(key) {
  return FONT_PRESETS.some((item) => item.key === key);
}

export function isValidFontSizePreset(key) {
  return FONT_SIZE_PRESETS.some((item) => item.key === key);
}
