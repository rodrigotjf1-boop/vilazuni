import {DomainError} from '../errors.js';

/**
 * Janela do hóspede (especificação §7):
 *   início = check-in − 3 h; fim = checkout + 30 min; permitido quando início ≤ agora < fim.
 * Calculada sobre INSTANTES (UTC) — não depende de fuso, nem do relógio do aparelho: o `agora` é sempre o do
 * servidor (relógio injetável). A janela do app é informativa; a entrada física vai do check-in ao checkout.
 */
export const GUEST_APP_LEAD_MS = 3 * 60 * 60 * 1000;
export const GUEST_APP_TAIL_MS = 30 * 60 * 1000;

export interface StayPeriod {
  checkInAt: Date;
  checkOutAt: Date;
}

export interface Window {
  startsAt: Date;
  endsAt: Date;
}

export function assertValidPeriod({checkInAt, checkOutAt}: StayPeriod): void {
  if (!(checkInAt instanceof Date) || Number.isNaN(checkInAt.getTime()))
    throw new DomainError('periodo_invalido', 'Informe a data e a hora de entrada.');
  if (!(checkOutAt instanceof Date) || Number.isNaN(checkOutAt.getTime()))
    throw new DomainError('periodo_invalido', 'Informe a data e a hora de saída.');
  if (checkOutAt.getTime() <= checkInAt.getTime())
    throw new DomainError('periodo_invalido', 'A saída precisa ser depois da entrada.');
}

/** Janela em que o hóspede consulta o app (informação pré-chegada até 30 min depois da saída). */
export function guestAppWindow(period: StayPeriod): Window {
  assertValidPeriod(period);
  return {
    startsAt: new Date(period.checkInAt.getTime() - GUEST_APP_LEAD_MS),
    endsAt: new Date(period.checkOutAt.getTime() + GUEST_APP_TAIL_MS),
  };
}

/** Entrada física: do check-in ao checkout. Os 30 min extras do app NÃO prolongam a ocupação. */
export function physicalEntryWindow(period: StayPeriod): Window {
  assertValidPeriod(period);
  return {startsAt: new Date(period.checkInAt.getTime()), endsAt: new Date(period.checkOutAt.getTime())};
}

/** Intervalo semiaberto [início, fim): exatamente no fim já está encerrado. */
export function isWithin(window: Window, now: Date): boolean {
  const t = now.getTime();
  return window.startsAt.getTime() <= t && t < window.endsAt.getTime();
}

export const isGuestAppAccessAllowed = (period: StayPeriod, now: Date): boolean =>
  isWithin(guestAppWindow(period), now);
