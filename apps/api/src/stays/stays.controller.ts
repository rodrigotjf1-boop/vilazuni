import {Body, Controller, Get, Header, HttpCode, Inject, Param, Post, Query, Req} from '@nestjs/common';
import {
  activeOwnedUnits,
  decide,
  guestAppWindow,
  isWithin,
  assertValidPeriod,
  type Action,
  type ActorContext,
} from '@vilazuni/domain';
import type {Pool, PoolClient} from 'pg';
import {z} from 'zod';
import {audit} from '../audit/audit.js';
import {Public, type AuthedRequest} from '../auth/auth.guard.js';
import {newToken, sha256} from '../auth/crypto.js';
import {ActorService} from '../authz/actor.service.js';
import {CLOCK, type Clock} from '../clock.js';
import {DB_POOL} from '../db/database.js';
import {uuidv7, withCondominium} from '../db/tenant.js';
import {badRequest, conflict, forbidden, gone, notFound} from '../http/errors.js';
import {parse, pathId} from '../http/validate.js';
import {checkStayPeople, createStaySchema, editPeriodSchema, plateSchema, stayCounts} from './stay-input.js';

type Member = {name: string; band: 'adult' | 'teen' | 'child'; contact?: string};
type Stay = {
  id: string;
  unit_id: string;
  unit_label: string;
  check_in_at: Date;
  check_out_at: Date;
  members: Member[];
  plates: string[];
  exception_reason: string | null;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  decision_note: string | null;
  guest_token_hash: Buffer | null;
  version: number;
};
const selectStay = `select s.*, u.label as unit_label
  from stay s join unit u on u.condominium_id = s.condominium_id and u.id = s.unit_id`;
