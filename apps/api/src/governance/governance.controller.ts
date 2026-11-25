import {Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req} from '@nestjs/common';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {canReceiveDelegation, DELEGABLE_ACTIONS, type Action, type ActorContext} from '@vilazuni/domain';
import {ActorService} from '../authz/actor.service.js';
import type {AuthedRequest} from '../auth/auth.guard.js';
import {CLOCK, type Clock} from '../clock.js';
import {uuidv7} from '../db/tenant.js';
import {parse, pathId} from '../http/validate.js';
import {badRequest, conflict, forbidden, notFound} from '../http/errors.js';
import {audit} from '../audit/audit.js';

export const ASSIGNABLE_ROLES = [
  'syndic',
  'subsyndic',
  'fiscal_council',
  'administrator',
  'service_provider',
  'security_reviewer',
] as const;
export const ADMINISTRATOR_SCOPE_NAMES = ['cadastro', 'financeiro', 'assembleias'] as const;

const reason = z.string().trim().min(3).max(500);
const reference = z.string().trim().min(3).max(200);

const mandateFields = z.object({
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  minutesReference: reference,
});

const roleSchema = z
  .object({
    personId: z.string().uuid(),
    role: z.enum(ASSIGNABLE_ROLES),
    scopes: z.array(z.enum(ADMINISTRATOR_SCOPE_NAMES)).max(3).default([]),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    reason,
    mandate: mandateFields.strict().optional(),
  })
  .strict();

const endSchema = z.object({reason, endsAt: z.coerce.date().optional()}).strict();

const mandateSchema = mandateFields.extend({roleAssignmentId: z.string().uuid()}).strict();

const delegationSchema = z
  .object({
    roleAssignmentId: z.string().uuid(),
    actions: z.array(z.string()).min(1).max(20),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date(),
    documentReference: reference,
  })
  .strict();

const auditQuery = z
  .object({
    before: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    action: z.string().max(80).optional(),
    result: z.enum(['ok', 'denied', 'error']).optional(),
  })
  .strict();

/**
 * Gestão › Pessoas e papéis (especificação §6). Papel, mandato e delegação são atos CRÍTICOS (segundo fator
 * recente). Ninguém concede papel ou delegação a si mesmo — senão o poder sobreviveria ao fim do mandato.
 */
