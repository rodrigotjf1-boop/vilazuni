import {describe, expect, it} from 'vitest';
import {decide, activeOwnedUnits, DELEGABLE_ACTIONS, type ActorContext} from './policy.js';

const now = new Date('2026-11-17T12:00:00-03:00');
const d = (iso: string) => new Date(iso);
const base = (patch: Partial<ActorContext> = {}): ActorContext => ({
  personId: 'p',
  condominiumId: 'c',
  now,
  mfaSatisfied: false,
  mfaRecent: false,
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
const comMfa = {mfaSatisfied: true, mfaRecent: false};
const comMfaRecente = {mfaSatisfied: true, mfaRecent: true};

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
    expect(decide(ctx, 'person.read.all').allow).toBe(false);
  });

  it('o que é da casa própria não pede segundo fator', () => {
    const ctx = base({ownerships: [validated('u1')]});
    expect(decide(ctx, 'unit.read.own', {unitId: 'u1'}).allow).toBe(true);
    expect(decide(ctx, 'ownership.request').allow).toBe(true);
  });
});

describe('síndico, mandato e segundo fator', () => {
  const sindico = (mandateEnd: string) => ({
    role: 'syndic' as const,
    status: 'active' as const,
    scopes: [],
    startsAt: d('2026-01-01T00:00:00-03:00'),
    endsAt: null,
    mandate: {status: 'active' as const, startsAt: d('2026-01-01T00:00:00-03:00'), endsAt: d(mandateEnd)},
  });

  it('gestão exige o segundo fator na sessão; ato crítico exige confirmação recente', () => {
    const ctx = base({roles: [sindico('2027-01-01T00:00:00-03:00')]});
    expect(decide(ctx, 'ownership.validate')).toEqual({allow: false, reason: 'mfa_exigido'});
    expect(decide(ctx, 'condominium.read').allow).toBe(true); // ler o nome do condomínio não é gestão
    expect(decide({...ctx, ...comMfa}, 'ownership.validate').allow).toBe(true);
    expect(decide({...ctx, ...comMfa}, 'role.assign')).toEqual({allow: false, reason: 'mfa_recente_exigido'});
    expect(decide({...ctx, ...comMfaRecente}, 'role.assign').allow).toBe(true);
  });

  it('síndico que também é dono vê a própria casa sem segundo fator', () => {
    const ctx = base({ownerships: [validated('u7')], roles: [sindico('2027-01-01T00:00:00-03:00')]});
    expect(decide(ctx, 'unit.read.own', {unitId: 'u7'}).allow).toBe(true);
    expect(decide(ctx, 'unit.read.all')).toEqual({allow: false, reason: 'mfa_exigido'});
  });

  it('T19 — mandato vencido perde a gestão, mesmo com sessão aberta, e mantém o papel de proprietário', () => {
    const ctx = base({
      ...comMfaRecente,
      ownerships: [validated('u7')],
      roles: [sindico('2026-11-17T12:00:00-03:00')], // venceu exatamente agora (fim exclusivo)
    });
    expect(decide(ctx, 'ownership.validate')).toEqual({allow: false, reason: 'mandato_vencido'});
    expect(decide(ctx, 'unit.read.all').allow).toBe(false);
    expect(decide(ctx, 'unit.read.own', {unitId: 'u7'}).allow).toBe(true);
  });
});

describe('T20 — escopos concedidos', () => {
  const sub = (actions: string[]) => ({
    role: 'subsyndic' as const,
    status: 'active' as const,
    scopes: [],
    startsAt: d('2026-01-01T00:00:00-03:00'),
    endsAt: null,
    delegations: [
      {
        status: 'active' as const,
        actions,
        startsAt: d('2026-11-01T00:00:00-03:00'),
        endsAt: d('2026-12-01T00:00:00-03:00'),
      },
    ],
  });

  it('subsíndico só faz o que a delegação vigente concede, com segundo fator', () => {
    const ctx = base({...comMfa, roles: [sub(['ownership.validate'])]});
    expect(decide(ctx, 'ownership.validate').allow).toBe(true);
    expect(decide({...ctx, mfaSatisfied: false}, 'ownership.validate')).toEqual({
      allow: false,
      reason: 'mfa_exigido',
    });
    expect(decide(ctx, 'unit.manage').allow).toBe(false);
    expect(decide(ctx, 'role.assign').allow).toBe(false);
    const depois = {...ctx, now: d('2026-12-01T00:00:00-03:00')};
    expect(decide(depois, 'ownership.validate').allow).toBe(false);
  });

  it('delegação nunca repassa ato crítico (papel, mandato, delegação)', () => {
    const ctx = base({
      ...comMfaRecente,
      roles: [sub(['role.assign', 'mandate.manage', 'delegation.manage'])],
    });
    expect(decide(ctx, 'role.assign').allow).toBe(false);
    expect(decide(ctx, 'mandate.manage').allow).toBe(false);
    expect(decide(ctx, 'delegation.manage').allow).toBe(false);
    expect(DELEGABLE_ACTIONS.has('role.assign')).toBe(false);
    expect(DELEGABLE_ACTIONS.has('ownership.validate')).toBe(true);
  });

  it('conselho fiscal lê o que fiscaliza e não edita', () => {
    const ctx = base({
      roles: [{role: 'fiscal_council', status: 'active', scopes: [], startsAt: null, endsAt: null}],
    });
    expect(decide(ctx, 'unit.read.all').allow).toBe(true);
    expect(decide(ctx, 'audit.read').allow).toBe(true);
    expect(decide(ctx, 'unit.manage').allow).toBe(false);
    expect(decide(ctx, 'ownership.validate').allow).toBe(false);
    expect(decide({...ctx, ...comMfaRecente}, 'ownership.validate').allow).toBe(false);
  });

  it('Tenaz só atua nos escopos contratuais; cadastro sem segundo fator; sem superadmin', () => {
    const tenaz = (scopes: string[]) =>
      base({roles: [{role: 'administrator', status: 'active', scopes, startsAt: null, endsAt: null}]});
    expect(decide(tenaz(['financeiro']), 'ownership.validate').allow).toBe(false);
    expect(decide(tenaz(['cadastro']), 'ownership.validate').allow).toBe(true);
    expect(decide(tenaz(['cadastro']), 'person.read.all').allow).toBe(true);
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
