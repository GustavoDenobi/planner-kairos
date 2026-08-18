import { describe, expect, it } from 'vitest';
import {
  defaultPieceFileTitle,
  filterScoreCandidatesForUser,
  mimeToPieceFileKind,
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
  isEventSourcedPlaylistExpired,
} from './rules';

describe('normalizePieceAliases', () => {
  it('trims, removes empty entries, and deduplicates case-insensitively', () => {
    expect(
      normalizePieceAliases(['  Solo da guita  ', '', 'solo da guita', 'Quinta música']),
    ).toEqual(['Solo da guita', 'Quinta música']);
  });

  it('limits the number of aliases', () => {
    const many = Array.from({ length: 25 }, (_, index) => `Alias ${index}`);
    expect(normalizePieceAliases(many).length).toBe(20);
  });

  it('returns empty array for undefined input', () => {
    expect(normalizePieceAliases()).toEqual([]);
  });
});

describe('validatePieceInput', () => {
  it('rejects empty title', () => {
    expect(validatePieceInput({ title: '  ', categoryId: 'cat-1' })).toBe('invalid_title');
  });

  it('rejects missing category', () => {
    expect(validatePieceInput({ title: 'Obra', categoryId: '' })).toBe('invalid_category');
  });

  it('accepts valid input', () => {
    expect(validatePieceInput({ title: 'Obra', categoryId: 'cat-1' })).toBeNull();
  });
});

describe('validatePieceCategoryInput', () => {
  it('generates slug from name', () => {
    expect(validatePieceCategoryInput({ name: 'HCA' })).toBeNull();
  });

  it('rejects invalid slug', () => {
    expect(validatePieceCategoryInput({ name: 'X', slug: 'Bad Slug' })).toBe('invalid_slug');
  });
});

describe('validatePieceThemeInput', () => {
  it('accepts accented name with generated slug', () => {
    expect(validatePieceCategoryInput({ name: 'Páscoa' })).toBeNull();
    expect(slugifyName('Páscoa')).toBe('pascoa');
  });

  it('rejects invalid sort order', () => {
    expect(validatePieceThemeInput({ name: 'Natal', sortOrder: -1 })).toBe('invalid_sort_order');
  });
});

describe('mimeToPieceFileKind', () => {
  it('maps pdf to score', () => {
    expect(mimeToPieceFileKind('application/pdf')).toBe('score');
  });

  it('maps audio mimes', () => {
    expect(mimeToPieceFileKind('audio/mpeg')).toBe('audio');
    expect(mimeToPieceFileKind('audio/wav')).toBe('audio');
  });

  it('rejects unknown mime', () => {
    expect(mimeToPieceFileKind('image/png')).toBeNull();
    expect(validatePieceFileMime('image/png')).toBe('invalid_mime_type');
  });
});

describe('validatePieceFilePartLinks', () => {
  const divisionPartIds = new Map([
    ['div-1', 'part-trombone'],
    ['div-2', 'part-trombone'],
  ]);

  it('accepts link without division', () => {
    expect(
      validatePieceFilePartLinks([{ partId: 'part-sax', partDivisionId: null }], divisionPartIds),
    ).toBeNull();
  });

  it('rejects division that does not belong to part', () => {
    expect(
      validatePieceFilePartLinks(
        [{ partId: 'part-sax', partDivisionId: 'div-1' }],
        divisionPartIds,
      ),
    ).toBe('division_part_mismatch');
  });

  it('accepts matching division and part', () => {
    expect(
      validatePieceFilePartLinks(
        [{ partId: 'part-trombone', partDivisionId: 'div-1' }],
        divisionPartIds,
      ),
    ).toBeNull();
  });
});

describe('defaultPieceFileTitle', () => {
  it('removes the last extension', () => {
    expect(defaultPieceFileTitle('partitura.pdf')).toBe('partitura');
    expect(defaultPieceFileTitle('audio.track.mp3')).toBe('audio.track');
  });

  it('keeps names without extension', () => {
    expect(defaultPieceFileTitle('partitura')).toBe('partitura');
  });
});

