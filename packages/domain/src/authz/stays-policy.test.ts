import {describe, expect, it} from 'vitest';
import {decide, type ActorContext, type Role} from './policy.js';

const ctx: ActorContext = {
  personId: 'p',
  condominiumId: 'c',
  now: new Date('2026-11-24T12:00:00Z'),
  mfaSatisfied: true,
  mfaRecent: true,
  roles: [],
  ownerships: [{unitId: 'casa1', status: 'validated', startsAt: null, endsAt: null}],
  residencies: [{unitId: 'casa2', status: 'active', startsAt: null, endsAt: null}],
};

const delegated = (role: Role, endsAt: Date | null = null): ActorContext => ({
  ...ctx,
  ownerships: [],
  residencies: [],
  roles: [
    {
      role,
      scopes: [],
      status: 'active',
      startsAt: null,
      endsAt: null,
      delegations: [{status: 'active', actions: ['stay.read.all'], startsAt: null, endsAt}],
    },
  ],
});

describe('Visibilidade de estadias', () => {
  it('requer titularidade vigente da casa para consultar ou cadastrar estadias próprias', () => {
    expect(decide(ctx, 'stay.read.own', {unitId: 'casa1'}).allow).toBe(true);
    expect(decide(ctx, 'stay.write.own', {unitId: 'casa2'}).allow).toBe(false);
    expect(decide(ctx, 'stay.read.all').allow).toBe(false);
  });

  it('permite a leitura ao subsíndico vigente com segundo fator', () => {
    const deputy = delegated('subsyndic');
    delete deputy.roles[0]!.delegations;
    expect(decide(deputy, 'stay.read.all').allow).toBe(true);
    expect(decide({...deputy, mfaSatisfied: false}, 'stay.read.all').reason).toBe('mfa_exigido');
    deputy.roles[0]!.endsAt = ctx.now;
    expect(decide(deputy, 'stay.read.all').allow).toBe(false);
  });

  it('permite ao prestador apenas a leitura delegada e vigente', () => {
    const staff = delegated('service_provider');
    expect(decide(staff, 'stay.read.all').allow).toBe(true);
    expect(decide(staff, 'stay.write.own', {unitId: 'casa1'}).allow).toBe(false);
    expect(decide(delegated('service_provider', ctx.now), 'stay.read.all').allow).toBe(false);
    expect(decide(delegated('administrator'), 'stay.read.all').allow).toBe(false);
  });
});
