import {Body, Controller, Get, HttpCode, Inject, Param, Post, Req} from '@nestjs/common';
import {z} from 'zod';
import {ActorService} from '../authz/actor.service.js';
import type {AuthedRequest} from '../auth/auth.guard.js';
import {CLOCK, type Clock} from '../clock.js';
import {uuidv7} from '../db/tenant.js';
import {parse, pathId} from '../http/validate.js';
import {conflict, notFound} from '../http/errors.js';
import {audit} from '../audit/audit.js';
import {newToken, sha256} from '../auth/crypto.js';

const DAY = 24 * 60 * 60 * 1000;
const createSchema = z
  .object({
    expiresInDays: z.number().int().min(1).max(60).default(14),
    maxUses: z.number().int().min(1).max(500).default(30),
  })
  .strict();

const view = (s: Record<string, any>, now: Date) => ({
  id: s.id as string,
  createdAt: s.created_at as Date,
  expiresAt: s.expires_at as Date,
  maxUses: s.max_uses as number,
  uses: s.uses as number,
  status: s.revoked_at
    ? 'revoked'
    : (s.expires_at as Date).getTime() <= now.getTime()
      ? 'expired'
      : s.uses >= s.max_uses
        ? 'exhausted'
        : 'active',
});

/**
 * Link de cadastro do condomínio (ADR-0011): a gestão cria, o dono envia aos proprietários, cada um cria a conta e
 * pede as casas (pendentes até a validação). Uso coletivo, com validade, limite de cadastros e revogação.
 */
@Controller('signup-links')
export class SignupLinksController {
  constructor(
    @Inject(ActorService) private readonly actors: ActorService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const input = parse(createSchema, body);
    return this.actors.run(req, 'invitation.create', async (client, actor) => {
      const now = this.clock.now();
      const id = uuidv7(now.getTime());
      const token = newToken();
      const expiresAt = new Date(now.getTime() + input.expiresInDays * DAY);
      await client.query(
        `insert into signup_link (id, condominium_id, token_hash, max_uses, expires_at, created_by, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [id, actor.condominiumId, sha256(token), input.maxUses, expiresAt, actor.personId, now],
      );
      await audit(client, {
        condominiumId: actor.condominiumId,
        actorPersonId: actor.personId,
        action: 'signup_link.create',
        objectType: 'signup_link',
        objectId: id,
        correlationId: req.correlationId,
        detail: {maxUses: input.maxUses, expiresAt},
      });
      // o token aparece só aqui; no banco fica o hash
      return {id, token, path: `/cadastro/${token}`, expiresAt, maxUses: input.maxUses};
    });
  }

  @Get()
  async list(@Req() req: AuthedRequest) {
    return this.actors.run(req, 'invitation.create', async (client) => {
      const r = await client.query(`select * from signup_link order by created_at desc limit 50`);
      const now = this.clock.now();
      return {links: r.rows.map((s) => view(s, now))};
    });
  }

  @Post(':id/revoke')
  @HttpCode(200)
  async revoke(@Req() req: AuthedRequest, @Param('id') id: string) {
    const linkId = pathId(id);
    return this.actors.run(req, 'invitation.create', async (client, actor) => {
      const now = this.clock.now();
      const r = await client.query(
        `update signup_link set revoked_at = $2, revoked_by = $3 where id = $1 and revoked_at is null returning *`,
        [linkId, now, actor.personId],
      );
      if (!r.rows[0]) {
        const exists = await client.query(`select 1 from signup_link where id = $1`, [linkId]);
        if (!exists.rowCount) throw notFound();
        throw conflict('link_ja_revogado', 'Este link já foi revogado.');
      }
      await audit(client, {
        condominiumId: actor.condominiumId,
        actorPersonId: actor.personId,
        action: 'signup_link.revoke',
        objectType: 'signup_link',
        objectId: linkId,
        correlationId: req.correlationId,
      });
      return {link: view(r.rows[0], now)};
    });
  }
}
