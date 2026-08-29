import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePlatform } from '@/ui/app/AppServicesContext';
import { BackButton } from '@/ui/components/BackButton';
import {
  adminEmptyStateClass,
  adminFieldClass,
  adminPrimaryButtonClass,
  adminSectionClass,
} from '@/ui/features/platform/admin-page-shell';
import { orgPageContentClass } from '@/ui/layouts/OrgListPageLayout';
import { platformErrorMessage, slugify } from '@/ui/features/platform/platform-labels';

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalBytes(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function PlatformPlanFormPage() {
  const { planId } = useParams();
  const isNew = planId === 'novo' || !planId;
  const platform = usePlatform();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [maxGroups, setMaxGroups] = useState('');
  const [maxMusicians, setMaxMusicians] = useState('');
  const [maxPieces, setMaxPieces] = useState('');
  const [maxStorageMb, setMaxStorageMb] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState('0');
  const [organizationsCount, setOrganizationsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew && planId) {
      void loadPlan(planId);
    }
  }, [isNew, planId]);

  async function loadPlan(id: string) {
    setIsLoading(true);
    const result = await platform.getPlan(id);

    if (!result.ok) {
      setError(platformErrorMessage(result.error));
      setIsLoading(false);
      return;
    }

    if (!result.value) {
      setError('Plano não encontrado.');
      setIsLoading(false);
      return;
    }

    const plan = result.value;
    setName(plan.name);
    setSlug(plan.slug);
    setDescription(plan.description ?? '');
    setMaxGroups(plan.maxGroups?.toString() ?? '');
    setMaxMusicians(plan.maxMusicians?.toString() ?? '');
    setMaxPieces(plan.maxPieces?.toString() ?? '');
    setMaxStorageMb(
      plan.maxStorageBytes === null ? '' : String(Math.round(plan.maxStorageBytes / (1024 * 1024))),
    );
    setIsActive(plan.isActive);
    setSortOrder(String(plan.sortOrder));
    setOrganizationsCount(plan.organizationsCount);
    setIsLoading(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setError(null);

    const storageMb = parseOptionalBytes(maxStorageMb);
    const maxStorageBytes =
      storageMb === null ? null : storageMb * 1024 * 1024;

    const result = await platform.upsertPlan({
      id: isNew ? undefined : planId,
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      maxGroups: parseOptionalInt(maxGroups),
      maxMusicians: parseOptionalInt(maxMusicians),
      maxPieces: parseOptionalInt(maxPieces),
      maxStorageBytes,
      isActive,
      sortOrder: Number.parseInt(sortOrder, 10) || 0,
    });

    setIsBusy(false);

    if (!result.ok) {
      setError(platformErrorMessage(result.error));
      return;
    }

    navigate('/admin/planos');
  }

  if (isLoading) {
    return (
      <div className={orgPageContentClass}>
        <p className={adminEmptyStateClass}>Carregando plano…</p>
      </div>
    );
  }

  return (
    <div className={orgPageContentClass}>
      <BackButton fallbackTo="/admin/planos" />

      <h1 className="mt-4 text-2xl font-bold text-text">
        {isNew ? 'Novo plano' : 'Editar plano'}
      </h1>

      {!isNew && (
        <p className="mt-1 text-sm text-muted">{organizationsCount} organizações usam este plano</p>
      )}

      <form onSubmit={(event) => void handleSubmit(event)} className={`mt-6 space-y-4 ${adminSectionClass}`}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text">Nome</span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (isNew && !slug) {
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
          <span className="font-medium text-text">Descrição</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className={adminFieldClass}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Máx. grupos (vazio = ilimitado)</span>
            <input
              value={maxGroups}
              onChange={(event) => setMaxGroups(event.target.value)}
              inputMode="numeric"
              className={adminFieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Máx. músicos</span>
            <input
              value={maxMusicians}
              onChange={(event) => setMaxMusicians(event.target.value)}
              inputMode="numeric"
              className={adminFieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Máx. peças</span>
            <input
              value={maxPieces}
              onChange={(event) => setMaxPieces(event.target.value)}
              inputMode="numeric"
              className={adminFieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Máx. storage (MB)</span>
            <input
              value={maxStorageMb}
              onChange={(event) => setMaxStorageMb(event.target.value)}
              inputMode="numeric"
              className={adminFieldClass}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Plano ativo
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Ordem</span>
            <input
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              inputMode="numeric"
              className="w-24 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={isBusy} className={adminPrimaryButtonClass}>
          Salvar
        </button>
      </form>
    </div>
  );
}
