import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GroupKind } from '@/domain/ensemble';
import { IconUser } from '@/ui/components/icons';
import { GroupKindIcon } from '@/ui/features/ensemble/group-icons';

export type AudienceChipGroup = {
  id: string;
  name: string;
  kind: GroupKind;
};

export type AudienceChipMusician = {
  id: string;
  fullName: string;
};

type AudienceChip = {
  key: string;
  name: string;
} & ({ type: 'group'; kind: GroupKind } | { type: 'musician' });

export type AudienceChipsProps = {
  groups: AudienceChipGroup[];
  musicians: AudienceChipMusician[];
  className?: string;
  singleLine?: boolean;
};

function ChipLabel({ item }: { item: AudienceChip }) {
  return (
    <>
      {item.type === 'group' ? (
        <GroupKindIcon kind={item.kind} className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <IconUser className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="sr-only">{item.type === 'group' ? 'Grupo ' : 'Músico '}</span>
      <span className="truncate">{item.name}</span>
    </>
  );
}

const chipClass = 'inline-flex min-w-0 max-w-full shrink-0 items-center gap-1 text-xs text-muted';

function readGap(list: HTMLElement) {
  const gap = parseFloat(getComputedStyle(list).columnGap);
  return Number.isFinite(gap) ? gap : 0;
}

function countVisibleChips(available: number, chipWidths: number[], moreWidth: number, gap: number) {
  const count = chipWidths.length;
  if (count === 0 || available <= 0) {
    return 0;
  }

  const allWidth = chipWidths.reduce((sum, width) => sum + width, 0) + gap * (count - 1);
  if (allWidth <= available) {
    return count;
  }

  let used = 0;
  let visible = 0;
  for (const width of chipWidths) {
    const next = used + (visible > 0 ? gap : 0) + width;
    if (next + gap + moreWidth <= available) {
      used = next;
      visible += 1;
    } else {
      break;
    }
  }

  return visible > 0 ? visible : 1;
}

export function AudienceChips({
  groups,
  musicians,
  className = 'mt-1',
  singleLine = false,
}: AudienceChipsProps) {
  const items = useMemo<AudienceChip[]>(
    () => [
      ...groups.map((group) => ({
        key: `group-${group.id}`,
        type: 'group' as const,
        name: group.name,
        kind: group.kind,
      })),
      ...musicians.map((musician) => ({
        key: `musician-${musician.id}`,
        type: 'musician' as const,
        name: musician.fullName,
      })),
    ],
    [groups, musicians],
  );

  const listRef = useRef<HTMLUListElement>(null);
  const [hiddenCount, setHiddenCount] = useState(0);

  useLayoutEffect(() => {
    if (!singleLine) {
      setHiddenCount(0);
      return;
    }

    const list = listRef.current;
    if (!list) {
      return;
    }

    function update() {
      if (!list) {
        return;
      }

      const chips = [...list.querySelectorAll<HTMLElement>('[data-audience-chip]')];
      const more = list.querySelector<HTMLElement>('[data-audience-more]');
      if (chips.length === 0) {
        setHiddenCount(0);
        return;
      }

      for (const chip of chips) {
        chip.hidden = false;
      }
      if (more) {
        more.hidden = true;
      }

      const available = list.clientWidth;
      if (available === 0) {
        return;
      }

      const gap = readGap(list);
      const chipWidths = chips.map((chip) => chip.getBoundingClientRect().width);

      if (more) {
        more.hidden = false;
        more.textContent = `+${chips.length}`;
      }
      const moreWidth = more?.getBoundingClientRect().width ?? 0;

      const visible = countVisibleChips(available, chipWidths, moreWidth, gap);
      const hidden = chips.length - visible;

      if (more) {
        if (hidden > 0) {
          more.hidden = false;
          more.textContent = `+${hidden}`;
        } else {
          more.hidden = true;
        }
      }

      for (let index = 0; index < chips.length; index += 1) {
        chips[index].hidden = index >= visible;
      }

      setHiddenCount((current) => (current === hidden ? current : hidden));
    }

    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => observer.disconnect();
  }, [items, singleLine]);

  if (items.length === 0) {
    return null;
  }

  const hiddenItems = singleLine ? items.slice(items.length - hiddenCount) : [];
  const hiddenLabel = hiddenItems.map((item) => item.name).join(', ');
  const visibleCount = items.length - hiddenCount;

  return (
    <ul
      ref={listRef}
      className={
        singleLine
          ? `flex h-5 w-full min-w-0 max-w-full flex-wrap items-center gap-x-3 overflow-hidden ${className}`
          : `flex flex-wrap gap-x-3 gap-y-1 ${className}`
      }
    >
      {items.map((item, index) => (
        <li
          key={item.key}
          data-audience-chip
          hidden={singleLine && index >= visibleCount}
          className={chipClass}
        >
          <ChipLabel item={item} />
        </li>
      ))}
      {singleLine && (
        <li
          data-audience-more
          className="shrink-0 text-xs text-muted"
          hidden={hiddenCount === 0}
          title={hiddenLabel || undefined}
          aria-label={hiddenCount > 0 ? `Mais ${hiddenCount}: ${hiddenLabel}` : undefined}
        >
          +{hiddenCount}
        </li>
      )}
    </ul>
  );
}
