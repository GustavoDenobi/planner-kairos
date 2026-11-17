import { useState } from 'react';
import { practiceSubmissionFileExtension } from '@/domain/practice';
import { usePractice } from '@/ui/app/AppServicesContext';
import { IconDownload, IconLoader, IconPlay } from '@/ui/components/icons';
import { canBrowserPlayAudio } from '@/ui/features/practice/audio-playback';
import { practiceErrorMessage } from '@/ui/features/practice/practice-labels';

type PracticeSubmissionAudioProps = {
  organizationId: string;
  submissionId: string;
  /** Formato gravado (ex.: WebM no Android, MP4 no iPhone). */
  mimeType: string;
};

/** Fica dentro de cards brancos: preenchido com o cinza do fundo, não só contorno. */
const downloadButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm font-medium text-text hover:border-primary/40 disabled:opacity-50';

/** Busca a URL assinada só quando a pessoa pede para ouvir. */
export function PracticeSubmissionAudio({
  organizationId,
  submissionId,
  mimeType,
}: PracticeSubmissionAudioProps) {
  const practice = usePractice();
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unplayable, setUnplayable] = useState(() => !canBrowserPlayAudio(mimeType));

  async function fetchUrl(): Promise<string | null> {
    if (url) {
      return url;
    }
    setIsLoading(true);
    setError(null);
    const result = await practice.getSubmissionAudioUrl(organizationId, submissionId);
    setIsLoading(false);
    if (!result.ok) {
      setError(practiceErrorMessage(result.error));
      return null;
    }
    setUrl(result.value);
    return result.value;
  }

  async function download() {
    const target = await fetchUrl();
    if (!target) {
      return;
    }
    setIsDownloading(true);
    setError(null);
    try {
      // A URL assinada é de outro domínio: `download` no link seria ignorado.
      const response = await fetch(target);
      if (!response.ok) {
        throw new Error(String(response.status));
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `entrega.${practiceSubmissionFileExtension(mimeType)}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    } catch {
      setError('Não foi possível baixar o áudio. Tente novamente.');
    } finally {
      setIsDownloading(false);
    }
  }

  const downloadButton = (
    <button
      type="button"
      onClick={() => void download()}
      disabled={isLoading || isDownloading}
      className={downloadButtonClass}
    >
      {isLoading || isDownloading ? (
        <IconLoader className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <IconDownload className="h-4 w-4" aria-hidden />
      )}
      Baixar áudio
    </button>
  );

  const errorText = error ? (
    <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
  ) : null;

  if (unplayable) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted">
          Este aparelho não reproduz o formato desta gravação. Baixe o arquivo para ouvir em outro
          app.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {downloadButton}
          {errorText}
        </div>
      </div>
    );
  }

  if (url) {
    return (
      <audio
        controls
        autoPlay
        src={url}
        className="h-10 w-full"
        preload="auto"
        onError={(event) => {
          // Só formato/decodificação; erro de rede mantém o player (o usuário pode tentar de novo).
          const code = event.currentTarget.error?.code;
          if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || code === MediaError.MEDIA_ERR_DECODE) {
            setUnplayable(true);
          }
        }}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void fetchUrl()}
        disabled={isLoading}
        className={downloadButtonClass}
      >
        {isLoading ? (
          <IconLoader className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <IconPlay className="h-4 w-4" aria-hidden />
        )}
        Ouvir
      </button>
      {errorText}
    </div>
  );
}
