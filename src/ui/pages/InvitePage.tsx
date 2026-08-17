import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useIdentity } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { ThemeToggle } from '@/ui/components/ThemeToggle';
import { publicOrgImageUrl } from '@/ui/utils/publicOrgImageUrl';

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
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
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

  async function handleAcceptExistingUser() {
    if (!token || !session) return;
    setError(null);
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
      setError('Não foi possível aceitar o convite. Talvez já tenha sido usado.');
      return;
    }

    await setCurrentOrgBySlug(result.value.organizationSlug);
    navigate(`/${result.value.organizationSlug}/agenda`);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;

    setError(null);
    setIsSubmitting(true);

    if (session) {
      await handleAcceptExistingUser();
      return;
    }

    const result = await identity.acceptGroupInvite({
      token,
      email,
      password,
      displayName,
      isNewUser: true,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setError('Não foi possível criar a conta. Verifique os dados ou se o convite ainda é válido.');
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
          Este link expirou, foi revogado ou já foi utilizado.
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

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-4 flex justify-end">
        <ThemeToggle variant="compact" />
      </div>

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
          {error && <p className="text-sm text-red-600">{error}</p>}
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
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Nome</span>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Senha</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

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
