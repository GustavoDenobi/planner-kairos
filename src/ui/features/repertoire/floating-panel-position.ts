export type FloatingPanelPosition = {
  top: number;
  left: number;
};

export type ViewportOffset = {
  x: number;
  y: number;
};

type ViewportBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const VIEWPORT_MARGIN = 8;
const PANEL_GAP = 4;
const CLIPPING_OVERFLOW = /auto|scroll|hidden|clip/;

function getVisibleViewportRect(margin = VIEWPORT_MARGIN): ViewportBounds {
  const viewport = window.visualViewport;
  const left = (viewport?.offsetLeft ?? 0) + margin;
  const top = (viewport?.offsetTop ?? 0) + margin;
  const width = Math.max(0, (viewport?.width ?? window.innerWidth) - margin * 2);
  const height = Math.max(0, (viewport?.height ?? window.innerHeight) - margin * 2);

  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

export function getContainingClipRect(
  element: Element,
  margin = VIEWPORT_MARGIN,
): ViewportBounds {
  let bounds = getVisibleViewportRect(margin);
  let parent = element.parentElement;

  while (parent) {
    const style = getComputedStyle(parent);
    const clips =
      CLIPPING_OVERFLOW.test(style.overflowX) || CLIPPING_OVERFLOW.test(style.overflowY);
    if (clips) {
      const rect = parent.getBoundingClientRect();
      const left = Math.max(bounds.left, rect.left + margin);
      const top = Math.max(bounds.top, rect.top + margin);
      const right = Math.min(bounds.right, rect.right - margin);
      const bottom = Math.min(bounds.bottom, rect.bottom - margin);
      bounds = {
        left,
        top,
        right: Math.max(left, right),
        bottom: Math.max(top, bottom),
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
    }
    parent = parent.parentElement;
  }

  return bounds;
}

export function computeViewportClampOffset(
  rect: DOMRectReadOnly,
  clip: ViewportBounds,
): ViewportOffset {
  let x = 0;
  let y = 0;

  if (rect.width >= clip.width) {
    x = clip.left - rect.left;
  } else {
    if (rect.right > clip.right) {
      x = clip.right - rect.right;
    }
    if (rect.left + x < clip.left) {
      x = clip.left - rect.left;
    }
  }

  if (rect.height >= clip.height) {
    y = clip.top - rect.top;
  } else {
    if (rect.bottom > clip.bottom) {
      y = clip.bottom - rect.bottom;
    }
    if (rect.top + y < clip.top) {
      y = clip.top - rect.top;
    }
  }

  return { x, y };
}

export function computeFloatingPanelPosition(
  anchor: DOMRect,
  panel: DOMRect,
): FloatingPanelPosition {
  const view = getVisibleViewportRect();
  const maxLeft = view.right - panel.width;
  const maxTop = view.bottom - panel.height;

  let left = anchor.left;
  if (left > maxLeft) {
    left = maxLeft;
  }
  if (left < view.left) {
    left = view.left;
  }

  const spaceAbove = anchor.top - view.top;
  const spaceBelow = view.bottom - anchor.bottom;
  const openBelow = spaceAbove < panel.height + PANEL_GAP && spaceBelow >= spaceAbove;

  let top = openBelow ? anchor.bottom + PANEL_GAP : anchor.top - panel.height - PANEL_GAP;

  if (top > maxTop) {
    top = maxTop;
  }
  if (top < view.top) {
    top = view.top;
  }

  return { top, left };
}
