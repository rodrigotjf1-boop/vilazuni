import {DomainError} from '../errors.js';
import {dec, mul, add, isPositive, ZERO, type Dec} from '../decimal.js';

/**
 * Volume da piscina (especificação §13). O volume NOMINAL soma prismas retangulares por trecho, com as
 * profundidades informadas como constantes/médias — não é volume certificado (a piscina tem curvas).
 * Nunca se aplica fator de redução inventado (10%, 20%, π/4).
 */
export interface PoolSection {
  label: string;
  lengthM: string | number;
  widthM: string | number;
  depthM: string | number;
}

function positive(value: string | number, field: string): Dec {
  const d = dec(value);
  if (!isPositive(d))
    throw new DomainError('medida_invalida', `A medida "${field}" precisa ser maior que zero.`);
  return d;
}

/** Soma nominal dos trechos, em litros (1 m³ = 1.000 L). */
export function nominalVolumeLiters(sections: PoolSection[]): Dec {
  if (!sections.length) throw new DomainError('medida_invalida', 'Informe ao menos um trecho da piscina.');
  let cubicMeters = ZERO;
  for (const s of sections) {
    const v = mul(
      mul(positive(s.lengthM, 'comprimento'), positive(s.widthM, 'largura')),
      positive(s.depthM, 'profundidade'),
    );
    cubicMeters = add(cubicMeters, v);
  }
  return mul(cubicMeters, dec(1000));
}

export type VolumeKind = 'confirmado' | 'provisorio';

/**
 * Volume usado em ORÇAMENTO: o confirmado quando houver (precisa ser > 0 — zero é inválido, T34); senão o
 * nominal, com a etiqueta "provisório". Recomendação de dose NÃO usa esta função: exige perfil validado.
 */
export function budgetVolume(input: {confirmedLiters?: string | number | null; sections: PoolSection[]}): {
  liters: Dec;
  kind: VolumeKind;
} {
  const raw = input.confirmedLiters;
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === ''))
    return {liters: nominalVolumeLiters(input.sections), kind: 'provisorio'};
  const confirmed = dec(raw);
  if (!isPositive(confirmed))
    throw new DomainError('volume_confirmado_invalido', 'O volume confirmado precisa ser maior que zero.');
  return {liters: confirmed, kind: 'confirmado'};
}
