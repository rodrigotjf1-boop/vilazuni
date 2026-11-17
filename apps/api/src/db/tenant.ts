import {randomBytes} from 'node:crypto';
import type {Pool, PoolClient} from 'pg';

/**
 * Transação com o condomínio no contexto da RLS (ADR-0004). `set_config(..., true)` é LOCAL à transação:
 * some no commit/rollback, então a conexão devolvida ao pool não carrega o condomínio para o próximo pedido.
 * O id SEMPRE vem do vínculo conferido no servidor — nunca direto do cliente.
 */
export async function withCondominium<T>(
  pool: Pool,
  condominiumId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("select set_config('app.condominium_id', $1, true)", [condominiumId]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Transação SEM condomínio — só para as tabelas globais de identidade (pessoa, contato, credencial, sessão). */
export async function withoutCondominium<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** UUID v7 (ordenado pelo tempo, RFC 9562): 48 bits de milissegundos + aleatório. */
export function uuidv7(now: number = Date.now()): string {
  const b = randomBytes(16);
  b.writeUIntBE(now, 0, 6);
  b[6] = (b[6]! & 0x0f) | 0x70;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
