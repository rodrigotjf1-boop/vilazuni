import 'reflect-metadata';
import {randomUUID} from 'node:crypto';
import {access} from 'node:fs/promises';
import path from 'node:path';
import {NestFactory} from '@nestjs/core';
import type {INestApplication} from '@nestjs/common';
import type {NestExpressApplication} from '@nestjs/platform-express';
import type {NextFunction, Request, Response} from 'express';
import helmet from 'helmet';
import {AppModule, type AppOverrides} from './app.module.js';
import type {AppConfig} from './config.js';

/**
 * Monta a aplicação (sem escutar porta): prefixo /api/v1, cabeçalhos seguros, CORS só para as origens
 * permitidas, corpo limitado, id de correlação em cada pedido e erros sem stack trace para o usuário.
 */
export async function createApp(
  config: AppConfig,
  overrides: AppOverrides = {},
  options: {quiet?: boolean; webDir?: string} = {},
): Promise<INestApplication> {
  const webDir = options.webDir ? path.resolve(options.webDir) : undefined;
  const index = webDir && path.join(webDir, 'index.html');
  if (index) await access(index);
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config, overrides), {
    logger: options.quiet ? false : ['error', 'warn', 'log'],
    bodyParser: true,
    rawBody: false,
  });
  app.setGlobalPrefix('api/v1');
  app.use(helmet({contentSecurityPolicy: {directives: {imgSrc: ["'self'", 'data:', 'blob:']}}}));
  // O id é sempre gerado aqui (nunca aceito do cliente): liga o log local ao erro que o usuário vê.
  app.use((req: Request & {correlationId?: string}, res: Response, next: NextFunction) => {
    req.correlationId = randomUUID();
    res.setHeader('x-correlation-id', req.correlationId);
    next();
  });
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) =>
      callback(null, !origin || config.ALLOWED_ORIGINS.includes(origin)),
    credentials: true,
    exposedHeaders: ['x-correlation-id'],
  });
  if (webDir && index) {
    app.useStaticAssets(path.join(webDir, 'assets'), {
      prefix: '/assets/',
      index: false,
      immutable: true,
      maxAge: '1y',
    });
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (!['GET', 'HEAD'].includes(req.method) || /^\/(api|assets)(\/|$)/i.test(req.path)) return next();
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(index);
    });
  }
  app.enableShutdownHooks();
  return app;
}
