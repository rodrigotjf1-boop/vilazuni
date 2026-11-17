import type {z} from 'zod';
import {badRequest, notFound} from './errors.js';

/**
 * Valida o corpo com esquema ESTRITO: campo desconhecido é recusado (ex.: `role: "syndic"` no autocadastro — T01).
 * A mensagem diz o campo, sem ecoar o valor enviado.
 */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input ?? {});
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const field = issue?.path.join('.') || 'corpo';
  if (issue?.code === 'unrecognized_keys')
    throw badRequest(
      'campo_nao_permitido',
      `Campo não permitido: ${(issue as {keys?: string[]}).keys?.join(', ')}.`,
    );
  throw badRequest('dados_invalidos', `Confira o campo "${field}".`);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id do caminho fora do formato responde como "não existe" (nunca chega ao banco como erro 500). */
export function pathId(value: string): string {
  if (!UUID.test(value)) throw notFound();
  return value;
}
