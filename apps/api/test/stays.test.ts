import {randomUUID} from 'node:crypto';
import {afterAll, beforeAll, beforeEach, describe, expect, inject, it} from 'vitest';
import {Pool} from 'pg';
import {
  DAY,
  emailOf,
  FakeClock,
  MIN,
  seedCondominium,
  seedOwnership,
  seedPerson,
  seedRole,
  seedTotp,
  startApi,
  T0,
  WebClient,
  type Api,
  type SeededCondominium,
} from './support/api.js';

describe('Estadias', () => {
  const clock = new FakeClock();
  const owner = new Pool({connectionString: inject('dbOwnerUrl')});
  let api: Api;
  let condo: SeededCondominium;
  let resident: WebClient;
  let other: WebClient;
  let syndic: WebClient;
  let deputy: WebClient;
  let caretaker: WebClient;
  let administrator: WebClient;

  beforeAll(async () => {
    condo = await seedCondominium(owner, 'Estadias', 2);
    const principal = await seedPerson(owner, 'estadia-proprietario');
    const vizinho = await seedPerson(owner, 'estadia-vizinho');
    const gestor = await seedPerson(owner, 'estadia-sindico');
    const vice = await seedPerson(owner, 'estadia-subsindico');
    const zelador = await seedPerson(owner, 'estadia-zelador');
    const admin = await seedPerson(owner, 'estadia-administradora');
    await seedOwnership(owner, condo.id, condo.units[0]!.id, principal);
    await seedOwnership(owner, condo.id, condo.units[1]!.id, vizinho);
    await seedRole(owner, condo.id, gestor, 'syndic', {mandate: {startsAt: T0 - DAY, endsAt: T0 + 30 * DAY}});
    await seedRole(owner, condo.id, vice, 'subsyndic');
    await seedRole(owner, condo.id, zelador, 'service_provider', {
      delegation: {actions: ['stay.read.all'], startsAt: T0 - DAY, endsAt: T0 + DAY, grantedBy: gestor},
    });
    await seedRole(owner, condo.id, admin, 'administrator', {scopes: ['cadastro']});
    const syndicSecret = await seedTotp(owner, gestor);
    const deputySecret = await seedTotp(owner, vice);
    const caretakerSecret = await seedTotp(owner, zelador);
    api = await startApi(clock);
    async function signIn(who: string) {
      const client = new WebClient(api.url);
      expect((await client.login(emailOf(who))).status).toBe(200);
      return client;
    }
    resident = await signIn('estadia-proprietario');
    other = await signIn('estadia-vizinho');
    syndic = await signIn('estadia-sindico');
    deputy = await signIn('estadia-subsindico');
    caretaker = await signIn('estadia-zelador');
    administrator = await signIn('estadia-administradora');
    expect((await syndic.mfa(syndicSecret, clock)).status).toBe(200);
    expect((await deputy.mfa(deputySecret, clock)).status).toBe(200);
    expect((await caretaker.mfa(caretakerSecret, clock)).status).toBe(200);
  });

  afterAll(async () => {
    await api?.close();
    await owner.end();
  });

  beforeEach(() => {
    clock.t = T0;
  });

  const slot = (from: number, to: number) => ({
    checkInAt: new Date(from).toISOString(),
    checkOutAt: new Date(to).toISOString(),
  });
  const input = (from: number, to: number) => ({
    unitId: condo.units[0]!.id,
    requestId: randomUUID(),
    ...slot(from, to),
    members: [
      {name: 'Pessoa Responsável', band: 'adult', contact: 'responsavel@example.test'},
      {name: 'Segunda Pessoa', band: 'adult', contact: 'segundo@example.test'},
      {name: 'Pessoa Jovem', band: 'teen'},
      {name: 'Pessoa Criança', band: 'child'},
    ],
    plates: ['ABC-1D23', 'abc1d23'],
  });

  it('isola fichas, exige justificativa e evita cadastrar o mesmo envio duas vezes', async () => {
    const body = input(T0 + 2 * DAY, T0 + 3 * DAY);
    expect((await other.post('/stays', body)).status).toBe(404);
    expect((await resident.post('/stays', {...body, members: body.members.slice(0, 1)})).body.error).toBe(
      'justificativa_responsavel',
    );
    const created = await resident.post('/stays', body);
    expect(created.status).toBe(201);
    expect((await resident.post('/stays', body)).body.id).toBe(created.body.id);
    const records = (await caretaker.get('/stays')).body.stays;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      counts: {adult: 2, teen: 1, child: 1},
      plates: ['ABC1D23'],
      status: 'confirmed',
      registeredBy: expect.any(String),
    });
    const route = `/stays/${created.body.id}`;
    expect((await deputy.get('/stays?scope=all')).body.stays).toEqual(records);
    expect((await caretaker.post(`${route}/decision`, {version: 1, action: 'cancel'})).status).toBe(403);
    expect((await syndic.post(`${route}/decision`, {version: 1, action: 'cancel'})).status).toBe(403);
    expect((await syndic.post(`${route}/decision`, {version: 1, action: 'confirm'})).status).toBe(400);
    expect((await administrator.get('/stays')).status).toBe(403);
    expect((await other.get('/stays')).body.stays).toEqual([]);
    expect((await resident.get('/stays?scope=all')).status).toBe(403);
    const own = await resident.get('/stays?scope=own');
    expect(own.status).toBe(200);
    expect(own.body.visibleUnits.map((unit: {id: string}) => unit.id)).toEqual([body.unitId]);
    expect((await other.get(`/stays?id=${created.body.id}`)).body.stays).toEqual([]);

    const context = await syndic.get('/stays?scope=all&view=context');
    expect(context.body.visibleUnits).toHaveLength(2);
    expect(context.body.stays).toEqual([]);
    const upcoming = await resident.get('/stays?scope=own&view=upcoming');
    expect(upcoming.body.stays.map((stay: {id: string}) => stay.id)).toEqual([created.body.id]);
    expect((await syndic.get('/stays?scope=all&view=arrivals')).body.stays).toEqual([]);

    const range = new URLSearchParams({scope: 'all', from: body.checkInAt, to: body.checkOutAt});
    expect((await syndic.get(`/stays?${range}`)).body.stays.map((stay: {id: string}) => stay.id)).toEqual([
      created.body.id,
    ]);
    range.set('to', new Date(T0 + DAY).toISOString());
    expect((await syndic.get(`/stays?${range}`)).status).toBe(400);
  });

  it('registra comunicações simultâneas e mantém independentes as duas janelas de acesso', async () => {
    const start = T0 + 4 * 60 * MIN;
    const end = T0 + 5 * 60 * MIN;
    const instructions = 'Pegue a chave com a recepção do teste.';
    const [one, two] = await Promise.all([
      resident.post('/stays', {...input(start, end), arrivalInstructions: instructions}),
      resident.post('/stays', input(start, end)),
    ]);
    expect([one.status, two.status]).toEqual([201, 201]);
    const detail = `/stays?id=${one.body.id}`;
    expect((await resident.get(detail)).body.stays[0].arrivalInstructions).toBe(instructions);
    expect((await syndic.get(detail)).body.stays[0]).not.toHaveProperty('arrivalInstructions');
    const stored = await owner.query('select arrival_instructions from stay where id = $1', [one.body.id]);
    expect(stored.rows[0].arrival_instructions).toMatch(/^v1\./);
    expect(stored.rows[0].arrival_instructions).not.toContain(instructions);
    const issued = await resident.post(`/stays/${one.body.id}/guest-link`, {version: 1});
    expect(issued.status).toBe(200);
    const token = issued.body.token;
    const guest = new WebClient(api.url);
    expect((await guest.post('/stays/guest', {token})).status).toBe(410);

    clock.t = start - 3 * 60 * MIN;
    const guestView = await guest.post('/stays/guest', {token});
    expect(guestView.status).toBe(200);
    expect(guestView.headers.get('cache-control')).toBe('no-store');
    expect(guestView.body.arrivalInstructions).toBe(instructions);
    expect(guestView.body).not.toHaveProperty('members');
    expect(guestView.body).not.toHaveProperty('registeredBy');
    expect((await syndic.post('/stays/plate', {plate: 'ABC1D23'})).body.status).toBe('none');

    clock.t = start;
    expect((await syndic.post('/stays/plate', {plate: 'abc-1d23'})).body.status).toBe('review');
    clock.t = end;
    const movement = (await syndic.get('/stays?scope=all&view=day')).body.stays as {id: string}[];
    expect(movement.map((stay) => stay.id)).toEqual(expect.arrayContaining([one.body.id, two.body.id]));
    expect((await syndic.post('/stays/plate', {plate: 'ABC1D23'})).body.status).toBe('none');
    expect((await guest.post('/stays/guest', {token})).status).toBe(200);
    clock.t = end + 30 * MIN;
    expect((await guest.post('/stays/guest', {token})).status).toBe(410);
  });

  it('cancela o link anterior quando o proprietário altera as datas', async () => {
    const start = T0 + 6 * 60 * MIN;
    const body = input(start, start + DAY);
    const created = await resident.post('/stays', body);
    expect(created.status).toBe(201);
    const route = `/stays/${created.body.id}`;
    const issued = await resident.post(`${route}/guest-link`, {version: 1});
    expect(issued.status).toBe(200);
    const instructionsOnly = await resident.post(`${route}/period`, {
      version: 2,
      ...slot(start, start + DAY),
      arrivalInstructions: 'Chave de teste na recepção.',
    });
    expect(instructionsOnly.status).toBe(200);
    clock.t = start;
    const guest = new WebClient(api.url);
    expect((await guest.post('/stays/guest', {token: issued.body.token})).body.arrivalInstructions).toBe(
      'Chave de teste na recepção.',
    );
    const changed = await resident.post(`${route}/period`, {version: 3, ...slot(T0 + DAY, T0 + 2 * DAY)});
    expect(changed.body.status).toBe('confirmed');
    expect((await guest.post('/stays/guest', {token: issued.body.token})).status).toBe(404);
    const replacement = await resident.post(`${route}/guest-link`, {version: 4});
    expect(replacement.status).toBe(200);
    expect((await resident.post(`${route}/decision`, {action: 'cancel', version: 5})).body.status).toBe(
      'cancelled',
    );
    expect((await guest.post('/stays/guest', {token: replacement.body.token})).status).toBe(404);
  });
});
