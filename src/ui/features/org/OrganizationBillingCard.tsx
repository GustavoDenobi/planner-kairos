import { useState } from 'react';
import {
  addDays,
  billingStatus,
  localIsoDate,
  type OrganizationBillingOverview,
} from '@/domain/platform/billing';
import {
  BILLING_CYCLE_LABELS,
  BILLING_STATUS_BADGE_CLASSES,
  BILLING_STATUS_LABELS,
  describeDueDate,
  formatCents,
  formatIsoDateBR,
} from '@/ui/features/platform/billing-labels';

/** Situação da cobrança para os admins da organização (só aparece com cobrança ativa). */
export function OrganizationBillingCard({ overview }: { overview: OrganizationBillingOverview }) {
  const today = localIsoDate();
  const status = billingStatus({ ...overview, isActive: true }, today);
  const [copied, setCopied] = useState(false);

  async function handleCopyPix() {
    if (!overview.pixKey) {
      return;
    }
    try {
      await navigator.clipboard.writeText(overview.pixKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const alert =
    status === 'overdue'
      ? {
          className: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
          text: `O pagamento venceu em ${formatIsoDateBR(overview.nextDueDate)}. Regularize para manter o plano atual.`,
        }
      : status === 'grace'
        ? {
            className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
            text: `O pagamento venceu em ${formatIsoDateBR(overview.nextDueDate)}. Regularize até ${formatIsoDateBR(addDays(overview.nextDueDate, overview.graceDays))} para manter o plano atual.`,
          }
        : null;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-text">Pagamento</h2>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BILLING_STATUS_BADGE_CLASSES[status]}`}
        >
          {BILLING_STATUS_LABELS[status]}
        </span>
      </div>

      {alert && <p className={`mt-3 rounded-lg p-3 text-sm ${alert.className}`}>{alert.text}</p>}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-bg p-4">
          <p className="text-sm text-muted">Valor</p>
          <p className="mt-1 text-2xl font-semibold text-text">
            {formatCents(overview.amountCents)}
          </p>
          <p className="mt-1 text-xs text-muted">{BILLING_CYCLE_LABELS[overview.cycleMonths]}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg p-4">
          <p className="text-sm text-muted">Próximo vencimento</p>
          <p className="mt-1 text-2xl font-semibold text-text">
            {formatIsoDateBR(overview.nextDueDate)}
          </p>
          <p className="mt-1 text-xs text-muted">{describeDueDate(overview.nextDueDate, today)}</p>
        </div>
      </div>

      {(overview.pixKey || overview.instructions) && (
        <div className="mt-3 rounded-xl border border-border bg-bg p-4 text-sm">
          {overview.pixKey && (
            <>
              <p className="text-muted">Chave Pix</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="min-w-0 break-all rounded bg-surface px-2 py-1 text-text">
                  {overview.pixKey}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyPix()}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                  {copied ? 'Copiada!' : 'Copiar chave'}
                </button>
              </div>
              {overview.pixRecipientName && (
                <p className="mt-2 text-xs text-muted">Favorecido: {overview.pixRecipientName}</p>
              )}
            </>
          )}
          {overview.instructions && (
            <p className={`whitespace-pre-wrap text-text ${overview.pixKey ? 'mt-3' : ''}`}>
              {overview.instructions}
            </p>
          )}
        </div>
      )}

      {overview.recentPayments.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted">Últimos pagamentos</p>
          <ul className="mt-1 divide-y divide-border rounded-xl border border-border bg-bg text-sm">
            {overview.recentPayments.map((payment, index) => (
              <li key={`${payment.paidOn}-${index}`} className="flex justify-between px-4 py-2">
                <span className="text-text">{formatIsoDateBR(payment.paidOn)}</span>
                <span className="tabular-nums text-text">{formatCents(payment.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
