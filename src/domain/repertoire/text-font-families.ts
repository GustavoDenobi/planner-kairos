export type TextFontFamily = 'sans-serif' | 'serif' | 'monospace' | 'handwritten';

export const DEFAULT_TEXT_FONT_FAMILY: TextFontFamily = 'sans-serif';

export const TEXT_FONT_FAMILIES: TextFontFamily[] = [
  'sans-serif',
  'serif',
  'monospace',
  'handwritten',
];

export const TEXT_FONT_FAMILY_LABELS: Record<TextFontFamily, string> = {
  'sans-serif': 'Sans-serif',
  serif: 'Serif',
  monospace: 'Monoespaçada',
  handwritten: 'Manuscrita',
};

export function isTextFontFamily(value: unknown): value is TextFontFamily {
  return (
    value === 'sans-serif'
    || value === 'serif'
    || value === 'monospace'
    || value === 'handwritten'
  );
}

export function normalizeTextFontFamily(value: unknown): TextFontFamily {
  return isTextFontFamily(value) ? value : DEFAULT_TEXT_FONT_FAMILY;
}

export function nextTextFontFamily(current: TextFontFamily): TextFontFamily {
  const index = TEXT_FONT_FAMILIES.indexOf(current);
  const nextIndex = index >= 0 ? (index + 1) % TEXT_FONT_FAMILIES.length : 0;
  return TEXT_FONT_FAMILIES[nextIndex]!;
}
