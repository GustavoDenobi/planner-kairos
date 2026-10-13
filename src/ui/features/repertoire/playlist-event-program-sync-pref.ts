const PLAYLIST_EVENT_PROGRAM_SYNC_PREF_KEY = 'planner-kairos:playlist-sync-event-program';

export function readPlaylistEventProgramSyncPref(): boolean {
  try {
    return localStorage.getItem(PLAYLIST_EVENT_PROGRAM_SYNC_PREF_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writePlaylistEventProgramSyncPref(syncToEventProgram: boolean): void {
  try {
    localStorage.setItem(PLAYLIST_EVENT_PROGRAM_SYNC_PREF_KEY, syncToEventProgram ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}
