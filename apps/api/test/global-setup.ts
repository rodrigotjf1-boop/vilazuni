import {randomBytes} from 'node:crypto';
import {Pool} from 'pg';
import type {TestProject} from 'vitest/node';
import {provision, roleUrl, dropDatabase} from '../src/db/provision.js';
import {migrate} from '../src/db/migrate.js';

/**
 * Banco NOVO e descartável por rodada de testes, no Postgres de verdade (nunca simulado).
 * Local: o cluster do projeto (node infra/dev/pg-local.mjs start). CI: o serviço postgres do workflow.
 */
declare module 'vitest' {
  export interface ProvidedContext {
    dbAppUrl: string;
    dbOwnerUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const adminUrl = process.env.VZ_TEST_ADMIN_URL || 'postgresql://postgres@127.0.0.1:55432/postgres';
  const database = `vz_test_${Date.now()}_${process.pid}`;
  const passwords = {owner: randomBytes(18).toString('hex'), app: randomBytes(18).toString('hex')};
  try {
    await provision(adminUrl, database, passwords);
  } catch (error) {
    throw new Error(
      `Sem Postgres para os testes (${error instanceof Error ? error.message : error}). ` +
        'Local: rode "node infra/dev/pg-local.mjs start". CI: VZ_TEST_ADMIN_URL.',
    );
  }
  const ownerUrl = roleUrl(adminUrl, database, 'vilazuni_owner', passwords.owner);
  const owner = new Pool({connectionString: ownerUrl, max: 1});
  try {
    await migrate(owner);
  } finally {
    await owner.end();
  }
  project.provide('dbOwnerUrl', ownerUrl);
  project.provide('dbAppUrl', roleUrl(adminUrl, database, 'vilazuni_app', passwords.app));
  return async () => {
    await dropDatabase(adminUrl, database);
  };
}
