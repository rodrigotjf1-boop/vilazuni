/**
 * Cliente da API na MESMA origem (`/api/v1`). Sessão web = cookie HttpOnly que o JavaScript não vê; aqui só o token
 * CSRF (em memória, recuperável por `GET /auth/csrf`) e o condomínio escolhido nesta aba.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

let csrf: string | null = null;
const CONDO_KEY = 'vz.condominio';

export function setCsrf(token: string | null) {
  csrf = token;
}

export function getCondominium(): string | null {
  try {
    return sessionStorage.getItem(CONDO_KEY);
  } catch {
    return null;
  }
}
export function setCondominium(id: string | null) {
  try {
    if (id) sessionStorage.setItem(CONDO_KEY, id);
    else sessionStorage.removeItem(CONDO_KEY);
  } catch {
    /* sem armazenamento: a escolha vale até recarregar */
  }
}

type Method = 'GET' | 'POST' | 'DELETE';

async function send<T>(
  method: Method,
  path: string,
  body?: unknown,
  decode?: (response: Response) => Promise<T>,
): Promise<T> {
  const headers: Record<string, string> = {accept: 'application/json'};
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart) headers['content-type'] = 'application/json';
  if (method !== 'GET' && csrf) headers['x-csrf-token'] = csrf;
  const condo = getCondominium();
  if (condo) headers['x-condominium-id'] = condo;
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: multipart ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'rede', 'Sem conexão com o servidor.');
  }
  if (response.ok && decode) return decode(response);
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const d = (data ?? {}) as {error?: string; message?: string};
    throw new ApiError(response.status, d.error ?? 'desconhecido', d.message ?? '');
  }
  return data as T;
}

export async function refreshCsrf(): Promise<void> {
  const r = await send<{csrfToken: string}>('GET', '/auth/csrf');
  csrf = r.csrfToken;
}

/** Pedido com a recuperação do token CSRF uma vez (página recarregada ou outra aba entrou). */
export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  if (method !== 'GET' && !csrf) await refreshCsrf().catch(() => undefined);
  try {
    return await send<T>(method, path, body);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'csrf_invalido' && method !== 'GET') {
      await refreshCsrf();
      return send<T>(method, path, body);
    }
    throw error;
  }
}

/** Entrar não tem sessão ainda: sem CSRF; a resposta traz o token desta sessão. */
export async function login(email: string, password: string): Promise<void> {
  const r = await send<{csrfToken: string}>('POST', '/auth/login', {email, password, transport: 'web'});
  csrf = r.csrfToken;
}

export const getFile = (path: string) => send('GET', path, undefined, (response) => response.blob());
export const get = <T>(path: string) => api<T>('GET', path);
export const post = <T>(path: string, body: unknown = {}) => api<T>('POST', path, body);
export const del = <T>(path: string) => api<T>('DELETE', path);
