import { LoadingSkeleton, Skeleton } from '@/ui/components/Skeleton';

const listGapClass = 'flex flex-col gap-2';

function OrgListRowSkeleton({ lines = 1 }: { lines?: 1 | 2 }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <Skeleton className="h-5 w-2/5 max-w-[12rem]" />
      {lines === 2 && <Skeleton className="mt-2 h-4 w-3/5 max-w-[16rem]" />}
    </div>
  );
}

type RowCountProps = {
  count?: number;
};

export function OrgListRowsSkeleton({ count = 6 }: RowCountProps) {
  return (
    <LoadingSkeleton className={listGapClass}>
      {Array.from({ length: count }, (_, index) => (
        <OrgListRowSkeleton key={index} />
      ))}
    </LoadingSkeleton>
  );
}

export function MusicianListRowsSkeleton({ count = 7 }: RowCountProps) {
  return (
    <LoadingSkeleton className={listGapClass}>
      {Array.from({ length: count }, (_, index) => (
        <OrgListRowSkeleton key={index} lines={index % 3 === 0 ? 2 : 1} />
      ))}
    </LoadingSkeleton>
  );
}

export function MusicianListLoadMoreSkeleton() {
  return (
    <LoadingSkeleton label="Carregando mais" className="mt-4">
      <OrgListRowSkeleton lines={1} />
    </LoadingSkeleton>
  );
}

export function PlaylistListRowsSkeleton({ count = 5 }: RowCountProps) {
  return (
    <LoadingSkeleton className={listGapClass}>
      {Array.from({ length: count }, (_, index) => (
        <OrgListRowSkeleton key={index} lines={2} />
      ))}
    </LoadingSkeleton>
  );
}

export function PartsListSkeleton({ count = 4 }: RowCountProps) {
  return (
    <LoadingSkeleton className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-xl border border-border bg-surface py-3 pr-4 pl-4"
        >
          <Skeleton className="h-5 w-1/4 max-w-[8rem]" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            {index % 2 === 0 && <Skeleton className="h-7 w-14 rounded-full" />}
          </div>
        </div>
      ))}
    </LoadingSkeleton>
  );
}

export function RepertoirePieceRowsSkeleton({ count = 6 }: RowCountProps) {
  return (
    <LoadingSkeleton className={listGapClass}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-xl border border-border bg-surface px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-3/5 max-w-[14rem]" />
              <Skeleton className="h-4 w-2/5 max-w-[10rem]" />
              {index % 2 === 0 && (
                <div className="flex gap-1 pt-1">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              )}
            </div>
            <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
          </div>
        </div>
      ))}
    </LoadingSkeleton>
  );
}

export function RepertoireCategoryPickerSkeleton() {
  return (
    <LoadingSkeleton className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-28 rounded-xl" />
      ))}
    </LoadingSkeleton>
  );
}

export function AgendaEventsListSkeleton() {
  return (
    <LoadingSkeleton className="space-y-6">
      {Array.from({ length: 3 }, (_, sectionIndex) => (
        <section key={sectionIndex}>
          <Skeleton className="mb-2 h-4 w-32" />
          <div className="space-y-2">
            {Array.from({ length: sectionIndex === 0 ? 2 : 1 }, (_, rowIndex) => (
              <div
                key={rowIndex}
                className="rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-5 w-2/5 max-w-[12rem]" />
                  <Skeleton className="h-4 w-14" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </LoadingSkeleton>
  );
}

export function AgendaWeekKanbanSkeleton() {
  return (
    <LoadingSkeleton
      label="Carregando agenda"
      className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
    >
      <div className="flex h-full min-h-[14rem] overflow-x-auto">
        {Array.from({ length: 7 }, (_, columnIndex) => (
          <div
            key={columnIndex}
            className="flex h-full w-72 shrink-0 flex-col border-r border-border last:border-r-0"
          >
            <div className="shrink-0 bg-bg px-3 py-2">
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="min-h-0 flex-1 space-y-2 p-2">
              {columnIndex % 2 === 0 && (
                <Skeleton className="h-[4.5rem] w-full rounded-xl" />
              )}
              {columnIndex % 3 !== 1 && (
                <Skeleton className="h-[4.5rem] w-full rounded-xl" />
              )}
            </div>
          </div>
        ))}
      </div>
    </LoadingSkeleton>
  );
}

export function AgendaEventTypesListSkeleton({ count = 5 }: RowCountProps) {
  return (
    <LoadingSkeleton className={listGapClass}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
        >
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
        </div>
      ))}
    </LoadingSkeleton>
  );
}
