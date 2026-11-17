import {Body, Controller, Get, HttpCode, Inject, Param, Post, Req} from '@nestjs/common';
import type {Pool, PoolClient} from 'pg';
import {z} from 'zod';
import {DB_POOL} from '../db/database.js';
import {CLOCK, type Clock} from '../clock.js';
import {withCondominium, uuidv7} from '../db/tenant.js';
import {parse} from '../http/validate.js';
import {badRequest, conflict, gone, notFound} from '../http/errors.js';
import {Public, type AuthedRequest} from '../auth/auth.guard.js';
import {ActorService} from '../authz/actor.service.js';
import {audit} from '../audit/audit.js';
import {hashPassword, newToken, sha256, verifyPassword, PASSWORD_MAX, PASSWORD_MIN} from '../auth/crypto.js';

const createSchema = z
  .object({
    // Morador de contrato entra na F1.2, junto com a validação dele (ninguém fica pendente sem quem valide).
    purpose: z.enum(['ownership']),
    unitId: z.string().uuid(),
    contactValue: z.string().trim().toLowerCase().email().max(254),
    expiresInHours: z.number().int().min(1).max(168).default(72),
  })
  .strict();

const acceptSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
    preferredLanguage: z.enum(['pt-BR', 'es', 'en']).default('pt-BR'),
  })
  .strict();

const mask = (email: string) => {
  const [user = '', domain = ''] = email.split('@');
  return `${user.slice(0, 1)}***@${domain.slice(0, 1)}***`;
};

type InvitationRow = {
  id: string;
  condominium_id: string;
  purpose: 'ownership' | 'residency' | 'role';
  unit_id: string | null;
  contact_value: string;
  expires_at: Date;
  attempts: number;
  max_attempts: number;
  used_at: Date | null;
};

/**
 * Convite individual de uso único (especificação §6, T06): token aleatório guardado só como hash, validade,
 * tentativas limitadas. Aceitar cria vínculo PENDENTE — a titularidade só vale depois da validação da gestão.
 */
