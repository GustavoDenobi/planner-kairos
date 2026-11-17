import { useEffect, useState } from 'react';
import { useEnsemble } from '@/ui/app/AppServicesContext';

type MusicianLinkCopyProps = {
  musicianId: string;
};

export function MusicianLinkCopy({ musicianId }: MusicianLinkCopyProps) {
  const ensemble = useEnsemble();
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void ensemble.ensureMusicianClaimToken(musicianId).then((result) => {
      if (!active) {
        return;
      }

      if (!result.ok) {
        setError(true);
        setUrl('');
        return;
      }

      setError(false);
      setUrl(`${window.location.origin}/reivindicar/${result.value}`);
    });

    return () => {
      active = false;
    };
  }, [ensemble, musicianId]);

  async function handleCopy() {
    if (!url) {
      return;
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="text"
        readOnly
        value={error ? 'Não foi possível gerar o link' : url || 'Gerando link…'}
        className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text"
      />
      <button
        type="button"
        onClick={handleCopy}
        disabled={!url}
        className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text hover:bg-surface disabled:opacity-50"
      >
        {copied ? 'Copiado!' : 'Copiar link'}
      </button>
    </div>
  );
}
