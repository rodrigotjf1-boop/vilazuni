import {afterAll, beforeAll, describe, expect, inject, it} from 'vitest';
import {Pool} from 'pg';
import {
  DAY,
  FakeClock,
  MIN,
  PASSWORD,
  T0,
  WebClient,
  emailOf,
  seedCondominium,
  seedOwnership,
  seedPerson,
  seedRole,
  seedTotp,
  startApi,
  totpAt,
  avisosDoPg,
  type Api,
  type SeededCondominium,
} from './support/api.js';
import {withCondominium, uuidv7} from '../src/db/tenant.js';

// Segundo fator (TOTP + códigos de recuperação), pessoas e papéis, mandatos, delegações, convite de papel e
// leitura da auditoria — pela API de verdade, com o relógio do servidor controlado. Tudo FICTÍCIO ([DEMO]).
let owner: Pool;
let api: Api;
const clock = new FakeClock();
let G: SeededCondominium;
let H: SeededCondominium;
const ids: Record<string, string> = {};
const MANDATE_END = T0 + 335 * DAY;
let segredo = '';
let codigos: string[] = [];
let subTotp = '';
let gestora: WebClient;

const casa = (n: number) => G.units[n - 1]!.id;
const entrar = async (who: string) => {
  const c = new WebClient(api.url);
  expect((await c.login(emailOf(who))).status, `entrar como ${who}`).toBe(200);
  return c;
};
/** Novo código (o anterior não vale de novo): avança meio minuto e confirma. */
const reconfirmar = async (c: WebClient, secret = segredo) => {
  clock.advance(31_000);
  const r = await c.mfa(secret, clock);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
};
const errado = (code: string) => code.replace(/\d/g, (d) => String((Number(d) + 1) % 10));

beforeAll(async () => {
  owner = new Pool({connectionString: inject('dbOwnerUrl'), max: 2});
  G = await seedCondominium(owner, 'Gestão', 4);
  H = await seedCondominium(owner, 'Vizinho', 1);
  for (const who of ['sindica', 'dona', 'coDona', 'conselheira', 'sub', 'candidata', 'externo', 'donaH'])
    ids[who] = await seedPerson(owner, who);
  ids.sindicaRole = await seedRole(owner, G.id, ids.sindica!, 'syndic', {
    mandate: {startsAt: T0 - 30 * DAY, endsAt: MANDATE_END},
  });
  ids.sindicaExtra = await seedRole(owner, G.id, ids.sindica!, 'security_reviewer');
  await seedOwnership(owner, G.id, casa(1), ids.sindica!);
  await seedOwnership(owner, G.id, casa(2), ids.dona!);
  await seedOwnership(owner, G.id, casa(2), ids.coDona!);
  await seedOwnership(owner, G.id, casa(3), ids.sub!);
  await withCondominium(owner, G.id, (c) =>
    c.query(
      `insert into ownership (id, condominium_id, unit_id, person_id, status) values ($1, $2, $3, $4, 'pending')`,
      [uuidv7(), G.id, casa(4), ids.candidata],
    ),
  );
  await seedRole(owner, G.id, ids.conselheira!, 'fiscal_council');
  ids.subRole = await seedRole(owner, G.id, ids.sub!, 'subsyndic');
  subTotp = await seedTotp(owner, ids.sub!);
  await seedOwnership(owner, H.id, H.units[0]!.id, ids.donaH!);
  await withCondominium(owner, H.id, (c) =>
    c.query(
      `insert into audit_event (condominium_id, actor_kind, action, result) values ($1, 'system', 'teste.vizinho', 'ok')`,
      [H.id],
    ),
  );
  api = await startApi(clock);
});
afterAll(async () => {
  await api?.close();
  await owner?.end();
});

