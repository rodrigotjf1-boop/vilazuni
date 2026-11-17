import {Inject, Injectable} from '@nestjs/common';
import type {Pool, PoolClient} from 'pg';
import {decide, MFA_RECENT_MS, type Action, type ActorContext, type Decision} from '@vilazuni/domain';
import {DB_POOL} from '../db/database.js';
import {CLOCK, type Clock} from '../clock.js';
import {withCondominium} from '../db/tenant.js';
import {badRequest, forbidden, notFound} from '../http/errors.js';
import type {AuthedRequest} from '../auth/auth.guard.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MandateLink = {status: 'active' | 'ended'; startsAt: Date; endsAt: Date};

/** O mandato que vale AGORA; sem nenhum vigente, o último que venceu (para dizer "mandato vencido"). */
export function currentMandate(list: MandateLink[], now: Date): MandateLink | null {
  const t = now.getTime();
  const vigente = list.find((m) => m.startsAt.getTime() <= t && t < m.endsAt.getTime());
  if (vigente) return vigente;
  const vencidos = list
    .filter((m) => m.endsAt.getTime() <= t)
    .sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime());
  return vencidos[0] ?? list[0] ?? null;
}

/**
 * Monta o contexto do ator NA HORA, a partir do banco: vínculos, papéis, mandatos e delegações vigentes.
 * O condomínio ativo vem do cabeçalho `x-condominium-id`, mas só vale se a pessoa tiver vínculo nele
 * (conferido pela função de interface estreita) — o cliente nunca impõe o condomínio (ADR-0004).
 */
