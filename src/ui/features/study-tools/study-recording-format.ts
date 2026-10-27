const RECORDING_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
] as const;

export function pickStudyRecordingMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  for (const mimeType of RECORDING_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return '';
}

export function studyRecordingFileExtension(mimeType: string): string {
  if (mimeType.includes('webm')) {
    return 'webm';
  }
  if (mimeType.includes('mp4') || mimeType.includes('aac')) {
    return 'm4a';
  }
  return 'audio';
}

export function buildDefaultStudyRecordingTitle(createdAt: Date = new Date()): string {
  const label = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(createdAt);
  return `Gravação ${label}`;
}

/** Evita títulos idênticos na lista (ex.: duas gravações no mesmo instante). */
export function uniqueStudyRecordingTitle(
  baseTitle: string,
  existingTitles: Iterable<string>,
): string {
  const taken = new Set(existingTitles);
  if (!taken.has(baseTitle)) {
    return baseTitle;
  }
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${baseTitle} (${n})`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  return `${baseTitle} (${crypto.randomUUID().slice(0, 8)})`;
}

export function sanitizeStudyRecordingFilename(title: string): string {
  const trimmed = title.trim() || 'gravacao';
  return trimmed.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 80);
}

export function formatRecordingByteSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
