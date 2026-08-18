import type { FileStorage } from '@/application/ports/file-storage';
import type { PartRepository } from '@/application/ports/part-repository';
import type { PieceCategoryRepository } from '@/application/ports/piece-category-repository';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { PieceThemeRepository } from '@/application/ports/piece-theme-repository';
import type { SearchPiecesOptions } from '@/application/ports/piece-repository';
import type { PieceCategoryInput, PieceInput, PieceThemeInput } from '@/domain/repertoire';

import {
  createPieceCategory,
  deletePieceCategory,
  listPieceCategories,
  updatePieceCategory,
} from './category-use-cases';
import { attachPieceFile, getPieceFileDownloadUrl, removePieceFile, updatePieceFile } from './file-use-cases';
import type { AttachPieceFileInput, UpdatePieceFileInput } from './file-use-cases';
import {
  catalogPiece,
  getPiece,
  searchPieces,
  softDeletePiece,
  updatePiece,
} from './piece-use-cases';
import {
  createPieceTheme,
  deletePieceTheme,
  listPieceThemes,
  updatePieceTheme,
} from './theme-use-cases';

export type RepertoireDeps = {
  categoryRepo: PieceCategoryRepository;
  themeRepo: PieceThemeRepository;
  pieceRepo: PieceRepository;
  fileRepo: PieceFileRepository;
  partRepo: PartRepository;
  fileStorage: FileStorage;
};

export function createRepertoireUseCases(deps: RepertoireDeps) {
  return {
    listPieceCategories: (organizationId: string) =>
      listPieceCategories(deps.categoryRepo, organizationId),
    createPieceCategory: (organizationId: string, input: PieceCategoryInput) =>
      createPieceCategory(deps.categoryRepo, organizationId, input),
    updatePieceCategory: (organizationId: string, categoryId: string, input: PieceCategoryInput) =>
      updatePieceCategory(deps.categoryRepo, organizationId, categoryId, input),
    deletePieceCategory: (organizationId: string, categoryId: string) =>
      deletePieceCategory(deps.categoryRepo, organizationId, categoryId),

    listPieceThemes: (organizationId: string) => listPieceThemes(deps.themeRepo, organizationId),
    createPieceTheme: (organizationId: string, input: PieceThemeInput) =>
      createPieceTheme(deps.themeRepo, organizationId, input),
    updatePieceTheme: (organizationId: string, themeId: string, input: PieceThemeInput) =>
      updatePieceTheme(deps.themeRepo, organizationId, themeId, input),
    deletePieceTheme: (organizationId: string, themeId: string) =>
      deletePieceTheme(deps.themeRepo, organizationId, themeId),

    searchPieces: (organizationId: string, options?: SearchPiecesOptions) =>
      searchPieces(deps.pieceRepo, organizationId, options),
    getPiece: (organizationId: string, pieceId: string) =>
      getPiece(deps.pieceRepo, organizationId, pieceId),
    catalogPiece: (organizationId: string, input: PieceInput) =>
      catalogPiece(deps.pieceRepo, organizationId, input),
    updatePiece: (organizationId: string, pieceId: string, input: PieceInput) =>
      updatePiece(deps.pieceRepo, organizationId, pieceId, input),
    softDeletePiece: (organizationId: string, pieceId: string) =>
      softDeletePiece(deps.pieceRepo, organizationId, pieceId),

    attachPieceFile: (organizationId: string, input: AttachPieceFileInput) =>
      attachPieceFile(
      deps.pieceRepo,
      deps.fileRepo,
      deps.partRepo,
      deps.fileStorage,
      organizationId,
      input,
    ),
    updatePieceFile: (
      organizationId: string,
      pieceId: string,
      fileId: string,
      input: UpdatePieceFileInput,
    ) =>
      updatePieceFile(deps.pieceRepo, deps.fileRepo, deps.partRepo, organizationId, pieceId, fileId, input),
    removePieceFile: (organizationId: string, pieceId: string, fileId: string) =>
      removePieceFile(
        deps.pieceRepo,
        deps.fileRepo,
        deps.fileStorage,
        organizationId,
        pieceId,
        fileId,
      ),
    getPieceFileDownloadUrl: (organizationId: string, pieceId: string, fileId: string) =>
      getPieceFileDownloadUrl(
        deps.pieceRepo,
        deps.fileRepo,
        deps.fileStorage,
        organizationId,
        pieceId,
        fileId,
      ),
  };
}

export type RepertoireUseCases = ReturnType<typeof createRepertoireUseCases>;