@Controller()
export class GovernanceController {
  constructor(
    @Inject(ActorService) private readonly actors: ActorService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // ---------------- leitura ----------------

  @Get('people')
  async people(@Req() req: AuthedRequest) {
    return this.actors.run(req, 'person.read.all', async (client) => {
      const r = await client.query(
        `with ligados as (
           select person_id from ownership where status in ('pending','validated')
           union select person_id from residency where status in ('pending','active')
           union select person_id from role_assignment where status = 'active'
         )
         select p.id, p.display_name, p.is_demo,
                (select v.value from verified_contact v where v.person_id = p.id and v.kind = 'email'
                  order by v.created_at limit 1) as email,
                coalesce((select json_agg(json_build_object('id', o.id, 'unitId', o.unit_id, 'unitLabel', u.label,
                                                            'status', o.status, 'startsAt', o.starts_at) order by u.label)
                            from ownership o join unit u on u.condominium_id = o.condominium_id and u.id = o.unit_id
                           where o.person_id = p.id and o.status in ('pending','validated')), '[]') as ownerships,
                coalesce((select json_agg(json_build_object('id', a.id, 'role', a.role, 'scopes', a.scopes,
                                                            'startsAt', a.starts_at, 'endsAt', a.ends_at))
                            from role_assignment a where a.person_id = p.id and a.status = 'active'), '[]') as roles
           from ligados l join person p on p.id = l.person_id
          order by p.display_name`,
      );
      return {
        people: r.rows.map((p) => ({
          id: p.id,
          displayName: p.display_name,
          demo: p.is_demo,
          email: p.email,
          ownerships: p.ownerships,
          roles: p.roles,
        })),
      };
    });
  }

  @Get('roles')
  async roles(@Req() req: AuthedRequest) {
    return this.actors.run(req, 'person.read.all', async (client) => {
      const r = await client.query(
        `select a.*, p.display_name,
                coalesce((select json_agg(json_build_object('id', m.id, 'status', m.status, 'startsAt', m.starts_at,
                                                            'endsAt', m.ends_at, 'minutesReference', m.minutes_reference)
                                          order by m.starts_at)
                            from mandate m where m.role_assignment_id = a.id), '[]') as mandates,
                coalesce((select json_agg(json_build_object('id', d.id, 'status', d.status, 'actions', d.actions,
                                                            'startsAt', d.starts_at, 'endsAt', d.ends_at,
                                                            'documentReference', d.document_reference)
                                          order by d.starts_at)
                            from delegation d where d.role_assignment_id = a.id), '[]') as delegations
           from role_assignment a join person p on p.id = a.person_id
          order by a.status, a.role, p.display_name`,
      );
      return {
        roles: r.rows.map((a) => ({
          id: a.id,
          person: {id: a.person_id, displayName: a.display_name},
          role: a.role,
          scopes: a.scopes,
          status: a.status,
          startsAt: a.starts_at,
          endsAt: a.ends_at,
          reason: a.reason,
          mandates: a.mandates,
          delegations: a.delegations,
        })),
      };
    });
  }

  @Get('audit-events')
  async auditEvents(@Req() req: AuthedRequest, @Query() query: Record<string, string>) {
    const q = parse(auditQuery, query);
    return this.actors.run(req, 'audit.read', async (client) => {
      const r = await client.query(
        `select e.*, p.display_name from audit_event e left join person p on p.id = e.actor_person_id
          where ($1::bigint is null or e.id < $1) and ($2::text is null or e.action = $2) and ($3::text is null or e.result = $3)
          order by e.id desc limit $4`,
        [q.before ?? null, q.action ?? null, q.result ?? null, q.limit],
      );
      const events = r.rows.map((e) => ({
        id: Number(e.id),
        at: e.at,
        actor: e.actor_person_id ? {id: e.actor_person_id, displayName: e.display_name} : null,
        actorKind: e.actor_kind,
        action: e.action,
        objectType: e.object_type,
        objectId: e.object_id,
        result: e.result,
        reason: e.reason,
        correlationId: e.correlation_id,
        detail: e.detail,
      }));
      return {events, nextBefore: events.length === q.limit ? events.at(-1)!.id : null};
    });
  }

  // ---------------- papéis ----------------

  private async assertLinked(client: PoolClient, personId: string, condominiumId: string) {
    const r = await client.query(`select 1 from person_condominiums($1) where condominium_id = $2`, [
      personId,
      condominiumId,
    ]);
    // pessoa sem vínculo aqui = "não encontrada" (não revela quem existe em outro condomínio)
    if (!r.rowCount) throw notFound();
  }

  /** Dois mandatos de síndico não se sobrepõem no mesmo condomínio. */
  private async assertNoMandateOverlap(
    client: PoolClient,
    condominiumId: string,
    startsAt: Date,
    endsAt: Date,
  ) {
    await client.query(`select pg_advisory_xact_lock(hashtext('vz-mandato:' || $1))`, [condominiumId]);
    const r = await client.query(
      `select 1 from mandate m join role_assignment a on a.condominium_id = m.condominium_id and a.id = m.role_assignment_id
        where a.role = 'syndic' and m.status = 'active' and a.status = 'active'
          and m.starts_at < $2 and $1 < m.ends_at limit 1`,
      [startsAt, endsAt],
    );
    if (r.rowCount) throw conflict('mandato_sobreposto', 'Já existe mandato de síndico nesse período.');
  }

  @Post('roles')
  @HttpCode(201)
  async assignRole(@Req() req: AuthedRequest, @Body() body: unknown) {
    const input = parse(roleSchema, body);
    return this.actors.run(req, 'role.assign', async (client, actor) => {
      const now = this.clock.now();
      const startsAt = input.startsAt ?? now;
      if (input.endsAt && input.endsAt.getTime() <= startsAt.getTime())
        throw badRequest('periodo_invalido', 'O fim precisa ser depois do início.');
      if (input.role !== 'administrator' && input.scopes.length)
        throw badRequest('escopo_so_da_administradora', 'Escopos valem só para a administradora.');
      if (input.role === 'syndic' && !input.mandate)
        throw badRequest('mandato_obrigatorio', 'Síndico precisa do mandato (início, fim e ata).');
      if (input.role !== 'syndic' && input.mandate)
        throw badRequest('mandato_so_do_sindico', 'Mandato vale só para o síndico.');
      if (input.mandate && input.mandate.endsAt.getTime() <= input.mandate.startsAt.getTime())
        throw badRequest('periodo_invalido', 'O fim do mandato precisa ser depois do início.');
      await this.assertLinked(client, input.personId, actor.condominiumId);
      if (input.personId === actor.personId)
        throw forbidden('nao_pode_conceder_a_si', 'Outra pessoa da gestão precisa conceder o seu papel.');
      const dup = await client.query(
        `select 1 from role_assignment where person_id = $1 and role = $2 and status = 'active'
            and (ends_at is null or ends_at > $3) limit 1`,
        [input.personId, input.role, now],
      );
      if (dup.rowCount) throw conflict('papel_ja_ativo', 'Esta pessoa já tem esse papel.');
      if (input.mandate)
        await this.assertNoMandateOverlap(
          client,
          actor.condominiumId,
          input.mandate.startsAt,
          input.mandate.endsAt,
        );

      const id = uuidv7(now.getTime());
      await client.query(
        `insert into role_assignment (id, condominium_id, person_id, role, scopes, starts_at, ends_at, granted_by, reason, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          id,
          actor.condominiumId,
          input.personId,
          input.role,
          input.scopes,
          startsAt,
          input.endsAt ?? null,
          actor.personId,
          input.reason,
          now,
        ],
      );
      let mandateId: string | null = null;
      if (input.mandate) {
        mandateId = uuidv7(now.getTime());
        await client.query(
          `insert into mandate (id, condominium_id, role_assignment_id, starts_at, ends_at, minutes_reference, created_at)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [
            mandateId,
            actor.condominiumId,
            id,
            input.mandate.startsAt,
            input.mandate.endsAt,
            input.mandate.minutesReference,
            now,
          ],
        );
      }
      await audit(client, {
        condominiumId: actor.condominiumId,
        actorPersonId: actor.personId,
        action: 'role.assign',
        objectType: 'role_assignment',
        objectId: id,
        correlationId: req.correlationId,
        detail: {personId: input.personId, role: input.role, scopes: input.scopes, mandateId},
      });
      return {id, mandateId};
    });
  }

