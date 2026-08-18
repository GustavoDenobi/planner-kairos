import type {
  CreateReadingPlaylistInput,
  ReadingPlaylist,
  ReadingPlaylistDetail,
  CreateReadingPlaylistItemInput,
  UpdateReadingPlaylistInput,
} from '@/domain/repertoire';

export type ReadingPlaylistRepository = {
  listForUser(organizationId: string, ownerUserId: string): Promise<ReadingPlaylist[]>;
  getDetail(
    organizationId: string,
    playlistId: string,
    ownerUserId: string,
  ): Promise<ReadingPlaylistDetail | null>;
  create(
    organizationId: string,
    ownerUserId: string,
    input: CreateReadingPlaylistInput,
  ): Promise<ReadingPlaylistDetail>;
  update(
    organizationId: string,
    playlistId: string,
    ownerUserId: string,
    input: UpdateReadingPlaylistInput,
  ): Promise<ReadingPlaylistDetail | null>;
  replaceItems(
    organizationId: string,
    playlistId: string,
    ownerUserId: string,
    items: CreateReadingPlaylistItemInput[],
  ): Promise<ReadingPlaylistDetail | null>;
  remove(organizationId: string, playlistId: string, ownerUserId: string): Promise<boolean>;
};
