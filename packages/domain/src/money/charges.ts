import {DomainError, ok, pending, type MaybePending} from '../errors.js';

/**
 * Acréscimos por atraso (especificação §9; Código Civil art. 1.336 §1º com a Lei 14.905/2024):
 * - multa até 2% (200 pontos-base), sobre o principal em centavos;
 * - juros: os da convenção; SEM regra cadastrada o resultado é PENDENTE — nunca "1% ao mês" (T28).
 * Valores em centavos inteiros; arredondamento meio para cima, declarado.
 */
export const MAX_LATE_FINE_BPS = 200;

const halfUpDiv = (n: bigint, d: bigint): bigint => (n + d / 2n) / d;

export function lateFineCents(principalCents: bigint, fineBps: number): bigint {
  if (!Number.isInteger(fineBps) || fineBps < 0)
    throw new DomainError('regra_invalida', 'A multa precisa ser um percentual inteiro em pontos-base.');
  if (fineBps > MAX_LATE_FINE_BPS)
    throw new DomainError(
      'multa_acima_do_limite',
      'A multa do condômino é de até 2% (Código Civil, art. 1.336, § 1º).',
    );
  if (principalCents < 0n) throw new DomainError('valor_invalido', 'O principal não pode ser negativo.');
  return halfUpDiv(principalCents * BigInt(fineBps), 10_000n);
}

export interface InterestRule {
  /** juros simples ao ano, em pontos-base, conforme a convenção; fundamento obrigatório */
  annualRateBps: number;
  basis: string;
}

/** Juros simples pró-rata por dia (ano de 365 dias). Sem regra: pendente. */
export function lateInterestCents(
  principalCents: bigint,
  daysLate: number,
  rule: InterestRule | null,
): MaybePending<bigint> {
  if (!rule) return pending(['regra_de_juros']);
  if (!rule.basis?.trim()) return pending(['fundamento_da_regra_de_juros']);
  if (!Number.isInteger(rule.annualRateBps) || rule.annualRateBps < 0)
    throw new DomainError('regra_invalida', 'Taxa de juros inválida.');
  if (!Number.isInteger(daysLate) || daysLate < 0)
    throw new DomainError('valor_invalido', 'Dias de atraso inválidos.');
  return ok(halfUpDiv(principalCents * BigInt(rule.annualRateBps) * BigInt(daysLate), 10_000n * 365n));
}
