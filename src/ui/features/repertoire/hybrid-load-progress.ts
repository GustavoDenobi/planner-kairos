/** Fração da barra reservada ao progresso “inicial” (antes do download mensurável). */
export const HYBRID_LOAD_FAKE_MAX = 0.25;

/** Duração do progresso inicial com ease-out. */
export const HYBRID_LOAD_FAKE_DURATION_MS = 5000;

export type PdfDownloadProgressHandler = (loaded: number, total: number) => void;

/** Ease-out cúbico: t ∈ [0, 1] → [0, 1]. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
}

/** Progresso simulado (0–25%) em função do tempo desde o início. */
export function fakeLoadBarFraction(elapsedMs: number): number {
  const t = elapsedMs / HYBRID_LOAD_FAKE_DURATION_MS;
  return HYBRID_LOAD_FAKE_MAX * easeOutCubic(t);
}

const UNKNOWN_SIZE_SCALE_BYTES = 512 * 1024;

/** Mapeia bytes baixados para a faixa 25–100% da barra. */
export function realDownloadBarFraction(loaded: number, total: number): number {
  const realSpan = 1 - HYBRID_LOAD_FAKE_MAX;

  if (total > 0) {
    const ratio = Math.min(1, Math.max(0, loaded / total));
    return HYBRID_LOAD_FAKE_MAX + realSpan * ratio;
  }

  if (loaded <= 0) {
    return 0;
  }

  const estimate = 1 - Math.exp(-loaded / UNKNOWN_SIZE_SCALE_BYTES);
  return HYBRID_LOAD_FAKE_MAX + realSpan * 0.92 * estimate;
}

/** Combina progresso simulado e real — a barra nunca recua. */
export function combineHybridLoadBarFraction(
  elapsedMs: number,
  loaded: number,
  total: number,
): number {
  const fake = fakeLoadBarFraction(elapsedMs);
  const real = realDownloadBarFraction(loaded, total);
  return Math.min(1, Math.max(fake, real));
}
