import type { PdfNavigationShortcut } from '@/domain/repertoire';
import { resolveNavigationShortcutColor } from '@/domain/repertoire';

type NavigationShortcutOverlayProps = {
  shortcuts: PdfNavigationShortcut[];
  pageNumber: number;
  onShortcutPress: (shortcut: PdfNavigationShortcut) => void;
  inverted?: boolean;
  disabled?: boolean;
  visible?: boolean;
  pulsingShortcutId?: string | null;
  pulseToken?: number;
};

const SHORTCUT_OVERLAY_OPACITY_CLASS = 'opacity-[0.66]';

function shortcutColor(shortcut: PdfNavigationShortcut): string {
  return resolveNavigationShortcutColor(shortcut.color, shortcut.sortOrder);
}

function targetPosition(shortcut: PdfNavigationShortcut): { x: number; y: number } {
  return {
    x: shortcut.targetX ?? 0.5,
    y: shortcut.targetY ?? 0.5,
  };
}

function ShortcutTargetMarker({
  shortcut,
  pulsing,
  pulseToken,
}: {
  shortcut: PdfNavigationShortcut;
  pulsing: boolean;
  pulseToken: number;
}) {
  const color = shortcutColor(shortcut);
  const position = targetPosition(shortcut);

  return (
    <div
      className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 ${
        pulsing ? 'z-10 opacity-100' : SHORTCUT_OVERLAY_OPACITY_CLASS
      }`}
      style={{
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
      }}
      title={`Destino: ${shortcut.label}`}
      aria-hidden
    >
      <div key={pulsing ? pulseToken : 'idle'} className="relative h-4 w-4">
        {pulsing ? (
          <span
            className="navigation-shortcut-target-pulse absolute inset-0 rounded-full border-2"
            style={{ borderColor: color }}
          />
        ) : null}
        <div
          className={`relative h-4 w-4 rounded-full border-2 shadow-sm ${
            pulsing ? 'navigation-shortcut-target-dot' : 'bg-transparent'
          }`}
          style={{
            borderColor: color,
            backgroundColor: pulsing ? `${color}33` : undefined,
          }}
        />
      </div>
    </div>
  );
}

export function NavigationShortcutOverlay({
  shortcuts,
  pageNumber,
  onShortcutPress,
  inverted = false,
  disabled = false,
  visible = true,
  pulsingShortcutId = null,
  pulseToken = 0,
}: NavigationShortcutOverlayProps) {
  const showAnchors = visible;
  const anchorBgClass = inverted ? 'bg-black/95' : 'bg-white/95';
  const anchorShortcuts = showAnchors
    ? shortcuts.filter(
        (shortcut) =>
          shortcut.anchorPageNumber === pageNumber
          && shortcut.anchorX != null
          && shortcut.anchorY != null,
      )
    : [];

  const targetShortcuts = shortcuts.filter((shortcut) => {
    if (shortcut.targetPageNumber !== pageNumber) {
      return false;
    }
    return visible || shortcut.id === pulsingShortcutId;
  });

  if (anchorShortcuts.length === 0 && targetShortcuts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {targetShortcuts.map((shortcut) => (
        <ShortcutTargetMarker
          key={`target-${shortcut.id}`}
          shortcut={shortcut}
          pulsing={shortcut.id === pulsingShortcutId}
          pulseToken={pulseToken}
        />
      ))}

      {anchorShortcuts.map((shortcut) => {
        const color = shortcutColor(shortcut);

        return (
          <button
            key={`anchor-${shortcut.id}`}
            type="button"
            disabled={disabled}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onShortcutPress(shortcut);
            }}
            className={`pointer-events-auto absolute max-w-[min(44%,11rem)] -translate-x-1/2 -translate-y-1/2 truncate rounded-full border-2 ${anchorBgClass} px-2.5 py-1 text-xs font-semibold shadow-sm ${SHORTCUT_OVERLAY_OPACITY_CLASS} hover:opacity-100 disabled:opacity-50`}
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
