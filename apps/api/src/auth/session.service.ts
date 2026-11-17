import {Inject, Injectable} from '@nestjs/common';
import type {Pool, PoolClient} from 'pg';
import {DB_POOL} from '../db/database.js';
import {CLOCK, type Clock} from '../clock.js';
import {uuidv7} from '../db/tenant.js';
import {newToken, sha256} from './crypto.js';

/**
 * Sessões (ADR-0003). Web: cookie opaco + token CSRF. Nativo: access de 15 min + refresh rotativo de 30 dias;
 * refresh já trocado que reaparece = cópia → a família inteira é revogada.
 * Nada de permissão dentro do token: vínculos são relidos a cada pedido.
 */
export const WEB_SESSION_MS = 12 * 60 * 60 * 1000;
export const NATIVE_ACCESS_MS = 15 * 60 * 1000;
export const NATIVE_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

export interface Session {
  id: string;
  personId: string;
  transport: 'web' | 'native';
  mfaAt: Date | null;
  csrfHash: Buffer | null;
  expiresAt: Date;
}

const toSession = (r: Record<string, unknown>): Session => ({
  id: r.id as string,
  personId: r.person_id as string,
  transport: r.transport as 'web' | 'native',
  mfaAt: (r.mfa_at as Date | null) ?? null,
  csrfHash: (r.csrf_hash as Buffer | null) ?? null,
  expiresAt: r.expires_at as Date,
});

@Injectable()
export class SessionService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async createWeb(personId: string, userAgent: string | undefined, db: Pool | PoolClient = this.pool) {
    const sessionToken = newToken();
    const csrfToken = newToken();
    const now = this.clock.now();
    const id = uuidv7(now.getTime());
    await db.query(
      `insert into auth_session (id, person_id, transport, token_hash, csrf_hash, user_agent, created_at, last_used_at, expires_at)
       values ($1, $2, 'web', $3, $4, $5, $6, $6, $7)`,
      [
        id,
        personId,
        sha256(sessionToken),
        sha256(csrfToken),
        userAgent?.slice(0, 300) ?? null,
        now,
        new Date(now.getTime() + WEB_SESSION_MS),
      ],
    );
    return {id, sessionToken, csrfToken};
  }

  async createNative(personId: string, userAgent: string | undefined, db: Pool | PoolClient = this.pool) {
    const accessToken = newToken();
    const refreshToken = newToken();
    const now = this.clock.now();
    const id = uuidv7(now.getTime());
    const accessExpiresAt = new Date(now.getTime() + NATIVE_ACCESS_MS);
    await db.query(
      `insert into auth_session (id, person_id, transport, token_hash, refresh_hash, refresh_family, access_expires_at, user_agent,
                                 created_at, last_used_at, expires_at)
       values ($1, $2, 'native', $3, $4, $5, $6, $7, $8, $8, $9)`,
      [
        id,
        personId,
        sha256(accessToken),
        sha256(refreshToken),
        uuidv7(now.getTime()),
        accessExpiresAt,
        userAgent?.slice(0, 300) ?? null,
        now,
        new Date(now.getTime() + NATIVE_REFRESH_MS),
      ],
    );
    return {id, accessToken, refreshToken, accessExpiresAt};
  }

  /** Sessão válida AGORA (relógio do servidor), não revogada; nativo também confere o access curto. */
  async authenticate(token: string, transport: 'web' | 'native'): Promise<Session | null> {
    const now = this.clock.now();
    const r = await this.pool.query(
      `update auth_session set last_used_at = $3
        where token_hash = $1 and transport = $2 and revoked_at is null and expires_at > $3
          and (transport = 'web' or access_expires_at > $3)
        returning *`,
      [sha256(token), transport, now],
    );
    return r.rows[0] ? toSession(r.rows[0]) : null;
  }

  /** Troca o refresh (uso único). Reuso de refresh antigo revoga a família inteira. */
  async refresh(refreshToken: string) {
    const presented = sha256(refreshToken);
    const now = this.clock.now();
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const current = await client.query(
        `select * from auth_session where refresh_hash = $1 and transport = 'native' for update`,
        [presented],
      );
      const row = current.rows[0];
      if (!row) {
        const retired = await client.query(
          `select refresh_family from auth_refresh_retired where refresh_hash = $1`,
          [presented],
        );
        if (retired.rows[0]) {
          await client.query(
            `update auth_session set revoked_at = $2, revoked_reason = 'reuso_de_refresh'
              where refresh_family = $1 and revoked_at is null`,
            [retired.rows[0].refresh_family, now],
          );
          await client.query('commit');
          return {status: 'reuso' as const};
        }
        await client.query('rollback');
        return {status: 'invalido' as const};
      }
      if (row.revoked_at || (row.expires_at as Date).getTime() <= now.getTime()) {
        await client.query('rollback');
        return {status: 'invalido' as const};
      }
      const accessToken = newToken();
      const nextRefresh = newToken();
      const accessExpiresAt = new Date(now.getTime() + NATIVE_ACCESS_MS);
      await client.query(`insert into auth_refresh_retired (refresh_hash, refresh_family) values ($1, $2)`, [
        presented,
        row.refresh_family,
      ]);
      await client.query(
        `update auth_session set token_hash = $2, refresh_hash = $3, access_expires_at = $4, last_used_at = $5 where id = $1`,
        [row.id, sha256(accessToken), sha256(nextRefresh), accessExpiresAt, now],
      );
      await client.query('commit');
      return {status: 'ok' as const, accessToken, refreshToken: nextRefresh, accessExpiresAt};
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async revoke(sessionId: string, personId: string, reason: string): Promise<boolean> {
    const r = await this.pool.query(
      `update auth_session set revoked_at = $3, revoked_reason = $4 where id = $1 and person_id = $2 and revoked_at is null`,
      [sessionId, personId, this.clock.now(), reason],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async revokeAll(personId: string, reason: string): Promise<number> {
    const r = await this.pool.query(
      `update auth_session set revoked_at = $2, revoked_reason = $3 where person_id = $1 and revoked_at is null`,
      [personId, this.clock.now(), reason],
    );
    return r.rowCount ?? 0;
  }

  async list(personId: string) {
    const r = await this.pool.query(
      `select id, transport, user_agent, created_at, last_used_at, expires_at from auth_session
        where person_id = $1 and revoked_at is null and expires_at > $2 order by last_used_at desc`,
      [personId, this.clock.now()],
    );
    return r.rows.map((s) => ({
      id: s.id as string,
      transport: s.transport as string,
      device: (s.user_agent as string | null) ?? null,
      createdAt: s.created_at as Date,
      lastUsedAt: s.last_used_at as Date,
      expiresAt: s.expires_at as Date,
    }));
  }
}
