import { describe, expect, it, vi } from 'vitest';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import { createMusician, mergeMusicians } from './musician-use-cases';

function createRepo(overrides: Partial<MusicianRepository> = {}): MusicianRepository {
  return {
    listForOrg: vi.fn(),
    listNamesForOrg: vi.fn(),
    getById: vi.fn(),
    getByUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    merge: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  };
}

describe('createMusician', () => {
  it('creates musician with normalized contact fields', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'musician-1',
      organizationId: 'org-1',
      fullName: 'João Silva',
      birthDate: null,
      phone: '11987654321',
      email: 'joao@example.com',
      userId: null,
      notes: null,
    });
    const repo = createRepo({ create });

    const result = await createMusician(repo, 'org-1', {
      fullName: '  João Silva  ',
      phone: '(11) 98765-4321',
      email: ' Joao@Example.com ',
    });

    expect(result.ok).toBe(true);
    expect(create).toHaveBeenCalledWith('org-1', {
      fullName: 'João Silva',
      phone: '11987654321',
      email: 'joao@example.com',
    });
  });

  it('returns validation error for blank name', async () => {
    const repo = createRepo();

    const result = await createMusician(repo, 'org-1', { fullName: '   ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('invalid_name');
    }
  });
});

describe('mergeMusicians', () => {
  it('merges musicians through repository', async () => {
    const merge = vi.fn().mockResolvedValue(undefined);
    const repo = createRepo({ merge });

    const result = await mergeMusicians(repo, 'org-1', 'source-id', 'target-id');

    expect(result.ok).toBe(true);
    expect(merge).toHaveBeenCalledWith('org-1', 'source-id', 'target-id');
  });

  it('rejects merging musician with itself', async () => {
    const repo = createRepo();

    const result = await mergeMusicians(repo, 'org-1', 'same-id', 'same-id');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('same_musician');
    }
  });
});
