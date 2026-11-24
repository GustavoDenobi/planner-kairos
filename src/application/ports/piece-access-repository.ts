import type {
  PieceAccessInput,
  PieceAudienceGroup,
  PieceAudienceMusician,
  PiecePartLink,
  RepertoirePieceMembership,
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
  loadPartLinks(organizationId: string, pieceIds: string[]): Promise<Map<string, PiecePartLink[]>>;
  replacePartLinks(
    organizationId: string,
    pieceId: string,
    partLinks: PiecePartLink[],
  ): Promise<void>;
  updateAccessSettings(
    organizationId: string,
    pieceId: string,
    input: Pick<
      PieceAccessInput,
      'fileAccessScope' | 'allowFileDownload' | 'audioAccessScope' | 'audioAllowDownload'
    >,
  ): Promise<void>;
  /** Todas as obras visíveis da organização, com categoria e grupos vinculados. */
  listPieceGroupMemberships(organizationId: string): Promise<RepertoirePieceMembership[]>;
};
