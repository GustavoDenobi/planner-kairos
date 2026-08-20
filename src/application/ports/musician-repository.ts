import type { EnsembleRole, Musician, MusicianInput, MusicianListItem } from '@/domain/ensemble';

export type MusicianSortField = 'name' | 'created_at';
export type MusicianSortDirection = 'asc' | 'desc';

export type ListMusiciansOptions = {
  query?: string;
  sortBy?: MusicianSortField;
  sortDirection?: MusicianSortDirection;
  groupId?: string;
  sectionId?: string;
  partId?: string;
  ensembleRole?: EnsembleRole;
  limit?: number;
  offset?: number;
};

export type PaginatedMusicians = {
  items: MusicianListItem[];
  totalCount: number;
  hasMore: boolean;
};

export type MusicianName = {
  id: string;
  fullName: string;
  userId: string | null;
};

export type MusicianRepository = {
  listForOrg(organizationId: string, options?: ListMusiciansOptions): Promise<PaginatedMusicians>;
  listNamesForOrg(organizationId: string): Promise<MusicianName[]>;
  getById(organizationId: string, musicianId: string): Promise<Musician | null>;
  getByUserId(organizationId: string, userId: string): Promise<Musician | null>;
  update(organizationId: string, musicianId: string, input: MusicianInput): Promise<Musician>;
  delete(organizationId: string, musicianId: string): Promise<void>;
};