describe('validatePieceFileTitle', () => {
  it('rejects empty titles', () => {
    expect(validatePieceFileTitle('')).toBe('invalid_file_title');
    expect(validatePieceFileTitle('   ')).toBe('invalid_file_title');
  });

  it('accepts non-empty titles', () => {
    expect(validatePieceFileTitle('Violino 1')).toBeNull();
  });
});

describe('pieceFileMatchesUserParts', () => {
  const saxPartId = 'part-sax';
  const violinPartId = 'part-violin';

  it('returns false when user has no parts', () => {
    expect(
      pieceFileMatchesUserParts(
        { kind: 'score', partLinks: [{ partId: saxPartId, partDivisionId: null }] },
        [],
      ),
    ).toBe(false);
  });

  it('returns false for audio files', () => {
    expect(pieceFileMatchesUserParts({ kind: 'audio', partLinks: [] }, [saxPartId])).toBe(false);
  });

  it('includes general scores without part links', () => {
    expect(pieceFileMatchesUserParts({ kind: 'score', partLinks: [] }, [saxPartId])).toBe(true);
  });

  it('matches when a linked part is assigned to the user', () => {
    expect(
      pieceFileMatchesUserParts(
        { kind: 'score', partLinks: [{ partId: saxPartId, partDivisionId: null }] },
        [saxPartId],
      ),
    ).toBe(true);
  });

  it('does not match when linked parts differ from user assignments', () => {
    expect(
      pieceFileMatchesUserParts(
        { kind: 'score', partLinks: [{ partId: violinPartId, partDivisionId: null }] },
        [saxPartId],
      ),
    ).toBe(false);
  });
});

describe('validateAnnotationLayer', () => {
  it('requires no section for personal layer', () => {
    expect(validateAnnotationLayer('personal', null)).toBeNull();
    expect(validateAnnotationLayer('personal', 'section-1')).toBe(
      'personal_layer_requires_no_section',
    );
  });

  it('requires section for section layer', () => {
    expect(validateAnnotationLayer('section', 'section-1')).toBeNull();
    expect(validateAnnotationLayer('section', null)).toBe('section_layer_requires_section');
  });
});

describe('validateAnnotationGeometry', () => {
  it('validates stroke geometry', () => {
    expect(
      validateAnnotationGeometry('stroke', {
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.3, y: 0.4 },
        ],
        strokeWidth: 0.004,
      }),
    ).toBeNull();
    expect(
      validateAnnotationGeometry('stroke', {
        points: [{ x: 0.1, y: 0.2 }],
        strokeWidth: 0.004,
      }),
    ).toBe('invalid_stroke_points');
  });

  it('validates highlight geometry as freehand stroke', () => {
    expect(
      validateAnnotationGeometry('highlight', {
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.3, y: 0.4 },
        ],
        strokeWidth: 0.028,
      }),
    ).toBeNull();
  });
});

describe('validateCreatePdfAnnotationInput', () => {
  const baseInput = {
    pieceFileId: 'file-1',
    pageNumber: 1,
    layer: 'personal' as const,
    type: 'stroke' as const,
    geometry: {
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.3, y: 0.4 },
      ],
      strokeWidth: 0.004,
    },
    color: '#3b82f6',
    sectionId: null,
  };

  it('accepts valid personal stroke input', () => {
    expect(validateCreatePdfAnnotationInput(baseInput)).toBeNull();
  });

  it('rejects invalid page number', () => {
    expect(validateCreatePdfAnnotationInput({ ...baseInput, pageNumber: 0 })).toBe(
      'invalid_page_number',
    );
  });

  it('requires section for section layer', () => {
    expect(
      validateCreatePdfAnnotationInput({
        ...baseInput,
        layer: 'section',
        sectionId: null,
      }),
    ).toBe('section_layer_requires_section');
  });
});

