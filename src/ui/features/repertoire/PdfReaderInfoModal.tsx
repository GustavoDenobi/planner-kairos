import { CategoryBadge } from '@/ui/components/CategoryBadge';
import { Modal } from '@/ui/components/Modal';
import { IconArrowDown, IconPrint, IconShare } from '@/ui/components/icons';
import { shouldSharePdfInsteadOfPrint } from '@/ui/features/repertoire/pdf-delivery';
import { downloadFromUrl } from '@/ui/utils/download-url';

export type PdfReaderPieceInfo = {
  title: string;
  composer?: string | null;
  category?: { name: string; color: string | null; slug: string } | null;
  themes?: Array<{ id: string; name: string }>;
  aliases?: string[];
  description?: string | null;
  notes?: string | null;
};

export type PdfReaderPartInfo = {
  title: string;
  partLabel?: string;
  originalName?: string | null;
};

type PdfReaderInfoModalProps = {
  open: boolean;
  onClose: () => void;
  piece: PdfReaderPieceInfo;
  part: PdfReaderPartInfo;
  allowDownload?: boolean;
  downloadUrl?: string | null;
  downloadName?: string;
  onPrint?: () => void;
};

export function PdfReaderInfoModal({
  open,
  onClose,
  piece,
  part,
  allowDownload = true,
  downloadUrl,
  downloadName,
  onPrint,
}: PdfReaderInfoModalProps) {
  const showDownload = allowDownload && Boolean(downloadUrl);
  const showPrint = allowDownload && Boolean(onPrint);
  const shareInsteadOfPrint = showPrint && shouldSharePdfInsteadOfPrint();
  const showActions = showDownload || showPrint;

  async function handleDownload() {
    if (!downloadUrl) {
      return;
    }
    try {
      await downloadFromUrl(downloadUrl, downloadName);
    } catch {
      /* Keep the modal open if the download cannot start. */
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={part.title} size="lg">
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-text">Obra</h3>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-medium text-text">{piece.title}</p>
              {piece.category ? (
                <CategoryBadge
                  label={piece.category.name}
                  color={piece.category.color}
                  slug={piece.category.slug}
                />
              ) : null}
            </div>
            {piece.composer ? (
              <div>
                <p className="text-xs font-medium text-text">Compositor</p>
                <p className="mt-0.5 text-sm text-muted">{piece.composer}</p>
              </div>
            ) : null}
            {piece.themes && piece.themes.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {piece.themes.map((theme) => (
                  <span
                    key={theme.id}
                    className="rounded-full border border-border px-2 py-0.5 text-xs text-muted"
                  >
                    {theme.name}
                  </span>
                ))}
              </div>
            ) : null}
            {piece.aliases && piece.aliases.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-text">Apelidos</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {piece.aliases.map((alias) => (
                    <span
                      key={alias}
                      className="rounded-full border border-border px-2 py-0.5 text-xs text-muted"
                    >
                      {alias}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {piece.description ? (
              <div>
                <p className="text-xs font-medium text-text">Descrição</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{piece.description}</p>
              </div>
            ) : null}
            {piece.notes ? (
              <div>
                <p className="text-xs font-medium text-text">Notas</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{piece.notes}</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="text-sm font-medium text-text">Parte</h3>
          <div className="space-y-1 text-sm">
            <p className="font-medium text-text">{part.title}</p>
            {part.partLabel ? (
              <p className="text-muted">
                <span className="font-medium text-text">Instrumento: </span>
                {part.partLabel}
              </p>
            ) : null}
            {part.originalName ? (
              <p className="text-muted">
                <span className="font-medium text-text">Arquivo: </span>
                {part.originalName}
              </p>
            ) : null}
          </div>
        </section>

        {showActions ? (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {showDownload ? (
              <button
                type="button"
                onClick={() => void handleDownload()}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text transition-colors hover:bg-bg"
              >
                <IconArrowDown className="h-4 w-4 shrink-0" aria-hidden />
                Baixar
              </button>
            ) : null}
            {showPrint ? (
              <button
                type="button"
                onClick={onPrint}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text transition-colors hover:bg-bg"
              >
                {shareInsteadOfPrint ? (
                  <IconShare className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <IconPrint className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {shareInsteadOfPrint ? 'Compartilhar' : 'Imprimir'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
