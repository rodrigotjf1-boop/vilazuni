import {afterAll, beforeAll, describe, expect, inject, it} from 'vitest';
import {Pool} from 'pg';
import {
  DAY,
  FakeClock,
  MIN,
  PASSWORD,
  T0,
  WebClient,
  avisosDoPg,
  emailOf,
  seedCondominium,
  seedOwnership,
  seedPerson,
  seedRole,
  seedTotp,
  startApi,
  testConfig,
  type Api,
  type SeededCondominium,
} from './support/api.js';
import {OutboxRunner, dispatchDue, MAX_ATTEMPTS} from '../src/messaging/outbox.js';
import type {EmailSender} from '../src/messaging/email.js';
import {sha256} from '../src/auth/crypto.js';

// Cadastro dos proprietários pelo link do condomínio (ADR-0011/0012): link da gestão, código por e-mail pela fila
// de saída (caixa da demonstração: nada sai do servidor), conta nova ou existente, casas PENDENTES.
// Pessoas e condomínios são FICTÍCIOS ([DEMO]).
let owner: Pool;
let app: Pool;
let api: Api;
let semEnvio: Api;
const clock = new FakeClock();
let A: SeededCondominium;
let B: SeededCondominium;
const ids: Record<string, string> = {};
const SENHA_NOVA = 'Senha-nova-do-cadastro-2026';
const REMETENTE = 'nao-responda@chandra.demo.vilazuni.test';

let sindico: WebClient;
const casa = (n: number) => A.units[n - 1]!.id;
const despachar = () => api.app.get(OutboxRunner).tick();

/** O código que chegou na caixa da demonstração para o e-mail (o mais recente). */
async function codigoNaCaixa(email: string): Promise<string> {
  await despachar();
  const r = await new WebClient(api.url).get(`/demo/mailbox?to=${encodeURIComponent(email)}`);
  expect(r.status).toBe(200);
  const texto = r.body.messages[0]?.text as string;
  const m = /: (\d{6})\b/.exec(texto ?? '');
  expect(m, `código no e-mail de ${email}`).not.toBeNull();
  return m![1]!;
}

async function novoLink(extra: Record<string, number> = {}) {
  const r = await sindico.post('/signup-links', extra);
  expect(r.status).toBe(201);
  return r.body as {id: string; token: string; path: string};
}

const anon = () => new WebClient(api.url);
const pedirCodigo = (token: string, email: string, lang = 'pt-BR') =>
  anon().post(`/signup/${token}/code`, {email, preferredLanguage: lang});
const concluir = (token: string, body: Record<string, unknown>) =>
  anon().post(`/signup/${token}/finish`, {
    displayName: '[DEMO] Pessoa do cadastro',
    password: SENHA_NOVA,
    preferredLanguage: 'pt-BR',
    ...body,
  });

beforeAll(async () => {
  owner = new Pool({connectionString: inject('dbOwnerUrl'), max: 2});
  app = new Pool({connectionString: inject('dbAppUrl'), max: 2});
  A = await seedCondominium(owner, 'Chandra', 5);
  B = await seedCondominium(owner, 'Outro', 1);
  await owner.query(`update condominium set email_sender = $2 where id = $1`, [A.id, REMETENTE]);
  for (const who of ['sindico-cad', 'antigo', 'morador-sem-papel']) ids[who] = await seedPerson(owner, who);
  await seedRole(owner, A.id, ids['sindico-cad']!, 'syndic', {mandate: {startsAt: T0 - 30 * DAY, endsAt: T0 + 300 * DAY}});
  await seedOwnership(owner, A.id, casa(1), ids.antigo!);
  await seedOwnership(owner, A.id, casa(5), ids['morador-sem-papel']!);
  totpSindico = await seedTotp(owner, ids['sindico-cad']!);
  api = await startApi(clock, {MESSAGING_MODE: 'demo', DEMO_MAILBOX_ROUTE: 'true'});
  semEnvio = await startApi(clock);
  await entrarSindico();
});

