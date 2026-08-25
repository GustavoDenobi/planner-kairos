import { Link } from 'react-router-dom';

type LegalAcceptanceCheckboxesProps = {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  disabled?: boolean;
  error?: string | null;
};

export function LegalAcceptanceCheckboxes({
  accepted,
  onChange,
  disabled = false,
  error = null,
}: LegalAcceptanceCheckboxesProps) {
  return (
    <label className="flex items-start gap-2 text-sm text-muted">
      <input
        type="checkbox"
        checked={accepted}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5"
      />
      <span>
        Li e aceito os{' '}
        <Link
          to="/termos"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Termos de Uso
        </Link>{' '}
        e a{' '}
        <Link
          to="/privacidade"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Política de Privacidade
        </Link>{' '}
        do Planner Musical.
        {error && <span className="mt-1 block text-red-600">{error}</span>}
      </span>
    </label>
  );
}
