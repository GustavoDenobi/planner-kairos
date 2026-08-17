export type Section = {
  id: string;
  organizationId: string;
  groupId: string;
  name: string;
  sortOrder: number;
  notes: string | null;
};

export type SectionListItem = Section & {
  memberCount: number;
};

export type SectionInput = {
  name: string;
  sortOrder?: number;
  notes?: string | null;
  partIds?: string[];
};
