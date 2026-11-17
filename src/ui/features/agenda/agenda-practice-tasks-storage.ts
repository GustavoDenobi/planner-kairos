const STORAGE_KEY = 'planner-kairos:agenda-practice-tasks';

export function loadAgendaPracticeTasksVisibility(userId: string): boolean {
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

export function saveAgendaPracticeTasksVisibility(userId: string, showTasks: boolean): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${userId}`, String(showTasks));
  } catch {
    // ignore storage errors
  }
}
