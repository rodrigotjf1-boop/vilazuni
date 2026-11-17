import {DomainError, ok, pending, type MaybePending} from '../errors.js';
import {dec, add, sub, mul, div, ceilInt, isNegative, isPositive, ZERO, type Dec} from '../decimal.js';
import {budgetVolume, type PoolSection, type VolumeKind} from './volume.js';
import {energyKWh, energyCostReais} from './energy.js';

/**
 * Calculadora de custos da piscina — mesma lógica da planilha `Vilazuni_Calculadora_Piscina.xlsx`
 * (aba Custos). É SIMULAÇÃO FINANCEIRA: não define dose. As aplicações por período são hipótese editável.
 *
 * - Consumo proporcional: cloro = volume(m³) × g/m³ × aplicações ÷ 1000 (kg); fitas = dias × testes/dia.
 * - Compra inicial (embalagens inteiras) é desembolso separado — nunca somado ao custo proporcional.
 * - Energia e frete ausentes = PENDENTE; zero confirmado é um valor (T35).
 */
type Input = string | number | null | undefined;
const missing = (v: Input) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export interface Pack {
  /** quantidade por embalagem (kg para o cloro, unidades para as fitas) */
  quantity: string | number;
  /** preço da embalagem em reais */
  priceReais: string | number;
}

export interface PoolBudgetInput {
  sections: PoolSection[];
  confirmedVolumeLiters?: Input;
  days: string | number;
  chlorineApplications: string | number;
  chlorineGramsPerM3: string | number;
  testsPerDay: string | number;
  initialChlorineKg: string | number;
  initialStrips: string | number;
  reserveReais: Input;
  chlorine: Pack;
  strips: Pack;
  energy: {powerW: Input; hoursPerDay: Input; days: Input; tariffPerKWh: Input};
  freightReais: Input;
}

export interface PoolBudget {
  volume: {liters: Dec; kind: VolumeKind};
  chlorineKg: Dec;
  strips: Dec;
  chlorineCostReais: Dec;
  stripsCostReais: Dec;
  consumptionSubtotalReais: Dec;
  reserve: MaybePending<Dec>;
  materialsAndReserve: MaybePending<Dec>;
  energyKWh: MaybePending<Dec>;
  energyCost: MaybePending<Dec>;
  freight: MaybePending<Dec>;
  total: MaybePending<Dec>;
  initialPurchase: {chlorinePacks: bigint; stripPacks: bigint; totalReais: Dec};
}

function nonNegative(value: string | number, field: string): Dec {
  const d = dec(value);
  if (isNegative(d)) throw new DomainError('medida_invalida', `O campo "${field}" não pode ser negativo.`);
  return d;
}

function unitPrice(pack: Pack, field: string): Dec {
  const qty = dec(pack.quantity);
  if (!isPositive(qty))
    throw new DomainError('medida_invalida', `A embalagem de ${field} precisa ter quantidade.`);
  return div(nonNegative(pack.priceReais, `preço de ${field}`), qty);
}

const optionalMoney = (v: Input, field: string): MaybePending<Dec> =>
  missing(v) ? pending([field]) : ok(nonNegative(v as string | number, field));

function sumAll(parts: MaybePending<Dec>[]): MaybePending<Dec> {
  const faltando = parts.flatMap((p) => (p.status === 'pendente' ? p.missing : []));
  if (faltando.length) return pending(faltando);
  return ok(parts.reduce((acc, p) => add(acc, (p as {value: Dec}).value), ZERO));
}

export function poolBudget(input: PoolBudgetInput): PoolBudget {
  const volume = budgetVolume({confirmedLiters: input.confirmedVolumeLiters, sections: input.sections});
  const cubicMeters = div(volume.liters, dec(1000));
  const chlorineKg = div(
    mul(
      mul(cubicMeters, nonNegative(input.chlorineGramsPerM3, 'cloro por m³')),
      nonNegative(input.chlorineApplications, 'aplicações'),
    ),
    dec(1000),
  );
  const strips = mul(nonNegative(input.days, 'dias'), nonNegative(input.testsPerDay, 'testes por dia'));

  const chlorineCostReais = mul(chlorineKg, unitPrice(input.chlorine, 'cloro'));
  const stripsCostReais = mul(strips, unitPrice(input.strips, 'fitas'));
  const consumptionSubtotalReais = add(chlorineCostReais, stripsCostReais);

  const reserve = optionalMoney(input.reserveReais, 'reserveReais');
  const materialsAndReserve = sumAll([ok(consumptionSubtotalReais), reserve]);
  const kWh = energyKWh(input.energy);
  const energyCost = energyCostReais(kWh, input.energy.tariffPerKWh);
  const freight = optionalMoney(input.freightReais, 'freightReais');
  const total = sumAll([materialsAndReserve, energyCost, freight]);

  const packs = (needed: Dec, initial: string | number, pack: Pack): bigint => {
    const rest = sub(needed, nonNegative(initial, 'estoque inicial'));
    if (!isPositive(rest)) return 0n;
    return ceilInt(div(rest, dec(pack.quantity)));
  };
  const chlorinePacks = packs(chlorineKg, input.initialChlorineKg, input.chlorine);
  const stripPacks = packs(strips, input.initialStrips, input.strips);
  const totalReais = add(
    mul(dec(chlorinePacks), dec(input.chlorine.priceReais)),
    mul(dec(stripPacks), dec(input.strips.priceReais)),
  );

  return {
    volume,
    chlorineKg,
    strips,
    chlorineCostReais,
    stripsCostReais,
    consumptionSubtotalReais,
    reserve,
    materialsAndReserve,
    energyKWh: kWh,
    energyCost,
    freight,
    total,
    initialPurchase: {chlorinePacks, stripPacks, totalReais},
  };
}
