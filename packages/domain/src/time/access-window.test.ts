import {describe, expect, it} from 'vitest';
import {guestAppWindow, isGuestAppAccessAllowed, physicalEntryWindow, isWithin} from './access-window.js';
import {DomainError} from '../errors.js';

// Exemplo da especificação (§7), em America/Sao_Paulo (UTC−3, sem horário de verão):
// check-in 20/12/2026 14h, checkout 22/12/2026 11h → app de 20/12 11h até antes de 22/12 11h30.
const stay = {
  checkInAt: new Date('2026-12-20T14:00:00-03:00'),
  checkOutAt: new Date('2026-12-22T11:00:00-03:00'),
};
const at = (iso: string) => new Date(iso);

describe('janela do hóspede (relógio do servidor)', () => {
  it('calcula início −3 h e fim +30 min', () => {
    const w = guestAppWindow(stay);
    expect(w.startsAt.toISOString()).toBe(at('2026-12-20T11:00:00-03:00').toISOString());
    expect(w.endsAt.toISOString()).toBe(at('2026-12-22T11:30:00-03:00').toISOString());
  });

  it('T07 — um instante antes de check-in menos 3 h é negado', () => {
    expect(isGuestAppAccessAllowed(stay, at('2026-12-20T10:59:59.999-03:00'))).toBe(false);
  });

  it('T08 — exatamente no início a consulta é permitida', () => {
    expect(isGuestAppAccessAllowed(stay, at('2026-12-20T11:00:00-03:00'))).toBe(true);
  });

  it('T09 — exatamente em checkout mais 30 min já está encerrado', () => {
    expect(isGuestAppAccessAllowed(stay, at('2026-12-22T11:29:59.999-03:00'))).toBe(true);
    expect(isGuestAppAccessAllowed(stay, at('2026-12-22T11:30:00-03:00'))).toBe(false);
  });

  it('a entrada física vai do check-in ao checkout: os 30 min extras não prolongam a ocupação', () => {
    const fisica = physicalEntryWindow(stay);
    expect(isWithin(fisica, at('2026-12-20T13:59:59-03:00'))).toBe(false);
    expect(isWithin(fisica, at('2026-12-20T14:00:00-03:00'))).toBe(true);
    expect(isWithin(fisica, at('2026-12-22T11:00:00-03:00'))).toBe(false);
  });

  it('saída antes ou igual à entrada é recusada', () => {
    expect(() => guestAppWindow({checkInAt: stay.checkInAt, checkOutAt: stay.checkInAt})).toThrow(
      DomainError,
    );
  });

  it('uma estadia futura não prolonga outra já encerrada: cada janela é da própria estadia', () => {
    const proxima = {
      checkInAt: new Date('2026-12-22T14:00:00-03:00'),
      checkOutAt: new Date('2026-12-24T11:00:00-03:00'),
    };
    const agora = at('2026-12-22T12:00:00-03:00');
    expect(isGuestAppAccessAllowed(stay, agora)).toBe(false); // a anterior acabou às 11h30
    expect(isGuestAppAccessAllowed(proxima, agora)).toBe(true); // a próxima abriu às 11h
  });
});
