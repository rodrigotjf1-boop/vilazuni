import {afterAll, beforeAll, describe, expect, inject, it} from 'vitest';
import {Pool} from 'pg';
import {
  FakeClock,
  MIN,
  NativeClient,
  ORIGIN,
  PASSWORD,
  WebClient,
  emailOf,
  seedCondominium,
  seedOwnership,
  seedPerson,
  startApi,
  type Api,
} from './support/api.js';
import {uuidv7} from '../src/db/tenant.js';

// Sessões (ADR-0003) e T56: o app nativo entra e renova sem cookie; cabeçalho "nativo" falso não desliga o
// CSRF do navegador. Relógio do servidor controlado.
let owner: Pool;
let api: Api;
const clock = new FakeClock();

beforeAll(async () => {
  owner = new Pool({connectionString: inject('dbOwnerUrl'), max: 2});
  const condo = await seedCondominium(owner, 'Sessões', 1);
  for (const who of ['ana', 'bruno', 'carla', 'davi', 'bloqueada']) {
    const id = await seedPerson(owner, who);
    await seedOwnership(owner, condo.id, condo.units[0]!.id, id);
  }
  api = await startApi(clock);
});
afterAll(async () => {
  await api?.close();
  await owner?.end();
});

describe('sessão web (cookie + CSRF + origem)', () => {
  it('entrar põe cookie HttpOnly SameSite=Lax e devolve só o CSRF no corpo', async () => {
    const r = await fetch(api.url + '/auth/login', {
      method: 'POST',
      headers: {'content-type': 'application/json', origin: ORIGIN},
      body: JSON.stringify({email: emailOf('ana'), password: PASSWORD}),
    });
    expect(r.status).toBe(200);
    const cookie = r.headers.getSetCookie().find((c) => c.startsWith('vz_sess='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);
    const body = await r.json();
    expect(Object.keys(body).sort()).toEqual(['csrfToken', 'transport']);
    expect(cookie).not.toContain(body.csrfToken);
  });

  it('T56 — mudar estado exige CSRF e origem permitida; cabeçalho de app nativo não desliga', async () => {
    const web = new WebClient(api.url);
    expect((await web.login(emailOf('ana'))).status).toBe(200);
    expect((await web.get('/me')).status).toBe(200); // leitura não pede CSRF

    const semCsrf = await web.post('/auth/logout', {}, {csrf: null});
    expect(semCsrf).toMatchObject({status: 403, body: {error: 'csrf_invalido'}});
    const outraOrigem = await web.post('/auth/logout', {}, {origin: 'https://malicioso.test'});
    expect(outraOrigem).toMatchObject({status: 403, body: {error: 'origem_recusada'}});
    const semOrigem = await web.post('/auth/logout', {}, {origin: null});
    expect(semOrigem).toMatchObject({status: 403, body: {error: 'origem_recusada'}});
    const fingeNativo = await web.post(
      '/auth/logout',
      {},
      {
        csrf: null,
        headers: {'x-vilazuni-client': 'android', authorization: 'Bearer qualquer-coisa-qualquer-coisa'},
      },
    );
    expect(fingeNativo).toMatchObject({status: 403, body: {error: 'csrf_invalido'}});

    expect((await web.get('/me')).status).toBe(200); // nada acima derrubou a sessão
  });

  it('entrar a partir de outra origem é recusado', async () => {
    const r = await fetch(api.url + '/auth/login', {
      method: 'POST',
      headers: {'content-type': 'application/json', origin: 'https://malicioso.test'},
      body: JSON.stringify({email: emailOf('ana'), password: PASSWORD}),
    });
    expect(r.status).toBe(403);
  });

  it('sair revoga na hora; a lista de sessões encerra outra sessão', async () => {
    const pc = new WebClient(api.url);
    const celular = new WebClient(api.url);
    await pc.login(emailOf('bruno'));
    await celular.login(emailOf('bruno'));
    const lista = await pc.get('/auth/sessions');
    expect(lista.status).toBe(200);
    expect(lista.body.sessions).toHaveLength(2);
    const outra = lista.body.sessions.find((s: {current: boolean}) => !s.current);
    expect((await pc.call('DELETE', `/auth/sessions/${outra.id}`)).status).toBe(200);
    expect((await celular.get('/me')).status).toBe(401);
    expect((await pc.post('/auth/logout')).status).toBe(200);
    expect((await pc.get('/me')).status).toBe(401);
  });

  it('id de sessão fora do formato ou de outra pessoa responde 404, sem erro interno', async () => {
    const web = new WebClient(api.url);
    await web.login(emailOf('carla'));
    expect((await web.call('DELETE', '/auth/sessions/nao-e-um-id')).status).toBe(404);
    expect((await web.call('DELETE', `/auth/sessions/${uuidv7()}`)).status).toBe(404);
  });
});

describe('sessão nativa (bearer + refresh rotativo)', () => {
  it('T56 — entra e renova sem cookie; o access vence em 15 min', async () => {
    const app = new NativeClient(api.url);
    const r = await fetch(api.url + '/auth/login', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({email: emailOf('davi'), password: PASSWORD, transport: 'native'}),
    });
    expect(r.headers.getSetCookie()).toEqual([]);
    const body = await r.json();
    app.access = body.accessToken;
    app.refreshToken = body.refreshToken;
    expect((await app.get('/me')).status).toBe(200);

    const antigo = app.access;
    clock.advance(16 * MIN);
    expect((await app.get('/me')).status).toBe(401);
    expect((await app.refresh()).status).toBe(200);
    expect((await app.get('/me')).status).toBe(200);
    expect((await app.get('/me', antigo)).status).toBe(401);
  });

  it('refresh reusado (cópia) revoga a família inteira', async () => {
    const app = new NativeClient(api.url);
    await app.login(emailOf('davi'));
    const primeiro = app.refreshToken!;
    expect((await app.refresh()).status).toBe(200);
    const novoAccess = app.access;
    const segundo = app.refreshToken!;
    const reuso = await app.refresh(primeiro);
    expect(reuso).toMatchObject({status: 401, body: {error: 'sessao_revogada'}});
    expect((await app.get('/me', novoAccess)).status).toBe(401);
    expect((await app.refresh(segundo)).status).toBe(401);
  });
});

