import {DomainError} from './errors.js';

/**
 * Decimal exato de ponto fixo (9 casas) sobre BigInt — para medidas e contas de orçamento.
 * Evita o erro do ponto flutuante binário (4,5 × 3,9 × 1,1 = 19,305000000000003 em `number`).
 * Dinheiro final é arredondado para centavos só na apresentação/lançamento (`toCents`).
 */
const SCALE = 9;
const FACTOR = 10n ** BigInt(SCALE);

export interface Dec {
  /** valor × 10⁹ */
  readonly units: bigint;
}

const fromUnits = (units: bigint): Dec => ({units});

/** Aceita "4.50", "4,50", 4.5 ou bigint. Mais de 9 casas decimais é recusado (perda de precisão). */
export function dec(input: string | number | bigint | Dec): Dec {
  if (typeof input === 'object') return input;
  if (typeof input === 'bigint') return fromUnits(input * FACTOR);
  let text: string;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new DomainError('numero_invalido', 'Número inválido.');
    text = String(input);
    if (/e/i.test(text)) throw new DomainError('numero_invalido', 'Use o número sem notação científica.');
  } else {
    text = input.trim().replace(',', '.');
  }
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new DomainError('numero_invalido', 'Número inválido.', {valor: String(input)});
  const [, sign, whole, frac = ''] = match;
  if (frac.length > SCALE) throw new DomainError('precisao_excedida', 'Use no máximo 9 casas decimais.');
  const units = BigInt(whole!) * FACTOR + BigInt(frac.padEnd(SCALE, '0') || '0');
  return fromUnits(sign === '-' ? -units : units);
}

export const ZERO = fromUnits(0n);
export const add = (a: Dec, b: Dec): Dec => fromUnits(a.units + b.units);
export const sub = (a: Dec, b: Dec): Dec => fromUnits(a.units - b.units);

/** Arredondamento "meio para cima" (afastando do zero) na escala interna. */
function roundDiv(n: bigint, d: bigint): bigint {
  const negative = n < 0n !== d < 0n;
  const absN = n < 0n ? -n : n;
  const absD = d < 0n ? -d : d;
  const q = (absN + absD / 2n) / absD;
  return negative ? -q : q;
}

export const mul = (a: Dec, b: Dec): Dec => fromUnits(roundDiv(a.units * b.units, FACTOR));
export function div(a: Dec, b: Dec): Dec {
  if (b.units === 0n) throw new DomainError('divisao_por_zero', 'Divisão por zero.');
  return fromUnits(roundDiv(a.units * FACTOR, b.units));
}

export const cmp = (a: Dec, b: Dec): -1 | 0 | 1 => (a.units < b.units ? -1 : a.units > b.units ? 1 : 0);
export const isPositive = (a: Dec): boolean => a.units > 0n;
export const isNegative = (a: Dec): boolean => a.units < 0n;

/** Arredonda para cima até inteiro (ex.: quantas embalagens comprar). */
export function ceilInt(a: Dec): bigint {
  const q = a.units / FACTOR;
  return a.units % FACTOR === 0n || a.units < 0n ? q : q + 1n;
}

/** Texto com o número exato de casas (sem arredondar o valor interno além do pedido, meio para cima). */
export function toFixed(a: Dec, places: number): string {
  const step = 10n ** BigInt(SCALE - places);
  const rounded = roundDiv(a.units, step);
  const negative = rounded < 0n;
  const abs = negative ? -rounded : rounded;
  const base = 10n ** BigInt(places);
  const whole = abs / base;
  const frac = places ? '.' + (abs % base).toString().padStart(places, '0') : '';
  return (negative ? '-' : '') + whole.toString() + frac;
}

/** Valor em reais → centavos inteiros, meio para cima. */
export const toCents = (reais: Dec): bigint => roundDiv(reais.units, FACTOR / 100n);

/** Texto canônico sem zeros à direita (para comparar em testes e mostrar a memória de cálculo). */
export function toPlain(a: Dec): string {
  const text = toFixed(a, SCALE);
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}
