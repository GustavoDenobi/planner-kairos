import type { FileStorage } from '@/application/ports/file-storage';
import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import type { OrganizationRepository } from '@/application/ports/organization-repository';
import type { PartRepository } from '@/application/ports/part-repository';
import type { PieceCategoryRepository } from '@/application/ports/piece-category-repository';
import type { AnnotationSetRepository } from '@/application/ports/annotation-set-repository';
import type { PieceFileAnnotationRepository } from '@/application/ports/piece-file-annotation-repository';
import type { PieceFileNavigationShortcutRepository } from '@/application/ports/piece-file-navigation-shortcut-repository';
import type { PieceFileTocEntryRepository } from '@/application/ports/piece-file-toc-entry-repository';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { PieceAccessRepository } from '@/application/ports/piece-access-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { PieceThemeRepository } from '@/application/ports/piece-theme-repository';
import type { ReadingPlaylistRepository } from '@/application/ports/reading-playlist-repository';
import type { SearchPiecesOptions } from '@/application/ports/piece-repository';
import type { CreatePdfAnnotationInput, CreateAnnotationSetInput, CreatePdfNavigationShortcutInput, CreatePieceFileTocEntryInput, PieceAccessInput, PieceCategoryInput, PieceInput, PieceThemeInput, UpdateAnnotationSetInput, UpdatePdfAnnotationInput, UpdatePdfNavigationShortcutInput, UpdatePieceFileTocEntryInput, CreateReadingPlaylistInput, CreateReadingPlaylistItemInput, UpdateReadingPlaylistInput } from '@/domain/repertoire';

