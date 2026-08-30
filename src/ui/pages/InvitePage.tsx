import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { GroupInvitePreview, InviteSignupFieldErrors } from '@/domain/identity';
import {
  getInviteSignupFieldErrors,
  getOAuthOnboardingFieldErrors,
  hasOAuthOnboardingFieldErrors,
  organizationRulesRequireAcceptance,
} from '@/domain/identity';
import { useIdentity } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { AuthDivider } from '@/ui/components/AuthDivider';
import { GoogleSignInButton } from '@/ui/components/GoogleSignInButton';
import { LegalAcceptanceCheckboxes } from '@/ui/components/LegalAcceptanceCheckboxes';
import { OrganizationRulesAcceptance } from '@/ui/components/OrganizationRulesAcceptance';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';
import { LOGIN_ERROR_MESSAGES } from '@/ui/utils/auth-error-labels';
import { formatBirthDateInput } from '@/ui/utils/birthDateInput';
import {
  inviteSignupFieldErrorMessage,
  inviteSignupSubmitErrorMessage,
} from '@/ui/utils/inviteSignupValidation';
import { publicOrgImageUrl } from '@/ui/utils/publicOrgImageUrl';

function isInviteSignupFieldErrors(error: unknown): error is InviteSignupFieldErrors {
  return typeof error === 'object' && error !== null && !Array.isArray(error);
}

type InviteFormFieldProps = {
  label: string;
  error?: string;
  children: React.ReactNode;
};

function InviteFormField({ label, error, children }: InviteFormFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-text">{label}</span>
      {children}
      {error && <span className="text-red-600">{error}</span>}
    </label>
  );
}

