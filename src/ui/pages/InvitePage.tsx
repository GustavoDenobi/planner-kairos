import { useEffect, useState } from 'react';

import { Link, useNavigate, useParams } from 'react-router-dom';

import type { InviteSignupFieldErrors } from '@/domain/identity';

import { getInviteSignupFieldErrors } from '@/domain/identity';

import { useIdentity } from '@/ui/app/AppServicesContext';

import { useAuth } from '@/ui/app/auth/AuthProvider';

import { useOrg } from '@/ui/app/OrgProvider';

import { publicOrgImageUrl } from '@/ui/utils/publicOrgImageUrl';
import { formatBirthDateInput } from '@/ui/utils/birthDateInput';

import {

  inviteSignupFieldErrorMessage,

  inviteSignupSubmitErrorMessage,

} from '@/ui/utils/inviteSignupValidation';



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



  const [preview, setPreview] = useState<{

    organizationName: string;

    groupName: string;

    organizationImageStorageKey: string | null;

  } | null>(null);

  const [previewError, setPreviewError] = useState(false);

  const [displayName, setDisplayName] = useState('');

  const [email, setEmail] = useState('');

  const [phone, setPhone] = useState('');

  const [birthDate, setBirthDate] = useState('');

  const [password, setPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<InviteSignupFieldErrors>({});

  const [submitError, setSubmitError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);



  useEffect(() => {

    if (!token) {

      setPreviewError(true);

      return;

    }



    identity.previewGroupInvite(token).then((result) => {

      if (result.ok) {

        setPreview({

          organizationName: result.value.organizationName,

          groupName: result.value.groupName,

          organizationImageStorageKey: result.value.organizationImageStorageKey,

        });

      } else {

        setPreviewError(true);

      }

    });

  }, [identity, token]);



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



  async function handleAcceptExistingUser() {

    if (!token || !session) return;

    setSubmitError(null);

    setIsSubmitting(true);



    const result = await identity.acceptGroupInvite({

      token,

      email: session.user.email ?? '',

      password: '',

      displayName: String(session.user.user_metadata?.display_name ?? ''),

      isNewUser: false,

      userId: session.user.id,

    });



    setIsSubmitting(false);



    if (!result.ok) {

      setSubmitError('Não foi possível aceitar o convite. Talvez tenha expirado ou atingido o limite de usos.');

      return;

    }



    await setCurrentOrgBySlug(result.value.organizationSlug);

    navigate(`/${result.value.organizationSlug}/agenda`);

  }



  async function handleSubmit(event: React.FormEvent) {

    event.preventDefault();

    if (!token) return;



    setSubmitError(null);



    if (session) {

      setIsSubmitting(true);

      await handleAcceptExistingUser();

      return;

    }



    if (!validateForm()) {

      return;

    }



    setIsSubmitting(true);



    const result = await identity.acceptGroupInvite({

      token,

      email,

      password,

      displayName,

      phone,

      birthDate,

      isNewUser: true,

    });



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

    return (

      <div className="flex justify-center p-6 text-muted">Validando convite…</div>

    );

  }



  const inputClassName =

    'rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary';



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

          Você foi convidado para participar de <br /><strong className="text-text">{preview.organizationName}</strong>

          <br />

          no grupo <strong className="text-text">{preview.groupName}</strong>

        </p>

      </div>



      {session ? (

        <div className="flex flex-col gap-4">

          <p className="text-sm text-muted">

            Logado como {session.user.email}. Aceite o convite para entrar na organização.

          </p>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <button

            type="button"

            disabled={isSubmitting}

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



          {submitError && <p className="text-sm text-red-600">{submitError}</p>}



          <button

            type="submit"

            disabled={isSubmitting}

            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"

          >

            {isSubmitting ? 'Criando conta…' : 'Criar conta e entrar'}

          </button>

        </form>

      )}

    </div>

  );

}

