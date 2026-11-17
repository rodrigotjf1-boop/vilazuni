import {z} from 'zod';

/**
 * Configuração lida do ambiente e validada NA PARTIDA: valor faltando ou inválido derruba a subida com a lista
 * do que falta (sem mostrar valores). Segredos nunca têm valor padrão.
 */
export const ADAPTER_MODES = ['disabled', 'demo', 'sandbox', 'live'] as const;
export type AdapterMode = (typeof ADAPTER_MODES)[number];

const schema = z
  .object({
    VILAZUNI_ENV: z.enum(['demo', 'sandbox', 'production']).default('demo'),
    PORT: z.coerce.number().int().min(0).max(65535).default(3100),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
    /** origens web permitidas (separadas por vírgula); nunca "*" com credenciais */
    ALLOWED_ORIGINS: z
      .string()
      .default('')
      .transform((s) =>
        s
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
      ),
    BILLING_MODE: z.enum(ADAPTER_MODES).default('disabled'),
    MESSAGING_MODE: z.enum(ADAPTER_MODES).default('disabled'),
    AI_MODE: z.enum(ADAPTER_MODES).default('disabled'),
    ACCESS_CONTROLLER_MODE: z.enum(ADAPTER_MODES).default('disabled'),
    /** cookie com Secure + prefixo __Host-; "false" só em HTTP local de teste (produção recusa) */
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    /** atrás do proxy do Easypanel: o endereço do cliente vem do X-Forwarded-For (último salto confiável) */
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    /**
     * Chaves-mestras do cofre (ADR-0007), "id:base64" separadas por vírgula; a PRIMEIRA cifra, as demais só abrem
     * (rotação). Cada uma tem 32 bytes. Nunca no banco nem no repositório.
     */
    VILAZUNI_MASTER_KEYS: z
      .string()
      .default('')
      .transform((s, ctx) => {
        const keys: {id: string; key: Uint8Array}[] = [];
        for (const part of s
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)) {
          const sep = part.indexOf(':');
          const id = part.slice(0, sep);
          const key = Buffer.from(part.slice(sep + 1), 'base64');
          if (sep < 1 || !/^[a-z0-9]{1,16}$/.test(id) || key.length !== 32) {
            ctx.addIssue({code: 'custom', message: 'Cada chave é "id:base64" com 32 bytes (id em a-z0-9).'});
            return [];
          }
          if (keys.some((k) => k.id === id)) {
            ctx.addIssue({code: 'custom', message: `Id de chave repetido: ${id}.`});
            return [];
          }
          keys.push({id, key: new Uint8Array(key)});
        }
        return keys;
      }),
    /** região do Amazon SES (envio de e-mail no modo sandbox/live; credenciais pelas variáveis padrão da AWS) */
    SES_REGION: z
      .string()
      .regex(/^[a-z]{2}-[a-z]+-\d$/)
      .default('sa-east-1'),
    /** a cada quantos ms a fila de saída é despachada; 0 desliga (testes chamam o despachante direto) */
    OUTBOX_INTERVAL_MS: z.coerce.number().int().min(0).max(600_000).default(5000),
    /** caixa de e-mail da demonstração por rota (só demonstração + envio em modo demo; usada nos testes de tela) */
    DEMO_MAILBOX_ROUTE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .superRefine((env, ctx) => {
    if (env.ALLOWED_ORIGINS.includes('*'))
      ctx.addIssue({code: 'custom', path: ['ALLOWED_ORIGINS'], message: 'Origem curinga não é permitida.'});
    if (env.DEMO_MAILBOX_ROUTE && (env.VILAZUNI_ENV !== 'demo' || env.MESSAGING_MODE !== 'demo'))
      ctx.addIssue({
        code: 'custom',
        path: ['DEMO_MAILBOX_ROUTE'],
        message: 'A caixa da demonstração só existe em demonstração com envio em modo demo.',
      });
    if (env.VILAZUNI_ENV !== 'demo' && env.VILAZUNI_MASTER_KEYS.length === 0)
      ctx.addIssue({
        code: 'custom',
        path: ['VILAZUNI_MASTER_KEYS'],
        message: 'Fora da demonstração o cofre precisa de chave-mestra.',
      });
    if (env.VILAZUNI_ENV === 'production' && !env.COOKIE_SECURE)
      ctx.addIssue({code: 'custom', path: ['COOKIE_SECURE'], message: 'Produção exige cookie seguro.'});
    if (env.VILAZUNI_ENV === 'production') {
      for (const key of ['BILLING_MODE', 'MESSAGING_MODE', 'AI_MODE', 'ACCESS_CONTROLLER_MODE'] as const)
        if (env[key] === 'demo')
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'Produção não aceita adaptador de demonstração (ADR-0008).',
          });
    }
  });

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(source: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `${i.path.join('.') || 'config'}: ${i.message}`)
      .join('; ');
    throw new Error(`Configuração inválida — ${problems}`);
  }
  return parsed.data;
}

export const CONFIG = Symbol('CONFIG');
