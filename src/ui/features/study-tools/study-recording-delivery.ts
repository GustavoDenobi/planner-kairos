import type { StudyRecordingRecord } from '@/infrastructure/pwa/db';
import {
  sanitizeStudyRecordingFilename,
  studyRecordingFileExtension,
} from '@/ui/features/study-tools/study-recording-format';

export { isShareCancellation } from '@/ui/features/repertoire/pdf-delivery';

export function studyRecordingDownloadFilename(record: StudyRecordingRecord): string {
  const base = sanitizeStudyRecordingFilename(record.title);
  const extension = studyRecordingFileExtension(record.mimeType);
  const lower = base.toLowerCase();
  if (lower.endsWith(`.${extension}`)) {
    return base;
  }
  return `${base}.${extension}`;
}

export function downloadStudyRecording(record: StudyRecordingRecord): void {
  const url = URL.createObjectURL(record.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = studyRecordingDownloadFilename(record);
  anchor.click();
  URL.revokeObjectURL(url);
}

export function canShareStudyRecording(record: StudyRecordingRecord): boolean {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return false;
  }

  const file = new File([record.blob], studyRecordingDownloadFilename(record), {
    type: record.mimeType || 'application/octet-stream',
  });

  return navigator.canShare({ files: [file] });
}

export async function shareStudyRecording(record: StudyRecordingRecord): Promise<void> {
  const file = new File([record.blob], studyRecordingDownloadFilename(record), {
    type: record.mimeType || 'application/octet-stream',
  });

  if (!navigator.canShare?.({ files: [file] }) || typeof navigator.share !== 'function') {
    throw new Error('share_unavailable');
  }

  await navigator.share({ files: [file], title: record.title });
}
