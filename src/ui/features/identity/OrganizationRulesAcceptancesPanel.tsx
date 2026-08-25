import { useEffect, useState } from 'react';
import type { OrganizationRulesAcceptanceListItem } from '@/application/ports/legal-acceptance-repository';
import { useIdentity } from '@/ui/app/AppServicesContext';

type OrganizationRulesAcceptancesPanelProps = {
  organizationId: string;
};

export function OrganizationRulesAcceptancesPanel({
  organizationId,
}: OrganizationRulesAcceptancesPanelProps) {
  const identity = useIdentity();
  const [items, setItems] = useState<OrganizationRulesAcceptanceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void identity.listOrganizationRulesAcceptances(organizationId).then((rows) => {
      if (cancelled) {
        return;
      }

      setItems(rows);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setError('Não foi possível carregar os aceites do regulamento.');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [identity, organizationId]);

  if (loading) {
    return <p className="text-sm text-muted">Carregando aceites do regulamento…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nenhum aceite registrado ainda. Os aceites aparecem quando músicos concluem convite ou
        vínculo com regulamento exigido.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-border bg-bg text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Nome</th>
            <th className="px-3 py-2 font-medium">E-mail</th>
            <th className="px-3 py-2 font-medium">Versão</th>
            <th className="px-3 py-2 font-medium">Aceito em</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.userId} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2 text-text">{item.displayName}</td>
              <td className="px-3 py-2 text-muted">{item.email}</td>
              <td className="px-3 py-2 text-muted">v{item.documentVersion}</td>
              <td className="px-3 py-2 text-muted">
                {item.acceptedAt.toLocaleString('pt-BR')}
              </td>
              <td className="px-3 py-2">
                {item.isCurrentVersion ? (
                  <span className="text-green-700">Atual</span>
                ) : (
                  <span className="text-amber-700">Desatualizado</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
