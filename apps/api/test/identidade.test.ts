import {afterAll, beforeAll, describe, expect, inject, it} from 'vitest';
import {Pool} from 'pg';
import {
  DAY,
  FakeClock,
  MIN,
  T0,
  WebClient,
  emailOf,
  seedCondominium,
  seedOwnership,
  seedPerson,
  seedResidency,
  seedRole,
  startApi,
  type Api,
  type SeededCondominium,
} from './support/api.js';
import {uuidv7} from '../src/db/tenant.js';

// Identidade, condomínio, unidades, titularidade e permissões pela API de verdade (guarda, decisão, RLS).
// Pessoas e condomínios são FICTÍCIOS ([DEMO]).
let owner: Pool;
let api: Api;
const clock = new FakeClock();
let A: SeededCondominium;
let B: SeededCondominium;
const ids: Record<string, string> = {};
const MANDATE_END = T0 + 335 * DAY;

const casa = (n: number) => A.units[n - 1]!.id;
const entrar = async (who: string) => {
  const c = new WebClient(api.url);
  const r = await c.login(emailOf(who));
  expect(r.status, `entrar como ${who}`).toBe(200);
  return c;
};

beforeAll(async () => {
  owner = new Pool({connectionString: inject('dbOwnerUrl'), max: 2});
  A = await seedCondominium(owner, 'Chandra', 5);
  B = await seedCondominium(owner, 'Outro', 1);
  for (const who of [
    'sindico',
    'dono2',
    'coA',
    'coB',
    'tenaz',
    'conselheiro',
    'sub',
    'subDelegado',
    'donoB',
    'duplo',
  ])
    ids[who] = await seedPerson(owner, who);
  await seedRole(owner, A.id, ids.sindico!, 'syndic', {
    mandate: {startsAt: T0 - 30 * DAY, endsAt: MANDATE_END},
  });
  await seedOwnership(owner, A.id, casa(5), ids.sindico!);
  await seedOwnership(owner, A.id, casa(1), ids.dono2!);
  await seedOwnership(owner, A.id, casa(2), ids.dono2!);
  await seedOwnership(owner, A.id, casa(3), ids.coA!);
  await seedOwnership(owner, A.id, casa(3), ids.coB!);
  await seedRole(owner, A.id, ids.tenaz!, 'administrator', {scopes: ['cadastro']});
  await seedRole(owner, A.id, ids.conselheiro!, 'fiscal_council');
  await seedRole(owner, A.id, ids.sub!, 'subsyndic');
  await seedRole(owner, A.id, ids.subDelegado!, 'subsyndic', {
    delegation: {
      actions: ['unit.read.all'],
      startsAt: T0 - DAY,
      endsAt: T0 + 90 * DAY,
      grantedBy: ids.sindico!,
    },
  });
  await seedOwnership(owner, B.id, B.units[0]!.id, ids.donoB!);
  await seedOwnership(owner, B.id, B.units[0]!.id, ids.duplo!);
  await seedResidency(owner, A.id, casa(5), ids.duplo!);
  api = await startApi(clock);
});
afterAll(async () => {
  await api?.close();
  await owner?.end();
});

const novo = (who: string) => ({
  displayName: `[DEMO] ${who}`,
  email: emailOf(who),
  password: 'Senha-demo-forte-2026',
});

