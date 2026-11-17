import { useEffect, useRef, useState } from 'react';
import type { ReadingPlaylistSourceEventAudience } from '@/domain/repertoire';
import { formatSourceEventAudienceLabel } from '@/domain/repertoire';

export type LessonAudiencePreset = {
  id: string;
  label: string;
  audience: ReadingPlaylistSourceEventAudience;
};

type LessonAnnotationAudienceChipProps = {
  activeAudience: ReadingPlaylistSourceEventAudience;
  presets: LessonAudiencePreset[];
  musicians: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string }>;
  autoEnsureLayers: boolean;
  onAudienceChange: (audience: ReadingPlaylistSourceEventAudience) => void;
  onAutoEnsureChange: (value: boolean) => void;
};

export function LessonAnnotationAudienceChip({
  activeAudience,
  presets,
  musicians,
  groups,
  autoEnsureLayers,
  onAudienceChange,
  onAutoEnsureChange,
}: LessonAnnotationAudienceChipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeLabel = formatSourceEventAudienceLabel(activeAudience, { musicians, groups });
  const canPickAudience = presets.length > 1;

  useEffect(() => {
    if (!open) {
      return;
    }
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Contexto de anotação da aula"
      >
        <span className="truncate">Anotando para: {activeLabel}</span>
        <span className="text-[10px] opacity-70">▾</span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Destinatário da anotação"
          className="absolute left-0 top-full z-40 mt-1 min-w-[14rem] max-w-[18rem] rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {canPickAudience
            ? presets.map((preset) => {
            const selected =
              JSON.stringify(preset.audience) === JSON.stringify(activeAudience);
            return (
              <button
                key={preset.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onAudienceChange(preset.audience);
                  setOpen(false);
                }}
                className={`flex w-full px-3 py-2 text-left text-sm hover:bg-bg ${
                  selected ? 'bg-primary/10 font-medium text-primary' : 'text-text'
                }`}
              >
                {preset.label}
              </button>
            );
          })
            : null}
          <AutoEnsureToggle
            autoEnsureLayers={autoEnsureLayers}
            onAutoEnsureChange={onAutoEnsureChange}
          />
        </div>
      ) : null}
    </div>
  );
}

function AutoEnsureToggle({
  autoEnsureLayers,
  onAutoEnsureChange,
}: {
  autoEnsureLayers: boolean;
  onAutoEnsureChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted">
      <input
        type="checkbox"
        checked={autoEnsureLayers}
        onChange={(event) => onAutoEnsureChange(event.target.checked)}
        className="rounded border-border"
      />
      Criar camada automaticamente em cada partitura
    </label>
  );
}