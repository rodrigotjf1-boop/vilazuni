import {Controller, Get, HttpCode, HttpException, HttpStatus, Inject} from '@nestjs/common';
import type {Pool} from 'pg';
import {DB_POOL, databaseReady} from '../db/database.js';
import {CONFIG, type AppConfig} from '../config.js';
import {API_VERSION} from '../version.js';
import {Public} from '../auth/auth.guard.js';

/** Saúde (o processo está vivo) e prontidão (o banco responde). Sem dado sensível na resposta. */
@Public()
@Controller()
export class HealthController {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('health')
  health() {
    return {status: 'ok', version: API_VERSION, environment: this.config.VILAZUNI_ENV};
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready() {
    if (!(await databaseReady(this.pool)))
      throw new HttpException({status: 'unavailable', check: 'database'}, HttpStatus.SERVICE_UNAVAILABLE);
    return {status: 'ready'};
  }
}