describe('convite e titularidade pendente', () => {
  let token = '';

  it('T01 — papel no corpo é recusado; o aceite cria só titularidade PENDENTE, sem acesso à casa', async () => {
    const sindico = await entrar('sindico');
    const criado = await sindico.post('/auth/invitations', {
      purpose: 'ownership',
      unitId: casa(4),
      contactValue: emailOf('convidada'),
    });
    expect(criado.status).toBe(201);
    token = criado.body.token;

    const previa = await new WebClient(api.url).get(`/auth/invitations/${token}`);
    expect(previa.status).toBe(200);
    expect(previa.body).toMatchObject({purpose: 'ownership', unitLabel: 'Casa 04'});
    expect(previa.body.contactHint).not.toContain(emailOf('convidada'));

    const anon = new WebClient(api.url);
    const comPapel = await anon.post(`/auth/invitations/${token}/accept`, {
      ...novo('convidada'),
      role: 'syndic',
    });
    expect(comPapel).toMatchObject({status: 400, body: {error: 'campo_nao_permitido'}});

    const aceito = await anon.post(`/auth/invitations/${token}/accept`, novo('convidada'));
    expect(aceito.status).toBe(201);
    expect(aceito.body.link).toMatchObject({type: 'ownership', status: 'pending'});
    ids.convidada = aceito.body.personId;

    const convidada = await entrar('convidada');
    const minhas = await convidada.get('/me/units');
    expect(minhas.body.units).toHaveLength(1);
    expect(minhas.body.units[0]).toMatchObject({label: 'Casa 04', links: [{status: 'pending'}]});
    expect((await convidada.get(`/units/${casa(4)}`)).status).toBe(404); // pendente não abre a casa
    expect((await convidada.get('/units')).status).toBe(403);
    const pedidoComPapel = await convidada.post('/ownership-requests', {unitId: casa(2), role: 'syndic'});
    expect(pedidoComPapel).toMatchObject({status: 400, body: {error: 'campo_nao_permitido'}});
    const papeis = await owner.query('select count(*)::int as n from role_assignment where person_id = $1', [
      ids.convidada,
    ]);
    expect(papeis.rows[0].n).toBe(0);
  });

  it('T06 — convite usado não serve de novo', async () => {
    const anon = new WebClient(api.url);
    expect(await anon.get(`/auth/invitations/${token}`)).toMatchObject({
      status: 410,
      body: {error: 'convite_usado'},
    });
    const deNovo = await anon.post(`/auth/invitations/${token}/accept`, novo('convidada'));
    expect(deNovo).toMatchObject({status: 410, body: {error: 'convite_usado'}});
  });

  it('T06 — convite vencido não abre vínculo', async () => {
    const sindico = await entrar('sindico');
    const criado = await sindico.post('/auth/invitations', {
      purpose: 'ownership',
      unitId: casa(4),
      contactValue: emailOf('atrasada'),
      expiresInHours: 1,
    });
    clock.advance(61 * MIN);
    const anon = new WebClient(api.url);
    const r = await anon.post(`/auth/invitations/${criado.body.token}/accept`, novo('atrasada'));
    expect(r).toMatchObject({status: 410, body: {error: 'convite_expirado'}});
    const pessoa = await owner.query(`select count(*)::int as n from verified_contact where value = $1`, [
      emailOf('atrasada'),
    ]);
    expect(pessoa.rows[0].n).toBe(0);
  });

  it('T06 — 5 tentativas com o contato errado bloqueiam o convite', async () => {
    const sindico = await entrar('sindico');
    const criado = await sindico.post('/auth/invitations', {
      purpose: 'ownership',
      unitId: casa(4),
      contactValue: emailOf('alvo'),
    });
    const anon = new WebClient(api.url);
    for (let i = 0; i < 5; i++) {
      const r = await anon.post(`/auth/invitations/${criado.body.token}/accept`, novo(`intruso${i}`));
      expect(r).toMatchObject({status: 400, body: {error: 'contato_nao_confere'}});
    }
    const certo = await anon.post(`/auth/invitations/${criado.body.token}/accept`, novo('alvo'));
    expect(certo).toMatchObject({status: 410, body: {error: 'convite_bloqueado'}});
  });

  it('T06 — dois aceites ao mesmo tempo: só um vínculo nasce', async () => {
    const sindico = await entrar('sindico');
    const criado = await sindico.post('/auth/invitations', {
      purpose: 'ownership',
      unitId: casa(4),
      contactValue: emailOf('dupla'),
    });
    const anon = new WebClient(api.url);
    const respostas = await Promise.all([
      anon.post(`/auth/invitations/${criado.body.token}/accept`, novo('dupla')),
      anon.post(`/auth/invitations/${criado.body.token}/accept`, novo('dupla')),
    ]);
    expect(respostas.map((r) => r.status).sort()).toEqual([201, 410]);
    const vinculos = await owner.query(
      `select count(*)::int as n from ownership o join verified_contact v on v.person_id = o.person_id where v.value = $1`,
      [emailOf('dupla')],
    );
    expect(vinculos.rows[0].n).toBe(1);
  });

  it('token desconhecido ou curto responde 404', async () => {
    const anon = new WebClient(api.url);
    expect((await anon.get('/auth/invitations/abc')).status).toBe(404);
    expect((await anon.get(`/auth/invitations/${'x'.repeat(43)}`)).status).toBe(404);
  });
});

