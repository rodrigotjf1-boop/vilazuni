import {afterAll, beforeAll, describe, expect, inject, it} from 'vitest';
import {Pool} from 'pg';
import {withCondominium, uuidv7} from '../src/db/tenant.js';

// Segunda barreira (ADR-0004): RLS por transação, papel de aplicação sem BYPASSRLS, chave composta.
// T03 e T54 no nível do banco — mesmo uma consulta crua da aplicação não enxerga o outro condomínio.
let owner: Pool;
let app: Pool;
const A = uuidv7();
const B = uuidv7();
const unitA = uuidv7();
const unitB = uuidv7();
const person = uuidv7();

async function seedCondominium(id: string, unitId: string, label: string) {
  await withCondominium(owner, id, async (c) => {
    await c.query(
      `insert into condominium (id, name, city, state, environment) values ($1, $2, 'Cidade Demo', 'RJ', 'demo')`,
      [id, `[DEMO] Condomínio ${label}`],
    );
    await c.query(`insert into unit (id, condominium_id, label) values ($1, $2, 'Casa 01')`, [unitId, id]);
  });
}

beforeAll(async () => {
  owner = new Pool({connectionString: inject('dbOwnerUrl'), max: 2});
  app = new Pool({connectionString: inject('dbAppUrl'), max: 1}); // 1 conexão: o teste de vazamento reusa a mesma
  await seedCondominium(A, unitA, 'A');
  await seedCondominium(B, unitB, 'B');
  await owner.query(`insert into person (id, display_name, is_demo) values ($1, '[DEMO] Pessoa', true)`, [
    person,
  ]);
  for (const [condo, unit] of [
    [A, unitA],
    [B, unitB],
  ] as const)
    await withCondominium(owner, condo, (c) =>
      c.query(
        `insert into ownership (id, condominium_id, unit_id, person_id, status) values ($1, $2, $3, $4, 'pending')`,
        [uuidv7(), condo, unit, person],
      ),
    );
});
afterAll(async () => {
  await owner?.end();
  await app?.end();
});

describe('RLS — isolamento por condomínio no banco', () => {
  it('o papel de aplicação não é superusuário nem tem BYPASSRLS, e não é dono das tabelas', async () => {
    const r = await app.query(`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`);
    expect(r.rows[0]).toEqual({rolsuper: false, rolbypassrls: false});
    const donas = await app.query(
      `select count(*)::int as n from pg_tables where schemaname = 'public' and tableowner = current_user`,
    );
    expect(donas.rows[0].n).toBe(0);
  });

  it('com o contexto de A, a consulta crua só vê A; sem contexto, não vê nada', async () => {
    const emA = await withCondominium(app, A, (c) => c.query('select condominium_id from unit'));
    expect(emA.rows.map((r) => r.condominium_id)).toEqual([A]);
    const semContexto = await app.query('select count(*)::int as n from unit');
    expect(semContexto.rows[0].n).toBe(0);
    const condominios = await withCondominium(app, A, (c) => c.query('select id from condominium'));
    expect(condominios.rows.map((r) => r.id)).toEqual([A]);
  });

  it('não grava linha de B estando no contexto de A', async () => {
    await expect(
      withCondominium(app, A, (c) =>
        c.query(`insert into unit (id, condominium_id, label) values ($1, $2, 'Casa 99')`, [uuidv7(), B]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('o papel de aplicação não consegue desligar a RLS', async () => {
    await expect(
      withCondominium(app, A, async (c) => {
        await c.query('set local row_security = off');
        return c.query('select * from unit');
      }),
    ).rejects.toThrow(/row-level security/);
  });

  it('o contexto não vaza para o próximo uso da mesma conexão do pool', async () => {
    await withCondominium(app, A, (c) => c.query('select 1'));
    const depois = await app.query(`select current_setting('app.condominium_id', true) as ctx`);
    expect(depois.rows[0].ctx ?? '').toBe('');
    const vazou = await app.query('select count(*)::int as n from unit');
    expect(vazou.rows[0].n).toBe(0);
  });

  it('chave composta: a vaga de A não liga à casa de B, nem pelo dono das tabelas', async () => {
    await expect(
      withCondominium(owner, A, (c) =>
        c.query(`insert into parking_space (id, condominium_id, number, unit_id) values ($1, $2, '01', $3)`, [
          uuidv7(),
          A,
          unitB,
        ]),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it('a função de interface estreita devolve só os condomínios da pessoa', async () => {
    const r = await app.query('select condominium_id from person_condominiums($1) order by 1', [person]);
    expect(r.rows.map((x) => x.condominium_id).sort()).toEqual([A, B].sort());
    // …mas ler os vínculos de B continua exigindo o contexto de B
    const vinculosEmA = await withCondominium(app, A, (c) => c.query('select condominium_id from ownership'));
    expect(vinculosEmA.rows.map((x) => x.condominium_id)).toEqual([A]);
  });

  it('auditoria é só acréscimo para a aplicação', async () => {
    await withCondominium(app, A, (c) =>
      c.query(
        `insert into audit_event (condominium_id, actor_kind, action, result) values ($1, 'system', 'teste', 'ok')`,
        [A],
      ),
    );
    await expect(
      withCondominium(app, A, (c) => c.query(`update audit_event set reason = 'x'`)),
    ).rejects.toThrow(/permission denied/);
    await expect(withCondominium(app, A, (c) => c.query(`delete from audit_event`))).rejects.toThrow(
      /permission denied/,
    );
  });
});
