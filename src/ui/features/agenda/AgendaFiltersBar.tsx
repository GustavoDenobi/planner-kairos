import { useId, useState, type ReactNode } from 'react';
import type { EventKind, EventType } from '@/domain/agenda';
import { IconFilter, IconCake } from '@/ui/components/icons';
import { eventKindLabel } from '@/ui/features/agenda/agenda-labels';

export type AgendaFilterScope = 'mine' | 'all';

type AudienceOption = {
  id: string;
  name: string;
};

type AgendaFiltersBarProps = {
  showScopeToggle: boolean;
  scope: AgendaFilterScope;
  onScopeChange: (scope: AgendaFilterScope) => void;
  kind: EventKind | '';
  onKindChange: (kind: EventKind | '') => void;
  typeId: string;
  onTypeIdChange: (typeId: string) => void;
  groupId: string;
  onGroupIdChange: (groupId: string) => void;
  types: EventType[];
  groups: AudienceOption[];
  rangeControls?: ReactNode;
  showBirthdaysToggle?: boolean;
  showBirthdays?: boolean;
  onShowBirthdaysChange?: (show: boolean) => void;
};

const EVENT_KIND_OPTIONS: EventKind[] = ['rehearsal', 'service', 'class', 'special'];

const selectClass =
  'rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text';

export function AgendaFiltersBar({
  showScopeToggle,
  scope,
  onScopeChange,
  kind,
  onKindChange,
  typeId,
  onTypeIdChange,
  groupId,
  onGroupIdChange,
  types,
  groups,
  rangeControls,
  showBirthdaysToggle = false,
  showBirthdays = true,
  onShowBirthdaysChange,
}: AgendaFiltersBarProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const visibleTypes = kind ? types.filter((type) => type.kind === kind) : types;
  const extraFiltersActive = Boolean(kind || typeId || groupId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
        {rangeControls}
        <div className="ml-auto flex items-stretch justify-end gap-2 md:shrink-0">
          {showScopeToggle && (
            <button
              type="button"
              onClick={() => onScopeChange(scope === 'mine' ? 'all' : 'mine')}
              className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-bg"
            >
              {scope === 'mine' ? 'Ver todos' : 'Ver meus'}
            </button>
          )}
          {showBirthdaysToggle && onShowBirthdaysChange && (
            <button
              type="button"
              onClick={() => onShowBirthdaysChange(!showBirthdays)}
              className={`inline-flex shrink-0 items-center justify-center rounded-lg border p-2 transition-colors ${
                showBirthdays
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-surface text-muted hover:bg-bg hover:text-text'
              }`}
              aria-label={showBirthdays ? 'Ocultar aniversários' : 'Mostrar aniversários'}
              aria-pressed={showBirthdays}
            >
              <IconCake className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className={`relative inline-flex shrink-0 items-center justify-center rounded-lg border p-2 transition-colors ${
              open
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface text-muted hover:bg-bg hover:text-text'
            }`}
            aria-label={open ? 'Ocultar filtros' : 'Mostrar filtros'}
            aria-expanded={open}
            aria-controls={panelId}
          >
            <IconFilter className="h-4 w-4" />
            {extraFiltersActive && !open && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </button>
        </div>
      </div>
      {open && (
        <div id={panelId} className="grid gap-2 sm:grid-cols-3">
          <label className="block min-w-0">
            <span className="sr-only">Categoria</span>
            <select
              value={kind}
              onChange={(event) => {
                const nextKind = event.target.value as EventKind | '';
                onKindChange(nextKind);
                const selectedType = types.find((type) => type.id === typeId);
                if (nextKind && selectedType && selectedType.kind !== nextKind) {
                  onTypeIdChange('');
                }
              }}
              className={`w-full ${selectClass}`}
            >
              <option value="">Todas as categorias</option>
              {EVENT_KIND_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {eventKindLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="sr-only">Tipo</span>
            <select
              value={typeId}
              onChange={(event) => onTypeIdChange(event.target.value)}
              className={`w-full ${selectClass}`}
            >
              <option value="">Todos os tipos</option>
              {visibleTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="sr-only">Grupo</span>
            <select
              value={groupId}
              onChange={(event) => onGroupIdChange(event.target.value)}
              className={`w-full ${selectClass}`}
            >
              <option value="">Todos os grupos</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
