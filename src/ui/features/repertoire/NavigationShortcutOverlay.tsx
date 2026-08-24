import type { PdfNavigationShortcut } from '@/domain/repertoire';
import { resolveNavigationShortcutColor } from '@/domain/repertoire';

type NavigationShortcutOverlayProps = {
  shortcuts: PdfNavigationShortcut[];
  pageNumber: number;
  onShortcutPress: (shortcut: PdfNavigationShortcut) => void;
  inverted?: boolean;
  disabled?: boolean;
};

function shortcutColor(shortcut: PdfNavigationShortcut): string {
  return resolveNavigationShortcutColor(shortcut.color, shortcut.sortOrder);
}

function targetPosition(shortcut: PdfNavigationShortcut): { x: number; y: number } {
  return {
    x: shortcut.targetX ?? 0.5,
    y: shortcut.targetY ?? 0.5,
  };
}

export function NavigationShortcutOverlay({
  shortcuts,
  pageNumber,
  onShortcutPress,
  inverted = false,
  disabled = false,
}: NavigationShortcutOverlayProps) {
  const anchorBgClass = inverted ? 'bg-black/95' : 'bg-white/95';
  const anchorShortcuts = shortcuts.filter(
    (shortcut) =>
      shortcut.anchorPageNumber === pageNumber
      && shortcut.anchorX != null
      && shortcut.anchorY != null,
  );

  const targetShortcuts = shortcuts.filter(
    (shortcut) => shortcut.targetPageNumber === pageNumber,
  );

  if (anchorShortcuts.length === 0 && targetShortcuts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {targetShortcuts.map((shortcut) => {
        const color = shortcutColor(shortcut);
        const position = targetPosition(shortcut);

        return (
          <div
            key={`target-${shortcut.id}`}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${position.x * 100}%`,
              top: `${position.y * 100}%`,
            }}
            title={`Destino: ${shortcut.label}`}
            aria-hidden
          >
            <div
              className="h-4 w-4 rounded-full border-2 bg-transparent shadow-sm"
              style={{ borderColor: color }}
            />
          </div>
        );
      })}

      {anchorShortcuts.map((shortcut) => {
        const color = shortcutColor(shortcut);

        return (
          <button
            key={`anchor-${shortcut.id}`}
            type="button"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              onShortcutPress(shortcut);
            }}
            className={`pointer-events-auto absolute max-w-[min(44%,11rem)] -translate-x-1/2 -translate-y-1/2 truncate rounded-full border-2 ${anchorBgClass} px-2.5 py-1 text-xs font-semibold shadow-sm disabled:opacity-50`}
            style={{
              left: `${(shortcut.anchorX ?? 0) * 100}%`,
              top: `${(shortcut.anchorY ?? 0) * 100}%`,
              borderColor: color,
              color,
            }}
            title={shortcut.label}
          >
            {shortcut.label}
          </button>
        );
      })}
    </div>
  );
}
