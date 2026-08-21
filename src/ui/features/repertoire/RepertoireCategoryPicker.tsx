import { useMemo, useState } from 'react';
import type { GroupKind } from '@/domain/ensemble';
import type { PieceCategory } from '@/domain/repertoire';
import { GroupKindIcon } from '@/ui/features/ensemble/group-icons';
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
  resolvedGroupId: string;
  categories: PieceCategory[];
  categoryIdsByGroupId: Record<string, string[]>;
  onSelect: (selection: { groupId: string; categoryId: string }) => void;
};

const cardClassName =
  'rounded-xl border-2 px-4 py-10 text-center text-xl lg:text-2xl font-semibold text-text transition-colors hover:brightness-110 active:brightness-95 sm:text-xl';

export function RepertoireCategoryPicker({
  groups,
  showGroupPicker,
  resolvedGroupId,
  categories,
  categoryIdsByGroupId,
  onSelect,
}: RepertoireCategoryPickerProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(resolvedGroupId || null);

  const activeGroupId = selectedGroupId ?? resolvedGroupId;
  const isGroupStep = showGroupPicker && !selectedGroupId;
  const neutralStyle = neutralCategoryCardStyle();

  const filteredCategories = useMemo(() => {
    if (!activeGroupId) {
      return categories;
    }

    const allowedIds = new Set(categoryIdsByGroupId[activeGroupId] ?? []);
    return categories.filter((category) => allowedIds.has(category.id));
  }, [activeGroupId, categories, categoryIdsByGroupId]);

  if (isGroupStep) {
    return (
      <div className="w-full">
        <p className="mb-4 text-center text-lg text-muted">Selecione um grupo</p>
        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
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
        </div>
        {groups.length === 0 && (
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
      </div>
      {filteredCategories.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          Nenhuma categoria com peças neste grupo.
        </p>
      )}
    </div>
  );
}