describe('validação da titularidade pela gestão', () => {
  it('valida com versão; repetir é idempotente; versão velha é recusada', async () => {
    const sindico = await entrar('sindico');
    const lista = await sindico.get('/ownership-requests');
    expect(lista.status).toBe(200);
    const pedido = lista.body.requests.find((p: {person: {id: string}}) => p.person.id === ids.convidada);
    expect(pedido).toMatchObject({status: 'pending', version: 1, unit: {label: 'Casa 04'}});
    expect(pedido.person.email).toBe(emailOf('convidada'));

    const velha = await sindico.post(`/ownership-requests/${pedido.id}/validate`, {version: 2});
    expect(velha).toMatchObject({status: 409, body: {error: 'versao_desatualizada'}});
    const ok = await sindico.post(`/ownership-requests/${pedido.id}/validate`, {version: 1});
    expect(ok.status).toBe(200);
    expect(ok.body.request).toMatchObject({status: 'validated', version: 2});
    const repetida = await sindico.post(`/ownership-requests/${pedido.id}/validate`, {version: 1});
    expect(repetida.status).toBe(200);
    expect(repetida.body.request).toMatchObject({status: 'validated', version: 2});

    const convidada = await entrar('convidada');
    const casa4 = await convidada.get(`/units/${casa(4)}`);
    expect(casa4.status).toBe(200);
    expect(casa4.body.unit.owners.map((o: {personId: string}) => o.personId)).toEqual([ids.convidada]);

    const auditoria = await owner.query(
      `select count(*)::int as n from audit_event where action = 'ownership.validate' and object_id = $1 and result = 'ok'`,
      [pedido.id],
    );
    expect(auditoria.rows[0].n).toBe(1); // a repetição não gravou de novo
  });

  it('ninguém decide o próprio pedido; recusar exige motivo e a pessoa vê o motivo', async () => {
    const sindico = await entrar('sindico');
    const pedido = await sindico.post('/ownership-requests', {unitId: casa(2)});
    expect(pedido).toMatchObject({status: 201, body: {status: 'pending', version: 1}});
    const proprio = await sindico.post(`/ownership-requests/${pedido.body.id}/validate`, {version: 1});
    expect(proprio).toMatchObject({status: 403, body: {error: 'nao_pode_decidir_o_proprio'}});

    const tenaz = await entrar('tenaz');
    expect((await tenaz.post(`/ownership-requests/${pedido.body.id}/reject`, {version: 1})).status).toBe(400);
    const recusa = await tenaz.post(`/ownership-requests/${pedido.body.id}/reject`, {
      version: 1,
      note: 'Sem documento da casa.',
    });
    expect(recusa.body.request).toMatchObject({status: 'rejected'});
    const depois = await tenaz.post(`/ownership-requests/${pedido.body.id}/validate`, {version: 2});
    expect(depois).toMatchObject({status: 409, body: {error: 'pedido_ja_decidido'}});

    const minhas = await sindico.get('/me/units');
    const casa2 = minhas.body.units.find((u: {label: string}) => u.label === 'Casa 02');
    expect(casa2.links[0]).toMatchObject({status: 'rejected', decisionNote: 'Sem documento da casa.'});
  });

  it('pedido repetido para a mesma casa responde 409', async () => {
    const dono2 = await entrar('dono2');
    const r = await dono2.post('/ownership-requests', {unitId: casa(1)});
    expect(r).toMatchObject({status: 409, body: {error: 'vinculo_ja_existe'}});
  });
});

