import { useEffect, useRef, type RefObject } from 'react';
import type { EventListItem, MusicianBirthdayItem } from '@/domain/agenda';
import { IconPlus } from '@/ui/components/icons';
import { AgendaBirthdayCard } from '@/ui/features/agenda/AgendaBirthdayCard';
import { AgendaEventCard } from '@/ui/features/agenda/AgendaEventCard';
import {
  buildWeekDayColumns,
  formatKanbanDayHeader,
  getWeekDays,
  isSameDay,
  startOfDay,
} from '@/ui/features/agenda/agenda-date';

type AgendaWeekKanbanProps = {
  orgSlug: string;
  anchor: Date;
  events: EventListItem[];
  birthdays?: MusicianBirthdayItem[];
  isLoading: boolean;
  canCreateEvents: boolean;
  onAddEvent: (day: Date) => void;
};

function findColumnScroll(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest('[data-agenda-column-scroll]');
}

function canScrollColumnVertically(element: HTMLElement, deltaY: number): boolean {
  if (element.scrollHeight <= element.clientHeight + 1) {
    return false;
  }
  if (deltaY < 0) {
    return element.scrollTop > 0;
  }
  if (deltaY > 0) {
    return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  }
  return false;
}

function useKanbanScroll(containerRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        container.scrollLeft += event.deltaX;
        event.preventDefault();
        return;
      }

      const columnScroll = findColumnScroll(event.target);
      if (columnScroll && canScrollColumnVertically(columnScroll, event.deltaY)) {
        return;
      }

      if (event.deltaY !== 0) {
        container.scrollLeft += event.deltaY;
        event.preventDefault();
      }
    };

    let touchStartX = 0;
    let touchStartY = 0;
    let touchAxis: 'x' | 'y' | null = null;
    let touchColumnScroll: HTMLElement | null = null;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        return;
      }
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
      touchAxis = null;
      touchColumnScroll = findColumnScroll(event.target);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      if (!touchAxis) {
        if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) {
          return;
        }
        touchAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
      }

      if (touchAxis === 'x') {
        container.scrollLeft -= deltaX;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        event.preventDefault();
        return;
      }

      if (
        touchColumnScroll &&
        touchColumnScroll.scrollHeight <= touchColumnScroll.clientHeight + 1
      ) {
        container.scrollLeft -= deltaX;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        event.preventDefault();
      }
    };

    const onTouchEnd = () => {
      touchAxis = null;
      touchColumnScroll = null;
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);

    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [containerRef]);
}

function scrollTodayColumnIntoView(container: HTMLDivElement, column: HTMLElement): void {
  const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
  const containerRect = container.getBoundingClientRect();
  const columnRect = column.getBoundingClientRect();
  const columnLeftInContent = container.scrollLeft + (columnRect.left - containerRect.left);
  const targetScroll = Math.min(Math.max(0, columnLeftInContent), maxScrollLeft);
  container.scrollTo({ left: targetScroll, behavior: 'instant' });
}

export function AgendaWeekKanban({
  orgSlug,
  anchor,
  events,
  birthdays = [],
  isLoading,
  canCreateEvents,
  onAddEvent,
}: AgendaWeekKanbanProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayColumnRef = useRef<HTMLDivElement>(null);
  const today = startOfDay(new Date());
  const weekDays = getWeekDays(anchor);
  const weekContainsToday = weekDays.some((day) => isSameDay(day, today));
  const columns = buildWeekDayColumns(anchor, events, birthdays);

  useKanbanScroll(scrollRef);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const container = scrollRef.current;
    if (!container) {
      return;
    }

    if (!weekContainsToday) {
      container.scrollLeft = 0;
      return;
    }

    const applyScroll = () => {
      const column = todayColumnRef.current;
      if (!column) {
        return;
      }
      scrollTodayColumnIntoView(container, column);
    };

    applyScroll();
    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(applyScroll);
    });

    const observer = new ResizeObserver(applyScroll);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
      observer.disconnect();
    };
  }, [anchor, isLoading, weekContainsToday]);

  if (isLoading) {
    return <p className="text-sm text-muted">Carregando…</p>;
  }

  return (
    <div
      ref={scrollRef}
      className="h-full min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain"
    >
      <div className="flex h-full min-h-0 w-max">
        {columns.map(({ date, birthdays: dayBirthdays, events: dayEvents }) => {
          const isToday = isSameDay(date, today);

          return (
            <div
              key={date.toISOString()}
              ref={isToday ? todayColumnRef : undefined}
              className="flex h-full min-h-0 w-72 shrink-0 flex-col border-r border-border last:border-r-0"
            >
              <div
                className={`shrink-0 px-3 py-2 ${
                  isToday ? 'bg-primary/5' : 'bg-bg'
                }`}
              >
                <div className="flex items-center gap-2">
                  <h2 className={`text-sm text-text ${isToday ? 'font-semibold' : ''}`}>
                    {formatKanbanDayHeader(date)}
                  </h2>
                  {isToday && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      hoje
                    </span>
                  )}
                </div>
              </div>

              <div
                data-agenda-column-scroll
                className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
              >
                <ul className="space-y-2 p-2">
                  {dayBirthdays.map((birthday) => (
                    <li key={`birthday-${birthday.musicianId}-${birthday.date}`}>
                      <AgendaBirthdayCard orgSlug={orgSlug} birthday={birthday} />
                    </li>
                  ))}
                  {dayEvents.map((event) => (
                    <li key={event.id}>
                      <AgendaEventCard orgSlug={orgSlug} event={event} variant="columns" />
                    </li>
                  ))}
                  {canCreateEvents && (
                    <li>
                      <button
                        type="button"
                        onClick={() => onAddEvent(date)}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-primary hover:text-primary"
                      >
                        <IconPlus className="h-4 w-4" />
                        Evento
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
