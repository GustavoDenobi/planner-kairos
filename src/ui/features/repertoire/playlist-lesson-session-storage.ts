import type { AnnotationSetAudienceFingerprint } from '@/domain/repertoire/lesson-directed-layer';
import type { ReadingPlaylistSourceEventAudience } from '@/domain/repertoire';

export type PlaylistLessonSessionState = {
  audience: ReadingPlaylistSourceEventAudience;
  rememberedFingerprint: AnnotationSetAudienceFingerprint | null;
  autoEnsureLayers: boolean;
};

const STORAGE_PREFIX = 'playlist-lesson-session:';

function storageKey(playlistId: string): string {
  return `${STORAGE_PREFIX}${playlistId}`;
}

export function loadPlaylistLessonSession(
  playlistId: string,
): PlaylistLessonSessionState | null {
  try {
    const raw = sessionStorage.getItem(storageKey(playlistId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as PlaylistLessonSessionState;
  } catch {
    return null;
  }
}

export function savePlaylistLessonSession(
  playlistId: string,
  state: PlaylistLessonSessionState,
): void {
  try {
    sessionStorage.setItem(storageKey(playlistId), JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

export function createInitialLessonSession(
  sourceAudience: ReadingPlaylistSourceEventAudience,
): PlaylistLessonSessionState {
  return {
    audience: {
      musicianIds: [...sourceAudience.musicianIds],
      groupIds: [...sourceAudience.groupIds],
    },
    rememberedFingerprint: null,
    autoEnsureLayers: true,
  };
}