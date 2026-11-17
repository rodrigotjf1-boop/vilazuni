import 'reflect-metadata';
import {randomBytes} from 'node:crypto';
import {inject} from 'vitest';
import {Pool} from 'pg';
import type {INestApplication} from '@nestjs/common';
import {createApp} from '../../src/bootstrap.js';
import {loadConfig} from '../../src/config.js';
import {withCondominium, uuidv7} from '../../src/db/tenant.js';
import {hashPassword} from '../../src/auth/crypto.js';
import type {Clock} from '../../src/clock.js';

/**
 * Apoio dos testes da API: a aplicação de verdade (guarda, filtro, RLS) contra o Postgres do teste, com o
 * relógio do servidor controlado. Todo dado criado aqui é DEMONSTRATIVO e marcado como tal.
 */
export const ORIGIN = 'https://app.exemplo.test';
export const PASSWORD = 'Senha-demo-forte-2026';
export const T0 = Date.UTC(2026, 10, 17, 12, 0, 0);
export const DAY = 24 * 60 * 60 * 1000;
export const MIN = 60 * 1000;

/** Sufixo por rodada: e-mails e nomes não colidem entre arquivos que dividem o banco. */
export const RUN = randomBytes(4).toString('hex');
export const emailOf = (who: string) => `${who}.${RUN}@demo.vilazuni.test`.toLowerCase();

export class FakeClock implements Clock {
  constructor(public t: number = T0) {}
  now() {
    return new Date(this.t);
  }
  advance(ms: number) {
    this.t += ms;
  }
}

export interface Api {
  app: INestApplication;
  url: string;
  close: () => Promise<void>;
}

export async function startApi(clock: Clock): Promise<Api> {
  const config = loadConfig({
    DATABASE_URL: inject('dbAppUrl'),
    ALLOWED_ORIGINS: ORIGIN,
    COOKIE_SECURE: 'false',
  });
  const pool = new Pool({connectionString: inject('dbAppUrl'), max: 4});
  const app = await createApp(config, {pool, clock}, {quiet: true});
  await app.listen(0, '127.0.0.1');
  const url = (await app.getUrl()).replace('[::1]', '127.0.0.1') + '/api/v1';
  return {app, url, close: () => app.close()};
}

export interface Reply {
  status: number;
  body: any;
  headers: Headers;
}

async function reply(r: Response): Promise<Reply> {
  const text = await r.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* corpo não-JSON fica como texto */
  }
  return {status: r.status, body, headers: r.headers};
}

export interface CallOptions {
  condominium?: string;
  /** null = sem cabeçalho Origin */
  origin?: string | null;
  /** null = sem token CSRF (só web) */
  csrf?: string | null;
  headers?: Record<string, string>;
}

/** Navegador: cookie de sessão + token CSRF guardado em memória (como a tela fará). */
export class WebClient {
  cookie?: string;
  csrf?: string;
  constructor(readonly base: string) {}

  async login(email: string, password = PASSWORD): Promise<Reply> {
    const r = await fetch(this.base + '/auth/login', {
      method: 'POST',
      headers: {'content-type': 'application/json', origin: ORIGIN},
      body: JSON.stringify({email, password}),
    });
    const setCookie = r.headers.getSetCookie().find((c) => c.startsWith('vz_sess='));
    if (setCookie) this.cookie = setCookie.split(';')[0];
    const out = await reply(r);
    if (out.status === 200) this.csrf = out.body.csrfToken;
    return out;
  }

  async call(method: string, path: string, body?: unknown, o: CallOptions = {}): Promise<Reply> {
    const headers: Record<string, string> = {...o.headers};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (this.cookie) headers.cookie = this.cookie;
    const origin = o.origin === undefined ? ORIGIN : o.origin;
    if (origin) headers.origin = origin;
    const csrf = o.csrf === undefined ? this.csrf : o.csrf;
    if (csrf && method !== 'GET') headers['x-csrf-token'] = csrf;
    if (o.condominium) headers['x-condominium-id'] = o.condominium;
    return reply(
      await fetch(this.base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  }
  get = (path: string, o?: CallOptions) => this.call('GET', path, undefined, o);
  post = (path: string, body?: unknown, o?: CallOptions) => this.call('POST', path, body ?? {}, o);
}

/** App nativo: bearer curto + refresh, sem cookie. */
export class NativeClient {
  access?: string;
  refreshToken?: string;
  constructor(readonly base: string) {}

  async login(email: string, password = PASSWORD): Promise<Reply> {
    const r = await reply(
      await fetch(this.base + '/auth/login', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({email, password, transport: 'native'}),
      }),
    );
    if (r.status === 200) {
      this.access = r.body.accessToken;
      this.refreshToken = r.body.refreshToken;
    }
    return r;
  }

  async refresh(token = this.refreshToken): Promise<Reply> {
    const r = await reply(
      await fetch(this.base + '/auth/refresh', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({refreshToken: token}),
      }),
    );
    if (r.status === 200) {
      this.access = r.body.accessToken;
      this.refreshToken = r.body.refreshToken;
    }
    return r;
  }

