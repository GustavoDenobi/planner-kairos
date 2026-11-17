import { describe, expect, it } from 'vitest';
import type { AnnotationSet } from './annotation-set';
import {
  annotationSetAudienceFingerprint,
  defaultLessonDirectedLayerTitle,
  fingerprintsEqual,
  pickDirectedAnnotationSetForLesson,
} from './lesson-directed-layer';

function buildSet(
  overrides: Partial<AnnotationSet> & Pick<AnnotationSet, 'id'>,
): AnnotationSet {
  return {
    organizationId: 'org',
    pieceFileId: 'file',
    authorUserId: 'prof',
    title: null,
    groups: [],
    musicians: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

const session = { musicianIds: ['aluno-1'], groupIds: ['turma-a'] };

describe('pickDirectedAnnotationSetForLesson', () => {
  it('prioriza camada com a mesma audiência lembrada da sessão', () => {
    const remembered = annotationSetAudienceFingerprint(
      buildSet({
        id: 'x',
        musicians: [{ id: 'aluno-1', fullName: 'João' }],
        groups: [{ id: 'turma-a', name: 'Turma', kind: 'class' }],
        title: 'Aula — João',
      }),
    );

    const sets = [
      buildSet({
        id: 'recente',
        musicians: [{ id: 'aluno-1', fullName: 'João' }],
        updatedAt: '2026-01-03T00:00:00Z',
      }),
      buildSet({
        id: 'lembrada',
        musicians: [{ id: 'aluno-1', fullName: 'João' }],
        groups: [{ id: 'turma-a', name: 'Turma', kind: 'class' }],
        title: 'Aula — João',
        updatedAt: '2026-01-01T00:00:00Z',
      }),
    ];

    expect(
      pickDirectedAnnotationSetForLesson(sets, session, 'prof', remembered),
    ).toEqual({ kind: 'picked', setId: 'lembrada' });
  });

  it('retorna ambíguo quando há empate de pontuação', () => {
    const sets = [
      buildSet({
        id: 'a',
        musicians: [{ id: 'aluno-1', fullName: 'João' }],
        updatedAt: '2026-01-01T00:00:00Z',
      }),
      buildSet({
        id: 'b',
        musicians: [{ id: 'aluno-1', fullName: 'João' }],
        updatedAt: '2026-01-01T00:00:00Z',
      }),
    ];

    expect(pickDirectedAnnotationSetForLesson(sets, session, 'prof', null)).toEqual({
      kind: 'ambiguous',
      setIds: ['a', 'b'],
    });
  });

  it('ignora camadas de outros autores', () => {
    const sets = [
      buildSet({
        id: 'terceiro',
        authorUserId: 'outro',
        musicians: [{ id: 'aluno-1', fullName: 'João' }],
      }),
    ];

    expect(pickDirectedAnnotationSetForLesson(sets, session, 'prof', null)).toEqual({
      kind: 'none',
    });
  });
});

describe('fingerprintsEqual', () => {
  it('compara título e ids ordenados', () => {
    const left = {
      musicianIds: ['b', 'a'],
      groupIds: [],
      title: 'Aula',
    };
    const right = {
      musicianIds: ['a', 'b'],
      groupIds: [],
      title: 'Aula',
    };
    expect(fingerprintsEqual(left, right)).toBe(true);
  });
});

describe('defaultLessonDirectedLayerTitle', () => {
  it('usa o rótulo da audiência', () => {
    expect(defaultLessonDirectedLayerTitle('Maria')).toBe('Aula — Maria');
  });
});