describe('segundo fator (TOTP)', () => {
  it('sem segundo fator a gestão pede a verificação; o que é da casa própria não', async () => {
    const s = await entrar('sindica');
    expect(await s.get('/units')).toMatchObject({status: 403, body: {error: 'mfa_exigido'}});
    expect((await s.get(`/units/${casa(1)}`)).status).toBe(200);
    expect((await s.get('/me')).body.mfa).toEqual({enrolled: false, satisfied: false});
  });

  it('configurar pede a senha; o segredo fica cifrado; confirmar gera 10 códigos de recuperação', async () => {
    gestora = await entrar('sindica');
    expect(await gestora.post('/auth/mfa/totp/setup', {password: 'senha-errada-123'})).toMatchObject({
      status: 403,
      body: {error: 'senha_incorreta'},
    });
    const setup = await gestora.post('/auth/mfa/totp/setup', {password: PASSWORD});
    expect(setup.status).toBe(200);
    segredo = setup.body.secret;
    expect(setup.body.otpauthUri).toMatch(/^otpauth:\/\/totp\/Vilazuni/);
    const guardado = await owner.query(
      `select secret from auth_credential where person_id = $1 and kind = 'totp'`,
      [ids.sindica],
    );
    expect(guardado.rows[0].secret.startsWith('v1.t1.')).toBe(true);
    expect(guardado.rows[0].secret).not.toContain(segredo);

    const ruim = await gestora.post('/auth/mfa/totp/confirm', {code: errado(totpAt(segredo, clock))});
    expect(ruim).toMatchObject({status: 400, body: {error: 'codigo_invalido'}});
    const ok = await gestora.post('/auth/mfa/totp/confirm', {code: totpAt(segredo, clock)});
    expect(ok.status).toBe(200);
    codigos = ok.body.recoveryCodes;
    expect(codigos).toHaveLength(10);
    expect(new Set(codigos).size).toBe(10);
    expect((await gestora.get('/units')).status).toBe(200);
    expect(await gestora.post('/auth/mfa/totp/setup', {password: PASSWORD})).toMatchObject({
      status: 409,
      body: {error: 'mfa_ja_ativo'},
    });
    expect((await gestora.get('/auth/mfa')).body).toMatchObject({
      enrolled: true,
      satisfied: true,
      recoveryCodesLeft: 10,
    });
  });

  it('T06 — o mesmo código não vale de novo; 5 códigos errados travam por 15 min', async () => {
    const outra = await entrar('sindica');
    expect(await outra.mfa(segredo, clock)).toMatchObject({status: 400, body: {error: 'codigo_invalido'}});
    await reconfirmar(outra);

    const terceira = await entrar('sindica');
    for (let i = 0; i < 5; i++)
      expect((await terceira.post('/auth/mfa/verify', {code: errado(totpAt(segredo, clock))})).status).toBe(
        400,
      );
    clock.advance(31_000);
    expect(await terceira.mfa(segredo, clock)).toMatchObject({status: 429, body: {error: 'mfa_bloqueado'}});
    clock.advance(16 * MIN);
    expect((await terceira.mfa(segredo, clock)).status).toBe(200);
  });

  it('código de recuperação vale uma vez (com ou sem hífen, maiúscula ou não)', async () => {
    const a = await entrar('sindica');
    expect(
      (await a.post('/auth/mfa/verify', {recoveryCode: codigos[0]!.toLowerCase().replace('-', '')})).status,
    ).toBe(200);
    const b = await entrar('sindica');
    expect(await b.post('/auth/mfa/verify', {recoveryCode: codigos[0]})).toMatchObject({
      status: 400,
      body: {error: 'codigo_invalido'},
    });
    expect((await b.get('/auth/mfa')).body.recoveryCodesLeft).toBe(9);
  });
});

