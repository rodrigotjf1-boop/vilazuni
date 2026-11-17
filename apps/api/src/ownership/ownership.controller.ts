import {Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req} from '@nestjs/common';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import type {ActorContext} from '@vilazuni/domain';
import {ActorService} from '../authz/actor.service.js';
import type {AuthedRequest} from '../auth/auth.guard.js';
import {CLOCK, type Clock} from '../clock.js';
import {uuidv7} from '../db/tenant.js';
import {parse, pathId} from '../http/validate.js';
import {conflict, forbidden, notFound} from '../http/errors.js';
import {audit} from '../audit/audit.js';

const requestSchema = z
  .object({
    unitId: z.string().uuid(),
    shareNote: z.string().trim().max(200).optional(),
  })
  .strict();

const validateSchema = z
  .object({
    version: z.number().int().min(1),
    startsAt: z.coerce.date().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

const rejectSchema = z
  .object({
    version: z.number().int().min(1),
    note: z.string().trim().min(3).max(500),
  })
  .strict();

const statusSchema = z.enum(['pending', 'validated', 'rejected']).default('pending');

const view = (o: Record<string, unknown>) => ({
  id: o.id as string,
  status: o.status as string,
  version: o.version as number,
  unit: {id: o.unit_id as string, label: o.unit_label as string},
  person: {
    id: o.person_id as string,
    displayName: o.display_name as string,
    email: (o.email as string | null) ?? null,
  },
  shareNote: (o.share_note as string | null) ?? null,
  requestedAt: o.requested_at as Date,
  startsAt: (o.starts_at as Date | null) ?? null,
  decidedAt: (o.decided_at as Date | null) ?? null,
  decisionNote: (o.decision_note as string | null) ?? null,
});

/**
 * Titularidade (especificação §6): o proprietário pede, a gestão autorizada valida ou recusa. Nada de papel
 * administrativo no pedido (T01). Validação com versão (sem sobrescrita silenciosa) e repetição idempotente.
 */
@Controller('ownership-requests')
export class OwnershipController {
  constructor(
    @Inject(ActorService) private readonly actors: ActorService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Post()
  @HttpCode(201)
  async request(@Req() req: AuthedRequest, @Body() body: unknown) {
    const input = parse(requestSchema, body);
    return this.actors.run(req, 'ownership.request', async (client, actor) => {
      const unit = await client.query('select id from unit where id = $1', [input.unitId]);
      if (!unit.rowCount) throw notFound();
      const now = this.clock.now();
      const id = uuidv7(now.getTime());
      await client.query('savepoint pedido');
      try {
        await client.query(
          `insert into ownership (id, condominium_id, unit_id, person_id, share_note, status, requested_at)
           values ($1, $2, $3, $4, $5, 'pending', $6)`,
          [id, actor.condominiumId, input.unitId, actor.personId, input.shareNote ?? null, now],
        );
      } catch (error) {
        if ((error as {code?: string}).code !== '23505') throw error;
        throw conflict('vinculo_ja_existe', 'Você já tem esse vínculo pedido ou ativo.');
      }
      await audit(client, {
        condominiumId: actor.condominiumId,
        actorPersonId: actor.personId,
        action: 'ownership.request',
        objectType: 'ownership',
        objectId: id,
        correlationId: req.correlationId,
        detail: {unitId: input.unitId},
      });
      return {id, status: 'pending', version: 1};
    });
  }

  @Get()
  async list(@Req() req: AuthedRequest, @Query('status') status?: string) {
    const wanted = parse(statusSchema, status ?? 'pending');
    return this.actors.run(req, 'ownership.validate', async (client) => {
      const r = await client.query(
        `${OwnershipController.SELECT} where o.status = $1 order by o.requested_at`,
        [wanted],
      );
      return {requests: r.rows.map(view)};
    });
  }

  private static readonly SELECT = `
    select o.*, u.label as unit_label, p.display_name,
           (select v.value from verified_contact v where v.person_id = p.id and v.kind = 'email' and v.verified_at is not null
             order by v.created_at limit 1) as email
      from ownership o
      join unit u on u.condominium_id = o.condominium_id and u.id = o.unit_id
      join person p on p.id = o.person_id`;

  @Post(':id/validate')
  @HttpCode(200)
  async validate(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = parse(validateSchema, body);
    const ownershipId = pathId(id);
    return this.actors.run(req, 'ownership.validate', (client, actor) =>
      this.decideRequest(req, client, actor, ownershipId, input.version, 'validated', {
        startsAt: input.startsAt ?? this.clock.now(),
        note: input.note ?? null,
      }),
    );
  }

  @Post(':id/reject')
  @HttpCode(200)
  async reject(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = parse(rejectSchema, body);
    const ownershipId = pathId(id);
    return this.actors.run(req, 'ownership.validate', (client, actor) =>
      this.decideRequest(req, client, actor, ownershipId, input.version, 'rejected', {
        startsAt: null,
        note: input.note,
      }),
    );
  }

  private async decideRequest(
    req: AuthedRequest,
    client: PoolClient,
    actor: ActorContext,
    ownershipId: string,
    version: number,
    target: 'validated' | 'rejected',
    decision: {startsAt: Date | null; note: string | null},
  ) {
    const current = await client.query(`${OwnershipController.SELECT} where o.id = $1 for update of o`, [
      ownershipId,
    ]);
    const row = current.rows[0];
    if (!row) throw notFound();
    // Quem decide não decide o próprio pedido: sem isso, quem valida se daria a casa que quisesse.
    if (row.person_id === actor.personId)
      throw forbidden('nao_pode_decidir_o_proprio', 'Outra pessoa da gestão precisa decidir o seu pedido.');
    // Repetição da MESMA decisão (rede caiu e o app reenviou): devolve o estado atual, sem gravar de novo.
    if (row.status === target && row.decided_by === actor.personId && row.version === version + 1)
      return {request: view(row)};
    if (row.status !== 'pending') throw conflict('pedido_ja_decidido', 'Este pedido já foi decidido.');
    if (row.version !== version)
      throw conflict('versao_desatualizada', 'O pedido mudou. Recarregue antes de decidir.');
    const now = this.clock.now();
    const updated = await client.query(
      `update ownership set status = $2, starts_at = $3, decided_at = $4, decided_by = $5, decision_note = $6, version = version + 1
        where id = $1 and version = $7 and status = 'pending'
        returning id`,
      [ownershipId, target, decision.startsAt, now, actor.personId, decision.note, version],
    );
    if (!updated.rowCount)
      throw conflict('versao_desatualizada', 'O pedido mudou. Recarregue antes de decidir.');
    await audit(client, {
      condominiumId: actor.condominiumId,
      actorPersonId: actor.personId,
      action: target === 'validated' ? 'ownership.validate' : 'ownership.reject',
      objectType: 'ownership',
      objectId: ownershipId,
      correlationId: req.correlationId,
      detail: {unitId: row.unit_id, personId: row.person_id, startsAt: decision.startsAt},
    });
    const after = await client.query(`${OwnershipController.SELECT} where o.id = $1`, [ownershipId]);
    return {request: view(after.rows[0])};
  }
}
