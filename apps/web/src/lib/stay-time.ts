/** Converte o horário digitado no fuso do condomínio em um instante da API. */
export function localStayTime(value: string, timezone: string): string {
  const date = new Date(value + ':00Z');
  if (Number.isNaN(date.getTime())) throw new Error('periodo_invalido');
  const read = new Intl.DateTimeFormat('en-GB', {timeZone: timezone, timeZoneName: 'longOffset'});
  const offset = (instant: Date) => {
    const text = read.formatToParts(instant).find((p) => p.type === 'timeZoneName')?.value;
    const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(text ?? '');
    return match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
  };
  const tentative = new Date(date.getTime() - offset(date) * 60_000);
  const resolved = new Date(date.getTime() - offset(tentative) * 60_000);
  if (stayTimeInput(resolved, timezone) !== value) throw new Error('periodo_invalido');
  return resolved.toISOString();
}

export function stayTimeInput(value: string | Date, timezone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function displayStayTime(value: string, timezone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {timeZone: timezone, dateStyle: 'short', timeStyle: 'short'}).format(
    new Date(value),
  );
}
