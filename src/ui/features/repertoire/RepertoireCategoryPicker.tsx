import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { GroupKind } from '@/domain/ensemble';
import {
  REPERTOIRE_UNLINKED_FILTER,
} from '@/domain/repertoire/repertoire-filters';
import {
  resolveRepertoireCategoryChoices,
  resolveRepertoireGroupChoices,
  type RepertoirePieceMembership,
} from '@/domain/repertoire/repertoire-picker-counts';
import type { PieceCategory } from '@/domain/repertoire';
import { IconChevronLeft } from '@/ui/components/icons';
import { GroupKindIcon } from '@/ui/features/ensemble/group-icons';
import { REPERTOIRE_UNLINKED_LABEL } from '@/ui/features/repertoire/repertoire-filter-ids';
import {
  categoryBadgeStyle,
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
  pieceMemberships: RepertoirePieceMembership[];
  /** Grupo escolhido na etapa de grupos (vem da URL); `null` = etapa de grupos. */
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  onBackToGroups: () => void;
  /** `auto`: escolha feita sozinha (uma única opção), não deve virar etapa no histórico. */
  onSelect: (selection: { groupId: string; categoryId: string }, options: { auto: boolean }) => void;
};

const cardClassName =
  'relative rounded-xl border-2 px-4 py-10 text-center text-xl lg:text-2xl font-semibold text-text transition-colors hover:brightness-110 active:brightness-95 sm:text-xl';

const neutralBadgeStyle: CSSProperties = {
  backgroundColor: 'hsl(0 0% 50% / 0.28)',
};

function PieceCountBadge({ count, style }: { count: number; style?: CSSProperties }) {
  const label = count === 1 ? '1 obra' : `${count} obras`;
  return (
    <span
      className="absolute right-2 top-2 min-w-7 rounded-full px-2 py-0.5 text-center text-sm font-semibold tabular-nums leading-5"
      style={style ?? neutralBadgeStyle}
      title={label}
      aria-label={label}
    >
      {count}
    </span>
  );
}

export function RepertoireCategoryPicker({
  groups,
  showGroupPicker,
  implicitGroupId,
  showUnlinkedOption = false,
  categories,
  pieceMemberships,
  selectedGroupId,
  onSelectGroup,
  onBackToGroups,
  onSelect,
}: RepertoireCategoryPickerProps) {

  const neutralStyle = neutralCategoryCardStyle();
  const groupChoices = useMemo(
    () =>
      resolveRepertoireGroupChoices(
        pieceMemberships,
        groups.map((group) => group.id),
        showUnlinkedOption,
      ),
    [pieceMemberships, groups, showUnlinkedOption],
  );
  const groupCounts = groupChoices.counts;
  const visibleGroups = useMemo(() => {
    const visibleIds = new Set(groupChoices.visibleGroupIds);
    return groups.filter((group) => visibleIds.has(group.id));
  }, [groups, groupChoices]);
  const showGroupUnlinkedOption = groupChoices.showUnlinked;

  // Com uma única opção real de grupo, "Todos" mostraria as mesmas obras: pula a etapa de grupo.
  const skipGroupStep = showGroupPicker && groupChoices.choiceCount <= 1;
  const autoGroupId = !skipGroupStep
    ? null
    : (visibleGroups[0]?.id ?? (showGroupUnlinkedOption ? REPERTOIRE_UNLINKED_FILTER : ''));

  const activeGroupId = showGroupPicker
    ? (selectedGroupId ?? autoGroupId ?? '')
    : (selectedGroupId ?? implicitGroupId ?? '');
  const isGroupStep = showGroupPicker && !skipGroupStep && selectedGroupId === null;

  const categoryChoices = useMemo(
    () =>
      resolveRepertoireCategoryChoices(
        pieceMemberships,
        categories.map((category) => category.id),
        activeGroupId,
        showUnlinkedOption,
      ),
    [pieceMemberships, categories, activeGroupId, showUnlinkedOption],
  );
  const categoryCounts = categoryChoices.countsByCategory;
  const unlinkedInScopeCount = categoryChoices.unlinkedCount;
  const showCategoryUnlinkedOption = categoryChoices.showUnlinked;
  const filteredCategories = useMemo(() => {
    const visibleIds = new Set(categoryChoices.visibleCategoryIds);
    return categories.filter((category) => visibleIds.has(category.id));
  }, [categories, categoryChoices]);

  // Com uma única opção real de categoria, "Todas" mostraria as mesmas obras: seleciona direto.
  const autoCategoryId =
    !isGroupStep && categoryChoices.choiceCount <= 1
      ? (filteredCategories[0]?.id ?? (showCategoryUnlinkedOption ? REPERTOIRE_UNLINKED_FILTER : ''))
      : null;

  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoCategoryId === null || autoSelectedRef.current) {
      return;
    }
    autoSelectedRef.current = true;
    onSelect({ groupId: activeGroupId, categoryId: autoCategoryId }, { auto: true });
  }, [autoCategoryId, activeGroupId, onSelect]);

  if (autoCategoryId !== null) {
    return null;
  }

  if (isGroupStep) {
    return (
      <div className="w-full">
        <p className="mb-4 text-center text-lg text-muted">Selecione um grupo</p>
        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => onSelectGroup('')}
            className={cardClassName}
            style={neutralStyle}
          >
            <PieceCountBadge count={groupCounts.total} />
            Todos
          </button>
          {visibleGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              className={`${cardClassName} flex flex-col items-center justify-center gap-2`}
              style={neutralStyle}
            >
              <PieceCountBadge count={groupCounts.byGroup.get(group.id) ?? 0} />
              <GroupKindIcon kind={group.kind} className="h-8 w-8 shrink-0 text-muted" />
              <span>{group.name}</span>
            </button>
          ))}
          {showGroupUnlinkedOption && (
            <button
              type="button"
              onClick={() => onSelectGroup(REPERTOIRE_UNLINKED_FILTER)}
              className={cardClassName}
              style={neutralStyle}
            >
              <PieceCountBadge count={groupCounts.unlinked} />
              {REPERTOIRE_UNLINKED_LABEL}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {showGroupPicker && !skipGroupStep && (
        <div className="mb-4 flex justify-center">
          <button
            type="button"
            onClick={onBackToGroups}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-bg"
          >
            <IconChevronLeft className="h-4 w-4" />
            Voltar aos grupos
          </button>
        </div>
      )}
      <p className="mb-4 text-center text-lg text-muted">Selecione uma categoria</p>
      <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => onSelect({ groupId: activeGroupId, categoryId: '' }, { auto: false })}
          className={cardClassName}
          style={neutralStyle}
        >
          <PieceCountBadge count={categoryChoices.scopedTotal} />
          Todas
        </button>
        {filteredCategories.map((category) => {
          const cardStyle = categoryCardStyle(category.color, category.slug);

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect({ groupId: activeGroupId, categoryId: category.id }, { auto: false })}
              className={cardClassName}
              style={cardStyle}
            >
              <PieceCountBadge
                count={categoryCounts.get(category.id) ?? 0}
                style={categoryBadgeStyle(category.color, category.slug)}
              />
              {category.name}
            </button>
          );
        })}
        {showCategoryUnlinkedOption && (
          <button
            type="button"
            onClick={() =>
              onSelect(
                { groupId: activeGroupId, categoryId: REPERTOIRE_UNLINKED_FILTER },
                { auto: false },
              )
            }
            className={cardClassName}
            style={neutralStyle}
          >
            <PieceCountBadge count={unlinkedInScopeCount} />
            {REPERTOIRE_UNLINKED_LABEL}
          </button>
        )}
      </div>
    </div>
  );
}
