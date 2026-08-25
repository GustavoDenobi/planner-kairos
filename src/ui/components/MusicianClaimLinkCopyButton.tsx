import { useState } from 'react';
import { IconCheck, IconLink } from '@/ui/components/icons';

type MusicianClaimLinkCopyButtonProps = {
  musicianId: string;
  musicianName: string;
  className?: string;
};

export function MusicianClaimLinkCopyButton({
  musicianId,
  musicianName,
  className,
}: MusicianClaimLinkCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/musico/${musicianId}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Link copiado!' : 'Copiar link de cadastro'}
      aria-label={
        copied
          ? `Link de cadastro de ${musicianName} copiado`
          : `Copiar link de cadastro de ${musicianName}`
      }
      className={
        className ??
        'mr-2 inline-flex shrink-0 items-center justify-center rounded-lg border border-border p-2 text-muted transition-colors hover:bg-bg hover:text-text'
      }
    >
      {copied ? <IconCheck className="h-5 w-5" /> : <IconLink className="h-5 w-5" />}
    </button>
  );
}
