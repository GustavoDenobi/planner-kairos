import { useMemo, useState } from 'react';
import type { GroupKind } from '@/domain/ensemble';
import {
  REPERTOIRE_UNLINKED_FILTER,
  isRepertoireUnlinkedFilter,
} from '@/domain/repertoire/repertoire-filters';
import type { PieceCategory } from '@/domain/repertoire';
import { GroupKindIcon } from '@/ui/features/ensemble/group-icons';
import { REPERTOIRE_UNLINKED_LABEL } from '@/ui/features/repertoire/repertoire-filter-ids';
import {
  categoryCardStyle,
  neutralCategoryCardStyle,
} from '@/ui/features/repertoire/category-color';

export type RepertoireGroupPickerOption = {
  id: string;
  name: string;
  kind: GroupKind;
};

type RepertoireCategoryPickerProps = {
  groups: RepertoireGroupPickerOption[];
  showGroupPicker: boolean;
  implicitGroupId: string;
  showUnlinkedOption?: boolean;
  categories: PieceCategory[];
  categoryIdsByGroupId: Record<string, string[]>;
  onSelect: (selection: { groupId: string; categoryId: string }) => void;
};

const cardClassName =
  'rounded-xl border-2 px-4 py-10 text-center text-xl lg:text-2xl font-semibold text-text transition-colors hover:brightness-110 active:brightness-95 sm:text-xl';

function categoryIdsForGroups(
  groupIds: string[],
  categoryIdsByGroupId: Record<string, string[]>,
): Set<string> {
  const allowedIds = new Set<string>();
  for (const groupId of groupIds) {
    for (const categoryId of categoryIdsByGroupId[groupId] ?? []) {
      allowedIds.add(categoryId);
    }
  }
  return allowedIds;
}

function unlinkedCategoryIds(categoryIdsByGroupId: Record<string, string[]>): Set<string> {
  return new Set(categoryIdsByGroupId[REPERTOIRE_UNLINKED_FILTER] ?? []);
}

export function RepertoireCategoryPicker({
  groups,
  showGroupPicker,
  implicitGroupId,
  showUnlinkedOption = false,
  categories,
  categoryIdsByGroupId,
  onSelect,
}: RepertoireCategoryPickerProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    showGroupPicker ? null : implicitGroupId || null,
  );

  const activeGroupId = showGroupPicker
    ? (selectedGroupId ?? '')
    : (selectedGroupId ?? implicitGroupId);
  const isGroupStep = showGroupPicker && selectedGroupId === null;
  const neutralStyle = neutralCategoryCardStyle();
  const showCategoryUnlinkedOption = showUnlinkedOption;

  const filteredCategories = useMemo(() => {
    if (isRepertoireUnlinkedFilter(activeGroupId)) {
      const allowedIds = unlinkedCategoryIds(categoryIdsByGroupId);
      return categories.filter((category) => allowedIds.has(category.id));
    }

    if (showGroupPicker && selectedGroupId === '') {
      const allowedIds = categoryIdsForGroups(
        groups.map((group) => group.id),
        categoryIdsByGroupId,
      );
      if (showUnlinkedOption) {
        for (const categoryId of unlinkedCategoryIds(categoryIdsByGroupId)) {
          allowedIds.add(categoryId);
        }
      }
      return categories.filter((category) => allowedIds.has(category.id));
    }

    if (!activeGroupId) {
      return categories;
    }

    const allowedIds = categoryIdsForGroups([activeGroupId], categoryIdsByGroupId);
    return categories.filter((category) => allowedIds.has(category.id));
  }, [
    activeGroupId,
    categories,
    categoryIdsByGroupId,
    groups,
    selectedGroupId,
    showGroupPicker,
    showUnlinkedOption,
  ]);

  if (isGroupStep) {
    return (
      <div className="w-full">
        <p className="mb-4 text-center text-lg text-muted">Selecione um grupo</p>
        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setSelectedGroupId('')}
            className={cardClassName}
            style={neutralStyle}
          >
            Todos
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setSelectedGroupId(group.id)}
              className={`${cardClassName} flex flex-col items-center justify-center gap-2`}
              style={neutralStyle}
            >
              <GroupKindIcon kind={group.kind} className="h-8 w-8 shrink-0 text-muted" />
              <span>{group.name}</span>
            </button>
          ))}
          {showUnlinkedOption && (
            <button
              type="button"
              onClick={() => setSelectedGroupId(REPERTOIRE_UNLINKED_FILTER)}
              className={cardClassName}
              style={neutralStyle}
            >
              {REPERTOIRE_UNLINKED_LABEL}
            </button>
          )}
        </div>
        {groups.length === 0 && !showUnlinkedOption && (
          <p className="mt-3 text-sm text-muted">Nenhum grupo disponível.</p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      {showGroupPicker && (
        <div className="mb-4 flex justify-center">
          <button
            type="button"
            onClick={() => setSelectedGroupId(null)}
            className="text-sm text-muted transition-colors hover:text-text"
          >
            ← Voltar aos grupos
          </button>
        </div>
      )}
      <p className="mb-4 text-center text-lg text-muted">Selecione uma categoria</p>
      <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => onSelect({ groupId: activeGroupId, categoryId: '' })}
          className={cardClassName}
          style={neutralStyle}
        >
          Todas
        </button>
        {filteredCategories.map((category) => {
          const cardStyle = categoryCardStyle(category.color, category.slug);

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect({ groupId: activeGroupId, categoryId: category.id })}
              className={cardClassName}
              style={cardStyle}
            >
              {category.name}
            </button>
          );
        })}
        {showCategoryUnlinkedOption && (
          <button
            type="button"
            onClick={() =>
              onSelect({ groupId: activeGroupId, categoryId: REPERTOIRE_UNLINKED_FILTER })
            }
            className={cardClassName}
            style={neutralStyle}
          >
            {REPERTOIRE_UNLINKED_LABEL}
          </button>
        )}
      </div>
      {filteredCategories.length === 0 && !showCategoryUnlinkedOption && (
        <p className="mt-3 text-sm text-muted">
          {isRepertoireUnlinkedFilter(activeGroupId)
            ? 'Nenhuma categoria com peças sem vínculo.'
            : activeGroupId
              ? 'Nenhuma categoria com peças neste grupo.'
              : 'Nenhuma categoria com peças nos grupos disponíveis.'}
        </p>
      )}
    </div>
  );
}
