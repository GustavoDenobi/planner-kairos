export type EventParticipantMembership = {
  groupId: string;
  groupName: string;
  sectionId: string | null;
  sectionName: string | null;
  sectionSortOrder: number | null;
  partId: string | null;
  partName: string | null;
};

export type EventParticipantAssignment = EventParticipantMembership & {
  musicianId: string;
  musicianName: string;
};

export type EventParticipant = {
  musicianId: string;
  fullName: string;
  groupNames: string[];
  partNames: string[];
  memberships: EventParticipantMembership[];
};

export type EventAbsence = {
  musicianId: string;
  markedBy: string;
  markedAt: string;
};

/** Verdadeiro quando há participantes (exceto ignorados) e todos estão ausentes. */
export function eventAllParticipantsAbsent(
  participantMusicianIds: readonly string[],
  absentMusicianIds: readonly string[],
  ignoredMusicianIds: readonly string[] = [],
): boolean {
  const ignored = new Set(ignoredMusicianIds);
  const participants = participantMusicianIds.filter((musicianId) => !ignored.has(musicianId));
  if (participants.length === 0) {
    return false;
  }
  const absent = new Set(absentMusicianIds);
  return participants.every((musicianId) => absent.has(musicianId));
}
