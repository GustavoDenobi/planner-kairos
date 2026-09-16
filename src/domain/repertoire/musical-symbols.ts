export type MusicalSymbolCategory =
  | 'repetition'
  | 'dynamics'
  | 'articulation'
  | 'strings';

export type MusicalSymbol = {
  id: string;
  label: string;
  char: string;
  category: MusicalSymbolCategory;
};

export const MUSICAL_SYMBOL_CATEGORY_LABELS: Record<MusicalSymbolCategory, string> = {
  repetition: 'Repetição',
  dynamics: 'Dinâmica',
  articulation: 'Articulação',
  strings: 'Cordas',
};

/** SMuFL codepoints (Bravura Text). Repetition labels use plain text. */
export const MUSICAL_SYMBOLS: MusicalSymbol[] = [
  { id: 'segno', label: 'Segno', char: '\uE047', category: 'repetition' },
  { id: 'coda', label: 'Coda', char: '\uE048', category: 'repetition' },
  { id: 'fine', label: 'Fine', char: 'Fine', category: 'repetition' },
  { id: 'dc', label: 'D.C.', char: 'D.C.', category: 'repetition' },
  { id: 'ds', label: 'D.S.', char: 'D.S.', category: 'repetition' },
  { id: 'p', label: 'p', char: '\uE520', category: 'dynamics' },
  { id: 'pp', label: 'pp', char: '\uE52B', category: 'dynamics' },
  { id: 'ppp', label: 'ppp', char: '\uE52A', category: 'dynamics' },
  { id: 'f', label: 'f', char: '\uE522', category: 'dynamics' },
  { id: 'ff', label: 'ff', char: '\uE52F', category: 'dynamics' },
  { id: 'fff', label: 'fff', char: '\uE530', category: 'dynamics' },
  { id: 'sfz', label: 'sfz', char: '\uE539', category: 'dynamics' },
  { id: 'fp', label: 'fp', char: '\uE534', category: 'dynamics' },
  { id: 'staccato', label: 'Staccato', char: '\uE4A2', category: 'articulation' },
  { id: 'tenuto', label: 'Tenuto', char: '\uE4A4', category: 'articulation' },
  { id: 'accent', label: 'Accent', char: '\uE4A0', category: 'articulation' },
  { id: 'fermata', label: 'Fermata', char: '\uE4C0', category: 'articulation' },
  { id: 'down-bow', label: 'Arco para baixo', char: '\uE610', category: 'strings' },
  { id: 'up-bow', label: 'Arco para cima', char: '\uE612', category: 'strings' },
  { id: 'pizz', label: 'Pizzicato', char: '\uE633', category: 'strings' },
];

export const MUSICAL_SYMBOL_CATEGORIES: MusicalSymbolCategory[] = [
  'repetition',
  'dynamics',
  'articulation',
  'strings',
];

export function musicalSymbolsForCategory(category: MusicalSymbolCategory): MusicalSymbol[] {
  return MUSICAL_SYMBOLS.filter((symbol) => symbol.category === category);
}

export function findMusicalSymbol(id: string): MusicalSymbol | undefined {
  return MUSICAL_SYMBOLS.find((symbol) => symbol.id === id);
}

export function isSmuflPrivateUseCharacter(text: string): boolean {
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint != null && codePoint >= 0xe000 && codePoint <= 0xffff) {
      return true;
    }
  }
  return false;
}
