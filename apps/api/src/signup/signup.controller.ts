import {Body, Controller, Get, HttpCode, Inject, Param, Post, Req} from '@nestjs/common';
import {randomInt} from 'node:crypto';
import type {Pool, PoolClient} from 'pg';
import {z} from 'zod';
import {DB_POOL} from '../db/database.js';
import {CONFIG, type AppConfig} from '../config.js';
import {CLOCK, type Clock} from '../clock.js';
import {withCondominium, uuidv7} from '../db/tenant.js';
import {parse} from '../http/validate.js';
import {ApiError, badRequest, conflict, gone, notFound} from '../http/errors.js';
import {Public, type AuthedRequest} from '../auth/auth.guard.js';
import {clientAddress} from '../auth/auth.controller.js';
import {audit} from '../audit/audit.js';
import {hashPassword, sameHash, sha256, verifyPassword, PASSWORD_MAX, PASSWORD_MIN} from '../auth/crypto.js';
import {EMAIL_SENDER, type EmailSender} from '../messaging/email.js';
import {enqueueEmail} from '../messaging/outbox.js';

export const CODE_MINUTES = 15;
export const CODES_PER_HOUR = 5;
export const ADDRESS_CODES_PER_HOUR = 30;
const HOUR = 60 * 60 * 1000;

const lang = z.enum(['pt-BR', 'es', 'en']).default('pt-BR');
const codeSchema = z
  .object({email: z.string().trim().toLowerCase().email().max(254), preferredLanguage: lang})
  .strict();
const finishSchema = z
  .object({
    verificationId: z.string().uuid(),
    code: z.string().regex(/^\d{6}$/),
    displayName: z.string().trim().min(2).max(120),
    password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
    preferredLanguage: lang,
    unitIds: z.array(z.string().uuid()).min(1).max(5),
    shareNote: z.string().trim().max(200).optional(),
  })
  .strict();

type Link = {
  id: string;
  max_uses: number;
  uses: number;
  expires_at: Date;
  revoked_at: Date | null;
  name: string;
};

/**
 * Cadastro pelo link do condomínio (ADR-0011): a pessoa confirma o e-mail com um código, cria a conta e pede as
 * casas — tudo PENDENTE até a validação da gestão. Nunca concede papel. O código vai por e-mail pela fila de saída.
 */
