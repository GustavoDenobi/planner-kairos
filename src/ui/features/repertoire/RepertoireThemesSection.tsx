import type { PieceTheme } from '@/domain/repertoire';
import { IconPencil, IconPlus } from '@/ui/components/icons';

type RepertoireThemesSectionProps = {
  themes: PieceTheme[];
  onCreate: () => void;
  onEdit: (theme: PieceTheme) => void;
};

export function RepertoireThemesSection({ themes, onCreate, onEdit }: RepertoireThemesSectionProps) {
  return (
    <div className="space-y-4">
      

      <ul className="space-y-2">
        {themes.map((theme) => (
          <li
            key={theme.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
          >
            <span className="text-sm text-text">{theme.name}</span>
            <button
              type="button"
              onClick={() => onEdit(theme)}
              className="text-muted hover:text-text"
              aria-label={`Editar ${theme.name}`}
            >
              <IconPencil className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-start justify-center gap-4">
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
        >
          <IconPlus className="h-4 w-4" />
          Novo tema
        </button>
      </div>
    </div>
  );
}
