import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { isBrowserOnline } from '@/application/offline/file-cache-use-cases';
import type { GroupInviteListItem } from '@/domain/identity';
import { isGroupInviteExhausted } from '@/domain/identity';
import {
  normalizePhone,
  type AssignmentInput,
  type EnsembleRole,
  type Group,
  type GroupAssignmentListItem,
  type GroupKind,
  type Section,
  type SectionListItem,
} from '@/domain/ensemble';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import { useEnsemble } from '@/ui/app/AppServicesContext';
import { useIdentity, useOffline } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { InviteLinkCopy } from '@/ui/components/InviteLinkCopy';
import { Modal } from '@/ui/components/Modal';
import { SortableDragHandle, SortableList } from '@/ui/components/SortableList';
import { Tabs } from '@/ui/components/Tabs';
import { BackButton, BackLink } from '@/ui/components/BackButton';
import { IconExternalLink, IconPencil, IconUsers, IconWhatsApp } from '@/ui/components/icons';
import { ENSEMBLE_ROLE_OPTIONS, ensembleRoleLabel } from '@/ui/features/ensemble/ensemble-labels';
import { GROUP_KIND_OPTIONS } from '@/ui/features/ensemble/group-labels';
import { GroupFileAccessSettingsForm } from '@/ui/features/repertoire/PieceAccessSettingsFields';
import type { PieceFileAccessScope } from '@/domain/repertoire';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';
import { orgPageContentClass } from '@/ui/layouts/OrgListPageLayout';
function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function fromDateInputValue(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59);
}
function isInviteActive(invite: GroupInviteListItem): boolean {
  const now = new Date();
  return (
    !invite.revokedAt &&
    invite.expiresAt >= now &&
    !isGroupInviteExhausted(invite.maxUses, invite.useCount)
  );
}

function isInviteEditable(invite: GroupInviteListItem): boolean {
  return !invite.revokedAt;
}

function inviteUsageLabel(invite: GroupInviteListItem): string {
  if (invite.maxUses === 0) {
    if (invite.useCount === 0) {
      return 'Nenhum uso · ilimitado';
    }
    return `${invite.useCount} uso${invite.useCount === 1 ? '' : 's'} · ilimitado`;
  }
  return `${invite.useCount} / ${invite.maxUses} uso${invite.maxUses === 1 ? '' : 's'}`;
}

function defaultCreateInviteExpiresAt(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt;
}

type AssignmentFormState = {
  sectionId: string;
  partId: string;
  ensembleRole: EnsembleRole;
};

const emptyAssignmentForm = (): AssignmentFormState => ({
  sectionId: '',
  partId: '',
  ensembleRole: 'member',
});

function assignmentDetailsLabel(assignment: GroupAssignmentListItem): string {
  return [
    ensembleRoleLabel(assignment.ensembleRole),
    assignment.sectionName,
    assignment.partName,
  ]
    .filter(Boolean)
    .join(' · ');
}

