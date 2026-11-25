import {describe, expect, it} from 'vitest';
import {occupancyRows, stayEvents, weekStart} from './agenda';
import type {Stay} from './stays';

const tz = 'America/Sao_Paulo';
const days = [
  '2026-11-23',
  '2026-11-24',
  '2026-11-25',
  '2026-11-26',
  '2026-11-27',
  '2026-11-28',
  '2026-11-29',
];
const confirmed: Stay = {
  id: '1',
  unitId: 'casa-7',
  unitLabel: 'Casa 07',
  checkInAt: '2026-11-24T18:00:00Z',
  checkOutAt: '2026-11-27T14:00:00Z',
  members: [],
  counts: {adult: 2, teen: 0, child: 0},
  plates: [],
  exceptionReason: null,
  status: 'confirmed',
  decisionNote: null,
  hasGuestLink: false,
  version: 1,
};

describe('Calendário de ocupação', () => {
  it('termina a faixa antes do dia do checkout, mas mantém a saída na agenda', () => {
    const {segments} = occupancyRows([confirmed], days, tz);
    expect(segments).toMatchObject([{start: 1, end: 4, row: 0}]);
    expect(stayEvents([confirmed], '2026-11-27', tz)).toMatchObject([
      {kind: 'out', time: confirmed.checkOutAt},
    ]);
  });

  it('recorta a semana e empilha estadias sobrepostas sem remover nenhuma', () => {
    const pending = {...confirmed, id: '2', status: 'pending' as const, checkInAt: '2026-11-22T15:00:00Z'};
    const canceled = {...confirmed, id: '3', status: 'cancelled' as const};
    const grid = occupancyRows([confirmed, pending, canceled], days, tz);
    expect(grid.rowCount).toBe(2);
    expect(grid.segments.map(({stay, start, end, row}) => [stay.id, start, end, row])).toEqual([
      ['2', 0, 4, 0],
      ['1', 1, 4, 1],
    ]);
    expect(weekStart('2026-11-29')).toBe('2026-11-23');
  });

  it('usa o dia local para uma chegada após a meia-noite UTC', () => {
    const late = {...confirmed, checkInAt: '2026-11-25T01:00:00Z'};
    expect(stayEvents([late], '2026-11-24', tz)).toMatchObject([{kind: 'in', time: late.checkInAt}]);
  });
});
