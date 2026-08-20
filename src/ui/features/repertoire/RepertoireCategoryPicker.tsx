import type { PieceCategory } from '@/domain/repertoire';
import {
  categoryCardStyle,
  neutralCategoryCardStyle,
} from '@/ui/features/repertoire/category-color';

type RepertoireCategoryPickerProps = {
  categories: PieceCategory[];
  onSelect: (categoryId: string) => void;
};

const cardClassName =
  'rounded-xl border-2 px-4 py-10 text-center text-xl lg:text-2xl  font-semibold text-text transition-colors hover:brightness-110 active:brightness-95 sm:text-xl ';

export function RepertoireCategoryPicker({ categories, onSelect }: RepertoireCategoryPickerProps) {
  const neutralStyle = neutralCategoryCardStyle();

  return (
    <div className="w-full">
      <p className="mb-4 text-center text-lg text-muted">Selecione uma categoria</p>
      <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => onSelect('')}
          className={cardClassName}
          style={neutralStyle}
        >
          Todas
        </button>
        {categories.map((category) => {
          const cardStyle = categoryCardStyle(category.color, category.slug);

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.id)}
              className={cardClassName}
              style={cardStyle}
            >
              {category.name}
            </button>
          );
        })}
      </div>
      {categories.length === 0 && (
        <p className="mt-3 text-sm text-muted">Nenhuma categoria cadastrada.</p>
      )}
    </div>
  );
}
