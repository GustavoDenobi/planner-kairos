import { createContext, useContext } from 'react';

export type PdfViewerChrome = {
  /** A barra de controles está visível (em tela cheia ela some até um toque). */
  controlsVisible: boolean;
};

export const PdfViewerChromeContext = createContext<PdfViewerChrome>({ controlsVisible: true });

/** Estado da barra de controles do leitor, para conteúdos renderizados dentro dela. */
export function usePdfViewerChrome(): PdfViewerChrome {
  return useContext(PdfViewerChromeContext);
}
