import type { PieceListItem } from './piece';

export type PieceListSort =
  | 'title_asc'
  | 'created_desc'
  | 'created_asc'
  | 'performances_year_desc'
  | 'performances_year_asc';

export const DEFAULT_PIECE_LIST_SORT: PieceListSort = 'title_asc';

export function sortPieceListItems(
  items: PieceListItem[],
  sort: PieceListSort = DEFAULT_PIECE_LIST_SORT,
): PieceListItem[] {
  const copy = [...items];

  copy.sort((a, b) => {
    switch (sort) {
      case 'created_desc': {
        const byDate = b.createdAt.localeCompare(a.createdAt);
        return byDate !== 0 ? byDate : a.title.localeCompare(b.title, 'pt-BR');
      }
      case 'created_asc': {
        const byDate = a.createdAt.localeCompare(b.createdAt);
        return byDate !== 0 ? byDate : a.title.localeCompare(b.title, 'pt-BR');
      }
      case 'performances_year_desc': {
        const byCount = b.performancesThisYear - a.performancesThisYear;
        return byCount !== 0 ? byCount : a.title.localeCompare(b.title, 'pt-BR');
      }
      case 'performances_year_asc': {
        const byCount = a.performancesThisYear - b.performancesThisYear;
        return byCount !== 0 ? byCount : a.title.localeCompare(b.title, 'pt-BR');
      }
      case 'title_asc':
      default:
        return a.title.localeCompare(b.title, 'pt-BR');
    }
  });

  return copy;
}
