function normalize(value: string): string {
  return value.toLocaleLowerCase('pt-BR');
}

/**
 * Junta partes de título sem repetir: vazias e iguais à anterior somem, e quando uma parte
 * começa com a anterior ("Sinfonia" → "Sinfonia — Grade") fica só a mais completa.
 */
export function distinctTitleParts(parts: ReadonlyArray<string | null | undefined>): string[] {
  const values: string[] = [];
  for (const part of parts) {
    const value = part?.trim();
    if (!value) {
      continue;
    }
    const previous = values[values.length - 1];
    if (previous !== undefined) {
      if (normalize(value) === normalize(previous)) {
        continue;
      }
      if (normalize(value).startsWith(normalize(previous))) {
        values[values.length - 1] = value;
        continue;
      }
      if (normalize(previous).startsWith(normalize(value))) {
        continue;
      }
    }
    values.push(value);
  }
  return values;
}
