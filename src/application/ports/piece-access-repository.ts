import type {
  PieceAccessInput,
  PieceAudienceGroup,
  PieceAudienceMusician,
} from '@/domain/repertoire';

export type PieceAccessRepository = {
  loadAudience(
    organizationId: string,
    pieceIds: string[],
  ): Promise<
    Map<
      string,
      {
        groups: PieceAudienceGroup[];
        musicians: PieceAudienceMusician[];
      }
    >
  >;
  replaceAudience(
    organizationId: string,
    pieceId: string,
    groupIds: string[],
    musicianIds: string[],
  ): Promise<void>;
  updateAccessSettings(
    organizationId: string,
    pieceId: string,
    input: Pick<PieceAccessInput, 'fileAccessScope' | 'allowFileDownload'>,
  ): Promise<void>;
  listCategoryIdsByGroup(organizationId: string): Promise<Map<string, string[]>>;
  listUnlinkedCategoryIds(organizationId: string): Promise<string[]>;
};