  @Post('roles/:id/end')
  @HttpCode(200)
  async endRole(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = parse(endSchema, body);
    const roleId = pathId(id);
    return this.actors.run(req, 'role.assign', async (client, actor) => {
      const r = await client.query(`select * from role_assignment where id = $1 for update`, [roleId]);
      const role = r.rows[0];
      if (!role) throw notFound();
      if (role.status !== 'active') throw conflict('papel_ja_encerrado', 'Este papel já foi encerrado.');
      const now = this.clock.now();
      const endsAt = input.endsAt ?? now;
      if (endsAt.getTime() <= (role.starts_at as Date).getTime())
        throw badRequest('periodo_invalido', 'O fim precisa ser depois do início.');
      const endedNow = endsAt.getTime() <= now.getTime();
      await client.query(
        `update role_assignment set ends_at = $2, status = $3, version = version + 1 where id = $1`,
        [roleId, endsAt, endedNow ? 'ended' : 'active'],
      );
      // o que dependia do papel acaba junto (o que começaria depois do fim nem começa)
      for (const table of ['mandate', 'delegation'] as const) {
        await client.query(
          `update ${table} set status = 'ended' where role_assignment_id = $1 and status = 'active' and starts_at >= $2`,
          [roleId, endsAt],
        );
        await client.query(
          `update ${table} set ends_at = least(ends_at, $2), status = case when $3 then 'ended' else status end
            where role_assignment_id = $1 and status = 'active'`,
          [roleId, endsAt, endedNow],
        );
      }
      await audit(client, {
        condominiumId: actor.condominiumId,
        actorPersonId: actor.personId,
        action: 'role.end',
        objectType: 'role_assignment',
        objectId: roleId,
        correlationId: req.correlationId,
        detail: {personId: role.person_id, role: role.role, endsAt, reason: input.reason},
      });
      return {id: roleId, status: endedNow ? 'ended' : 'active', endsAt};
    });
  }

