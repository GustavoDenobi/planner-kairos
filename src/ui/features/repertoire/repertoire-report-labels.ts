import type { RepertoireReportPeriod } from '@/domain/repertoire';

export const REPERTOIRE_REPORT_PERIOD_LABELS: Record<RepertoireReportPeriod, string> = {
  last_3_months: 'Últimos 3 meses',
  last_6_months: 'Últimos 6 meses',
  last_12_months: 'Últimos 12 meses',
  this_year: 'Este ano',
  last_year: 'Ano passado',
};

export const REPERTOIRE_REPORT_TABS = [
  { id: 'visao-geral', label: 'Visão geral' },
  { id: 'execucoes', label: 'Execuções' },
] as const;

export type RepertoireReportTabId = (typeof REPERTOIRE_REPORT_TABS)[number]['id'];

export const REPERTOIRE_REPORT_TAB_QUERY = 'aba';

export function parseRepertoireReportTab(value: string | null): RepertoireReportTabId {
  return REPERTOIRE_REPORT_TABS.some((tab) => tab.id === value)
    ? (value as RepertoireReportTabId)
    : 'visao-geral';
}

const MONTH_ABBREVIATIONS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/** `2026-03` → `mar` (ou `mar/26` quando `withYear`). */
export function formatReportMonth(month: string, withYear = false): string {
  const [year, monthNumber] = month.split('-');
  const label = MONTH_ABBREVIATIONS[Number(monthNumber) - 1] ?? month;
  return withYear ? `${label}/${year.slice(2)}` : label;
}

export function formatPerformanceCount(count: number): string {
  return count === 1 ? '1 vez' : `${count} vezes`;
}

export function formatMonthsAgo(months: number): string {
  if (months <= 0) {
    return 'este mês';
  }
  if (months === 1) {
    return 'há 1 mês';
  }
  if (months < 24) {
    return `há ${months} meses`;
  }
  const years = Math.floor(months / 12);
  return `há ${years} anos`;
}

export function formatPercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}
