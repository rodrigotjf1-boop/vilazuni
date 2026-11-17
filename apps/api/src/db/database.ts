import {Pool} from 'pg';
import type {AppConfig} from '../config.js';

export const DB_POOL = Symbol('DB_POOL');

/** Pool do papel de APLICAÇÃO (sem BYPASSRLS, não dono das tabelas — ADR-0004). Sem consulta no `connect`. */
export function createPool(config: AppConfig): Pool {
  return new Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'vilazuni-api',
  });
}

/** Prontidão: o banco responde a uma consulta trivial dentro do prazo. */
export async function databaseReady(pool: Pool, timeoutMs = 2_000): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const query = pool.query('select 1 as ok');
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    });
    const result = await Promise.race([query, timeout]);
    return result.rows[0]?.ok === 1;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
