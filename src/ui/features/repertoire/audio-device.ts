export function isIosVolumeControlUnsupported(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return true;
  }

  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}