describe('pessoas, papéis, mandatos e delegações', () => {
  it('ato crítico pede o código recente', async () => {
    await reconfirmar(gestora);
    clock.advance(16 * MIN);
    const papel = {personId: ids.dona, role: 'fiscal_council', reason: 'Eleita em assembleia [DEMO]'};
    expect(await gestora.post('/roles', papel)).toMatchObject({
      status: 403,
      body: {error: 'mfa_recente_exigido'},
    });
    await reconfirmar(gestora);
    expect((await gestora.post('/roles', papel)).status).toBe(201);
  });

  it('ninguém concede papel a si; pessoa de fora = 404; repetido = 409; síndico exige mandato sem sobreposição', async () => {
    const motivo = 'Teste [DEMO]';
    expect(
      await gestora.post('/roles', {
        personId: ids.sindica,
        role: 'administrator',
        scopes: ['cadastro'],
        reason: motivo,
      }),
    ).toMatchObject({
      status: 403,
      body: {error: 'nao_pode_conceder_a_si'},
    });
    expect(
      (await gestora.post('/roles', {personId: ids.externo, role: 'fiscal_council', reason: motivo})).status,
    ).toBe(404);
    expect(
      await gestora.post('/roles', {personId: ids.dona, role: 'fiscal_council', reason: motivo}),
    ).toMatchObject({
      status: 409,
      body: {error: 'papel_ja_ativo'},
    });
    expect(
      await gestora.post('/roles', {
        personId: ids.dona,
        role: 'service_provider',
        scopes: ['cadastro'],
        reason: motivo,
      }),
    ).toMatchObject({
      status: 400,
      body: {error: 'escopo_so_da_administradora'},
    });
    expect(
      await gestora.post('/roles', {personId: ids.candidata, role: 'syndic', reason: motivo}),
    ).toMatchObject({
      status: 400,
      body: {error: 'mandato_obrigatorio'},
    });
    const sobreposto = {
      personId: ids.candidata,
      role: 'syndic',
      reason: motivo,
      mandate: {
        startsAt: new Date(T0).toISOString(),
        endsAt: new Date(T0 + 365 * DAY).toISOString(),
        minutesReference: 'Ata [DEMO]',
      },
    };
    expect(await gestora.post('/roles', sobreposto)).toMatchObject({
      status: 409,
      body: {error: 'mandato_sobreposto'},
    });
    const depois = {
      ...sobreposto,
      mandate: {
        startsAt: new Date(MANDATE_END).toISOString(),
        endsAt: new Date(MANDATE_END + 365 * DAY).toISOString(),
        minutesReference: 'Ata da próxima eleição [DEMO]',
      },
    };
    expect((await gestora.post('/roles', depois)).status).toBe(201);
  });

  it('delegação: não repassa ato crítico, não passa do mandato, não vai para si; o delegado age com segundo fator', async () => {
    const base = {roleAssignmentId: ids.subRole, documentReference: 'Ata de delegação [DEMO]'};
    const fim = new Date(T0 + 30 * DAY).toISOString();
    expect(
      await gestora.post('/delegations', {...base, actions: ['role.assign'], endsAt: fim}),
    ).toMatchObject({
      status: 400,
      body: {error: 'acao_nao_delegavel'},
    });
    expect(
      await gestora.post('/delegations', {
        ...base,
        actions: ['unit.read.all'],
        endsAt: new Date(MANDATE_END + DAY).toISOString(),
      }),
    ).toMatchObject({status: 400, body: {error: 'delegacao_alem_do_mandato'}});
    expect(
      await gestora.post('/delegations', {
        ...base,
        roleAssignmentId: ids.sindicaExtra,
        actions: ['unit.read.all'],
        endsAt: fim,
      }),
    ).toMatchObject({status: 403, body: {error: 'nao_pode_conceder_a_si'}});
    expect(
      await gestora.post('/delegations', {
        ...base,
        roleAssignmentId: ids.sindicaRole,
        actions: ['unit.read.all'],
        endsAt: fim,
      }),
    ).toMatchObject({status: 400, body: {error: 'delegacao_para_sindico'}});
    expect(
      (
        await gestora.post('/delegations', {
          ...base,
          actions: ['ownership.validate', 'unit.read.all'],
          endsAt: fim,
        })
      ).status,
    ).toBe(201);

    const sub = await entrar('sub');
    expect(await sub.get('/units')).toMatchObject({status: 403, body: {error: 'mfa_exigido'}});
    await reconfirmar(sub, subTotp);
    expect((await sub.get('/units')).status).toBe(200);
    expect((await sub.get('/ownership-requests')).status).toBe(200);
    expect(
      (await sub.post('/roles', {personId: ids.dona, role: 'service_provider', reason: 'x [DEMO]'})).status,
    ).toBe(403);
  });

  it('encerrar o papel derruba a delegação junto e o poder na hora', async () => {
    const sub = await entrar('sub');
    await reconfirmar(sub, subTotp);
    expect((await sub.get('/units')).status).toBe(200);
    const fim = await gestora.post(`/roles/${ids.subRole}/end`, {reason: 'Renunciou [DEMO]'});
    expect(fim).toMatchObject({status: 200, body: {status: 'ended'}});
    expect((await sub.get('/units')).status).toBe(403);
    const papeis = (await gestora.get('/roles')).body.roles;
    const doSub = papeis.find((r: {id: string}) => r.id === ids.subRole);
    expect(doSub.status).toBe('ended');
    expect(doSub.delegations.every((d: {status: string}) => d.status === 'ended')).toBe(true);
    expect(await gestora.post(`/roles/${ids.subRole}/end`, {reason: 'De novo [DEMO]'})).toMatchObject({
      status: 409,
      body: {error: 'papel_ja_encerrado'},
    });
  });

  it('convite de papel: a Tenaz entra com o escopo; quem convidou não aceita o próprio convite', async () => {
    const convite = await gestora.post('/auth/invitations', {
      purpose: 'role',
      role: 'administrator',
      scopes: ['cadastro'],
      contactValue: emailOf('tenazNova'),
    });
    expect(convite.status).toBe(201);
    const previa = await new WebClient(api.url).get(`/auth/invitations/${convite.body.token}`);
    expect(previa.body).toMatchObject({purpose: 'role', role: 'administrator', scopes: ['cadastro']});
    const aceito = await new WebClient(api.url).post(`/auth/invitations/${convite.body.token}/accept`, {
      displayName: '[DEMO] Tenaz Nova',
      email: emailOf('tenazNova'),
      password: PASSWORD,
    });
    expect(aceito.body.link).toMatchObject({type: 'role', status: 'active'});
    const tenaz = await entrar('tenazNova');
    expect((await tenaz.get('/ownership-requests')).status).toBe(200);
    expect((await tenaz.get('/roles')).status).toBe(200); // cadastro lê pessoas e papéis
    expect(
      (await tenaz.post('/roles', {personId: ids.dona, role: 'service_provider', reason: 'x [DEMO]'})).status,
    ).toBe(403);

    const proprio = await gestora.post('/auth/invitations', {
      purpose: 'role',
      role: 'service_provider',
      contactValue: emailOf('sindica'),
    });
    const recusa = await new WebClient(api.url).post(`/auth/invitations/${proprio.body.token}/accept`, {
      displayName: '[DEMO] Síndica',
      email: emailOf('sindica'),
      password: PASSWORD,
    });
    expect(recusa).toMatchObject({status: 403, body: {error: 'nao_pode_conceder_a_si'}});

    const dona = await entrar('dona');
    expect(
      (
        await dona.post('/auth/invitations', {
          purpose: 'role',
          role: 'service_provider',
          contactValue: emailOf('x9'),
        })
      ).status,
    ).toBe(403);
    expect(
      await gestora.post('/auth/invitations', {purpose: 'role', role: 'syndic', contactValue: emailOf('x8')}),
    ).toMatchObject({
      status: 400,
      body: {error: 'dados_invalidos'},
    });
  });

  it('lista de pessoas: só gestão; traz vínculos e papéis; sem gente de outro condomínio', async () => {
    const lista = await gestora.get('/people');
    expect(lista.status).toBe(200);
    const dona = lista.body.people.find((p: {id: string}) => p.id === ids.dona);
    expect(dona.ownerships.map((o: {unitLabel: string}) => o.unitLabel)).toEqual(['Casa 02']);
    expect(dona.roles.map((r: {role: string}) => r.role)).toContain('fiscal_council');
    expect(dona.email).toBe(emailOf('dona'));
    expect(lista.body.people.some((p: {id: string}) => p.id === ids.donaH)).toBe(false);
    expect(lista.body.people.some((p: {id: string}) => p.id === ids.externo)).toBe(false);
    expect((await (await entrar('conselheira')).get('/people')).status).toBe(403);
    expect((await (await entrar('candidata')).get('/people')).status).toBe(403);
  });
});

