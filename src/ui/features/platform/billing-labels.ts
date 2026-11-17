import {
  daysBetween,
  type BillingCycleMonths,
  type BillingStatus,
} from '@/domain/platform/billing';

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

/** "49,90", "49.90", "R$ 1.049,90" → centavos; null se inválido. */
export function parseCurrencyToCents(value: string): number | null {
  const cleaned = value.replace(/[R$\s]/g, '');
  if (!cleaned) {
    return null;
  }

  // Com vírgula, ela é o separador decimal e os pontos são milhar; sem vírgula, o ponto é decimal.
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  return Math.round(Number(normalized) * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** 2026-11-20 → 20/11/2026 */
export function formatIsoDateBR(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export const BILLING_CYCLE_LABELS: Record<BillingCycleMonths, string> = {
  1: 'Mensal',
  3: 'Trimestral',
  6: 'Semestral',
  12: 'Anual',
};

export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  not_billed: 'Sem cobrança',
  current: 'Em dia',
  due_soon: 'Vence em breve',
  grace: 'Vencida (carência)',
  overdue: 'Em atraso',
};

export const BILLING_STATUS_BADGE_CLASSES: Record<BillingStatus, string> = {
  not_billed: 'bg-bg text-muted',
  current: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  due_soon: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  grace: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
};

/** Ordem de urgência para listar cobranças (mais urgente primeiro). */
export const BILLING_STATUS_PRIORITY: Record<BillingStatus, number> = {
  overdue: 0,
  grace: 1,
  due_soon: 2,
  current: 3,
  not_billed: 4,
};

/** "vence hoje", "vence em 3 dias", "venceu há 2 dias". */
export function describeDueDate(nextDueDate: string, today: string): string {
  const days = daysBetween(today, nextDueDate);
  if (days === 0) {
    return 'vence hoje';
  }
  if (days === 1) {
    return 'vence amanhã';
  }
  if (days > 1) {
    return `vence em ${days} dias`;
  }
  if (days === -1) {
    return 'venceu ontem';
  }
  return `venceu há ${-days} dias`;
}
