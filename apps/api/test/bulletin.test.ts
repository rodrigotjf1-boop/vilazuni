import {afterAll, beforeAll, describe, expect, inject, it} from 'vitest';
import {Pool} from 'pg';
import {
  DAY,
  MIN,
  T0,
  FakeClock,
  WebClient,
  emailOf,
  seedCondominium,
  seedOwnership,
  seedPerson,
  seedRole,
  seedTotp,
  startApi,
  type Api,
} from './support/api.js';

describe('Mural e regras', () => {
  const clock = new FakeClock();
  const owner = new Pool({connectionString: inject('dbOwnerUrl')});
  let api: Api;
  let publisher: WebClient;
  let resident: WebClient;
  let outsider: WebClient;
  const body = {
    translations: {
      'pt-BR': {title: 'Horário da piscina', body: 'Consulte a programação fictícia.'},
      es: {title: 'Horario de la piscina', body: 'Consulte el horario de prueba.'},
    },
    shareWithGuests: false,
    requiresAcknowledgement: true,
  };

  beforeAll(async () => {
    const condo = await seedCondominium(owner, 'Mural', 1);
    const another = await seedCondominium(owner, 'Outro mural', 1);
    const manager = await seedPerson(owner, 'mural-sindica');
    const person = await seedPerson(owner, 'mural-proprietaria');
    const neighbor = await seedPerson(owner, 'mural-outro');
    await seedRole(owner, condo.id, manager, 'syndic', {mandate: {startsAt: T0 - DAY, endsAt: T0 + DAY}});
    await seedOwnership(owner, condo.id, condo.units[0]!.id, person);
    await seedOwnership(owner, another.id, another.units[0]!.id, neighbor);
    const secret = await seedTotp(owner, manager);
    api = await startApi(clock);

    const login = async (who: string) => {
      const client = new WebClient(api.url);
      expect((await client.login(emailOf(who))).status).toBe(200);
      return client;
    };
    publisher = await login('mural-sindica');
    resident = await login('mural-proprietaria');
    outsider = await login('mural-outro');
    expect((await publisher.post('/bulletin', {...body, kind: 'rule'})).body.error).toBe('mfa_exigido');
    expect((await publisher.mfa(secret, clock)).status).toBe(200);
  });

  afterAll(async () => {
    await api?.close();
    await owner.end();
  });

  it('salva vigência, mantém versões e registra leitura e ciência por pessoa e revisão', async () => {
    expect((await resident.post('/bulletin', {...body, kind: 'rule'})).status).toBe(403);
    const created = await publisher.post('/bulletin', {...body, kind: 'rule'});
    expect(created.status).toBe(201);
    const {id} = created.body;
    const receipt = `/bulletin/${id}/receipt`;
    const revisions = `/bulletin/${id}/revisions`;
    expect((await outsider.get('/bulletin')).body.entries).toEqual([]);
    expect((await outsider.post(receipt, {action: 'acknowledge', version: 1})).status).toBe(404);
    const first = (await resident.get('/bulletin')).body.entries[0];
    expect(first).toMatchObject({
      id,
      version: 1,
      translations: body.translations,
      readAt: null,
      acknowledgedAt: null,
    });
    expect(first.publishedBy).toMatch(/mural-sindica/);
    const read = await resident.post(receipt, {action: 'read', version: 1});
    expect(read.body).toEqual({readAt: new Date(T0).toISOString(), acknowledgedAt: null});
    clock.t = T0 + MIN;
    const ack = await resident.post(receipt, {action: 'acknowledge', version: 1});
    expect(ack.body).toEqual({readAt: read.body.readAt, acknowledgedAt: new Date(clock.t).toISOString()});
    expect((await resident.post(receipt, {action: 'acknowledge', version: 1})).body).toEqual(ack.body);

    const starts = new Date(T0 + 2 * MIN).toISOString();
    const expires = new Date(T0 + 3 * MIN).toISOString();
    const revision = await publisher.post(revisions, {
      ...body,
      version: 1,
      effectiveAt: starts,
      expiresAt: expires,
    });
    expect(revision.status).toBe(201);
    expect((await publisher.post(revisions, {...body, version: 1})).status).toBe(409);
    expect((await resident.get('/bulletin')).body.entries[0].version).toBe(1);
    clock.t = T0 + 2 * MIN;
    expect((await resident.get('/bulletin')).body.entries[0]).toMatchObject({
      version: 2,
      readAt: null,
      acknowledgedAt: null,
    });
    expect((await resident.post(receipt, {action: 'acknowledge', version: 1})).status).toBe(409);
    const history = (await publisher.get(`/bulletin/manage?id=${id}`)).body;
    expect(
      history.entries.map(({version, reads, acknowledgements}: Record<string, number>) => [
        version,
        reads,
        acknowledgements,
      ]),
    ).toEqual([
      [2, 0, 0],
      [1, 1, 1],
    ]);
    clock.t = T0 + 3 * MIN;
    expect((await resident.get('/bulletin')).body.entries).toEqual([]);
  });

  it('valida o intervalo de vigência e o tipo de registro de leitura', async () => {
    const effectiveAt = new Date(T0 + DAY / 2).toISOString();
    expect(
      (await publisher.post('/bulletin', {...body, kind: 'notice', effectiveAt, expiresAt: effectiveAt})).body
        .error,
    ).toBe('vigencia_invalida');
    const created = await publisher.post('/bulletin', {
      ...body,
      kind: 'notice',
      requiresAcknowledgement: false,
    });
    expect(created.status).toBe(201);
    const route = `/bulletin/${created.body.id}/receipt`;
    expect((await resident.post(route, {version: 1, action: 'acknowledge'})).body.error).toBe(
      'ciencia_nao_solicitada',
    );
    expect((await resident.post(route, {version: 1, action: 'read'})).status).toBe(200);
  });
});
