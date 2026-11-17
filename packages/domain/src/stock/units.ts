import {DomainError} from '../errors.js';
import {dec, mul, div, type Dec} from '../decimal.js';

/**
 * Unidades do estoque (especificação §12): kg↔g e L↔mL convertem dentro da mesma grandeza; massa↔volume
 * NUNCA sem densidade documentada (com fonte); contagem (un) não converte para nada (T32).
 */
export type StockUnit = 'kg' | 'g' | 'L' | 'mL' | 'un';
export type Dimension = 'massa' | 'volume' | 'contagem';

const TABLE: Record<StockUnit, {dimension: Dimension; toBase: string}> = {
  kg: {dimension: 'massa', toBase: '1000'},
  g: {dimension: 'massa', toBase: '1'},
  L: {dimension: 'volume', toBase: '1000'},
  mL: {dimension: 'volume', toBase: '1'},
  un: {dimension: 'contagem', toBase: '1'},
};

export const dimensionOf = (unit: StockUnit): Dimension => {
  const entry = TABLE[unit];
  if (!entry) throw new DomainError('unidade_invalida', `Unidade desconhecida: ${String(unit)}.`);
  return entry.dimension;
};

export interface Density {
  /** kg por litro */
  kgPerL: string | number;
  /** origem documentada (FDS, rótulo, laudo) — obrigatória */
  source: string;
}

export function convertQuantity(
  quantity: string | number | Dec,
  from: StockUnit,
  to: StockUnit,
  density?: Density,
): Dec {
  const q = dec(quantity);
  const a = TABLE[from];
  const b = TABLE[to];
  if (!a || !b) throw new DomainError('unidade_invalida', 'Unidade desconhecida.');
  if (a.dimension === b.dimension) return div(mul(q, dec(a.toBase)), dec(b.toBase));
  const massVolume =
    (a.dimension === 'massa' && b.dimension === 'volume') ||
    (a.dimension === 'volume' && b.dimension === 'massa');
  if (!massVolume)
    throw new DomainError(
      'conversao_invalida',
      `Não se converte ${from} em ${to}: são grandezas diferentes.`,
    );
  if (!density || !density.source?.trim())
    throw new DomainError(
      'conversao_sem_densidade',
      `Converter ${from} em ${to} exige densidade documentada (FDS ou rótulo), com a fonte.`,
    );
  const kgPerL = dec(density.kgPerL);
  if (a.dimension === 'massa') {
    const liters = div(div(mul(q, dec(a.toBase)), dec(1000)), kgPerL);
    return div(mul(liters, dec(1000)), dec(b.toBase));
  }
  const kg = mul(div(mul(q, dec(a.toBase)), dec(1000)), kgPerL);
  return div(mul(kg, dec(1000)), dec(b.toBase));
}
