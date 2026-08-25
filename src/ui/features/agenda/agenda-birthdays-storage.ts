const STORAGE_KEY = 'planner-kairos:agenda-birthdays';

export function loadAgendaBirthdaysVisibility(userId: string): boolean {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (raw === null) {
      return true;
    }
    return raw === 'true';
  } catch {
    return true;
  }
}

export function saveAgendaBirthdaysVisibility(userId: string, showBirthdays: boolean): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${userId}`, String(showBirthdays));
  } catch {
    // ignore storage errors
  }
}
