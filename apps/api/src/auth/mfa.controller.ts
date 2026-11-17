import {Body, Controller, Get, HttpCode, Inject, Post, Req} from '@nestjs/common';
import {randomBytes} from 'node:crypto';
import type {Pool, PoolClient} from 'pg';
import {z} from 'zod';
import {generateSecret, generateURI, verifySync} from 'otplib';
import {MFA_RECENT_MS} from '@vilazuni/domain';
import {DB_POOL} from '../db/database.js';
import {CLOCK, type Clock} from '../clock.js';
import {VAULT, Vault} from '../crypto/vault.js';
import {withoutCondominium, uuidv7} from '../db/tenant.js';
import {parse} from '../http/validate.js';
import {ApiError, badRequest, conflict, forbidden} from '../http/errors.js';
import {audit} from '../audit/audit.js';
import type {AuthedRequest} from './auth.guard.js';
import {sha256, verifyPassword, PASSWORD_MAX} from './crypto.js';
import {LoginLimiter} from './login-limiter.js';

export const MFA_MAX_FAILURES = 5;
export const MFA_LOCK_MS = 15 * 60 * 1000;
export const RECOVERY_CODES = 10;
const ISSUER = 'Vilazuni';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I/L: dá para ditar e digitar

const passwordSchema = z.object({password: z.string().min(1).max(PASSWORD_MAX)}).strict();
const codeSchema = z.object({code: z.string().regex(/^\d{6}$/)}).strict();
const verifySchema = z
  .object({
    code: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    recoveryCode: z.string().max(40).optional(),
  })
  .strict()
  .refine((v) => (v.code === undefined) !== (v.recoveryCode === undefined), {
    message: 'Informe um dos dois.',
  });

const normalizeRecovery = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const totpContext = (personId: string) => `totp:${personId}`;

