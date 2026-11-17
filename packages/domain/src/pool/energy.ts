import {DomainError, ok, pending, type MaybePending} from '../errors.js';
import {dec, mul, div, cmp, isNegative, isPositive, type Dec} from '../decimal.js';

/**
 * Energia da bomba (especificação §13): kWh = (W / 1000) × horas/dia × dias; custo = kWh × tarifa.
 * Campo ausente ≠ zero confirmado: ausente deixa o resultado PENDENTE (T35). CV da placa não é consumo
 * elétrico — o campo é a potência elétrica de entrada em W.
 */
type Input = string | number | null | undefined;
const missing = (v: Input) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export function energyKWh(input: {powerW: Input; hoursPerDay: Input; days: Input}): MaybePending<Dec> {
  const faltando = (['powerW', 'hoursPerDay', 'days'] as const).filter((k) => missing(input[k]));
  if (faltando.length) return pending(faltando);
  const powerW = dec(input.powerW!);
  const hours = dec(input.hoursPerDay!);
  const days = dec(input.days!);
  if (!isPositive(powerW)) throw new DomainError('medida_invalida', 'A potência precisa ser maior que zero.');
  if (isNegative(hours) || cmp(hours, dec(24)) > 0)
    throw new DomainError('medida_invalida', 'As horas por dia vão de 0 a 24.');
  if (isNegative(days)) throw new DomainError('medida_invalida', 'Os dias não podem ser negativos.');
  return ok(mul(mul(div(powerW, dec(1000)), hours), days));
}

export function energyCostReais(kWh: MaybePending<Dec>, tariffPerKWh: Input): MaybePending<Dec> {
  const faltando = [
    ...(kWh.status === 'pendente' ? kWh.missing : []),
    ...(missing(tariffPerKWh) ? ['tariffPerKWh'] : []),
  ];
  if (faltando.length) return pending(faltando);
  const tariff = dec(tariffPerKWh!);
  if (isNegative(tariff)) throw new DomainError('medida_invalida', 'A tarifa não pode ser negativa.');
  return ok(mul((kWh as {value: Dec}).value, tariff));
}

/**
 * Horas em que UMA bomba esteve ligada, a partir dos intervalos de cada uso (filtração, cascata…). Se a mesma
 * bomba atende às duas funções, as horas simultâneas contam UMA vez (T36): é a união dos intervalos.
 */
export function pumpRunningHours(intervals: {startsAt: Date; endsAt: Date}[]): Dec {
  const sorted = intervals
    .map((i) => {
      if (i.endsAt.getTime() <= i.startsAt.getTime())
        throw new DomainError('periodo_invalido', 'O fim do uso da bomba precisa ser depois do início.');
      return [i.startsAt.getTime(), i.endsAt.getTime()] as const;
    })
    .sort((a, b) => a[0] - b[0]);
  let totalMs = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [s, e] of sorted) {
    if (curEnd < 0) {
      curStart = s;
      curEnd = e;
    } else if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      totalMs += curEnd - curStart;
      curStart = s;
      curEnd = e;
    }
  }
  if (curEnd >= 0) totalMs += curEnd - curStart;
  return div(dec(BigInt(totalMs)), dec(3_600_000));
}