export function InvitePage() {
  const { token } = useParams();
  const identity = useIdentity();
  const { session } = useAuth();
  const { setCurrentOrgBySlug } = useOrg();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const online = useOnlineStatus();

  const [preview, setPreview] = useState<GroupInvitePreview | null>(null);
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
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams.get('error') === 'oauth_resume_failed') {
      setSubmitError(LOGIN_ERROR_MESSAGES.oauthFailed);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!token) {
      setPreviewError(true);
      return;
    }

    identity.previewGroupInvite(token).then((result) => {
      if (result.ok) {
        setPreview(result.value);
      } else {
        setPreviewError(true);
      }
    });
  }, [identity, token]);

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
    return code ? inviteSignupFieldErrorMessage(field, code) : undefined;
  }

  function buildInviteInput(isNewUser: boolean) {
    return {
      token: token!,
      email: isNewUser ? email : (session?.user.email ?? ''),
      password: isNewUser ? password : '',
      displayName: isNewUser ? displayName : String(session?.user.user_metadata?.display_name ?? ''),
      phone: isNewUser ? phone : undefined,
      birthDate: isNewUser ? birthDate : undefined,
      isNewUser,
      userId: isNewUser ? undefined : session?.user.id,
      platformLegalAccepted: isNewUser ? platformLegalAccepted : undefined,
      organizationRulesAccepted: requiresOrgRules ? organizationRulesAccepted : undefined,
      organizationId: preview?.organizationId,
      organizationRules: preview?.organizationRules,
    };
  }

  async function handleAcceptExistingUser() {
    if (!token || !session || !preview) {
      return;
    }

    if (requiresOrgRules && !organizationRulesAccepted) {
      setSubmitError(inviteSignupSubmitErrorMessage('organization_rules_not_accepted'));
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    const result = await identity.acceptGroupInvite(buildInviteInput(false));

    setIsSubmitting(false);

    if (!result.ok) {
      setSubmitError(inviteSignupSubmitErrorMessage(String(result.error)));
      return;
    }

    await setCurrentOrgBySlug(result.value.organizationSlug);
    navigate(`/${result.value.organizationSlug}/agenda`);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !preview) {
      return;
    }

    setSubmitError(null);

    if (session) {
      setIsSubmitting(true);
      await handleAcceptExistingUser();
      return;
    }

    if (!validateForm()) {
      return;
    }

    if (!platformLegalAccepted) {
      setSubmitError(inviteSignupSubmitErrorMessage('platform_legal_not_accepted'));
      return;
    }

    if (requiresOrgRules && !organizationRulesAccepted) {
      setSubmitError(inviteSignupSubmitErrorMessage('organization_rules_not_accepted'));
      return;
    }

    setIsSubmitting(true);

    const result = await identity.acceptGroupInvite(buildInviteInput(true));

    setIsSubmitting(false);

    if (!result.ok) {
      if (isInviteSignupFieldErrors(result.error)) {
        setFieldErrors(result.error);
        return;
      }

      setSubmitError(inviteSignupSubmitErrorMessage(String(result.error)));
      return;
    }

    await setCurrentOrgBySlug(result.value.organizationSlug);
    navigate(`/${result.value.organizationSlug}/agenda`);
  }

  async function handleGoogleSignup() {
    if (!token || !preview || !online) {
      return;
    }

    setSubmitError(null);

    const oauthFieldErrors = getOAuthOnboardingFieldErrors({ displayName, phone, birthDate });
    if (hasOAuthOnboardingFieldErrors(oauthFieldErrors)) {
      setFieldErrors(oauthFieldErrors);
      return;
    }

    if (!platformLegalAccepted) {
      setSubmitError(inviteSignupSubmitErrorMessage('platform_legal_not_accepted'));
      return;
    }

    if (requiresOrgRules && !organizationRulesAccepted) {
      setSubmitError(inviteSignupSubmitErrorMessage('organization_rules_not_accepted'));
      return;
    }

    setIsGoogleSubmitting(true);
    const result = await identity.signInWithGoogle({
      kind: 'invite_signup',
      token,
      displayName,
      phone,
      birthDate,
      organizationId: preview.organizationId,
      organizationRules: preview.organizationRules,
      organizationRulesAccepted,
      fallbackPath: `/convite/${token}`,
    });

    if (!result.ok) {
      setIsGoogleSubmitting(false);
      setSubmitError(LOGIN_ERROR_MESSAGES.oauthFailed);
    }
  }

  async function handleGoogleLogin() {
    if (!token || !online) {
      return;
    }

    setSubmitError(null);
    setIsGoogleSubmitting(true);

    const result = await identity.signInWithGoogle({
      kind: 'invite_login',
      returnPath: `/convite/${token}`,
    });

    if (!result.ok) {
      setIsGoogleSubmitting(false);
      setSubmitError(LOGIN_ERROR_MESSAGES.oauthFailed);
    }
  }

  if (previewError) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <h1 className="text-xl font-semibold text-text">Convite inválido</h1>
        <p className="mt-2 text-sm text-muted">
          Este link expirou, foi revogado ou atingiu o limite de inscrições.
        </p>
        <Link to="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
          Ir para login
        </Link>
      </div>
    );
  }

  if (!preview) {
    return <div className="flex justify-center p-6 text-muted">Validando convite…</div>;
  }

  const inputClassName =
    'rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary';
  const submitDisabled =
    isSubmitting ||
    isGoogleSubmitting ||
    (session
      ? requiresOrgRules && !organizationRulesAccepted
      : !platformLegalAccepted || (requiresOrgRules && !organizationRulesAccepted));

  const googleSignupDisabled =
    isSubmitting ||
    isGoogleSubmitting ||
    !online ||
    !platformLegalAccepted ||
    (requiresOrgRules && !organizationRulesAccepted);

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
        <h1 className="text-2xl font-semibold text-text">Convite</h1>
        <p className="mt-2 text-sm text-muted">
          Você foi convidado para participar de <br />
          <strong className="text-text">{preview.organizationName}</strong>
          <br />
          no grupo <strong className="text-text">{preview.groupName}</strong>
        </p>
      </div>

      {session ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Logado como {session.user.email}. Aceite o convite para entrar na organização.
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
            onClick={handleAcceptExistingUser}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Aceitando…' : 'Aceitar convite'}
          </button>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <InviteFormField label="Nome" error={fieldError('displayName')}>
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                clearFieldError('displayName');
              }}
              className={inputClassName}
            />
          </InviteFormField>

          <InviteFormField label="E-mail" error={fieldError('email')}>
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
          </InviteFormField>

          <InviteFormField label="Data de nascimento" error={fieldError('birthDate')}>
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
          </InviteFormField>

          <InviteFormField label="Telefone" error={fieldError('phone')}>
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
          </InviteFormField>

          <InviteFormField label="Senha" error={fieldError('password')}>
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
          </InviteFormField>

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
            {isSubmitting ? 'Criando conta…' : 'Criar conta e entrar'}
          </button>

          <AuthDivider />

          <GoogleSignInButton
            label="Continuar com Google"
            disabled={googleSignupDisabled}
            isLoading={isGoogleSubmitting}
            onClick={() => void handleGoogleSignup()}
          />

          <p className="text-center text-sm text-muted">
            Já tem conta?{' '}
            <button
              type="button"
              disabled={isSubmitting || isGoogleSubmitting || !online}
              onClick={() => void handleGoogleLogin()}
              className="text-primary hover:underline disabled:opacity-50"
            >
              Entrar com Google
            </button>
          </p>
        </form>
      )}
    </div>
  );
}
