import type { PieceTheme, PieceThemeInput } from '@/domain/repertoire';

export type PieceThemeRepository = {
  listForOrg(organizationId: string): Promise<PieceTheme[]>;
  create(organizationId: string, input: PieceThemeInput): Promise<PieceTheme>;
  update(organizationId: string, themeId: string, input: PieceThemeInput): Promise<PieceTheme>;
  delete(organizationId: string, themeId: string): Promise<void>;
};
