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
  })
  .superRefine((env, ctx) => {
    if (env.ALLOWED_ORIGINS.includes('*'))
      ctx.addIssue({code: 'custom', path: ['ALLOWED_ORIGINS'], message: 'Origem curinga não é permitida.'});
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
