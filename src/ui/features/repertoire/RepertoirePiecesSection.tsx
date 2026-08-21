import { Link } from 'react-router-dom';
import type { PieceCategory, PieceListItem, PieceTheme } from '@/domain/repertoire';
import { CategoryBadge } from '@/ui/components/CategoryBadge';
import {
  RepertoireCategoryPicker,
  type RepertoireGroupPickerOption,
} from '@/ui/features/repertoire/RepertoireCategoryPicker';

type RepertoirePiecesSectionProps = {
  orgSlug: string;
  pieces: PieceListItem[];
  categories: PieceCategory[];
  themes: PieceTheme[];
  isLoading: boolean;
  isCategoriesLoading?: boolean;
  showCategoryPicker?: boolean;
  pickerGroups: RepertoireGroupPickerOption[];
  showGroupPicker: boolean;
  resolvedGroupId: string;
  categoryIdsByGroupId: Record<string, string[]>;
  onCategoryPickerSelect?: (selection: { groupId: string; categoryId: string }) => void;
  isAdmin: boolean;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (categoryId: string) => void;
  themeFilter: string;
  onThemeFilterChange: (themeId: string) => void;
  memberCategoryId?: string;
  onOpenCategoryPicker?: () => void;
};

export function RepertoirePiecesSection({
  orgSlug,
  pieces,
  categories,
  themes,
  isLoading,
  isCategoriesLoading = false,
  showCategoryPicker = false,
  pickerGroups,
  showGroupPicker,
  resolvedGroupId,
  categoryIdsByGroupId,
  onCategoryPickerSelect,
  isAdmin,
  searchInput,
  onSearchInputChange,
  categoryFilter,
  onCategoryFilterChange,
  themeFilter,
  onThemeFilterChange,
  memberCategoryId,
  onOpenCategoryPicker,
}: RepertoirePiecesSectionProps) {
  const themeById = new Map(themes.map((theme) => [theme.id, theme]));
  const isMemberView = !isAdmin;

  const memberCategoryLabel = memberCategoryId
    ? (categories.find((category) => category.id === memberCategoryId)?.name ?? 'Categoria')
    : 'Todas';

  const filterSelectClass =
    'w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text';

  if (showCategoryPicker) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {isCategoriesLoading ? (
          <p className="text-sm text-muted">Carregando…</p>
        ) : (
          <RepertoireCategoryPicker
            groups={pickerGroups}
            showGroupPicker={showGroupPicker}
            resolvedGroupId={resolvedGroupId}
            categories={categories}
            categoryIdsByGroupId={categoryIdsByGroupId}
            onSelect={(selection) => onCategoryPickerSelect?.(selection)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            placeholder="Título, compositor ou apelido"
            className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text md:flex-1"
          />

          <div className="grid grid-cols-2 gap-2 md:flex md:min-w-0 md:flex-[2] md:gap-2">
            <label className="min-w-0 md:flex-1">
              <span className="sr-only">Categoria</span>
              {isMemberView ? (
                <button
                  type="button"
                  aria-label="Categoria"
                  onClick={() => onOpenCategoryPicker?.()}
                  className={`${filterSelectClass} text-left`}
                >
                  {memberCategoryLabel}
                </button>
              ) : (
                <select
                  aria-label="Categoria"
                  value={categoryFilter}
                  onChange={(event) => onCategoryFilterChange(event.target.value)}
                  className={filterSelectClass}
                >
                  <option value="">Categorias (tudo)</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              )}
            </label>

            {themes.length > 0 && (
              <label className="min-w-0 md:flex-1">
                <span className="sr-only">Tema</span>
                <select
                  aria-label="Tema"
                  value={themeFilter}
                  onChange={(event) => onThemeFilterChange(event.target.value)}
                  className={filterSelectClass}
                >
                  <option value="">Temas (tudo)</option>
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto border-t border-border pt-3 overscroll-contain">
        {isLoading ? (
          <p className="text-sm text-muted">Carregando…</p>
        ) : pieces.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma obra encontrada.</p>
        ) : (
          <ul className="space-y-2">
            {pieces.map((piece) => (
              <li key={piece.id}>
                <Link
                  to={`/${orgSlug}/repertorio/${piece.id}`}
                  className="block rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-bg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-text">{piece.title}</p>
                      </div>
                      {piece.composer && (
                        <p className="mt-0.5 text-sm text-muted">{piece.composer}</p>
                      )}
                      {piece.themeIds.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {piece.themeIds.map((themeId) => {
                            const theme = themeById.get(themeId);
                            if (!theme) {
                              return null;
                            }
                            return (
                              <span
                                key={themeId}
                                className="rounded-full border border-border px-2 py-0.5 text-xs text-muted"
                              >
                                {theme.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <CategoryBadge
                      label={piece.category.name}
                      color={piece.category.color}
                      slug={piece.category.slug}
                      className="shrink-0"
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