@Controller('auth/invitations')
export class InvitationsController {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ActorService) private readonly actors: ActorService,
  ) {}

  @Post()
  async create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const input = parse(createSchema, body);
    return this.actors.run(req, 'invitation.create', async (client, actor) => {
      const unit = await client.query('select id from unit where id = $1', [input.unitId]);
      if (!unit.rowCount) throw notFound();
      const token = newToken();
      const now = this.clock.now();
      const id = uuidv7(now.getTime());
      const expiresAt = new Date(now.getTime() + input.expiresInHours * 3_600_000);
      await client.query(
        `insert into invitation (id, condominium_id, purpose, unit_id, contact_kind, contact_value, token_hash, expires_at, created_by, created_at)
         values ($1, $2, $3, $4, 'email', $5, $6, $7, $8, $9)`,
        [
          id,
          actor.condominiumId,
          input.purpose,
          input.unitId,
          input.contactValue,
          sha256(token),
          expiresAt,
          actor.personId,
          now,
        ],
      );
      await audit(client, {
        condominiumId: actor.condominiumId,
        actorPersonId: actor.personId,
        action: 'invitation.create',
        objectType: 'invitation',
        objectId: id,
        correlationId: req.correlationId,
        detail: {purpose: input.purpose, unitId: input.unitId},
      });
      // O token aparece só nesta resposta; no banco fica o hash.
      return {id, token, path: `/convite/${token}`, expiresAt};
    });
  }

  private async locate(token: string): Promise<{id: string; condominiumId: string}> {
    if (typeof token !== 'string' || token.length < 20 || token.length > 200) throw notFound();
    const r = await this.pool.query('select id, condominium_id from invitation_by_token($1)', [
      sha256(token),
    ]);
    if (!r.rows[0]) throw notFound();
    return {id: r.rows[0].id, condominiumId: r.rows[0].condominium_id};
  }

  private state(inv: InvitationRow): 'usado' | 'expirado' | 'bloqueado' | null {
    if (inv.used_at) return 'usado';
    if (inv.expires_at.getTime() <= this.clock.now().getTime()) return 'expirado';
    if (inv.attempts >= inv.max_attempts) return 'bloqueado';
    return null;
  }

  private stateError(state: 'usado' | 'expirado' | 'bloqueado') {
    const text = {
      usado: 'Este convite já foi usado.',
      expirado: 'Este convite venceu. Peça um novo à gestão.',
      bloqueado: 'Este convite foi bloqueado por tentativas incorretas. Peça um novo à gestão.',
    }[state];
    return gone(`convite_${state}`, text);
  }

  @Public()
  @Get(':token')
  async preview(@Param('token') token: string) {
    const {id, condominiumId} = await this.locate(token);
    return withCondominium(this.pool, condominiumId, async (client) => {
      const r = await client.query(
        `select i.*, u.label as unit_label, c.name as condominium_name
           from invitation i join condominium c on c.id = i.condominium_id
           left join unit u on u.condominium_id = i.condominium_id and u.id = i.unit_id
          where i.id = $1`,
        [id],
      );
      const inv = r.rows[0];
      const state = this.state(inv);
      if (state) throw this.stateError(state);
      return {
        condominiumName: inv.condominium_name,
        purpose: inv.purpose,
        unitLabel: inv.unit_label,
        contactHint: mask(inv.contact_value),
        expiresAt: inv.expires_at,
      };
    });
  }

  @Public()
  @Post(':token/accept')
  @HttpCode(201)
  async accept(@Req() req: AuthedRequest, @Param('token') token: string, @Body() body: unknown) {
    const input = parse(acceptSchema, body);
    const {id, condominiumId} = await this.locate(token);
    // Tentativa errada precisa ficar GRAVADA: a transação devolve o motivo e o erro sai depois do commit.
    const outcome = await withCondominium(this.pool, condominiumId, async (client) => {
      const r = await client.query<InvitationRow>('select * from invitation where id = $1 for update', [id]);
      const inv = r.rows[0]!;
      const state = this.state(inv);
      if (state) return {error: this.stateError(state)};
      const wrong = async (code: string, message: string) => {
        await client.query('update invitation set attempts = attempts + 1 where id = $1', [id]);
        return {error: badRequest(code, message)};
      };
      if (input.email !== inv.contact_value)
        return wrong('contato_nao_confere', 'O e-mail não é o do convite.');
      const personId = await this.personFor(client, input, wrong);
      if (typeof personId !== 'string') return personId;
      const now = this.clock.now();
      const linkId = uuidv7(now.getTime());
      if (inv.purpose !== 'ownership')
        return {error: gone('convite_invalido', 'Este convite não vale mais.')};
      await client.query('savepoint vinculo');
      try {
        await client.query(
          `insert into ownership (id, condominium_id, unit_id, person_id, status, requested_at) values ($1, $2, $3, $4, 'pending', $5)`,
          [linkId, condominiumId, inv.unit_id, personId, now],
        );
      } catch (error) {
        if ((error as {code?: string}).code !== '23505') throw error;
        // Já tem pedido aberto nesta casa: o convite é gasto e a pessoa fica com o pedido que já existia.
        await client.query('rollback to savepoint vinculo');
        await client.query('update invitation set used_at = $2, used_by = $3 where id = $1', [
          id,
          now,
          personId,
        ]);
        return {error: conflict('vinculo_ja_existe', 'Você já tem esse vínculo pedido ou ativo.')};
      }
      await client.query('update invitation set used_at = $2, used_by = $3 where id = $1', [
        id,
        now,
        personId,
      ]);
      await audit(client, {
        condominiumId,
        actorPersonId: personId,
        action: 'invitation.accept',
        objectType: inv.purpose,
        objectId: linkId,
        correlationId: req.correlationId,
      });
      return {personId, linkId, purpose: inv.purpose};
    });
    if ('error' in outcome) throw outcome.error;
    return {personId: outcome.personId, link: {id: outcome.linkId, type: outcome.purpose, status: 'pending'}};
  }

  /** Conta existente: precisa provar a senha dela. Conta nova: o link enviado ao e-mail prova o contato. */
  private async personFor(
    client: PoolClient,
    input: z.infer<typeof acceptSchema>,
    wrong: (code: string, message: string) => Promise<{error: unknown}>,
  ): Promise<string | {error: unknown}> {
    const existing = await client.query(
      `select p.id, c.secret from verified_contact v join person p on p.id = v.person_id
         left join auth_credential c on c.person_id = p.id and c.kind = 'password'
        where v.kind = 'email' and v.value = $1`,
      [input.email],
    );
    const row = existing.rows[0];
    if (row) {
      if (!row.secret || !(await verifyPassword(row.secret, input.password)))
        return wrong(
          'senha_da_conta_nao_confere',
          'Este e-mail já tem conta: use a senha dela para aceitar.',
        );
      return row.id as string;
    }
    const now = this.clock.now();
    const personId = uuidv7(now.getTime());
    await client.query(`insert into person (id, display_name, preferred_language) values ($1, $2, $3)`, [
      personId,
      input.displayName,
      input.preferredLanguage,
    ]);
    await client.query(
      `insert into verified_contact (id, person_id, kind, value, verified_at) values ($1, $2, 'email', $3, $4)`,
      [uuidv7(now.getTime()), personId, input.email, now],
    );
    await client.query(
      `insert into auth_credential (id, person_id, kind, secret, confirmed_at) values ($1, $2, 'password', $3, $4)`,
      [uuidv7(now.getTime()), personId, await hashPassword(input.password), now],
    );
    return personId;
  }
}
