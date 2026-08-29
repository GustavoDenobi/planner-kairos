import { useEffect, useState } from 'react';
import type { AnnotationSet, CreateAnnotationSetInput, UpdateAnnotationSetInput } from '@/domain/repertoire';
import { formatAnnotationSetLabel } from '@/domain/repertoire';
import { AudienceFields, type AudienceGroupOption, type AudienceMusicianOption } from '@/ui/features/audience/AudienceFields';
import { Modal } from '@/ui/components/Modal';

export type DirectedAnnotationSetModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  groups: AudienceGroupOption[];
  musicians: AudienceMusicianOption[];
  initialSet?: AnnotationSet | null;
  disabled?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateAnnotationSetInput | UpdateAnnotationSetInput) => Promise<boolean>;
};

export function DirectedAnnotationSetModal({
  open,
  mode,
  groups,
  musicians,
  initialSet,
  disabled = false,
  onClose,
  onSubmit,
}: DirectedAnnotationSetModalProps) {
  const [title, setTitle] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [musicianIds, setMusicianIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(initialSet?.title ?? '');
    setGroupIds(initialSet?.groups.map((group) => group.id) ?? []);
    setMusicianIds(initialSet?.musicians.map((musician) => musician.id) ?? []);
    setError(null);
  }, [open, initialSet]);

  async function handleSubmit() {
    if (groupIds.length === 0 && musicianIds.length === 0) {
      setError('Selecione ao menos um grupo ou aluno.');
      return;
    }

    setIsSaving(true);
    setError(null);
    const input =
      mode === 'create'
        ? { title: title.trim() || null, groupIds, musicianIds }
        : { title: title.trim() || null, groupIds, musicianIds };
    const ok = await onSubmit(input);
    setIsSaving(false);
    if (ok) {
      onClose();
    } else {
      setError('Não foi possível salvar o conjunto de anotações.');
    }
  }

  const previewLabel = formatAnnotationSetLabel({
    id: initialSet?.id ?? 'preview',
    organizationId: initialSet?.organizationId ?? '',
    pieceFileId: initialSet?.pieceFileId ?? '',
    authorUserId: initialSet?.authorUserId ?? '',
    title: title.trim() || null,
    groups: groups.filter((group) => groupIds.includes(group.id)).map((group) => ({
      id: group.id,
      name: group.name,
      kind: group.kind,
    })),
    musicians: musicians.filter((musician) => musicianIds.includes(musician.id)).map((musician) => ({
      id: musician.id,
      fullName: musician.name,
    })),
    createdAt: initialSet?.createdAt ?? '',
    updatedAt: initialSet?.updatedAt ?? '',
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Novo conjunto para alunos' : 'Editar conjunto para alunos'}
    >
      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm text-muted">Título (opcional)</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={disabled || isSaving}
            placeholder={previewLabel}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
          />
        </label>

        <AudienceFields
          groups={groups}
          musicians={musicians}
          selectedGroupIds={groupIds}
          selectedMusicianIds={musicianIds}
          onGroupIdsChange={setGroupIds}
          onMusicianIdsChange={setMusicianIds}
          disabled={disabled || isSaving}
          title="Destinatários"
          searchPlaceholder="Buscar turma ou aluno"
          emptySelectedLabel="Nenhum destinatário selecionado"
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-border px-3 py-2 text-sm text-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={disabled || isSaving}
            className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-fg disabled:opacity-60"
          >
            {isSaving ? 'Salvando…' : mode === 'create' ? 'Criar conjunto' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
