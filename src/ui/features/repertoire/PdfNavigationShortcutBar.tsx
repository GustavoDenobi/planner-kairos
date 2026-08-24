import type { PdfNavigationShortcut } from '@/domain/repertoire';
import { resolveNavigationShortcutColor } from '@/domain/repertoire';

type PdfNavigationShortcutBarProps = {
  shortcuts: PdfNavigationShortcut[];
  onShortcutPress: (shortcut: PdfNavigationShortcut) => void;
  visible?: boolean;
};

export function PdfNavigationShortcutBar({
  shortcuts,
  onShortcutPress,
  visible = true,
}: PdfNavigationShortcutBarProps) {
  if (!visible || shortcuts.length === 0) {
    return null;
  }

  return (
    <div className="flex shrink-0 border-t border-border bg-surface/95 px-2 py-2 backdrop-blur-sm">
      <div className="flex w-full gap-2 overflow-x-auto pb-0.5">
        {shortcuts.map((shortcut) => {
          const color = resolveNavigationShortcutColor(shortcut.color, shortcut.sortOrder);

          return (
            <button
              key={shortcut.id}
              type="button"
              onClick={() => onShortcutPress(shortcut)}
              className="shrink-0 rounded-lg border-2 bg-surface px-3 py-2 text-sm font-semibold shadow-sm transition hover:brightness-95"
              style={{
                borderColor: color,
                color,
              }}
              title={`Ir para ${shortcut.label} (página ${shortcut.targetPageNumber})`}
            >
              {shortcut.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