let totpSindico = '';
async function entrarSindico() {
  sindico = new WebClient(api.url);
  expect((await sindico.login(emailOf('sindico-cad'))).status).toBe(200);
  expect((await sindico.mfa(totpSindico, clock)).status).toBe(200);
}
afterAll(async () => {
  await api?.close();
  await semEnvio?.close();
  await app?.end();
  await owner?.end();
});

describe('link de cadastro (gestão)', () => {
  it('C01 — a gestão cria o link: o token aparece uma vez, no banco fica só o hash, e fica auditado', async () => {
    const link = await novoLink({expiresInDays: 14, maxUses: 30});
    expect(link.path).toBe(`/cadastro/${link.token}`);
    const linha = await owner.query(`select token_hash, max_uses from signup_link where id = $1`, [link.id]);
    expect(Buffer.compare(linha.rows[0].token_hash, sha256(link.token))).toBe(0);
    expect(linha.rows[0].max_uses).toBe(30);
    const lista = await sindico.get('/signup-links');
    expect(lista.body.links.find((l: {id: string}) => l.id === link.id)).toMatchObject({status: 'active', uses: 0});
    expect(JSON.stringify(lista.body)).not.toContain(link.token);
    const aud = await owner.query(`select 1 from audit_event where action = 'signup_link.create' and object_id = $1`, [
      link.id,
    ]);
    expect(aud.rowCount).toBe(1);
  });

  it('C02 — proprietário sem papel não cria nem lista link; campo a mais é recusado', async () => {
    const dono = new WebClient(api.url);
    expect((await dono.login(emailOf('morador-sem-papel'))).status).toBe(200);
    expect((await dono.post('/signup-links', {})).status).toBe(403);
    expect((await dono.get('/signup-links')).status).toBe(403);
    const extra = await sindico.post('/signup-links', {maxUses: 3, role: 'syndic'});
    expect(extra).toMatchObject({status: 400, body: {error: 'campo_nao_permitido'}});
  });

  it('C03 — revogar: o link para na hora; revogar de novo é conflito', async () => {
    const link = await novoLink();
    const r = await sindico.post(`/signup-links/${link.id}/revoke`);
    expect(r).toMatchObject({status: 200, body: {link: {status: 'revoked'}}});
    expect((await sindico.post(`/signup-links/${link.id}/revoke`)).body.error).toBe('link_ja_revogado');
    expect((await anon().get(`/signup/${link.token}`)).body.error).toBe('link_revogado');
    expect((await pedirCodigo(link.token, emailOf('apos-revogar'))).body.error).toBe('link_revogado');
  });
});

