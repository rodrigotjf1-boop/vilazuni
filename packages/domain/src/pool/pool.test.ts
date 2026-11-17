import {describe, expect, it} from 'vitest';
import {nominalVolumeLiters, budgetVolume, type PoolSection} from './volume.js';
import {energyKWh, energyCostReais, pumpRunningHours} from './energy.js';
import {poolBudget, type PoolBudgetInput} from './budget.js';
import {toPlain, toFixed} from '../decimal.js';
import {DomainError} from '../errors.js';

// Medidas informadas (§2/§13). O cálculo é nominal: dois prismas, sem fator de redução inventado.
const trechos: PoolSection[] = [
  {label: 'Trecho maior', lengthM: '4,50', widthM: '3,90', depthM: '1,10'},
  {label: 'Trecho ao fundo', lengthM: '3,35', widthM: '2,70', depthM: '1,00'},
];

describe('volume da piscina', () => {
  it('soma nominal exata: 19.305 L + 9.045 L = 28.350 L (sem erro de ponto flutuante)', () => {
    expect(toPlain(nominalVolumeLiters([trechos[0]!]))).toBe('19305');
    expect(toPlain(nominalVolumeLiters([trechos[1]!]))).toBe('9045');
    expect(toPlain(nominalVolumeLiters(trechos))).toBe('28350');
  });

  it('T34 — confirmado zero é inválido; vazio usa o nominal com a etiqueta provisório', () => {
    expect(() => budgetVolume({confirmedLiters: 0, sections: trechos})).toThrow(DomainError);
    expect(() => budgetVolume({confirmedLiters: '0', sections: trechos})).toThrow(/maior que zero/);
    const vazio = budgetVolume({confirmedLiters: '', sections: trechos});
    expect(vazio.kind).toBe('provisorio');
    expect(toPlain(vazio.liters)).toBe('28350');
    const confirmado = budgetVolume({confirmedLiters: 25000, sections: trechos});
    expect(confirmado).toMatchObject({kind: 'confirmado'});
    expect(toPlain(confirmado.liters)).toBe('25000');
  });

  it('medida zero ou negativa é recusada', () => {
    expect(() => nominalVolumeLiters([{label: 'x', lengthM: 0, widthM: 1, depthM: 1}])).toThrow(DomainError);
  });
});

describe('energia da bomba', () => {
  it('exemplo didático: 750 W × 6 h × 30 dias = 135 kWh; a R$ 1,10 = R$ 148,50', () => {
    const kWh = energyKWh({powerW: 750, hoursPerDay: 6, days: 30});
    expect(kWh.status).toBe('ok');
    expect(toPlain((kWh as {value: never}).value)).toBe('135');
    const custo = energyCostReais(kWh, '1,10');
    expect(toFixed((custo as {value: never}).value, 2)).toBe('148.50');
  });

  it('T35 — campo em branco deixa pendente; zero confirmado é um valor', () => {
    expect(energyKWh({powerW: null, hoursPerDay: 6, days: 30})).toEqual({
      status: 'pendente',
      missing: ['powerW'],
    });
    expect(energyCostReais(energyKWh({powerW: 750, hoursPerDay: 6, days: 30}), '')).toEqual({
      status: 'pendente',
      missing: ['tariffPerKWh'],
    });
    const zero = energyKWh({powerW: 750, hoursPerDay: 0, days: 30});
    expect(zero.status).toBe('ok');
    expect(toPlain((zero as {value: never}).value)).toBe('0');
  });

  it('T36 — a mesma bomba em cascata e filtração ao mesmo tempo não duplica horas', () => {
    const d = (h: string) => new Date(`2026-12-20T${h}:00-03:00`);
    const horas = pumpRunningHours([
      {startsAt: d('08:00'), endsAt: d('12:00')}, // filtração
      {startsAt: d('10:00'), endsAt: d('14:00')}, // cascata na mesma bomba
      {startsAt: d('16:00'), endsAt: d('17:30')},
    ]);
    expect(toPlain(horas)).toBe('7.5'); // 8h–14h (6 h) + 1,5 h, não 4 + 4 + 1,5
  });
});

describe('calculadora de custos — mesmos números da planilha (aba Custos)', () => {
  const base: PoolBudgetInput = {
    sections: trechos,
    confirmedVolumeLiters: null,
    days: 30,
    chlorineApplications: 30,
    chlorineGramsPerM3: 4,
    testsPerDay: 2,
    initialChlorineKg: 0,
    initialStrips: 0,
    reserveReais: 75,
    chlorine: {quantity: 10, priceReais: 359},
    strips: {quantity: 25, priceReais: '49,90'},
    energy: {powerW: null, hoursPerDay: null, days: null, tariffPerKWh: null},
    freightReais: null,
  };

  it('consumo proporcional, reserva e compra inicial batem com a planilha', () => {
    const r = poolBudget(base);
    expect(r.volume.kind).toBe('provisorio');
    expect(toPlain(r.chlorineKg)).toBe('3.402'); // C26
    expect(toPlain(r.strips)).toBe('60'); // C27
    expect(toPlain(r.chlorineCostReais)).toBe('122.1318'); // H34
    expect(toPlain(r.stripsCostReais)).toBe('119.76'); // H35
    expect(toPlain(r.consumptionSubtotalReais)).toBe('241.8918'); // H36
    expect(r.materialsAndReserve.status).toBe('ok');
    expect(toPlain((r.materialsAndReserve as {value: never}).value)).toBe('316.8918'); // C8
    expect(r.initialPurchase.chlorinePacks).toBe(1n); // C40
    expect(r.initialPurchase.stripPacks).toBe(3n); // C41
    expect(toPlain(r.initialPurchase.totalReais)).toBe('508.7'); // H42
  });

  it('energia e frete ausentes deixam o total pendente (C9, C10, C11)', () => {
    const r = poolBudget(base);
    expect(r.energyCost.status).toBe('pendente');
    expect(r.freight).toEqual({status: 'pendente', missing: ['freightReais']});
    expect(r.total.status).toBe('pendente');
  });

  it('com a energia do exemplo e frete zero confirmado: R$ 465,39 (materiais + energia)', () => {
    const r = poolBudget({
      ...base,
      energy: {powerW: 750, hoursPerDay: 6, days: 30, tariffPerKWh: '1,10'},
      freightReais: 0,
    });
    expect(r.total.status).toBe('ok');
    expect(toFixed((r.total as {value: never}).value, 2)).toBe('465.39');
  });

  it('compra inicial não é somada ao custo do mês', () => {
    const r = poolBudget(base);
    expect(toPlain((r.materialsAndReserve as {value: never}).value)).not.toBe('825.5918');
  });
});
