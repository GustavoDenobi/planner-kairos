import {
  isGroupWriterRole,
  type EnsembleRole,
  type GroupFileAccessSettings,
} from '@/domain/ensemble';
import type {
  PieceFileAccessScope,
  PieceFileKind,
  PieceFilePartLink,
  PieceFileWithLinks,
} from '@/domain/repertoire';
import {
  isGeneralPieceFile,
  pieceFileMatchesUserParts,
  pieceMatchesUserParts,
  pieceRestrictsByPart,
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
  isGroupWriter: boolean;
  hasAudience: boolean;
  isInAudience: boolean;
  pieceSettings: PieceFileAccessSettings;
  piecePartLinks: PieceFilePartLink[];
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

  if (!canSeePiece(context)) {
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
  if (!context.hasAudience || !context.isInAudience) {
    return false;
  }
  if (!pieceRestrictsByPart(context.piecePartLinks)) {
    return true;
  }
  if (context.isGroupWriter) {
    return true;
  }
  return pieceMatchesUserParts(context.piecePartLinks, context.userPartIds);
}

function fileWithoutLinksIsVisible(
  userPartIds: string[],
  isGroupWriter: boolean,
  piecePartLinks: PieceFilePartLink[],
): boolean {
  if (isGroupWriter) {
    return true;
  }
  if (pieceRestrictsByPart(piecePartLinks)) {
    return pieceMatchesUserParts(piecePartLinks, userPartIds);
  }
  return false;
}

export function filterPieceFilesForKindAccess(
  files: PieceFileWithLinks[],
  access: ResolvedPieceFileAccess,
  userPartIds: string[],
  isGroupWriter: boolean,
  kind: PieceFileKind,
  piecePartLinks: PieceFilePartLink[] = [],
): PieceFileWithLinks[] {
  const ofKind = files.filter((file) => file.kind === kind);

  if (access.scope === 'all_files') {
    return ofKind;
  }

  return ofKind.filter((file) => {
    if (isGeneralPieceFile(file)) {
      return fileWithoutLinksIsVisible(userPartIds, isGroupWriter, piecePartLinks);
    }

    return pieceFileMatchesUserParts(file, userPartIds);
  });
}

export function filterPieceFilesForAccess(
  files: PieceFileWithLinks[],
  access: ResolvedPieceFileAccess,
  userPartIds: string[],
  isGroupWriter: boolean,
  piecePartLinks: PieceFilePartLink[] = [],
): PieceFileWithLinks[] {
  return filterPieceFilesForKindAccess(
    files,
    access,
    userPartIds,
    isGroupWriter,
    'score',
    piecePartLinks,
  );
}

export function filterAccessibleAudioFiles(
  files: PieceFileWithLinks[],
  audioAccess: ResolvedPieceFileAccess,
  userPartIds: string[],
  isGroupWriter: boolean,
  piecePartLinks: PieceFilePartLink[] = [],
): PieceFileWithLinks[] {
  return filterPieceFilesForKindAccess(
    files,
    audioAccess,
    userPartIds,
    isGroupWriter,
    'audio',
    piecePartLinks,
  );
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

export function isUserGroupWriterInLinkedGroups(
  linkedGroupIds: string[],
  assignments: Array<{ groupId: string; ensembleRole: EnsembleRole }>,
): boolean {
  const linked = new Set(linkedGroupIds);
  return assignments.some(
    (assignment) => linked.has(assignment.groupId) && isGroupWriterRole(assignment.ensembleRole),
  );
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

export type MusicianFileAccessAssignment = {
  groupId: string;
  ensembleRole: EnsembleRole;
  partId: string | null;
};

export type MusicianFileAccessSubject = {
  musicianId: string;
  musicianName: string;
  assignments: MusicianFileAccessAssignment[];
};

/**
 * Músicos que não abrem este arquivo de partitura, com a mesma regra de
 * `can_access_piece_file`: audiência da obra, escopo do grupo e parte.
 */
export function musiciansWithoutPieceFileAccess(input: {
  file: PieceFileWithLinks;
  pieceGroupIds: string[];
  pieceMusicianIds: string[];
  pieceSettings: PieceFileAccessSettings;
  groupSettingsById: Map<string, GroupFileAccessSettings>;
  musicians: MusicianFileAccessSubject[];
  piecePartLinks?: PieceFilePartLink[];
}): Array<{ musicianId: string; musicianName: string }> {
  if (input.file.kind !== 'score') {
    return [];
  }

  const blocked: Array<{ musicianId: string; musicianName: string }> = [];
  const seen = new Set<string>();

  for (const musician of input.musicians) {
    if (seen.has(musician.musicianId)) {
      continue;
    }
    seen.add(musician.musicianId);
    if (
      !musicianCanAccessPieceFile(musician, {
        ...input,
        piecePartLinks: input.piecePartLinks ?? [],
      })
    ) {
      blocked.push({
        musicianId: musician.musicianId,
        musicianName: musician.musicianName,
      });
    }
  }

  return blocked.sort((left, right) =>
    left.musicianName.localeCompare(right.musicianName, 'pt-BR', { sensitivity: 'base' }),
  );
}

function buildMusicianPieceAccessContext(
  musician: MusicianFileAccessSubject,
  input: {
    pieceGroupIds: string[];
    pieceMusicianIds: string[];
    pieceSettings: PieceFileAccessSettings;
    groupSettingsById: Map<string, GroupFileAccessSettings>;
    piecePartLinks: PieceFilePartLink[];
  },
): PieceAccessContext {
  const userGroupIds = musician.assignments.map((assignment) => assignment.groupId);
  const userPartIds = musician.assignments
    .map((assignment) => assignment.partId)
    .filter((partId): partId is string => Boolean(partId));
  const pieceGroups = new Set(input.pieceGroupIds);

  return {
    isAdmin: false,
    userPartIds,
    isGroupWriter: isUserGroupWriterInLinkedGroups(input.pieceGroupIds, musician.assignments),
    hasAudience: !pieceHasNoAudience(input.pieceGroupIds, input.pieceMusicianIds),
    isInAudience:
      input.pieceMusicianIds.includes(musician.musicianId) ||
      userGroupIds.some((groupId) => pieceGroups.has(groupId)),
    pieceSettings: input.pieceSettings,
    piecePartLinks: input.piecePartLinks,
    accessPaths: buildAccessPathsForUser({
      linkedGroupIds: input.pieceGroupIds,
      linkedMusicianIds: input.pieceMusicianIds,
      userMusicianId: musician.musicianId,
      userGroupIds,
      groupSettingsById: input.groupSettingsById,
    }),
  };
}

function musicianCanAccessPieceFile(
  musician: MusicianFileAccessSubject,
  input: {
    file: PieceFileWithLinks;
    pieceGroupIds: string[];
    pieceMusicianIds: string[];
    pieceSettings: PieceFileAccessSettings;
    groupSettingsById: Map<string, GroupFileAccessSettings>;
    piecePartLinks: PieceFilePartLink[];
  },
): boolean {
  const context = buildMusicianPieceAccessContext(musician, input);
  const access = resolvePieceFileAccess(context);

  if (!access) {
    return false;
  }

  return (
    filterPieceFilesForAccess(
      [input.file],
      access,
      context.userPartIds,
      context.isGroupWriter,
      input.piecePartLinks,
    ).length > 0
  );
}

export function musiciansWithoutPieceAccess(input: {
  pieceGroupIds: string[];
  pieceMusicianIds: string[];
  piecePartLinks: PieceFilePartLink[];
  pieceSettings: PieceFileAccessSettings;
  groupSettingsById: Map<string, GroupFileAccessSettings>;
  files: PieceFileWithLinks[];
  unitFileIds: string[];
  musicians: MusicianFileAccessSubject[];
}): Array<{ musicianId: string; musicianName: string }> {
  const blocked: Array<{ musicianId: string; musicianName: string }> = [];
  const seen = new Set<string>();
  const unitFiles = input.unitFileIds.map((fileId) =>
    input.files.find((file) => file.id === fileId),
  );

  for (const musician of input.musicians) {
    if (seen.has(musician.musicianId)) {
      continue;
    }
    seen.add(musician.musicianId);

    const context = buildMusicianPieceAccessContext(musician, {
      pieceGroupIds: input.pieceGroupIds,
      pieceMusicianIds: input.pieceMusicianIds,
      pieceSettings: input.pieceSettings,
      groupSettingsById: input.groupSettingsById,
      piecePartLinks: input.piecePartLinks,
    });

    if (!canSeePiece(context)) {
      blocked.push({
        musicianId: musician.musicianId,
        musicianName: musician.musicianName,
      });
      continue;
    }

    if (input.unitFileIds.length === 0) {
      continue;
    }

    const access = resolvePieceFileAccess(context);
    const missingUnit = unitFiles.some((file) => !file);
    const blockedByUnit =
      !access ||
      missingUnit ||
      unitFiles.some((file) => {
        if (!file || !access) {
          return true;
        }
        return (
          filterPieceFilesForKindAccess(
            [file],
            access,
            context.userPartIds,
            context.isGroupWriter,
            file.kind,
            input.piecePartLinks,
          ).length === 0
        );
      });

    if (blockedByUnit) {
      blocked.push({
        musicianId: musician.musicianId,
        musicianName: musician.musicianName,
      });
    }
  }

  return blocked.sort((left, right) =>
    left.musicianName.localeCompare(right.musicianName, 'pt-BR', { sensitivity: 'base' }),
  );
}
