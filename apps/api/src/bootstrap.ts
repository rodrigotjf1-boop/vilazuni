import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import type {INestApplication} from '@nestjs/common';
import helmet from 'helmet';
import type {Pool} from 'pg';
import {AppModule} from './app.module.js';
import type {AppConfig} from './config.js';

/**
 * Monta a aplicação (sem escutar porta): prefixo /api/v1, cabeçalhos seguros, CORS só para as origens
 * permitidas, corpo limitado e erros sem stack trace para o usuário.
 */
export async function createApp(
  config: AppConfig,
  pool?: Pool,
  options: {quiet?: boolean} = {},
): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(config, pool), {
    logger: options.quiet ? false : ['error', 'warn', 'log'],
    bodyParser: true,
    rawBody: false,
  });
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) =>
      callback(null, !origin || config.ALLOWED_ORIGINS.includes(origin)),
    credentials: true,
  });
  app.enableShutdownHooks();
  return app;
}
