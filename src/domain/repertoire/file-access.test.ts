import { describe, expect, it } from 'vitest';
import type { PieceFileWithLinks } from '@/domain/repertoire';
import type { GroupFileAccessSettings } from '@/domain/ensemble';
import {
  buildAccessPathsForUser,
  canSeePiece,
  filterAccessibleAudioFiles,
  filterPieceFilesForAccess,
  mergeResolvedAccess,
  musiciansWithoutPieceAccess,
  musiciansWithoutPieceFileAccess,
  type MusicianFileAccessSubject,
  pieceHasNoAudience,
  resolvePieceAudioAccess,
  resolvePieceFileAccess,
  resolveRulesForPath,
  type PieceAccessContext,
} from '@/domain/repertoire/file-access';

const ownPartsGroup: GroupFileAccessSettings = {
  fileAccessScope: 'own_parts',
  allowFileDownload: false,
  audioAccessScope: 'own_parts',
  audioAllowDownload: false,
  allowPieceAccessOverride: true,
};

const allFilesGroup: GroupFileAccessSettings = {
  fileAccessScope: 'all_files',
  allowFileDownload: true,
  audioAccessScope: 'all_files',
  audioAllowDownload: true,
  allowPieceAccessOverride: false,
};

function baseContext(overrides: Partial<PieceAccessContext> = {}): PieceAccessContext {
  return {
    isAdmin: false,
    userPartIds: ['part-sax'],
    isGroupWriter: false,
    hasAudience: true,
    isInAudience: true,
    piecePartLinks: [],
    pieceSettings: {
      fileAccessScope: null,
      allowFileDownload: null,
      audioAccessScope: null,
      audioAllowDownload: null,
    },
    accessPaths: [{ kind: 'group', groupId: 'g1', groupSettings: ownPartsGroup }],
    ...overrides,
  };
}

