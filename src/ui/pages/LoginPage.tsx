import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useIdentity } from '@/ui/app/AppServicesContext';

export function LoginPage() {
  const identity = useIdentity();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await identity.signIn(email, password);
    setIsSubmitting(false);

    if (!result.ok) {
      setError('E-mail ou senha inválidos.');
      return;
    }

    navigate('/orgs');
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-4 text-center">
        <h1 className="text-2xl font-semibold text-text">Planner Kairós</h1>
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
          disabled={isSubmitting}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        <Link to="/login/recuperar-senha" className="text-primary hover:underline">
          Esqueci minha senha
        </Link>
      </p>
    </div>
  );
}
