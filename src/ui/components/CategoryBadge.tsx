import {
  categoryBackgroundColor,
  contrastingTextColor,
  parseCategoryHue,
} from '@/ui/features/repertoire/category-color';

type CategoryBadgeProps = {
  label: string;
  color: string | null;
  slug: string;
  className?: string;
};

export function CategoryBadge({ label, color, slug, className = '' }: CategoryBadgeProps) {
  const hue = parseCategoryHue(color, slug);
  const backgroundColor = categoryBackgroundColor(hue);
  const textColor = contrastingTextColor(hue);

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
      style={{ backgroundColor, color: textColor }}
    >
      {label}
    </span>
  );
}