describe('resolveRulesForPath', () => {
  it('uses piece override when enabled for scores', () => {
    const result = resolveRulesForPath(
      { kind: 'group', groupId: 'g1', groupSettings: ownPartsGroup },
      {
        fileAccessScope: 'all_files',
        allowFileDownload: null,
        audioAccessScope: null,
        audioAllowDownload: null,
      },
      true,
      'score',
    );
    expect(result).toEqual({ scope: 'all_files', allowDownload: false });
  });

  it('uses independent audio override when enabled', () => {
    const result = resolveRulesForPath(
      { kind: 'group', groupId: 'g1', groupSettings: ownPartsGroup },
      {
        fileAccessScope: null,
        allowFileDownload: null,
        audioAccessScope: 'all_files',
        audioAllowDownload: true,
      },
      true,
      'audio',
    );
    expect(result).toEqual({ scope: 'all_files', allowDownload: true });
  });

  it('uses group rules when override disabled', () => {
    const result = resolveRulesForPath(
      { kind: 'group', groupId: 'g1', groupSettings: ownPartsGroup },
      {
        fileAccessScope: 'all_files',
        allowFileDownload: true,
        audioAccessScope: 'all_files',
        audioAllowDownload: true,
      },
      false,
      'score',
    );
    expect(result).toEqual({ scope: 'own_parts', allowDownload: false });
  });

  it('defaults direct musician access', () => {
    const result = resolveRulesForPath(
      { kind: 'musician' },
      {
        fileAccessScope: null,
        allowFileDownload: null,
        audioAccessScope: null,
        audioAllowDownload: null,
      },
      false,
      'score',
    );
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

describe('resolvePieceAudioAccess', () => {
  it('can resolve stricter audio access than scores', () => {
    const audioStrictGroup: GroupFileAccessSettings = {
      fileAccessScope: 'all_files',
      allowFileDownload: true,
      audioAccessScope: 'own_parts',
      audioAllowDownload: false,
      allowPieceAccessOverride: false,
    };

    const access = resolvePieceAudioAccess(
      baseContext({
        accessPaths: [{ kind: 'group', groupId: 'g1', groupSettings: audioStrictGroup }],
      }),
    );

    expect(access).toEqual({ scope: 'own_parts', allowDownload: false });
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
    sortOrder: 0,
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
    partLinks: [{ partId: 'part-sax', partDivisionId: null }],
  };

  it('returns all score files for all_files scope', () => {
    expect(
      filterPieceFilesForAccess(
        [saxFile, fluteFile, audioFile],
        { scope: 'all_files', allowDownload: true },
        ['part-sax'],
        false,
      ),
    ).toEqual([saxFile, fluteFile]);
  });

  it('filters scores to own parts under own_parts', () => {
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

describe('filterAccessibleAudioFiles', () => {
  const audioFile: PieceFileWithLinks = {
    id: 'f3',
    organizationId: 'org',
    pieceId: 'piece',
    kind: 'audio',
    storageKey: 'k',
    mimeType: 'audio/mpeg',
    title: 'Audio',
    sortOrder: 0,
    originalName: 'audio.mp3',
    byteSize: 1,
    contentHash: null,
    partLinks: [{ partId: 'part-sax', partDivisionId: null }],
  };

  const generalAudio: PieceFileWithLinks = {
    ...audioFile,
    id: 'f4',
    title: 'General audio',
    partLinks: [],
  };

  it('returns all audios for all_files scope', () => {
    expect(
      filterAccessibleAudioFiles(
        [audioFile, generalAudio],
        { scope: 'all_files', allowDownload: true },
        ['part-sax'],
        false,
      ),
    ).toHaveLength(2);
  });

  it('filters audios by part and hides general audio for non-conductors', () => {
    expect(
      filterAccessibleAudioFiles(
        [audioFile, generalAudio],
        { scope: 'own_parts', allowDownload: true },
        ['part-sax'],
        false,
      ),
    ).toEqual([audioFile]);
  });

  it('allows general audio for conductors', () => {
    expect(
      filterAccessibleAudioFiles(
        [audioFile, generalAudio],
        { scope: 'own_parts', allowDownload: true },
        ['part-sax'],
        true,
      ),
    ).toEqual([audioFile, generalAudio]);
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

describe('musiciansWithoutPieceFileAccess', () => {
  const pieceSettings = {
    fileAccessScope: null,
    allowFileDownload: null,
    audioAccessScope: null,
    audioAllowDownload: null,
  };

  const generalScore: PieceFileWithLinks = {
    id: 'general',
    organizationId: 'org',
    pieceId: 'piece',
    kind: 'score',
    storageKey: 'k',
    mimeType: 'application/pdf',
    title: 'Geral',
    sortOrder: 0,
    originalName: 'geral.pdf',
    byteSize: 1,
    contentHash: null,
    partLinks: [],
  };

  const violaScore: PieceFileWithLinks = {
    ...generalScore,
    id: 'viola',
    title: 'Viola',
    partLinks: [{ partId: 'part-viola', partDivisionId: null }],
  };

  const member: MusicianFileAccessSubject = {
    musicianId: 'gesi',
    musicianName: 'Gesi Telma',
    assignments: [
      { groupId: 'alunos', ensembleRole: 'member', partId: 'part-viola' },
    ],
  };

  function blockedNames(
    file: PieceFileWithLinks,
    musicians: MusicianFileAccessSubject[],
    groups: Map<string, GroupFileAccessSettings> = new Map([['alunos', ownPartsGroup]]),
  ) {
    return musiciansWithoutPieceFileAccess({
      file,
      pieceGroupIds: ['alunos'],
      pieceMusicianIds: [],
      pieceSettings,
      groupSettingsById: groups,
      musicians,
    }).map((musician) => musician.musicianName);
  }

  it('lists a member who cannot open a general score under own parts', () => {
    expect(blockedNames(generalScore, [member])).toEqual(['Gesi Telma']);
  });

  it('opens a general score when the piece itself is linked to the member part', () => {
    expect(
      musiciansWithoutPieceFileAccess({
        file: generalScore,
        pieceGroupIds: ['alunos'],
        pieceMusicianIds: [],
        pieceSettings,
        piecePartLinks: [{ partId: 'part-viola', partDivisionId: null }],
        groupSettingsById: new Map([['alunos', ownPartsGroup]]),
        musicians: [member],
      }),
    ).toEqual([]);
  });

  it('lets a teacher of a linked group open a method restricted to another part', () => {
    expect(
      musiciansWithoutPieceFileAccess({
        file: generalScore,
        pieceGroupIds: ['alunos'],
        pieceMusicianIds: [],
        pieceSettings,
        piecePartLinks: [{ partId: 'part-violin', partDivisionId: null }],
        groupSettingsById: new Map([['alunos', ownPartsGroup]]),
        musicians: [
          {
            ...member,
            assignments: [{ groupId: 'alunos', ensembleRole: 'teacher', partId: null }],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('omits the conductor of a linked group', () => {
    expect(
      blockedNames(generalScore, [
        {
          ...member,
          assignments: [{ groupId: 'alunos', ensembleRole: 'conductor', partId: null }],
        },
      ]),
    ).toEqual([]);
  });

  it('omits a member whose part matches the score, even from another group', () => {
    expect(
      blockedNames(violaScore, [
        {
          ...member,
          assignments: [
            { groupId: 'alunos', ensembleRole: 'member', partId: null },
            { groupId: 'kairos', ensembleRole: 'section_lead', partId: 'part-viola' },
          ],
        },
      ]),
    ).toEqual([]);
  });

  it('lists a member assigned to a different part', () => {
    expect(
      blockedNames(violaScore, [
        {
          ...member,
          musicianName: 'Luiz',
          assignments: [{ groupId: 'alunos', ensembleRole: 'member', partId: 'part-violin' }],
        },
      ]),
    ).toEqual(['Luiz']);
  });

  it('omits everyone when the group allows all files', () => {
    expect(
      blockedNames(generalScore, [member], new Map([['alunos', allFilesGroup]])),
    ).toEqual([]);
  });

  it('lists a musician outside the piece audience', () => {
    expect(
      blockedNames(violaScore, [
        {
          ...member,
          assignments: [{ groupId: 'vocal', ensembleRole: 'member', partId: 'part-viola' }],
        },
      ]),
    ).toEqual(['Gesi Telma']);
  });
});

describe('canSeePiece', () => {
  it('hides a restricted piece from a musician on another part', () => {
    expect(
      canSeePiece(
        baseContext({
          userPartIds: ['part-cello'],
          piecePartLinks: [{ partId: 'part-violin', partDivisionId: null }],
        }),
      ),
    ).toBe(false);
  });

  it('shows a restricted piece when the assignment matches', () => {
    expect(
      canSeePiece(
        baseContext({
          userPartIds: ['part-violin'],
          piecePartLinks: [{ partId: 'part-violin', partDivisionId: null }],
        }),
      ),
    ).toBe(true);
  });

  it('shows a restricted piece to a teacher or conductor of a linked group', () => {
    expect(
      canSeePiece(
        baseContext({
          userPartIds: [],
          isGroupWriter: true,
          piecePartLinks: [{ partId: 'part-violin', partDivisionId: null }],
        }),
      ),
    ).toBe(true);
  });

  it('keeps unrestricted pieces visible to the audience', () => {
    expect(canSeePiece(baseContext({ userPartIds: [] }))).toBe(true);
  });
});

describe('filterPieceFilesForAccess piece inheritance', () => {
  const lesson: PieceFileWithLinks = {
    id: 'lesson',
    organizationId: 'org',
    pieceId: 'piece',
    kind: 'score',
    storageKey: 'k',
    mimeType: 'application/pdf',
    title: 'Lição 1',
    sortOrder: 0,
    originalName: 'licao.pdf',
    byteSize: 1,
    contentHash: null,
    partLinks: [],
  };

  const violinLinks = [{ partId: 'part-violin', partDivisionId: null }];

  it('opens lesson files for the part linked on the piece', () => {
    expect(
      filterPieceFilesForAccess(
        [lesson],
        { scope: 'own_parts', allowDownload: true },
        ['part-violin'],
        false,
        violinLinks,
      ),
    ).toEqual([lesson]);
  });

  it('hides lesson files from other parts', () => {
    expect(
      filterPieceFilesForAccess(
        [lesson],
        { scope: 'own_parts', allowDownload: true },
        ['part-cello'],
        false,
        violinLinks,
      ),
    ).toEqual([]);
  });
});

describe('musiciansWithoutPieceAccess', () => {
  const pieceSettings = {
    fileAccessScope: null,
    allowFileDownload: null,
    audioAccessScope: null,
    audioAllowDownload: null,
  };

  const lesson: PieceFileWithLinks = {
    id: 'lesson',
    organizationId: 'org',
    pieceId: 'piece',
    kind: 'score',
    storageKey: 'k',
    mimeType: 'application/pdf',
    title: 'Lição 1',
    sortOrder: 0,
    originalName: 'licao.pdf',
    byteSize: 1,
    contentHash: null,
    partLinks: [],
  };

  const violinist: MusicianFileAccessSubject = {
    musicianId: 'ana',
    musicianName: 'Ana',
    assignments: [{ groupId: 'alunos', ensembleRole: 'member', partId: 'part-violin' }],
  };

  const cellist: MusicianFileAccessSubject = {
    musicianId: 'bia',
    musicianName: 'Bia',
    assignments: [{ groupId: 'alunos', ensembleRole: 'member', partId: 'part-cello' }],
  };

  it('lists event musicians whose part does not match the piece', () => {
    expect(
      musiciansWithoutPieceAccess({
        pieceGroupIds: ['alunos'],
        pieceMusicianIds: [],
        piecePartLinks: [{ partId: 'part-violin', partDivisionId: null }],
        pieceSettings,
        groupSettingsById: new Map([['alunos', ownPartsGroup]]),
        files: [lesson],
        unitFileIds: [],
        musicians: [violinist, cellist],
      }).map((musician) => musician.musicianName),
    ).toEqual(['Bia']);
  });

  it('lists a matching musician who cannot open the programmed file', () => {
    const celloScore: PieceFileWithLinks = {
      ...lesson,
      id: 'cello',
      title: 'Cello',
      partLinks: [{ partId: 'part-cello', partDivisionId: null }],
    };

    expect(
      musiciansWithoutPieceAccess({
        pieceGroupIds: ['alunos'],
        pieceMusicianIds: [],
        piecePartLinks: [{ partId: 'part-violin', partDivisionId: null }],
        pieceSettings,
        groupSettingsById: new Map([['alunos', ownPartsGroup]]),
        files: [lesson, celloScore],
        unitFileIds: ['cello'],
        musicians: [violinist],
      }).map((musician) => musician.musicianName),
    ).toEqual(['Ana']);
  });
});

describe('pieceHasNoAudience', () => {
  it('detects empty audience', () => {
    expect(pieceHasNoAudience([], [])).toBe(true);
    expect(pieceHasNoAudience(['g1'], [])).toBe(false);
  });
});
