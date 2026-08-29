import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { PlatformOrganizationSummary } from '@/domain/platform/plan';
import type { Plan } from '@/domain/platform/plan';
import { usePlatform } from '@/ui/app/AppServicesContext';
import { Modal } from '@/ui/components/Modal';
import { OrgAvatar } from '@/ui/components/OrgAvatar';
import {
  AdminPageShell,
  adminEmptyStateClass,
  adminFieldClass,
  adminListClass,
  adminListItemClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from '@/ui/features/platform/admin-page-shell';
import { platformErrorMessage, slugify } from '@/ui/features/platform/platform-labels';

export function PlatformOrganizationsPage() {
  const platform = usePlatform();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<PlatformOrganizationSummary[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [planId, setPlanId] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    setError(null);

    const [orgsResult, plansResult] = await Promise.all([
      platform.listOrganizations(),
      platform.listPlans(),
    ]);

    if (!orgsResult.ok) {
      setError(platformErrorMessage(orgsResult.error));
      setIsLoading(false);
      return;
    }

    if (!plansResult.ok) {
      setError(platformErrorMessage(plansResult.error));
      setIsLoading(false);
      return;
    }

    setOrganizations(orgsResult.value);
    setPlans(plansResult.value.filter((plan) => plan.isActive));
    if (plansResult.value.length > 0 && !planId) {
      setPlanId(plansResult.value[0]!.id);
    }
    setIsLoading(false);
  }

  async function handleLookupOwner() {
    if (!ownerEmail.trim()) {
      setOwnerUserId(null);
      return;
    }

    const result = await platform.findUserByEmail(ownerEmail.trim());
    if (result.ok && result.value.length > 0) {
      setOwnerUserId(result.value[0]!.id);
    } else {
      setOwnerUserId(null);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!ownerUserId) {
      setCreateError('Informe o e-mail de um usuário cadastrado como owner.');
      return;
    }

    setIsBusy(true);
    setCreateError(null);

    const result = await platform.createOrganization({
      name: name.trim(),
      slug: slug.trim(),
      ownerUserId,
      planId,
    });

    setIsBusy(false);

    if (!result.ok) {
      setCreateError(platformErrorMessage(result.error));
      return;
    }

    setShowCreate(false);
    setName('');
    setSlug('');
    setOwnerEmail('');
    setOwnerUserId(null);
    await loadData();
    navigate(`/admin/organizacoes/${result.value}`);
  }

  if (isLoading) {
    return (
      <AdminPageShell title="Organizações">
        <p className={adminEmptyStateClass}>Carregando organizações…</p>
      </AdminPageShell>
    );
  }

  return (
    <>
      <AdminPageShell
        title="Organizações"
        subtitle={`${organizations.length} cadastradas`}
        action={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className={adminPrimaryButtonClass}
          >
            Nova organização
          </button>
        }
      >
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {organizations.length === 0 ? (
          <p className={adminEmptyStateClass}>Nenhuma organização cadastrada.</p>
        ) : (
          <ul className={adminListClass}>
            {organizations.map((org) => (
              <li key={org.id}>
                <Link to={`/admin/organizacoes/${org.id}`} className={`${adminListItemClass} block`}>
                  <OrgAvatar
                    organization={{
                      id: org.id,
                      name: org.name,
                      slug: org.slug,
                      imageStorageKey: null,
                      rules: null,
                    }}
                    size="md"
                    variant="square"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text">{org.name}</p>
                    <p className="truncate text-sm text-muted">{org.slug}</p>
                    <p className="mt-1 text-xs text-muted sm:hidden">
                      {org.planName} · {org.membershipsCount} membros · {org.musiciansCount}{' '}
                      músicos
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right text-sm text-muted sm:block">
                    <p>{org.planName}</p>
                    <p className="text-xs">
                      {org.membershipsCount} membros · {org.musiciansCount} músicos · {org.piecesCount}{' '}
                      peças
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </AdminPageShell>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nova organização">
        <form onSubmit={(event) => void handleCreate(event)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Nome</span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slug) {
                  setSlug(slugify(event.target.value));
                }
              }}
              className={adminFieldClass}
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Slug</span>
            <input
              value={slug}
              onChange={(event) => setSlug(slugify(event.target.value))}
              className={adminFieldClass}
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">E-mail do owner</span>
            <input
              type="email"
              value={ownerEmail}
              onChange={(event) => setOwnerEmail(event.target.value)}
              onBlur={() => void handleLookupOwner()}
              className={adminFieldClass}
              required
            />
            {ownerEmail && (
              <span className="text-xs text-muted">
                {ownerUserId ? 'Usuário encontrado' : 'Usuário não encontrado'}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Plano</span>
            <select
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
              className={adminFieldClass}
              required
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>

          {createError && <p className="text-sm text-red-600">{createError}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className={adminSecondaryButtonClass}
            >
              Cancelar
            </button>
            <button type="submit" disabled={isBusy} className={adminPrimaryButtonClass}>
              Criar
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
