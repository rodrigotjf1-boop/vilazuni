import {Body, Controller, Get, Header, HttpCode, Inject, Param, Post, Query, Req} from '@nestjs/common';
import {type PoolClient} from 'pg';
import {z} from 'zod';
import {audit} from '../audit/audit.js';
import type {AuthedRequest} from '../auth/auth.guard.js';
import {ActorService} from '../authz/actor.service.js';
import {uuidv7} from '../db/tenant.js';
import {badRequest, conflict, notFound} from '../http/errors.js';
import {parse, pathId} from '../http/validate.js';
import {bulletinEntry, bulletinLimit, currentBulletins, type BulletinRow} from './bulletin-store.js';

const text = z
  .object({title: z.string().trim().min(3).max(120), body: z.string().trim().min(3).max(12000)})
  .strict();
const instant = z.iso.datetime({offset: true}).transform((value) => new Date(value));
const version = z.number().int().min(1).max(2147483647);
const publication = z.object({
  translations: z.object({'pt-BR': text, es: text.optional(), en: text.optional()}).strict(),
  shareWithGuests: z.boolean(),
  requiresAcknowledgement: z.boolean(),
  effectiveAt: instant.optional(),
  expiresAt: instant.optional(),
});
const newPublication = publication.extend({kind: z.enum(['rule', 'notice'])}).strict();
const newRevision = publication.extend({version}).strict();
const receipt = z.object({version, action: z.enum(['read', 'acknowledge'])}).strict();
const page = z.object({offset: z.coerce.number().int().min(0).max(100000).default(0)}).strict();
const managementPage = page.extend({id: z.uuid().optional()});

type Receipt = {read_at: Date | null; acknowledged_at: Date | null};
type PublicationInput = z.infer<typeof publication>;

@Controller('bulletin')
export class BulletinController {
  constructor(@Inject(ActorService) private readonly actors: ActorService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const {offset} = parse(page, query);
    return this.actors.run(req, 'condominium.read', async (client, actor) => {
      const condo = await client.query<{timezone: string}>('select timezone from condominium');
      const result = await client.query<BulletinRow & Receipt>(
        `select item.*, rec.read_at, rec.acknowledged_at from (${currentBulletins}) item
          left join bulletin_receipt rec on rec.bulletin_id = item.id and rec.version = item.version
            and rec.person_id = $2
          order by item.kind desc, item.effective_at desc, item.id limit $3 offset $4`,
        [actor.now, actor.personId, bulletinLimit + 1, offset],
      );
      return {
        timezone: condo.rows[0]!.timezone,
        entries: result.rows.slice(0, bulletinLimit).map((row) => ({
          ...bulletinEntry(row),
          readAt: row.read_at,
          acknowledgedAt: row.acknowledged_at,
        })),
        more: result.rows.length > bulletinLimit,
      };
    });
  }

