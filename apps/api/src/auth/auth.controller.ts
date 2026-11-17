import {Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req, Res} from '@nestjs/common';
import type {Response} from 'express';
import type {Pool} from 'pg';
import {z} from 'zod';
import {DB_POOL} from '../db/database.js';
import {CONFIG, type AppConfig} from '../config.js';
import {CLOCK, type Clock} from '../clock.js';
import {withCondominium} from '../db/tenant.js';
import {parse, pathId} from '../http/validate.js';
import {notFound, unauthorized, ApiError} from '../http/errors.js';
import {Public, cookieName, type AuthedRequest} from './auth.guard.js';
import {SessionService, WEB_SESSION_MS} from './session.service.js';
import {dummyPasswordHash, verifyPassword, PASSWORD_MAX} from './crypto.js';
import {LoginLimiter} from './login-limiter.js';
import {ActorService} from '../authz/actor.service.js';

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(PASSWORD_MAX),
    transport: z.enum(['web', 'native']).default('web'),
  })
  .strict();

export function clientAddress(req: AuthedRequest, config: AppConfig): string {
  if (config.TRUST_PROXY) {
    const xff = req.headers['x-forwarded-for'];
    const last = typeof xff === 'string' ? xff.split(',').at(-1)?.trim() : undefined;
    if (last) return last;
  }
  return req.socket.remoteAddress ?? 'desconhecido';
}

@Controller()
export class AuthController {
  private readonly limiter: LoginLimiter;

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(ActorService) private readonly actors: ActorService,
  ) {
    this.limiter = new LoginLimiter(() => this.clock.now().getTime());
  }

  private setCookie(res: Response, token: string) {
    res.cookie(cookieName(this.config), token, {
      httpOnly: true,
      secure: this.config.COOKIE_SECURE,
      sameSite: 'lax',
      path: '/',
      maxAge: WEB_SESSION_MS,
    });
  }

  @Public()
  @Post('auth/login')
  @HttpCode(200)
  async login(@Req() req: AuthedRequest, @Res({passthrough: true}) res: Response, @Body() body: unknown) {
    const input = parse(loginSchema, body);
    // Navegador de outra origem não abre sessão aqui (entrar à força na conta de outra pessoa).
    const origin = req.headers.origin;
    if (origin && !this.config.ALLOWED_ORIGINS.includes(origin))
      throw new ApiError(403, 'origem_recusada', 'Origem do pedido não permitida.');
    const address = clientAddress(req, this.config);
    const blocked = this.limiter.blocked(input.email, address);
    if (blocked)
      throw new ApiError(
        429,
        'muitas_tentativas',
        'Muitas tentativas. Aguarde 15 minutos ou recupere o acesso.',
      );
    const found = await this.pool.query(
      `select p.id, c.secret from verified_contact v
         join person p on p.id = v.person_id
         join auth_credential c on c.person_id = p.id and c.kind = 'password'
        where v.kind = 'email' and v.value = $1 and v.verified_at is not null`,
      [input.email],
    );
    const row = found.rows[0];
    const ok = await verifyPassword(row?.secret ?? (await dummyPasswordHash()), input.password);
    if (!row || !ok) {
      this.limiter.failed(input.email, address);
      throw unauthorized('credenciais_invalidas', 'E-mail ou senha incorretos.');
    }
    this.limiter.succeeded(input.email);
    const ua = req.headers['user-agent'];
    if (input.transport === 'native') {
      const s = await this.sessions.createNative(row.id, ua);
      return {
        transport: 'native',
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        accessExpiresAt: s.accessExpiresAt,
      };
    }
    const s = await this.sessions.createWeb(row.id, ua);
    this.setCookie(res, s.sessionToken);
    // O token CSRF vai no corpo (o JS guarda em memória); o cookie de sessão é HttpOnly — o JS nunca o vê.
    return {transport: 'web', csrfToken: s.csrfToken};
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(200)
  async refresh(@Body() body: unknown) {
    const {refreshToken} = parse(z.object({refreshToken: z.string().min(20).max(200)}).strict(), body);
    const r = await this.sessions.refresh(refreshToken);
    if (r.status === 'reuso') throw unauthorized('sessao_revogada', 'Por segurança, entre de novo.');
    if (r.status !== 'ok') throw unauthorized();
    return {accessToken: r.accessToken, refreshToken: r.refreshToken, accessExpiresAt: r.accessExpiresAt};
  }

  @Post('auth/logout')
  @HttpCode(200)
  async logout(@Req() req: AuthedRequest, @Res({passthrough: true}) res: Response) {
    await this.sessions.revoke(req.session!.id, req.session!.personId, 'saida');
    res.clearCookie(cookieName(this.config), {path: '/'});
    return {ok: true};
  }

  @Get('auth/sessions')
  async listSessions(@Req() req: AuthedRequest) {
    const list = await this.sessions.list(req.session!.personId);
    return {sessions: list.map((s) => ({...s, current: s.id === req.session!.id}))};
  }

  @Delete('auth/sessions/:id')
  @HttpCode(200)
  async revokeOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    if (!(await this.sessions.revoke(pathId(id), req.session!.personId, 'encerrada_pelo_titular')))
      throw notFound();
    return {ok: true};
  }

  @Delete('auth/sessions')
  @HttpCode(200)
  async revokeAll(@Req() req: AuthedRequest, @Res({passthrough: true}) res: Response) {
    const count = await this.sessions.revokeAll(req.session!.personId, 'todas_encerradas_pelo_titular');
    res.clearCookie(cookieName(this.config), {path: '/'});
    return {revoked: count};
  }

  /** Quem sou eu + os condomínios onde tenho vínculo (sem dados de outras pessoas). */
  @Get('me')
  async me(@Req() req: AuthedRequest) {
    const personId = req.session!.personId;
    const p = await this.pool.query(`select id, display_name, preferred_language from person where id = $1`, [
      personId,
    ]);
    const ids = await this.actors.condominiumsOf(personId);
    const condominiums = [];
    for (const id of ids) {
      const c = await withCondominium(this.pool, id, (client) =>
        client.query(`select id, name, environment from condominium where id = $1`, [id]),
      );
      if (c.rows[0]) condominiums.push({id, name: c.rows[0].name, environment: c.rows[0].environment});
    }
    return {
      person: {
        id: p.rows[0].id,
        displayName: p.rows[0].display_name,
        preferredLanguage: p.rows[0].preferred_language,
      },
      mfa: !!req.session!.mfaAt,
      condominiums,
    };
  }
}
