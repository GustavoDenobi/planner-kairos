type LessonMissingDirectedLayerBannerProps = {
  audienceLabel: string;
  isEnsuring: boolean;
  onEnsure: () => void;
};

export function LessonMissingDirectedLayerBanner({
  audienceLabel,
  isEnsuring,
  onEnsure,
}: LessonMissingDirectedLayerBannerProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border bg-amber-500/10 px-3 py-2 text-center text-sm text-text">
      <span>
        Não há camada de anotação para <strong className="font-medium">{audienceLabel}</strong> neste
        arquivo.
      </span>
      <button
        type="button"
        onClick={onEnsure}
        disabled={isEnsuring}
        className="rounded-lg border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary disabled:opacity-60"
      >
        {isEnsuring ? 'Criando…' : 'Usar camada da aula aqui'}
      </button>
    </div>
  );
}