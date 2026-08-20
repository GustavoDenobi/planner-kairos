import { useEffect, useState } from 'react';
import type { OrganizationWithRole } from '@/application/ports';
import { useIdentity } from '@/ui/app/AppServicesContext';
import { Modal } from '@/ui/components/Modal';
import { OrgAvatar } from '@/ui/components/OrgAvatar';
import { organizationImageErrorMessage } from '@/ui/utils/organizationImageValidation';

type OrganizationEditModalProps = {
  organization: OrganizationWithRole;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
};

export function OrganizationEditModal({
  organization,
  open,
  onClose,
  onUpdated,
}: OrganizationEditModalProps) {
  const identity = useIdentity();
  const [name, setName] = useState(organization.name);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(organization.name);
      setError(null);
    }
  }, [open, organization.name]);

  async function handleSaveName() {
    if (name.trim() === organization.name) {
      return;
    }

    setIsBusy(true);
    setError(null);
    const result = await identity.setOrganizationName(organization.id, name);
    setIsBusy(false);

    if (!result.ok) {
      setError('Informe um nome válido com pelo menos 2 caracteres.');
      return;
    }

    onUpdated();
  }

  async function handleUpload(file: File) {
    setIsBusy(true);
    setError(null);

    const result = await identity.setOrganizationImage(
      organization.id,
      file,
      organization.imageStorageKey,
    );

    setIsBusy(false);

    if (!result.ok) {
      setError(organizationImageErrorMessage(result.error));
      return;
    }

    onUpdated();
  }

  async function handleRemove() {
    setIsBusy(true);
    setError(null);
    try {
      await identity.removeOrganizationImage(organization.id, organization.imageStorageKey);
      onUpdated();
    } catch {
      setError('Não foi possível remover a imagem. Tente novamente em instantes.');
    }
    setIsBusy(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar organização">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <OrgAvatar organization={organization} size="lg" variant="square" />
          <div className="min-w-0 flex-1">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text">Nome</span>
              <input
                type="text"
                value={name}
                disabled={isBusy}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleSaveName}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text">Imagem da organização</label>
          <p className="text-xs text-muted">
            PNG, JPEG ou WebP, mínimo 200×200 px. Usada no menu, convites e prévia no WhatsApp.
          </p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={isBusy}
            className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleUpload(file);
              }
            }}
          />
          {organization.imageStorageKey && (
            <button
              type="button"
              disabled={isBusy}
              onClick={handleRemove}
              className="text-sm text-red-600 hover:underline disabled:opacity-50"
            >
              Remover imagem
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {isBusy && <p className="text-sm text-muted">Processando…</p>}
      </div>
    </Modal>
  );
}
