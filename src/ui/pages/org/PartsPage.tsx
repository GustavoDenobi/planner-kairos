import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { PartDivision, PartKind } from '@/domain/ensemble';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import { useEnsemble } from '@/ui/app/AppServicesContext';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { Modal } from '@/ui/components/Modal';
import { IconPencil } from '@/ui/components/icons';
import { SortableDragHandle, SortableList, type SortableDragHandleProps } from '@/ui/components/SortableList';
import { PART_KIND_OPTIONS } from '@/ui/features/ensemble/ensemble-labels';
import { OrgListPageLayout } from '@/ui/layouts/OrgListPageLayout';
import { matchesSearchText, normalizeSearchText } from '@/ui/utils/normalize-search-text';
type DivisionModalState = {
  partId: string;
  partName: string;
  divisionId: string | null;
  name: string;
};

export function PartsPage() {
  const { orgSlug } = useParams();
  const ensemble = useEnsemble();
  const { organizations } = useOrg();
  const org = organizations.find((o) => o.slug === orgSlug);

  const [parts, setParts] = useState<PartWithDivisions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useLoadingBar('parts', isLoading);
  const [partModalOpen, setPartModalOpen] = useState(false);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PartKind>('instrument');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  const [divisionModal, setDivisionModal] = useState<DivisionModalState | null>(null);
  const [divisionError, setDivisionError] = useState<string | null>(null);
  const [isSavingDivision, setIsSavingDivision] = useState(false);
  const [isDeletingDivision, setIsDeletingDivision] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';
  const isSearching = normalizeSearchText(searchQuery).length > 0;
  const filteredParts = useMemo(
    () => parts.filter((part) => matchesSearchText(part.name, searchQuery)),
    [parts, searchQuery],
  );
  useEffect(() => {
    if (!org) {
      return;
    }

    setIsLoading(true);
    ensemble.listParts(org.id).then((result) => {
      if (result.ok) {
        setParts(result.value);
      }
      setIsLoading(false);
    });
  }, [ensemble, org]);

  if (!org) {
    return null;
  }

  if (!isAdmin) {
    return <div className="text-muted">Acesso restrito a administradores.</div>;
  }

  function resetPartForm() {
    setEditingPartId(null);
    setName('');
    setKind('instrument');
    setError(null);
  }

  function openCreatePartModal() {
    resetPartForm();
    setPartModalOpen(true);
  }

  function openEditPartModal(part: PartWithDivisions) {
    setEditingPartId(part.id);
    setName(part.name);
    setKind(part.kind);
    setError(null);
    setPartModalOpen(true);
  }

  function openCreateDivisionModal(part: PartWithDivisions) {
    setDivisionModal({
      partId: part.id,
      partName: part.name,
      divisionId: null,
      name: '',
    });
    setDivisionError(null);
  }

  function openEditDivisionModal(part: PartWithDivisions, division: PartDivision) {
    setDivisionModal({
      partId: part.id,
      partName: part.name,
      divisionId: division.id,
      name: division.name,
    });
    setDivisionError(null);
  }

  function closeDivisionModal() {
    if (isSavingDivision || isDeletingDivision) {
      return;
    }
    setDivisionModal(null);
    setDivisionError(null);
  }

  async function refreshParts() {
    const result = await ensemble.listParts(org!.id);
    if (result.ok) {
      setParts(result.value);
    }
  }

  async function handleReorderParts(reordered: PartWithDivisions[]) {
    const previous = parts;
    setParts(reordered);
    setError(null);
    setIsReordering(true);

    const result = await ensemble.reorderParts(
      org!.id,
      reordered.map((part) => part.id),
    );

    setIsReordering(false);

    if (!result.ok) {
      setParts(previous);
      setError('Não foi possível reordenar as partes. Tente novamente em instantes.');
    }
  }

  async function handleSubmitPart(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const input = {
      name,
      kind,
    };

    const result = editingPartId
      ? await ensemble.updatePart(org!.id, editingPartId, input)
      : await ensemble.registerPart(org!.id, input);

    setIsSubmitting(false);

    if (!result.ok) {
      if (result.error === 'invalid_name') {
        setError('Informe o nome da parte antes de salvar.');
      } else if (result.error === 'duplicate_name') {
        setError('Já existe uma parte com este nome. Escolha outro nome.');
      } else {
        setError('Não foi possível salvar a parte. Verifique sua conexão e tente novamente.');
        console.error('save part failed:', result.error);
      }
      return;
    }

    setPartModalOpen(false);
    resetPartForm();
    await refreshParts();
  }

  async function handleSubmitDivision(event: React.FormEvent) {
    event.preventDefault();
    if (!divisionModal) {
      return;
    }

    setDivisionError(null);
    setIsSavingDivision(true);

    const input = {
      name: divisionModal.name,
    };

    const result = divisionModal.divisionId
      ? await ensemble.updatePartDivision(org!.id, divisionModal.divisionId, input)
      : await ensemble.registerPartDivision(org!.id, divisionModal.partId, input);

    setIsSavingDivision(false);

    if (!result.ok) {
      if (result.error === 'invalid_name') {
        setDivisionError('Informe o nome da divisão.');
      } else if (result.error === 'duplicate_name') {
        setDivisionError('Já existe uma divisão com este nome nesta parte.');
      } else {
        setDivisionError('Não foi possível salvar a divisão.');
      }
      return;
    }

    closeDivisionModal();
    await refreshParts();
  }

  async function handleDeleteDivision() {
    if (!divisionModal?.divisionId) {
      return;
    }

    setDivisionError(null);
    setIsDeletingDivision(true);

    const result = await ensemble.removePartDivision(org!.id, divisionModal.divisionId);

    setIsDeletingDivision(false);

    if (!result.ok) {
      setDivisionError('Não foi possível excluir a divisão.');
      return;
    }

    closeDivisionModal();
    await refreshParts();
  }

  const isEditingDivision = divisionModal?.divisionId !== null;

  function renderPartCard(part: PartWithDivisions, handle?: SortableDragHandleProps) {
    return (
      <div className="rounded-xl border border-border bg-surface py-3 pr-4 pl-1.5">
        <div className="flex items-start gap-1">
          {handle ? (
            <SortableDragHandle {...handle} label={`Reordenar ${part.name}`} />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-text ml-1">{part.name}</p>
              </div>
              <button
                type="button"
                onClick={() => openEditPartModal(part)}
                className="flex shrink-0 items-center justify-center rounded-lg border border-border p-2 text-muted transition-colors hover:bg-bg hover:text-text"
                aria-label={`Editar ${part.name}`}
              >
                <IconPencil className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {part.divisions.map((division) => (
                <button
                  key={division.id}
                  type="button"
                  onClick={() => openEditDivisionModal(part, division)}
                  className="rounded-full bg-bg px-3 py-1 text-xs font-medium text-text transition-colors hover:ring-1 hover:ring-border"
                >
                  {division.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => openCreateDivisionModal(part)}
                className="rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-primary hover:text-primary"
              >
                + Divisão
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <OrgListPageLayout
      header={
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-text">Partes</h1>
          <button
            type="button"
            onClick={openCreatePartModal}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            + Parte
          </button>
        </div>
      }
      toolbar={
        (error && !partModalOpen && !divisionModal) || (!isLoading && parts.length > 0)
          ? (
            <>
              {error && !partModalOpen && !divisionModal && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              {!isLoading && parts.length > 0 && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="sr-only">Buscar partes</span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nome…"
                    className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
                  />
                </label>
              )}
            </>
          )
          : undefined
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : parts.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma parte cadastrada.</p>
      ) : filteredParts.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma parte encontrada.</p>
      ) : isSearching ? (
        <ul className="flex flex-col gap-3">
          {filteredParts.map((part) => (
            <li key={part.id}>{renderPartCard(part)}</li>
          ))}
        </ul>
      ) : (
        <SortableList
          items={filteredParts}
          onReorder={handleReorderParts}
          disabled={isReordering}
          ariaLabel="Partes"
          className="flex flex-col gap-3"
          renderItem={(part, handle) => renderPartCard(part, handle)}
        />
      )}
    </OrgListPageLayout>

    <Modal
        open={partModalOpen}
        onClose={() => setPartModalOpen(false)}
        title={editingPartId ? 'Editar parte' : 'Nova parte'}
      >
        <form className="flex flex-col gap-4" onSubmit={handleSubmitPart}>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Nome</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Tipo</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as PartKind)}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text"
            >
              {PART_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      </Modal>

      <Modal
        open={divisionModal !== null}
        onClose={closeDivisionModal}
        title={isEditingDivision ? 'Editar divisão' : 'Nova divisão'}
      >
        {divisionModal && (
          <form className="flex flex-col gap-4" onSubmit={handleSubmitDivision}>
            <p className="text-sm text-muted">
              Parte: <span className="font-medium text-text">{divisionModal.partName}</span>
            </p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text">Nome</span>
              <input
                type="text"
                required
                autoFocus
                value={divisionModal.name}
                onChange={(e) =>
                  setDivisionModal((prev) =>
                    prev ? { ...prev, name: e.target.value } : prev,
                  )
                }
                placeholder="1, 2, div. A…"
                className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
              />
            </label>
            {divisionError && <p className="text-sm text-red-600">{divisionError}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isSavingDivision || isDeletingDivision}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {isSavingDivision ? 'Salvando…' : 'Salvar'}
              </button>
              {isEditingDivision && (
                <button
                  type="button"
                  disabled={isSavingDivision || isDeletingDivision}
                  onClick={handleDeleteDivision}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-red-600 hover:bg-bg disabled:opacity-50"
                >
                  {isDeletingDivision ? 'Excluindo…' : 'Excluir'}
                </button>
              )}
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
