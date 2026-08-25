import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { InviteSignupFieldErrors, MusicianClaimPreview } from '@/domain/identity';
import { getInviteSignupFieldErrors, organizationRulesRequireAcceptance } from '@/domain/identity';
import { useIdentity } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { LegalAcceptanceCheckboxes } from '@/ui/components/LegalAcceptanceCheckboxes';
import { OrganizationRulesAcceptance } from '@/ui/components/OrganizationRulesAcceptance';
import { ensembleRoleLabel } from '@/ui/features/ensemble/ensemble-labels';
import { formatBirthDateInput } from '@/ui/utils/birthDateInput';
import {
  assignmentPreviewLabel,
  musicianClaimFieldErrorMessage,
  musicianClaimSubmitErrorMessage,
} from '@/ui/utils/musicianClaimValidation';
import { publicOrgImageUrl } from '@/ui/utils/publicOrgImageUrl';

function isInviteSignupFieldErrors(error: unknown): error is InviteSignupFieldErrors {
  return typeof error === 'object' && error !== null && !Array.isArray(error);
}

type ClaimFormFieldProps = {
  label: string;
  error?: string;
  children: React.ReactNode;
};

function ClaimFormField({ label, error, children }: ClaimFormFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-text">{label}</span>
      {children}
      {error && <span className="text-red-600">{error}</span>}
    </label>
  );
}

