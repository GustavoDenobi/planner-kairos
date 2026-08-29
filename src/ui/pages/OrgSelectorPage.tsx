import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconSettings } from '@/ui/components/icons';
import { OrgAvatar } from '@/ui/components/OrgAvatar';
import { DisplayPreferencesControls } from '@/ui/components/DisplayPreferencesControls';
import { useOrg } from '@/ui/app/OrgProvider';
import { withReturnTo } from '@/ui/navigation/return-to';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';

export function OrgSelectorPage() {
  const {
    organizations,
    isLoading,
    isOfflineData,
    isPlatformAdmin,
    setCurrentOrgBySlug,
    refreshOrganizations,
  } = useOrg();
  const navigate = useNavigate();
  const online = useOnlineStatus();

  useEffect(() => {
    refreshOrganizations();
  }, [refreshOrganizations]);

  async function handleSelect(slug: string) {
    const ok = await setCurrentOrgBySlug(slug);
    if (ok) {
      if (!online || isOfflineData) {
        navigate(`/${slug}/leitura`);
      } else {
        navigate(`/${slug}/agenda`);
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        Carregando organizações…
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="mb-4 flex justify-end">
          <DisplayPreferencesControls variant="compact" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          {isOfflineData || !online ? (
            <>
              <h1 className="text-xl font-semibold text-text">Sem dados offline</h1>
              <p className="mt-2 text-sm text-muted">
                Conecte-se à internet e abra o app uma vez para sincronizar suas organizações.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-text">Sem acesso</h1>
              <p className="mt-2 text-sm text-muted">
                Você não pertence a nenhuma organização. Peça um convite ao maestro.
              </p>
              <Link to="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
                Voltar ao login
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="mb-6 flex items-center justify-end">
        <DisplayPreferencesControls variant="compact" />
      </div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-text">Selecione</h1>
        {isPlatformAdmin && online && !isOfflineData && (
          <Link
            to="/admin/organizacoes"
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-primary hover:bg-bg"
          >
            Administração
          </Link>
        )}
      </div>
      {(isOfflineData || !online) && (
        <p className="mb-4 text-center text-sm text-muted">
          Modo offline — apenas playlists salvas neste dispositivo estão disponíveis.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {organizations.map((org) => {
          const isAdmin =
            isPlatformAdmin || org.accessRole === 'admin' || org.accessRole === 'owner';
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
                {isAdmin && online && !isOfflineData && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/${org.slug}/configuracao`, {
                        state: withReturnTo({}, '/orgs'),
                      })
                    }
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
    </div>
  );
}
