import type { EventKind } from '@/domain/agenda';
import { resolveEventColor } from '@/domain/agenda';
import {
  categoryBackgroundColor,
  contrastingTextColor,
  parseCategoryHue,
} from '@/ui/features/repertoire/category-color';

export function eventTypeBadgeStyle(type: {
  kind: EventKind;
  color: string | null;
  name: string;
}): { backgroundColor: string; color: '#ffffff' | '#18181b' } {
  const colorToken = resolveEventColor(type);
  const hue = parseCategoryHue(colorToken, type.kind);
  return {
    backgroundColor: categoryBackgroundColor(hue),
    color: contrastingTextColor(hue),
  };
}