describe('auditoria', () => {
  it('gestão e conselho leem; dono não; paginada; sem evento de outro condomínio nem os pessoais do segundo fator', async () => {
    const pagina = await gestora.get('/audit-events?limit=5');
    expect(pagina.status).toBe(200);
    expect(pagina.body.events).toHaveLength(5);
    const seguinte = await gestora.get(`/audit-events?limit=5&before=${pagina.body.nextBefore}`);
    expect(seguinte.body.events.every((e: {id: number}) => e.id < pagina.body.nextBefore)).toBe(true);

    const todos = (await gestora.get('/audit-events?limit=100')).body.events as {
      action: string;
      result: string;
      reason: string;
    }[];
    expect(todos.some((e) => e.action === 'role.assign' && e.result === 'ok')).toBe(true);
    expect(todos.some((e) => e.result === 'denied' && e.reason === 'mfa_recente_exigido')).toBe(true);
    expect(todos.some((e) => e.action.startsWith('mfa.'))).toBe(false);
    expect(todos.some((e) => e.action === 'teste.vizinho')).toBe(false);

    const negados = (await gestora.get('/audit-events?result=denied')).body.events as {result: string}[];
    expect(negados.length).toBeGreaterThan(0);
    expect(negados.every((e) => e.result === 'denied')).toBe(true);

    expect((await (await entrar('conselheira')).get('/audit-events')).status).toBe(200);
    // proprietária sem papel ("dona" virou conselheira no teste de papéis)
    expect((await (await entrar('coDona')).get('/audit-events')).status).toBe(403);
  });
});