describe('cadastro pelo link (público)', () => {
  let token = '';

  it('C04 — a prévia mostra o condomínio e as casas; token desconhecido é 404', async () => {
    token = (await novoLink({maxUses: 10})).token;
    const p = await anon().get(`/signup/${token}`);
    expect(p.status).toBe(200);
    expect(p.body.condominiumName).toContain('Chandra');
    expect(p.body.units.map((u: {label: string}) => u.label)).toEqual(['Casa 01', 'Casa 02', 'Casa 03', 'Casa 04', 'Casa 05']);
    expect(p.body.emailAvailable).toBe(true);
    expect((await anon().get('/signup/token-que-nao-existe-de-jeito-nenhum')).status).toBe(404);
  });

  it('C05 — o código vai pela fila (remetente do condomínio) e sai do registro depois do envio', async () => {
    const email = emailOf('nova');
    const r = await pedirCodigo(token, email.toUpperCase());
    expect(r.status).toBe(201);
    const fila = await owner.query(`select status, payload from outbox_event where idempotency_key = $1`, [
      `verificacao:${r.body.verificationId}`,
    ]);
    expect(fila.rows[0]).toMatchObject({status: 'pending', payload: {to: email, template: 'verification'}});
    const codigo = await codigoNaCaixa(email);
    const depois = await owner.query(`select status, payload, provider_ref from outbox_event where idempotency_key = $1`, [
      `verificacao:${r.body.verificationId}`,
    ]);
    expect(depois.rows[0].status).toBe('sent');
    expect(JSON.stringify(depois.rows[0].payload)).not.toContain(codigo);
    expect(depois.rows[0].payload.to).not.toBe(email);
    const caixa = await owner.query(`select subject from demo_mailbox where to_address = $1`, [email]);
    expect(caixa.rows[0].subject).toContain(codigo);
    // o código não fica em claro na verificação
    const v = await owner.query(`select code_hash from email_verification where id = $1`, [r.body.verificationId]);
    expect(v.rows[0].code_hash.toString('utf8')).not.toContain(codigo);
    // o remetente é o do condomínio (o envio de verdade usa o mesmo campo)
    const enviado = await owner.query(
      `select e.condominium_id from outbox_event e join demo_mailbox d on d.outbox_id = e.id where d.to_address = $1`,
      [email],
    );
    expect(enviado.rows[0].condominium_id).toBe(A.id);
  });

  it('C06 — código errado conta tentativa (gravada); na 5ª o código bloqueia', async () => {
    const email = emailOf('errante');
    const r = await pedirCodigo(token, email);
    const certo = await codigoNaCaixa(email);
    const errado = certo === '000000' ? '111111' : '000000';
    for (let i = 1; i <= 5; i++) {
      const f = await concluir(token, {verificationId: r.body.verificationId, code: errado, unitIds: [casa(2)]});
      expect(f.body.error).toBe('codigo_invalido');
    }
    const v = await owner.query(`select attempts from email_verification where id = $1`, [r.body.verificationId]);
    expect(v.rows[0].attempts).toBe(5);
    const bloqueado = await concluir(token, {verificationId: r.body.verificationId, code: certo, unitIds: [casa(2)]});
    expect(bloqueado).toMatchObject({status: 410, body: {error: 'codigo_bloqueado'}});
  });

  it('C07 — conta nova: casas PENDENTES, entra com a senha, link gasta 1 uso, código não vale de novo', async () => {
    const email = emailOf('nova');
    const r = await pedirCodigo(token, email);
    const codigo = await codigoNaCaixa(email);
    const f = await concluir(token, {
      verificationId: r.body.verificationId,
      code: codigo,
      unitIds: [casa(2), casa(3), casa(2)],
      shareNote: 'Metade com o irmão',
    });
    expect(f.status).toBe(201);
    expect(f.body).toMatchObject({requested: ['Casa 02', 'Casa 03'], alreadyLinked: []});
    const tit = await owner.query(
      `select status, share_note from ownership where person_id = $1 order by requested_at`,
      [f.body.personId],
    );
    expect(tit.rows).toEqual([
      {status: 'pending', share_note: 'Metade com o irmão'},
      {status: 'pending', share_note: 'Metade com o irmão'},
    ]);
    // nenhum papel nasce do cadastro
    const papeis = await owner.query(`select 1 from role_assignment where person_id = $1`, [f.body.personId]);
    expect(papeis.rowCount).toBe(0);
    expect((await new WebClient(api.url).login(email, SENHA_NOVA)).status).toBe(200);
    const link = await owner.query(`select uses from signup_link where token_hash = $1`, [sha256(token)]);
    expect(link.rows[0].uses).toBe(1);
    const repetido = await concluir(token, {verificationId: r.body.verificationId, code: codigo, unitIds: [casa(4)]});
    expect(repetido.body.error).toBe('codigo_usado');
    const aud = await owner.query(
      `select actor_person_id, detail from audit_event where action = 'signup.complete' and actor_person_id = $1`,
      [f.body.personId],
    );
    expect(aud.rows[0].detail).toEqual({requested: ['Casa 02', 'Casa 03'], alreadyLinked: []});
  });

  it('C08 — e-mail que já tem conta precisa da senha dela; casa já ligada não duplica', async () => {
    const email = emailOf('antigo');
    const r = await pedirCodigo(token, email);
    const codigo = await codigoNaCaixa(email);
    const semSenha = await concluir(token, {verificationId: r.body.verificationId, code: codigo, unitIds: [casa(1)]});
    expect(semSenha.body.error).toBe('senha_da_conta_nao_confere');
    const ok = await concluir(token, {
      verificationId: r.body.verificationId,
      code: codigo,
      password: PASSWORD,
      displayName: '[DEMO] Nome que não troca',
      unitIds: [casa(1), casa(4)],
    });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({personId: ids.antigo, requested: ['Casa 04'], alreadyLinked: ['Casa 01']});
    const nome = await owner.query(`select display_name from person where id = $1`, [ids.antigo]);
    expect(nome.rows[0].display_name).toBe('[DEMO] antigo');
  });

  it('C09 — casa de outro condomínio, campo a mais e origem de fora são recusados', async () => {
    const email = emailOf('curiosa');
    const r = await pedirCodigo(token, email);
    const codigo = await codigoNaCaixa(email);
    const outra = await concluir(token, {verificationId: r.body.verificationId, code: codigo, unitIds: [B.units[0]!.id]});
    expect(outra).toMatchObject({status: 400, body: {error: 'casa_invalida'}});
    const papel = await concluir(token, {
      verificationId: r.body.verificationId,
      code: codigo,
      unitIds: [casa(4)],
      role: 'syndic',
    });
    expect(papel.body.error).toBe('campo_nao_permitido');
    const fora = await anon().post(`/signup/${token}/code`, {email}, {origin: 'https://golpe.exemplo.test'});
    expect(fora).toMatchObject({status: 403, body: {error: 'origem_recusada'}});
  });

  it('C10 — mais de 5 códigos por hora para o mesmo e-mail: 429; uma hora depois volta', async () => {
    const email = emailOf('insistente');
    for (let i = 0; i < 5; i++) expect((await pedirCodigo(token, email)).status).toBe(201);
    expect(await pedirCodigo(token, email)).toMatchObject({status: 429, body: {error: 'muitos_codigos'}});
    clock.advance(61 * MIN);
    expect((await pedirCodigo(token, email)).status).toBe(201);
  });

  it('C11 — o código vence em 15 minutos', async () => {
    const email = emailOf('lenta');
    const r = await pedirCodigo(token, email);
    const codigo = await codigoNaCaixa(email);
    clock.advance(16 * MIN);
    const f = await concluir(token, {verificationId: r.body.verificationId, code: codigo, unitIds: [casa(4)]});
    expect(f).toMatchObject({status: 410, body: {error: 'codigo_vencido'}});
  });

  it('C12 — link esgotado e link vencido param o cadastro', async () => {
    const unico = await novoLink({maxUses: 1, expiresInDays: 1});
    const email = emailOf('primeira');
    const r = await pedirCodigo(unico.token, email);
    const codigo = await codigoNaCaixa(email);
    expect((await concluir(unico.token, {verificationId: r.body.verificationId, code: codigo, unitIds: [casa(4)]})).status).toBe(
      201,
    );
    expect((await anon().get(`/signup/${unico.token}`)).body.error).toBe('link_esgotado');
    const st = async (id: string) =>
      (await sindico.get('/signup-links')).body.links.find((l: {id: string}) => l.id === id)?.status;
    expect(await st(unico.id)).toBe('exhausted');
    const curto = await novoLink({expiresInDays: 1});
    clock.advance(DAY + MIN);
    expect((await anon().get(`/signup/${curto.token}`)).body.error).toBe('link_vencido');
    await entrarSindico(); // a sessão web dura 12 h
    expect(await st(curto.id)).toBe('expired');
  });

  it('C13 — sem envio configurado: 503 no código e a caixa da demonstração não existe', async () => {
    const r = await new WebClient(semEnvio.url).post(`/signup/${(await novoLink()).token}/code`, {email: emailOf('x')});
    expect(r).toMatchObject({status: 503, body: {error: 'envio_indisponivel'}});
    expect((await new WebClient(semEnvio.url).get(`/demo/mailbox?to=${emailOf('x')}`)).status).toBe(404);
  });

  it('C14 — sem consulta simultânea no mesmo cliente do banco (LIC-004)', () => {
    expect(avisosDoPg).toEqual([]);
  });
});

