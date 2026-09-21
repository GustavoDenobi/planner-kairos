import type { EventParticipant } from './event-absence';

export type AbsenceGroupingMode = 'name' | 'section' | 'part' | 'group';

export type AbsenceParticipantBucket = {
  id: string;
  label: string;
  participants: EventParticipant[];
};

const UNASSIGNED_SECTION_ID = 'section:none';
const UNASSIGNED_PART_ID = 'part:none';
const UNASSIGNED_GROUP_ID = 'group:none';

function comparePt(left: string, right: string): number {
  return left.localeCompare(right, 'pt-BR');
}

function sortParticipants(participants: EventParticipant[]): EventParticipant[] {
  return [...participants].sort((left, right) => comparePt(left.fullName, right.fullName));
}

function sectionLabel(
  sectionName: string | null,
  groupName: string,
  eventGroupCount: number,
): string {
  const name = sectionName?.trim() || 'Naipe';
  if (eventGroupCount > 1) {
    return `${name} · ${groupName}`;
  }
  return name;
}

function groupBySection(
  participants: EventParticipant[],
  eventGroupCount: number,
): AbsenceParticipantBucket[] {
  const buckets = new Map<
    string,
    {
      label: string;
      groupName: string;
      sectionName: string;
      sectionSortOrder: number;
      participants: Map<string, EventParticipant>;
    }
  >();
  const unassigned = new Map<string, EventParticipant>();

  for (const participant of participants) {
    const seen = new Set<string>();
    let placed = false;

    for (const membership of participant.memberships) {
      if (!membership.sectionId || seen.has(membership.sectionId)) {
        continue;
      }
      seen.add(membership.sectionId);
      placed = true;
      const existing = buckets.get(membership.sectionId);
      if (existing) {
        existing.participants.set(participant.musicianId, participant);
        continue;
      }
      buckets.set(membership.sectionId, {
        label: sectionLabel(membership.sectionName, membership.groupName, eventGroupCount),
        groupName: membership.groupName,
        sectionName: membership.sectionName?.trim() || 'Naipe',
        sectionSortOrder: membership.sectionSortOrder ?? Number.MAX_SAFE_INTEGER,
        participants: new Map([[participant.musicianId, participant]]),
      });
    }

    if (!placed) {
      unassigned.set(participant.musicianId, participant);
    }
  }

  const ordered = [...buckets.entries()]
    .sort(([, left], [, right]) => {
      const byGroup = comparePt(left.groupName, right.groupName);
      if (byGroup !== 0) {
        return byGroup;
      }
      if (left.sectionSortOrder !== right.sectionSortOrder) {
        return left.sectionSortOrder - right.sectionSortOrder;
      }
      return comparePt(left.sectionName, right.sectionName);
    })
    .map(([id, bucket]) => ({
      id,
      label: bucket.label,
      participants: sortParticipants([...bucket.participants.values()]),
    }));

  if (unassigned.size > 0) {
    ordered.push({
      id: UNASSIGNED_SECTION_ID,
      label: 'Sem naipe',
      participants: sortParticipants([...unassigned.values()]),
    });
  }

  return ordered;
}

function partLabels(participant: EventParticipant): string[] {
  const fromMemberships = [
    ...new Set(
      participant.memberships
        .map((membership) => membership.partName?.trim() ?? '')
        .filter((partName) => partName.length > 0),
    ),
  ];
  if (fromMemberships.length > 0) {
    return fromMemberships;
  }
  if (participant.memberships.length === 0) {
    return [
      ...new Set(
        participant.partNames
          .map((partName) => partName.trim())
          .filter((partName) => partName.length > 0),
      ),
    ];
  }
  return [];
}

function groupByPart(participants: EventParticipant[]): AbsenceParticipantBucket[] {
  const buckets = new Map<string, Map<string, EventParticipant>>();
  const unassigned = new Map<string, EventParticipant>();

  for (const participant of participants) {
    const labels = partLabels(participant);
    if (labels.length === 0) {
      unassigned.set(participant.musicianId, participant);
      continue;
    }
    for (const label of labels) {
      const existing = buckets.get(label) ?? new Map<string, EventParticipant>();
      existing.set(participant.musicianId, participant);
      buckets.set(label, existing);
    }
  }

  const ordered = [...buckets.entries()]
    .sort(([left], [right]) => comparePt(left, right))
    .map(([label, members]) => ({
      id: `part:${label}`,
      label,
      participants: sortParticipants([...members.values()]),
    }));

  if (unassigned.size > 0) {
    ordered.push({
      id: UNASSIGNED_PART_ID,
      label: 'Sem parte',
      participants: sortParticipants([...unassigned.values()]),
    });
  }

  return ordered;
}

function groupByGroup(participants: EventParticipant[]): AbsenceParticipantBucket[] {
  const buckets = new Map<
    string,
    { label: string; participants: Map<string, EventParticipant> }
  >();
  const unassigned = new Map<string, EventParticipant>();

  for (const participant of participants) {
    const seen = new Set<string>();
    let placed = false;

    for (const membership of participant.memberships) {
      if (!membership.groupId || seen.has(membership.groupId)) {
        continue;
      }
      seen.add(membership.groupId);
      placed = true;
      const existing = buckets.get(membership.groupId);
      if (existing) {
        existing.participants.set(participant.musicianId, participant);
        continue;
      }
      buckets.set(membership.groupId, {
        label: membership.groupName,
        participants: new Map([[participant.musicianId, participant]]),
      });
    }

    if (!placed) {
      unassigned.set(participant.musicianId, participant);
    }
  }

  const ordered = [...buckets.entries()]
    .sort(([, left], [, right]) => comparePt(left.label, right.label))
    .map(([id, bucket]) => ({
      id,
      label: bucket.label,
      participants: sortParticipants([...bucket.participants.values()]),
    }));

  if (unassigned.size > 0) {
    ordered.push({
      id: UNASSIGNED_GROUP_ID,
      label: 'Sem grupo',
      participants: sortParticipants([...unassigned.values()]),
    });
  }

  return ordered;
}

export function groupEventParticipants(
  participants: EventParticipant[],
  mode: AbsenceGroupingMode,
  eventGroupCount = 1,
): AbsenceParticipantBucket[] {
  if (participants.length === 0) {
    return [];
  }
  if (mode === 'name') {
    return [{ id: 'name', label: '', participants: sortParticipants(participants) }];
  }
  if (mode === 'section') {
    return groupBySection(participants, eventGroupCount);
  }
  if (mode === 'part') {
    return groupByPart(participants);
  }
  return groupByGroup(participants);
}
