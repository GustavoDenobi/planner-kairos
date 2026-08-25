import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isBrowserOnline } from '@/application/offline/file-cache-use-cases';
import type {
  AssignmentInput,
  AssignmentWithDetails,
  EnsembleRole,
  Group,
  Musician,
  Section,
} from '@/domain/ensemble';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import type { MusicianName } from '@/application/ports/musician-repository';
import type { AccessRole } from '@/domain/identity';
import { canMergeMusicians } from '@/domain/ensemble';
import { useEnsemble, useIdentity, useOffline } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { Modal } from '@/ui/components/Modal';
import { MusicianLinkCopy } from '@/ui/components/MusicianLinkCopy';
import { Tabs } from '@/ui/components/Tabs';
import { BackButton, BackLink } from '@/ui/components/BackButton';
import { IconPencil } from '@/ui/components/icons';
import { ENSEMBLE_ROLE_OPTIONS, ensembleRoleLabel } from '@/ui/features/ensemble/ensemble-labels';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';
import { orgPageContentClass } from '@/ui/layouts/OrgListPageLayout';

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

function adminRoleErrorLabel(error: string): string {
  switch (error) {
    case 'forbidden':
      return 'Apenas administradores podem gerenciar este papel.';
    case 'cannot_manage_self':
      return 'Você não pode alterar o seu próprio papel de administrador aqui.';
    case 'no_linked_user':
      return 'Este músico não possui conta vinculada.';
    case 'membership_not_found':
      return 'Este usuário não pertence à organização.';
    case 'target_is_owner':
      return 'O proprietário da organização não pode ser alterado.';
    case 'already_admin':
      return 'Este usuário já é administrador da organização.';
    case 'not_admin':
      return 'Este usuário não é administrador da organização.';
    default:
      return 'Não foi possível alterar o papel de administrador.';
  }
}

