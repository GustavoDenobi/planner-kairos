import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useIdentity } from '@/ui/app/AppServicesContext';
import { ThemeToggle } from '@/ui/components/ThemeToggle';

type Step = 'request' | 'confirm' | 'done';

export function PasswordRecoveryPage() {
  const identity = useIdentity();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequest(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    await identity.requestPasswordRecovery(email);
    setIsSubmitting(false);
    setStep('confirm');
  }

  async function handleConfirm(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await identity.confirmPasswordRecovery(email, code, newPassword);
    setIsSubmitting(false);

    if (!result.ok) {
      setError('Código inválido ou expirado.');
      return;
    }

    setStep('done');
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-4 flex justify-end">
        <ThemeToggle variant="compact" />
      </div>

      <h1 className="mb-4 text-xl font-semibold text-text">Recuperar senha</h1>

      {step === 'request' && (
        <form className="flex flex-col gap-4" onSubmit={handleRequest}>
          <p className="text-sm text-muted">
            Informe seu e-mail. Se existir uma conta, enviaremos um código de verificação.
          </p>
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
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Enviando…' : 'Enviar código'}
          </button>
        </form>
      )}

      {step === 'confirm' && (
        <form className="flex flex-col gap-4" onSubmit={handleConfirm}>
          <p className="text-sm text-muted">
            Se o e-mail existir, você receberá um código. Digite o código e a nova senha.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Código</span>
            <input
              type="text"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Nova senha</span>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Alterando…' : 'Alterar senha'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="text-center">
          <p className="text-sm text-muted">Senha alterada com sucesso.</p>
          <Link to="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
            Ir para login
          </Link>
        </div>
      )}

      {step !== 'done' && (
        <p className="mt-4 text-center text-sm text-muted">
          <Link to="/login" className="text-primary hover:underline">Voltar ao login</Link>
        </p>
      )}
    </div>
  );
}
