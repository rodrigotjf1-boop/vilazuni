import {Inject, Injectable, type OnApplicationBootstrap, type OnApplicationShutdown} from '@nestjs/common';
import type {Pool, PoolClient} from 'pg';
import {CONFIG, type AppConfig} from '../config.js';
import {DB_POOL} from '../db/database.js';
import {CLOCK, type Clock} from '../clock.js';
import {uuidv7, withCondominium} from '../db/tenant.js';
import {EMAIL_SENDER, type EmailSender} from './email.js';
import {render, type TemplateName, type VerificationParams} from './templates.js';

/**
 * Fila de saída (ADR-0006, revisto no ADR-0012): a transação de negócio grava o "a enviar" junto com a mudança;
 * o envio sai DEPOIS, pelo despachante. Linha travada com SKIP LOCKED (dois processos nunca pegam a mesma),
 * tentativas com espera crescente, e o conteúdo sensível (o código) sai do registro quando o envio termina.
 */
export const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;
const BATCH = 10;

export interface EmailEnqueue {
  condominiumId: string;
  idempotencyKey: string;
  to: string;
  lang: string;
  template: TemplateName;
  params: VerificationParams;
}

/** Na MESMA transação da mudança. Repetir a mesma chave não cria segundo envio. */
export async function enqueueEmail(client: PoolClient, e: EmailEnqueue, now: Date): Promise<string> {
  const id = uuidv7(now.getTime());
  const r = await client.query(
    `insert into outbox_event (id, condominium_id, kind, idempotency_key, payload, available_at)
     values ($1, $2, 'email', $3, $4, $5)
     on conflict (idempotency_key) do nothing returning id`,
    [id, e.condominiumId, e.idempotencyKey, JSON.stringify({to: e.to, lang: e.lang, template: e.template, params: e.params}), now],
  );
  return r.rows[0]?.id ?? id;
}

const mask = (email: string) => {
  const [user = '', domain = ''] = email.split('@');
  return `${user.slice(0, 1)}***@${domain}`;
};
const backoffMs = (attempts: number) => Math.min(30_000 * 2 ** (attempts - 1), 30 * 60_000);

type Row = {id: string; condominium_id: string | null; payload: Record<string, any>; attempts: number};

/** Um ciclo do despachante: pega o que venceu, envia, registra. Devolve quantos tratou. */
export async function dispatchDue(pool: Pool, sender: EmailSender | null, now: Date): Promise<number> {
  const claimed = await pool.query<Row>(
    `update outbox_event set status = 'sending', locked_until = $2, attempts = attempts + 1
      where id in (
        select id from outbox_event
         where (status = 'pending' and available_at <= $1) or (status = 'sending' and locked_until < $1)
         order by available_at limit ${BATCH}
         for update skip locked)
      returning id, condominium_id, payload, attempts`,
    [now, new Date(now.getTime() + LOCK_MS)],
  );
  for (const ev of claimed.rows) await deliver(pool, sender, ev, now);
  return claimed.rowCount ?? 0;
}

async function deliver(pool: Pool, sender: EmailSender | null, ev: Row, now: Date) {
  const done = (status: string, fields: {error?: string | null; providerRef?: string | null; available?: Date}) =>
    pool.query(
      `update outbox_event set status = $2, last_error = $3, provider_ref = coalesce($4, provider_ref),
              available_at = coalesce($5, available_at), locked_until = null,
              sent_at = case when $2 = 'sent' then $6 else sent_at end,
              -- enviado ou desistido: o código e o texto saem do registro; fica só o necessário para conferir
              payload = case when $2 in ('sent','dead','skipped')
                             then jsonb_build_object('to', $7::text, 'template', payload->>'template', 'lang', payload->>'lang')
                             else payload end
        where id = $1`,
      [ev.id, status, fields.error ?? null, fields.providerRef ?? null, fields.available ?? null, now, mask(String(ev.payload.to))],
    );
  if (!sender) return done('skipped', {error: 'envio de e-mail não configurado'});
  try {
    const condo = ev.condominium_id
      ? await withCondominium(pool, ev.condominium_id, (c) =>
          c.query(`select name, email_sender from condominium where id = $1`, [ev.condominium_id]),
        )
      : null;
    const from = condo?.rows[0]?.email_sender ?? sender.fallbackFrom;
    if (!from) return done('dead', {error: 'remetente do condomínio não configurado'});
    const {subject, text} = render(ev.payload.template, ev.payload.lang, ev.payload.params);
    const result = await sender.send({outboxId: ev.id, from, to: ev.payload.to, subject, text});
    return done('sent', {providerRef: result.providerRef});
  } catch (error) {
    // sem dado pessoal no erro guardado: só o tipo e a mensagem curta do provedor
    const message = (error instanceof Error ? `${error.name}: ${error.message}` : 'falha no envio').slice(0, 300);
    if (ev.attempts >= MAX_ATTEMPTS) return done('dead', {error: message});
    return done('pending', {error: message, available: new Date(now.getTime() + backoffMs(ev.attempts))});
  }
}

/** Despacha de tempos em tempos dentro da API (piloto com uma instância; o SKIP LOCKED já aguenta várias). */
@Injectable()
export class OutboxRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(EMAIL_SENDER) private readonly sender: EmailSender | null,
  ) {}

  onApplicationBootstrap() {
    if (!this.config.OUTBOX_INTERVAL_MS) return;
    this.timer = setInterval(() => void this.tick(), this.config.OUTBOX_INTERVAL_MS);
    this.timer.unref();
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      while ((await dispatchDue(this.pool, this.sender, this.clock.now())) > 0) {
        /* esvazia o que venceu */
      }
    } catch (error) {
      console.error(JSON.stringify({nivel: 'erro', rotina: 'fila de saída', erro: error instanceof Error ? error.message : String(error)}));
    } finally {
      this.running = false;
    }
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}
