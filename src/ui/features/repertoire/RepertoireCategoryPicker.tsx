import type { PieceCategory } from '@/domain/repertoire';
import { categoryCardStyle } from '@/ui/features/repertoire/category-color';

type RepertoireCategoryPickerProps = {
  categories: PieceCategory[];
  onSelect: (categoryId: string) => void;
};

export function RepertoireCategoryPicker({ categories, onSelect }: RepertoireCategoryPickerProps) {
  if (categories.length === 0) {
    return <p className="text-sm text-muted">Nenhuma categoria cadastrada.</p>;
  }

  return (
    <div className="w-full">
      <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {categories.map((category) => {
          const cardStyle = categoryCardStyle(category.color, category.slug);

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.id)}
              className="rounded-xl border-2 px-4 py-10 text-center text-lg font-semibold text-text transition-colors hover:brightness-110 active:brightness-95 sm:text-xl"
              style={cardStyle}
            >
              {category.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
