/** Relógio do SERVIDOR, injetável (os testes de limite temporal usam um relógio fixo). Nunca o do aparelho. */
export interface Clock {
  now(): Date;
}
export const CLOCK = Symbol('CLOCK');
export const systemClock: Clock = {now: () => new Date()};
