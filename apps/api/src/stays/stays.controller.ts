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
import {guestBulletin} from '../bulletin/bulletin-store.js';
import {Public, type AuthedRequest} from '../auth/auth.guard.js';
import {newToken, sha256} from '../auth/crypto.js';
import {ActorService} from '../authz/actor.service.js';
import {CLOCK, type Clock} from '../clock.js';
import {VAULT, Vault} from '../crypto/vault.js';
import {DB_POOL} from '../db/database.js';
import {uuidv7, withCondominium} from '../db/tenant.js';
import {badRequest, conflict, gone, notFound} from '../http/errors.js';
import {parse, pathId} from '../http/validate.js';
import {checkStayPeople, createStaySchema, editPeriodSchema, plateSchema, stayCounts} from './stay-input.js';

type Member = {name: string; band: 'adult' | 'teen' | 'child'; contact?: string};
type Stay = {
  id: string;
  unit_id: string;
  unit_label: string;
  registered_by: string;
  arrival_instructions: string | null;
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
const selectStay = `select s.*, u.label as unit_label, p.display_name as registered_by
  from stay s join unit u on u.condominium_id = s.condominium_id and u.id = s.unit_id
  join person p on p.id = s.created_by`;
const instructionsContext = (stayId: string) => `stay-arrival:${stayId}`;
const versionSchema = z.object({version: z.number().int().positive()}).strict();
const cancelSchema = versionSchema.extend({
  action: z.literal('cancel'),
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
    view: z.enum(['context', 'arrivals', 'upcoming', 'day']).optional(),
  })
  .strict()
  .refine(({from, to}) => (!from && !to) || (from && to && from < to));

const view = (s: Stay) => ({
  id: s.id,
  unitId: s.unit_id,
  unitLabel: s.unit_label,
  registeredBy: s.registered_by,
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
    @Inject(VAULT) private readonly vault: Vault,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const {scope, from, to, id, view: mode} = parse(listSchema, query);
    const actions: Action[] = scope ? [`stay.read.${scope}`] : ['stay.read.all', 'stay.read.own'];
    return this.actors.run(req, actions, async (client, actor) => {
      const owned = activeOwnedUnits(actor);
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
            s.status in ('pending', 'confirmed') and case $7
              when 'upcoming' then s.check_out_at > $3
              when 'arrivals' then s.check_out_at > $3
                and (s.check_in_at at time zone $8::text)::date = ($3::timestamptz at time zone $8::text)::date
              when 'day' then ($3::timestamptz at time zone $8::text)::date in (
                (s.check_in_at at time zone $8::text)::date, (s.check_out_at at time zone $8::text)::date
              )
              else false
            end
          ))
          order by case when s.check_out_at > $3 then 0 else 1 end,
            case when s.check_out_at > $3 then s.check_in_at end,
            s.check_in_at desc, s.id limit 101`,
                [all, owned, actor.now, from ?? null, to ?? null, id ?? null, mode ?? null, timezone],
              )
            ).rows;
      return {
        stays: stays.slice(0, 100).map((stay) => ({
          ...view(stay),
          ...(id && owned.includes(stay.unit_id) && stay.arrival_instructions
            ? {arrivalInstructions: this.vault.open(stay.arrival_instructions, instructionsContext(stay.id))}
            : {}),
        })),
        more: stays.length > 100,
        ownUnits: units.rows.filter((unit) => owned.includes(unit.id)),
        visibleUnits: units.rows,
        timezone,
        serverNow: actor.now,
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
        const instructions = input.arrivalInstructions
          ? this.vault.seal(input.arrivalInstructions, instructionsContext(id))
          : null;
        const result = await client.query<{id: string}>(
          `insert into stay (id, condominium_id, unit_id, created_by, request_id, check_in_at, check_out_at,
           members, plates, exception_reason, created_at, status, arrival_instructions)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,'confirmed',$12)
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
            instructions,
          ],
        );
        if (result.rowCount) {
          await this.record(client, actor, req, 'stay.create', id);
          return {id};
        }
        const repeated = await client.query<{id: string}>(
          'select id from stay where created_by = $1 and request_id = $2 and unit_id = $3',
          [actor.personId, input.requestId, input.unitId],
        );
        if (!repeated.rows[0]) throw conflict('pedido_ja_enviado', 'Este envio já foi utilizado.');
        return {id: repeated.rows[0].id};
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
      const changedDates =
        input.checkInAt.getTime() !== stay.check_in_at.getTime() ||
        input.checkOutAt.getTime() !== stay.check_out_at.getTime();
      const instructions =
        input.arrivalInstructions === undefined
          ? stay.arrival_instructions
          : input.arrivalInstructions
            ? this.vault.seal(input.arrivalInstructions, instructionsContext(stay.id))
            : null;
      await client.query(
        `update stay set check_in_at = $2, check_out_at = $3, status = 'confirmed', decision_note = null,
          arrival_instructions = $4,
          guest_token_hash = case when $5 then null else guest_token_hash end,
          version = version + 1 where id = $1`,
        [stay.id, input.checkInAt, input.checkOutAt, instructions, changedDates],
      );
      await this.record(client, actor, req, changedDates ? 'stay.reschedule' : 'stay.update', stay.id);
      return {status: 'confirmed'};
    });
  }

  @Post(':id/decision')
  @HttpCode(200)
  async cancel(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = parse(cancelSchema, body);
    return this.change(req, id, input.version, async (client, actor, stay) => {
      if (!['pending', 'confirmed'].includes(stay.status))
        throw conflict('estadia_encerrada', 'Esta estadia está encerrada.');
      await client.query(
        "update stay set status = 'cancelled', decision_note = $2, guest_token_hash = null, version = version + 1 where id = $1",
        [stay.id, input.note ?? null],
      );
      await this.record(client, actor, req, 'stay.cancel', stay.id);
      return {status: 'cancelled'};
    });
  }

  @Post(':id/guest-link')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  async guestLink(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    const {version} = parse(versionSchema, body);
    return this.change(req, id, version, async (client, actor, stay) => {
      if (stay.status !== 'confirmed')
        throw conflict('estadia_encerrada', 'O link desta estadia não está disponível.');
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
        arrival_instructions: string | null;
      }>(
        `select u.label as unit_label, s.check_in_at, s.check_out_at, c.name as condominium, c.timezone, s.arrival_instructions
           from stay s join unit u on u.condominium_id = s.condominium_id and u.id = s.unit_id
           join condominium c on c.id = s.condominium_id
          where s.id = $1 and s.guest_token_hash = $2 and s.status = 'confirmed' and u.status = 'active'`,
        [link.id, hash],
      );
      const stay = rows[0];
      if (!stay) throw notFound();
      const window = guestAppWindow({checkInAt: stay.check_in_at, checkOutAt: stay.check_out_at});
      const now = this.clock.now();
      if (!isWithin(window, now))
        throw gone('link_estadia_fora_horario', 'O link está fora do período de consulta.');
      if (stay.arrival_instructions) {
        await audit(client, {
          condominiumId: link.condominium_id,
          actorPersonId: null,
          actorKind: 'service',
          action: 'stay.arrival.read',
          objectType: 'stay',
          objectId: link.id,
        });
      }
      return {
        condominium: stay.condominium,
        timezone: stay.timezone,
        unitLabel: stay.unit_label,
        checkInAt: stay.check_in_at,
        checkOutAt: stay.check_out_at,
        availableUntil: window.endsAt,
        bulletin: await guestBulletin(client, now),
        arrivalInstructions: stay.arrival_instructions
          ? this.vault.open(stay.arrival_instructions, instructionsContext(link.id))
          : null,
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
    return this.actors.run(req, 'stay.read.own', async (client, actor) => {
      const current = await client.query<Stay>(`${selectStay} where s.id = $1 for update of s`, [stayId]);
      const stay = current.rows[0];
      if (!stay || !decide(actor, 'stay.write.own', {unitId: stay.unit_id}).allow) throw notFound();
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
