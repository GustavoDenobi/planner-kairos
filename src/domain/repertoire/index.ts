export type { PieceCategory, PieceCategoryInput } from './piece-category';
export type { PieceTheme, PieceThemeInput } from './piece-theme';
export type {
  Piece,
  PieceAccessInput,
  PieceAudienceGroup,
  PieceAudienceMusician,
  PieceDetail,
  PieceFileAccessScope,
  PieceFileAccessSettingsInput,
  PieceInput,
  PieceListItem,
} from './piece';
export type {
  PieceFile,
  PieceFileKind,
  PieceFilePartLink,
  PieceFileWithLinks,
} from './piece-file';
export type {
  AnnotationGeometry,
  AnnotationLayer,
  AnnotationType,
  CreatePdfAnnotationInput,
  HighlightGeometry,
  NormalizedPoint,
  PdfAnnotation,
  StrokeGeometry,
  UpdatePdfAnnotationInput,
} from './piece-file-annotation';
export {
  ANNOTATION_COLORS,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLORS_INVERTED,
  resolveHighlightColor,
} from './piece-file-annotation';
export type {
  ReadingPlaylist,
  ReadingPlaylistDetail,
  ReadingPlaylistItem,
  ReadingPlaylistItemDetail,
  ReadingPlaylistPieceCategory,
  CreateReadingPlaylistInput,
  CreateReadingPlaylistItemInput,
  UpdateReadingPlaylistInput,
} from './reading-playlist';
export {
  defaultPieceFileTitle,
  filterScoreCandidatesForUser,
  isGeneralScoreFile,
  partitionPieceFilesForViewer,
  isPieceFileScore,
  mimeToPieceFileKind,
  resolvePieceFileMime,
  normalizePieceAliases,
  pieceFileMatchesUserParts,
  resolveDefaultScoreFile,
  slugifyName,
  validateAnnotationGeometry,
  validateAnnotationLayer,
  validateCreatePdfAnnotationInput,
  validateCreateReadingPlaylistInput,
  validatePieceCategoryInput,
  validatePieceFileMime,
  validatePieceFilePartLinks,
  validatePieceFileTitle,
  validatePieceInput,
  validatePieceThemeInput,
  validateUpdateReadingPlaylistInput,
  eventSourcedPlaylistExpiresAt,
  isEventSourcedPlaylistExpired,
  EVENT_SOURCED_PLAYLIST_TTL_MS,
} from './rules';
export {
  buildAccessPathsForUser,
  canSeePiece,
  filterPieceFilesForAccess,
  isUserConductorInLinkedGroups,
  mergeResolvedAccess,
  pieceHasNoAudience,
  resolvePieceFileAccess,
  resolveRulesForPath,
} from './file-access';
export type {
  PieceAccessContext,
  PieceAccessPath,
  ResolvedPieceFileAccess,
} from './file-access';
