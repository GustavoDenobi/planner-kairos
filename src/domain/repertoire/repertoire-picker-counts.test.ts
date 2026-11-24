import { describe, expect, it } from 'vitest';
import { REPERTOIRE_UNLINKED_FILTER } from './repertoire-filters';
import {
  countPiecesByCategory,
  countPiecesByGroup,
  filterMembershipsByGroupScope,
  resolveRepertoireCategoryChoices,
  resolveRepertoireGroupChoices,
  type RepertoirePieceMembership,
} from './repertoire-picker-counts';

const memberships: RepertoirePieceMembership[] = [
  { pieceId: 'p1', categoryId: 'hinos', groupIds: ['coral', 'kairos'] },
  { pieceId: 'p2', categoryId: 'hinos', groupIds: ['coral'] },
  { pieceId: 'p3', categoryId: 'eruditas', groupIds: ['kairos'] },
  { pieceId: 'p4', categoryId: 'eruditas', groupIds: [] },
];

describe('countPiecesByGroup', () => {
  it('conta cada obra uma vez no total, mesmo vinculada a vários grupos', () => {
    const counts = countPiecesByGroup(memberships);
    expect(counts.total).toBe(4);
    expect(counts.unlinked).toBe(1);
    expect(counts.byGroup.get('coral')).toBe(2);
    expect(counts.byGroup.get('kairos')).toBe(2);
    expect(counts.byGroup.get('vocal')).toBeUndefined();
  });

  it('ignora grupo repetido na mesma obra', () => {
    const counts = countPiecesByGroup([
      { pieceId: 'p1', categoryId: 'hinos', groupIds: ['coral', 'coral'] },
    ]);
    expect(counts.byGroup.get('coral')).toBe(1);
  });
});

describe('filterMembershipsByGroupScope', () => {
  it('escopo vazio devolve todas as obras visíveis', () => {
    expect(filterMembershipsByGroupScope(memberships, '')).toHaveLength(4);
  });

  it('escopo sem vínculo devolve só obras sem grupo', () => {
    expect(
      filterMembershipsByGroupScope(memberships, REPERTOIRE_UNLINKED_FILTER).map((m) => m.pieceId),
    ).toEqual(['p4']);
  });

  it('escopo de grupo devolve só obras daquele grupo', () => {
    expect(filterMembershipsByGroupScope(memberships, 'kairos').map((m) => m.pieceId)).toEqual([
      'p1',
      'p3',
    ]);
  });
});

describe('countPiecesByCategory', () => {
  it('conta obras por categoria dentro do escopo', () => {
    const counts = countPiecesByCategory(filterMembershipsByGroupScope(memberships, 'coral'));
    expect(counts.get('hinos')).toBe(2);
    expect(counts.get('eruditas')).toBeUndefined();
  });
});

describe('resolveRepertoireGroupChoices', () => {
  it('ignora grupos sem obras e conta "sem vínculo" só quando permitido e com obras', () => {
    const choices = resolveRepertoireGroupChoices(memberships, ['coral', 'vocal', 'kairos'], true);
    expect(choices.visibleGroupIds).toEqual(['coral', 'kairos']);
    expect(choices.showUnlinked).toBe(true);
    expect(choices.choiceCount).toBe(3);

    const withoutUnlinked = resolveRepertoireGroupChoices(memberships, ['coral'], false);
    expect(withoutUnlinked.showUnlinked).toBe(false);
    expect(withoutUnlinked.choiceCount).toBe(1);
  });
});

describe('resolveRepertoireCategoryChoices', () => {
  it('dentro de um grupo mostra só as categorias com obras e nunca "sem vínculo"', () => {
    const choices = resolveRepertoireCategoryChoices(
      memberships,
      ['hinos', 'eruditas', 'cantatas'],
      'coral',
      true,
    );
    expect(choices.scopedTotal).toBe(2);
    expect(choices.visibleCategoryIds).toEqual(['hinos']);
    expect(choices.showUnlinked).toBe(false);
    expect(choices.choiceCount).toBe(1);
  });

  it('em todos os grupos oferece "sem vínculo" quando há obras sem grupo', () => {
    const choices = resolveRepertoireCategoryChoices(memberships, ['hinos', 'eruditas'], '', true);
    expect(choices.visibleCategoryIds).toEqual(['hinos', 'eruditas']);
    expect(choices.unlinkedCount).toBe(1);
    expect(choices.showUnlinked).toBe(true);
    expect(choices.choiceCount).toBe(3);
  });

  it('no escopo "sem vínculo" não repete a opção "sem vínculo"', () => {
    const choices = resolveRepertoireCategoryChoices(
      memberships,
      ['hinos', 'eruditas'],
      REPERTOIRE_UNLINKED_FILTER,
      true,
    );
    expect(choices.visibleCategoryIds).toEqual(['eruditas']);
    expect(choices.showUnlinked).toBe(false);
    expect(choices.choiceCount).toBe(1);
  });
});
