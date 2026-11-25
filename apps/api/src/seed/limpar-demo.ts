import type {Pool} from 'pg';

/**
 * Limpeza da base de TESTE (decisão do dono, ADR-0011 §2): "para testes criamos fictícios, e depois limpamos a base".
 *
 * Apaga só o que é de demonstração:
 * - todo condomínio com `environment = 'demo'` e tudo o que pertence a ele (casas, vagas, vínculos, papéis, mandatos,
 *   delegações, convites, links e códigos de cadastro, fila de saída e a caixa da demonstração, auditoria);
 * - as pessoas fictícias (`is_demo`) e as contas criadas NOS condomínios de demonstração (cadastro pelo link, convite)
 *   que não têm nada em condomínio que não seja de demonstração.
 *
 * Nunca toca em condomínio de sandbox ou produção nem em quem tem qualquer registro neles (essa pessoa é mantida e
 * contada). Recusa rodar com VILAZUNI_ENV=production. Sem `apply`, faz tudo numa transação e DESFAZ no fim: as
 * contagens são exatamente o que seria apagado. Com `apply`, confirma e deixa um registro na auditoria geral.
 */
export interface CleanupReport {
  applied: boolean;
  condominiums: {id: string; name: string}[];
  /** linhas apagadas (ou que seriam apagadas) por tabela */
  deleted: Record<string, number>;
  /** pessoas de teste mantidas por terem registro em condomínio que não é de demonstração */
  keptPeople: number;
}

/** Pessoa com qualquer registro num condomínio que NÃO é de demonstração (nunca se apaga). */
const TIES_OUTSIDE = `
  exists (select 1 from ownership o join condominium c on c.id = o.condominium_id
           where c.environment <> 'demo' and (o.person_id = p.id or o.decided_by = p.id))
  or exists (select 1 from residency r join condominium c on c.id = r.condominium_id
              where c.environment <> 'demo' and (r.person_id = p.id or r.created_by = p.id))
  or exists (select 1 from role_assignment a join condominium c on c.id = a.condominium_id
              where c.environment <> 'demo' and (a.person_id = p.id or a.granted_by = p.id))
  or exists (select 1 from delegation d join condominium c on c.id = d.condominium_id
              where c.environment <> 'demo' and d.granted_by = p.id)
  or exists (select 1 from invitation i join condominium c on c.id = i.condominium_id
              where c.environment <> 'demo' and (i.created_by = p.id or i.used_by = p.id))
  or exists (select 1 from signup_link s join condominium c on c.id = s.condominium_id
              where c.environment <> 'demo' and (s.created_by = p.id or s.revoked_by = p.id))
  or exists (select 1 from stay s join condominium c on c.id = s.condominium_id
              where c.environment <> 'demo' and s.created_by = p.id)
  or exists (select 1 from audit_event e join condominium c on c.id = e.condominium_id
              where c.environment <> 'demo' and e.actor_person_id = p.id)`;

/** Pessoa que nasceu ou agiu num condomínio de demonstração. */
const TIES_DEMO = `
  exists (select 1 from ownership o where o.condominium_id in (select id from limpeza_condominio) and o.person_id = p.id)
  or exists (select 1 from residency r where r.condominium_id in (select id from limpeza_condominio) and r.person_id = p.id)
  or exists (select 1 from role_assignment a where a.condominium_id in (select id from limpeza_condominio) and a.person_id = p.id)
  or exists (select 1 from invitation i where i.condominium_id in (select id from limpeza_condominio) and i.used_by = p.id)`;

