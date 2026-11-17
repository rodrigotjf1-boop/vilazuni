import {Controller, Get, Inject, Query} from '@nestjs/common';
import type {Pool} from 'pg';
import {z} from 'zod';
import {DB_POOL} from '../db/database.js';
import {CONFIG, type AppConfig} from '../config.js';
import {parse} from '../http/validate.js';
import {notFound} from '../http/errors.js';
import {Public} from '../auth/auth.guard.js';

const querySchema = z.object({to: z.string().trim().toLowerCase().email().max(254)}).strict();

/**
 * Caixa de e-mail da DEMONSTRAÇÃO (ADR-0012): com o envio em modo "demo" nada sai do servidor e o e-mail fica na
 * tabela `demo_mailbox`; esta rota o mostra para os testes de tela e para quem demonstra o produto. Só existe com
 * `DEMO_MAILBOX_ROUTE=true`, que a configuração aceita apenas em demonstração com envio em modo demo.
 */
@Controller('demo/mailbox')
export class DemoMailboxController {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Get()
  async list(@Query() query: unknown) {
    if (!this.config.DEMO_MAILBOX_ROUTE || this.config.VILAZUNI_ENV !== 'demo') throw notFound();
    const {to} = parse(querySchema, query);
    const r = await this.pool.query(
      `select subject, body_text, created_at from demo_mailbox where to_address = $1 order by id desc limit 10`,
      [to],
    );
    return {
      messages: r.rows.map((m) => ({subject: m.subject as string, text: m.body_text as string, createdAt: m.created_at})),
    };
  }
}