  @Get('manage')
  @Header('Cache-Control', 'no-store')
  async manage(@Req() req: AuthedRequest, @Query() query: unknown) {
    const {offset, id} = parse(managementPage, query);
    return this.actors.run(req, 'bulletin.publish', async (client) => {
      const condo = await client.query<{timezone: string}>('select timezone from condominium');
      const result = await client.query<BulletinRow & {reads: number; acknowledgements: number}>(
        `select b.id, b.kind, r.version, r.translations, r.share_with_guests, r.requires_acknowledgement,
                r.effective_at, r.expires_at, r.published_at, p.display_name as published_by,
                receipts.reads, receipts.acknowledgements
           from bulletin b
           join lateral (
             select * from bulletin_revision rev
               where (rev.condominium_id, rev.bulletin_id) = (b.condominium_id, b.id)
               order by rev.version desc limit (case when $3::uuid is null then 1 end)
           ) r on true
           join person p on p.id = r.published_by
           join lateral (
             select count(*)::int as reads, count(acknowledged_at)::int as acknowledgements
               from bulletin_receipt rec
              where (rec.condominium_id, rec.bulletin_id, rec.version) = (b.condominium_id, b.id, r.version)
           ) receipts on true
          where ($3::uuid is null or b.id = $3)
          order by r.published_at desc, b.id, r.version desc limit $1 offset $2`,
        [bulletinLimit + 1, offset, id ?? null],
      );
      return {
        timezone: condo.rows[0]!.timezone,
        entries: result.rows.slice(0, bulletinLimit).map((row) => ({
          ...bulletinEntry(row),
          reads: row.reads,
          acknowledgements: row.acknowledgements,
        })),
        more: result.rows.length > bulletinLimit,
      };
    });
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  async publish(@Req() req: AuthedRequest, @Body() body: unknown) {
    const input = parse(newPublication, body);
    return this.actors.run(req, 'bulletin.publish', async (client, actor) => {
      const id = uuidv7(actor.now.getTime());
      await client.query('insert into bulletin (condominium_id, id, kind) values ($1,$2,$3)', [
        actor.condominiumId,
        id,
        input.kind,
      ]);
      return this.save(client, actor, id, 1, input, req);
    });
  }

  @Post(':id/revisions')
  @Header('Cache-Control', 'no-store')
  async revise(@Req() req: AuthedRequest, @Param('id') rawId: string, @Body() body: unknown) {
    const id = pathId(rawId);
    const input = parse(newRevision, body);
    return this.actors.run(req, 'bulletin.publish', async (client, actor) => {
      if (!(await client.query('select id from bulletin where id = $1 for update', [id])).rowCount)
        throw notFound();
      const {rows} = await client.query<{version: number}>(
        'select version from bulletin_revision where bulletin_id = $1 order by version desc limit 1',
        [id],
      );
      if (rows[0]?.version !== input.version)
        throw conflict('versao_desatualizada', 'Esta publicação mudou. Recarregue antes de publicar.');
      return this.save(client, actor, id, input.version + 1, input, req);
    });
  }

  @Post(':id/receipt')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  async recordReceipt(@Req() req: AuthedRequest, @Param('id') rawId: string, @Body() body: unknown) {
    const id = pathId(rawId);
    const input = parse(receipt, body);
    return this.actors.run(req, 'condominium.read', async (client, actor) => {
      // O mesmo lock da revisão evita receber ciência de uma versão substituída durante a transação.
      if (!(await client.query('select id from bulletin where id = $1 for update', [id])).rowCount)
        throw notFound();
      const {rows} = await client.query<BulletinRow>(currentBulletins + ' and b.id = $2', [actor.now, id]);
      const entry = rows[0];
      if (!entry) throw notFound();
      if (entry.version !== input.version)
        throw conflict('versao_desatualizada', 'Esta publicação mudou. Leia a versão atual.');
      const acknowledge = input.action === 'acknowledge';
      if (acknowledge && !entry.requires_acknowledgement)
        throw badRequest('ciencia_nao_solicitada', 'Esta publicação pede apenas leitura.');
      const stored = await client.query<Receipt>(
        `insert into bulletin_receipt (condominium_id, bulletin_id, version, person_id, read_at, acknowledged_at)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (condominium_id, bulletin_id, version, person_id) do update
           set acknowledged_at = coalesce(bulletin_receipt.acknowledged_at, excluded.acknowledged_at)
         returning read_at, acknowledged_at`,
        [actor.condominiumId, id, entry.version, actor.personId, actor.now, acknowledge ? actor.now : null],
      );
      return {readAt: stored.rows[0]!.read_at, acknowledgedAt: stored.rows[0]!.acknowledged_at};
    });
  }

  private async save(
    client: PoolClient,
    actor: {condominiumId: string; personId: string; now: Date},
    id: string,
    versionNumber: number,
    input: PublicationInput,
    req: AuthedRequest,
  ) {
    const starts = input.effectiveAt ?? actor.now;
    if (input.expiresAt && input.expiresAt <= starts)
      throw badRequest('vigencia_invalida', 'O fim da vigência precisa ser posterior ao início.');
    await client.query(
      `insert into bulletin_revision (condominium_id, bulletin_id, version, translations, share_with_guests,
          requires_acknowledgement, effective_at, expires_at, published_by, published_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        actor.condominiumId,
        id,
        versionNumber,
        JSON.stringify(input.translations),
        input.shareWithGuests,
        input.requiresAcknowledgement,
        starts,
        input.expiresAt ?? null,
        actor.personId,
        actor.now,
      ],
    );
    await audit(client, {
      condominiumId: actor.condominiumId,
      actorPersonId: actor.personId,
      action: 'bulletin.publish',
      objectType: 'bulletin',
      objectId: id,
      detail: {version: versionNumber},
      correlationId: req.correlationId,
    });
    return {id, version: versionNumber};
  }
}
