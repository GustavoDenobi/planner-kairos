const STORAGE_KEY = 'planner-kairos:pwa-install-dismissed';

export function isPwaInstallDismissed(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissPwaInstall(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* Ignore quota / private-mode failures. */
  }
}
