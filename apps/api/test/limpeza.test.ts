import {afterAll, beforeAll, describe, expect, inject, it} from 'vitest';
import {randomBytes} from 'node:crypto';
import {Pool} from 'pg';
import {createDatabase, dropDatabase} from '../src/db/provision.js';
import {migrate} from '../src/db/migrate.js';
import {seedDemoChandra} from '../src/seed/demo-chandra.js';
import {cleanDemoData, describeCleanup} from '../src/seed/limpar-demo.js';
import {uuidv7, withCondominium} from '../src/db/tenant.js';

// Limpeza da base de teste (ADR-0011 §2) num banco À PARTE: ela apaga todo condomínio de demonstração, e os outros
// arquivos de teste rodam em paralelo no banco comum. Pessoas e condomínios FICTÍCIOS.
const adminUrl = process.env.VZ_TEST_ADMIN_URL || 'postgresql://postgres@127.0.0.1:55432/postgres';
const database = `vz_limpeza_${Date.now()}_${randomBytes(3).toString('hex')}`;
const noBanco = (url: string) => {
  const u = new URL(url);
  u.pathname = '/' + database;
  return u.toString();
};
let owner: Pool;
let app: Pool;
const ids: Record<string, string> = {};
let demoCondo = '';
let realCondo = '';
let realUnit = '';
let demoUnit = '';

async function pessoa(nome: string, email: string, isDemo = false) {
  const id = uuidv7();
  await owner.query(`insert into person (id, display_name, is_demo) values ($1, $2, $3)`, [id, nome, isDemo]);
  await owner.query(
    `insert into verified_contact (id, person_id, kind, value, verified_at) values ($1, $2, 'email', $3, now())`,
    [uuidv7(), id, email],
  );
  return id;
}
const count = async (sql: string, params: unknown[] = []) =>
  (await owner.query(sql, params)).rows[0].n as number;

beforeAll(async () => {
  await createDatabase(adminUrl, database);
  owner = new Pool({connectionString: noBanco(inject('dbOwnerUrl')), max: 2});
  await migrate(owner);
  app = new Pool({connectionString: noBanco(inject('dbAppUrl')), max: 2});
  const seed = await seedDemoChandra(app, {env: 'demo'});
  demoCondo = seed.condominiumId;
  demoUnit = (
    await owner.query(`select id from unit where condominium_id = $1 order by label limit 1`, [demoCondo])
  ).rows[0].id;

  // condomínio de PRODUÇÃO no mesmo banco: nada dele pode sumir
  realCondo = uuidv7();
  realUnit = uuidv7();
  ids.real = await pessoa('Pessoa real', 'real@exemplo.test');
  ids.misto = await pessoa('Testou na demonstração e é dona de verdade', 'misto@exemplo.test');
  ids.teste = await pessoa('[DEMO] Conta criada pelo link de teste', 'teste.link@exemplo.test');
  await withCondominium(owner, realCondo, async (c) => {
    await c.query(
      `insert into condominium (id, name, city, state, environment) values ($1, 'Condomínio de verdade', 'Cidade', 'RJ', 'production')`,
      [realCondo],
    );
    await c.query(`insert into unit (id, condominium_id, label) values ($1, $2, 'Casa 01')`, [
      realUnit,
      realCondo,
    ]);
    for (const who of ['real', 'misto'])
      await c.query(
        `insert into ownership (id, condominium_id, unit_id, person_id, status, starts_at, decided_by, decided_at)
         values ($1, $2, $3, $4, 'validated', now(), $5, now())`,
        [uuidv7(), realCondo, realUnit, ids[who], ids.real],
      );
    await c.query(
      `insert into signup_link (id, condominium_id, token_hash, max_uses, expires_at, created_by)
       values ($1, $2, $3, 10, now() + interval '7 days', $4)`,
      [uuidv7(), realCondo, randomBytes(32), ids.real],
    );
    await c.query(
      `insert into audit_event (condominium_id, actor_person_id, actor_kind, action, result) values ($1, $2, 'person', 'teste.real', 'ok')`,
      [realCondo, ids.real],
    );
  });

  // no condomínio de demonstração: o cadastro de teste (link, código, fila, caixa) e a pessoa "mista"
  await withCondominium(owner, demoCondo, async (c) => {
    for (const who of ['misto', 'teste'])
      await c.query(
        `insert into ownership (id, condominium_id, unit_id, person_id, status) values ($1, $2, $3, $4, 'pending')`,
        [uuidv7(), demoCondo, demoUnit, ids[who]],
      );
    const link = uuidv7();
    const sindica = (await c.query(`select person_id from role_assignment where role = 'syndic' limit 1`))
      .rows[0].person_id;
    await c.query(
      `insert into signup_link (id, condominium_id, token_hash, max_uses, expires_at, created_by)
       values ($1, $2, $3, 10, now() + interval '7 days', $4)`,
      [link, demoCondo, randomBytes(32), sindica],
    );
    await c.query(
      `insert into email_verification (id, condominium_id, signup_link_id, email, code_hash, expires_at)
       values ($1, $2, $3, 'teste.link@exemplo.test', $4, now() + interval '15 minutes')`,
      [uuidv7(), demoCondo, link, randomBytes(32)],
    );
    const outbox = uuidv7();
    await c.query(
      `insert into outbox_event (id, condominium_id, kind, idempotency_key, payload, status)
       values ($1, $2, 'email', $3, '{}', 'sent')`,
      [outbox, demoCondo, `teste:${outbox}`],
    );
    await c.query(
      `insert into demo_mailbox (outbox_id, to_address, subject, body_text) values ($1, 'teste.link@exemplo.test', 's', 't')`,
      [outbox],
    );
  });
  // sessão e auditoria geral (sem condomínio) da conta de teste
  await owner.query(
    `insert into auth_session (id, person_id, transport, token_hash, csrf_hash, expires_at)
     values ($1, $2, 'web', $3, $4, now() + interval '1 hour')`,
    [uuidv7(), ids.teste, randomBytes(32), randomBytes(32)],
  );
  await owner.query(
    `insert into audit_event (condominium_id, actor_person_id, actor_kind, action, result) values (null, $1, 'person', 'auth.login', 'ok')`,
    [ids.teste],
  );
});

