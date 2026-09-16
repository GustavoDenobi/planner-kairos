import bravuraWoff2Url from '@/assets/fonts/BravuraText.woff2?url';
import bravuraWoffUrl from '@/assets/fonts/BravuraText.woff?url';
import { ANNOTATION_SMUFL_FONT_FAMILY } from '@/ui/features/repertoire/annotation-text-metrics';

const SAMPLE = '\uE047';
const PUBLIC_WOFF2 = '/fonts/BravuraText-smufl.woff2';
const PUBLIC_WOFF = '/fonts/BravuraText-smufl.woff';

const FACE_OPTIONS: FontFaceDescriptors = {
  display: 'block',
  weight: '400',
  style: 'normal',
  unicodeRange: 'U+E000-F8FF',
};

let loadPromise: Promise<boolean> | null = null;

function fontSpec(): string {
  return `16px "${ANNOTATION_SMUFL_FONT_FAMILY}"`;
}

async function loadFace(url: string, format: 'woff2' | 'woff'): Promise<boolean> {
  const face = new FontFace(
    ANNOTATION_SMUFL_FONT_FAMILY,
    `url("${url}") format("${format}")`,
    FACE_OPTIONS,
  );
  const loaded = await face.load();
  document.fonts.add(loaded);
  return loaded.status === 'loaded';
}

export function ensureSmuflFontLoaded(): Promise<boolean> {
  if (typeof document === 'undefined' || !document.fonts) {
    return Promise.resolve(false);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const sources: Array<{ url: string; format: 'woff2' | 'woff' }> = [
      { url: bravuraWoff2Url, format: 'woff2' },
      { url: bravuraWoffUrl, format: 'woff' },
      { url: PUBLIC_WOFF2, format: 'woff2' },
      { url: PUBLIC_WOFF, format: 'woff' },
    ];

    for (const source of sources) {
      try {
        if (await loadFace(source.url, source.format)) {
          return true;
        }
      } catch {
        // Try the next format or public fallback.
      }
    }

    try {
      await document.fonts.load(fontSpec(), SAMPLE);
    } catch {
      // CSS @font-face may still resolve.
    }

    return document.fonts.check(fontSpec(), SAMPLE);
  })();

  return loadPromise;
}
