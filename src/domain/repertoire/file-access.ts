import type { EnsembleRole, GroupFileAccessSettings } from '@/domain/ensemble';
import type { PieceFileAccessScope, PieceFileKind, PieceFileWithLinks } from '@/domain/repertoire';
import {
  isGeneralPieceFile,
  pieceFileMatchesUserParts,
} from '@/domain/repertoire/rules';

export type PieceFileAccessSettings = {
  fileAccessScope: PieceFileAccessScope | null;
  allowFileDownload: boolean | null;
  audioAccessScope: PieceFileAccessScope | null;
  audioAllowDownload: boolean | null;
};

export type PieceAccessPathViaGroup = {
  kind: 'group';
  groupId: string;
  groupSettings: GroupFileAccessSettings;
};

export type PieceAccessPathViaMusician = {
  kind: 'musician';
};

export type PieceAccessPath = PieceAccessPathViaGroup | PieceAccessPathViaMusician;

export type ResolvedPieceFileAccess = {
  scope: PieceFileAccessScope;
  allowDownload: boolean;
};

export type PieceAccessContext = {
  isAdmin: boolean;
  userPartIds: string[];
  isConductor: boolean;
  hasAudience: boolean;
  isInAudience: boolean;
  pieceSettings: PieceFileAccessSettings;
  accessPaths: PieceAccessPath[];
};

const DEFAULT_MUSICIAN_ACCESS: ResolvedPieceFileAccess = {
  scope: 'own_parts',
  allowDownload: true,
};

function pieceSettingsHasOverride(
  pieceSettings: PieceFileAccessSettings,
  kind: PieceFileKind,
): boolean {
  if (kind === 'audio') {
    return pieceSettings.audioAccessScope !== null || pieceSettings.audioAllowDownload !== null;
  }
  return pieceSettings.fileAccessScope !== null || pieceSettings.allowFileDownload !== null;
}

function scopeFromPieceSettings(
  pieceSettings: PieceFileAccessSettings,
  kind: PieceFileKind,
): PieceFileAccessScope | null {
  return kind === 'audio' ? pieceSettings.audioAccessScope : pieceSettings.fileAccessScope;
}

function downloadFromPieceSettings(
  pieceSettings: PieceFileAccessSettings,
  kind: PieceFileKind,
): boolean | null {
  return kind === 'audio' ? pieceSettings.audioAllowDownload : pieceSettings.allowFileDownload;
}

function scopeFromGroupSettings(
  groupSettings: GroupFileAccessSettings,
  kind: PieceFileKind,
): PieceFileAccessScope {
  return kind === 'audio' ? groupSettings.audioAccessScope : groupSettings.fileAccessScope;
}

function downloadFromGroupSettings(
  groupSettings: GroupFileAccessSettings,
  kind: PieceFileKind,
): boolean {
  return kind === 'audio' ? groupSettings.audioAllowDownload : groupSettings.allowFileDownload;
}

export function pieceAllowsOverride(accessPaths: PieceAccessPath[]): boolean {
  return accessPaths.some(
    (path) => path.kind === 'group' && path.groupSettings.allowPieceAccessOverride,
  );
}

export function resolveRulesForPath(
  path: PieceAccessPath,
  pieceSettings: PieceFileAccessSettings,
  usePieceRules: boolean,
  kind: PieceFileKind = 'score',
): ResolvedPieceFileAccess {
  if (path.kind === 'musician') {
    if (usePieceRules) {
      return {
        scope: scopeFromPieceSettings(pieceSettings, kind) ?? DEFAULT_MUSICIAN_ACCESS.scope,
        allowDownload:
          downloadFromPieceSettings(pieceSettings, kind) ?? DEFAULT_MUSICIAN_ACCESS.allowDownload,
      };
    }
    return DEFAULT_MUSICIAN_ACCESS;
  }

  const { groupSettings } = path;

  if (usePieceRules) {
    return {
      scope:
        scopeFromPieceSettings(pieceSettings, kind) ?? scopeFromGroupSettings(groupSettings, kind),
      allowDownload:
        downloadFromPieceSettings(pieceSettings, kind) ??
        downloadFromGroupSettings(groupSettings, kind),
    };
  }

  return {
    scope: scopeFromGroupSettings(groupSettings, kind),
    allowDownload: downloadFromGroupSettings(groupSettings, kind),
  };
}