@Injectable()
export class ActorService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async condominiumsOf(personId: string): Promise<string[]> {
    const r = await this.pool.query<{condominium_id: string}>(
      'select condominium_id from person_condominiums($1)',
      [personId],
    );
    return r.rows.map((x) => x.condominium_id);
  }

  async activeCondominium(req: AuthedRequest): Promise<string> {
    const personId = req.session!.personId;
    const mine = await this.condominiumsOf(personId);
    const asked = req.headers['x-condominium-id'];
    if (typeof asked === 'string' && asked) {
      if (!UUID.test(asked) || !mine.includes(asked)) throw notFound();
      return asked;
    }
    if (mine.length === 1) return mine[0]!;
    if (mine.length === 0)
      throw forbidden('sem_vinculo', 'Sua conta ainda não tem vínculo com um condomínio.');
    throw badRequest('escolha_o_condominio', 'Escolha o condomínio.');
  }

  async load(
    client: PoolClient,
    personId: string,
    condominiumId: string,
    mfaAt: Date | null,
  ): Promise<ActorContext> {
    const now = this.clock.now();
    const mfaSatisfied = mfaAt !== null;
    const mfaRecent = mfaAt !== null && now.getTime() - mfaAt.getTime() <= MFA_RECENT_MS;
    // Uma consulta por vez no MESMO cliente (a transação é uma conexão só): consultas simultâneas no mesmo
    // cliente são aviso no pg 8 e erro no pg 9 (LIC-004, ERR-023 do registro interno).
    const own = await client.query(
      `select unit_id, status, starts_at, ends_at from ownership where person_id = $1`,
      [personId],
    );
    const res = await client.query(
      `select unit_id, status, starts_at, ends_at from residency where person_id = $1`,
      [personId],
    );
    const roles = await client.query(
      `select id, role, status, scopes, starts_at, ends_at from role_assignment where person_id = $1`,
      [personId],
    );
    const mandates = await client.query(
      `select m.role_assignment_id, m.status, m.starts_at, m.ends_at from mandate m
         join role_assignment a on a.condominium_id = m.condominium_id and a.id = m.role_assignment_id
        where a.person_id = $1`,
      [personId],
    );
    const delegations = await client.query(
      `select d.role_assignment_id, d.status, d.actions, d.starts_at, d.ends_at from delegation d
         join role_assignment a on a.condominium_id = d.condominium_id and a.id = d.role_assignment_id
        where a.person_id = $1`,
      [personId],
    );
    return {
      personId,
      condominiumId,
      now,
      mfaSatisfied,
      mfaRecent,
      ownerships: own.rows.map((o) => ({
        unitId: o.unit_id,
        status: o.status,
        startsAt: o.starts_at,
        endsAt: o.ends_at,
      })),
      residencies: res.rows.map((o) => ({
        unitId: o.unit_id,
        status: o.status,
        startsAt: o.starts_at,
        endsAt: o.ends_at,
      })),
      roles: roles.rows.map((r) => ({
        role: r.role,
        status: r.status,
        scopes: r.scopes,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        mandate: currentMandate(
          mandates.rows
            .filter((m) => m.role_assignment_id === r.id && m.status === 'active')
            .map((m) => ({status: m.status, startsAt: m.starts_at, endsAt: m.ends_at})),
          now,
        ),
        delegations: delegations.rows
          .filter((d) => d.role_assignment_id === r.id)
          .map((d) => ({status: d.status, actions: d.actions, startsAt: d.starts_at, endsAt: d.ends_at})),
      })),
    };
  }

  /**
   * Abre a transação do condomínio ativo, carrega o ator, DECIDE a ação e só então roda `fn`.
   * Várias ações = basta uma permitir (ex.: ler a casa por ser dela OU por gerir todas).
   * `denyAs: 'not_found'` responde 404 igual ao de "não existe" quando o 403 revelaria que a casa existe (T54).
   */
  async run<T>(
    req: AuthedRequest,
    action: Action | Action[],
    fn: (client: PoolClient, actor: ActorContext) => Promise<T>,
    resource: {unitId?: string} = {},
    options: {denyAs?: 'forbidden' | 'not_found'} = {},
  ): Promise<T> {
    const actions = Array.isArray(action) ? action : [action];
    const condominiumId = await this.activeCondominium(req);
    let denied: Decision | undefined;
    try {
      return await withCondominium(this.pool, condominiumId, async (client) => {
        const actor = await this.load(client, req.session!.personId, condominiumId, req.session!.mfaAt);
        const decisions = actions.map((a) => decide(actor, a, resource));
        if (!decisions.some((d) => d.allow)) {
          denied = decisions.find((d) => d.reason.startsWith('mfa_')) ?? decisions[0]!;
          if (denied.reason === 'mfa_exigido')
            throw forbidden('mfa_exigido', 'Esta ação pede a verificação em duas etapas.');
          if (denied.reason === 'mfa_recente_exigido')
            throw forbidden('mfa_recente_exigido', 'Confirme o código do aplicativo autenticador de novo.');
          throw options.denyAs === 'not_found' ? notFound() : forbidden();
        }
        return fn(client, actor);
      });
    } catch (error) {
      // A transação do pedido foi desfeita; a NEGAÇÃO fica registrada numa transação própria.
      if (denied)
        await withCondominium(this.pool, condominiumId, (c) =>
          c.query(
            `insert into audit_event (condominium_id, actor_person_id, actor_kind, action, object_type, object_id, result, reason, correlation_id)
             values ($1, $2, 'person', $3, $4, $5, 'denied', $6, $7)`,
            [
              condominiumId,
              req.session!.personId,
              actions.join('|'),
              resource.unitId ? 'unit' : null,
              resource.unitId ?? null,
              denied!.reason,
              req.correlationId ?? null,
            ],
          ),
        ).catch(() => undefined);
      throw error;
    }
  }

  /**
   * Transação do condomínio ativo SEM decidir ação — só para ler os PRÓPRIOS vínculos da pessoa (filtrados por
   * `person_id` na consulta). Quem ainda está pendente precisa ver que está pendente.
   */
  async ownData<T>(
    req: AuthedRequest,
    fn: (client: PoolClient, condominiumId: string) => Promise<T>,
  ): Promise<T> {
    const condominiumId = await this.activeCondominium(req);
    return withCondominium(this.pool, condominiumId, (client) => fn(client, condominiumId));
  }
}
