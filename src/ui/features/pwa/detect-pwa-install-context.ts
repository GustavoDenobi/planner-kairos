export type PwaInstallContextKind =
  | 'installed'
  | 'native'
  | 'ios-safari'
  | 'mac-safari'
  | 'android-manual'
  | 'desktop-chrome'
  | 'samsung-internet'
  | 'in-app-browser'
  | 'unsupported';

export type PwaInstallDetectionInput = {
  userAgent: string;
  isSecureContext: boolean;
  displayModeStandalone: boolean;
  navigatorStandalone?: boolean;
  platform?: string;
  maxTouchPoints?: number;
};

const IN_APP_BROWSER_PATTERN =
  /FBAN|FBAV|Instagram|Line\/|WhatsApp|Twitter|TikTok|Snapchat|Pinterest|LinkedInApp|MicroMessenger|\bGSA\/|\bwv\b/i;

const NON_SAFARI_PATTERN = /Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPiOS|Edg\/|OPR\//i;
const CHROME_FAMILY_PATTERN = /Chrome|Chromium|Edg\/|OPR\//i;
const IOS_DEVICE_PATTERN = /iPhone|iPad|iPod/i;
const ANDROID_PATTERN = /Android/i;
const SAMSUNG_BROWSER_PATTERN = /SamsungBrowser/i;
const MAC_PATTERN = /Macintosh|Mac OS X/i;

function isIos(input: PwaInstallDetectionInput): boolean {
  if (IOS_DEVICE_PATTERN.test(input.userAgent)) {
    return true;
  }
  return input.platform === 'MacIntel' && (input.maxTouchPoints ?? 0) > 1;
}

function isSafari(userAgent: string): boolean {
  return /Safari/i.test(userAgent) && !NON_SAFARI_PATTERN.test(userAgent);
}

function isInAppBrowser(userAgent: string): boolean {
  return IN_APP_BROWSER_PATTERN.test(userAgent);
}

export function detectPwaInstallContext(input: PwaInstallDetectionInput): PwaInstallContextKind {
  if (input.displayModeStandalone || input.navigatorStandalone === true) {
    return 'installed';
  }

  if (!input.isSecureContext) {
    return 'unsupported';
  }

  const ua = input.userAgent;

  if (isInAppBrowser(ua)) {
    return 'in-app-browser';
  }

  if (isIos(input)) {
    return isSafari(ua) ? 'ios-safari' : 'in-app-browser';
  }

  if (SAMSUNG_BROWSER_PATTERN.test(ua)) {
    return 'samsung-internet';
  }

  if (ANDROID_PATTERN.test(ua)) {
    return 'android-manual';
  }

  if (MAC_PATTERN.test(ua) && isSafari(ua)) {
    return 'mac-safari';
  }

  if (CHROME_FAMILY_PATTERN.test(ua)) {
    return 'desktop-chrome';
  }

  return 'unsupported';
}

export function detectPwaInstallContextFromWindow(): PwaInstallContextKind {
  if (typeof window === 'undefined') {
    return 'unsupported';
  }

  const nav = window.navigator as Navigator & { standalone?: boolean };
  const displayModeStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;

  return detectPwaInstallContext({
    userAgent: nav.userAgent,
    isSecureContext: window.isSecureContext,
    displayModeStandalone,
    navigatorStandalone: nav.standalone === true,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
  });
}

export function shouldShowPwaInstallPrompt(kind: PwaInstallContextKind): boolean {
  return kind !== 'installed' && kind !== 'unsupported';
}
