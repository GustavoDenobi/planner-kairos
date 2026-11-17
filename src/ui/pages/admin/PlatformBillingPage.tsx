import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  billingStatus,
  localIsoDate,
  type BillingStatus,
  type PlatformBillingSettings,
} from '@/domain/platform/billing';
import type { PlatformOrganizationSummary } from '@/domain/platform/plan';
import { usePlatform } from '@/ui/app/AppServicesContext';
import {
  AdminPageShell,
  adminEmptyStateClass,
  adminFieldClass,
  adminListClass,
  adminListItemClass,
  adminPrimaryButtonClass,
  adminSectionClass,
} from '@/ui/features/platform/admin-page-shell';
import {
  BILLING_CYCLE_LABELS,
  BILLING_STATUS_BADGE_CLASSES,
  BILLING_STATUS_LABELS,
  BILLING_STATUS_PRIORITY,
  describeDueDate,
  formatCents,
  formatIsoDateBR,
} from '@/ui/features/platform/billing-labels';
import { platformErrorMessage } from '@/ui/features/platform/platform-labels';

type Filter = 'attention' | 'all';

export function PlatformBillingPage() {
  const platform = usePlatform();
  const [organizations, setOrganizations] = useState<PlatformOrganizationSummary[]>([]);
  const [settings, setSettings] = useState<PlatformBillingSettings>({
    pixKey: null,
    pixRecipientName: null,
    instructions: null,
  });
  const [pixKey, setPixKey] = useState('');
  const [pixRecipientName, setPixRecipientName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = localIsoDate();

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    const [orgsResult, settingsResult] = await Promise.all([
      platform.listOrganizations(),
      platform.getBillingSettings(),
    ]);
    setIsLoading(false);

    if (!orgsResult.ok) {
      setError(platformErrorMessage(orgsResult.error));
      return;
    }
    if (!settingsResult.ok) {
      setError(platformErrorMessage(settingsResult.error));
      return;
    }

    setOrganizations(orgsResult.value);
    setSettings(settingsResult.value);
    setPixKey(settingsResult.value.pixKey ?? '');
    setPixRecipientName(settingsResult.value.pixRecipientName ?? '');
    setInstructions(settingsResult.value.instructions ?? '');
  }

  const billed = useMemo(
    () =>
      organizations
        .filter((org) => org.billing?.isActive)
        .map((org) => ({ org, status: billingStatus(org.billing, today) }))
        .sort(
          (a, b) =>
            BILLING_STATUS_PRIORITY[a.status] - BILLING_STATUS_PRIORITY[b.status] ||
            a.org.billing!.nextDueDate.localeCompare(b.org.billing!.nextDueDate),
        ),
    [organizations, today],
  );

  const counts = useMemo(() => {
    const result: Record<BillingStatus, number> = {
      overdue: 0,
      grace: 0,
      due_soon: 0,
      current: 0,
      not_billed: 0,
    };
    for (const item of billed) {
      result[item.status] += 1;
    }
    return result;
  }, [billed]);

  const monthlyRevenueCents = useMemo(
    () =>
      billed.reduce(
        (sum, { org }) => sum + Math.round(org.billing!.amountCents / org.billing!.cycleMonths),
        0,
      ),
    [billed],
  );

  const visible =
    filter === 'attention'
      ? billed.filter((item) => item.status !== 'current')
      : billed;

  const settingsDirty =
    (settings.pixKey ?? '') !== pixKey ||
    (settings.pixRecipientName ?? '') !== pixRecipientName ||
    (settings.instructions ?? '') !== instructions;

  async function handleSaveSettings(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSettingsSaved(false);
    const next: PlatformBillingSettings = {
      pixKey: pixKey.trim() || null,
      pixRecipientName: pixRecipientName.trim() || null,
      instructions: instructions.trim() || null,
    };
    const result = await platform.updateBillingSettings(next);
    setIsSaving(false);
    if (!result.ok) {
      setError(platformErrorMessage(result.error));
      return;
    }
    setSettings(next);
    setSettingsSaved(true);
  }

  if (isLoading) {
    return (
      <AdminPageShell title="Cobrança">
        <p className={adminEmptyStateClass}>Carregando cobranças…</p>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      title="Cobrança"
      subtitle={`${billed.length} organizações com cobrança ativa · ${formatCents(monthlyRevenueCents)}/mês estimado`}
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {(['overdue', 'grace', 'due_soon', 'current'] as const).map((status) => (
          <div key={status} className={adminSectionClass}>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BILLING_STATUS_BADGE_CLASSES[status]}`}
            >
              {BILLING_STATUS_LABELS[status]}
            </span>
            <p className="mt-2 text-2xl font-semibold text-text">{counts[status]}</p>
          </div>
        ))}
      </div>

      <section className={adminSectionClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-text">Organizações cobradas</h2>
          <div className="flex gap-1 rounded-lg bg-bg p-1 text-sm">
            {(
              [
                ['all', 'Todas'],
                ['attention', 'Precisam de atenção'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={[
                  'rounded-md px-3 py-1',
                  filter === value ? 'bg-surface font-medium text-text shadow-sm' : 'text-muted',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            {billed.length === 0
              ? 'Nenhuma organização com cobrança ativa. Configure a cobrança na página de cada organização.'
              : 'Nenhuma cobrança pendente. Tudo em dia.'}
          </p>
        ) : (
          <ul className={`mt-4 ${adminListClass}`}>
            {visible.map(({ org, status }) => (
              <li key={org.id}>
                <Link
                  to={`/admin/organizacoes/${org.id}`}
                  className={`${adminListItemClass} flex-wrap bg-bg hover:bg-surface`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text">{org.name}</p>
                    <p className="text-xs text-muted">
                      {org.planName} · {formatCents(org.billing!.amountCents)}{' '}
                      {BILLING_CYCLE_LABELS[org.billing!.cycleMonths].toLowerCase()}
                      {org.lastPaymentOn
                        ? ` · último pagamento ${formatIsoDateBR(org.lastPaymentOn)}`
                        : ' · nenhum pagamento registrado'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BILLING_STATUS_BADGE_CLASSES[status]}`}
                    >
                      {BILLING_STATUS_LABELS[status]}
                    </span>
                    <p className="mt-1 text-xs text-muted">
                      {formatIsoDateBR(org.billing!.nextDueDate)} ·{' '}
                      {describeDueDate(org.billing!.nextDueDate, today)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`mt-6 ${adminSectionClass}`}>
        <h2 className="font-semibold text-text">Dados para pagamento</h2>
        <p className="mt-1 text-sm text-muted">
          Exibidos aos administradores das organizações com cobrança ativa, na tela de
          configurações.
        </p>
        <form
          onSubmit={(event) => void handleSaveSettings(event)}
          className="mt-4 flex flex-col gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text">Chave Pix</span>
              <input
                value={pixKey}
                onChange={(event) => {
                  setPixKey(event.target.value);
                  setSettingsSaved(false);
                }}
                placeholder="CNPJ, e-mail, telefone ou chave aleatória"
                className={adminFieldClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text">Favorecido</span>
              <input
                value={pixRecipientName}
                onChange={(event) => {
                  setPixRecipientName(event.target.value);
                  setSettingsSaved(false);
                }}
                placeholder="Nome que aparece no app do banco"
                className={adminFieldClass}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Instruções</span>
            <textarea
              rows={3}
              value={instructions}
              onChange={(event) => {
                setInstructions(event.target.value);
                setSettingsSaved(false);
              }}
              placeholder="Ex.: Após pagar, envie o comprovante para financeiro@… ou pelo WhatsApp (11) …"
              className={adminFieldClass}
            />
          </label>
          <div className="flex items-center justify-end gap-3">
            {settingsSaved && <span className="text-sm text-muted">Salvo.</span>}
            <button
              type="submit"
              disabled={isSaving || !settingsDirty}
              className={adminPrimaryButtonClass}
            >
              Salvar dados de pagamento
            </button>
          </div>
        </form>
      </section>
    </AdminPageShell>
  );
}