describe('entrar: respostas iguais e limite de tentativas', () => {
  it('senha errada e e-mail inexistente respondem igual', async () => {
    const web = new WebClient(api.url);
    const errada = await web.login(emailOf('carla'), 'senha-errada-123456');
    const inexistente = await web.login(emailOf('ninguem'), 'senha-errada-123456');
    expect(errada.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(errada.body).toEqual(inexistente.body);
  });

  it('10 falhas bloqueiam a conta por 15 min, mesmo com a senha certa depois', async () => {
    const web = new WebClient(api.url);
    for (let i = 0; i < 10; i++)
      expect((await web.login(emailOf('bloqueada'), 'errada-errada-123')).status).toBe(401);
    expect((await web.login(emailOf('bloqueada'))).status).toBe(429);
    clock.advance(16 * MIN);
    expect((await web.login(emailOf('bloqueada'))).status).toBe(200);
  });

  it('e-mail com maiúscula entra na mesma conta; o banco não aceita e-mail fora do padrão', async () => {
    const web = new WebClient(api.url);
    expect((await web.login(emailOf('ana').toUpperCase())).status).toBe(200);
    await expect(
      owner.query(
        `insert into verified_contact (id, person_id, kind, value) select $1, person_id, 'email', $2 from verified_contact limit 1`,
        [uuidv7(), 'Ana.Maiuscula@demo.vilazuni.test'],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it('campo a mais no entrar é recusado', async () => {
    const r = await fetch(api.url + '/auth/login', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({email: emailOf('ana'), password: PASSWORD, role: 'syndic'}),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('campo_nao_permitido');
  });
});

describe('tela recarregada', () => {
  it('recupera o MESMO token CSRF pela sessão; sessão nativa e sem sessão não têm', async () => {
    const aba = new WebClient(api.url);
    await aba.login(emailOf('ana'));
    const recarregada = new WebClient(api.url);
    recarregada.cookie = aba.cookie; // o navegador mantém o cookie; a memória da página se perdeu
    expect(await recarregada.call('DELETE', '/auth/sessions', undefined, {csrf: null})).toMatchObject({
      status: 403,
      body: {error: 'csrf_invalido'},
    });
    const r = await recarregada.get('/auth/csrf');
    expect(r.status).toBe(200);
    expect(r.body.csrfToken).toBe(aba.csrf);
    recarregada.csrf = r.body.csrfToken;
    expect((await recarregada.call('DELETE', '/auth/sessions')).status).toBe(200);

    const app = new NativeClient(api.url);
    await app.login(emailOf('davi'));
    expect((await app.get('/auth/csrf')).status).toBe(404);
    expect((await fetch(api.url + '/auth/csrf')).status).toBe(401);
  });
});

describe('negar por padrão', () => {
  it('rota sem @Public exige sessão', async () => {
    for (const [method, path] of [
      ['GET', '/me'],
      ['GET', '/me/units'],
      ['GET', '/units'],
      ['GET', '/ownership-requests'],
      ['POST', '/ownership-requests'],
      ['POST', '/auth/invitations'],
    ] as const) {
      const r = await fetch(api.url + path, {
        method,
        headers: {'content-type': 'application/json'},
        body: method === 'POST' ? '{}' : undefined,
      });
      expect(r.status, `${method} ${path}`).toBe(401);
    }
  });

  it('todo pedido sai com id de correlação gerado no servidor', async () => {
    const r = await fetch(api.url + '/health', {headers: {'x-correlation-id': 'injetado'}});
    expect(r.headers.get('x-correlation-id')).toMatch(/^[0-9a-f-]{36}$/);
  });
});
