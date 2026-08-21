import type { EnsembleRole, GroupFileAccessSettings } from '@/domain/ensemble';
import type { PieceFileAccessScope, PieceFileWithLinks } from '@/domain/repertoire';
import {
  isGeneralScoreFile,
  pieceFileMatchesUserParts,
} from '@/domain/repertoire/rules';

export type PieceFileAccessSettings = {
  fileAccessScope: PieceFileAccessScope | null;
  allowFileDownload: boolean | null;
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

export function pieceAllowsOverride(accessPaths: PieceAccessPath[]): boolean {
  return accessPaths.some(
    (path) => path.kind === 'group' && path.groupSettings.allowPieceAccessOverride,
  );
}

export function resolveRulesForPath(
  path: PieceAccessPath,
  pieceSettings: PieceFileAccessSettings,
  usePieceRules: boolean,
): ResolvedPieceFileAccess {
  if (path.kind === 'musician') {
    if (usePieceRules) {
      return {
        scope: pieceSettings.fileAccessScope ?? DEFAULT_MUSICIAN_ACCESS.scope,
        allowDownload: pieceSettings.allowFileDownload ?? DEFAULT_MUSICIAN_ACCESS.allowDownload,
      };
    }
    return DEFAULT_MUSICIAN_ACCESS;
  }

  const { groupSettings } = path;

  if (usePieceRules) {
    return {
      scope: pieceSettings.fileAccessScope ?? groupSettings.fileAccessScope,
      allowDownload: pieceSettings.allowFileDownload ?? groupSettings.allowFileDownload,
    };
  }

  return {
    scope: groupSettings.fileAccessScope,
    allowDownload: groupSettings.allowFileDownload,
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

export function resolvePieceFileAccess(context: PieceAccessContext): ResolvedPieceFileAccess | null {
  if (context.isAdmin) {
    return { scope: 'all_files', allowDownload: true };
  }

  if (!context.hasAudience || !context.isInAudience) {
    return null;
  }

  const usePieceRules =
    pieceAllowsOverride(context.accessPaths) &&
    (context.pieceSettings.fileAccessScope !== null ||
      context.pieceSettings.allowFileDownload !== null);

  const pathRules = context.accessPaths.map((path) =>
    resolveRulesForPath(path, context.pieceSettings, usePieceRules),
  );

  return mergeResolvedAccess(pathRules);
}

export function canSeePiece(context: PieceAccessContext): boolean {
  if (context.isAdmin) {
    return true;
  }
  return context.hasAudience && context.isInAudience;
}

export function filterPieceFilesForAccess(
  files: PieceFileWithLinks[],
  access: ResolvedPieceFileAccess,
  userPartIds: string[],
  isConductor: boolean,
): PieceFileWithLinks[] {
  if (access.scope === 'all_files') {
    return files;
  }

  return files.filter((file) => {
    if (file.kind === 'audio') {
      return false;
    }

    if (isGeneralScoreFile(file)) {
      return isConductor;
    }

    return pieceFileMatchesUserParts(file, userPartIds);
  });
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