export function MusicianClaimPage() {
  const { musicianId } = useParams();
  const identity = useIdentity();
  const { session } = useAuth();
  const { setCurrentOrgBySlug } = useOrg();
  const navigate = useNavigate();

  const [preview, setPreview] = useState<MusicianClaimPreview | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [platformLegalAccepted, setPlatformLegalAccepted] = useState(false);
  const [organizationRulesAccepted, setOrganizationRulesAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<InviteSignupFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!musicianId) {
      setPreviewError(true);
      return;
    }

    identity.previewMusicianClaim(musicianId).then((result) => {
      if (result.ok) {
        setPreview(result.value);
        setDisplayName(result.value.musicianFullName);
      } else {
        setPreviewError(true);
      }
    });
  }, [identity, musicianId]);

  const requiresOrgRules = organizationRulesRequireAcceptance(preview?.organizationRules);

  function clearFieldError(field: keyof InviteSignupFieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validateForm() {
    const errors = getInviteSignupFieldErrors({
      displayName,
      email,
      phone,
      birthDate,
      password,
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function fieldError(field: keyof InviteSignupFieldErrors) {
    const code = fieldErrors[field];
    return code ? musicianClaimFieldErrorMessage(field, code) : undefined;
  }

  function buildClaimInput(isNewUser: boolean) {
    return {
      musicianId: musicianId!,
      email: isNewUser ? email : (session?.user.email ?? ''),
      password: isNewUser ? password : '',
      displayName,
      phone,
      birthDate,
      isNewUser,
      userId: isNewUser ? undefined : session?.user.id,
      platformLegalAccepted: isNewUser ? platformLegalAccepted : undefined,
      organizationRulesAccepted: requiresOrgRules ? organizationRulesAccepted : undefined,
      organizationId: preview?.organizationId,
      organizationRules: preview?.organizationRules,
    };
  }

  async function handleClaimExistingUser() {
    if (!musicianId || !session || !preview) {
      return;
    }

    if (!displayName.trim()) {
      setFieldErrors({ displayName: 'required' });
      return;
    }

    if (requiresOrgRules && !organizationRulesAccepted) {
      setSubmitError(musicianClaimSubmitErrorMessage('organization_rules_not_accepted'));
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    const result = await identity.claimMusician(buildClaimInput(false));

    setIsSubmitting(false);

    if (!result.ok) {
      if (isInviteSignupFieldErrors(result.error)) {
        setFieldErrors(result.error);
        return;
      }

      setSubmitError(musicianClaimSubmitErrorMessage(String(result.error)));
      return;
    }

    await setCurrentOrgBySlug(result.value.organizationSlug);
    navigate(`/${result.value.organizationSlug}/agenda`);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!musicianId || !preview) {
      return;
    }

    setSubmitError(null);

    if (session) {
      setIsSubmitting(true);
      await handleClaimExistingUser();
      return;
    }

    if (!validateForm()) {
      return;
    }

    if (!platformLegalAccepted) {
      setSubmitError(musicianClaimSubmitErrorMessage('platform_legal_not_accepted'));
      return;
    }

    if (requiresOrgRules && !organizationRulesAccepted) {
      setSubmitError(musicianClaimSubmitErrorMessage('organization_rules_not_accepted'));
      return;
    }

    setIsSubmitting(true);

    const result = await identity.claimMusician(buildClaimInput(true));

    setIsSubmitting(false);

    if (!result.ok) {
      if (isInviteSignupFieldErrors(result.error)) {
        setFieldErrors(result.error);
        return;
      }

      setSubmitError(musicianClaimSubmitErrorMessage(String(result.error)));
      return;
    }

    await setCurrentOrgBySlug(result.value.organizationSlug);
    navigate(`/${result.value.organizationSlug}/agenda`);
  }

  if (previewError) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <h1 className="text-xl font-semibold text-text">Cadastro não encontrado</h1>
        <p className="mt-2 text-sm text-muted">
          Este link não corresponde a um cadastro de músico válido.
        </p>
        <Link to="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
          Ir para login
        </Link>
      </div>
    );
  }

  if (!preview) {
    return <div className="flex justify-center p-6 text-muted">Carregando cadastro…</div>;
  }

  const inputClassName =
    'rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary';
  const submitDisabled =
    isSubmitting ||
    (session
      ? requiresOrgRules && !organizationRulesAccepted
      : !platformLegalAccepted || (requiresOrgRules && !organizationRulesAccepted));

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-6 text-center">
        {preview.organizationImageStorageKey && (
          <img
            src={publicOrgImageUrl(
              import.meta.env.VITE_SUPABASE_URL,
              preview.organizationImageStorageKey,
            )}
            alt={preview.organizationName}
            className="mx-auto mb-4 h-20 w-20 rounded-xl object-cover"
          />
        )}
        <h1 className="text-2xl font-semibold text-text">Vincular cadastro</h1>
        <p className="mt-2 text-sm text-muted">
          Você foi convidado para participar de{' '}
          <strong className="text-text">{preview.organizationName}</strong>
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-border bg-bg p-4">
        <p className="mt-1 text-lg font-medium text-text">{preview.musicianFullName}</p>

        {preview.assignments.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-text">Atribuições</p>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {preview.assignments.map((assignment, index) => (
                <li key={`${assignment.groupName}-${assignment.ensembleRole}-${index}`}>
                  {assignmentPreviewLabel({
                    groupName: assignment.groupName,
                    sectionName: assignment.sectionName,
                    partName: assignment.partName,
                    ensembleRoleLabel: ensembleRoleLabel(assignment.ensembleRole),
                  })}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {preview.alreadyClaimed ? (
        <div className="text-center">
          <p className="text-sm text-muted">Este cadastro já foi vinculado a uma conta.</p>
          <Link to="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
            Ir para login
          </Link>
        </div>
      ) : session ? (
        <div className="flex flex-col gap-4">
          <ClaimFormField label="Seu nome completo" error={fieldError('displayName')}>
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                clearFieldError('displayName');
              }}
              className={inputClassName}
            />
          </ClaimFormField>

          <p className="text-sm text-muted">
            Logado como {session.user.email}. Vincule este cadastro à sua conta.
          </p>

          {requiresOrgRules && preview.organizationRules && (
            <OrganizationRulesAcceptance
              organizationName={preview.organizationName}
              title={preview.organizationRules.title}
              markdown={preview.organizationRules.markdown}
              accepted={organizationRulesAccepted}
              onChange={setOrganizationRulesAccepted}
              disabled={isSubmitting}
            />
          )}

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <button
            type="button"
            disabled={submitDisabled}
            onClick={handleClaimExistingUser}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Vinculando…' : 'Vincular à minha conta'}
          </button>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <ClaimFormField label="Seu nome completo" error={fieldError('displayName')}>
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                clearFieldError('displayName');
              }}
              className={inputClassName}
            />
          </ClaimFormField>

          <ClaimFormField label="E-mail" error={fieldError('email')}>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError('email');
              }}
              placeholder="seu@email.com"
              className={inputClassName}
            />
          </ClaimFormField>

          <ClaimFormField label="Data de nascimento" error={fieldError('birthDate')}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="bday"
              placeholder="DD/MM/AAAA"
              maxLength={10}
              value={birthDate}
              onChange={(e) => {
                setBirthDate(formatBirthDateInput(e.target.value));
                clearFieldError('birthDate');
              }}
              className={inputClassName}
            />
          </ClaimFormField>

          <ClaimFormField label="Telefone" error={fieldError('phone')}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                clearFieldError('phone');
              }}
              placeholder="(00) 00000-0000"
              className={inputClassName}
            />
          </ClaimFormField>

          <ClaimFormField label="Senha" error={fieldError('password')}>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError('password');
              }}
              placeholder="Mínimo de 6 caracteres"
              className={inputClassName}
            />
          </ClaimFormField>

          <LegalAcceptanceCheckboxes
            accepted={platformLegalAccepted}
            onChange={setPlatformLegalAccepted}
            disabled={isSubmitting}
          />

          {requiresOrgRules && preview.organizationRules && (
            <OrganizationRulesAcceptance
              organizationName={preview.organizationName}
              title={preview.organizationRules.title}
              markdown={preview.organizationRules.markdown}
              accepted={organizationRulesAccepted}
              onChange={setOrganizationRulesAccepted}
              disabled={isSubmitting}
            />
          )}

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <button
            type="submit"
            disabled={submitDisabled}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Criando conta…' : 'Criar conta e vincular'}
          </button>
        </form>
      )}
    </div>
  );
}