import {
  createPieceCategory,
  deletePieceCategory,
  listPieceCategories,
  reorderPieceCategories,
  updatePieceCategory,
} from './category-use-cases';
import {
  createPieceFileAnnotation,
  deletePieceFileAnnotation,
  listPieceFileAnnotations,
  updatePieceFileAnnotation,
} from './annotation-use-cases';
import {
  createAnnotationSet,
  deleteAnnotationSet,
  listAnnotationSetsForFile,
  updateAnnotationSet,
} from './annotation-set-use-cases';
import {
  createPieceFileNavigationShortcut,
  deletePieceFileNavigationShortcut,
  listPieceFileNavigationShortcuts,
  reorderPieceFileNavigationShortcuts,
  updatePieceFileNavigationShortcut,
} from './navigation-shortcut-use-cases';
import {
  createPieceFileTocEntry,
  deletePieceFileTocEntry,
  listPieceFileTocEntries,
  listPieceTocEntries,
  reorderPieceFileTocEntries,
  updatePieceFileTocEntry,
} from './toc-entry-use-cases';
import type { AttachPieceFileInput, UpdatePieceFileInput } from './file-use-cases';
import { attachPieceFile, getPieceFileDownloadUrl, removePieceFile, reorderPieceScoreFiles, updatePieceFile } from './file-use-cases';
import {
  createReadingPlaylist,
  deleteReadingPlaylist,
  getReadingPlaylist,
  listReadingPlaylists,
  replaceReadingPlaylistItems,
  updateReadingPlaylist,
} from './reading-playlist-use-cases';
import {
  listPieceCategoryIdsByGroup,
  shouldWarnEmptyPieceAudience,
  updatePieceAccess,
} from './piece-access-use-cases';
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
  accessRepo: PieceAccessRepository;
  fileRepo: PieceFileRepository;
  annotationRepo: PieceFileAnnotationRepository;
  annotationSetRepo: AnnotationSetRepository;
  navigationShortcutRepo: PieceFileNavigationShortcutRepository;
  tocEntryRepo: PieceFileTocEntryRepository;
  playlistRepo: ReadingPlaylistRepository;
  partRepo: PartRepository;
  fileStorage: FileStorage;
  membershipRepo: MembershipRepository;
  musicianRepo: MusicianRepository;
  assignmentRepo: AssignmentRepository;
  orgRepo: OrganizationRepository;
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
    reorderPieceCategories: (organizationId: string, orderedCategoryIds: string[]) =>
      reorderPieceCategories(deps.categoryRepo, organizationId, orderedCategoryIds),

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
    updatePieceAccess: (organizationId: string, pieceId: string, input: PieceAccessInput) =>
      updatePieceAccess(deps.pieceRepo, deps.accessRepo, organizationId, pieceId, input),
    shouldWarnEmptyPieceAudience: (
      isAdmin: boolean,
      groupIds: string[],
      musicianIds: string[],
    ) => shouldWarnEmptyPieceAudience(isAdmin, groupIds, musicianIds),
    listPieceCategoryIdsByGroup: (organizationId: string) =>
      listPieceCategoryIdsByGroup(deps.accessRepo, organizationId),
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
    reorderPieceScoreFiles: (
      organizationId: string,
      pieceId: string,
      orderedFileIds: string[],
    ) =>
      reorderPieceScoreFiles(deps.pieceRepo, deps.fileRepo, organizationId, pieceId, orderedFileIds),

    listPieceFileAnnotations: (organizationId: string, pieceFileId: string) =>
      listPieceFileAnnotations(deps.annotationRepo, organizationId, pieceFileId),
    createPieceFileAnnotation: (
      organizationId: string,
      pieceId: string,
      authorUserId: string,
      input: CreatePdfAnnotationInput,
    ) =>
      createPieceFileAnnotation(
        deps.fileRepo,
        deps.annotationRepo,
        deps.annotationSetRepo,
        organizationId,
        pieceId,
        authorUserId,
        input,
      ),
    updatePieceFileAnnotation: (
      organizationId: string,
      pieceFileId: string,
      annotationId: string,
      input: UpdatePdfAnnotationInput,
    ) =>
      updatePieceFileAnnotation(
        deps.annotationRepo,
        organizationId,
        pieceFileId,
        annotationId,
        input,
      ),
    deletePieceFileAnnotation: (
      organizationId: string,
      pieceFileId: string,
      annotationId: string,
    ) => deletePieceFileAnnotation(deps.annotationRepo, organizationId, pieceFileId, annotationId),

    listAnnotationSetsForFile: (organizationId: string, pieceFileId: string) =>
      listAnnotationSetsForFile(deps.annotationSetRepo, organizationId, pieceFileId),
    createAnnotationSet: (
      organizationId: string,
      pieceId: string,
      authorUserId: string,
      input: CreateAnnotationSetInput,
    ) =>
      createAnnotationSet(
        deps.fileRepo,
        deps.annotationSetRepo,
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        deps.orgRepo,
        organizationId,
        pieceId,
        authorUserId,
        input,
      ),
    updateAnnotationSet: (
      organizationId: string,
      userId: string,
      setId: string,
      input: UpdateAnnotationSetInput,
    ) =>
      updateAnnotationSet(
        deps.annotationSetRepo,
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        deps.orgRepo,
        organizationId,
        userId,
        setId,
        input,
      ),
    deleteAnnotationSet: (organizationId: string, setId: string) =>
      deleteAnnotationSet(deps.annotationSetRepo, organizationId, setId),

    listPieceFileNavigationShortcuts: (organizationId: string, pieceFileId: string) =>
      listPieceFileNavigationShortcuts(deps.navigationShortcutRepo, organizationId, pieceFileId),
    createPieceFileNavigationShortcut: (
      organizationId: string,
      pieceId: string,
      authorUserId: string,
      input: CreatePdfNavigationShortcutInput,
    ) =>
      createPieceFileNavigationShortcut(
        deps.fileRepo,
        deps.navigationShortcutRepo,
        organizationId,
        pieceId,
        authorUserId,
        input,
      ),
    updatePieceFileNavigationShortcut: (
      organizationId: string,
      pieceFileId: string,
      shortcutId: string,
      input: UpdatePdfNavigationShortcutInput,
    ) =>
      updatePieceFileNavigationShortcut(
        deps.navigationShortcutRepo,
        organizationId,
        pieceFileId,
        shortcutId,
        input,
      ),
    deletePieceFileNavigationShortcut: (
      organizationId: string,
      pieceFileId: string,
      shortcutId: string,
    ) =>
      deletePieceFileNavigationShortcut(
        deps.navigationShortcutRepo,
        organizationId,
        pieceFileId,
        shortcutId,
      ),
    reorderPieceFileNavigationShortcuts: (
      organizationId: string,
      pieceFileId: string,
      orderedIds: string[],
    ) =>
      reorderPieceFileNavigationShortcuts(
        deps.navigationShortcutRepo,
        organizationId,
        pieceFileId,
        orderedIds,
      ),

    listPieceFileTocEntries: (organizationId: string, pieceFileId: string) =>
      listPieceFileTocEntries(deps.tocEntryRepo, organizationId, pieceFileId),
    listPieceTocEntries: (organizationId: string, pieceId: string) =>
      listPieceTocEntries(deps.tocEntryRepo, organizationId, pieceId),
    createPieceFileTocEntry: (
      organizationId: string,
      pieceId: string,
      input: CreatePieceFileTocEntryInput,
    ) =>
      createPieceFileTocEntry(
        deps.fileRepo,
        deps.tocEntryRepo,
        organizationId,
        pieceId,
        input,
      ),
    updatePieceFileTocEntry: (
      organizationId: string,
      pieceFileId: string,
      entryId: string,
      input: UpdatePieceFileTocEntryInput,
    ) =>
      updatePieceFileTocEntry(
        deps.tocEntryRepo,
        organizationId,
        pieceFileId,
        entryId,
        input,
      ),
    deletePieceFileTocEntry: (
      organizationId: string,
      pieceFileId: string,
      entryId: string,
    ) =>
      deletePieceFileTocEntry(deps.tocEntryRepo, organizationId, pieceFileId, entryId),
    reorderPieceFileTocEntries: (
      organizationId: string,
      pieceFileId: string,
      orderedIds: string[],
    ) =>
      reorderPieceFileTocEntries(deps.tocEntryRepo, organizationId, pieceFileId, orderedIds),

    listReadingPlaylists: (organizationId: string, ownerUserId: string) =>
      listReadingPlaylists(deps.playlistRepo, organizationId, ownerUserId),
    getReadingPlaylist: (organizationId: string, playlistId: string, ownerUserId: string) =>
      getReadingPlaylist(deps.playlistRepo, organizationId, playlistId, ownerUserId),
    createReadingPlaylist: (
      organizationId: string,
      ownerUserId: string,
      input: CreateReadingPlaylistInput,
    ) =>
      createReadingPlaylist(
        deps.fileRepo,
        deps.playlistRepo,
        organizationId,
        ownerUserId,
        input,
      ),
    updateReadingPlaylist: (
      organizationId: string,
      playlistId: string,
      ownerUserId: string,
      input: UpdateReadingPlaylistInput,
    ) =>
      updateReadingPlaylist(
        deps.playlistRepo,
        organizationId,
        playlistId,
        ownerUserId,
        input,
      ),
    replaceReadingPlaylistItems: (
      organizationId: string,
      playlistId: string,
      ownerUserId: string,
      items: CreateReadingPlaylistItemInput[],
    ) =>
      replaceReadingPlaylistItems(
        deps.fileRepo,
        deps.playlistRepo,
        organizationId,
        playlistId,
        ownerUserId,
        items,
      ),
    deleteReadingPlaylist: (
      organizationId: string,
      playlistId: string,
      ownerUserId: string,
    ) => deleteReadingPlaylist(deps.playlistRepo, organizationId, playlistId, ownerUserId),
  };
}

export type RepertoireUseCases = ReturnType<typeof createRepertoireUseCases>;
