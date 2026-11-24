import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import type {
  PieceCategory,
  PieceListItem,
  PieceTheme,
  RepertoirePieceMembership,
} from '@/domain/repertoire';
import { isRepertoireUnlinkedFilter } from '@/domain/repertoire/repertoire-filters';
import {
  resolveRepertoireCategoryChoices,
  resolveRepertoireGroupChoices,
} from '@/domain/repertoire/repertoire-picker-counts';
import { CategoryBadge } from '@/ui/components/CategoryBadge';
import {
  RepertoireCategoryPickerSkeleton,
  RepertoirePieceRowsSkeleton,
} from '@/ui/components/skeletons/page-list-skeletons';
import {
  RepertoireCategoryPicker,
  type RepertoireGroupPickerOption,
} from '@/ui/features/repertoire/RepertoireCategoryPicker';
import {
  REPERTOIRE_UNLINKED_FILTER,
  REPERTOIRE_UNLINKED_LABEL,
} from '@/ui/features/repertoire/repertoire-filter-ids';
import type { PieceListSort } from '@/domain/repertoire';
import { PIECE_LIST_SORT_OPTIONS } from '@/ui/features/repertoire/repertoire-labels';
import { useScrollRestoration } from '@/ui/hooks/useScrollRestoration';
import { scrollContentEndPaddingClass } from '@/ui/layouts/OrgListPageLayout';

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
  implicitGroupId: string;
  pieceMemberships: RepertoirePieceMembership[];
  /** Escopo de grupo aplicado à lista ('' = todos). */
  groupScope: string;
  /** Grupo escolhido no seletor (da URL); `null` = etapa de grupos. */
  pickerSelectedGroupId: string | null;
  onPickerSelectGroup: (groupId: string) => void;
  onPickerBackToGroups: () => void;
  onCategoryPickerSelect: (
    selection: { groupId: string; categoryId: string },
    options: { auto: boolean },
  ) => void;
  isAdmin: boolean;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (categoryId: string) => void;
  themeFilter: string;
  onThemeFilterChange: (themeId: string) => void;
  sortFilter: PieceListSort;
  onSortFilterChange: (sort: PieceListSort) => void;
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
  implicitGroupId,
  pieceMemberships,
  groupScope,
  pickerSelectedGroupId,
  onPickerSelectGroup,
  onPickerBackToGroups,
  onCategoryPickerSelect,
  isAdmin,
  searchInput,
  onSearchInputChange,
  categoryFilter,
  onCategoryFilterChange,
  themeFilter,
  onThemeFilterChange,
  sortFilter,
  onSortFilterChange,
  memberCategoryId,
  onOpenCategoryPicker,
}: RepertoirePiecesSectionProps) {
  const themeById = new Map(themes.map((theme) => [theme.id, theme]));
  const isMemberView = !isAdmin;
  const listScrollRef = useRef<HTMLDivElement>(null);
  useScrollRestoration(listScrollRef, !showCategoryPicker && !isLoading && pieces.length > 0);

  const memberCategoryLabel = isRepertoireUnlinkedFilter(memberCategoryId ?? '')
    ? REPERTOIRE_UNLINKED_LABEL
    : memberCategoryId
      ? (categories.find((category) => category.id === memberCategoryId)?.name ?? 'Categoria')
      : 'Todas';

  const categoryChoices = useMemo(
    () =>
      resolveRepertoireCategoryChoices(
        pieceMemberships,
        categories.map((category) => category.id),
        groupScope,
        isAdmin,
      ),
    [pieceMemberships, categories, groupScope, isAdmin],
  );
  const groupChoiceCount = useMemo(
    () =>
      resolveRepertoireGroupChoices(
        pieceMemberships,
        pickerGroups.map((group) => group.id),
        isAdmin,
      ).choiceCount,
    [pieceMemberships, pickerGroups, isAdmin],
  );

  // Só oferece as categorias com obras no grupo atual (mantendo a selecionada, se houver).
  const categoryOptions = categories.filter(
    (category) =>
      categoryChoices.visibleCategoryIds.includes(category.id) || category.id === categoryFilter,
  );
  const showUnlinkedCategoryOption =
    categoryChoices.showUnlinked || isRepertoireUnlinkedFilter(categoryFilter);
  // Com uma única categoria real, filtrar não muda nada: esconde o filtro.
  const showAdminCategoryFilter = categoryOptions.length + (showUnlinkedCategoryOption ? 1 : 0) > 1;
  // Reabrir o seletor só faz sentido se ele tiver algo a escolher; senão ele voltaria direto.
  const showMemberCategoryButton =
    (showGroupPicker && groupChoiceCount > 1) || categoryChoices.choiceCount > 1;
  const showCategoryFilter = isMemberView ? showMemberCategoryButton : showAdminCategoryFilter;

  const filterSelectClass =
    'w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text';

  if (showCategoryPicker) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {isCategoriesLoading ? (
          <RepertoireCategoryPickerSkeleton />
        ) : (
          <RepertoireCategoryPicker
            groups={pickerGroups}
            showGroupPicker={showGroupPicker}
            implicitGroupId={implicitGroupId}
            showUnlinkedOption={isAdmin}
            categories={categories}
            pieceMemberships={pieceMemberships}
            selectedGroupId={pickerSelectedGroupId}
            onSelectGroup={onPickerSelectGroup}
            onBackToGroups={onPickerBackToGroups}
            onSelect={onCategoryPickerSelect}
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
            {showCategoryFilter && (
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
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                    {showUnlinkedCategoryOption && (
                      <option value={REPERTOIRE_UNLINKED_FILTER}>
                        {REPERTOIRE_UNLINKED_LABEL}
                      </option>
                    )}
                  </select>
                )}
              </label>
            )}

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

            <label className="min-w-0 col-span-2 md:col-span-1 md:flex-1">
              <span className="sr-only">Ordenar</span>
              <select
                aria-label="Ordenar"
                value={sortFilter}
                onChange={(event) => onSortFilterChange(event.target.value as PieceListSort)}
                className={filterSelectClass}
              >
                {PIECE_LIST_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div
        ref={listScrollRef}
        className={`mt-3 min-h-0 flex-1 overflow-y-auto border-t border-border pt-3 overscroll-contain ${scrollContentEndPaddingClass}`}
      >
        {isLoading ? (
          <RepertoirePieceRowsSkeleton />
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
