import {Module, type DynamicModule, type OnApplicationShutdown, Inject} from '@nestjs/common';
import type {Pool} from 'pg';
import {CONFIG, type AppConfig} from './config.js';
import {DB_POOL, createPool} from './db/database.js';
import {HealthController} from './health/health.controller.js';

/** Fecha o pool do banco quando a aplicação para. */
class PoolCloser implements OnApplicationShutdown {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}
  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Module({})
export class AppModule {
  /** Módulo raiz montado com a configuração já validada (testes injetam a sua). */
  static forRoot(config: AppConfig, pool: Pool = createPool(config)): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController],
      providers: [{provide: CONFIG, useValue: config}, {provide: DB_POOL, useValue: pool}, PoolCloser],
    };
  }
}
