import {Pool} from 'pg';

/**
 * Prepara um banco do Vilazuni a partir de uma conexão ADMINISTRATIVA (só desenvolvimento, testes e a primeira
 * instalação): cria/atualiza os papéis e o banco, e entrega o schema ao dono.
 *
 * - vilazuni_owner: dono das tabelas; roda as migrations.
 * - vilazuni_app: papel da API; NOSUPERUSER, NOBYPASSRLS, não dono de nada (ADR-0004).
 */
const NAME = /^[a-z_][a-z0-9_]{0,62}$/;

export interface Passwords {
  owner: string;
  app: string;
}

async function upsertRole(admin: Pool, role: string, password: string, bypassRls: boolean): Promise<void> {
  const exists = await admin.query('select 1 from pg_roles where rolname = $1', [role]);
  const verb = exists.rowCount ? 'alter' : 'create';
  const bypass = bypassRls ? 'bypassrls' : 'nobypassrls';
  const stmt = await admin.query<{sql: string}>(
    `select format('${verb} role %I with login nosuperuser nocreatedb nocreaterole noreplication ${bypass} password %L', $1::text, $2::text) as sql`,
    [role, password],
  );
  await admin.query(stmt.rows[0]!.sql);
}

export async function provision(adminUrl: string, database: string, passwords: Passwords): Promise<void> {
  if (!NAME.test(database)) throw new Error('Nome de banco inválido.');
  const admin = new Pool({connectionString: adminUrl, max: 1});
  try {
    // Dono: migrations e as funções de interface estreita (SECURITY DEFINER) — por ser dono ele já poderia
    // desligar a RLS; BYPASSRLS não aumenta o risco. A APLICAÇÃO nunca tem BYPASSRLS (ADR-0004).
    await upsertRole(admin, 'vilazuni_owner', passwords.owner, true);
    await upsertRole(admin, 'vilazuni_app', passwords.app, false);
  } finally {
    await admin.end();
  }
  await createDatabase(adminUrl, database);
}

/**
 * Só o banco (os papéis já existem): cria, entrega ao dono e libera a conexão do papel da aplicação. Não mexe nas
 * senhas dos papéis — um teste pode montar um banco à parte sem derrubar as conexões dos outros.
 */
export async function createDatabase(adminUrl: string, database: string): Promise<void> {
  if (!NAME.test(database)) throw new Error('Nome de banco inválido.');
  const admin = new Pool({connectionString: adminUrl, max: 1});
  try {
    const exists = await admin.query('select 1 from pg_database where datname = $1', [database]);
    if (!exists.rowCount) await admin.query(`create database ${database} owner vilazuni_owner`);
  } finally {
    await admin.end();
  }
  const url = new URL(adminUrl);
  url.pathname = '/' + database;
  const inDb = new Pool({connectionString: url.toString(), max: 1});
  try {
    await inDb.query('revoke all on schema public from public');
    await inDb.query('alter schema public owner to vilazuni_owner');
    await inDb.query('revoke all on database ' + database + ' from public');
    await inDb.query('grant connect on database ' + database + ' to vilazuni_app');
  } finally {
    await inDb.end();
  }
}

/** Monta a URL de um papel a partir da URL administrativa (mesmo host/porta, outro banco e usuário). */
export function roleUrl(adminUrl: string, database: string, role: string, password: string): string {
  const url = new URL(adminUrl);
  url.username = role;
  url.password = password;
  url.pathname = '/' + database;
  return url.toString();
}

export async function dropDatabase(adminUrl: string, database: string): Promise<void> {
  if (!NAME.test(database)) throw new Error('Nome de banco inválido.');
  const admin = new Pool({connectionString: adminUrl, max: 1});
  try {
    await admin.query(`drop database if exists ${database} with (force)`);
  } finally {
    await admin.end();
  }
}
