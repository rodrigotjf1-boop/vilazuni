import {Pool} from 'pg';
import {migrate} from '../db/migrate.js';

/**
 * Aplica as migrations como o papel DONO (`DATABASE_OWNER_URL`). A aplicação nunca roda com esse papel:
 * ela usa `DATABASE_URL` (papel sem BYPASSRLS) — ADR-0004.
 */
async function main() {
  const url = process.env.DATABASE_OWNER_URL;
  if (!url) throw new Error('Defina DATABASE_OWNER_URL (papel dono das tabelas).');
  const pool = new Pool({connectionString: url, max: 1});
  try {
    const applied = await migrate(pool);
    console.log(applied.length ? `Aplicadas: ${applied.join(', ')}` : 'Banco já está na última migration.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha ao aplicar as migrations.');
  process.exit(1);
});
