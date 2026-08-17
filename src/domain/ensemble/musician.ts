export type Musician = {
  id: string;
  organizationId: string;
  fullName: string;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  userId: string | null;
  notes: string | null;
};

export type MusicianListItem = Musician & {
  createdAt: string;
  assignmentCount: number;
  groupNames: string[];
};

export type MusicianInput = {
  fullName: string;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
};