@Controller('signup')
export class SignupController {
  /** pedidos de código por endereço de rede (memória do processo; o limite por e-mail fica no banco) */
  private readonly byAddress = new Map<string, number[]>();

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(EMAIL_SENDER) private readonly sender: EmailSender | null,
  ) {}

  private async locate(token: string): Promise<{id: string; condominiumId: string}> {
    if (typeof token !== 'string' || token.length < 20 || token.length > 200) throw notFound();
    const r = await this.pool.query('select id, condominium_id from signup_link_by_token($1)', [
      sha256(token),
    ]);
    if (!r.rows[0]) throw notFound();
    return {id: r.rows[0].id, condominiumId: r.rows[0].condominium_id};
  }

  private async load(client: PoolClient, id: string, lock = false): Promise<Link> {
    const r = await client.query<Link>(
      `select s.id, s.max_uses, s.uses, s.expires_at, s.revoked_at, c.name
         from signup_link s join condominium c on c.id = s.condominium_id
        where s.id = $1 ${lock ? 'for update of s' : ''}`,
      [id],
    );
    return r.rows[0]!;
  }

  private linkState(l: Link): ApiError | null {
    if (l.revoked_at)
      return gone('link_revogado', 'Este link de cadastro foi revogado. Peça um novo à gestão.');
    if (l.expires_at.getTime() <= this.clock.now().getTime())
      return gone('link_vencido', 'Este link de cadastro venceu. Peça um novo à gestão.');
    if (l.uses >= l.max_uses)
      return gone('link_esgotado', 'Este link já atingiu o limite de cadastros. Peça um novo à gestão.');
    return null;
  }

  @Public()
  @Get(':token')
  async preview(@Param('token') token: string) {
    const {id, condominiumId} = await this.locate(token);
    return withCondominium(this.pool, condominiumId, async (client) => {
      const link = await this.load(client, id);
      const state = this.linkState(link);
      if (state) throw state;
      const units = await client.query(`select id, label from unit where status = 'active' order by label`);
      return {
        condominiumName: link.name,
        expiresAt: link.expires_at,
        units: units.rows.map((u) => ({id: u.id as string, label: u.label as string})),
        emailAvailable: !!this.sender,
      };
    });
  }

  /** Como no entrar: pedido de navegador vindo de outra origem é recusado (o app nativo não manda Origin). */
  private checkOrigin(req: AuthedRequest) {
    const origin = req.headers.origin;
    if (origin && !this.config.ALLOWED_ORIGINS.includes(origin))
      throw new ApiError(403, 'origem_recusada', 'Origem do pedido não permitida.');
  }

  private addressAllowed(address: string): boolean {
    const now = this.clock.now().getTime();
    const recent = (this.byAddress.get(address) ?? []).filter((t) => t > now - HOUR);
    if (recent.length >= ADDRESS_CODES_PER_HOUR) return false;
    recent.push(now);
    if (this.byAddress.size > 10_000) this.byAddress.clear();
    this.byAddress.set(address, recent);
    return true;
  }

  @Public()
  @Post(':token/code')
  @HttpCode(201)
  async requestCode(@Req() req: AuthedRequest, @Param('token') token: string, @Body() body: unknown) {
    this.checkOrigin(req);
    const input = parse(codeSchema, body);
    if (!this.sender)
      throw new ApiError(
        503,
        'envio_indisponivel',
        'O envio de e-mail ainda não está configurado. Avise a gestão.',
      );
    const {id, condominiumId} = await this.locate(token);
    if (!this.addressAllowed(clientAddress(req, this.config)))
      throw new ApiError(429, 'muitos_codigos', 'Muitos pedidos de código. Aguarde uma hora.');
    return withCondominium(this.pool, condominiumId, async (client) => {
      const link = await this.load(client, id);
      const state = this.linkState(link);
      if (state) throw state;
      const now = this.clock.now();
      const recent = await client.query(
        `select count(*)::int as n from email_verification where email = $1 and created_at > $2`,
        [input.email, new Date(now.getTime() - HOUR)],
      );
      if (recent.rows[0].n >= CODES_PER_HOUR)
        throw new ApiError(
          429,
          'muitos_codigos',
          'Muitos pedidos de código para este e-mail. Aguarde uma hora.',
        );
      const verificationId = uuidv7(now.getTime());
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const expiresAt = new Date(now.getTime() + CODE_MINUTES * 60_000);
      await client.query(
        `insert into email_verification (id, condominium_id, signup_link_id, email, code_hash, expires_at, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [verificationId, condominiumId, id, input.email, sha256(`${verificationId}:${code}`), expiresAt, now],
      );
      // mesma transação: o código só existe se o envio ficar registrado na fila
      await enqueueEmail(
        client,
        {
          condominiumId,
          idempotencyKey: `verificacao:${verificationId}`,
          to: input.email,
          lang: input.preferredLanguage,
          template: 'verification',
          params: {code, condominiumName: link.name, minutes: CODE_MINUTES},
        },
        now,
      );
      return {verificationId, expiresAt};
    });
  }

  @Public()
  @Post(':token/finish')
  @HttpCode(201)
  async finish(@Req() req: AuthedRequest, @Param('token') token: string, @Body() body: unknown) {
    this.checkOrigin(req);
    const input = parse(finishSchema, body);
    const {id, condominiumId} = await this.locate(token);
    // Tentativa errada precisa ficar GRAVADA: a transação devolve o motivo e o erro sai depois do commit.
    const outcome = await withCondominium(this.pool, condominiumId, async (client) => {
      const link = await this.load(client, id, true);
      const state = this.linkState(link);
      if (state) return {error: state};
      const v = (
        await client.query(
          `select * from email_verification where id = $1 and signup_link_id = $2 for update`,
          [input.verificationId, id],
        )
      ).rows[0];
      if (!v) return {error: notFound()};
      const now = this.clock.now();
      if (v.used_at) return {error: gone('codigo_usado', 'Este código já foi usado. Peça um novo.')};
      if ((v.expires_at as Date).getTime() <= now.getTime())
        return {error: gone('codigo_vencido', 'O código venceu. Peça um novo.')};
      if (v.attempts >= v.max_attempts)
        return {error: gone('codigo_bloqueado', 'Muitas tentativas com este código. Peça um novo.')};
      const wrong = async (code: string, message: string) => {
        await client.query(`update email_verification set attempts = attempts + 1 where id = $1`, [v.id]);
        return {error: badRequest(code, message)};
      };
      if (!sameHash(v.code_hash, sha256(`${v.id}:${input.code}`)))
        return wrong('codigo_invalido', 'Código inválido.');
      const ids = [...new Set(input.unitIds)];
      const units = await client.query(
        `select id, label from unit where id = any($1::uuid[]) and status = 'active' order by label`,
        [ids],
      );
      if (units.rowCount !== ids.length)
        return {error: badRequest('casa_invalida', 'Escolha casas deste condomínio.')};
      const personId = await this.personFor(client, v.email, input, now);
      if (personId === null)
        return wrong('senha_da_conta_nao_confere', 'Este e-mail já tem conta: use a senha dela.');
      const requested: string[] = [];
      const alreadyLinked: string[] = [];
      for (const u of units.rows) {
        // o índice "ownership_aberta" decide: pedido aberto ou vínculo ativo na mesma casa não se duplica
        const r = await client.query(
          `insert into ownership (id, condominium_id, unit_id, person_id, share_note, status, requested_at)
           values ($1, $2, $3, $4, $5, 'pending', $6)
           on conflict (condominium_id, unit_id, person_id) where status in ('pending','validated') and ends_at is null
           do nothing`,
          [uuidv7(now.getTime()), condominiumId, u.id, personId, input.shareNote || null, now],
        );
        (r.rowCount ? requested : alreadyLinked).push(u.label as string);
      }
      await client.query(`update email_verification set used_at = $2 where id = $1`, [v.id, now]);
      await client.query(`update signup_link set uses = uses + 1 where id = $1`, [id]);
      await audit(client, {
        condominiumId,
        actorPersonId: personId,
        action: 'signup.complete',
        objectType: 'signup_link',
        objectId: id,
        correlationId: req.correlationId,
        detail: {requested, alreadyLinked},
      });
      return {personId, requested, alreadyLinked};
    });
    if ('error' in outcome) throw outcome.error;
    return outcome;
  }

  /**
   * E-mail que já tem conta: a senha dela prova a posse (o código só prova o e-mail). E-mail novo: o código acabou
   * de provar o contato e a conta nasce aqui. Devolve null quando a senha da conta existente não confere.
   */
  private async personFor(
    client: PoolClient,
    email: string,
    input: z.infer<typeof finishSchema>,
    now: Date,
  ): Promise<string | null> {
    const existing = await client.query(
      `select p.id, c.secret from verified_contact v join person p on p.id = v.person_id
         left join auth_credential c on c.person_id = p.id and c.kind = 'password'
        where v.kind = 'email' and v.value = $1`,
      [email],
    );
    const row = existing.rows[0];
    if (row)
      return row.secret && (await verifyPassword(row.secret, input.password)) ? (row.id as string) : null;
    const personId = uuidv7(now.getTime());
    try {
      await client.query(`insert into person (id, display_name, preferred_language) values ($1, $2, $3)`, [
        personId,
        input.displayName,
        input.preferredLanguage,
      ]);
      await client.query(
        `insert into verified_contact (id, person_id, kind, value, verified_at) values ($1, $2, 'email', $3, $4)`,
        [uuidv7(now.getTime()), personId, email, now],
      );
      await client.query(
        `insert into auth_credential (id, person_id, kind, secret, confirmed_at) values ($1, $2, 'password', $3, $4)`,
        [uuidv7(now.getTime()), personId, await hashPassword(input.password), now],
      );
    } catch (error) {
      // outro cadastro do MESMO e-mail terminou no meio deste: nada fica gravado e a pessoa tenta de novo
      if ((error as {code?: string}).code === '23505')
        throw conflict(
          'conta_criada_agora',
          'Este e-mail acabou de ganhar conta. Tente de novo com a senha dela.',
        );
      throw error;
    }
    return personId;
  }
}