describe('filterScoreCandidatesForUser', () => {
  const saxPartId = 'part-sax';
  const violinPartId = 'part-violin';

  const saxFile = {
    id: 'file-sax',
    organizationId: 'org',
    pieceId: 'piece-1',
    kind: 'score' as const,
    storageKey: 'k',
    mimeType: 'application/pdf',
    title: 'Sax',
    originalName: 'sax.pdf',
    byteSize: null,
    contentHash: null,
    partLinks: [{ partId: saxPartId, partDivisionId: null }],
  };

  const violinFile = {
    ...saxFile,
    id: 'file-violin',
    title: 'Violin',
    partLinks: [{ partId: violinPartId, partDivisionId: null }],
  };

  const generalFile = {
    ...saxFile,
    id: 'file-general',
    title: 'Geral',
    partLinks: [],
  };

  const audioFile = {
    ...saxFile,
    id: 'file-audio',
    kind: 'audio' as const,
    title: 'Audio',
    partLinks: [],
  };

  it('returns all scores when user has no parts', () => {
    const result = filterScoreCandidatesForUser([saxFile, violinFile, generalFile, audioFile], []);
    expect(result.map((f) => f.id)).toEqual(['file-sax', 'file-violin', 'file-general']);
  });

  it('prioritizes matched parts then general scores', () => {
    const result = filterScoreCandidatesForUser(
      [generalFile, violinFile, saxFile],
      [saxPartId],
    );
    expect(result.map((f) => f.id)).toEqual(['file-sax', 'file-general']);
  });
});

describe('resolveDefaultScoreFile', () => {
  const file = {
    id: 'file-1',
    organizationId: 'org',
    pieceId: 'piece-1',
    kind: 'score' as const,
    storageKey: 'k',
    mimeType: 'application/pdf',
    title: 'Score',
    originalName: 'score.pdf',
    byteSize: null,
    contentHash: null,
    partLinks: [],
  };

  it('returns single candidate', () => {
    expect(resolveDefaultScoreFile([file])).toBe(file);
  });

  it('returns null when ambiguous', () => {
    expect(resolveDefaultScoreFile([file, { ...file, id: 'file-2' }])).toBeNull();
  });
});

describe('validateCreateReadingPlaylistInput', () => {
  it('rejects empty name', () => {
    expect(
      validateCreateReadingPlaylistInput({
        name: '',
        items: [{ pieceFileId: 'file-1' }],
      }),
    ).toBe('invalid_name');
  });

  it('rejects empty items', () => {
    expect(
      validateCreateReadingPlaylistInput({
        name: 'Cantata',
        items: [],
      }),
    ).toBe('empty_playlist');
  });

  it('accepts valid input', () => {
    expect(
      validateCreateReadingPlaylistInput({
        name: 'Cantata Natal',
        items: [{ pieceFileId: 'file-1' }],
      }),
    ).toBeNull();
  });
});

describe('isEventSourcedPlaylistExpired', () => {
  const startsAt = '2026-08-16T13:00:00.000Z';
  const endsAt = '2026-08-16T14:30:00.000Z';

  it('keeps the playlist during the event', () => {
    expect(
      isEventSourcedPlaylistExpired(startsAt, endsAt, new Date('2026-08-16T14:00:00.000Z')),
    ).toBe(false);
  });

  it('keeps the playlist until one day after the event end', () => {
    expect(
      isEventSourcedPlaylistExpired(startsAt, endsAt, new Date('2026-08-17T14:29:59.000Z')),
    ).toBe(false);
  });

  it('archives one day after the event end', () => {
    expect(
      isEventSourcedPlaylistExpired(startsAt, endsAt, new Date('2026-08-17T14:30:00.000Z')),
    ).toBe(true);
  });

  it('uses startsAt when the event has no end', () => {
    expect(
      isEventSourcedPlaylistExpired(startsAt, null, new Date('2026-08-17T13:00:00.000Z')),
    ).toBe(true);
    expect(
      isEventSourcedPlaylistExpired(startsAt, null, new Date('2026-08-17T12:59:59.000Z')),
    ).toBe(false);
  });
});
