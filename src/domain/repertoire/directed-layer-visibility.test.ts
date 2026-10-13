import { describe, expect, it } from 'vitest';
import type { AnnotationSetGroup, AnnotationSetMusician } from './annotation-set';
import {
  annotationSetMatchesSourceEventAudience,
  buildDefaultVisibleLayers,
  matchDirectedAnnotationSetIds,
} from './directed-layer-visibility';
import type { ReadingPlaylistSourceEventAudience } from './reading-playlist';

function musician(id: string): AnnotationSetMusician {
  return { id, fullName: id };
}

function group(id: string): AnnotationSetGroup {
  return { id, name: id, kind: 'class' };
}

function set(id: string, musicianIds: string[] = [], groupIds: string[] = []) {
  return {
    id,
    musicians: musicianIds.map(musician),
    groups: groupIds.map(group),
  };
}

const lesson: ReadingPlaylistSourceEventAudience = {
  musicianIds: ['aluno-1'],
  groupIds: ['turma-a'],
};

describe('annotationSetMatchesSourceEventAudience', () => {
  it('combina pelo músico da aula', () => {
    expect(
      annotationSetMatchesSourceEventAudience(set('camada', ['aluno-1']), lesson),
    ).toBe(true);
  });

  it('combina pelo grupo da aula', () => {
    expect(
      annotationSetMatchesSourceEventAudience(set('camada', [], ['turma-a']), lesson),
    ).toBe(true);
  });

  it('não combina quando não há interseção', () => {
    expect(
      annotationSetMatchesSourceEventAudience(set('camada', ['outro'], ['outra-turma']), lesson),
    ).toBe(false);
  });
});

describe('matchDirectedAnnotationSetIds', () => {
  const sets = [
    set('joao', ['aluno-1']),
    set('maria', ['aluno-2']),
    set('turma', [], ['turma-a']),
    set('outra', ['aluno-3'], ['turma-b']),
  ];

  it('liga só as camadas da aula individual', () => {
    expect(
      matchDirectedAnnotationSetIds(sets, { musicianIds: ['aluno-1'], groupIds: [] }),
    ).toEqual(['joao']);
  });

  it('liga todas as camadas que intersectam a turma', () => {
    expect(
      matchDirectedAnnotationSetIds(sets, {
        musicianIds: ['aluno-1', 'aluno-2'],
        groupIds: ['turma-a'],
      }),
    ).toEqual(['joao', 'maria', 'turma']);
  });

  it('não liga nenhuma camada sem audiência', () => {
    expect(matchDirectedAnnotationSetIds(sets, null)).toEqual([]);
    expect(
      matchDirectedAnnotationSetIds(sets, { musicianIds: [], groupIds: [] }),
    ).toEqual([]);
  });
});

describe('buildDefaultVisibleLayers', () => {
  it('mostra pessoal e naipe e só as dirigidas automáticas', () => {
    expect(buildDefaultVisibleLayers(['a', 'b', 'c'], ['b'])).toEqual({
      personal: true,
      section: true,
      directed: { a: false, b: true, c: false },
    });
  });
});
