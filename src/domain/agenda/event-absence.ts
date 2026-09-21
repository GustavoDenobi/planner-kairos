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
