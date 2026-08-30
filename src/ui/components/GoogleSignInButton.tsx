import { IconGoogle } from '@/ui/components/icons';

type GoogleSignInButtonProps = {
  label: string;
  disabled?: boolean;
  isLoading?: boolean;
  onClick: () => void;
};

export function GoogleSignInButton({
  label,
  disabled = false,
  isLoading = false,
  onClick,
}: GoogleSignInButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-bg px-4 py-3 text-sm font-medium text-text transition-opacity hover:bg-surface disabled:opacity-50"
    >
      <IconGoogle className="h-5 w-5 shrink-0" />
      {isLoading ? 'Redirecionando…' : label}
    </button>
  );
}
