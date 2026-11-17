import { useState } from 'react';
import { IconCheck, IconLink } from '@/ui/components/icons';
import { useEnsemble } from '@/ui/app/AppServicesContext';

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
  const ensemble = useEnsemble();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const result = await ensemble.ensureMusicianClaimToken(musicianId);
    if (!result.ok) {
      return;
    }

    await navigator.clipboard.writeText(`${window.location.origin}/reivindicar/${result.value}`);
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