describe('fila de saída', () => {
  const evento = async (chave: string, condominiumId: string | null = A.id) => {
    await owner.query(
      `insert into outbox_event (id, condominium_id, kind, idempotency_key, payload, available_at)
       values (gen_random_uuid(), $1, 'email', $2, $3, $4)`,
      [
        condominiumId,
        chave,
        JSON.stringify({
          to: emailOf('fila'),
          lang: 'es',
          template: 'verification',
          params: {code: '123456', condominiumName: '[DEMO] X', minutes: 15},
        }),
        clock.now(),
      ],
    );
  };
  const linha = async (chave: string) =>
    (await owner.query(`select * from outbox_event where idempotency_key = $1`, [chave])).rows[0];

  it('F01 — falha do provedor: tenta de novo com espera crescente e desiste na 5ª, sem guardar o código', async () => {
    await evento('teste:falha');
    let chamadas = 0;
    const quebrado: EmailSender = {
      mode: 'live',
      fallbackFrom: null,
      async send() {
        chamadas++;
        throw new Error('Throttling: limite do provedor');
      },
    };
    const t = new FakeClock(clock.t);
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      await dispatchDue(app, quebrado, t.now());
      const l = await linha('teste:falha');
      expect(l.attempts).toBe(i);
      if (i < MAX_ATTEMPTS) {
        expect(l.status).toBe('pending');
        expect(l.available_at.getTime()).toBe(t.t + 30_000 * 2 ** (i - 1));
        // antes da hora marcada não tenta
        await dispatchDue(app, quebrado, t.now());
        expect(chamadas).toBe(i);
        t.t = l.available_at.getTime();
      }
    }
    const fim = await linha('teste:falha');
    expect(fim.status).toBe('dead');
    expect(fim.last_error).toContain('Throttling');
    expect(JSON.stringify(fim.payload)).not.toContain('123456');
  });

  it('F02 — envio desligado marca "skipped"; sem remetente vai para "dead"; a mesma chave não duplica', async () => {
    await evento('teste:desligado');
    await dispatchDue(app, null, clock.now());
    expect((await linha('teste:desligado')).status).toBe('skipped');
    await evento('teste:sem-remetente', B.id);
    const semRemetente: EmailSender = {mode: 'live', fallbackFrom: null, send: async () => ({providerRef: 'x'})};
    await dispatchDue(app, semRemetente, clock.now());
    expect(await linha('teste:sem-remetente')).toMatchObject({status: 'dead', last_error: 'remetente do condomínio não configurado'});
    // espanhol: o texto sai no idioma pedido
    await evento('teste:es');
    const enviados: {subject: string; from: string}[] = [];
    const captura: EmailSender = {
      mode: 'live',
      fallbackFrom: null,
      send: async (m) => (enviados.push({subject: m.subject, from: m.from}), {providerRef: 'msg-1'}),
    };
    await dispatchDue(app, captura, clock.now());
    expect(enviados).toEqual([{subject: '123456 es su código de registro en [DEMO] X', from: REMETENTE}]);
    expect(await linha('teste:es')).toMatchObject({status: 'sent', provider_ref: 'msg-1'});
  });

  it('F03 — configuração: caixa da demonstração só em demonstração com envio demo', () => {
    expect(() => testConfig({DEMO_MAILBOX_ROUTE: 'true'})).toThrow(/caixa da demonstração/);
    expect(() =>
      testConfig({DEMO_MAILBOX_ROUTE: 'true', MESSAGING_MODE: 'demo', VILAZUNI_ENV: 'sandbox'}),
    ).toThrow(/caixa da demonstração/);
    expect(testConfig({DEMO_MAILBOX_ROUTE: 'true', MESSAGING_MODE: 'demo'}).DEMO_MAILBOX_ROUTE).toBe(true);
  });
});
