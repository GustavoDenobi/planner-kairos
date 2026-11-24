import { programUnitIdentityKey } from './append-event-program-score';
import type { ProgramItemUnitInput } from './program-item';

type UnitIdentity = Pick<
  ProgramItemUnitInput,
  'pieceFileId' | 'pieceFileTocEntryId' | 'navigationShortcutId' | 'startPage' | 'endPage'
>;

/** Uma linha da programação de um evento que contém a obra. Sem unidades = obra inteira. */
export type PieceProgramEntry = {
  eventId: string;
  units: UnitIdentity[];
};

export type AppendPieceToEventStatus = 'added' | 'not_found' | 'cancelled' | 'forbidden';

export type AppendPieceToEventResult = {
  eventId: string;
  status: AppendPieceToEventStatus;
};

/** Assinatura de uma linha da programação, independente de ordem e rótulo dos trechos. */
export function programUnitsSignature(units: UnitIdentity[]): string {
  return units
    .map((unit) => programUnitIdentityKey(unit))
    .sort()
    .join('||');
}

function isUnrestrictedUnit(unit: UnitIdentity): boolean {
  return (
    unit.pieceFileTocEntryId == null &&
    unit.navigationShortcutId == null &&
    unit.startPage == null &&
    unit.endPage == null
  );
}

/**
 * Sem trechos, ou só arquivos completos. Em obras de arquivo único ou por instrumento (no máximo
 * um trecho por linha), o arquivo completo equivale à obra inteira.
 */
function isWholePieceEntry(units: UnitIdentity[]): boolean {
  return units.every(isUnrestrictedUnit);
}

/**
 * Eventos cuja programação já tem a obra com o mesmo conteúdo que será adicionado:
 * obra inteira contra obra inteira, ou o mesmo conjunto de trechos.
 *
 * `fullFileIsWholePiece` deve ser falso em obras sequenciais (lições), onde cada arquivo
 * completo é uma parte diferente da obra; aí só conta o mesmo conjunto exato.
 */
export function findEventsWithSamePieceEntry(
  entries: PieceProgramEntry[],
  newUnits: UnitIdentity[],
  options: { fullFileIsWholePiece?: boolean } = {},
): Set<string> {
  const signature = programUnitsSignature(newUnits);
  const newIsWhole = options.fullFileIsWholePiece === true && isWholePieceEntry(newUnits);
  const eventIds = new Set<string>();
  for (const entry of entries) {
    const sameSignature = programUnitsSignature(entry.units) === signature;
    const bothWhole = newIsWhole && isWholePieceEntry(entry.units);
    if (sameSignature || bothWhole) {
      eventIds.add(entry.eventId);
    }
  }
  return eventIds;
}
