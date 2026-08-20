import { useEffect, useRef } from 'react';
import { Modal } from '@/ui/components/Modal';
import { IconArrowDown } from '@/ui/components/icons';
import { downloadFromUrl } from '@/ui/utils/download-url';

type AudioPlayerModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  url: string | null;
  downloadName?: string;
  isLoading?: boolean;
  error?: string | null;
};

export function AudioPlayerModal({
  open,
  onClose,
  title,
  url,
  downloadName,
  isLoading = false,
  error = null,
}: AudioPlayerModalProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {isLoading && <p className="text-sm text-muted">Carregando áudio…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!isLoading && !error && url && (
          <audio ref={audioRef} controls className="w-full" src={url}>
            Seu navegador não suporta reprodução de áudio.
          </audio>
        )}
        {url && (
          <div className="flex justify-center border-t border-border pt-4">
            <button
              type="button"
              onClick={() => {
                if (!url) {
                  return;
                }
                void downloadFromUrl(url, downloadName).catch(() => {});
              }}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <IconArrowDown className="h-4 w-4" />
              Baixar arquivo
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