function newRecoveryCode(): string {
  const bytes = randomBytes(10);
  const chars = [...bytes].map((b) => ALPHABET[b & 31]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

/**
 * Segundo fator (especificação §6, ADR-0003): TOTP com o segredo CIFRADO no cofre; códigos de recuperação de uso
 * único. Configurar e redefinir pedem a senha (sessão roubada não troca o aparelho do dono). O "agora" do TOTP é o
 * relógio do servidor.
 */
@Controller('auth/mfa')
export class MfaController {
  private readonly passwordLimiter: LoginLimiter;

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(VAULT) private readonly vault: Vault,
  ) {
    this.passwordLimiter = new LoginLimiter(() => this.clock.now().getTime());
  }

  @Get()
  async status(@Req() req: AuthedRequest) {
    const personId = req.session!.personId;
    const r = await this.pool.query(
      `select confirmed_at, (select count(*)::int from auth_recovery_code where person_id = $1 and used_at is null) as left
         from auth_credential where person_id = $1 and kind = 'totp'`,
      [personId],
    );
    const mfaAt = req.session!.mfaAt;
    return {
      enrolled: !!r.rows[0]?.confirmed_at,
      setupPending: !!r.rows[0] && !r.rows[0].confirmed_at,
      satisfied: !!mfaAt,
      recent: !!mfaAt && this.clock.now().getTime() - mfaAt.getTime() <= MFA_RECENT_MS,
      recoveryCodesLeft: r.rows[0]?.confirmed_at ? r.rows[0].left : 0,
    };
  }

  private async checkPassword(req: AuthedRequest, password: string) {
    const personId = req.session!.personId;
    if (this.passwordLimiter.blocked(personId, personId))
      throw new ApiError(429, 'muitas_tentativas', 'Muitas tentativas. Aguarde 15 minutos.');
    const r = await this.pool.query(
      `select secret from auth_credential where person_id = $1 and kind = 'password'`,
      [personId],
    );
    if (!r.rows[0] || !(await verifyPassword(r.rows[0].secret, password))) {
      this.passwordLimiter.failed(personId, personId);
      throw forbidden('senha_incorreta', 'Senha incorreta.');
    }
    this.passwordLimiter.succeeded(personId);
  }

  @Post('totp/setup')
  @HttpCode(200)
  async setup(@Req() req: AuthedRequest, @Body() body: unknown) {
    const {password} = parse(passwordSchema, body);
    await this.checkPassword(req, password);
    const personId = req.session!.personId;
    const secret = generateSecret();
    const sealed = this.vault.seal(secret, totpContext(personId));
    const now = this.clock.now();
    // Só substitui configuração NÃO confirmada; a confirmada só sai pela redefinição.
    const r = await this.pool.query(
      `insert into auth_credential (id, person_id, kind, secret, created_at) values ($1, $2, 'totp', $3, $4)
       on conflict (person_id, kind) do update set secret = excluded.secret, created_at = excluded.created_at,
              last_used_step = null, failed_count = 0, locked_until = null
        where auth_credential.confirmed_at is null`,
      [uuidv7(now.getTime()), personId, sealed, now],
    );
    if (!r.rowCount) throw conflict('mfa_ja_ativo', 'A verificação em duas etapas já está ativa.');
    const who = await this.pool.query(
      `select coalesce((select value from verified_contact where person_id = p.id and kind = 'email' order by created_at limit 1),
                       p.display_name) as label from person p where p.id = $1`,
      [personId],
    );
    // O segredo aparece só aqui (para o QR ou para digitar); no banco fica cifrado.
    return {secret, otpauthUri: generateURI({issuer: ISSUER, label: who.rows[0].label, secret})};
  }

  /** Confere o código contra o segredo; devolve o passo de tempo aceito ou null. Código repetido não vale. */
  private check(sealed: string, personId: string, code: string, afterStep: string | null): number | null {
    try {
      const result = verifySync({
        secret: this.vault.open(sealed, totpContext(personId)),
        token: code,
        epoch: Math.floor(this.clock.now().getTime() / 1000),
        epochTolerance: 30,
        ...(afterStep !== null ? {afterTimeStep: Number(afterStep)} : {}),
      });
      return result.valid ? (result as {timeStep: number}).timeStep : null;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      return null;
    }
  }

  /**
   * Tentativa errada precisa ficar GRAVADA: a transação devolve o erro e ele sai depois do commit.
   */
  private async withTotp<T>(
    personId: string,
    confirmed: boolean,
    fn: (
      client: PoolClient,
      row: Record<string, any>,
      fail: () => Promise<{error: ApiError}>,
    ) => Promise<T | {error: ApiError}>,
  ): Promise<T> {
    const outcome = await withoutCondominium(this.pool, async (client) => {
      const r = await client.query(
        `select * from auth_credential where person_id = $1 and kind = 'totp' and (confirmed_at is not null) = $2 for update`,
        [personId, confirmed],
      );
      const row = r.rows[0];
      if (!row)
        return {
          error: confirmed
            ? badRequest('mfa_nao_configurado', 'Configure a verificação em duas etapas primeiro.')
            : badRequest('mfa_sem_configuracao_pendente', 'Comece a configuração de novo.'),
        };
      const now = this.clock.now();
      if (row.locked_until && (row.locked_until as Date).getTime() > now.getTime())
        return {error: new ApiError(429, 'mfa_bloqueado', 'Muitos códigos errados. Aguarde 15 minutos.')};
      const fail = async () => {
        const failed = row.failed_count + 1;
        const lock = failed >= MFA_MAX_FAILURES;
        await client.query(`update auth_credential set failed_count = $2, locked_until = $3 where id = $1`, [
          row.id,
          lock ? 0 : failed,
          lock ? new Date(now.getTime() + MFA_LOCK_MS) : null,
        ]);
        return {error: badRequest('codigo_invalido', 'Código inválido ou já usado.')};
      };
      return fn(client, row, fail);
    });
    if (outcome && typeof outcome === 'object' && 'error' in outcome)
      throw (outcome as {error: ApiError}).error;
    return outcome as T;
  }

  private async markSession(client: PoolClient, req: AuthedRequest, now: Date) {
    await client.query(`update auth_session set mfa_at = $2 where id = $1`, [req.session!.id, now]);
  }

  @Post('totp/confirm')
  @HttpCode(200)
  async confirm(@Req() req: AuthedRequest, @Body() body: unknown) {
    const {code} = parse(codeSchema, body);
    const personId = req.session!.personId;
    return this.withTotp(personId, false, async (client, row, fail) => {
      const step = this.check(row.secret, personId, code, null);
      if (step === null) return fail();
      const now = this.clock.now();
      await client.query(
        `update auth_credential set confirmed_at = $2, last_used_step = $3, failed_count = 0, locked_until = null where id = $1`,
        [row.id, now, step],
      );
      await client.query(`delete from auth_recovery_code where person_id = $1`, [personId]);
      const codes = Array.from({length: RECOVERY_CODES}, newRecoveryCode);
      for (const c of codes)
        await client.query(
          `insert into auth_recovery_code (id, person_id, code_hash, created_at) values ($1, $2, $3, $4)`,
          [uuidv7(now.getTime()), personId, sha256(normalizeRecovery(c)), now],
        );
      await this.markSession(client, req, now);
      await audit(client, {
        condominiumId: null,
        actorPersonId: personId,
        action: 'mfa.enroll',
        correlationId: req.correlationId,
      });
      // Os códigos aparecem só aqui; no banco fica o hash de cada um.
      return {enrolled: true, recoveryCodes: codes};
    });
  }

  @Post('verify')
  @HttpCode(200)
  async verify(@Req() req: AuthedRequest, @Body() body: unknown) {
    const input = parse(verifySchema, body);
    const personId = req.session!.personId;
    return this.withTotp(personId, true, async (client, row, fail) => {
      const now = this.clock.now();
      if (input.code !== undefined) {
        const step = this.check(row.secret, personId, input.code, row.last_used_step);
        if (step === null) return fail();
        await client.query(
          `update auth_credential set last_used_step = $2, failed_count = 0, locked_until = null where id = $1`,
          [row.id, step],
        );
      } else {
        const used = await client.query(
          `update auth_recovery_code set used_at = $3 where person_id = $1 and code_hash = $2 and used_at is null returning id`,
          [personId, sha256(normalizeRecovery(input.recoveryCode!)), now],
        );
        if (!used.rowCount) return fail();
        await client.query(`update auth_credential set failed_count = 0, locked_until = null where id = $1`, [
          row.id,
        ]);
        await audit(client, {
          condominiumId: null,
          actorPersonId: personId,
          action: 'mfa.recovery_code_used',
          correlationId: req.correlationId,
        });
      }
      await this.markSession(client, req, now);
      return {satisfied: true, recent: true};
    });
  }

  /** Trocar de aparelho: pede a senha E o segundo fator recente (código atual ou de recuperação). */
  @Post('totp/reset')
  @HttpCode(200)
  async reset(@Req() req: AuthedRequest, @Body() body: unknown) {
    const {password} = parse(passwordSchema, body);
    const mfaAt = req.session!.mfaAt;
    if (!mfaAt || this.clock.now().getTime() - mfaAt.getTime() > MFA_RECENT_MS)
      throw forbidden('mfa_recente_exigido', 'Confirme o código do aplicativo autenticador de novo.');
    await this.checkPassword(req, password);
    const personId = req.session!.personId;
    await withoutCondominium(this.pool, async (client) => {
      await client.query(`delete from auth_recovery_code where person_id = $1`, [personId]);
      await client.query(`delete from auth_credential where person_id = $1 and kind = 'totp'`, [personId]);
      // nenhuma sessão continua "verificada" por um segundo fator que não existe mais
      await client.query(`update auth_session set mfa_at = null where person_id = $1`, [personId]);
      await audit(client, {
        condominiumId: null,
        actorPersonId: personId,
        action: 'mfa.reset',
        correlationId: req.correlationId,
      });
    });
    return {enrolled: false};
  }
}
