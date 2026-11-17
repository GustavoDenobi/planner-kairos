import { describe, expect, it } from 'vitest';
import { normalizeStorageBreakdown } from '@/domain/platform/plan';

describe('normalizeStorageBreakdown', () => {
  it('devolve todas as categorias na ordem fixa, zerando as ausentes', () => {
    const result = normalizeStorageBreakdown([
      { category: 'practice_audio', bytes: 300, fileCount: 3 },
      { category: 'piece_score', bytes: 1000, fileCount: 2 },
    ]);
    expect(result.map((entry) => entry.category)).toEqual([
      'piece_score',
      'piece_audio',
      'practice_audio',
      'branding',
      'other',
    ]);
    expect(result[0]).toEqual({ category: 'piece_score', bytes: 1000, fileCount: 2 });
    expect(result[1]).toEqual({ category: 'piece_audio', bytes: 0, fileCount: 0 });
  });

  it('soma categorias desconhecidas em "other"', () => {
    const result = normalizeStorageBreakdown([
      { category: 'other', bytes: 10, fileCount: 1 },
      { category: 'novo_tipo', bytes: 5, fileCount: 1 },
    ]);
    expect(result.at(-1)).toEqual({ category: 'other', bytes: 15, fileCount: 2 });
  });
});
