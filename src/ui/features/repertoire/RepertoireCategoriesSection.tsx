import type { PieceCategory } from '@/domain/repertoire';
import { CategoryBadge } from '@/ui/components/CategoryBadge';
import { IconPencil, IconPlus } from '@/ui/components/icons';
import { SortableDragHandle, SortableList } from '@/ui/components/SortableList';

type RepertoireCategoriesSectionProps = {
  categories: PieceCategory[];
  onCreate: () => void;
  onEdit: (category: PieceCategory) => void;
  onReorder: (categories: PieceCategory[]) => void;
  isReordering?: boolean;
  reorderError?: string | null;
};

export function RepertoireCategoriesSection({
  categories,
  onCreate,
  onEdit,
  onReorder,
  isReordering = false,
  reorderError = null,
}: RepertoireCategoriesSectionProps) {
  return (
    <div className="space-y-4">
      {categories.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma categoria cadastrada.</p>
      ) : (
        <SortableList
          items={categories}
          onReorder={onReorder}
          disabled={isReordering}
          ariaLabel="Categorias"
          className="space-y-2"
          renderItem={(category, handle) => (
            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface py-2 pr-3 pl-1.5">
              <SortableDragHandle {...handle} label={`Reordenar ${category.name}`} />
              <div className="min-w-0 flex-1">
                <CategoryBadge
                  label={category.name}
                  color={category.color}
                  slug={category.slug}
                />
              </div>
              <button
                type="button"
                onClick={() => onEdit(category)}
                className="shrink-0 text-muted hover:text-text"
                aria-label={`Editar ${category.name}`}
              >
                <IconPencil className="h-4 w-4" />
              </button>
            </div>
          )}
        />
      )}
      {reorderError && <p className="text-sm text-red-600">{reorderError}</p>}
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
