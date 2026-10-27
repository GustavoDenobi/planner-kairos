/**
 * Faixa de detecção do afinador (YIN via @audio-ui/core).
 * minHz ~27 cobre tuba em Si♭ grave (~29 Hz) e contrabaixo; o teto anterior (60 Hz)
 * cortava Mi₁/Lá₁ e forçava leitura de harmônicos (oitava errada ou silêncio).
 */
export const TUNER_PITCH_MIN_HZ = 27;
export const TUNER_PITCH_MAX_HZ = 2000;

/** Janela maior melhora fundamentais graves (YIN precisa de períodos longos no buffer). */
export const TUNER_ANALYSER_FFT_SIZE = 8192;
