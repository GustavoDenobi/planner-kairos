import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AccessRole } from '@/domain/identity';
import type { PlatformOrganizationSummary } from '@/domain/platform/plan';
import type { PlatformUserDetail } from '@/domain/platform/plan';
import { usePlatform } from '@/ui/app/AppServicesContext';
import { BackButton } from '@/ui/components/BackButton';
import {
  adminEmptyStateClass,
  adminFieldClass,
  adminListClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminSectionClass,
  adminSelectClass,
} from '@/ui/features/platform/admin-page-shell';
import { orgPageContentClass } from '@/ui/layouts/OrgListPageLayout';
import { platformErrorMessage } from '@/ui/features/platform/platform-labels';

const ROLES: { value: AccessRole; label: string }[] = [
  { value: 'member', label: 'Membro' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
];

function roleLabel(role: AccessRole): string {
  return ROLES.find((item) => item.value === role)?.label ?? role;
}

export function PlatformUserDetailPage() {
  const { userId = '' } = useParams();
  const platform = usePlatform();
  const navigate = useNavigate();
  const [user, setUser] = useState<PlatformUserDetail | null>(null);
  const [organizations, setOrganizations] = useState<PlatformOrganizationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newOrgId, setNewOrgId] = useState('');
  const [newRole, setNewRole] = useState<AccessRole>('member');
  const [password, setPassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void loadData();
  }, [userId]);

  async function loadData() {
    setIsLoading(true);
    setError(null);

    const [userResult, orgsResult] = await Promise.all([
      platform.getUser(userId),
      platform.listOrganizations(),
    ]);

    if (!userResult.ok) {
      setError(platformErrorMessage(userResult.error));
      setIsLoading(false);
      return;
    }

    if (!orgsResult.ok) {
      setError(platformErrorMessage(orgsResult.error));
      setIsLoading(false);
      return;
    }

    setUser(userResult.value);
    setOrganizations(orgsResult.value);
    if (orgsResult.value.length > 0) {
      setNewOrgId(orgsResult.value[0]!.id);
    }
    setIsLoading(false);
  }

  async function handleRoleChange(organizationId: string, accessRole: AccessRole) {
    setIsBusy(true);
    const result = await platform.upsertMembership(organizationId, userId, accessRole);
    setIsBusy(false);

    if (!result.ok) {
      setActionMessage(platformErrorMessage(result.error));
      return;
    }

    setActionMessage(null);
    await loadData();
  }

  async function handleRemoveMembership(organizationId: string) {
    setIsBusy(true);
    const result = await platform.removeMembership(organizationId, userId);
    setIsBusy(false);

    if (!result.ok) {
      setActionMessage(platformErrorMessage(result.error));
      return;
    }

    setActionMessage(null);
    await loadData();
  }

  async function handleAddMembership(event: React.FormEvent) {
    event.preventDefault();
    if (!newOrgId) {
      return;
    }

    setIsBusy(true);
    const result = await platform.upsertMembership(newOrgId, userId, newRole);
    setIsBusy(false);

    if (!result.ok) {
      setActionMessage(platformErrorMessage(result.error));
      return;
    }

    setActionMessage(null);
    await loadData();
  }

  async function handleSetPassword(event: React.FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    const result = await platform.setUserPassword(userId, password);
    setIsBusy(false);

    if (!result.ok) {
      setActionMessage(platformErrorMessage(result.error));
      return;
    }

    setPassword('');
    setActionMessage('Senha atualizada com sucesso.');
  }

  async function handleDeleteUser() {
    if (deleteConfirm !== user?.email) {
      setActionMessage('Digite o e-mail do usuário para confirmar a exclusão.');
      return;
    }

    setIsBusy(true);
    const result = await platform.deleteUser(userId);
    setIsBusy(false);

    if (!result.ok) {
      setActionMessage(platformErrorMessage(result.error));
      return;
    }

    navigate('/admin/usuarios');
  }

  if (isLoading) {
    return (
      <div className={orgPageContentClass}>
        <p className={adminEmptyStateClass}>Carregando usuário…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={orgPageContentClass}>
        <p className="text-sm text-red-600">{error ?? 'Usuário não encontrado.'}</p>
      </div>
    );
  }

  return (
    <div className={orgPageContentClass}>
      <BackButton fallbackTo="/admin/usuarios" />

      <div className="mt-4">
        <h1 className="text-2xl font-bold text-text">{user.displayName}</h1>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
      </div>

      {(error || actionMessage) && (
        <p className={`mt-4 text-sm ${error ? 'text-red-600' : 'text-muted'}`}>
          {error ?? actionMessage}
        </p>
      )}

      <section className={`mt-8 ${adminSectionClass}`}>
        <h2 className="font-semibold text-text">Organizações</h2>

        {user.memberships.length === 0 ? (
          <p className={`mt-4 ${adminEmptyStateClass}`}>Nenhum vínculo com organizações.</p>
        ) : (
          <ul className={`mt-4 ${adminListClass}`}>
            {user.memberships.map((membership) => (
              <li
                key={membership.membershipId}
                className="rounded-xl border border-border bg-bg px-4 py-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-text">{membership.organizationName}</p>
                    <p className="text-sm text-muted">{membership.organizationSlug}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={membership.accessRole}
                      disabled={isBusy}
                      onChange={(event) =>
                        void handleRoleChange(
                          membership.organizationId,
                          event.target.value as AccessRole,
                        )
                      }
                      className={adminSelectClass}
                      aria-label={`Papel em ${membership.organizationName}`}
                    >
                      {ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleRemoveMembership(membership.organizationId)}
                      className="text-sm text-red-600 hover:underline disabled:opacity-50"
                    >
                      Remover
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted sm:hidden">
                  Papel atual: {roleLabel(membership.accessRole)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={(event) => void handleAddMembership(event)}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-text">Organização</span>
            <select
              value={newOrgId}
              onChange={(event) => setNewOrgId(event.target.value)}
              className={adminSelectClass}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Papel</span>
            <select
              value={newRole}
              onChange={(event) => setNewRole(event.target.value as AccessRole)}
              className={adminSelectClass}
            >
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={isBusy} className={adminPrimaryButtonClass}>
            Adicionar vínculo
          </button>
        </form>
      </section>

      <section className={`mt-8 ${adminSectionClass}`}>
        <h2 className="font-semibold text-text">Redefinir senha</h2>
        <form
          onSubmit={(event) => void handleSetPassword(event)}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
        >
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Nova senha"
            minLength={8}
            className={`min-w-0 flex-1 ${adminFieldClass}`}
            required
          />
          <button type="submit" disabled={isBusy} className={adminSecondaryButtonClass}>
            Salvar senha
          </button>
        </form>
      </section>

      <section className={`mt-8 border-red-200 ${adminSectionClass}`}>
        <h2 className="font-semibold text-red-600">Excluir usuário</h2>
        <p className="mt-2 text-sm text-muted">
          Esta ação remove a conta permanentemente. Digite <strong>{user.email}</strong> para
          confirmar.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <input
            value={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.value)}
            placeholder={user.email}
            className={`min-w-0 flex-1 ${adminFieldClass}`}
          />
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleDeleteUser()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            Excluir usuário
          </button>
        </div>
      </section>
    </div>
  );
}
