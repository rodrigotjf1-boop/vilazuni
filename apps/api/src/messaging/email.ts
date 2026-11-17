import {SESv2Client, SendEmailCommand} from '@aws-sdk/client-sesv2';
import type {Pool} from 'pg';
import type {AppConfig} from '../config.js';

/**
 * Envio de e-mail por adaptador (ADR-0008), com o modo à vista:
 * - `disabled`: não há envio (quem depende dele responde "envio indisponível");
 * - `demo`: nada sai — o e-mail vai para a caixa da demonstração (tabela `demo_mailbox`); produção recusa;
 * - `sandbox`/`live`: Amazon SES (conta da DMS, decisão do dono — ADR-0011). Credenciais pelas variáveis padrão
 *   da AWS no servidor, nunca no banco nem no código.
 */
export interface EmailMessage {
  outboxId: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  mode: 'demo' | 'sandbox' | 'live';
  /** remetente quando o condomínio não configurou o seu (só na demonstração) */
  fallbackFrom: string | null;
  send(message: EmailMessage): Promise<{providerRef: string | null}>;
}

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');
export const DEMO_FROM = 'nao-responda@demo.vilazuni.test';

export function createEmailSender(config: AppConfig, pool: Pool): EmailSender | null {
  const mode = config.MESSAGING_MODE;
  if (mode === 'disabled') return null;
  if (mode === 'demo')
    return {
      mode,
      fallbackFrom: DEMO_FROM,
      async send(m) {
        // idempotente pelo id da fila: reprocessar não duplica a mensagem na caixa
        await pool.query(
          `insert into demo_mailbox (outbox_id, to_address, subject, body_text) values ($1, $2, $3, $4)
           on conflict (outbox_id) do nothing`,
          [m.outboxId, m.to, m.subject, m.text],
        );
        return {providerRef: 'demo'};
      },
    };
  const client = new SESv2Client({region: config.SES_REGION});
  return {
    mode,
    fallbackFrom: null,
    async send(m) {
      const r = await client.send(
        new SendEmailCommand({
          FromEmailAddress: m.from,
          Destination: {ToAddresses: [m.to]},
          Content: {
            Simple: {
              Subject: {Data: m.subject, Charset: 'UTF-8'},
              Body: {Text: {Data: m.text, Charset: 'UTF-8'}},
            },
          },
        }),
      );
      return {providerRef: r.MessageId ?? null};
    },
  };
}
