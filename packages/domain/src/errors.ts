/**
 * Erro de regra de negócio, com código estável (para a API e para a tela traduzirem) e detalhe opcional.
 * Nunca carrega dado pessoal nem segredo.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

/** Resultado que pode estar pendente por falta de dado (diferente de zero confirmado). */
export type Pending = {status: 'pendente'; missing: string[]};
export type Ok<T> = {status: 'ok'; value: T};
export type MaybePending<T> = Ok<T> | Pending;

export const ok = <T>(value: T): Ok<T> => ({status: 'ok', value});
export const pending = (missing: string[]): Pending => ({status: 'pendente', missing});
export const isPending = <T>(r: MaybePending<T>): r is Pending => r.status === 'pendente';
