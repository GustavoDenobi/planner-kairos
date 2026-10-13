import type { ReactNode } from 'react';

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-md bg-border/80 ${className}`.trim()}
    />
  );
}

type LoadingSkeletonProps = {
  label?: string;
  children: ReactNode;
  className?: string;
};

/** Região de carregamento com skeleton — mantém texto acessível para leitores de tela. */
export function LoadingSkeleton({
  label = 'Carregando',
  children,
  className = '',
}: LoadingSkeletonProps) {
  return (
    <div aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