  // ---------------- mandatos ----------------

  @Post('mandates')
  @HttpCode(201)
  async addMandate(@Req() req: AuthedRequest, @Body() body: unknown) {
    const input = parse(mandateSchema, body);
    if (input.endsAt.getTime() <= input.startsAt.getTime())
      throw badRequest('periodo_invalido', 'O fim do mandato precisa ser depois do início.');
    return this.actors.run(req, 'mandate.manage', async (client, actor) => {
      const r = await client.query(`select * from role_assignment where id = $1 for update`, [
        input.roleAssignmentId,
      ]);
      const role = r.rows[0];
      if (!role) throw notFound();
      if (role.role !== 'syndic' || role.status !== 'active')
        throw badRequest('papel_nao_e_sindico', 'Mandato vale só para papel de síndico ativo.');
      await this.assertNoMandateOverlap(client, actor.condominiumId, input.startsAt, input.endsAt);
      const now = this.clock.now();
      const id = uuidv7(now.getTime());
      await client.query(
        `insert into mandate (id, condominium_id, role_assignment_id, starts_at, ends_at, minutes_reference, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [id, actor.condominiumId, role.id, input.startsAt, input.endsAt, input.minutesReference, now],
      );
      await audit(client, {
        condominiumId: actor.condominiumId,
        actorPersonId: actor.personId,
        action: 'mandate.add',
        objectType: 'mandate',
        objectId: id,
        correlationId: req.correlationId,
        // renovação do próprio mandato é permitida (pela ata) e fica marcada para o conselho ver
        detail: {
          roleAssignmentId: role.id,
          own: role.person_id === actor.personId,
          minutesReference: input.minutesReference,
        },
      });
      return {id};
    });
  }

  @Post('mandates/:id/end')
  @HttpCode(200)
  async endMandate(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = parse(endSchema.pick({reason: true}).strict(), body);
    const mandateId = pathId(id);
    return this.actors.run(req, 'mandate.manage', async (client, actor) => {
      const r = await client.query(`select * from mandate where id = $1 for update`, [mandateId]);
      const m = r.rows[0];
      if (!m) throw notFound();
      if (m.status !== 'active') throw conflict('mandato_ja_encerrado', 'Este mandato já foi encerrado.');
      const now = this.clock.now();
      const started = (m.starts_at as Date).getTime() < now.getTime();
      await client.query(
        `update mandate set status = 'ended', ends_at = case when $2 then least(ends_at, $3) else ends_at end, version = version + 1
          where id = $1`,
        [mandateId, started, now],
      );
      await audit(client, {
        condominiumId: actor.condominiumId,
        actorPersonId: actor.personId,
        action: 'mandate.end',
        objectType: 'mandate',
        objectId: mandateId,
        correlationId: req.correlationId,
        detail: {reason: input.reason},
      });
      return {id: mandateId, status: 'ended'};
    });
  }

  // ---------------- delegações ----------------

  /** A delegação não passa do fim do mandato de quem delega (o poder delegado não sobrevive ao delegante). */
  private grantorLimit(actor: ActorContext): Date | null {
    const ends = actor.roles
      .filter((r) => r.role === 'syndic' && r.status === 'active' && r.mandate)
      .map((r) => r.mandate!.endsAt)
      .filter((d): d is Date => d !== null);
    return ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;
  }

  @Post('delegations')
  @HttpCode(201)
  async delegate(@Req() req: AuthedRequest, @Body() body: unknown) {
    const input = parse(delegationSchema, body);
    const bad = input.actions.filter((a) => !DELEGABLE_ACTIONS.has(a as never));
    if (bad.length) throw badRequest('acao_nao_delegavel', `Ação que não se delega: ${bad.join(', ')}.`);
    return this.actors.run(req, 'delegation.manage', async (client, actor) => {
      const now = this.clock.now();
      const startsAt = input.startsAt ?? now;
      if (input.endsAt.getTime() <= startsAt.getTime())
        throw badRequest('periodo_invalido', 'O fim precisa ser depois do início.');
      const limit = this.grantorLimit(actor);
      if (limit && input.endsAt.getTime() > limit.getTime())
        throw badRequest('delegacao_alem_do_mandato', 'A delegação não pode passar do fim do seu mandato.');
      const r = await client.query(`select * from role_assignment where id = $1 for update`, [
        input.roleAssignmentId,
      ]);
      const role = r.rows[0];
      if (!role) throw notFound();
      if (role.status !== 'active') throw conflict('papel_ja_encerrado', 'Este papel já foi encerrado.');
      if (role.role === 'syndic') throw badRequest('delegacao_para_sindico', 'Síndico não recebe delegação.');
      if (input.actions.some((a) => !canReceiveDelegation(role.role, a as Action)))
        throw badRequest('acao_nao_delegavel', 'Este papel não pode receber uma das ações selecionadas.');
      if (role.person_id === actor.personId)
        throw forbidden('nao_pode_conceder_a_si', 'Outra pessoa da gestão precisa conceder a sua delegação.');
      const id = uuidv7(now.getTime());
      const actions = [...new Set(input.actions)];
      await client.query(
        `insert into delegation (id, condominium_id, role_assignment_id, actions, starts_at, ends_at, document_reference, granted_by, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          actor.condominiumId,
          role.id,
          actions,
          startsAt,
          input.endsAt,
          input.documentReference,
          actor.personId,
          now,
        ],
      );
      await audit(client, {
        condominiumId: actor.condominiumId,
        actorPersonId: actor.personId,
        action: 'delegation.grant',
        objectType: 'delegation',
        objectId: id,
        correlationId: req.correlationId,
        detail: {roleAssignmentId: role.id, personId: role.person_id, actions, endsAt: input.endsAt},
      });
      return {id};
    });
  }

  @Post('delegations/:id/end')
  @HttpCode(200)
  async endDelegation(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = parse(endSchema.pick({reason: true}).strict(), body);
    const delegationId = pathId(id);
    return this.actors.run(req, 'delegation.manage', async (client, actor) => {
      const r = await client.query(`select * from delegation where id = $1 for update`, [delegationId]);
      const d = r.rows[0];
      if (!d) throw notFound();
      if (d.status !== 'active') throw conflict('delegacao_ja_encerrada', 'Esta delegação já foi encerrada.');
      const now = this.clock.now();
      const started = (d.starts_at as Date).getTime() < now.getTime();
      await client.query(
        `update delegation set status = 'ended', ends_at = case when $2 then least(ends_at, $3) else ends_at end, version = version + 1
          where id = $1`,
        [delegationId, started, now],
      );
      await audit(client, {
        condominiumId: actor.condominiumId,
        actorPersonId: actor.personId,
        action: 'delegation.end',
        objectType: 'delegation',
        objectId: delegationId,
        correlationId: req.correlationId,
        detail: {reason: input.reason},
      });
      return {id: delegationId, status: 'ended'};
    });
  }
}
