import {describe, expect, it} from 'vitest';
import {convertQuantity, dimensionOf} from './units.js';
import {toPlain} from '../decimal.js';

describe('T32 — unidades do estoque', () => {
  it('converte dentro da mesma grandeza', () => {
    expect(toPlain(convertQuantity('3,402', 'kg', 'g'))).toBe('3402');
    expect(toPlain(convertQuantity(250, 'mL', 'L'))).toBe('0.25');
  });

  it('não transforma kg em L sem densidade documentada', () => {
    expect(() => convertQuantity(1, 'kg', 'L')).toThrow(/densidade documentada/);
    expect(() => convertQuantity(1, 'L', 'g', {kgPerL: '1.2', source: '  '})).toThrow(
      /densidade documentada/,
    );
  });

  it('com densidade e fonte, converte massa↔volume', () => {
    expect(
      toPlain(convertQuantity(1.2, 'kg', 'L', {kgPerL: '1.2', source: 'FDS do produto, rev. 2025'})),
    ).toBe('1');
    expect(
      toPlain(convertQuantity(500, 'mL', 'g', {kgPerL: '1.2', source: 'FDS do produto, rev. 2025'})),
    ).toBe('600');
  });

  it('contagem (ferramenta, fita) não vira massa nem volume', () => {
    expect(dimensionOf('un')).toBe('contagem');
    expect(() => convertQuantity(3, 'un', 'kg')).toThrow(/grandezas diferentes/);
  });
});