export function mergeResolvedAccess(
  paths: ResolvedPieceFileAccess[],
): ResolvedPieceFileAccess {
  if (paths.length === 0) {
    return DEFAULT_MUSICIAN_ACCESS;
  }

  return paths.reduce(
    (merged, current) => ({
      scope:
        merged.scope === 'all_files' || current.scope === 'all_files' ? 'all_files' : 'own_parts',
      allowDownload: merged.allowDownload || current.allowDownload,
    }),
    { scope: 'own_parts' as PieceFileAccessScope, allowDownload: false },
  );
}

function resolvePieceAccessByKind(
  context: PieceAccessContext,
  kind: PieceFileKind,
): ResolvedPieceFileAccess | null {
  if (context.isAdmin) {
    return { scope: 'all_files', allowDownload: true };
  }

  if (!context.hasAudience || !context.isInAudience) {
    return null;
  }

  const usePieceRules =
    pieceAllowsOverride(context.accessPaths) && pieceSettingsHasOverride(context.pieceSettings, kind);

  const pathRules = context.accessPaths.map((path) =>
    resolveRulesForPath(path, context.pieceSettings, usePieceRules, kind),
  );

  return mergeResolvedAccess(pathRules);
}

export function resolvePieceFileAccess(context: PieceAccessContext): ResolvedPieceFileAccess | null {
  return resolvePieceAccessByKind(context, 'score');
}

export function resolvePieceAudioAccess(context: PieceAccessContext): ResolvedPieceFileAccess | null {
  return resolvePieceAccessByKind(context, 'audio');
}

export function canSeePiece(context: PieceAccessContext): boolean {
  if (context.isAdmin) {
    return true;
  }
  return context.hasAudience && context.isInAudience;
}

export function filterPieceFilesForKindAccess(
  files: PieceFileWithLinks[],
  access: ResolvedPieceFileAccess,
  userPartIds: string[],
  isConductor: boolean,
  kind: PieceFileKind,
): PieceFileWithLinks[] {
  const ofKind = files.filter((file) => file.kind === kind);

  if (access.scope === 'all_files') {
    return ofKind;
  }

  return ofKind.filter((file) => {
    if (isGeneralPieceFile(file)) {
      return isConductor;
    }

    return pieceFileMatchesUserParts(file, userPartIds);
  });
}

export function filterPieceFilesForAccess(
  files: PieceFileWithLinks[],
  access: ResolvedPieceFileAccess,
  userPartIds: string[],
  isConductor: boolean,
): PieceFileWithLinks[] {
  return filterPieceFilesForKindAccess(files, access, userPartIds, isConductor, 'score');
}

export function filterAccessibleAudioFiles(
  files: PieceFileWithLinks[],
  audioAccess: ResolvedPieceFileAccess,
  userPartIds: string[],
  isConductor: boolean,
): PieceFileWithLinks[] {
  return filterPieceFilesForKindAccess(files, audioAccess, userPartIds, isConductor, 'audio');
}

export function buildAccessPathsForUser(input: {
  linkedGroupIds: string[];
  linkedMusicianIds: string[];
  userMusicianId: string | null;
  userGroupIds: string[];
  groupSettingsById: Map<string, GroupFileAccessSettings>;
}): PieceAccessPath[] {
  const paths: PieceAccessPath[] = [];

  for (const groupId of input.linkedGroupIds) {
    if (!input.userGroupIds.includes(groupId)) {
      continue;
    }
    const groupSettings = input.groupSettingsById.get(groupId);
    if (!groupSettings) {
      continue;
    }
    paths.push({ kind: 'group', groupId, groupSettings });
  }

  if (
    input.userMusicianId &&
    input.linkedMusicianIds.includes(input.userMusicianId)
  ) {
    paths.push({ kind: 'musician' });
  }

  return paths;
}

export function isUserConductorInLinkedGroups(
  linkedGroupIds: string[],
  assignments: Array<{ groupId: string; ensembleRole: EnsembleRole }>,
): boolean {
  const linked = new Set(linkedGroupIds);
  return assignments.some(
    (assignment) =>
      linked.has(assignment.groupId) && assignment.ensembleRole === 'conductor',
  );
}

export function pieceHasNoAudience(groupIds: string[], musicianIds: string[]): boolean {
  return groupIds.length === 0 && musicianIds.length === 0;
}
