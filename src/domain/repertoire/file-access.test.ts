import { describe, expect, it } from 'vitest';
import type { PieceFileWithLinks } from '@/domain/repertoire';
import type { GroupFileAccessSettings } from '@/domain/ensemble';
import {
  buildAccessPathsForUser,
  filterPieceFilesForAccess,
  mergeResolvedAccess,
  pieceHasNoAudience,
  resolvePieceFileAccess,
  resolveRulesForPath,
  type PieceAccessContext,
} from '@/domain/repertoire/file-access';

const ownPartsGroup: GroupFileAccessSettings = {
  fileAccessScope: 'own_parts',
  allowFileDownload: false,
  allowPieceAccessOverride: true,
};

const allFilesGroup: GroupFileAccessSettings = {
  fileAccessScope: 'all_files',
  allowFileDownload: true,
  allowPieceAccessOverride: false,
};

function baseContext(overrides: Partial<PieceAccessContext> = {}): PieceAccessContext {
  return {
    isAdmin: false,
    userPartIds: ['part-sax'],
    isConductor: false,
    hasAudience: true,
    isInAudience: true,
    pieceSettings: { fileAccessScope: null, allowFileDownload: null },
    accessPaths: [{ kind: 'group', groupId: 'g1', groupSettings: ownPartsGroup }],
    ...overrides,
  };
}

describe('resolveRulesForPath', () => {
  it('uses piece override when enabled', () => {
    const result = resolveRulesForPath(
      { kind: 'group', groupId: 'g1', groupSettings: ownPartsGroup },
      { fileAccessScope: 'all_files', allowFileDownload: null },
      true,
    );
    expect(result).toEqual({ scope: 'all_files', allowDownload: false });
  });

  it('uses group rules when override disabled', () => {
    const result = resolveRulesForPath(
      { kind: 'group', groupId: 'g1', groupSettings: ownPartsGroup },
      { fileAccessScope: 'all_files', allowFileDownload: true },
      false,
    );
    expect(result).toEqual({ scope: 'own_parts', allowDownload: false });
  });

  it('defaults direct musician access', () => {
    const result = resolveRulesForPath({ kind: 'musician' }, { fileAccessScope: null, allowFileDownload: null }, false);
    expect(result).toEqual({ scope: 'own_parts', allowDownload: true });
  });
});

describe('mergeResolvedAccess', () => {
  it('picks most permissive scope and download', () => {
    expect(
      mergeResolvedAccess([
        { scope: 'own_parts', allowDownload: false },
        { scope: 'all_files', allowDownload: false },
        { scope: 'own_parts', allowDownload: true },
      ]),
    ).toEqual({ scope: 'all_files', allowDownload: true });
  });
});

describe('resolvePieceFileAccess', () => {
  it('returns null when piece has no audience for member', () => {
    expect(
      resolvePieceFileAccess(
        baseContext({ hasAudience: false, isInAudience: false, accessPaths: [] }),
      ),
    ).toBeNull();
  });

  it('returns full access for admin', () => {
    expect(resolvePieceFileAccess(baseContext({ isAdmin: true }))).toEqual({
      scope: 'all_files',
      allowDownload: true,
    });
  });

  it('merges multiple group paths permissively', () => {
    const access = resolvePieceFileAccess(
      baseContext({
        accessPaths: [
          { kind: 'group', groupId: 'g1', groupSettings: ownPartsGroup },
          { kind: 'group', groupId: 'g2', groupSettings: allFilesGroup },
        ],
      }),
    );
    expect(access).toEqual({ scope: 'all_files', allowDownload: true });
  });
});

describe('filterPieceFilesForAccess', () => {
  const saxFile: PieceFileWithLinks = {
    id: 'f1',
    organizationId: 'org',
    pieceId: 'piece',
    kind: 'score',
    storageKey: 'k',
    mimeType: 'application/pdf',
    title: 'Sax',
    originalName: 'sax.pdf',
    byteSize: 1,
    contentHash: null,
    partLinks: [{ partId: 'part-sax', partDivisionId: null }],
  };

  const fluteFile: PieceFileWithLinks = {
    ...saxFile,
    id: 'f2',
    title: 'Flute',
    partLinks: [{ partId: 'part-flute', partDivisionId: null }],
  };

  const audioFile: PieceFileWithLinks = {
    ...saxFile,
    id: 'f3',
    kind: 'audio',
    mimeType: 'audio/mpeg',
    partLinks: [],
  };

  it('returns all files for all_files scope', () => {
    expect(
      filterPieceFilesForAccess(
        [saxFile, fluteFile, audioFile],
        { scope: 'all_files', allowDownload: true },
        ['part-sax'],
        false,
      ),
    ).toHaveLength(3);
  });

  it('filters to own parts and hides audio under own_parts', () => {
    expect(
      filterPieceFilesForAccess(
        [saxFile, fluteFile, audioFile],
        { scope: 'own_parts', allowDownload: true },
        ['part-sax'],
        false,
      ),
    ).toEqual([saxFile]);
  });
});

describe('buildAccessPathsForUser', () => {
  it('includes linked groups and direct musician link', () => {
    const paths = buildAccessPathsForUser({
      linkedGroupIds: ['g1'],
      linkedMusicianIds: ['m1'],
      userMusicianId: 'm1',
      userGroupIds: ['g1'],
      groupSettingsById: new Map([['g1', ownPartsGroup]]),
    });

    expect(paths).toHaveLength(2);
  });
});

describe('pieceHasNoAudience', () => {
  it('detects empty audience', () => {
    expect(pieceHasNoAudience([], [])).toBe(true);
    expect(pieceHasNoAudience(['g1'], [])).toBe(false);
  });
});
