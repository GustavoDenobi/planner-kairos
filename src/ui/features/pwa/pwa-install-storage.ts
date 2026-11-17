const STORAGE_KEY = 'planner-kairos:pwa-install-dismissed-at';

/** Depois de fechado, o banner some por este tempo (o atalho no menu continua). */
export const PWA_INSTALL_DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

export function isPwaInstallDismissed(now: number = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const dismissedAt = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(dismissedAt) && now - dismissedAt < PWA_INSTALL_DISMISS_MS;
  } catch {
    return false;
  }
}

export function dismissPwaInstall(now: number = Date.now()): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(now));
  } catch {
    /* Ignore quota / private-mode failures. */
  }
}
