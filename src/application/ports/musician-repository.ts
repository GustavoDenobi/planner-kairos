import type { Musician, MusicianInput, MusicianListItem } from '@/domain/ensemble';

export type MusicianSortField = 'name' | 'created_at';
export type MusicianSortDirection = 'asc' | 'desc';

export type ListMusiciansOptions = {
  query?: string;
  sortBy?: MusicianSortField;
  sortDirection?: MusicianSortDirection;
  limit?: number;
  offset?: number;
};

export type PaginatedMusicians = {
  items: MusicianListItem[];
  totalCount: number;
  hasMore: boolean;
};

export type MusicianRepository = {
  listForOrg(organizationId: string, options?: ListMusiciansOptions): Promise<PaginatedMusicians>;
  getById(organizationId: string, musicianId: string): Promise<Musician | null>;
  update(organizationId: string, musicianId: string, input: MusicianInput): Promise<Musician>;
  delete(organizationId: string, musicianId: string): Promise<void>;
};