describe('trocar de aparelho', () => {
  it('pede senha e código recente, e nenhuma sessão continua verificada', async () => {
    const outraSessao = await entrar('sindica');
    await reconfirmar(outraSessao);
    clock.advance(16 * MIN);
    expect(await gestora.post('/auth/mfa/totp/reset', {password: PASSWORD})).toMatchObject({
      status: 403,
      body: {error: 'mfa_recente_exigido'},
    });
    await reconfirmar(gestora);
    expect((await gestora.post('/auth/mfa/totp/reset', {password: 'senha-errada-123'})).status).toBe(403);
    expect((await gestora.post('/auth/mfa/totp/reset', {password: PASSWORD})).status).toBe(200);
    expect(await gestora.get('/units')).toMatchObject({status: 403, body: {error: 'mfa_exigido'}});
    expect(await outraSessao.get('/units')).toMatchObject({status: 403, body: {error: 'mfa_exigido'}});
    expect((await gestora.get('/auth/mfa')).body).toMatchObject({enrolled: false, satisfied: false});
  });

  it('sem chave-mestra no servidor, configurar responde 503 sem detalhe', async () => {
    const semCofre = await startApi(clock, {VILAZUNI_MASTER_KEYS: ''});
    try {
      const c = new WebClient(semCofre.url);
      await c.login(emailOf('dona'));
      expect(await c.post('/auth/mfa/totp/setup', {password: PASSWORD})).toMatchObject({
        status: 503,
        body: {error: 'cofre_indisponivel'},
      });
    } finally {
      await semCofre.close();
    }
  });
});

describe('banco', () => {
  it('nenhuma consulta simultânea no mesmo cliente (vira erro no pg 9)', async () => {
    await new Promise((r) => setTimeout(r, 20));
    expect(avisosDoPg).toEqual([]);
  });
});