describe('alcance de cada pessoa', () => {
  it('T04 — dono de duas casas alcança as duas e nenhuma outra', async () => {
    const dono2 = await entrar('dono2');
    const minhas = await dono2.get('/me/units');
    expect(minhas.body.units.map((u: {label: string}) => u.label)).toEqual(['Casa 01', 'Casa 02']);
    expect((await dono2.get(`/units/${casa(1)}`)).status).toBe(200);
    expect((await dono2.get(`/units/${casa(2)}`)).status).toBe(200);
    expect((await dono2.get(`/units/${casa(3)}`)).status).toBe(404);
    expect((await dono2.get(`/units/${casa(5)}`)).status).toBe(404);
  });

  it('T05 — coproprietários veem a mesma casa e a MESMA vaga, sem duplicar', async () => {
    const vistas = await Promise.all(
      ['coA', 'coB'].map(async (who) => (await (await entrar(who)).get(`/units/${casa(3)}`)).body.unit),
    );
    expect(vistas[0].parkingSpace).toEqual({number: '03', accessible: false});
    expect(vistas[1].parkingSpace).toEqual(vistas[0].parkingSpace);
    expect(vistas[0].owners.map((o: {personId: string}) => o.personId).sort()).toEqual(
      [ids.coA, ids.coB].sort(),
    );
    const vagas = await owner.query('select count(*)::int as n from parking_space where unit_id = $1', [
      casa(3),
    ]);
    expect(vagas.rows[0].n).toBe(1);

    const sindico = await entrar('sindico');
    const todas = await sindico.get('/units');
    expect(todas.body.units).toHaveLength(5);
    expect(
      new Set(todas.body.units.map((u: {parkingSpace: {number: string}}) => u.parkingSpace.number)).size,
    ).toBe(5);
  });

  it('T02, T03, T54 — casa de outra pessoa ou de outro condomínio responde igual a "não existe"', async () => {
    const dono2 = await entrar('dono2');
    const deOutro = await dono2.get(`/units/${casa(3)}`);
    const inexistente = await dono2.get(`/units/${uuidv7()}`);
    expect(deOutro.status).toBe(404);
    expect(deOutro.body).toEqual(inexistente.body);
    expect((await dono2.get('/units/nao-e-id')).status).toBe(404);

    const trocaCondominio = await dono2.get(`/units/${casa(1)}`, {condominium: B.id});
    expect(trocaCondominio.status).toBe(404);
    expect(trocaCondominio.body).toEqual(inexistente.body);
    const donoB = await entrar('donoB');
    expect((await donoB.get('/me/units', {condominium: A.id})).status).toBe(404);
    const sindico = await entrar('sindico');
    expect((await sindico.get(`/units/${B.units[0]!.id}`)).status).toBe(404);

    const negacoes = await owner.query(
      `select reason from audit_event where actor_person_id = $1 and object_id = $2 and result = 'denied'`,
      [ids.dono2, casa(3)],
    );
    expect(negacoes.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('pessoa em dois condomínios escolhe qual; sem escolher, a API pede', async () => {
    const duplo = await entrar('duplo');
    expect(await duplo.get(`/units/${B.units[0]!.id}`)).toMatchObject({
      status: 400,
      body: {error: 'escolha_o_condominio'},
    });
    expect((await duplo.get(`/units/${B.units[0]!.id}`, {condominium: B.id})).status).toBe(200);
    expect((await duplo.get(`/units/${casa(5)}`, {condominium: A.id})).status).toBe(200); // moradora da casa 5
    expect((await duplo.get(`/units/${B.units[0]!.id}`, {condominium: A.id})).status).toBe(404);
  });

  it('T20 — conselho, subsíndico e Tenaz ficam no escopo concedido', async () => {
    const sindico = await entrar('sindico');
    const pendente = await sindico.post('/auth/invitations', {
      purpose: 'ownership',
      unitId: casa(4),
      contactValue: emailOf('t20'),
    });
    await new WebClient(api.url).post(`/auth/invitations/${pendente.body.token}/accept`, novo('t20'));
    const pedido = (await sindico.get('/ownership-requests')).body.requests.find(
      (p: {person: {displayName: string}}) => p.person.displayName === '[DEMO] t20',
    );

    const conselheiro = await entrar('conselheiro');
    expect((await conselheiro.get('/units')).status).toBe(200);
    expect((await conselheiro.get('/ownership-requests')).status).toBe(403);
    expect((await conselheiro.post(`/ownership-requests/${pedido.id}/validate`, {version: 1})).status).toBe(
      403,
    );
    expect(
      (
        await conselheiro.post('/auth/invitations', {
          purpose: 'ownership',
          unitId: casa(4),
          contactValue: emailOf('x1'),
        })
      ).status,
    ).toBe(403);

    const tenaz = await entrar('tenaz');
    expect((await tenaz.get('/units')).status).toBe(200);
    expect((await tenaz.get('/ownership-requests')).status).toBe(200);
    expect(
      (
        await tenaz.post('/auth/invitations', {
          purpose: 'ownership',
          unitId: casa(4),
          contactValue: emailOf('x2'),
        })
      ).status,
    ).toBe(201);

    const sub = await entrar('sub');
    expect((await sub.get('/units')).status).toBe(403);
    expect((await sub.get('/ownership-requests')).status).toBe(403);

    const subDelegado = await entrar('subDelegado');
    expect((await subDelegado.get('/units')).status).toBe(200);
    expect(
      (
        await subDelegado.post('/auth/invitations', {
          purpose: 'ownership',
          unitId: casa(4),
          contactValue: emailOf('x3'),
        })
      ).status,
    ).toBe(403);
  });
});

describe('T19 — mandato vencido', () => {
  it('perde a gestão na hora, na mesma sessão, e mantém a casa própria', async () => {
    const relogio = new FakeClock(MANDATE_END - 2 * MIN);
    const outra = await startApi(relogio);
    try {
      const c = new WebClient(outra.url);
      expect((await c.login(emailOf('sindico'))).status).toBe(200);
      expect((await c.get('/units')).status).toBe(200);
      relogio.advance(3 * MIN);
      expect(await c.get('/units')).toMatchObject({status: 403, body: {error: 'sem_permissao'}});
      expect((await c.get('/ownership-requests')).status).toBe(403);
      expect((await c.get(`/units/${casa(5)}`)).status).toBe(200);
      const motivo = await owner.query(
        `select reason from audit_event where actor_person_id = $1 and action = 'unit.read.all' and result = 'denied' order by id desc limit 1`,
        [ids.sindico],
      );
      expect(motivo.rows[0].reason).toBe('mandato_vencido');
    } finally {
      await outra.close();
    }
  });
});