export function MusicianDetailPage() {
  const { orgSlug, musicianId } = useParams();
  const navigate = useNavigate();
  const ensemble = useEnsemble();
  const identity = useIdentity();
  const offline = useOffline();
  const { userId } = useAuth();
  const online = useOnlineStatus();
  const { organizations } = useOrg();
  const org = organizations.find((o) => o.slug === orgSlug);
  const isOfflineReadOnly = !online;

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
  useLoadingBar('musician-detail', isLoading);
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
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [musicianNames, setMusicianNames] = useState<MusicianName[]>([]);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [targetAccessRole, setTargetAccessRole] = useState<AccessRole | null>(null);
  const [isLoadingTargetRole, setIsLoadingTargetRole] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminAction, setAdminAction] = useState<'grant' | 'revoke'>('grant');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [isUpdatingAdmin, setIsUpdatingAdmin] = useState(false);

  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';
  const canEdit = isAdmin && !isOfflineReadOnly;

  useEffect(() => {
    if (!org || !musicianId || !userId) {
      return;
    }

    setIsLoading(true);

    if (!isBrowserOnline()) {
      void Promise.all([
        offline.getCachedMusician(org.id, userId, musicianId),
        offline.listCachedAssignmentsForMusician(org.id, userId, musicianId),
      ]).then(([cachedMusician, cachedAssignments]) => {
        if (cachedMusician) {
          setMusician(cachedMusician);
          setFullName(cachedMusician.fullName);
          setBirthDate(cachedMusician.birthDate ?? '');
          setPhone(cachedMusician.phone ?? '');
          setEmail(cachedMusician.email ?? '');
        } else {
          setMusician(null);
        }
        setAssignments(cachedAssignments);
        setIsLoading(false);
      });
      return;
    }

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
  }, [ensemble, offline, org, musicianId, userId]);

  useEffect(() => {
    if (!org || !musician?.userId || !isAdmin || isOfflineReadOnly) {
      setTargetAccessRole(null);
      setIsLoadingTargetRole(false);
      return;
    }

    let active = true;
    setIsLoadingTargetRole(true);

    identity.getMembershipAccessRole(org.id, musician.userId).then((result) => {
      if (!active) {
        return;
      }

      setTargetAccessRole(result.ok ? result.value : null);
      setIsLoadingTargetRole(false);
    });

    return () => {
      active = false;
    };
  }, [identity, isOfflineReadOnly, org, musician?.userId, isAdmin]);

  useEffect(() => {
    if (!org || !isAdmin || isOfflineReadOnly) {
      setMusicianNames([]);
      return;
    }

    void ensemble.listMusicians(org.id, { limit: 1000, offset: 0 }).then((result) => {
      if (result.ok) {
        setMusicianNames(
          result.value.items.map((item) => ({
            id: item.id,
            fullName: item.fullName,
            userId: item.userId,
          })),
        );
      }
    });
  }, [ensemble, isAdmin, isOfflineReadOnly, org]);

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
        setError('Telefone inválido. Use o formato (XX) XXXXX-XXXX ou similar.');
      } else if (result.error === 'invalid_email') {
        setError('E-mail inválido. Confira se digitou corretamente.');
      } else {
        setError('Não foi possível salvar as alterações. Verifique os campos e tente novamente.');
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

  function openAdminModal(action: 'grant' | 'revoke') {
    setAdminAction(action);
    setAdminError(null);
    setAdminModalOpen(true);
  }

  function closeAdminModal() {
    setAdminModalOpen(false);
    setAdminError(null);
  }

  async function handleAdminRoleChange() {
    if (!org || !musician?.userId || !userId) {
      return;
    }

    setAdminError(null);
    setIsUpdatingAdmin(true);

    const result =
      adminAction === 'grant'
        ? await identity.grantOrgAdmin(userId, org.accessRole, org.id, musician.userId)
        : await identity.revokeOrgAdmin(userId, org.accessRole, org.id, musician.userId);

    setIsUpdatingAdmin(false);

    if (!result.ok) {
      setAdminError(adminRoleErrorLabel(result.error));
      return;
    }

    setTargetAccessRole(adminAction === 'grant' ? 'admin' : 'member');
    closeAdminModal();
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

  function openMergeModal() {
    setMergeTargetId('');
    setMergeError(null);
    setMergeModalOpen(true);
  }

  async function handleMergeMusicians() {
    if (!musician || !mergeTargetId) {
      setMergeError('Selecione o músico que permanecerá.');
      return;
    }

    const target = musicianNames.find((item) => item.id === mergeTargetId);
    if (!target) {
      setMergeError('Músico de destino não encontrado.');
      return;
    }

    const validationError = canMergeMusicians({
      sourceId: musician.id,
      targetId: mergeTargetId,
      sourceUserId: musician.userId,
      targetUserId: target.userId,
    });

    if (validationError === 'same_musician') {
      setMergeError('Selecione um músico diferente.');
      return;
    }

    if (validationError === 'both_have_accounts') {
      setMergeError('Não é possível mesclar dois cadastros que já possuem conta vinculada.');
      return;
    }

    setMergeError(null);
    setIsMerging(true);

    const result = await ensemble.mergeMusicians(org!.id, musician.id, mergeTargetId);

    setIsMerging(false);

    if (!result.ok) {
      if (result.error === 'both_have_accounts') {
        setMergeError('Não é possível mesclar dois cadastros que já possuem conta vinculada.');
      } else {
        setMergeError('Não foi possível mesclar os cadastros.');
      }
      return;
    }

    setMergeModalOpen(false);
    navigate(`/${orgSlug}/musicos/${mergeTargetId}`);
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

  const canManageAdminRole =
    isAdmin &&
    Boolean(musician.userId) &&
    Boolean(userId) &&
    musician.userId !== userId &&
    targetAccessRole !== 'owner';
  const isTargetOwner = targetAccessRole === 'owner';
  const isTargetAdmin = targetAccessRole === 'admin';
  const showAccessRoleSection = isAdmin && Boolean(musician.userId);

  return (
    <div className={orgPageContentClass}>
      <div className="flex items-center gap-2">
        <BackButton fallbackTo={`/${orgSlug}/musicos`} />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-text">{musician.fullName}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                musician.userId
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted/20 text-muted'
              }`}
            >
              {musician.userId ? 'Conta vinculada' : 'Sem conta'}
            </span>
          </div>
          {isOfflineReadOnly && (
            <p className="mt-1 text-sm text-muted">Modo offline — somente leitura</p>
          )}
        </div>
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
                        disabled={!canEdit}
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary disabled:opacity-60"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-text">Data de nascimento</span>
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        disabled={!canEdit}
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary disabled:opacity-60"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-text">Telefone</span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={!canEdit}
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
                        disabled={!canEdit}
                        placeholder="nome@exemplo.com"
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary disabled:opacity-60"
                      />
                    </label>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {canEdit && (
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
                  {!musician.userId && canEdit && (
                    <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                      <div>
                        <h2 className="text-sm font-semibold text-text">Link para cadastro</h2>
                        <p className="mt-1 text-sm text-muted">
                          Envie este link para o músico criar conta e vincular este cadastro.
                        </p>
                      </div>
                      <MusicianLinkCopy musicianId={musician.id} />
                    </div>
                  )}
                  {canEdit && musicianNames.length > 1 && (
                    <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                      <div>
                        <h2 className="text-sm font-semibold text-text">Mesclar músico</h2>
                        <p className="mt-1 text-sm text-muted">
                          Unir este cadastro a outro da organização. As atribuições serão somadas e
                          este registro será removido.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={openMergeModal}
                        className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg md:w-auto"
                      >
                        Mesclar com outro músico
                      </button>
                    </div>
                  )}
                  {showAccessRoleSection && !isOfflineReadOnly && (
                    <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                      <div>
                        <h2 className="text-sm font-semibold text-text">
                          {isTargetOwner ? 'Proprietário da organização' : 'Administrador da organização'}
                        </h2>
                        <p className="mt-1 text-sm text-muted">
                          {isLoadingTargetRole
                            ? 'Carregando permissões…'
                            : isTargetOwner
                              ? 'Este usuário é o proprietário da organização. Esse papel não pode ser alterado.'
                              : isTargetAdmin
                                ? 'Este usuário é administrador e pode gerenciar a organização.'
                                : 'Administradores podem gerenciar músicos, repertório, agenda e demais configurações.'}
                        </p>
                      </div>
                      {canManageAdminRole && !isLoadingTargetRole && (
                        <button
                          type="button"
                          onClick={() => openAdminModal(isTargetAdmin ? 'revoke' : 'grant')}
                          className={
                            isTargetAdmin
                              ? 'rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg'
                              : 'rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90'
                          }
                        >
                          {isTargetAdmin ? 'Remover como administrador' : 'Tornar administrador'}
                        </button>
                      )}
                    </div>
                  )}
                  {canEdit && (
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
                        {canEdit && (
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
                  {canEdit && (
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

      <Modal
        open={adminModalOpen}
        onClose={closeAdminModal}
        title={adminAction === 'grant' ? 'Tornar administrador' : 'Remover como administrador'}
      >
        <p className="text-sm text-muted">
          {adminAction === 'grant' ? (
            <>
              <strong className="text-text">{musician.fullName}</strong> passará a ser administrador
              da organização e poderá gerenciar músicos, repertório, agenda e demais configurações.
            </>
          ) : (
            <>
              <strong className="text-text">{musician.fullName}</strong> deixará de ser administrador
              e voltará a ser membro comum da organização.
            </>
          )}
        </p>
        {adminError && <p className="mt-2 text-sm text-red-600">{adminError}</p>}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={isUpdatingAdmin}
            onClick={closeAdminModal}
            className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg disabled:opacity-50 sm:w-auto"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isUpdatingAdmin}
            onClick={handleAdminRoleChange}
            className={
              adminAction === 'grant'
                ? 'w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:w-auto'
                : 'w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:w-auto'
            }
          >
            {isUpdatingAdmin
              ? 'Salvando…'
              : adminAction === 'grant'
                ? 'Confirmar'
                : 'Remover administrador'}
          </button>
        </div>
      </Modal>

      <Modal
        open={mergeModalOpen}
        onClose={() => {
          if (!isMerging) {
            setMergeModalOpen(false);
          }
        }}
        title="Mesclar músico"
      >
        <p className="text-sm text-muted">
          O cadastro de <strong className="text-text">{musician.fullName}</strong> será unido ao
          músico selecionado abaixo e removido em seguida.
        </p>
        {musician.userId && (
          <p className="mt-2 text-sm text-amber-700">
            Este cadastro possui conta vinculada. A conta será transferida para o destino, se
            aplicável.
          </p>
        )}
        <label className="mt-4 flex flex-col gap-1 text-sm">
          <span className="font-medium text-text">Manter cadastro de</span>
          <select
            value={mergeTargetId}
            onChange={(e) => setMergeTargetId(e.target.value)}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-text"
          >
            <option value="">Selecione…</option>
            {musicianNames
              .filter((item) => item.id !== musician.id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName}
                  {item.userId ? ' (com conta)' : ' (sem conta)'}
                </option>
              ))}
          </select>
        </label>
        {mergeError && <p className="mt-2 text-sm text-red-600">{mergeError}</p>}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={isMerging}
            onClick={() => setMergeModalOpen(false)}
            className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg disabled:opacity-50 sm:w-auto"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isMerging || !mergeTargetId}
            onClick={handleMergeMusicians}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:w-auto"
          >
            {isMerging ? 'Mesclando…' : 'Confirmar mesclagem'}
          </button>
        </div>
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
