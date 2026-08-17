import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { OrganizationWithRole } from '@/application/ports';
import { IconSettings } from '@/ui/components/icons';
import { OrgAvatar } from '@/ui/components/OrgAvatar';
import { ThemeToggle } from '@/ui/components/ThemeToggle';
import { OrganizationEditModal } from '@/ui/features/identity/OrganizationEditModal';
import { useOrg } from '@/ui/app/OrgProvider';

export function OrgSelectorPage() {
  const { organizations, isLoading, setCurrentOrgBySlug, refreshOrganizations } = useOrg();
  const navigate = useNavigate();
  const [editingOrg, setEditingOrg] = useState<OrganizationWithRole | null>(null);

  useEffect(() => {
    refreshOrganizations();
  }, [refreshOrganizations]);

  async function handleSelect(slug: string) {
    const ok = await setCurrentOrgBySlug(slug);
    if (ok) {
      navigate(`/${slug}/agenda`);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Carregando organizações…
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="mb-4 flex justify-end">
          <ThemeToggle variant="compact" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <h1 className="text-xl font-semibold text-text">Sem acesso</h1>
          <p className="mt-2 text-sm text-muted">
            Você não pertence a nenhuma organização. Peça um convite ao maestro.
          </p>
          <Link to="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
            Voltar ao login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="mb-6 flex items-center justify-end">
        <ThemeToggle variant="compact" />
      </div>

      <ul className="flex flex-col gap-3">
        {organizations.map((org) => {
          const isAdmin = org.accessRole === 'admin' || org.accessRole === 'owner';
          return (
            <li
              key={org.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4"
            >
              <OrgAvatar organization={org} size="lg" variant="square" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text">{org.name}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setEditingOrg(org)}
                    className="rounded-lg border border-border p-2 text-muted hover:bg-bg hover:text-text"
                    aria-label="Editar organização"
                  >
                    <IconSettings className="h-5 w-5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSelect(org.slug)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Entrar
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {editingOrg && (
        <OrganizationEditModal
          organization={editingOrg}
          open={true}
          onClose={() => setEditingOrg(null)}
          onUpdated={() => {
            refreshOrganizations();
            setEditingOrg(null);
          }}
        />
      )}
    </div>
  );
}
