import {randomUUID} from 'node:crypto';
import {afterAll, beforeAll, expect, inject, it} from 'vitest';
import {Pool} from 'pg';
import {uuidv7, withCondominium} from '../src/db/tenant.js';
import {
  DAY,
  emailOf,
  FakeClock,
  MIN,
  ORIGIN,
  seedCondominium,
  seedOwnership,
  seedPerson,
  startApi,
  T0,
  WebClient,
  type Api,
  type SeededCondominium,
} from './support/api.js';

const clock = new FakeClock();
const db = new Pool({connectionString: inject('dbOwnerUrl')});
let api: Api;
let condo: SeededCondominium;
let owner: WebClient;
let neighbor: WebClient;
let resident: WebClient;
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQTk4GAAGWAOoM8hk0AAAAAElFTkSuQmCC',
  'base64',
);
const example = {
  title: 'Mirante de teste',
  description: 'Vista da enseada com trilha sinalizada.',
  directions: 'Saia pelo portão do condomínio e siga pela via principal.',
  transport: 'Vá a pé ou de táxi.',
  tips: 'Leve água.',
};

beforeAll(async () => {
  condo = await seedCondominium(db, 'Guia de teste', 2);
  const ownerId = await seedPerson(db, 'guia-titular');
  const neighborId = await seedPerson(db, 'guia-vizinho');
  const residentId = await seedPerson(db, 'guia-morador');
  await seedOwnership(db, condo.id, condo.units[0]!.id, ownerId);
  await seedOwnership(db, condo.id, condo.units[1]!.id, neighborId);
  await withCondominium(db, condo.id, (client) =>
    client.query(
      `insert into residency (id, condominium_id, unit_id, person_id, status, starts_at, ends_at)
     values ($1, $2, $3, $4, 'active', $5, $6)`,
      [uuidv7(), condo.id, condo.units[0]!.id, residentId, new Date(T0 - DAY), new Date(T0 + 10 * MIN)],
    ),
  );
  api = await startApi(clock);
  async function login(key: string) {
    const client = new WebClient(api.url);
    expect((await client.login(emailOf(key))).status).toBe(200);
    return client;
  }
  owner = await login('guia-titular');
  neighbor = await login('guia-vizinho');
  resident = await login('guia-morador');
});

afterAll(async () => {
  await api?.close();
  await db.end();
});

const pathOf = (unit: number) => `/units/${condo.units[unit]!.id}/guide`;
const auth = (c: WebClient) => ({origin: ORIGIN, cookie: c.cookie!, 'x-csrf-token': c.csrf!});
const photo = new Blob([new Uint8Array(png)], {type: 'image/png'});

function save(c: WebClient, path: string, data: unknown, files: Record<string, Blob> = {}) {
  const body = new FormData();
  body.set('data', JSON.stringify(data));
  for (const [slot, file] of Object.entries(files)) body.set(slot, file, 'atracao.png');
  return fetch(c.base + path, {method: 'POST', headers: auth(c), body});
}

it('publica até três fotos por atração e mantém as alterações atômicas e versionadas', async () => {
  const path = pathOf(0);
  expect((await save(resident, path, example)).status).toBe(404);
  expect(
    (await save(owner, path, example, {photo1: photo, photo2: photo, photo3: photo, photo4: photo})).status,
  ).toBe(400);
  expect(
    (await save(owner, path, example, {photo1: photo, photo2: new Blob(['inválido'], {type: 'image/png'})}))
      .status,
  ).toBe(400);
  expect((await owner.get(path)).body.attractions).toEqual([]);

  const saved = await save(owner, path, example, {photo1: photo, photo2: photo, photo3: photo});
  expect(saved.status).toBe(201);
  const {id} = await saved.json();
  expect((await resident.get(path)).body).toMatchObject({
    canEdit: false,
    attractions: [{id, ...example, version: 1, photoSlots: [1, 2, 3]}],
  });
  expect((await neighbor.get(path)).status).toBe(404);
  const entry = `${path}/${id}`;
  const image = await fetch(api.url + entry + '/photos/1', {headers: auth(resident)});
  expect(image.status).toBe(200);
  expect(image.headers.get('content-type')).toBe('image/png');
  expect(Buffer.from(await image.arrayBuffer())).toEqual(png);

  const update = {...example, tips: 'Leve água e calçado firme.', version: 1, removePhotos: [2]};
  expect((await save(owner, entry, update)).ok).toBe(true);
  expect((await save(owner, entry, update)).status).toBe(409);
  expect((await owner.get(path)).body.attractions[0]).toMatchObject({version: 2, photoSlots: [1, 3]});
  expect((await owner.get(entry + '/photos/2')).status).toBe(404);
  expect((await owner.call('DELETE', entry + '?version=1')).status).toBe(409);
  expect((await owner.call('DELETE', entry + '?version=2')).status).toBe(200);
  expect(
    (await db.query('select count(*)::int as n from unit_attraction_photo where attraction_id = $1', [id]))
      .rows[0].n,
  ).toBe(0);
});

it('restringe texto e fotos à casa no link da estadia e encerra acesso na janela existente', async () => {
  const own = await save(owner, pathOf(0), example, {photo1: photo});
  const other = await save(neighbor, pathOf(1), {...example, title: 'Guia de outra casa'}, {photo1: photo});
  expect(own.status).toBe(201);
  expect(other.status).toBe(201);
  const {id} = await own.json();
  const {id: otherId} = await other.json();
  const start = T0 + 4 * 60 * MIN;
  const end = T0 + DAY;
  const stay = await owner.post('/stays', {
    unitId: condo.units[0]!.id,
    requestId: randomUUID(),
    checkInAt: new Date(start).toISOString(),
    checkOutAt: new Date(end).toISOString(),
    members: [
      {name: 'Pessoa Responsável', band: 'adult', contact: 'pessoa@example.test'},
      {name: 'Segundo Responsável', band: 'adult', contact: 'segundo@example.test'},
    ],
  });
  expect(stay.status).toBe(201);
  const issued = await owner.post(`/stays/${stay.body.id}/guest-link`, {version: 1});
  expect(issued.status).toBe(200);
  const {token} = issued.body;
  const guest = new WebClient(api.url);
  const path = '/stays/guest/guide';
  expect((await guest.post(path, {token})).status).toBe(410);
  clock.t = T0 + 10 * MIN;
  expect((await resident.get(pathOf(0))).status).toBe(404);
  clock.t = start - 3 * 60 * MIN;
  expect((await guest.post(path, {token})).body.attractions).toMatchObject([{id, ...example}]);
  const guestPhoto = (photoId: string) =>
    fetch(api.url + path + `/${photoId}/photos/1`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({token}),
    });
  expect((await guestPhoto(otherId)).status).toBe(404);
  expect(Buffer.from(await (await guestPhoto(id)).arrayBuffer())).toEqual(png);
  clock.t = end + 30 * MIN;
  expect((await guest.post(path, {token})).status).toBe(410);
  expect((await guestPhoto(id)).status).toBe(410);
});