afterAll(async () => {
  await app?.end();
  await owner?.end();
  await dropDatabase(adminUrl, database);
});

describe('limpeza da base de teste', () => {
  let pessoasDeTeste = 0;

  it('L01 — produção recusa', async () => {
    await expect(cleanDemoData(owner, {env: 'production', apply: true})).rejects.toThrow(/production/);
  });

  it('L02 — a prévia conta o que sairia e não apaga nada', async () => {
    pessoasDeTeste = await count(`select count(*)::int as n from person where is_demo`);
    const antes = await count(`select count(*)::int as n from ownership`);
    const r = await cleanDemoData(owner, {env: 'demo', apply: false});
    expect(r.applied).toBe(false);
    expect(r.condominiums.map((c) => c.id)).toEqual([demoCondo]);
    expect(r.deleted.condominium).toBe(1);
    expect(r.deleted.unit).toBe(14);
    expect(r.deleted.person).toBe(pessoasDeTeste + 1);
    expect(r.deleted.demo_mailbox).toBe(1);
    expect(r.deleted.auth_session).toBe(1);
    expect(r.keptPeople).toBe(1);
    expect(describeCleanup(r)).toContain('nada foi apagado');
    expect(await count(`select count(*)::int as n from ownership`)).toBe(antes);
    expect(await count(`select count(*)::int as n from condominium`)).toBe(2);
  });

  it('L03 — apagar: some só a demonstração; produção e quem tem vínculo nela ficam', async () => {
    const r = await cleanDemoData(owner, {env: 'demo', apply: true});
    expect(r.applied).toBe(true);
    expect(await count(`select count(*)::int as n from condominium where environment = 'demo'`)).toBe(0);
    expect(await count(`select count(*)::int as n from person where is_demo`)).toBe(0);
    expect(await count(`select count(*)::int as n from person where id = $1`, [ids.teste])).toBe(0);
    for (const tabela of ['signup_link', 'email_verification', 'outbox_event', 'demo_mailbox'])
      expect(
        await count(
          tabela === 'demo_mailbox'
            ? `select count(*)::int as n from demo_mailbox`
            : `select count(*)::int as n from ${tabela} where condominium_id = $1`,
          tabela === 'demo_mailbox' ? [] : [demoCondo],
        ),
        tabela,
      ).toBe(0);
    // produção intacta
    expect(await count(`select count(*)::int as n from condominium where id = $1`, [realCondo])).toBe(1);
    expect(
      await count(`select count(*)::int as n from ownership where condominium_id = $1`, [realCondo]),
    ).toBe(2);
    expect(
      await count(`select count(*)::int as n from signup_link where condominium_id = $1`, [realCondo]),
    ).toBe(1);
    expect(await count(`select count(*)::int as n from audit_event where action = 'teste.real'`)).toBe(1);
    // quem testou na demonstração e é dona de verdade continua, com a conta e só o vínculo real
    expect(
      await count(`select count(*)::int as n from person where id in ($1, $2)`, [ids.real, ids.misto]),
    ).toBe(2);
    expect(await count(`select count(*)::int as n from ownership where person_id = $1`, [ids.misto])).toBe(1);
    // a limpeza fica na auditoria geral
    const aud = await owner.query(`select detail from audit_event where action = 'demo.cleanup'`);
    expect(aud.rows).toHaveLength(1);
    expect(aud.rows[0].detail.deleted.person).toBe(pessoasDeTeste + 1);
  });

  it('L04 — rodar de novo não apaga mais nada', async () => {
    const r = await cleanDemoData(owner, {env: 'demo', apply: true});
    expect(Object.values(r.deleted).every((n) => n === 0)).toBe(true);
    expect(r.condominiums).toEqual([]);
  });

  it('L05 — a semeadura volta a funcionar depois da limpeza (base pronta para outro teste)', async () => {
    // há pessoas reais neste banco: a semeadura só roda com a permissão explícita
    const seed = await seedDemoChandra(app, {env: 'demo', allowWithRealData: true});
    expect(seed.created).toBe(true);
    expect(
      await count(`select count(*)::int as n from unit where condominium_id = $1`, [seed.condominiumId]),
    ).toBe(14);
  });
});