function musicianWhatsAppUrl(phone: string | null): string | null {
  if (!phone) {
    return null;
  }
  const digits = normalizePhone(phone);
  if (digits.length === 0) {
    return null;
  }
  return `https://wa.me/55${digits}`;
}
export function GroupDetailPage() {
  const { orgSlug, groupId } = useParams();
  const ensemble = useEnsemble();
  const identity = useIdentity();
  const offline = useOffline();
  const { userId } = useAuth();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const { organizations } = useOrg();
  const org = organizations.find((o) => o.slug === orgSlug);
  const [group, setGroup] = useState<Group | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<GroupKind>('ensemble');
  const [notes, setNotes] = useState('');
  const [invites, setInvites] = useState<GroupInviteListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useLoadingBar('group-detail', isLoading);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [createInviteModalOpen, setCreateInviteModalOpen] = useState(false);
  const [createInviteExpiresAt, setCreateInviteExpiresAt] = useState(() =>
    toDateInputValue(defaultCreateInviteExpiresAt()),
  );
  const [createInviteMaxUses, setCreateInviteMaxUses] = useState('0');
  const [expandedInviteIds, setExpandedInviteIds] = useState<Record<string, boolean>>({});
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [updatingInviteId, setUpdatingInviteId] = useState<string | null>(null);
  const [sections, setSections] = useState<SectionListItem[]>([]);
  const [orgParts, setOrgParts] = useState<PartWithDivisions[]>([]);
  const [sectionPartIds, setSectionPartIds] = useState<string[]>([]);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionName, setSectionName] = useState('');
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [isDeletingSection, setIsDeletingSection] = useState(false);
  const [isReorderingSections, setIsReorderingSections] = useState(false);
  const [assignments, setAssignments] = useState<GroupAssignmentListItem[]>([]);
  const [assignmentSectionPartIds, setAssignmentSectionPartIds] = useState<Map<string, string[]>>(
    new Map(),
  );
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<GroupAssignmentListItem | null>(null);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>(emptyAssignmentForm);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [isRemovingAssignment, setIsRemovingAssignment] = useState(false);
  const [fileAccessScope, setFileAccessScope] = useState<PieceFileAccessScope>('own_parts');
  const [allowFileDownload, setAllowFileDownload] = useState(true);
  const [allowPieceAccessOverride, setAllowPieceAccessOverride] = useState(true);
  const [isSavingFileAccess, setIsSavingFileAccess] = useState(false);
  const [fileAccessError, setFileAccessError] = useState<string | null>(null);
  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';
  const isOfflineReadOnly = !online;
  const canEdit = isAdmin && !isOfflineReadOnly;
  const isArchived = group?.archivedAt !== null && group?.archivedAt !== undefined;

  useEffect(() => {
    if (!org || !groupId || !userId) {
      return;
    }

    setIsLoading(true);

    if (!isBrowserOnline()) {
      void Promise.all([
        offline.getCachedGroup(org.id, userId, groupId),
        offline.listCachedSectionsForGroup(org.id, userId, groupId),
        offline.getCachedMusiciansFilterData(org.id, userId),
        offline.listCachedAssignmentsForGroup(org.id, userId, groupId),
        offline.getCachedSectionPartIdsByGroup(org.id, userId, groupId),
      ]).then(([cachedGroup, cachedSections, filterData, cachedAssignments, partIdsMap]) => {
        if (cachedGroup) {
          setGroup(cachedGroup);
          setName(cachedGroup.name);
        setKind(cachedGroup.kind);
        setNotes(cachedGroup.notes ?? '');
        setFileAccessScope(cachedGroup.fileAccessScope);
        setAllowFileDownload(cachedGroup.allowFileDownload);
        setAllowPieceAccessOverride(cachedGroup.allowPieceAccessOverride);
        } else {
          setGroup(null);
        }
        setSections(cachedSections);
        setOrgParts(filterData?.parts ?? []);
        setAssignments(cachedAssignments);
        setAssignmentSectionPartIds(partIdsMap);
        setInvites([]);
        setIsLoading(false);
      });
      return;
    }

    ensemble.getGroup(org.id, groupId).then((result) => {
      if (result.ok) {
        setGroup(result.value);
        setName(result.value.name);
        setKind(result.value.kind);
        setNotes(result.value.notes ?? '');
        setFileAccessScope(result.value.fileAccessScope);
        setAllowFileDownload(result.value.allowFileDownload);
        setAllowPieceAccessOverride(result.value.allowPieceAccessOverride);
      }
      setIsLoading(false);
    });
    identity.listGroupInvites(org.id).then((result) => {
      if (result.ok) {
        setInvites(result.value.filter((i) => i.groupId === groupId));
      }
    });
    ensemble.listSections(org.id, groupId).then((result) => {
      if (result.ok) {
        setSections(result.value);
      }
    });
    ensemble.listParts(org.id).then((result) => {
      if (result.ok) {
        setOrgParts(result.value);
      }
    });
    ensemble.listAssignmentsForGroup(org.id, groupId).then((result) => {
      if (result.ok) {
        setAssignments(result.value);
      }
    });
    ensemble.listSectionPartIdsByGroup(org.id, groupId).then((result) => {
      if (result.ok) {
        setAssignmentSectionPartIds(result.value);
      }
    });
  }, [ensemble, identity, offline, org, groupId, userId]);
  async function refreshInvites() {
    const listResult = await identity.listGroupInvites(org!.id);
    if (listResult.ok) {
      setInvites(listResult.value.filter((i) => i.groupId === group!.id));
    }
  }
  async function refreshSections() {
    const [sectionsResult, partIdsResult] = await Promise.all([
      ensemble.listSections(org!.id, group!.id),
      ensemble.listSectionPartIdsByGroup(org!.id, group!.id),
    ]);
    if (sectionsResult.ok) {
      setSections(sectionsResult.value);
    }
    if (partIdsResult.ok) {
      setAssignmentSectionPartIds(partIdsResult.value);
    }
  }

  async function refreshAssignments() {
    const result = await ensemble.listAssignmentsForGroup(org!.id, group!.id);
    if (result.ok) {
      setAssignments(result.value);
    }
  }
  function resetSectionForm() {
    setEditingSectionId(null);
    setSectionName('');
    setSectionPartIds([]);
    setSectionError(null);
  }

  function openCreateSectionModal() {
    resetSectionForm();
    setSectionModalOpen(true);
  }

  async function openEditSectionModal(section: Section) {
    setEditingSectionId(section.id);
    setSectionName(section.name);
    setSectionError(null);
    setSectionModalOpen(true);

    const result = await ensemble.listSectionPartIds(org!.id, section.id);
    if (result.ok) {
      setSectionPartIds(result.value);
    } else {
      setSectionPartIds([]);
    }
  }

  function toggleSectionPart(partId: string) {
    setSectionPartIds((prev) =>
      prev.includes(partId) ? prev.filter((id) => id !== partId) : [...prev, partId],
    );
  }

  function closeSectionModal() {
    if (isSavingSection || isDeletingSection) {
      return;
    }
    setSectionModalOpen(false);
    setSectionError(null);
  }

  async function handleSubmitSection(event: React.FormEvent) {
    event.preventDefault();
    setSectionError(null);
    setIsSavingSection(true);

    const input = { name: sectionName, partIds: sectionPartIds };

    const result = editingSectionId
      ? await ensemble.updateSection(org!.id, editingSectionId, input)
      : await ensemble.registerSection(org!.id, group!.id, input);

    setIsSavingSection(false);

    if (!result.ok) {
      setSectionError(
        editingSectionId
          ? 'Não foi possível salvar o naipe.'
          : 'Não foi possível adicionar o naipe.',
      );
      return;
    }

    setSectionModalOpen(false);
    resetSectionForm();
    await refreshSections();
  }

  async function handleDeleteSection() {
    if (!editingSectionId) {
      return;
    }

    setSectionError(null);
    setIsDeletingSection(true);

    const result = await ensemble.removeSection(org!.id, editingSectionId);

    setIsDeletingSection(false);

    if (!result.ok) {
      setSectionError('Não foi possível remover o naipe.');
      return;
    }

    setSectionModalOpen(false);
    resetSectionForm();
    await refreshSections();
  }
  async function handleReorderSections(reordered: SectionListItem[]) {
    const previous = sections;
    setSections(reordered);
    setSectionError(null);
    setIsReorderingSections(true);

    const result = await ensemble.reorderSections(
      org!.id,
      groupId!,
      reordered.map((section) => section.id),
    );

    setIsReorderingSections(false);

    if (!result.ok) {
      setSections(previous);
      setSectionError('Não foi possível reordenar os naipes.');
    }
  }

  function openEditAssignmentModal(assignment: GroupAssignmentListItem) {
    setEditingAssignment(assignment);
    setAssignmentForm({
      sectionId: assignment.sectionId ?? '',
      partId: assignment.partId ?? '',
      ensembleRole: assignment.ensembleRole,
    });
    setAssignmentError(null);
    setIsRemovingAssignment(false);
    setAssignmentModalOpen(true);
  }

  function closeAssignmentModal() {
    if (isSavingAssignment || isRemovingAssignment) {
      return;
    }
    setAssignmentModalOpen(false);
    setEditingAssignment(null);
    setAssignmentError(null);
  }

  async function handleSaveAssignment(event: React.FormEvent) {
    event.preventDefault();
    if (!editingAssignment) {
      return;
    }

    setAssignmentError(null);
    setIsSavingAssignment(true);

    const input: AssignmentInput = {
      groupId: group!.id,
      sectionId: assignmentForm.sectionId || null,
      partId: assignmentForm.partId || null,
      ensembleRole: assignmentForm.ensembleRole,
    };

    const result = await ensemble.updateAssignment(org!.id, editingAssignment.id, input);

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
    setEditingAssignment(null);
    await Promise.all([refreshAssignments(), refreshSections()]);
  }

  async function handleRemoveAssignment() {
    if (!editingAssignment) {
      return;
    }

    setAssignmentError(null);
    setIsRemovingAssignment(true);

    const result = await ensemble.removeAssignment(org!.id, editingAssignment.id);

    setIsRemovingAssignment(false);

    if (!result.ok) {
      setAssignmentError('Não foi possível remover a atribuição.');
      return;
    }

    setAssignmentModalOpen(false);
    setEditingAssignment(null);
    await Promise.all([refreshAssignments(), refreshSections()]);
  }

  if (!org || !groupId) {
    return null;
  }
  if (!isAdmin) {
    return <div className="text-muted">Acesso restrito a administradores.</div>;
  }
  if (isLoading) {
    return <div className="text-muted">Carregando…</div>;
  }
  if (!group) {
    return (
      <div>
        <p className="text-muted">Grupo não encontrado.</p>
        <BackLink
          fallbackTo={`/${orgSlug}/grupos`}
          className="mt-2 text-sm text-primary hover:underline"
        >
          Voltar aos grupos
        </BackLink>
      </div>
    );
  }
  async function handleSave() {
    setError(null);
    setIsSaving(true);
    const result = await ensemble.updateGroup(org!.id, group!.id, {
      name,
      kind,
      notes: notes || null,
    });
    setIsSaving(false);
    if (!result.ok) {
      setError('Não foi possível salvar as alterações. Verifique os campos e tente novamente.');
      return;
    }
    setGroup(result.value);
  }

  async function handleSaveFileAccess() {
    setFileAccessError(null);
    setIsSavingFileAccess(true);
    const result = await ensemble.updateGroupFileAccessSettings(org!.id, group!.id, {
      fileAccessScope,
      allowFileDownload,
      allowPieceAccessOverride,
    });
    setIsSavingFileAccess(false);
    if (!result.ok) {
      setFileAccessError('Não foi possível salvar as configurações de acesso.');
      return;
    }
    setGroup(result.value);
  }

  function openArchiveModal() {
    setArchiveError(null);
    setArchiveOpen(true);
  }
  function closeArchiveModal() {
    if (isArchiving) {
      return;
    }
    setArchiveOpen(false);
    setArchiveError(null);
  }
  async function handleArchive() {
    setArchiveError(null);
    setIsArchiving(true);
    const result = await ensemble.archiveGroup(org!.id, group!.id);
    setIsArchiving(false);
    if (!result.ok) {
      setArchiveError('Não foi possível arquivar o grupo.');
      return;
    }
    setArchiveOpen(false);
    navigate(`/${orgSlug}/grupos`);
  }
  async function handleRestore() {
    setArchiveError(null);
    setIsRestoring(true);
    const result = await ensemble.restoreGroup(org!.id, group!.id);
    setIsRestoring(false);
    if (!result.ok) {
      setArchiveError('Não foi possível restaurar o grupo.');
      return;
    }
    setGroup(result.value);
    setArchiveError(null);
  }
  function inviteErrorMessage(code: string) {
    const normalized = code.toLowerCase();
    if (normalized.includes('forbidden')) {
      return 'Sem permissão para gerar convites nesta organização.';
    }
    if (normalized.includes('group_not_found')) {
      return 'Grupo não encontrado.';
    }
    if (normalized.includes('group_archived')) {
      return 'Não é possível gerar convites para um grupo arquivado.';
    }
    if (normalized.includes('not_authenticated')) {
      return 'Faça login novamente para gerar convites.';
    }
    if (normalized.includes('invalid_expires_at')) {
      return 'A data de expiração deve ser no futuro.';
    }
    if (normalized.includes('invite_not_editable')) {
      return 'Este convite não pode ser editado.';
    }
    if (normalized.includes('invalid_max_uses')) {
      return 'O limite de usos deve ser zero ou maior.';
    }
    if (normalized.includes('max_uses_below_use_count')) {
      return 'O limite não pode ser menor que a quantidade já utilizada.';
    }
    if (normalized.includes('gen_random_bytes') || normalized.includes('digest')) {
      return 'Erro no servidor ao gerar o token do convite. Aplique as migrations do Supabase (db reset ou db push).';
    }
    return `Não foi possível gerar o convite. (${code})`;
  }
  function resetCreateInviteForm() {
    setCreateInviteExpiresAt(toDateInputValue(defaultCreateInviteExpiresAt()));
    setCreateInviteMaxUses('0');
    setInviteError(null);
  }

  function openCreateInviteModal() {
    resetCreateInviteForm();
    setCreateInviteModalOpen(true);
  }

  function closeCreateInviteModal() {
    if (isCreatingInvite) {
      return;
    }
    setCreateInviteModalOpen(false);
    setInviteError(null);
  }

  async function handleCreateInvite(event: React.FormEvent) {
    event.preventDefault();
    setInviteError(null);
    setIsCreatingInvite(true);

    const maxUses = createInviteMaxUses.trim() === '' ? 0 : Number(createInviteMaxUses);
    if (!Number.isInteger(maxUses) || maxUses < 0) {
      setIsCreatingInvite(false);
      setInviteError('Informe um limite de usos válido (0 = ilimitado).');
      return;
    }

    const result = await identity.createGroupInvite(
      group!.id,
      fromDateInputValue(createInviteExpiresAt),
      maxUses,
    );
    setIsCreatingInvite(false);
    if (!result.ok) {
      console.error('createGroupInvite failed:', result.error);
      setInviteError(inviteErrorMessage(result.error));
      return;
    }
    setCreateInviteModalOpen(false);
    resetCreateInviteForm();
    await refreshInvites();
  }
  async function handleRevoke(inviteId: string) {
    const result = await identity.revokeGroupInvite(inviteId);
    if (!result.ok) {
      setInviteError('Não foi possível revogar o convite.');
      return;
    }
    await refreshInvites();
  }
  async function handleExpiresChange(inviteId: string, value: string) {
    if (!value) {
      return;
    }
    setInviteError(null);
    setUpdatingInviteId(inviteId);
    const result = await identity.updateGroupInviteExpires(inviteId, fromDateInputValue(value));
    setUpdatingInviteId(null);
    if (!result.ok) {
      setInviteError(inviteErrorMessage(result.error));
      return;
    }
    await refreshInvites();
  }
  async function handleMaxUsesChange(
    inviteId: string,
    value: string,
    currentUseCount: number,
    currentMaxUses: number,
  ) {
    if (value.trim() === '') {
      return;
    }

    const maxUses = Number(value);
    if (!Number.isInteger(maxUses) || maxUses < 0) {
      setInviteError('Informe um limite de usos válido (0 = ilimitado).');
      return;
    }

    if (maxUses === currentMaxUses) {
      return;
    }

    if (maxUses > 0 && maxUses < currentUseCount) {
      setInviteError('O limite não pode ser menor que a quantidade já utilizada.');
      return;
    }

    setInviteError(null);
    setUpdatingInviteId(inviteId);
    const result = await identity.updateGroupInviteMaxUses(inviteId, maxUses);
    setUpdatingInviteId(null);
    if (!result.ok) {
      setInviteError(inviteErrorMessage(result.error));
      return;
    }
    await refreshInvites();
  }

  function toggleInviteMusicians(inviteId: string) {
    setExpandedInviteIds((current) => ({
      ...current,
      [inviteId]: !current[inviteId],
    }));
  }

  function statusLabel(invite: GroupInviteListItem) {
    if (invite.revokedAt) return 'Link desativado';
    if (invite.expiresAt < new Date()) return 'Expirado';
    if (isGroupInviteExhausted(invite.maxUses, invite.useCount)) return 'Esgotado';
    return 'Ativo';
  }

  const assignmentPartIds = assignmentForm.sectionId
    ? assignmentSectionPartIds.get(assignmentForm.sectionId) ?? []
    : null;
  const partsForAssignment =
    assignmentPartIds !== null
      ? orgParts.filter((part) => assignmentPartIds.includes(part.id))
      : orgParts;

  return (
    <div className={orgPageContentClass}>
      <div className="flex items-center gap-2">
        <BackButton fallbackTo={`/${orgSlug}/grupos`} />
        <div>
          <h1 className={`text-2xl font-semibold ${isArchived ? 'text-muted' : 'text-text'}`}>
            {group.name}
          </h1>
          {isOfflineReadOnly && (
            <p className="mt-1 text-sm text-muted">Modo offline — somente leitura</p>
          )}
        </div>
      </div>
      {isArchived && group.archivedAt && (
        <p className="mt-3 text-sm text-muted">
          Arquivado em {group.archivedAt.toLocaleDateString('pt-BR')}. Este grupo não está disponível para novos músicos.
        </p>
      )}
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
                      <span className="font-medium text-text">Nome</span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={!canEdit}
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary disabled:opacity-60"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-text">Tipo</span>
                      <select
                        value={kind}
                        onChange={(e) => setKind(e.target.value as GroupKind)}
                        disabled={!canEdit}
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary disabled:opacity-60"
                      >
                        {GROUP_KIND_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-text">Observações</span>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={!canEdit}
                        rows={3}
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
                  <div className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
                    <h2 className="text-base font-semibold text-text">
                      Acesso a arquivos de repertório
                    </h2>
                    <GroupFileAccessSettingsForm
                      fileAccessScope={fileAccessScope}
                      allowFileDownload={allowFileDownload}
                      allowPieceAccessOverride={allowPieceAccessOverride}
                      onFileAccessScopeChange={setFileAccessScope}
                      onAllowFileDownloadChange={setAllowFileDownload}
                      onAllowPieceAccessOverrideChange={setAllowPieceAccessOverride}
                      disabled={!canEdit}
                    />
                    {fileAccessError && <p className="text-sm text-red-600">{fileAccessError}</p>}
                    {canEdit && (
                      <button
                        type="button"
                        disabled={isSavingFileAccess}
                        onClick={() => void handleSaveFileAccess()}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {isSavingFileAccess ? 'Salvando…' : 'Salvar acesso'}
                      </button>
                    )}
                  </div>
                  {canEdit && (
                  <div className="mt-8 flex w-full md:justify-end">
                    {isArchived ? (
                      <button
                        type="button"
                        disabled={isRestoring}
                        onClick={handleRestore}
                        className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg disabled:opacity-50 md:w-auto"
                      >
                        {isRestoring ? 'Restaurando…' : 'Restaurar grupo'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={openArchiveModal}
                        className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-bg hover:text-text md:w-auto"
                      >
                        Arquivar grupo
                      </button>
                    )}
                  </div>
                  )}
                  {archiveError && !archiveOpen && (
                    <p className="mt-2 text-right text-sm text-red-600">{archiveError}</p>
                  )}
                </>
              ),
            },
            {
              id: 'integrantes',
              label: 'Integrantes',
              content: (
                <>
                  {assignments.length === 0 ? (
                    <p className="text-sm text-muted">Nenhum integrante neste grupo.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {assignments.map((assignment) => {
                        const whatsappUrl = musicianWhatsAppUrl(assignment.musicianPhone);

                        return (
                        <li
                          key={assignment.id}
                          className="flex items-center gap-2 rounded-lg border border-border bg-surface py-3 pr-4 pl-4 text-sm"
                        >
                          <Link
                            to={`/${orgSlug}/musicos/${assignment.musicianId}`}
                            className="min-w-0 flex-1 rounded-lg"
                          >
                            <p className="font-medium text-text hover:underline">
                              {assignment.musicianName}
                            </p>
                            <p className="mt-0.5 text-muted">
                              {assignmentDetailsLabel(assignment)}
                            </p>
                          </Link>
                          {whatsappUrl && (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Abrir WhatsApp de ${assignment.musicianName}`}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#25D366] text-white transition-opacity hover:opacity-90"
                            >
                              <IconWhatsApp className="h-4 w-4" />
                            </a>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEditAssignmentModal(assignment)}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-bg hover:text-text"
                              aria-label={`Editar atribuição de ${assignment.musicianName}`}
                            >
                              <IconPencil className="h-4 w-4" />
                            </button>
                          )}
                        </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              ),
            },
            {
              id: 'naipes',
              label: 'Naipes',
              content: (
                <>
                  {canEdit && (
                    <div className="mb-4 flex justify-end">
                      <button
                        type="button"
                        onClick={openCreateSectionModal}
                        className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                      >
                        + Naipe
                      </button>
                    </div>
                  )}
                  {sections.length === 0 ? (
                    <p className="text-sm text-muted">Nenhum naipe cadastrado.</p>
                  ) : canEdit ? (
                    <SortableList
                      items={sections}
                      onReorder={handleReorderSections}
                      disabled={isReorderingSections}
                      ariaLabel="Naipes"
                      className="flex flex-col gap-2"
                      renderItem={(section, handle) => (
                        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface py-3 pr-4 pl-1.5 text-sm">
                          <SortableDragHandle {...handle} label={`Reordenar ${section.name}`} />
                          <span className="min-w-0 flex-1 font-medium text-text">{section.name}</span>
                          <span className="flex shrink-0 items-center gap-1 text-sm text-muted mr-2">
                            <IconUsers className="h-4 w-4" />
                            {section.memberCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditSectionModal(section)}
                            className="flex shrink-0 items-center justify-center rounded-lg border border-border p-2 text-muted transition-colors hover:bg-bg hover:text-text"
                            aria-label={`Editar ${section.name}`}
                          >
                            <IconPencil className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    />
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {sections.map((section) => (
                        <li
                          key={section.id}
                          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
                        >
                          <span className="min-w-0 flex-1 font-medium text-text">{section.name}</span>
                          <span className="flex shrink-0 items-center gap-1 text-sm text-muted">
                            <IconUsers className="h-4 w-4" />
                            {section.memberCount}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {sectionError && !sectionModalOpen && (
                    <p className="mt-2 text-sm text-red-600">{sectionError}</p>
                  )}
                </>
              ),
            },
            {
              id: 'convites',
              label: 'Convites',
              content: isOfflineReadOnly ? (
                <p className="text-sm text-muted">Convites não disponíveis offline.</p>
              ) : (
                <>
                  {!isArchived && (
                    <div className="mb-4 flex justify-end">
                      <button
                        type="button"
                        onClick={openCreateInviteModal}
                        className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                      >
                        + Link
                      </button>
                    </div>
                  )}
                  {inviteError && !createInviteModalOpen && (
                    <p className="mb-4 text-sm text-red-600">{inviteError}</p>
                  )}
                  <ul className="flex flex-col gap-2">
                    {invites.map((invite) => {
                      const active = isInviteActive(invite);
                      const editable = isInviteEditable(invite);
                      const revoked = Boolean(invite.revokedAt);
                      const musiciansExpanded = Boolean(expandedInviteIds[invite.id]);
                      return (
                        <li
                          key={invite.id}
                          className={`flex flex-col gap-3 rounded-lg border border-border px-4 py-3 text-sm ${
                            revoked ? 'bg-bg text-muted' : 'bg-surface'
                          }`}
                        >
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <p className={`font-medium ${revoked ? 'text-muted' : 'text-text'}`}>
                              {statusLabel(invite)}
                            </p>
                            <p className="text-muted">{inviteUsageLabel(invite)}</p>
                          </div>
                          {invite.token && !revoked && <InviteLinkCopy token={invite.token} />}
                          {invite.token && revoked && (
                            <input
                              type="text"
                              readOnly
                              value={`${window.location.origin}/convite/${invite.token}`}
                              className="min-w-0 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-muted"
                            />
                          )}
                          {editable ? (
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col gap-2">
                                <span className="text-muted">Expira em</span>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                  <input
                                    type="date"
                                    value={toDateInputValue(invite.expiresAt)}
                                    disabled={updatingInviteId === invite.id}
                                    onChange={(e) => handleExpiresChange(invite.id, e.target.value)}
                                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary disabled:opacity-50 sm:w-auto"
                                  />
                                  {active && (
                                    <button
                                      type="button"
                                      onClick={() => handleRevoke(invite.id)}
                                      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-bg"
                                    >
                                      Desativar
                                    </button>
                                  )}
                                </div>
                              </div>
                              <label className="flex flex-col gap-1">
                                <span className="text-muted">Limite de usos (0 = ilimitado)</span>
                                <input
                                  type="number"
                                  min={invite.useCount}
                                  step={1}
                                  defaultValue={invite.maxUses}
                                  key={`${invite.id}-${invite.maxUses}`}
                                  disabled={updatingInviteId === invite.id}
                                  onBlur={(e) =>
                                    handleMaxUsesChange(
                                      invite.id,
                                      e.target.value,
                                      invite.useCount,
                                      invite.maxUses,
                                    )
                                  }
                                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary disabled:opacity-50 sm:max-w-[12rem]"
                                />
                              </label>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1 text-muted">
                              <p>Expira em {invite.expiresAt.toLocaleDateString('pt-BR')}</p>
                              <p>Limite: {invite.maxUses === 0 ? 'ilimitado' : invite.maxUses}</p>
                            </div>
                          )}
                          {invite.useCount > 0 && (
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => toggleInviteMusicians(invite.id)}
                                aria-expanded={musiciansExpanded}
                                className="self-start text-sm font-medium text-primary hover:underline"
                              >
                                {musiciansExpanded
                                  ? 'Ocultar inscritos'
                                  : `Ver ${invite.useCount} inscrito${invite.useCount === 1 ? '' : 's'}`}
                              </button>
                              {musiciansExpanded && (
                                <ul className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3">
                                  {invite.redeemedMusicians.map((musician) => (
                                    <li
                                      key={musician.id}
                                      className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0"
                                    >
                                      <div className="min-w-0 flex flex-col gap-0.5">
                                        <span className="font-medium text-text">{musician.fullName}</span>
                                        {musician.email && (
                                          <span className="text-muted">{musician.email}</span>
                                        )}
                                        <span className="text-xs text-muted">
                                          {musician.createdAt.toLocaleDateString('pt-BR')}
                                        </span>
                                      </div>
                                      <Link
                                        to={`/${orgSlug}/musicos/${musician.id}`}
                                        aria-label={`Abrir ${musician.fullName}`}
                                        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border p-2 text-muted transition-colors hover:bg-surface hover:text-text"
                                      >
                                        <IconExternalLink className="h-4 w-4" />
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                    {invites.length === 0 && (
                      <p className="text-sm text-muted">Nenhum convite para este grupo.</p>
                    )}
                  </ul>
                </>
              ),
            },
          ]}
        />
      </div>
      <Modal
        open={sectionModalOpen}
        onClose={closeSectionModal}
        title={editingSectionId ? 'Editar naipe' : 'Novo naipe'}
      >
        <form className="flex flex-col gap-4" onSubmit={handleSubmitSection}>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Nome do naipe</span>
            <input
              type="text"
              required
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
          {orgParts.length > 0 && (
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="font-medium text-text">Partes do naipe</legend>
              <p className="text-muted">
                Selecione as partes que pertencem a este naipe. Usado para validar atribuições de músicos.
              </p>
              <ul className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3">
                {orgParts.map((part) => (
                  <li key={part.id}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sectionPartIds.includes(part.id)}
                        onChange={() => toggleSectionPart(part.id)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-text">{part.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          {sectionError && <p className="text-sm text-red-600">{sectionError}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSavingSection || isDeletingSection}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isSavingSection
                ? 'Salvando…'
                : editingSectionId
                  ? 'Salvar'
                  : 'Adicionar naipe'}
            </button>
            {editingSectionId && (
              <button
                type="button"
                disabled={isSavingSection || isDeletingSection}
                onClick={handleDeleteSection}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-red-600 hover:bg-bg disabled:opacity-50"
              >
                {isDeletingSection ? 'Excluindo…' : 'Excluir'}
              </button>
            )}
          </div>
        </form>
      </Modal>
      <Modal
        open={assignmentModalOpen}
        onClose={closeAssignmentModal}
        title="Editar atribuição"
      >
        <form className="flex flex-col gap-4" onSubmit={handleSaveAssignment}>
          {editingAssignment && (
            <p className="text-sm text-muted">
              <span className="font-medium text-text">{editingAssignment.musicianName}</span>
              {' · '}
              {group.name}
            </p>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Naipe (opcional)</span>
            <select
              value={assignmentForm.sectionId}
              onChange={(e) => {
                const sectionId = e.target.value;
                const partIds = sectionId
                  ? assignmentSectionPartIds.get(sectionId) ?? []
                  : null;
                const partId =
                  partIds && assignmentForm.partId && partIds.includes(assignmentForm.partId)
                    ? assignmentForm.partId
                    : '';

                setAssignmentForm((prev) => ({ ...prev, sectionId, partId }));
              }}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text"
            >
              <option value="">Nenhum</option>
              {sections.map((section) => (
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
            <button
              type="button"
              disabled={isSavingAssignment || isRemovingAssignment}
              onClick={handleRemoveAssignment}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-red-600 hover:bg-bg disabled:opacity-50"
            >
              {isRemovingAssignment ? 'Removendo…' : 'Remover'}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={createInviteModalOpen}
        onClose={closeCreateInviteModal}
        title="Novo convite"
      >
        <form className="flex flex-col gap-4" onSubmit={handleCreateInvite}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text">Expira em</span>
              <input
                type="date"
                required
                value={createInviteExpiresAt}
                onChange={(e) => setCreateInviteExpiresAt(e.target.value)}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text">Limite de usos (0 = ilimitado)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={createInviteMaxUses}
                onChange={(e) => setCreateInviteMaxUses(e.target.value)}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
              />
            </label>
          </div>
          {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isCreatingInvite}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isCreatingInvite ? 'Gerando…' : 'Gerar link'}
            </button>
            <button
              type="button"
              disabled={isCreatingInvite}
              onClick={closeCreateInviteModal}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
      <Modal open={archiveOpen} onClose={closeArchiveModal} title="Arquivar grupo">
        <p className="text-sm text-muted">
          O grupo &nbsp;<strong className="text-text">{group.name}</strong>&nbsp; sairá da listagem padrão e não
          aceitará novos músicos via convite. Os dados e músicos atuais serão mantidos. Você poderá
          restaurá-lo depois.
        </p>
        {archiveError && <p className="mt-2 text-sm text-red-600">{archiveError}</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={isArchiving}
            onClick={closeArchiveModal}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isArchiving}
            onClick={handleArchive}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isArchiving ? 'Arquivando…' : 'Arquivar grupo'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
