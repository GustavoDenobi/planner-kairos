import { DEFAULT_ORGANIZATION_TIME_ZONE } from '@/domain/practice';

/** Fusos do Brasil primeiro: são os que quase toda organização usa. */
const BRAZIL_TIME_ZONES = [
  'America/Sao_Paulo',
  'America/Bahia',
  'America/Fortaleza',
  'America/Recife',
  'America/Belem',
  'America/Manaus',
  'America/Cuiaba',
  'America/Campo_Grande',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Rio_Branco',
  'America/Noronha',
];

function allTimeZones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

function utcOffsetLabel(timeZone: string): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((item) => item.type === 'timeZoneName');
    return part?.value.replace('GMT', 'UTC') ?? '';
  } catch {
    return '';
  }
}

export type TimeZoneOption = { value: string; label: string };

/** Opções para o seletor: Brasil, depois o resto em ordem alfabética. */
export function timeZoneOptions(current: string): TimeZoneOption[] {
  const all = allTimeZones();
  const brazil = BRAZIL_TIME_ZONES.filter((zone) => all.length === 0 || all.includes(zone));
  const rest = all.filter((zone) => !brazil.includes(zone));
  const zones = [...brazil, ...rest];
  if (!zones.includes(current)) {
    zones.unshift(current || DEFAULT_ORGANIZATION_TIME_ZONE);
  }
  return zones.map((zone) => {
    const offset = utcOffsetLabel(zone);
    const name = zone.replace(/_/g, ' ');
    return { value: zone, label: offset ? `${name} (${offset})` : name };
  });
}
