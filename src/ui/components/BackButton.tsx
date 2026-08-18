import { IconChevronLeft, IconX } from '@/ui/components/icons';
import { useGoBack } from '@/ui/hooks/useGoBack';

const defaultClassName =
  'flex shrink-0 items-center justify-center rounded-lg border border-border p-1 text-muted transition-colors hover:bg-surface hover:text-text';

type BackButtonProps = {
  fallbackTo: string;
  variant?: 'back' | 'close';
  'aria-label'?: string;
  className?: string;
};

export function BackButton({
  fallbackTo,
  variant = 'back',
  'aria-label': ariaLabel,
  className = defaultClassName,
}: BackButtonProps) {
  const goBack = useGoBack(fallbackTo);
  const resolvedAriaLabel = ariaLabel ?? (variant === 'close' ? 'Fechar' : 'Voltar');
  const Icon = variant === 'close' ? IconX : IconChevronLeft;

  return (
    <button type="button" onClick={goBack} className={className} aria-label={resolvedAriaLabel}>
      <Icon className="h-6 w-6" />
    </button>
  );
}

type BackLinkProps = {
  fallbackTo: string;
  children: React.ReactNode;
  className?: string;
};

export function BackLink({ fallbackTo, children, className }: BackLinkProps) {
  const goBack = useGoBack(fallbackTo);

  return (
    <button type="button" onClick={goBack} className={className}>
      {children}
    </button>
  );
}
