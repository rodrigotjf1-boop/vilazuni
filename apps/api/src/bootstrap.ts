import 'reflect-metadata';
import {randomUUID} from 'node:crypto';
import {NestFactory} from '@nestjs/core';
import type {INestApplication} from '@nestjs/common';
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
  options: {quiet?: boolean} = {},
): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(config, overrides), {
    logger: options.quiet ? false : ['error', 'warn', 'log'],
    bodyParser: true,
    rawBody: false,
  });
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
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
  app.enableShutdownHooks();
  return app;
}
