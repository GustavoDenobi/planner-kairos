/**
 * Cobrança manual (Pix direto): o admin da plataforma registra pagamentos e ajusta vencimentos.
 * O sistema só calcula a situação e avisa — rebaixar o plano é sempre uma ação manual.
 */

export const BILLING_CYCLE_MONTHS = [1, 3, 6, 12] as const;
export type BillingCycleMonths = (typeof BILLING_CYCLE_MONTHS)[number];

/** Quantos dias antes do vencimento a cobrança passa a "vence em breve". */
export const BILLING_DUE_SOON_DAYS = 5;
export const DEFAULT_BILLING_GRACE_DAYS = 7;

export type OrganizationBilling = {
  organizationId: string;
  isActive: boolean;
  amountCents: number;
  cycleMonths: BillingCycleMonths;
  /** Data (AAAA-MM-DD) do próximo pagamento esperado. */
  nextDueDate: string;
  /** Dias de tolerância após o vencimento antes de considerar "em atraso". */
  graceDays: number;
  notes: string | null;
};

export type OrganizationBillingInput = Omit<OrganizationBilling, 'organizationId'>;

/**
 * - not_billed: sem cobrança configurada ou cobrança encerrada
 * - current: em dia
 * - due_soon: vence nos próximos dias
 * - grace: vencida, dentro da carência
 * - overdue: vencida e fora da carência (candidata a rebaixamento)
 */
export type BillingStatus = 'not_billed' | 'current' | 'due_soon' | 'grace' | 'overdue';

export type BillingEntryKind = 'payment' | 'plan_change' | 'note';

export type BillingEntry = {
  id: string;
  kind: BillingEntryKind;
  occurredOn: string;
  amountCents: number | null;
  fromPlanName: string | null;
  toPlanName: string | null;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type RecordPaymentInput = {
  paidOn: string;
  amountCents: number;
  /** Novo vencimento após o pagamento (normalmente o atual + um ciclo). */
  nextDueDate: string;
  note: string | null;
};

export type PlatformBillingSettings = {
  pixKey: string | null;
  pixRecipientName: string | null;
  instructions: string | null;
};

/** O que os admins da organização veem sobre a própria cobrança. */
export type OrganizationBillingOverview = {
  amountCents: number;
  cycleMonths: BillingCycleMonths;
  nextDueDate: string;
  graceDays: number;
  pixKey: string | null;
  pixRecipientName: string | null;
  instructions: string | null;
  recentPayments: { paidOn: string; amountCents: number }[];
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new Error(`invalid_date:${value}`);
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function toUtcDays(value: string): number {
  const { year, month, day } = parseIsoDate(value);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Diferença em dias de calendário (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round(toUtcDays(b) - toUtcDays(a));
}

export function addDays(date: string, days: number): string {
  const d = new Date((toUtcDays(date) + days) * 86_400_000);
  return formatIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Soma meses mantendo o dia; se o mês de destino for mais curto, usa o último dia
 * (31/jan + 1 mês = 28 ou 29/fev), como o `date + interval` do Postgres.
 */
export function addMonths(date: string, months: number): string {
  const { year, month, day } = parseIsoDate(date);
  const totalMonths = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return formatIsoDate(targetYear, targetMonth, Math.min(day, lastDay));
}

/** Data local (AAAA-MM-DD) de um instante. */
export function localIsoDate(now: Date = new Date()): string {
  return formatIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function billingStatus(
  billing: Pick<OrganizationBilling, 'isActive' | 'nextDueDate' | 'graceDays'> | null,
  today: string,
): BillingStatus {
  if (!billing || !billing.isActive) {
    return 'not_billed';
  }

  const daysUntilDue = daysBetween(today, billing.nextDueDate);
  if (daysUntilDue > BILLING_DUE_SOON_DAYS) {
    return 'current';
  }
  if (daysUntilDue >= 0) {
    return 'due_soon';
  }
  if (-daysUntilDue <= billing.graceDays) {
    return 'grace';
  }
  return 'overdue';
}

/** Próximo vencimento sugerido ao registrar um pagamento: o vencimento atual + um ciclo. */
export function suggestedNextDueDate(
  billing: Pick<OrganizationBilling, 'nextDueDate' | 'cycleMonths'>,
): string {
  return addMonths(billing.nextDueDate, billing.cycleMonths);
}

export function isBillingCycleMonths(value: number): value is BillingCycleMonths {
  return (BILLING_CYCLE_MONTHS as readonly number[]).includes(value);
}
