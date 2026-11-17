import {describe, expect, it} from 'vitest';
import {decide, activeOwnedUnits, type ActorContext} from './policy.js';

const now = new Date('2026-11-17T12:00:00-03:00');
const d = (iso: string) => new Date(iso);
const base = (patch: Partial<ActorContext> = {}): ActorContext => ({
  personId: 'p',
  condominiumId: 'c',
  now,
  mfaSatisfied: false,
  ownerships: [],
  residencies: [],
  roles: [],
  ...patch,
});
const validated = (unitId: string) => ({
  unitId,
  status: 'validated' as const,
  startsAt: d('2026-01-01T00:00:00-03:00'),
  endsAt: null,
});

describe('proprietário', () => {
  it('T04 — com duas casas alcança as duas e não a de terceiro', () => {
    const ctx = base({ownerships: [validated('u1'), validated('u2')]});
    expect(decide(ctx, 'unit.read.own', {unitId: 'u1'}).allow).toBe(true);
    expect(decide(ctx, 'unit.read.own', {unitId: 'u2'}).allow).toBe(true);
    expect(decide(ctx, 'unit.read.own', {unitId: 'u3'})).toEqual({allow: false, reason: 'fora_do_escopo'});
  });

  it('titularidade pendente não dá acesso à casa; encerrada também não', () => {
    const ctx = base({
      ownerships: [
        {unitId: 'u1', status: 'pending', startsAt: null, endsAt: null},
        {
          unitId: 'u2',
          status: 'validated',
          startsAt: d('2025-01-01T00:00:00Z'),
          endsAt: d('2026-06-01T00:00:00Z'),
        },
      ],
    });
    expect(activeOwnedUnits(ctx)).toEqual([]);
    expect(decide(ctx, 'unit.read.own', {unitId: 'u1'}).allow).toBe(false);
    expect(decide(ctx, 'unit.read.own', {unitId: 'u2'}).allow).toBe(false);
  });

  it('T01 — proprietário não valida titularidade nem convida para papel', () => {
    const ctx = base({ownerships: [validated('u1')]});
    expect(decide(ctx, 'ownership.validate').allow).toBe(false);
    expect(decide(ctx, 'invitation.create').allow).toBe(false);
    expect(decide(ctx, 'role.assign').allow).toBe(false);
  });
});

describe('síndico e mandato', () => {
  const sindico = (mandateEnd: string) => ({
    role: 'syndic' as const,
    status: 'active' as const,
    scopes: [],
    startsAt: d('2026-01-01T00:00:00-03:00'),
    endsAt: null,
    mandate: {status: 'active' as const, startsAt: d('2026-01-01T00:00:00-03:00'), endsAt: d(mandateEnd)},
  });

  it('com mandato vigente administra; ato crítico exige MFA', () => {
    const ctx = base({roles: [sindico('2027-01-01T00:00:00-03:00')]});
    expect(decide(ctx, 'ownership.validate').allow).toBe(true);
    expect(decide(ctx, 'role.assign')).toEqual({allow: false, reason: 'mfa_exigido'});
    expect(decide({...ctx, mfaSatisfied: true}, 'role.assign').allow).toBe(true);
  });

  it('T19 — mandato vencido perde a gestão, mesmo com sessão aberta, e mantém o papel de proprietário', () => {
    const ctx = base({
      mfaSatisfied: true,
      ownerships: [validated('u7')],
      roles: [sindico('2026-11-17T12:00:00-03:00')], // venceu exatamente agora (fim exclusivo)
    });
    expect(decide(ctx, 'ownership.validate')).toEqual({allow: false, reason: 'mandato_vencido'});
    expect(decide(ctx, 'unit.read.all').allow).toBe(false);
    expect(decide(ctx, 'unit.read.own', {unitId: 'u7'}).allow).toBe(true);
  });
});

describe('T20 — escopos concedidos', () => {
  it('subsíndico só faz o que a delegação vigente concede', () => {
    const sub = {
      role: 'subsyndic' as const,
      status: 'active' as const,
      scopes: [],
      startsAt: d('2026-01-01T00:00:00-03:00'),
      endsAt: null,
      delegations: [
        {
          status: 'active' as const,
          actions: ['ownership.validate'],
          startsAt: d('2026-11-01T00:00:00-03:00'),
          endsAt: d('2026-12-01T00:00:00-03:00'),
        },
      ],
    };
    const ctx = base({roles: [sub]});
    expect(decide(ctx, 'ownership.validate').allow).toBe(true);
    expect(decide(ctx, 'unit.manage').allow).toBe(false);
    expect(decide(ctx, 'role.assign').allow).toBe(false);
    const depois = {...ctx, now: d('2026-12-01T00:00:00-03:00')};
    expect(decide(depois, 'ownership.validate').allow).toBe(false);
  });

  it('conselho fiscal lê o que fiscaliza e não edita', () => {
    const ctx = base({
      roles: [{role: 'fiscal_council', status: 'active', scopes: [], startsAt: null, endsAt: null}],
    });
    expect(decide(ctx, 'unit.read.all').allow).toBe(true);
    expect(decide(ctx, 'audit.read').allow).toBe(true);
    expect(decide(ctx, 'unit.manage').allow).toBe(false);
    expect(decide(ctx, 'ownership.validate').allow).toBe(false);
  });

  it('Tenaz só atua nos escopos contratuais; sem superadmin', () => {
    const tenaz = (scopes: string[]) =>
      base({roles: [{role: 'administrator', status: 'active', scopes, startsAt: null, endsAt: null}]});
    expect(decide(tenaz(['financeiro']), 'ownership.validate').allow).toBe(false);
    expect(decide(tenaz(['cadastro']), 'ownership.validate').allow).toBe(true);
    expect(decide(tenaz(['cadastro']), 'role.assign').allow).toBe(false);
    expect(decide(tenaz(['cadastro', 'qualquer-coisa']), 'unit.manage').allow).toBe(false);
  });

  it('papel encerrado ou fora do período não concede nada', () => {
    const ctx = base({
      roles: [{role: 'fiscal_council', status: 'ended', scopes: [], startsAt: null, endsAt: null}],
    });
    expect(decide(ctx, 'unit.read.all')).toEqual({allow: false, reason: 'sem_vinculo'});
  });
});
