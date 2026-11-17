import {afterAll, beforeAll, describe, expect, inject, it} from 'vitest';
import {Pool} from 'pg';
import {seedDemoChandra, demoId, emailOfDemo} from '../src/seed/demo-chandra.js';
import {withCondominium} from '../src/db/tenant.js';
import {FakeClock, T0, WebClient, startApi, type Api} from './support/api.js';

// RQ-019: semeadura demonstrativa do Chandra — repetível, só em demonstração, pessoas fictícias identificadas.
let app: Pool;
let api: Api;
let creds: {email: string; password: string}[] = [];
const clock = new FakeClock(T0);

beforeAll(async () => {
  app = new Pool({connectionString: inject('dbAppUrl'), max: 2});
  // o banco de teste é dividido com outros arquivos (que criam pessoas "reais" por convite): só aqui se libera
  const r = await seedDemoChandra(app, {env: 'demo', now: new Date(T0), allowWithRealData: true});
  creds = r.credentials;
  api = await startApi(clock);
});
afterAll(async () => {
  await api?.close();
  await app?.end();
});

const senha = (key: string) => creds.find((c) => c.email === emailOfDemo(key))!.password;
const entrar = async (key: string) => {
  const c = new WebClient(api.url);
  expect((await c.login(emailOfDemo(key), senha(key))).status, `entrar como ${key}`).toBe(200);
  return c;
};

describe('semeadura demonstrativa do Chandra', () => {
  it('14 casas, 14 vagas (uma por casa), pessoas marcadas [DEMO], senhas geradas e diferentes', async () => {
    const id = demoId('condominio');
    const contagem = await withCondominium(app, id, (c) =>
      c.query(`select (select count(*)::int from unit) as casas, (select count(*)::int from parking_space) as vagas,
                      (select count(distinct unit_id)::int from parking_space) as casas_com_vaga,
                      (select environment from condominium) as ambiente`),
    );
    expect(contagem.rows[0]).toEqual({casas: 14, vagas: 14, casas_com_vaga: 14, ambiente: 'demo'});
    expect(creds.length).toBe(14);
    expect(new Set(creds.map((c) => c.password)).size).toBe(14);
    const nomes = await app.query(`select display_name, is_demo from person where id = any($1)`, [
      creds.map((c) => demoId(`pessoa-${c.email.split('@')[0]}`)),
    ]);
    expect(nomes.rows.every((p) => p.is_demo && p.display_name.startsWith('[DEMO]'))).toBe(true);
  });

  it('rodar de novo não duplica nada nem troca senha', async () => {
    const r = await seedDemoChandra(app, {env: 'demo', now: new Date(T0), allowWithRealData: true});
    expect(r).toMatchObject({created: false, credentials: []});
    const casas = await withCondominium(app, demoId('condominio'), (c) =>
      c.query(`select count(*)::int as n from unit`),
    );
    expect(casas.rows[0].n).toBe(14);
    expect((await new WebClient(api.url).login(emailOfDemo('sindica'), senha('sindica'))).status).toBe(200);
  });

  it('recusa fora da demonstração e em banco com pessoas reais', async () => {
    await expect(seedDemoChandra(app, {env: 'production'})).rejects.toThrow(/só roda com VILAZUNI_ENV=demo/);
    await expect(seedDemoChandra(app, {env: 'sandbox'})).rejects.toThrow(/só roda com VILAZUNI_ENV=demo/);
    await app.query(
      `insert into person (id, display_name, is_demo) values ($1, 'Pessoa Real de Teste', false) on conflict do nothing`,
      [demoId('pessoa-real-do-teste')],
    );
    await expect(seedDemoChandra(app, {env: 'demo'})).rejects.toThrow(/pessoas reais/);
  });

  it('os casos funcionam pela API: duas casas, copropriedade, pendente, mandato vencido, Tenaz', async () => {
    const duas = await entrar('duas-casas');
    expect((await duas.get('/me/units')).body.units.map((u: {label: string}) => u.label)).toEqual([
      'Casa 03',
      'Casa 04',
    ]);

    const co = await entrar('coproprietaria-a');
    const casa5 = (await co.get(`/units/${demoId('casa-5')}`)).body.unit;
    expect(casa5.owners).toHaveLength(2);
    expect(casa5.parkingSpace.number).toBe('05');

    const pendente = await entrar('pedido-pendente');
    expect((await pendente.get('/me/units')).body.units[0].links[0].status).toBe('pending');
    expect((await pendente.get(`/units/${demoId('casa-10')}`)).status).toBe(404);

    const ex = await entrar('ex-sindico');
    expect((await ex.get('/units')).status).toBe(403);
    expect((await ex.get(`/units/${demoId('casa-2')}`)).status).toBe(200);

    const sindica = await entrar('sindica');
    expect(await sindica.get('/units')).toMatchObject({status: 403, body: {error: 'mfa_exigido'}});

    const tenaz = await entrar('tenaz');
    const pedidos = (await tenaz.get('/ownership-requests')).body.requests;
    expect(pedidos.map((p: {unit: {label: string}}) => p.unit.label)).toEqual(['Casa 10']);

    const morador = await entrar('morador-contrato');
    const casasDoMorador = (await morador.get('/me/units')).body.units;
    expect(casasDoMorador).toHaveLength(1);
    expect(casasDoMorador[0]).toMatchObject({
      label: 'Casa 06',
      links: [{type: 'residency', status: 'active'}],
    });
    expect((await morador.get(`/units/${demoId('casa-6')}`)).status).toBe(200);
    expect((await morador.get(`/units/${demoId('casa-7')}`)).status).toBe(404);
  });
});
