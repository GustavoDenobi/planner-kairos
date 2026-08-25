import { useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useIdentity } from '@/ui/app/AppServicesContext';
import { useOrg } from '@/ui/app/OrgProvider';
import { BackButton } from '@/ui/components/BackButton';
import { MarkdownContent } from '@/ui/components/MarkdownContent';
import { OrgAvatar } from '@/ui/components/OrgAvatar';
import { orgPageContentClass } from '@/ui/layouts/OrgListPageLayout';
import { organizationImageErrorMessage } from '@/ui/utils/organizationImageValidation';

export function OrganizationSettingsPage() {
  const { orgSlug } = useParams();
  const identity = useIdentity();
  const { organizations, refreshOrganizations } = useOrg();
  const organization = organizations.find((org) => org.slug === orgSlug);

  const [name, setName] = useState('');
  const [rulesTitle, setRulesTitle] = useState('Regulamento interno');
  const [rulesMarkdown, setRulesMarkdown] = useState('');
  const [requiresRulesAcceptance, setRequiresRulesAcceptance] = useState(false);
  const [showRulesPreview, setShowRulesPreview] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rulesSaved, setRulesSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin =
    organization?.accessRole === 'admin' || organization?.accessRole === 'owner';

  useEffect(() => {
    if (!organization) {
      return;
    }

    setName(organization.name);
    setRulesTitle(organization.rules?.title ?? 'Regulamento interno');
    setRulesMarkdown(organization.rules?.markdown ?? '');
    setRequiresRulesAcceptance(organization.rules?.requiresAcceptance ?? false);
    setError(null);
    setRulesSaved(false);
    setShowRulesPreview(false);
  }, [organization]);

  if (!organization) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-muted">
        Carregando…
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to={`/${orgSlug}/agenda`} replace />;
  }

  async function handleSaveName() {
    if (name.trim() === organization!.name) {
      return;
    }

    setIsBusy(true);
    setError(null);
    const result = await identity.setOrganizationName(organization!.id, name);
    setIsBusy(false);

    if (!result.ok) {
      setError('Informe um nome válido com pelo menos 2 caracteres.');
      return;
    }

    await refreshOrganizations();
  }

  async function handleSaveRules() {
    setIsBusy(true);
    setError(null);
    setRulesSaved(false);

    const result = await identity.setOrganizationRules({
      organizationId: organization!.id,
      title: rulesTitle,
      markdown: rulesMarkdown,
      requiresAcceptance: requiresRulesAcceptance,
    });

    setIsBusy(false);

    if (!result.ok) {
      setError('Informe um título e o texto do regulamento.');
      return;
    }

    setRulesSaved(true);
    await refreshOrganizations();
  }

  async function handleUpload(file: File) {
    setIsBusy(true);
    setError(null);

    const result = await identity.setOrganizationImage(
      organization!.id,
      file,
      organization!.imageStorageKey,
    );

    setIsBusy(false);

    if (!result.ok) {
      setError(organizationImageErrorMessage(result.error));
      return;
    }

    await refreshOrganizations();
  }

  async function handleRemove() {
    setIsBusy(true);
    setError(null);
    try {
      await identity.removeOrganizationImage(
        organization!.id,
        organization!.imageStorageKey,
      );
      await refreshOrganizations();
    } catch {
      setError('Não foi possível remover a imagem. Tente novamente em instantes.');
    }
    setIsBusy(false);
  }

  return (
    <div className={orgPageContentClass}>
      <div className="flex items-center gap-2">
        <BackButton fallbackTo={`/${orgSlug}/agenda`} />
        <h1 className="text-2xl font-semibold text-text">Editar organização</h1>
      </div>

      <article className="mt-6 min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
            <OrgAvatar organization={organization} size="lg" variant="square" />
            <div className="min-w-0 flex-1">
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="font-medium text-text">Nome</span>
                <input
                  type="text"
                  value={name}
                  disabled={isBusy}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleSaveName}
                  className="w-full min-w-0 rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
                />
              </label>
            </div>
          </div>

          <div className="min-w-0 flex flex-col gap-2">
            <label className="text-sm font-medium text-text">Imagem da organização</label>
            <p className="mb-2 text-xs text-muted">
              PNG, JPEG ou WebP, mínimo 200×200 px.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={isBusy}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) {
                  handleUpload(file);
                }
              }}
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Escolher imagem
            </button>
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

          <div className="min-w-0 border-t border-border pt-4">
            <h2 className="text-sm font-semibold text-text">Regulamento da organização</h2>
            <p className="mt-1 text-xs text-muted">
              Texto exibido no convite e no vínculo de músicos. Texto formatado em Markdown.
            </p>

            <label className="mt-3 flex min-w-0 flex-col gap-1 text-sm">
              <span className="font-medium text-text">Título</span>
              <input
                type="text"
                value={rulesTitle}
                disabled={isBusy}
                onChange={(e) => setRulesTitle(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
              />
            </label>

            <label className="mt-3 flex min-w-0 flex-col gap-1 text-sm">
              <span className="font-medium text-text">Conteúdo (Markdown)</span>
              <textarea
                value={rulesMarkdown}
                disabled={isBusy}
                rows={12}
                onChange={(e) => setRulesMarkdown(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
              />
            </label>

            <label className="mt-3 flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={requiresRulesAcceptance}
                disabled={isBusy}
                onChange={(e) => setRequiresRulesAcceptance(e.target.checked)}
              />
              Exigir aceite no cadastro de músicos
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setShowRulesPreview((current) => !current)}
                className="rounded-lg border border-border px-3 py-2 text-sm text-text hover:bg-bg disabled:opacity-50"
              >
                {showRulesPreview ? 'Ocultar prévia' : 'Pré-visualizar'}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleSaveRules}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Salvar regulamento
              </button>
            </div>

            {organization.rules && (
              <p className="mt-2 text-xs text-muted">
                Versão atual: v{organization.rules.version}
              </p>
            )}

            {rulesSaved && (
              <p className="mt-2 text-sm text-green-700">Regulamento salvo com sucesso.</p>
            )}

            {showRulesPreview && rulesMarkdown.trim() && (
              <div className="mt-3 rounded-lg border border-border bg-bg p-3">
                <MarkdownContent markdown={rulesMarkdown} />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {isBusy && <p className="text-sm text-muted">Processando…</p>}
        </div>
      </article>
    </div>
  );
}
