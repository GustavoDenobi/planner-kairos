/** Distinct hues for navigation shortcut buttons and target markers. */
export const NAVIGATION_SHORTCUT_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#ca8a04',
  '#db2777',
  '#4f46e5',
  '#0d9488',
] as const;

export function navigationShortcutColorForIndex(index: number): string {
  return NAVIGATION_SHORTCUT_COLORS[index % NAVIGATION_SHORTCUT_COLORS.length]!;
}

export function pickNavigationShortcutColor(usedColors: Iterable<string>): string {
  const used = new Set(usedColors);
  const nextUnused = NAVIGATION_SHORTCUT_COLORS.find((color) => !used.has(color));
  if (nextUnused) {
    return nextUnused;
  }
  return navigationShortcutColorForIndex(used.size);
}

export function resolveNavigationShortcutColor(
  color: string | null | undefined,
  sortOrder: number,
): string {
  if (color && NAVIGATION_SHORTCUT_COLORS.includes(color as (typeof NAVIGATION_SHORTCUT_COLORS)[number])) {
    return color;
  }
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }
  return navigationShortcutColorForIndex(sortOrder);
}
