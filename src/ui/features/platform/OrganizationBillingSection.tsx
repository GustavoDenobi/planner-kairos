import { useState } from 'react';
import {
  BILLING_CYCLE_MONTHS,
  DEFAULT_BILLING_GRACE_DAYS,
  billingStatus,
  isBillingCycleMonths,
  localIsoDate,
  suggestedNextDueDate,
  addMonths,
  type BillingEntry,
  type OrganizationBilling,
} from '@/domain/platform/billing';
import { usePlatform } from '@/ui/app/AppServicesContext';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import { Modal } from '@/ui/components/Modal';
import {
  adminFieldClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminSectionClass,
} from '@/ui/features/platform/admin-page-shell';
import {
  BILLING_CYCLE_LABELS,
  BILLING_STATUS_BADGE_CLASSES,
  BILLING_STATUS_LABELS,
  centsToInput,
  describeDueDate,
  formatCents,
  formatIsoDateBR,
  parseCurrencyToCents,
} from '@/ui/features/platform/billing-labels';
import { platformErrorMessage } from '@/ui/features/platform/platform-labels';

type OrganizationBillingSectionProps = {
  organizationId: string;
  billing: OrganizationBilling | null;
  entries: BillingEntry[];
  onChanged: () => Promise<void>;
};

export function BillingStatusBadge({ billing }: { billing: OrganizationBilling | null }) {
  const status = billingStatus(billing, localIsoDate());
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${BILLING_STATUS_BADGE_CLASSES[status]}`}
    >
      {BILLING_STATUS_LABELS[status]}
    </span>
  );
}

function InfoItem({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-bg p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 font-medium text-text">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function entryTitle(entry: BillingEntry): string {
  switch (entry.kind) {
    case 'payment':
      return `Pagamento de ${formatCents(entry.amountCents ?? 0)}`;
    case 'plan_change':
      return `Plano: ${entry.fromPlanName ?? '—'} → ${entry.toPlanName ?? '—'}`;
    case 'note':
      return 'Anotação';
  }
}

export function OrganizationBillingSection({
  organizationId,
  billing,
  entries,
  onChanged,
}: OrganizationBillingSectionProps) {
  const platform = usePlatform();
  const today = localIsoDate();
  const status = billingStatus(billing, today);
  const lastPayment = entries.find((entry) => entry.kind === 'payment') ?? null;

  const [showConfig, setShowConfig] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<BillingEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeleteEntry() {
    if (!entryToDelete) {
      return;
    }
    setIsDeleting(true);
    const result = await platform.deleteOrganizationBillingEntry(entryToDelete.id);
    setIsDeleting(false);
    setEntryToDelete(null);
    if (!result.ok) {
      setError(platformErrorMessage(result.error));
      return;
    }
    await onChanged();
  }

  return (
    <section className={`mt-8 ${adminSectionClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-text">Cobrança</h2>
            <BillingStatusBadge billing={billing} />
          </div>
          <p className="mt-1 text-sm text-muted">
            Cobrança manual via Pix. O sistema só avisa: rebaixar o plano é sempre manual.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {billing ? (
            <>
              <button
                type="button"
                onClick={() => setShowPayment(true)}
                className={adminPrimaryButtonClass}
              >
                Registrar pagamento
              </button>
              <button
                type="button"
                onClick={() => setShowConfig(true)}
                className={adminSecondaryButtonClass}
              >
                Editar cobrança
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfig(true)}
              className={adminPrimaryButtonClass}
            >
              Configurar cobrança
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowNote(true)}
            className={adminSecondaryButtonClass}
          >
            Adicionar anotação
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {billing ? (
        <>
          {!billing.isActive && (
            <p className="mt-4 rounded-lg bg-bg p-3 text-sm text-muted">
              Cobrança encerrada. A organização não vê avisos de pagamento. Edite a cobrança para
              reativar.
            </p>
          )}
          {status === 'overdue' && (
            <p className="mt-4 rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
              Pagamento em atraso há mais de {billing.graceDays} dias. Se não houver acordo,
              rebaixe o plano na seção abaixo.
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem
              label="Valor"
              value={formatCents(billing.amountCents)}
              hint={BILLING_CYCLE_LABELS[billing.cycleMonths]}
            />
            <InfoItem
              label="Próximo vencimento"
              value={formatIsoDateBR(billing.nextDueDate)}
              hint={billing.isActive ? describeDueDate(billing.nextDueDate, today) : undefined}
            />
            <InfoItem label="Carência" value={`${billing.graceDays} dias`} />
            <InfoItem
              label="Último pagamento"
              value={lastPayment ? formatIsoDateBR(lastPayment.occurredOn) : 'Nenhum'}
              hint={lastPayment ? formatCents(lastPayment.amountCents ?? 0) : undefined}
            />
          </div>
          {billing.notes && (
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{billing.notes}</p>
          )}
        </>
      ) : (
        <p className="mt-4 rounded-lg bg-bg p-3 text-sm text-muted">
          Esta organização ainda não tem cobrança configurada.
        </p>
      )}

      <h3 className="mt-6 text-sm font-semibold text-text">Histórico</h3>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          Pagamentos, trocas de plano e anotações aparecem aqui.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-lg bg-bg">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
              <span className="w-20 shrink-0 tabular-nums text-muted">
                {formatIsoDateBR(entry.occurredOn)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-text">{entryTitle(entry)}</p>
                {entry.note && (
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted">{entry.note}</p>
                )}
                {entry.createdByName && (
                  <p className="mt-0.5 text-xs text-muted">por {entry.createdByName}</p>
                )}
              </div>
              {entry.kind !== 'plan_change' && (
                <button
                  type="button"
                  onClick={() => setEntryToDelete(entry)}
                  className="shrink-0 text-xs text-red-600 hover:underline"
                >
                  Excluir
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <BillingConfigModal
        open={showConfig}
        organizationId={organizationId}
        billing={billing}
        onClose={() => setShowConfig(false)}
        onSaved={async () => {
          setShowConfig(false);
          await onChanged();
        }}
      />

      {billing && (
        <RecordPaymentModal
          open={showPayment}
          organizationId={organizationId}
          billing={billing}
          onClose={() => setShowPayment(false)}
          onSaved={async () => {
            setShowPayment(false);
            await onChanged();
          }}
        />
      )}

      <NoteModal
        open={showNote}
        organizationId={organizationId}
        onClose={() => setShowNote(false)}
        onSaved={async () => {
          setShowNote(false);
          await onChanged();
        }}
      />

      <ConfirmModal
        open={entryToDelete !== null}
        title="Excluir lançamento"
        message={
          entryToDelete?.kind === 'payment'
            ? 'O pagamento sai do histórico, mas o vencimento não volta sozinho. Se ele foi avançado por engano, ajuste-o em "Editar cobrança".'
            : 'A anotação será removida do histórico.'
        }
        confirmLabel="Excluir"
        isConfirming={isDeleting}
        onConfirm={() => void handleDeleteEntry()}
        onClose={() => setEntryToDelete(null)}
      />
    </section>
  );
}

function BillingConfigModal({
  open,
  organizationId,
  billing,
  onClose,
  onSaved,
}: {
  open: boolean;
  organizationId: string;
  billing: OrganizationBilling | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const platform = usePlatform();
  const [amount, setAmount] = useState('');
  const [cycleMonths, setCycleMonths] = useState<number>(1);
  const [nextDueDate, setNextDueDate] = useState('');
  const [graceDays, setGraceDays] = useState(String(DEFAULT_BILLING_GRACE_DAYS));
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  // Recarrega os campos a cada abertura.
  if (open && !wasOpen) {
    setWasOpen(true);
    setAmount(billing ? centsToInput(billing.amountCents) : '');
    setCycleMonths(billing?.cycleMonths ?? 1);
    setNextDueDate(billing?.nextDueDate ?? addMonths(localIsoDate(), 1));
    setGraceDays(String(billing?.graceDays ?? DEFAULT_BILLING_GRACE_DAYS));
    setNotes(billing?.notes ?? '');
    setIsActive(billing?.isActive ?? true);
    setError(null);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const amountCents = parseCurrencyToCents(amount);
    const grace = Number(graceDays);
    if (amountCents === null) {
      setError('Informe um valor válido (ex.: 49,90).');
      return;
    }
    if (!Number.isInteger(grace) || grace < 0 || grace > 90) {
      setError('A carência deve ficar entre 0 e 90 dias.');
      return;
    }
    if (!nextDueDate || !isBillingCycleMonths(cycleMonths)) {
      setError('Preencha os campos obrigatórios.');
      return;
    }

    setIsBusy(true);
    setError(null);
    const result = await platform.upsertOrganizationBilling(organizationId, {
      isActive,
      amountCents,
      cycleMonths,
      nextDueDate,
      graceDays: grace,
      notes: notes.trim() || null,
    });
    setIsBusy(false);

    if (!result.ok) {
      setError(platformErrorMessage(result.error));
      return;
    }
    await onSaved();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={billing ? 'Editar cobrança' : 'Configurar cobrança'}
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Valor (R$)</span>
            <input
              inputMode="decimal"
              placeholder="49,90"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={adminFieldClass}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Ciclo</span>
            <select
              value={cycleMonths}
              onChange={(event) => setCycleMonths(Number(event.target.value))}
              className={adminFieldClass}
            >
              {BILLING_CYCLE_MONTHS.map((months) => (
                <option key={months} value={months}>
                  {BILLING_CYCLE_LABELS[months]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Próximo vencimento</span>
            <input
              type="date"
              value={nextDueDate}
              onChange={(event) => setNextDueDate(event.target.value)}
              className={adminFieldClass}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Carência (dias)</span>
            <input
              type="number"
              min={0}
              max={90}
              value={graceDays}
              onChange={(event) => setGraceDays(event.target.value)}
              className={adminFieldClass}
              required
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text">Observações internas</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Contato do responsável financeiro, acordos, desconto…"
            className={adminFieldClass}
          />
        </label>

        {billing && (
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Cobrança ativa
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={adminSecondaryButtonClass}>
            Cancelar
          </button>
          <button type="submit" disabled={isBusy} className={adminPrimaryButtonClass}>
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RecordPaymentModal({
  open,
  organizationId,
  billing,
  onClose,
  onSaved,
}: {
  open: boolean;
  organizationId: string;
  billing: OrganizationBilling;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const platform = usePlatform();
  const [paidOn, setPaidOn] = useState('');
  const [amount, setAmount] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [note, setNote] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setPaidOn(localIsoDate());
    setAmount(centsToInput(billing.amountCents));
    setNextDueDate(suggestedNextDueDate(billing));
    setNote('');
    setError(null);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const amountCents = parseCurrencyToCents(amount);
    if (amountCents === null) {
      setError('Informe um valor válido (ex.: 49,90).');
      return;
    }
    if (!paidOn || !nextDueDate) {
      setError('Preencha os campos obrigatórios.');
      return;
    }

    setIsBusy(true);
    setError(null);
    const result = await platform.recordOrganizationPayment(organizationId, {
      paidOn,
      amountCents,
      nextDueDate,
      note: note.trim() || null,
    });
    setIsBusy(false);

    if (!result.ok) {
      setError(platformErrorMessage(result.error));
      return;
    }
    await onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar pagamento">
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Data do pagamento</span>
            <input
              type="date"
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
              className={adminFieldClass}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Valor recebido (R$)</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={adminFieldClass}
              required
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text">Novo vencimento</span>
          <input
            type="date"
            value={nextDueDate}
            onChange={(event) => setNextDueDate(event.target.value)}
            className={adminFieldClass}
            required
          />
          <span className="text-xs text-muted">
            Vencimento atual ({formatIsoDateBR(billing.nextDueDate)}) +{' '}
            {BILLING_CYCLE_LABELS[billing.cycleMonths].toLowerCase()}. Ajuste se o pagamento
            cobrir mais de um ciclo.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text">Observação</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="ID da transação Pix, pagador…"
            className={adminFieldClass}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={adminSecondaryButtonClass}>
            Cancelar
          </button>
          <button type="submit" disabled={isBusy} className={adminPrimaryButtonClass}>
            Registrar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NoteModal({
  open,
  organizationId,
  onClose,
  onSaved,
}: {
  open: boolean;
  organizationId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const platform = usePlatform();
  const [note, setNote] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    const result = await platform.addOrganizationBillingNote(organizationId, note);
    setIsBusy(false);
    if (!result.ok) {
      setError(platformErrorMessage(result.error));
      return;
    }
    setNote('');
    await onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar anotação">
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <textarea
          rows={4}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ex.: cobrado por WhatsApp em 10/11; prometeu pagar dia 15."
          className={adminFieldClass}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={adminSecondaryButtonClass}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isBusy || !note.trim()}
            className={adminPrimaryButtonClass}
          >
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
