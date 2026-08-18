import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  AssignmentInput,
  AssignmentWithDetails,
  EnsembleRole,
  Group,
  Musician,
  Section,
} from '@/domain/ensemble';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import { useEnsemble } from '@/ui/app/AppServicesContext';
import { useOrg } from '@/ui/app/OrgProvider';
import { Modal } from '@/ui/components/Modal';
import { Tabs } from '@/ui/components/Tabs';
import { BackButton, BackLink } from '@/ui/components/BackButton';
import { IconPencil } from '@/ui/components/icons';
import { ENSEMBLE_ROLE_OPTIONS, ensembleRoleLabel } from '@/ui/features/ensemble/ensemble-labels';

type AssignmentFormState = {
  groupId: string;
  sectionId: string;
  partId: string;
  ensembleRole: EnsembleRole;
};

const emptyAssignmentForm = (): AssignmentFormState => ({
  groupId: '',
  sectionId: '',
  partId: '',
  ensembleRole: 'member',
});

export function MusicianDetailPage() {
  const { orgSlug, musicianId } = useParams();
  const navigate = useNavigate();
  const ensemble = useEnsemble();
  const { organizations } = useOrg();
  const org = organizations.find((o) => o.slug === orgSlug);

  const [musician, setMusician] = useState<Musician | null>(null);
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [parts, setParts] = useState<PartWithDivisions[]>([]);
  const [sectionsByGroup, setSectionsByGroup] = useState<Map<string, Section[]>>(new Map());
  const [sectionPartIdsByGroup, setSectionPartIdsByGroup] = useState<
    Map<string, Map<string, string[]>>
  >(new Map());

  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>(emptyAssignmentForm);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [isRemovingAssignment, setIsRemovingAssignment] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';

  useEffect(() => {
    if (!org || !musicianId) {
      return;
    }

    setIsLoading(true);

    Promise.all([
      ensemble.getMusician(org.id, musicianId),
      ensemble.listAssignmentsForMusician(org.id, musicianId),
      ensemble.listGroups(org.id),
      ensemble.listParts(org.id),
    ]).then(([musicianResult, assignmentsResult, groupsResult, partsResult]) => {
      if (musicianResult.ok) {
        setMusician(musicianResult.value);
        setFullName(musicianResult.value.fullName);
        setBirthDate(musicianResult.value.birthDate ?? '');
        setPhone(musicianResult.value.phone ?? '');
        setEmail(musicianResult.value.email ?? '');
      }
      if (assignmentsResult.ok) {
        setAssignments(assignmentsResult.value);
      }
      if (groupsResult.ok) {
        setGroups(groupsResult.value.filter((g) => !g.archivedAt));
      }
      if (partsResult.ok) {
        setParts(partsResult.value);
      }
      setIsLoading(false);
    });
  }, [ensemble, org, musicianId]);

  async function loadSectionsForGroup(groupId: string) {
    if (!org || sectionsByGroup.has(groupId)) {
      return;
    }

    const [sectionsResult, partIdsResult] = await Promise.all([
      ensemble.listSections(org.id, groupId),
      ensemble.listSectionPartIdsByGroup(org.id, groupId),
    ]);

    if (sectionsResult.ok) {
      setSectionsByGroup((prev) => new Map(prev).set(groupId, sectionsResult.value));
    }

    if (partIdsResult.ok) {
      setSectionPartIdsByGroup((prev) => new Map(prev).set(groupId, partIdsResult.value));
    }
  }

  if (!org || !musicianId) {
    return null;
  }

  if (!isAdmin) {
    return <div className="text-muted">Acesso restrito a administradores.</div>;
  }

  if (isLoading) {
    return <div className="text-muted">Carregando…</div>;
  }

  if (!musician) {
    return (
      <div>
        <p className="text-muted">Músico não encontrado.</p>
        <BackLink
          fallbackTo={`/${orgSlug}/musicos`}
          className="mt-2 text-sm text-primary hover:underline"
        >
          Voltar aos músicos
        </BackLink>
      </div>
    );
  }

  async function handleSave() {
    if (!isAdmin) {
      return;
    }

    setError(null);
    setIsSaving(true);

    const result = await ensemble.updateMusician(org!.id, musician!.id, {
      fullName,
      birthDate: birthDate || null,
      phone: phone || null,
      email: email || null,
    });

    setIsSaving(false);

    if (!result.ok) {
      if (result.error === 'invalid_phone') {
        setError('Telefone inválido.');
      } else if (result.error === 'invalid_email') {
        setError('E-mail inválido.');
      } else {
        setError('Não foi possível salvar as alterações.');
      }
      return;
    }

    setMusician(result.value);
  }

  function openNewAssignmentModal() {
    setEditingAssignmentId(null);
    setAssignmentForm(emptyAssignmentForm());
    setAssignmentError(null);
    setIsRemovingAssignment(false);
    setAssignmentModalOpen(true);
  }

  function openEditAssignmentModal(assignment: AssignmentWithDetails) {
    setEditingAssignmentId(assignment.id);
    setAssignmentForm({
      groupId: assignment.groupId,
      sectionId: assignment.sectionId ?? '',
      partId: assignment.partId ?? '',
      ensembleRole: assignment.ensembleRole,
    });
    setAssignmentError(null);
    setIsRemovingAssignment(false);
    setAssignmentModalOpen(true);
    void loadSectionsForGroup(assignment.groupId);
  }

  async function handleGroupChange(groupId: string) {
    setAssignmentForm((prev) => ({
      ...prev,
      groupId,
      sectionId: '',
    }));
    await loadSectionsForGroup(groupId);
  }

  async function refreshAssignments() {
    const result = await ensemble.listAssignmentsForMusician(org!.id, musician!.id);
    if (result.ok) {
      setAssignments(result.value);
    }
  }

  async function handleSaveAssignment(event: React.FormEvent) {
    event.preventDefault();
    if (!assignmentForm.groupId) {
      setAssignmentError('Selecione um grupo.');
      return;
    }

    setAssignmentError(null);
    setIsSavingAssignment(true);

    const input: AssignmentInput = {
      groupId: assignmentForm.groupId,
      sectionId: assignmentForm.sectionId || null,
      partId: assignmentForm.partId || null,
      ensembleRole: assignmentForm.ensembleRole,
    };

    const result = editingAssignmentId
      ? await ensemble.updateAssignment(org!.id, editingAssignmentId, input)
      : await ensemble.assignMusician(org!.id, musician!.id, input);

    setIsSavingAssignment(false);

    if (!result.ok) {
      if (result.error === 'duplicate_assignment') {
        setAssignmentError('Esta atribuição já existe.');
      } else if (result.error === 'section_lead_requires_section') {
        setAssignmentError('Chefe de naipe exige um naipe selecionado.');
      } else if (result.error === 'section_part_mismatch') {
        setAssignmentError('A parte selecionada não pertence ao naipe escolhido.');
      } else {
        setAssignmentError('Não foi possível salvar a atribuição.');
      }
      return;
    }

    setAssignmentModalOpen(false);
    await refreshAssignments();
  }

  async function handleRemoveAssignment() {
    if (!editingAssignmentId) {
      return;
    }

    setAssignmentError(null);
    setIsRemovingAssignment(true);

    const result = await ensemble.removeAssignment(org!.id, editingAssignmentId);

    setIsRemovingAssignment(false);

    if (!result.ok) {
      setAssignmentError('Não foi possível remover a atribuição.');
      return;
    }

    setAssignmentModalOpen(false);
    setEditingAssignmentId(null);
    await refreshAssignments();
  }

  const musicianFirstName = musician.fullName.trim().split(/\s+/)[0] ?? '';
  const isDeleteConfirmed =
    deleteConfirmName.trim().toLowerCase() === musicianFirstName.toLowerCase();

  function openDeleteModal() {
    setDeleteConfirmName('');
    setDeleteError(null);
    setDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    setDeleteModalOpen(false);
    setDeleteConfirmName('');
    setDeleteError(null);
  }

  async function handleDeleteMusician() {
    if (!isDeleteConfirmed) {
      return;
    }

    setDeleteError(null);
    setIsDeleting(true);

    const result = await ensemble.deleteMusician(org!.id, musician!.id);

    setIsDeleting(false);

    if (!result.ok) {
      setDeleteError('Não foi possível excluir o músico.');
      return;
    }

    navigate(`/${orgSlug}/musicos`);
  }

  const sectionsForSelectedGroup = assignmentForm.groupId
    ? sectionsByGroup.get(assignmentForm.groupId) ?? []
    : [];

  const sectionPartIdsForAssignment =
    assignmentForm.sectionId && assignmentForm.groupId
      ? sectionPartIdsByGroup.get(assignmentForm.groupId)?.get(assignmentForm.sectionId) ?? []
      : null;

  const partsForAssignment =
    sectionPartIdsForAssignment !== null
      ? parts.filter((part) => sectionPartIdsForAssignment.includes(part.id))
      : parts;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2">
        <BackButton fallbackTo={`/${orgSlug}/musicos`} />
        <h1 className="text-2xl font-semibold text-text">{musician.fullName}</h1>
      </div>

      <div className="mt-6">
        <Tabs
          tabs={[
            {
              id: 'geral',
              label: 'Geral',
              content: (
                <>
                  <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-text">Nome completo</span>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={!isAdmin}
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary disabled:opacity-60"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-text">Data de nascimento</span>
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        disabled={!isAdmin}
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary disabled:opacity-60"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-text">Telefone</span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={!isAdmin}
                        placeholder="(00) 00000-0000"
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary disabled:opacity-60"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-text">E-mail</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={!isAdmin}
                        placeholder="nome@exemplo.com"
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary disabled:opacity-60"
                      />
                    </label>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleSave}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {isSaving ? 'Salvando…' : 'Salvar'}
                      </button>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="mt-8 flex w-full md:justify-end">
                      <button
                        type="button"
                        onClick={openDeleteModal}
                        className="w-full rounded-lg border border-red-600/40 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-600/10 md:w-auto"
                      >
                        Excluir músico
                      </button>
                    </div>
                  )}
                </>
              ),
            },
            {
              id: 'atribuicoes',
              label: 'Atribuições',
              content: (
                <>
                  <ul className="flex flex-col gap-2">
                    {assignments.map((assignment) => (
                      <li
                        key={assignment.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-text">{assignment.groupName}</p>
                          <p className="mt-0.5 text-muted">
                            {ensembleRoleLabel(assignment.ensembleRole)}
                            {assignment.sectionName ? ` · ${assignment.sectionName}` : ''}
                            {assignment.partName ? ` · ${assignment.partName}` : ''}
                          </p>
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => openEditAssignmentModal(assignment)}
                            className="flex shrink-0 items-center justify-center rounded-lg border border-border p-2 text-muted transition-colors hover:bg-bg hover:text-text"
                            aria-label={`Editar atribuição em ${assignment.groupName}`}
                          >
                            <IconPencil className="h-5 w-5" />
                          </button>
                        )}
                      </li>
                    ))}
                    {assignments.length === 0 && (
                      <p className="text-sm text-muted">Nenhuma atribuição cadastrada.</p>
                    )}
                  </ul>
                  {isAdmin && (
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={openNewAssignmentModal}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                      >
                        + Atribuição
                      </button>
                    </div>
                  )}
                </>
              ),
            },
          ]}
        />
      </div>

      <Modal
        open={assignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
        title={editingAssignmentId ? 'Editar atribuição' : 'Nova atribuição'}
      >
        <form className="flex flex-col gap-4" onSubmit={handleSaveAssignment}>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Grupo</span>
            <select
              required
              value={assignmentForm.groupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text"
            >
              <option value="">Selecione…</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Naipe (opcional)</span>
            <select
              value={assignmentForm.sectionId}
              onChange={(e) => {
                const sectionId = e.target.value;
                const partIds =
                  sectionId && assignmentForm.groupId
                    ? sectionPartIdsByGroup.get(assignmentForm.groupId)?.get(sectionId) ?? []
                    : null;
                const partId =
                  partIds && assignmentForm.partId && partIds.includes(assignmentForm.partId)
                    ? assignmentForm.partId
                    : '';

                setAssignmentForm((prev) => ({ ...prev, sectionId, partId }));
              }}
              disabled={!assignmentForm.groupId}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text disabled:opacity-50"
            >
              <option value="">Nenhum</option>
              {sectionsForSelectedGroup.map((section) => (
                <option key={section.id} value={section.id}>{section.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Parte (opcional)</span>
            <select
              value={assignmentForm.partId}
              onChange={(e) =>
                setAssignmentForm((prev) => ({ ...prev, partId: e.target.value }))
              }
              disabled={assignmentForm.sectionId !== '' && partsForAssignment.length === 0}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text disabled:opacity-50"
            >
              <option value="">Nenhuma</option>
              {partsForAssignment.map((part) => (
                <option key={part.id} value={part.id}>{part.name}</option>
              ))}
            </select>
            {assignmentForm.sectionId && partsForAssignment.length === 0 && (
              <p className="text-xs text-muted">
                Este naipe não tem partes configuradas. Edite o naipe no grupo para adicionar partes.
              </p>
            )}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Papel</span>
            <select
              value={assignmentForm.ensembleRole}
              onChange={(e) =>
                setAssignmentForm((prev) => ({
                  ...prev,
                  ensembleRole: e.target.value as EnsembleRole,
                }))
              }
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text"
            >
              {ENSEMBLE_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {assignmentError && <p className="text-sm text-red-600">{assignmentError}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSavingAssignment || isRemovingAssignment}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isSavingAssignment ? 'Salvando…' : 'Salvar'}
            </button>
            {editingAssignmentId && (
              <button
                type="button"
                disabled={isSavingAssignment || isRemovingAssignment}
                onClick={handleRemoveAssignment}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-red-600 hover:bg-bg disabled:opacity-50"
              >
                {isRemovingAssignment ? 'Removendo…' : 'Remover'}
              </button>
            )}
          </div>
        </form>
      </Modal>

      <Modal open={deleteModalOpen} onClose={closeDeleteModal} title="Excluir músico">
        <p className="text-sm text-muted">
          Esta ação é permanente. Todas as atribuições de{' '}
          <strong className="text-text">{musician.fullName}</strong> serão removidas.
        </p>
        <label className="mt-4 flex flex-col gap-1 text-sm">
          <span className="font-medium text-text">
            Digite <strong>{musicianFirstName}</strong> para confirmar
          </span>
          <input
            type="text"
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
            autoComplete="off"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
          />
        </label>
        {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={isDeleting}
            onClick={closeDeleteModal}
            className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg disabled:opacity-50 sm:w-auto"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isDeleting || !isDeleteConfirmed}
            onClick={handleDeleteMusician}
            className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:w-auto"
          >
            {isDeleting ? 'Excluindo…' : 'Excluir músico'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
