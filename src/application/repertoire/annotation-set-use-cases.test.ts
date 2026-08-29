import { describe, expect, it, vi } from 'vitest';
import type { AnnotationSetRepository } from '@/application/ports/annotation-set-repository';
import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import type { OrganizationRepository } from '@/application/ports/organization-repository';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import { createAnnotationSet } from '@/application/repertoire/annotation-set-use-cases';

describe('createAnnotationSet', () => {
  it('rejects empty audience', async () => {
    const result = await createAnnotationSet(
      { getById: vi.fn() } as unknown as PieceFileRepository,
      { create: vi.fn() } as unknown as AnnotationSetRepository,
      { getByUserAndOrg: vi.fn() } as unknown as MembershipRepository,
      { getByUserId: vi.fn() } as unknown as MusicianRepository,
      { listForMusician: vi.fn(), listForGroups: vi.fn() } as unknown as AssignmentRepository,
      { isPlatformAdmin: vi.fn(async () => false) } as unknown as OrganizationRepository,
      'org-1',
      'piece-1',
      'user-1',
      {
        pieceFileId: 'file-1',
        groupIds: [],
        musicianIds: [],
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('audience_required');
    }
  });
});
