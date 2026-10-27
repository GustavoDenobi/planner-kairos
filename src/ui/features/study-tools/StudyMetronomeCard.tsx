import { IconMetronome } from '@/ui/components/icons';
import { PdfViewerMetronomeBar } from '@/ui/features/repertoire/PdfViewerMetronomeBar';

type StudyMetronomeCardProps = {
  userId: string | null;
};

export function StudyMetronomeCard({ userId }: StudyMetronomeCardProps) {
  return (
    <section
      aria-labelledby="study-metronome-heading"
      className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      <h2
        id="study-metronome-heading"
        className="flex shrink-0 items-center gap-2 text-base font-semibold text-text"
      >
        <IconMetronome className="h-5 w-5 shrink-0" aria-hidden />
        Metrônomo
      </h2>
      <div className="mt-4 flex min-h-0 flex-1 flex-col justify-center">
        <PdfViewerMetronomeBar userId={userId} variant="embedded" />
      </div>
    </section>
  );
}
