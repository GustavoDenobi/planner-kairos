export const OFFLINE_AGENDA_FORWARD_DAYS = 90;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  return addDays(startOfDay(date), -day);
}

export function getOfflineAgendaCacheRange(now = new Date()): { from: Date; to: Date } {
  const from = startOfWeek(now);
  const to = addDays(startOfDay(now), OFFLINE_AGENDA_FORWARD_DAYS);
  return { from, to };
}
