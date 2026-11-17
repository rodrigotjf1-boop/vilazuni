import {CanActivate, ExecutionContext, Inject, Injectable, SetMetadata} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import type {Request} from 'express';
import {CONFIG, type AppConfig} from '../config.js';
import {SessionService, type Session} from './session.service.js';
import {sameHash, sha256} from './crypto.js';
import {forbidden, unauthorized} from '../http/errors.js';

export const PUBLIC_ROUTE = 'vz:public';
/** Rota sem sessão (entrar, convite, saúde). Webhooks terão autenticação própria do provedor. */
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

export const cookieName = (config: AppConfig) => (config.COOKIE_SECURE ? '__Host-vz_sess' : 'vz_sess');

export type AuthedRequest = Request & {session?: Session; correlationId?: string};

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Valor de UM cookie do cabeçalho (o token é base64url: nada a decodificar; valor estranho = sem cookie). */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header || header.length > 8192) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      const value = part.slice(eq + 1).trim();
      return /^[A-Za-z0-9_-]{20,200}$/.test(value) ? value : undefined;
    }
  }
  return undefined;
}

/**
 * Guarda global (ADR-0003):
 * - com o COOKIE de sessão, o pedido é de navegador: método que muda estado exige token CSRF válido E `Origin`
 *   na lista permitida — nenhum cabeçalho "sou o app" desliga isso (T56);
 * - sem cookie, `Authorization: Bearer` é o transporte nativo (access curto);
 * - a sessão é relida no banco a cada pedido (revogação e expiração valem na hora).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const cookieToken = readCookie(req.headers.cookie, cookieName(this.config));

    if (cookieToken) {
      const session = await this.sessions.authenticate(cookieToken, 'web');
      if (!session) throw unauthorized();
      if (!SAFE.has(req.method)) {
        const origin = req.headers.origin;
        if (!origin || !this.config.ALLOWED_ORIGINS.includes(origin))
          throw forbidden('origem_recusada', 'Origem do pedido não permitida.');
        const csrf = req.headers['x-csrf-token'];
        if (typeof csrf !== 'string' || !sameHash(session.csrfHash, sha256(csrf)))
          throw forbidden('csrf_invalido', 'Pedido sem a proteção esperada. Recarregue a página.');
      }
      req.session = session;
      return true;
    }

    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      const session = await this.sessions.authenticate(auth.slice(7).trim(), 'native');
      if (!session) throw unauthorized();
      req.session = session;
      return true;
    }
    throw unauthorized();
  }
}
