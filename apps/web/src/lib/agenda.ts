import {stayTimeInput} from './stay-time';
import type {Stay} from './stays';

/** Trabalha com datas civis. Somar dias aqui não depende do DST do aparelho. */
export const asCivilDate = (date: string) => new Date(`${date}T12:00:00Z`);

export function addDays(date: string, days: number): string {
  const value = asCivilDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function weekStart(date: string): string {
  return addDays(date, -((asCivilDate(date).getUTCDay() + 6) % 7));
}

export const dayOf = (instant: string, timezone: string) => stayTimeInput(instant, timezone).slice(0, 10);

export type StayEvent = {stay: Stay; kind: 'in' | 'out'; time: string};

export function stayEvents(stays: Stay[], day: string, timezone: string): StayEvent[] {
  const result: StayEvent[] = [];
  for (const stay of stays) {
    if (stay.status !== 'confirmed' && stay.status !== 'pending') continue;
    if (dayOf(stay.checkInAt, timezone) === day) result.push({stay, kind: 'in', time: stay.checkInAt});
    if (dayOf(stay.checkOutAt, timezone) === day) result.push({stay, kind: 'out', time: stay.checkOutAt});
  }
  return result.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}

/** Uma faixa por estadia. O checkout aparece na agenda, e a última noite termina antes do dia de saída. */
export function occupancyRows(stays: Stay[], days: string[], timezone: string) {
  const segments: {stay: Stay; start: number; end: number; row: number}[] = [];
  const rowEnds: number[] = [];
  for (const stay of [...stays].sort((a, b) => Date.parse(a.checkInAt) - Date.parse(b.checkInAt))) {
    if (stay.status !== 'confirmed' && stay.status !== 'pending') continue;
    const first = dayOf(stay.checkInAt, timezone);
    const checkout = dayOf(stay.checkOutAt, timezone);
    const last = first === checkout ? addDays(first, 1) : checkout;
    const start = days.findIndex((date) => date >= first && date < last);
    if (start === -1) continue;
    const stop = days.findIndex((date) => date >= last);
    const end = stop === -1 ? days.length : stop;
    const available = rowEnds.findIndex((rowEnd) => rowEnd <= start);
    const row = available === -1 ? rowEnds.length : available;
    rowEnds[row] = end;
    segments.push({stay, start, end, row});
  }
  return {segments, rowCount: Math.max(1, rowEnds.length)};
}
