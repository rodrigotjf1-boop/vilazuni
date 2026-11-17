import {randomBytes} from 'node:crypto';
import {Pool} from 'pg';
import {provision, roleUrl} from '../db/provision.js';
import {migrate} from '../db/migrate.js';

/**
 * Prepara o banco LOCAL de desenvolvimento (`vilazuni_dev`) no cluster do projeto (`node infra/dev/pg-local.mjs
 * start`): papéis, banco e migrations. Só aceita conexão administrativa na própria máquina — nunca um servidor.
 * Imprime as duas URLs para o `.env` local (o cluster local aceita conexão local sem senha).
 */
async function main() {
  const adminUrl = process.env.VZ_DEV_ADMIN_URL || 'postgresql://postgres@127.0.0.1:55432/postgres';
  const host = new URL(adminUrl).hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(host))
    throw new Error('dev:db só prepara banco na própria máquina (127.0.0.1).');
  const database = 'vilazuni_dev';
  const passwords = {owner: randomBytes(18).toString('hex'), app: randomBytes(18).toString('hex')};
  await provision(adminUrl, database, passwords);
  const ownerUrl = roleUrl(adminUrl, database, 'vilazuni_owner', passwords.owner);
  const owner = new Pool({connectionString: ownerUrl, max: 1});
  try {
    const applied = await migrate(owner);
    console.log(
      applied.length ? `Migrations aplicadas: ${applied.join(', ')}` : 'Banco já na última migration.',
    );
  } finally {
    await owner.end();
  }
  const local = (role: string) => {
    const u = new URL(roleUrl(adminUrl, database, role, 'x'));
    u.password = '';
    return u.toString();
  };
  console.log(`DATABASE_OWNER_URL=${local('vilazuni_owner')}`);
  console.log(`DATABASE_URL=${local('vilazuni_app')}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha ao preparar o banco local.');
  process.exit(1);
});
