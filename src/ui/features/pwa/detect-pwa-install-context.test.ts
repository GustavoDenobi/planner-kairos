import { describe, expect, it } from 'vitest';
import {
  detectPwaInstallContext,
  shouldShowPwaInstallPrompt,
  type PwaInstallDetectionInput,
} from './detect-pwa-install-context';

const USER_AGENTS = {
  iosSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  iosChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  samsungInternet:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  whatsappIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1 WhatsApp/24.0.0',
  facebookIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/1.0]',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  desktopEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  desktopFirefox:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
};

function input(
  userAgent: string,
  overrides: Partial<PwaInstallDetectionInput> = {},
): PwaInstallDetectionInput {
  return {
    userAgent,
    isSecureContext: true,
    displayModeStandalone: false,
    ...overrides,
  };
}

describe('detectPwaInstallContext', () => {
  it('detects an already installed standalone app', () => {
    expect(detectPwaInstallContext(input(USER_AGENTS.desktopChrome, { displayModeStandalone: true }))).toBe(
      'installed',
    );
  });

  it('detects iOS Safari standalone via navigator.standalone', () => {
    expect(
      detectPwaInstallContext(input(USER_AGENTS.iosSafari, { navigatorStandalone: true })),
    ).toBe('installed');
  });

  it('detects iOS Safari', () => {
    expect(detectPwaInstallContext(input(USER_AGENTS.iosSafari))).toBe('ios-safari');
  });

  it('detects iPadOS Safari via MacIntel + touch points', () => {
    expect(
      detectPwaInstallContext(
        input(USER_AGENTS.macSafari, { platform: 'MacIntel', maxTouchPoints: 5 }),
      ),
    ).toBe('ios-safari');
  });

  it('asks iOS Chrome users to open Safari', () => {
    expect(detectPwaInstallContext(input(USER_AGENTS.iosChrome))).toBe('in-app-browser');
  });

  it('detects Chrome on Android', () => {
    expect(detectPwaInstallContext(input(USER_AGENTS.chromeAndroid))).toBe('android-manual');
  });

  it('marks Samsung Internet as not recommended', () => {
    expect(detectPwaInstallContext(input(USER_AGENTS.samsungInternet))).toBe('samsung-internet');
  });

  it('detects WhatsApp in-app browser', () => {
    expect(detectPwaInstallContext(input(USER_AGENTS.whatsappIos))).toBe('in-app-browser');
  });

  it('detects Facebook in-app browser', () => {
    expect(detectPwaInstallContext(input(USER_AGENTS.facebookIos))).toBe('in-app-browser');
  });

  it('detects Safari on macOS', () => {
    expect(detectPwaInstallContext(input(USER_AGENTS.macSafari, { platform: 'MacIntel' }))).toBe(
      'mac-safari',
    );
  });

  it('detects desktop Chrome and Edge', () => {
    expect(detectPwaInstallContext(input(USER_AGENTS.desktopChrome))).toBe('desktop-chrome');
    expect(detectPwaInstallContext(input(USER_AGENTS.desktopEdge))).toBe('desktop-chrome');
  });

  it('marks desktop Firefox as unsupported', () => {
    expect(detectPwaInstallContext(input(USER_AGENTS.desktopFirefox))).toBe('unsupported');
  });

  it('marks insecure contexts as unsupported', () => {
    expect(detectPwaInstallContext(input(USER_AGENTS.desktopChrome, { isSecureContext: false }))).toBe(
      'unsupported',
    );
  });
});

describe('shouldShowPwaInstallPrompt', () => {
  it('hides installed and unsupported contexts', () => {
    expect(shouldShowPwaInstallPrompt('installed')).toBe(false);
    expect(shouldShowPwaInstallPrompt('unsupported')).toBe(false);
  });

  it('shows installable contexts', () => {
    expect(shouldShowPwaInstallPrompt('ios-safari')).toBe(true);
    expect(shouldShowPwaInstallPrompt('native')).toBe(true);
    expect(shouldShowPwaInstallPrompt('in-app-browser')).toBe(true);
    expect(shouldShowPwaInstallPrompt('samsung-internet')).toBe(true);
  });
});
