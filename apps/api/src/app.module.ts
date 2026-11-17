import {Module, type DynamicModule, type OnApplicationShutdown, Inject} from '@nestjs/common';
import {APP_FILTER, APP_GUARD} from '@nestjs/core';
import type {Pool} from 'pg';
import {CONFIG, type AppConfig} from './config.js';
import {DB_POOL, createPool} from './db/database.js';
import {CLOCK, systemClock, type Clock} from './clock.js';
import {HealthController} from './health/health.controller.js';
import {ErrorFilter} from './http/errors.js';
import {AuthGuard} from './auth/auth.guard.js';
import {SessionService} from './auth/session.service.js';
import {AuthController} from './auth/auth.controller.js';
import {ActorService} from './authz/actor.service.js';
import {InvitationsController} from './invitations/invitations.controller.js';
import {OwnershipController} from './ownership/ownership.controller.js';
import {UnitsController} from './units/units.controller.js';
import {MfaController} from './auth/mfa.controller.js';
import {GovernanceController} from './governance/governance.controller.js';
import {VAULT, Vault} from './crypto/vault.js';
import {AccessController} from './authz/access.controller.js';

/** Fecha o pool do banco quando a aplicação para. */
class PoolCloser implements OnApplicationShutdown {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}
  async onApplicationShutdown() {
    await this.pool.end();
  }
}

export interface AppOverrides {
  pool?: Pool;
  /** testes trocam o relógio (janelas, validade de convite e sessão pelo "agora" do servidor) */
  clock?: Clock;
}

@Module({})
export class AppModule {
  /** Módulo raiz montado com a configuração já validada (testes injetam a sua). */
  static forRoot(config: AppConfig, overrides: AppOverrides = {}): DynamicModule {
    return {
      module: AppModule,
      controllers: [
        HealthController,
        AuthController,
        InvitationsController,
        OwnershipController,
        UnitsController,
        MfaController,
        GovernanceController,
        AccessController,
      ],
      providers: [
        {provide: CONFIG, useValue: config},
        {provide: DB_POOL, useValue: overrides.pool ?? createPool(config)},
        {provide: CLOCK, useValue: overrides.clock ?? systemClock},
        PoolCloser,
        SessionService,
        ActorService,
        {provide: VAULT, useClass: Vault},
        // Toda rota exige sessão, salvo as marcadas com @Public() (negar por padrão).
        {provide: APP_GUARD, useClass: AuthGuard},
        {provide: APP_FILTER, useClass: ErrorFilter},
      ],
    };
  }
}
