/** `false` só quando o navegador diz com certeza que não toca o formato. */
export function canBrowserPlayAudio(mimeType: string): boolean {
  if (typeof document === 'undefined') {
    return true;
  }
  const probe = document.createElement('audio');
  if (typeof probe.canPlayType !== 'function') {
    return true;
  }
  const normalized = mimeType.trim();
  if (!normalized) {
    return true;
  }
  if (probe.canPlayType(normalized) !== '') {
    return true;
  }
  // Alguns navegadores respondem "" para o tipo com codecs, mas tocam o contêiner.
  const container = normalized.split(';')[0]?.trim() ?? '';
  return container !== normalized && container !== '' && probe.canPlayType(container) !== '';
}
