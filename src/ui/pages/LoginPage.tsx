import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useIdentity, useOffline } from '@/ui/app/AppServicesContext';
import { AuthDivider } from '@/ui/components/AuthDivider';
import { GoogleSignInButton } from '@/ui/components/GoogleSignInButton';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';
import { LOGIN_ERROR_MESSAGES } from '@/ui/utils/auth-error-labels';

const ORG_STORAGE_KEY = 'planner-kairos:current-org-slug';

export function LoginPage() {
  const identity = useIdentity();
  const offline = useOffline();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const online = useOnlineStatus();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [offlineWithoutSnapshot, setOfflineWithoutSnapshot] = useState(false);

  useEffect(() => {
    if (searchParams.get('error') === 'oauth_failed') {
      setError(LOGIN_ERROR_MESSAGES.oauthFailed);
    }
  }, [searchParams]);

  useEffect(() => {
    if (online) {
      setOfflineWithoutSnapshot(false);
      return;
    }

    void offline.getIdentitySnapshot().then((snapshot) => {
      if (!snapshot) {
        setOfflineWithoutSnapshot(true);
        return;
      }

      const slug = snapshot.currentOrgSlug ?? localStorage.getItem(ORG_STORAGE_KEY);
      if (slug) {
        navigate(`/${slug}/leitura`, { replace: true });
      } else {
        navigate('/orgs', { replace: true });
      }
    });
  }, [online, offline, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!online) {
      setError(LOGIN_ERROR_MESSAGES.offline);
      return;
    }

    setIsSubmitting(true);

    const result = await identity.signIn(email, password);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(LOGIN_ERROR_MESSAGES.invalidCredentials);
      return;
    }

    navigate('/orgs');
  }

  async function handleGoogleSignIn() {
    setError(null);

    if (!online) {
      setError(LOGIN_ERROR_MESSAGES.offline);
      return;
    }

    setIsGoogleSubmitting(true);
    const result = await identity.signInWithGoogle({ kind: 'login' });
    if (!result.ok) {
      setIsGoogleSubmitting(false);
      setError(LOGIN_ERROR_MESSAGES.oauthFailed);
    }
  }

  if (offlineWithoutSnapshot) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm text-center">
        <h1 className="font-brand text-xl font-bold text-text">Sem conexão</h1>
        <p className="mt-2 text-sm text-muted">
          Conecte-se à internet para fazer login. Se você já usou o app online e baixou playlists,
          abra o app instalado com a conexão ativa uma vez para ativar o modo offline.
        </p>
      </div>
    );
  }

  const authBusy = isSubmitting || isGoogleSubmitting;

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-4 text-center">
        <img
          src="/logo.svg"
          alt=""
          aria-hidden
          className="mx-auto mb-3 h-16 w-16"
        />
        <h1 className="font-brand text-2xl font-bold text-text">Planner Musical</h1>
        <p className="mt-1 text-sm text-muted">Gestão de repertório e agenda</p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text">Senha</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={authBusy || !online}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <AuthDivider />

      <GoogleSignInButton
        label="Entrar com Google"
        disabled={!online}
        isLoading={isGoogleSubmitting}
        onClick={() => void handleGoogleSignIn()}
      />

      <p className="mt-4 text-center text-sm text-muted">
        <Link to="/login/recuperar-senha" className="text-primary hover:underline">
          Esqueci minha senha
        </Link>
      </p>
    </div>
  );
}
