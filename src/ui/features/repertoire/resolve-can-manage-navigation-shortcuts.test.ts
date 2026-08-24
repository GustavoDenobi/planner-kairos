import { describe, expect, it } from 'vitest';

import { resolveCanManageNavigationShortcuts } from './resolve-can-manage-navigation-shortcuts';

describe('resolveCanManageNavigationShortcuts', () => {
  it('allows admins', () => {
    expect(
      resolveCanManageNavigationShortcuts({
        isAdmin: true,
        assignments: [],
        pieceGroupIds: [],
        filePartLinks: [],
        sectionPartIdsBySectionLead: [],
      }),
    ).toBe(true);
  });

  it('allows teachers linked to the piece group', () => {
    expect(
      resolveCanManageNavigationShortcuts({
        isAdmin: false,
        assignments: [
          {
            id: 'a1',
            organizationId: 'org',
            musicianId: 'm1',
            groupId: 'group-1',
            sectionId: null,
            partId: null,
            ensembleRole: 'teacher',
            groupName: 'Turma',
            sectionName: null,
            partName: null,
          },
        ],
        pieceGroupIds: ['group-1'],
        filePartLinks: [],
        sectionPartIdsBySectionLead: [],
      }),
    ).toBe(true);
  });

  it('allows section leads when the file matches their section parts', () => {
    expect(
      resolveCanManageNavigationShortcuts({
        isAdmin: false,
        assignments: [
          {
            id: 'a1',
            organizationId: 'org',
            musicianId: 'm1',
            groupId: 'group-1',
            sectionId: 'section-1',
            partId: null,
            ensembleRole: 'section_lead',
            groupName: 'Orquestra',
            sectionName: 'Cordas',
            partName: null,
          },
        ],
        pieceGroupIds: [],
        filePartLinks: [{ partId: 'violin', partDivisionId: null }],
        sectionPartIdsBySectionLead: ['violin'],
      }),
    ).toBe(true);
  });

  it('denies regular members', () => {
    expect(
      resolveCanManageNavigationShortcuts({
        isAdmin: false,
        assignments: [
          {
            id: 'a1',
            organizationId: 'org',
            musicianId: 'm1',
            groupId: 'group-1',
            sectionId: null,
            partId: 'violin',
            ensembleRole: 'member',
            groupName: 'Orquestra',
            sectionName: null,
            partName: 'Violino',
          },
        ],
        pieceGroupIds: ['group-1'],
        filePartLinks: [{ partId: 'violin', partDivisionId: null }],
        sectionPartIdsBySectionLead: [],
      }),
    ).toBe(false);
  });
});
