import {createHash} from 'node:crypto';
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import type {Pool} from 'pg';

/**
 * Aplica as migrations SQL (apps/api/migrations/NNNN_nome.sql) em ordem, uma transação por arquivo, como o
 * papel DONO (vilazuni_owner). Registra nome + SHA-256 do conteúdo (fim de linha LF); arquivo já aplicado com
 * conteúdo diferente PARA tudo — migration aplicada não se edita, cria-se a próxima.
 */
export const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'migrations');

export async function migrate(ownerPool: Pool, dir = MIGRATIONS_DIR): Promise<string[]> {
  await ownerPool.query(`create table if not exists schema_migration (
    name text primary key, checksum text not null, applied_at timestamptz not null default now())`);
  const files = readdirSync(dir)
    .filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))
    .sort();
  const applied: string[] = [];
  for (const file of files) {
    const sql = readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const done = await ownerPool.query<{checksum: string}>('select checksum from schema_migration where name = $1', [file]);
    if (done.rows[0]) {
      if (done.rows[0].checksum !== checksum)
        throw new Error(`A migration ${file} já aplicada foi alterada. Crie uma nova migration.`);
      continue;
    }
    const client = await ownerPool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migration (name, checksum) values ($1, $2)', [file, checksum]);
      await client.query('commit');
      applied.push(file);
    } catch (error) {
      await client.query('rollback');
      throw new Error(`Falha na migration ${file}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }
  return applied;
}
