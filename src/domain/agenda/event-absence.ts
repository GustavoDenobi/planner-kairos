export type EventParticipant = {
  musicianId: string;
  fullName: string;
  groupNames: string[];
  partNames: string[];
};

export type EventAbsence = {
  musicianId: string;
  markedBy: string;
  markedAt: string;
};
