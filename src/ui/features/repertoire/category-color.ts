export const CATEGORY_HUE_SATURATION = 65;
export const CATEGORY_HUE_LIGHTNESS = 45;
export const DEFAULT_CATEGORY_HUE = 220;

const LEGACY_HUE_BY_TOKEN: Record<string, number> = {
  'blue-500': 220,
  'amber-500': 38,
  'emerald-500': 160,
  'violet-500': 270,
};

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = s * Math.min(l, 1 - l);

  const hueToChannel = (offset: number) => {
    const k = (offset + hue / 30) % 12;
    return l - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };

  return [hueToChannel(0) * 255, hueToChannel(8) * 255, hueToChannel(4) * 255];
}

function relativeLuminance(red: number, green: number, blue: number): number {
  const normalize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  const [r, g, b] = [red, green, blue].map(normalize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function categoryBackgroundColor(
  hue: number,
  saturation = CATEGORY_HUE_SATURATION,
  lightness = CATEGORY_HUE_LIGHTNESS,
): string {
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export function contrastingTextColor(
  hue: number,
  saturation = CATEGORY_HUE_SATURATION,
  lightness = CATEGORY_HUE_LIGHTNESS,
): '#ffffff' | '#18181b' {
  const [red, green, blue] = hslToRgb(hue, saturation, lightness);
  return relativeLuminance(red, green, blue) > 0.45 ? '#18181b' : '#ffffff';
}

export function categoryBadgeStyle(
  color: string | null,
  slug: string,
): { backgroundColor: string; color: '#ffffff' | '#18181b' } {
  const hue = parseCategoryHue(color, slug);
  return {
    backgroundColor: categoryBackgroundColor(hue),
    color: contrastingTextColor(hue),
  };
}

export function categoryCardStyle(
  color: string | null,
  slug: string,
): { borderColor: string; backgroundColor: string } {
  const hue = parseCategoryHue(color, slug);
  return {
    borderColor: categoryBackgroundColor(hue),
    backgroundColor: `hsl(${hue} ${CATEGORY_HUE_SATURATION}% ${CATEGORY_HUE_LIGHTNESS}% / 0.25)`,
  };
}

export function parseCategoryHue(color: string | null | undefined, slug: string): number {
  if (color) {
    const numeric = Number(color);
    if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 360) {
      return Math.round(numeric);
    }

    const legacyHue = LEGACY_HUE_BY_TOKEN[color];
    if (legacyHue !== undefined) {
      return legacyHue;
    }
  }

  const fallbackHues = [220, 38, 160, 270];
  const index = slug.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return fallbackHues[index % fallbackHues.length];
}

export function formatCategoryHue(hue: number): string {
  return String(Math.round(hue));
}
