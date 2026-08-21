import { compareByName } from '@/domain/ensemble/sort-order';
import type { PieceTheme } from '@/domain/repertoire';
import { IconPencil } from '@/ui/components/icons';

type RepertoireThemesSectionProps = {
  themes: PieceTheme[];
  onEdit: (theme: PieceTheme) => void;
};

export function RepertoireThemesSection({ themes, onEdit }: RepertoireThemesSectionProps) {
  const sortedThemes = [...themes].sort((a, b) => compareByName(a.name, b.name));

  return (
    <div className="space-y-4">
      

      <ul className="space-y-2">
        {sortedThemes.map((theme) => (
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
    </div>
  );
}
