import {Body, Controller, Get, HttpCode, Inject, Param, Post, Req} from '@nestjs/common';
import type {Pool, PoolClient} from 'pg';
import {z} from 'zod';
import {DB_POOL} from '../db/database.js';
import {CLOCK, type Clock} from '../clock.js';
import {withCondominium, uuidv7} from '../db/tenant.js';
import {parse} from '../http/validate.js';
import {badRequest, conflict, forbidden, gone, notFound} from '../http/errors.js';
import {Public, type AuthedRequest} from '../auth/auth.guard.js';
import {ActorService} from '../authz/actor.service.js';
import {audit} from '../audit/audit.js';
import {hashPassword, newToken, sha256, verifyPassword, PASSWORD_MAX, PASSWORD_MIN} from '../auth/crypto.js';
import {ADMINISTRATOR_SCOPE_NAMES, ASSIGNABLE_ROLES} from '../governance/governance.controller.js';

/** Papéis que entram por convite. Síndico não: ele precisa do mandato (ata) e entra por `POST /roles`. */
export const INVITABLE_ROLES = ASSIGNABLE_ROLES.filter((r) => r !== 'syndic') as [
  Exclude<(typeof ASSIGNABLE_ROLES)[number], 'syndic'>,
  ...Exclude<(typeof ASSIGNABLE_ROLES)[number], 'syndic'>[],
];

const contact = z.string().trim().toLowerCase().email().max(254);
const expires = z.number().int().min(1).max(168).default(72);
const createSchema = z.discriminatedUnion('purpose', [
  // Morador de contrato entra na F1.2, junto com a validação dele (ninguém fica pendente sem quem valide).
  z
    .object({
      purpose: z.literal('ownership'),
      unitId: z.string().uuid(),
      contactValue: contact,
      expiresInHours: expires,
    })
    .strict(),
  // Papel (Tenaz, prestador, conselho…): quem convida decide — é ato crítico (segundo fator recente).
  z
    .object({
      purpose: z.literal('role'),
      role: z.enum(INVITABLE_ROLES),
      scopes: z.array(z.enum(ADMINISTRATOR_SCOPE_NAMES)).max(3).default([]),
      contactValue: contact,
      expiresInHours: expires,
    })
    .strict(),
]);

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
  role: string | null;
  scopes: string[];
  created_by: string;
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
    const action = input.purpose === 'role' ? 'role.assign' : 'invitation.create';
    if (input.purpose === 'role' && input.role !== 'administrator' && input.scopes.length)
      throw badRequest('escopo_so_da_administradora', 'Escopos valem só para a administradora.');
    return this.actors.run(req, action, async (client, actor) => {
      if (input.purpose === 'ownership') {
        const unit = await client.query('select id from unit where id = $1', [input.unitId]);
        if (!unit.rowCount) throw notFound();
      }
      const token = newToken();
      const now = this.clock.now();
      const id = uuidv7(now.getTime());
      const expiresAt = new Date(now.getTime() + input.expiresInHours * 3_600_000);
      const unitId = input.purpose === 'ownership' ? input.unitId : null;
      const role = input.purpose === 'role' ? input.role : null;
      const scopes = input.purpose === 'role' ? input.scopes : [];
      await client.query(
        `insert into invitation (id, condominium_id, purpose, unit_id, role, scopes, contact_kind, contact_value, token_hash,
                                 expires_at, created_by, created_at)
         values ($1, $2, $3, $4, $5, $6, 'email', $7, $8, $9, $10, $11)`,
        [
          id,
          actor.condominiumId,
          input.purpose,
          unitId,
          role,
          scopes,
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
        detail: {purpose: input.purpose, unitId, role, scopes},
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
        role: inv.role,
        scopes: inv.scopes,
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
      if (inv.purpose === 'role') return this.acceptRole(req, client, inv, personId, linkId, now);
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
    return {
      personId: outcome.personId,
      link: {
        id: outcome.linkId,
        type: outcome.purpose,
        status: outcome.purpose === 'role' ? 'active' : 'pending',
      },
    };
  }

  /**
   * Convite de papel: quem convidou já decidiu (com segundo fator recente); o aceite cria o papel ATIVO.
   * Quem convidou não aceita o próprio convite (ninguém concede papel a si mesmo).
   */
  private async acceptRole(
    req: AuthedRequest,
    client: PoolClient,
    inv: InvitationRow,
    personId: string,
    linkId: string,
    now: Date,
  ) {
    if (personId === inv.created_by)
      return {error: forbidden('nao_pode_conceder_a_si', 'Quem convidou não aceita o próprio convite.')};
    const markUsed = () =>
      client.query('update invitation set used_at = $2, used_by = $3 where id = $1', [inv.id, now, personId]);
    const dup = await client.query(
      `select 1 from role_assignment where person_id = $1 and role = $2 and status = 'active'
          and (ends_at is null or ends_at > $3) limit 1`,
      [personId, inv.role, now],
    );
    if (dup.rowCount) {
      await markUsed();
      return {error: conflict('papel_ja_ativo', 'Você já tem esse papel.')};
    }
    await client.query(
      `insert into role_assignment (id, condominium_id, person_id, role, scopes, starts_at, granted_by, reason, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, 'Convite aceito', $6)`,
      [linkId, inv.condominium_id, personId, inv.role, inv.scopes, now, inv.created_by],
    );
    await markUsed();
    await audit(client, {
      condominiumId: inv.condominium_id,
      actorPersonId: personId,
      action: 'invitation.accept',
      objectType: 'role_assignment',
      objectId: linkId,
      correlationId: req.correlationId,
      detail: {role: inv.role, scopes: inv.scopes, grantedBy: inv.created_by},
    });
    return {personId, linkId, purpose: 'role' as const};
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