  async get(path: string, access = this.access, condominium?: string): Promise<Reply> {
    const headers: Record<string, string> = {authorization: `Bearer ${access}`};
    if (condominium) headers['x-condominium-id'] = condominium;
    return reply(await fetch(this.base + path, {headers}));
  }
}

// ---------------- Semeadura demonstrativa (pelo dono das tabelas) ----------------

let passwordHash: Promise<string> | undefined;
const demoHash = () => (passwordHash ??= hashPassword(PASSWORD));

export interface SeededCondominium {
  id: string;
  units: {id: string; label: string; parking: string}[];
}

export async function seedCondominium(owner: Pool, name: string, units: number): Promise<SeededCondominium> {
  const id = uuidv7();
  const list = Array.from({length: units}, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return {id: uuidv7(), label: `Casa ${n}`, parking: n};
  });
  await withCondominium(owner, id, async (c) => {
    await c.query(
      `insert into condominium (id, name, city, state, environment) values ($1, $2, 'Cidade Demo', 'RJ', 'demo')`,
      [id, `[DEMO] ${name} ${RUN}`],
    );
    for (const u of list) {
      await c.query(`insert into unit (id, condominium_id, label, bedrooms) values ($1, $2, $3, 2)`, [
        u.id,
        id,
        u.label,
      ]);
      await c.query(
        `insert into parking_space (id, condominium_id, number, unit_id) values ($1, $2, $3, $4)`,
        [uuidv7(), id, u.parking, u.id],
      );
    }
  });
  return {id, units: list};
}

/** Pessoa fictícia com e-mail verificado e senha de demonstração. */
export async function seedPerson(owner: Pool, who: string): Promise<string> {
  const id = uuidv7();
  await owner.query(`insert into person (id, display_name, is_demo) values ($1, $2, true)`, [
    id,
    `[DEMO] ${who}`,
  ]);
  await owner.query(
    `insert into verified_contact (id, person_id, kind, value, verified_at) values ($1, $2, 'email', $3, now())`,
    [uuidv7(), id, emailOf(who)],
  );
  await owner.query(
    `insert into auth_credential (id, person_id, kind, secret, confirmed_at) values ($1, $2, 'password', $3, now())`,
    [uuidv7(), id, await demoHash()],
  );
  return id;
}

export async function seedOwnership(
  owner: Pool,
  condominiumId: string,
  unitId: string,
  personId: string,
  startsAt = T0 - 365 * DAY,
) {
  await withCondominium(owner, condominiumId, (c) =>
    c.query(
      `insert into ownership (id, condominium_id, unit_id, person_id, status, starts_at, decided_at, decided_by)
       values ($1, $2, $3, $4, 'validated', $5, $5, $4)`,
      [uuidv7(), condominiumId, unitId, personId, new Date(startsAt)],
    ),
  );
}

export async function seedResidency(owner: Pool, condominiumId: string, unitId: string, personId: string) {
  await withCondominium(owner, condominiumId, (c) =>
    c.query(
      `insert into residency (id, condominium_id, unit_id, person_id, status, starts_at) values ($1, $2, $3, $4, 'active', $5)`,
      [uuidv7(), condominiumId, unitId, personId, new Date(T0 - 30 * DAY)],
    ),
  );
}

export async function seedRole(
  owner: Pool,
  condominiumId: string,
  personId: string,
  role: string,
  extra: {
    scopes?: string[];
    mandate?: {startsAt: number; endsAt: number};
    delegation?: {actions: string[]; startsAt: number; endsAt: number; grantedBy: string};
  } = {},
): Promise<string> {
  const id = uuidv7();
  await withCondominium(owner, condominiumId, async (c) => {
    await c.query(
      `insert into role_assignment (id, condominium_id, person_id, role, scopes, starts_at) values ($1, $2, $3, $4, $5, $6)`,
      [id, condominiumId, personId, role, extra.scopes ?? [], new Date(T0 - 60 * DAY)],
    );
    if (extra.mandate)
      await c.query(
        `insert into mandate (id, condominium_id, role_assignment_id, starts_at, ends_at, minutes_reference)
         values ($1, $2, $3, $4, $5, '[DEMO] Ata de eleição')`,
        [uuidv7(), condominiumId, id, new Date(extra.mandate.startsAt), new Date(extra.mandate.endsAt)],
      );
    if (extra.delegation)
      await c.query(
        `insert into delegation (id, condominium_id, role_assignment_id, actions, starts_at, ends_at, document_reference, granted_by)
         values ($1, $2, $3, $4, $5, $6, '[DEMO] Ata de delegação', $7)`,
        [
          uuidv7(),
          condominiumId,
          id,
          extra.delegation.actions,
          new Date(extra.delegation.startsAt),
          new Date(extra.delegation.endsAt),
          extra.delegation.grantedBy,
        ],
      );
  });
  return id;
}
