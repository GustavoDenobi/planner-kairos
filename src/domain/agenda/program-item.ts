export type ProgramItem = {
  id: string;
  organizationId: string;
  eventId: string;
  pieceId: string;
  sortOrder: number;
  notes: string | null;
};

export type ProgramItemInput = {
  pieceId: string;
  notes?: string | null;
};

export type ProgramItemDetail = ProgramItem & {
  pieceTitle: string;
  pieceDeleted: boolean;
  pieceCategory: {
    name: string;
    slug: string;
    color: string | null;
  } | null;
};
