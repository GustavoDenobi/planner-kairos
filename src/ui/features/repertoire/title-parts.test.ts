import { describe, expect, it } from 'vitest';
import { distinctTitleParts } from '@/ui/features/repertoire/title-parts';

describe('distinctTitleParts', () => {
  it('fica só com o título do arquivo quando ele começa com o da obra', () => {
    expect(distinctTitleParts(['Sinfonia de Testes', 'Sinfonia de Testes — Grade'])).toEqual([
      'Sinfonia de Testes — Grade',
    ]);
  });

  it('ignora maiúsculas, vazios e repetições exatas', () => {
    expect(distinctTitleParts(['Ave Maria', null, '  ', 'ave maria', 'Violino 1'])).toEqual([
      'Ave Maria',
      'Violino 1',
    ]);
  });

  it('mantém partes diferentes', () => {
    expect(distinctTitleParts(['Messias', 'Soprano', 'Aleluia'])).toEqual(['Messias', 'Soprano', 'Aleluia']);
  });
});
