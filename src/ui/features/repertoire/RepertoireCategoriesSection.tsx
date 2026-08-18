import type { PieceCategory } from '@/domain/repertoire';
import { IconPencil, IconPlus } from '@/ui/components/icons';
import { CategoryBadge } from '@/ui/components/CategoryBadge';

type RepertoireCategoriesSectionProps = {
  categories: PieceCategory[];
  onCreate: () => void;
  onEdit: (category: PieceCategory) => void;
};

export function RepertoireCategoriesSection({
  categories,
  onCreate,
  onEdit,
}: RepertoireCategoriesSectionProps) {
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
          >
            <CategoryBadge label={category.name} color={category.color} slug={category.slug} />
            <button
              type="button"
              onClick={() => onEdit(category)}
              className="text-muted hover:text-text"
              aria-label={`Editar ${category.name}`}
            >
              <IconPencil className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-center">
        <button
            type="button"
            onClick={onCreate}
            className="inline-flex shrink-0 gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            <IconPlus className="h-4 w-4" />
            Categoria
        </button>
      </div>
    </div>
  );
}
