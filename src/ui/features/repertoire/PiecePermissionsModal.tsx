import { useEffect, useState } from 'react';
import type { PieceDetail, PieceFileAccessScope } from '@/domain/repertoire';
import type { AudienceGroupOption, AudienceMusicianOption } from '@/ui/features/audience';
import { AudienceFields } from '@/ui/features/audience';
import { Modal } from '@/ui/components/Modal';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import {
  PieceFileAccessOverrideForm,
  toPieceAccessSettingsInput,
} from '@/ui/features/repertoire/PieceAccessSettingsFields';

type PiecePermissionsModalProps = {
  open: boolean;
  piece: PieceDetail;
  groups: AudienceGroupOption[];
  musicians: AudienceMusicianOption[];
  onClose: () => void;
  onSave: (input: {
    groupIds: string[];
    musicianIds: string[];
    fileAccessScope: PieceFileAccessScope | null;
    allowFileDownload: boolean | null;
  }) => Promise<boolean>;
  isSaving?: boolean;
  error?: string | null;
};

export function PiecePermissionsModal({
  open,
  piece,
  groups,
  musicians,
  onClose,
  onSave,
  isSaving = false,
  error = null,
}: PiecePermissionsModalProps) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedMusicianIds, setSelectedMusicianIds] = useState<string[]>([]);
  const [inheritRules, setInheritRules] = useState(true);
  const [fileAccessScope, setFileAccessScope] = useState<PieceFileAccessScope | null>(null);
  const [allowFileDownload, setAllowFileDownload] = useState<boolean | null>(null);
  const [confirmEmptyAudience, setConfirmEmptyAudience] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedGroupIds(piece.groups.map((group) => group.id));
    setSelectedMusicianIds(piece.musicians.map((musician) => musician.id));
    const hasPieceRules =
      piece.fileAccessScope !== null || piece.allowFileDownload !== null;
    setInheritRules(!hasPieceRules);
    setFileAccessScope(piece.fileAccessScope);
    setAllowFileDownload(piece.allowFileDownload);
  }, [open, piece]);

  async function submit() {
    if (selectedGroupIds.length === 0 && selectedMusicianIds.length === 0) {
      setConfirmEmptyAudience(true);
      return;
    }
    await performSave();
  }

  async function performSave() {
    const settings = toPieceAccessSettingsInput(inheritRules, fileAccessScope, allowFileDownload);
    const ok = await onSave({
      groupIds: selectedGroupIds,
      musicianIds: selectedMusicianIds,
      ...settings,
    });
    if (ok) {
      setConfirmEmptyAudience(false);
      onClose();
    }
  }

  return (
    <>
      <Modal open={open} onClose={() => !isSaving && onClose()} title="Editar permissões">
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <AudienceFields
            title="Visível para"
            groups={groups}
            musicians={musicians}
            selectedGroupIds={selectedGroupIds}
            selectedMusicianIds={selectedMusicianIds}
            onGroupIdsChange={setSelectedGroupIds}
            onMusicianIdsChange={setSelectedMusicianIds}
            disabled={isSaving}
          />

          <PieceFileAccessOverrideForm
            inheritRules={inheritRules}
            fileAccessScope={fileAccessScope}
            allowFileDownload={allowFileDownload}
            onInheritRulesChange={setInheritRules}
            onFileAccessScopeChange={setFileAccessScope}
            onAllowFileDownloadChange={setAllowFileDownload}
            disabled={isSaving}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSaving ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmEmptyAudience}
        title="Peça sem visibilidade"
        message="Sem grupos ou músicos vinculados, apenas administradores verão esta peça. Deseja continuar?"
        confirmLabel="Salvar mesmo assim"
        onClose={() => setConfirmEmptyAudience(false)}
        onConfirm={() => {
          setConfirmEmptyAudience(false);
          void performSave();
        }}
        isConfirming={isSaving}
      />
    </>
  );
}
