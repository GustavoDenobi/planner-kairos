import type { AnnotationSet } from './annotation-set';
import type { ReadingPlaylistSourceEventAudience } from './reading-playlist';

export type DefaultVisibleLayers = {
  personal: boolean;
  section: boolean;
  directed: Record<string, boolean>;
};

type AudienceAnnotationSet = Pick<AnnotationSet, 'id' | 'musicians' | 'groups'>;

export function annotationSetMatchesSourceEventAudience(
  set: Pick<AnnotationSet, 'musicians' | 'groups'>,
  audience: ReadingPlaylistSourceEventAudience,
): boolean {
  const musicianIds = new Set(audience.musicianIds);
  const groupIds = new Set(audience.groupIds);

  if (set.musicians.some((musician) => musicianIds.has(musician.id))) {
    return true;
  }

  return set.groups.some((group) => groupIds.has(group.id));
}

export function matchDirectedAnnotationSetIds(
  sets: readonly AudienceAnnotationSet[],
  audience: ReadingPlaylistSourceEventAudience | null,
): string[] {
  if (!audience) {
    return [];
  }

  return sets
    .filter((set) => annotationSetMatchesSourceEventAudience(set, audience))
    .map((set) => set.id);
}

export function buildDefaultVisibleLayers(
  directedSetIds: readonly string[],
  autoVisibleDirectedSetIds: readonly string[],
): DefaultVisibleLayers {
  const autoVisible = new Set(autoVisibleDirectedSetIds);
  return {
    personal: true,
    section: true,
    directed: Object.fromEntries(directedSetIds.map((id) => [id, autoVisible.has(id)])),
  };
}