export async function cleanDemoData(
  pool: Pool,
  options: {env: string; apply: boolean},
): Promise<CleanupReport> {
  if (options.env === 'production')
    throw new Error('A limpeza da base de teste não roda com VILAZUNI_ENV=production.');
  const client = await pool.connect();
  try {
    await client.query('begin');
    // nenhum condomínio nasce nem muda de ambiente no meio da limpeza (rode com a API parada ou sem uso)
    await client.query(`lock table condominium in share row exclusive mode`);
    await client.query(
      `create temp table limpeza_condominio on commit drop as
         select id, name from condominium where environment = 'demo'`,
    );
    await client.query(
      `create temp table limpeza_pessoa on commit drop as
         select p.id from person p where (p.is_demo or ${TIES_DEMO}) and not (${TIES_OUTSIDE})`,
    );
    const kept = await client.query(
      `select count(*)::int as n from person p where (p.is_demo or ${TIES_DEMO}) and (${TIES_OUTSIDE})`,
    );
    const deleted: Record<string, number> = {};
    const del = async (table: string, sql: string) => {
      const r = await client.query(sql);
      deleted[table] = (deleted[table] ?? 0) + (r.rowCount ?? 0);
    };
    const inCondo = `condominium_id in (select id from limpeza_condominio)`;
    const inPeople = `person_id in (select id from limpeza_pessoa)`;

    await del(
      'demo_mailbox',
      `delete from demo_mailbox where outbox_id in (select id from outbox_event where ${inCondo})`,
    );
    await del('outbox_event', `delete from outbox_event where ${inCondo}`);
    await del('email_verification', `delete from email_verification where ${inCondo}`);
    await del('signup_link', `delete from signup_link where ${inCondo}`);
    await del(
      'audit_event',
      `delete from audit_event where ${inCondo}
          or (condominium_id is null and actor_person_id in (select id from limpeza_pessoa))`,
    );
    for (const table of ['delegation', 'mandate', 'role_assignment', 'invitation', 'residency', 'ownership'])
      await del(table, `delete from ${table} where ${inCondo}`);
    await del('parking_space', `delete from parking_space where ${inCondo}`);
    await del('stay', `delete from stay where ${inCondo}`);
    await del('unit', `delete from unit where ${inCondo}`);
    await del('condominium', `delete from condominium where id in (select id from limpeza_condominio)`);

    await del(
      'auth_refresh_retired',
      `delete from auth_refresh_retired where refresh_family in
         (select refresh_family from auth_session where ${inPeople} and refresh_family is not null)`,
    );
    for (const table of ['auth_session', 'auth_recovery_code', 'auth_credential', 'verified_contact'])
      await del(table, `delete from ${table} where ${inPeople}`);
    await del('person', `delete from person where id in (select id from limpeza_pessoa)`);

    const condominiums = (await client.query(`select id, name from limpeza_condominio order by name`)).rows;
    if (options.apply) {
      // a limpeza fica registrada na auditoria geral (sem condomínio): quando, o quê e quanto
      await client.query(
        `insert into audit_event (condominium_id, actor_person_id, actor_kind, action, result, detail)
         values (null, null, 'system', 'demo.cleanup', 'ok', $1)`,
        [
          JSON.stringify({
            condominiums: condominiums.map((c) => c.name),
            deleted,
            keptPeople: kept.rows[0].n,
          }),
        ],
      );
      await client.query('commit');
    } else {
      await client.query('rollback');
    }
    return {applied: options.apply, condominiums, deleted, keptPeople: kept.rows[0].n};
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Texto do relatório para o terminal. */
export function describeCleanup(r: CleanupReport): string {
  const linhas = [
    r.applied ? 'Limpeza da base de teste FEITA.' : 'Prévia da limpeza (nada foi apagado):',
    `Condomínios de demonstração: ${r.condominiums.length ? r.condominiums.map((c) => c.name).join(', ') : 'nenhum'}`,
    ...Object.entries(r.deleted)
      .filter(([, n]) => n > 0)
      .map(([table, n]) => `  ${table}: ${n}`),
  ];
  if (r.keptPeople)
    linhas.push(
      `Mantidas ${r.keptPeople} pessoa(s) de teste com registro em condomínio que não é de demonstração.`,
    );
  if (!r.applied) linhas.push('Para apagar de verdade: npm run limpar:demo -w @vilazuni/api -- --apagar');
  return linhas.join('\n');
}
