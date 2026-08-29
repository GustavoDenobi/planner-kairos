import type { GroupKind } from '@/domain/ensemble';

export type AnnotationSetGroup = {
  id: string;
  name: string;
  kind: GroupKind;
};

export type AnnotationSetMusician = {
  id: string;
  fullName: string;
};

export type AnnotationSet = {
  id: string;
  organizationId: string;
  pieceFileId: string;
  authorUserId: string;
  title: string | null;
  groups: AnnotationSetGroup[];
  musicians: AnnotationSetMusician[];
  createdAt: string;
  updatedAt: string;
};

export type CreateAnnotationSetInput = {
  pieceFileId: string;
  title?: string | null;
  groupIds: string[];
  musicianIds: string[];
};

export type UpdateAnnotationSetInput = {
  title?: string | null;
  groupIds?: string[];
  musicianIds?: string[];
};

export function annotationSetHasAudience(input: {
  groupIds: string[];
  musicianIds: string[];
}): boolean {
  return input.groupIds.length > 0 || input.musicianIds.length > 0;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidLike(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

export type AnnotationSetAudienceLookup = {
  groups: Array<{ id: string; name: string; kind: GroupKind }>;
  musicians: Array<{ id: string; name: string }>;
};

export function resolveAnnotationSetAudience(
  set: AnnotationSet,
  lookup?: AnnotationSetAudienceLookup,
): AnnotationSet {
  if (!lookup) {
    return {
      ...set,
      groups: set.groups.filter((group) => !isUuidLike(group.name)),
      musicians: set.musicians.filter((musician) => !isUuidLike(musician.fullName)),
    };
  }

  const groupById = new Map(lookup.groups.map((group) => [group.id, group]));
  const musicianById = new Map(lookup.musicians.map((musician) => [musician.id, musician]));

  const groups = set.groups
    .map((group) => {
      const option = groupById.get(group.id);
      if (option) {
        return { id: group.id, name: option.name, kind: option.kind };
      }
      if (!isUuidLike(group.name)) {
        return group;
      }
      return null;
    })
    .filter((group): group is AnnotationSetGroup => group !== null);

  for (const groupId of lookup.groups.map((group) => group.id)) {
    if (!groups.some((group) => group.id === groupId) && set.groups.some((group) => group.id === groupId)) {
      const option = groupById.get(groupId);
      if (option) {
        groups.push({ id: option.id, name: option.name, kind: option.kind });
      }
    }
  }

  const musicians = set.musicians
    .map((musician) => {
      const option = musicianById.get(musician.id);
      if (option) {
        return { id: musician.id, fullName: option.name };
      }
      if (!isUuidLike(musician.fullName)) {
        return musician;
      }
      return null;
    })
    .filter((musician): musician is AnnotationSetMusician => musician !== null);

  for (const musicianId of lookup.musicians.map((musician) => musician.id)) {
    if (
      !musicians.some((musician) => musician.id === musicianId) &&
      set.musicians.some((musician) => musician.id === musicianId)
    ) {
      const option = musicianById.get(musicianId);
      if (option) {
        musicians.push({ id: option.id, fullName: option.name });
      }
    }
  }

  return { ...set, groups, musicians };
}

export function formatAnnotationSetLabel(set: AnnotationSet): string {
  if (set.title?.trim()) {
    return set.title.trim();
  }

  const names = [
    ...set.groups.map((group) => group.name).filter((name) => !isUuidLike(name)),
    ...set.musicians.map((musician) => musician.fullName).filter((name) => !isUuidLike(name)),
  ];

  if (names.length === 0) {
    return 'Conjunto de anotações';
  }

  if (names.length <= 2) {
    return names.join(', ');
  }

  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}
