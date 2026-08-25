import type { EnsembleRole } from '@/domain/ensemble';

export type MusicianBirthdayAssignment = {
  groupId: string;
  groupName: string;
  ensembleRole: EnsembleRole;
  sectionName: string | null;
  partName: string | null;
};

export type MusicianBirthdaySource = {
  id: string;
  fullName: string;
  birthDate: string;
  assignments: MusicianBirthdayAssignment[];
};

export type MusicianBirthdayItem = {
  musicianId: string;
  fullName: string;
  date: string;
  ageTurning: number | null;
  assignments: MusicianBirthdayAssignment[];
};

export type ListMusicianBirthdaysOptions = {
  allowedMusicianIds?: Set<string> | null;
  groupId?: string | null;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function parseBirthDate(birthDate: string): {
  birthMonth: number;
  birthDay: number;
  birthYear: number | null;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());
  if (!match) {
    return null;
  }

  const birthYear = Number.parseInt(match[1], 10);
  const birthMonth = Number.parseInt(match[2], 10);
  const birthDay = Number.parseInt(match[3], 10);

  if (
    !Number.isFinite(birthMonth) ||
    !Number.isFinite(birthDay) ||
    birthMonth < 1 ||
    birthMonth > 12 ||
    birthDay < 1 ||
    birthDay > 31
  ) {
    return null;
  }

  const validBirthYear =
    Number.isFinite(birthYear) && birthYear > 0 && birthYear <= 9999 ? birthYear : null;

  return { birthMonth, birthDay, birthYear: validBirthYear };
}

function birthdayMatchesDay(
  birthMonth: number,
  birthDay: number,
  dayDate: Date,
): boolean {
  const targetYear = dayDate.getFullYear();
  const targetMonth = dayDate.getMonth() + 1;
  const targetDay = dayDate.getDate();

  if (birthMonth === 2 && birthDay === 29) {
    if (targetMonth !== 2) {
      return false;
    }
    return isLeapYear(targetYear) ? targetDay === 29 : targetDay === 28;
  }

  return birthMonth === targetMonth && birthDay === targetDay;
}

function ageTurningOnDay(birthYear: number | null, dayDate: Date): number | null {
  if (birthYear === null) {
    return null;
  }

  const targetYear = dayDate.getFullYear();
  if (birthYear > targetYear) {
    return null;
  }

  return targetYear - birthYear;
}

function compareBirthdays(a: MusicianBirthdayItem, b: MusicianBirthdayItem): number {
  const dateCompare = a.date.localeCompare(b.date);
  if (dateCompare !== 0) {
    return dateCompare;
  }
  return a.fullName.localeCompare(b.fullName, 'pt-BR');
}

function assignmentsForDisplay(
  assignments: MusicianBirthdayAssignment[],
  groupId: string | null | undefined,
): MusicianBirthdayAssignment[] {
  if (!groupId) {
    return assignments;
  }
  return assignments.filter((assignment) => assignment.groupId === groupId);
}

export function listMusicianBirthdaysInRange(
  musicians: MusicianBirthdaySource[],
  from: string | Date,
  to: string | Date,
  options: ListMusicianBirthdaysOptions = {},
): MusicianBirthdayItem[] {
  const rangeFrom = startOfDay(typeof from === 'string' ? new Date(from) : from);
  const rangeTo = startOfDay(typeof to === 'string' ? new Date(to) : to);
  const allowedIds = options.allowedMusicianIds ?? null;
  const groupId = options.groupId ?? null;

  const birthdays: MusicianBirthdayItem[] = [];

  for (const musician of musicians) {
    if (!musician.birthDate) {
      continue;
    }
    if (allowedIds && !allowedIds.has(musician.id)) {
      continue;
    }

    const parsed = parseBirthDate(musician.birthDate);
    if (!parsed) {
      continue;
    }

    let current = new Date(rangeFrom);
    while (current < rangeTo) {
      if (birthdayMatchesDay(parsed.birthMonth, parsed.birthDay, current)) {
        birthdays.push({
          musicianId: musician.id,
          fullName: musician.fullName,
          date: startOfDay(current).toISOString(),
          ageTurning: ageTurningOnDay(parsed.birthYear, current),
          assignments: assignmentsForDisplay(musician.assignments, groupId),
        });
      }
      current = addDays(current, 1);
    }
  }

  return birthdays.sort(compareBirthdays);
}
