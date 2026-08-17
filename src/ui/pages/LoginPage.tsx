import { Link } from 'react-router-dom';

export function LoginPage() {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-text">Planner Kairós</h1>
        <p className="mt-1 text-sm text-muted">Gestão de repertório e agenda</p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text">E-mail</span>
          <input
            type="email"
            placeholder="seu@email.com"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text">Senha</span>
          <input
            type="password"
            placeholder="••••••••"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
          />
        </label>

        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Entrar
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
