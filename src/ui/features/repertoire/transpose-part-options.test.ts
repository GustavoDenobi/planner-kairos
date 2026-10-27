import { describe, expect, it } from 'vitest';
import { inferDefaultTunerTransposeFromFilePartLinks } from '@/ui/features/repertoire/transpose-part-options';

const options = [
  { id: 'sax', name: 'Sax Alto', defaultTransposeSemitones: 3 },
  { id: 'violin', name: 'Violino', defaultTransposeSemitones: 0 },
];

describe('inferDefaultTunerTransposeFromFilePartLinks', () => {
  it('returns preset when file links to one transposing part', () => {
    expect(
      inferDefaultTunerTransposeFromFilePartLinks(
        [{ partId: 'sax', partDivisionId: null }],
        options,
      ),
    ).toEqual({ partId: 'sax', semitones: 3 });
  });

  it('returns null for concert pitch part', () => {
    expect(
      inferDefaultTunerTransposeFromFilePartLinks(
        [{ partId: 'violin', partDivisionId: null }],
        options,
      ),
    ).toBeNull();
  });

  it('returns null when multiple parts are linked', () => {
    expect(
      inferDefaultTunerTransposeFromFilePartLinks(
        [
          { partId: 'sax', partDivisionId: null },
          { partId: 'violin', partDivisionId: null },
        ],
        options,
      ),
    ).toBeNull();
  });

  it('returns null without links', () => {
    expect(inferDefaultTunerTransposeFromFilePartLinks([], options)).toBeNull();
  });
});
