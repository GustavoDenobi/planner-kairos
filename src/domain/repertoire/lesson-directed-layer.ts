import type { AnnotationSet } from './annotation-set';
import { annotationSetMatchesSourceEventAudience } from './directed-layer-visibility';
import type { ReadingPlaylistSourceEventAudience } from './reading-playlist';

export type AnnotationSetAudienceFingerprint = {
  musicianIds: string[];
  groupIds: string[];
  title: string | null;
};

export function annotationSetAudienceFingerprint(
  set: Pick<AnnotationSet, 'musicians' | 'groups' | 'title'>,
): AnnotationSetAudienceFingerprint {
  return {
    musicianIds: [...set.musicians.map((musician) => musician.id)].sort(),
    groupIds: [...set.groups.map((group) => group.id)].sort(),
    title: set.title?.trim() || null,
  };
}

function sortedIdsEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

export function fingerprintsEqual(
  left: AnnotationSetAudienceFingerprint,
  right: AnnotationSetAudienceFingerprint,
): boolean {
  return (
    sortedIdsEqual([...left.musicianIds].sort(), [...right.musicianIds].sort()) &&
    sortedIdsEqual([...left.groupIds].sort(), [...right.groupIds].sort()) &&
    left.title === right.title
  );
}

function audienceIdsMatchSession(
  set: Pick<AnnotationSet, 'musicians' | 'groups'>,
  session: ReadingPlaylistSourceEventAudience,
): boolean {
  const setMusicianIds = [...set.musicians.map((musician) => musician.id)].sort();
  const setGroupIds = [...set.groups.map((group) => group.id)].sort();
  const sessionMusicianIds = [...session.musicianIds].sort();
  const sessionGroupIds = [...session.groupIds].sort();
  return (
    sortedIdsEqual(setMusicianIds, sessionMusicianIds) &&
    sortedIdsEqual(setGroupIds, sessionGroupIds)
  );
}

function scoreEditableSetForLesson(
  set: AnnotationSet,
  session: ReadingPlaylistSourceEventAudience,
  userId: string | null,
  rememberedFingerprint: AnnotationSetAudienceFingerprint | null,
): number {
  if (!userId || set.authorUserId !== userId) {
    return -1;
  }
  if (!annotationSetMatchesSourceEventAudience(set, session)) {
    return -1;
  }

  let score = 0;
  const fingerprint = annotationSetAudienceFingerprint(set);

  if (rememberedFingerprint && fingerprintsEqual(fingerprint, rememberedFingerprint)) {
    score += 1_000;
  }

  if (audienceIdsMatchSession(set, session)) {
    score += 100;
  }

  const singleStudent = session.musicianIds.length === 1 && session.groupIds.length === 0;
  if (singleStudent && set.musicians.some((musician) => musician.id === session.musicianIds[0])) {
    score += 50;
  }
  if (singleStudent && set.musicians.length === 1 && set.groups.length === 0) {
    score += 30;
  }
  if (singleStudent && set.musicians.length > 0 && set.groups.length === 0) {
    score += 20;
  }

  return score;
}

export type PickDirectedAnnotationSetResult =
  | { kind: 'picked'; setId: string }
  | { kind: 'none' }
  | { kind: 'ambiguous'; setIds: string[] };

export function pickDirectedAnnotationSetForLesson(
  sets: readonly AnnotationSet[],
  session: ReadingPlaylistSourceEventAudience,
  userId: string | null,
  rememberedFingerprint: AnnotationSetAudienceFingerprint | null,
): PickDirectedAnnotationSetResult {
  const ranked = sets
    .map((set) => ({
      set,
      score: scoreEditableSetForLesson(set, session, userId, rememberedFingerprint),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.set.updatedAt.localeCompare(left.set.updatedAt);
    });

  if (ranked.length === 0) {
    return { kind: 'none' };
  }

  const topScore = ranked[0].score;
  const topTier = ranked.filter((entry) => entry.score === topScore);
  if (topTier.length > 1) {
    return { kind: 'ambiguous', setIds: topTier.map((entry) => entry.set.id) };
  }

  return { kind: 'picked', setId: ranked[0].set.id };
}

export type SourceEventAudienceLabelLookup = {
  musicians: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string }>;
};

export function formatSourceEventAudienceLabel(
  audience: ReadingPlaylistSourceEventAudience,
  lookup?: SourceEventAudienceLabelLookup,
): string {
  const musicianNames = audience.musicianIds
    .map((id) => lookup?.musicians.find((musician) => musician.id === id)?.name ?? null)
    .filter((name): name is string => Boolean(name?.trim()));
  const groupNames = audience.groupIds
    .map((id) => lookup?.groups.find((group) => group.id === id)?.name ?? null)
    .filter((name): name is string => Boolean(name?.trim()));

  const names = [...musicianNames, ...groupNames];
  if (names.length === 0) {
    return 'Destinatários da aula';
  }
  if (names.length <= 2) {
    return names.join(', ');
  }
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

export function defaultLessonDirectedLayerTitle(audienceLabel: string): string {
  const trimmed = audienceLabel.trim();
  if (!trimmed || trimmed === 'Destinatários da aula') {
    return 'Aula';
  }
  return `Aula — ${trimmed}`;
}

export function annotationSetMatchesLessonSession(
  set: Pick<AnnotationSet, 'musicians' | 'groups'>,
  session: ReadingPlaylistSourceEventAudience | null,
): boolean {
  if (!session) {
    return false;
  }
  return annotationSetMatchesSourceEventAudience(set, session);
}