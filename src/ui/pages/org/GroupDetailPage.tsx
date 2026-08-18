import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { GroupInviteListItem } from '@/domain/identity';
import type { Group, GroupKind, Section, SectionListItem } from '@/domain/ensemble';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import { useEnsemble } from '@/ui/app/AppServicesContext';
import { useIdentity } from '@/ui/app/AppServicesContext';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { InviteLinkCopy } from '@/ui/components/InviteLinkCopy';
import { Modal } from '@/ui/components/Modal';
import { SortableDragHandle, SortableList } from '@/ui/components/SortableList';
import { Tabs } from '@/ui/components/Tabs';
import { BackButton, BackLink } from '@/ui/components/BackButton';
import { IconPencil, IconUsers } from '@/ui/components/icons';
import { GROUP_KIND_OPTIONS } from '@/ui/features/ensemble/group-labels';
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
  return !invite.redeemedAt && !invite.revokedAt && invite.expiresAt >= new Date();
}
export function GroupDetailPage() {
  const { orgSlug, groupId } = useParams();
  const ensemble = useEnsemble();
  const identity = useIdentity();
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
  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';
  const isArchived = group?.archivedAt !== null && group?.archivedAt !== undefined;
  useEffect(() => {
    if (!org || !groupId) {
      return;
    }
    setIsLoading(true);
    ensemble.getGroup(org.id, groupId).then((result) => {
      if (result.ok) {
        setGroup(result.value);
        setName(result.value.name);
        setKind(result.value.kind);
        setNotes(result.value.notes ?? '');
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
  }, [ensemble, identity, org, groupId]);
  async function refreshInvites() {
    const listResult = await identity.listGroupInvites(org!.id);
    if (listResult.ok) {
      setInvites(listResult.value.filter((i) => i.groupId === group!.id));
    }
  }
  async function refreshSections() {
    const result = await ensemble.listSections(org!.id, group!.id);
    if (result.ok) {
      setSections(result.value);
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
      setError('Não foi possível salvar as alterações.');
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
    if (normalized.includes('gen_random_bytes') || normalized.includes('digest')) {
      return 'Erro no servidor ao gerar o token do convite. Aplique as migrations do Supabase (db reset ou db push).';
    }
    return `Não foi possível gerar o convite. (${code})`;
  }
  async function handleCreateInvite() {
    setInviteError(null);
    setIsCreatingInvite(true);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const result = await identity.createGroupInvite(group!.id, expiresAt);
    setIsCreatingInvite(false);
    if (!result.ok) {
      console.error('createGroupInvite failed:', result.error);
      setInviteError(inviteErrorMessage(result.error));
      return;
    }
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
  function statusLabel(invite: GroupInviteListItem) {
    if (invite.redeemedAt) return 'Utilizado';
    if (invite.revokedAt) return 'Link desativado';
    if (invite.expiresAt < new Date()) return 'Expirado';
    return 'Ativo';
  }
  return (
    <div className={orgPageContentClass}>
      <div className="flex items-center gap-2">
        <BackButton fallbackTo={`/${orgSlug}/grupos`} />
        <h1 className={`text-2xl font-semibold ${isArchived ? 'text-muted' : 'text-text'}`}>
          {group.name}
        </h1>
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
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-text">Tipo</span>
                      <select
                        value={kind}
                        onChange={(e) => setKind(e.target.value as GroupKind)}
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-text"
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
                        rows={3}
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
                      />
                    </label>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleSave}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {isSaving ? 'Salvando…' : 'Salvar'}
                    </button>
                  </div>
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
                  {archiveError && !archiveOpen && (
                    <p className="mt-2 text-right text-sm text-red-600">{archiveError}</p>
                  )}
                </>
              ),
            },
            {
              id: 'naipes',
              label: 'Naipes',
              content: (
                <>
                  {sections.length === 0 ? (
                    <p className="text-sm text-muted">Nenhum naipe cadastrado.</p>
                  ) : (
                    <SortableList
                      items={sections}
                      onReorder={handleReorderSections}
                      disabled={isReorderingSections}
                      ariaLabel="Naipes"
                      className="mb-4 flex flex-col gap-2"
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
                  )}
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <button
                      type="button"
                      onClick={openCreateSectionModal}
                      className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      + Naipe
                    </button>
                  </div>
                  {sectionError && !sectionModalOpen && (
                    <p className="mt-2 text-sm text-red-600">{sectionError}</p>
                  )}
                </>
              ),
            },
            {
              id: 'convites',
              label: 'Convites',
              content: (
                <>
                  {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
                  <ul className="mt-6 flex flex-col gap-2">
                    {invites.map((invite) => {
                      const active = isInviteActive(invite);
                      const editable = !invite.redeemedAt && !invite.revokedAt;
                      return (
                        <li
                          key={invite.id}
                          className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
                        >
                          <p className="font-medium text-text">{statusLabel(invite)}</p>
                          {invite.token && <InviteLinkCopy token={invite.token} />}
                          {editable ? (
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
                          ) : (
                            <p className="text-muted">
                              Expira em {invite.expiresAt.toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </li>
                      );
                    })}
                    {invites.length === 0 && (
                      <p className="text-sm text-muted">Nenhum convite para este grupo.</p>
                    )}
                  </ul>
                  {!isArchived && (
                    <div className="flex w-full justify-center mt-4">
                      <button
                        type="button"
                        disabled={isCreatingInvite}
                        onClick={handleCreateInvite}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {isCreatingInvite ? 'Gerando…' : '+ Link'}
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
