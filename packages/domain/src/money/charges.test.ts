import {describe, expect, it} from 'vitest';
import {lateFineCents, lateInterestCents} from './charges.js';
import {dec, toCents, mul} from '../decimal.js';

describe('acréscimos por atraso', () => {
  it('multa até 2%, em centavos, meio para cima', () => {
    expect(lateFineCents(50_000n, 200)).toBe(1_000n);
    expect(lateFineCents(12_345n, 200)).toBe(247n); // 246,9 → 247
    expect(() => lateFineCents(50_000n, 201)).toThrow(/até 2%/);
  });

  it('T28 — sem regra de juros cadastrada o resultado é pendente (nunca 1% ao mês)', () => {
    expect(lateInterestCents(50_000n, 30, null)).toEqual({status: 'pendente', missing: ['regra_de_juros']});
    expect(lateInterestCents(50_000n, 30, {annualRateBps: 1200, basis: ''})).toEqual({
      status: 'pendente',
      missing: ['fundamento_da_regra_de_juros'],
    });
  });

  it('juros da convenção: simples, pró-rata por dia', () => {
    const r = lateInterestCents(36_500n, 10, {
      annualRateBps: 1200,
      basis: 'Convenção fictícia de teste, art. X',
    });
    expect(r).toEqual({status: 'ok', value: 120n}); // 365,00 × 12% × 10/365 = 1,20
  });

  it('dinheiro sem ponto flutuante: 0,1 + 0,2 = 0,30 exato', () => {
    expect(toCents(mul(dec('0,1'), dec(3)))).toBe(30n);
  });
});
