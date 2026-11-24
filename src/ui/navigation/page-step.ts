/**
 * Marca entradas do histórico criadas por uma etapa dentro da mesma página
 * (ex.: menu → obras → grupo → categoria). Quando a entrada atual tem a marca,
 * a anterior é a etapa-mãe e "voltar" pode simplesmente recuar no histórico.
 */
export const PAGE_STEP_STATE = { pageStep: true } as const;

export function isPageStepState(state: unknown): boolean {
  return (state as { pageStep?: unknown } | null)?.pageStep === true;
}