const versionSchema = z.object({version: z.number().int().positive()}).strict();
const transitionSchema = versionSchema.extend({
  action: z.enum(['confirm', 'reject', 'cancel']),
  note: z.string().trim().min(3).max(500).optional(),
});
const guestSchema = z.object({token: z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict();
const instant = z.iso.datetime({offset: true}).transform((value) => new Date(value));
const listSchema = z
  .object({
    scope: z.enum(['own', 'all']).optional(),
    from: instant.optional(),
    to: instant.optional(),
    id: z.uuid().optional(),
    view: z.enum(['context', 'arrivals', 'upcoming']).optional(),
  })
  .strict()
  .refine(({from, to}) => (!from && !to) || (from && to && from < to));

const view = (s: Stay) => ({
  id: s.id,
  unitId: s.unit_id,
  unitLabel: s.unit_label,
  checkInAt: s.check_in_at,
  checkOutAt: s.check_out_at,
  members: s.members,
  counts: stayCounts(s.members),
  plates: s.plates,
  exceptionReason: s.exception_reason,
  status: s.status,
  decisionNote: s.decision_note,
  hasGuestLink: s.guest_token_hash !== null,
  version: s.version,
});

@Controller('stays')
export class StaysController {
  constructor(
    @Inject(ActorService) private readonly actors: ActorService,
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const {scope, from, to, id, view: mode} = parse(listSchema, query);
    const actions: Action[] = scope ? [`stay.read.${scope}`] : ['stay.read.all', 'stay.read.own'];
    return this.actors.run(req, actions, async (client, actor) => {
      const owned = activeOwnedUnits(actor);
      const manage = decide(actor, 'stay.manage').allow;
      const all = scope !== 'own' && decide(actor, 'stay.read.all').allow;
      const units = await client.query<{id: string; label: string}>(
        "select id, label from unit where status = 'active' and ($1::boolean or id = any($2::uuid[])) order by label",
        [all, owned],
      );
      const condo = await client.query<{timezone: string}>('select timezone from condominium');
      const timezone = condo.rows[0]!.timezone;
      const stays =
        mode === 'context'
          ? []
          : (
              await client.query<Stay>(
                `${selectStay} where ($1::boolean or s.unit_id = any($2::uuid[]))
          and ($6::uuid is null or s.id = $6)
          and ($4::timestamptz is null or (
            s.status in ('pending', 'confirmed') and s.check_out_at >= $4 and s.check_in_at < $5
          ))
          and ($7::text is null or (
            s.status in ('pending', 'confirmed') and s.check_out_at > $3
            and ($7 = 'upcoming' or
              (s.check_in_at at time zone $8::text)::date = ($3::timestamptz at time zone $8::text)::date)
          ))
          order by case when s.check_out_at > $3 then 0 else 1 end,
            case when s.check_out_at > $3 then s.check_in_at end,
            s.check_in_at desc, s.id limit 101`,
                [all, owned, actor.now, from ?? null, to ?? null, id ?? null, mode ?? null, timezone],
              )
            ).rows;
      return {
        stays: stays.slice(0, 100).map(view),
        more: stays.length > 100,
        ownUnits: units.rows.filter((unit) => owned.includes(unit.id)),
        visibleUnits: units.rows,
        timezone,
        serverNow: actor.now,
        manage,
      };
    });
  }

  @Post()
  async create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const input = parse(createStaySchema, body);
    checkStayPeople(input);
    return this.actors.run(
      req,
      'stay.write.own',
      async (client, actor) => {
        const unit = await client.query("select id from unit where id = $1 and status = 'active'", [
          input.unitId,
        ]);
        if (!unit.rowCount) throw notFound();
        this.checkFuture(input.checkOutAt, actor.now);
        const id = uuidv7(actor.now.getTime());
        const result = await client.query<{id: string}>(
          `insert into stay (id, condominium_id, unit_id, created_by, request_id, check_in_at, check_out_at,
           members, plates, exception_reason, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)
         on conflict (condominium_id, created_by, request_id) do nothing returning id`,
          [
            id,
            actor.condominiumId,
            input.unitId,
            actor.personId,
            input.requestId,
            input.checkInAt,
            input.checkOutAt,
            JSON.stringify(input.members),
            input.plates,
            input.exceptionReason ?? null,
            actor.now,
          ],
        );
        if (result.rowCount) {
          await this.record(client, actor, req, 'stay.create', id);
          return {id};
        }
        const previous = await client.query<{id: string}>(
          'select id from stay where created_by = $1 and request_id = $2 and unit_id = $3',
          [actor.personId, input.requestId, input.unitId],
        );
        if (!previous.rows[0]) throw conflict('pedido_ja_enviado', 'Este envio já foi utilizado.');
        return {id: previous.rows[0].id};
      },
      {unitId: input.unitId},
      {denyAs: 'not_found'},
    );
  }

  @Post('plate')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async lookupPlate(@Req() req: AuthedRequest, @Body() body: unknown) {
    const {plate} = parse(z.object({plate: plateSchema}).strict(), body);
    return this.actors.run(req, ['stay.read.all', 'stay.read.own'], async (client, actor) => {
      const stays = await client.query<{unit_label: string; check_out_at: Date}>(
        `select u.label as unit_label, s.check_out_at
           from stay s join unit u on u.condominium_id = s.condominium_id and u.id = s.unit_id
          where s.status = 'confirmed' and u.status = 'active' and s.plates @> array[$1::text]
            and s.check_in_at <= $2 and $2 < s.check_out_at
            and ($3::boolean or s.unit_id = any($4::uuid[]))
          order by s.check_out_at limit 2`,
        [plate, actor.now, decide(actor, 'stay.read.all').allow, activeOwnedUnits(actor)],
      );
      if (stays.rows.length !== 1) return {status: stays.rows.length ? 'review' : 'none'};
      return {
        status: 'matched',
        unitLabel: stays.rows[0]!.unit_label,
        checkOutAt: stays.rows[0]!.check_out_at,
      };
    });
  }

  @Post(':id/period')
  @HttpCode(200)
  async editPeriod(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = parse(editPeriodSchema, body);
    assertValidPeriod(input);
    return this.change(req, id, input.version, async (client, actor, stay) => {
      if (!['pending', 'confirmed'].includes(stay.status))
        throw conflict('estadia_encerrada', 'Esta estadia está encerrada.');
      this.checkFuture(input.checkOutAt, actor.now);
      if (stay.check_out_at <= actor.now) throw conflict('estadia_encerrada', 'Esta estadia já terminou.');
      await client.query(
        `update stay set check_in_at = $2, check_out_at = $3, status = 'pending', decision_note = null,
          guest_token_hash = null, version = version + 1 where id = $1`,
        [stay.id, input.checkInAt, input.checkOutAt],
      );
      await this.record(client, actor, req, 'stay.reschedule', stay.id);
      return {status: 'pending'};
    });
  }

  @Post(':id/decision')
  @HttpCode(200)
  async transition(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = parse(transitionSchema, body);
    return this.change(req, id, input.version, async (client, actor, stay) => {
      if (input.action !== 'cancel' && !decide(actor, 'stay.manage').allow) throw forbidden();
      if (
        input.action !== 'cancel'
          ? stay.status !== 'pending'
          : !['pending', 'confirmed'].includes(stay.status)
      ) {
        throw conflict('estadia_encerrada', 'A situação atual da estadia não permite esta ação.');
      }
      if (input.action === 'reject' && !input.note)
        throw badRequest('motivo_obrigatorio', 'Informe o motivo da recusa.');
      if (input.action === 'confirm') {
        this.checkFuture(stay.check_out_at, actor.now);
        // Serializa confirmações para a mesma casa antes de procurar sobreposição.
        const unit = await client.query(
          "select id from unit where id = $1 and status = 'active' for update",
          [stay.unit_id],
        );
        if (!unit.rowCount) throw notFound();
        const overlapping = await client.query(
          `select id from stay where unit_id = $1 and status = 'confirmed'
            and check_in_at < $3 and check_out_at > $2 limit 1`,
          [stay.unit_id, stay.check_in_at, stay.check_out_at],
        );
        if (overlapping.rowCount)
          throw conflict('estadia_sobreposta', 'A casa já tem uma estadia confirmada neste horário.');
      }
      const status = {confirm: 'confirmed', reject: 'rejected', cancel: 'cancelled'}[input.action];
      await client.query(
        'update stay set status = $2, decision_note = $3, guest_token_hash = null, version = version + 1 where id = $1',
        [stay.id, status, input.note ?? null],
      );
      await this.record(client, actor, req, `stay.${input.action}`, stay.id);
      return {status};
    });
  }

  @Post(':id/guest-link')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  async guestLink(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    const {version} = parse(versionSchema, body);
    return this.change(req, id, version, async (client, actor, stay) => {
      if (stay.status !== 'confirmed')
        throw conflict('estadia_nao_confirmada', 'Confirme a estadia antes de gerar o link.');
      const window = guestAppWindow({checkInAt: stay.check_in_at, checkOutAt: stay.check_out_at});
      if (actor.now >= window.endsAt)
        throw gone('link_estadia_encerrado', 'O acesso desta estadia já terminou.');
      const token = newToken();
      await client.query('update stay set guest_token_hash = $2, version = version + 1 where id = $1', [
        stay.id,
        sha256(token),
      ]);
      await this.record(client, actor, req, 'stay.guest_link', stay.id);
      return {token};
    });
  }

  @Public()
  @Post('guest')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async guest(@Body() body: unknown) {
    const {token} = parse(guestSchema, body);
    const hash = sha256(token);
    const match = await this.pool.query<{id: string; condominium_id: string}>(
      'select * from stay_by_guest_token($1)',
      [hash],
    );
    const link = match.rows[0];
    if (!link) throw notFound();
    return withCondominium(this.pool, link.condominium_id, async (client) => {
      const {rows} = await client.query<{
        unit_label: string;
        check_in_at: Date;
        check_out_at: Date;
        condominium: string;
        timezone: string;
      }>(
        `select u.label as unit_label, s.check_in_at, s.check_out_at, c.name as condominium, c.timezone
           from stay s join unit u on u.condominium_id = s.condominium_id and u.id = s.unit_id
           join condominium c on c.id = s.condominium_id
          where s.id = $1 and s.guest_token_hash = $2 and s.status = 'confirmed' and u.status = 'active'`,
        [link.id, hash],
      );
      const stay = rows[0];
      if (!stay) throw notFound();
      const window = guestAppWindow({checkInAt: stay.check_in_at, checkOutAt: stay.check_out_at});
      if (!isWithin(window, this.clock.now()))
        throw gone('link_estadia_fora_horario', 'O link está fora do período de consulta.');
      return {
        condominium: stay.condominium,
        timezone: stay.timezone,
        unitLabel: stay.unit_label,
        checkInAt: stay.check_in_at,
        checkOutAt: stay.check_out_at,
        availableUntil: window.endsAt,
      };
    });
  }

  private checkFuture(checkOutAt: Date, now: Date) {
    if (checkOutAt <= now)
      throw badRequest('estadia_no_passado', 'A saída precisa ser posterior ao horário atual.');
  }

  private async change<T>(
    req: AuthedRequest,
    id: string,
    version: number,
    run: (client: PoolClient, actor: ActorContext, stay: Stay) => Promise<T>,
  ) {
    const stayId = pathId(id);
    return this.actors.run(req, ['stay.manage', 'stay.read.own'], async (client, actor) => {
      const current = await client.query<Stay>(`${selectStay} where s.id = $1 for update of s`, [stayId]);
      const stay = current.rows[0];
      if (
        !stay ||
        !(decide(actor, 'stay.manage').allow || decide(actor, 'stay.write.own', {unitId: stay.unit_id}).allow)
      )
        throw notFound();
      if (stay.version !== version)
        throw conflict('versao_desatualizada', 'A estadia mudou. Atualize antes de continuar.');
      return run(client, actor, stay);
    });
  }

  private async record(
    client: PoolClient,
    actor: ActorContext,
    req: AuthedRequest,
    action: string,
    id: string,
  ) {
    await audit(client, {
      condominiumId: actor.condominiumId,
      actorPersonId: actor.personId,
      action,
      objectType: 'stay',
      objectId: id,
      correlationId: req.correlationId,
    });
  }
}
