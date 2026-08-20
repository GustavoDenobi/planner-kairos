import { useEffect } from 'react';

const KEYBOARD_GAP_PX = 80;

function syncVisualViewport() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  const height = viewport?.height ?? window.innerHeight;
  const offsetTop = viewport?.offsetTop ?? 0;
  const keyboardGap = Math.max(0, window.innerHeight - height - offsetTop);

  root.style.setProperty('--app-vh', `${height}px`);
  root.style.setProperty('--vv-offset-top', `${offsetTop}px`);

  if (keyboardGap > KEYBOARD_GAP_PX) {
    root.setAttribute('data-keyboard-open', '');
  } else {
    root.removeAttribute('data-keyboard-open');
  }
}

export function VisualViewportSync() {
  useEffect(() => {
    syncVisualViewport();

    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', syncVisualViewport);
    viewport?.addEventListener('scroll', syncVisualViewport);
    window.addEventListener('resize', syncVisualViewport);

    return () => {
      viewport?.removeEventListener('resize', syncVisualViewport);
      viewport?.removeEventListener('scroll', syncVisualViewport);
      window.removeEventListener('resize', syncVisualViewport);
      document.documentElement.removeAttribute('data-keyboard-open');
      document.documentElement.style.removeProperty('--app-vh');
      document.documentElement.style.removeProperty('--vv-offset-top');
    };
  }, []);

  return null;
}
