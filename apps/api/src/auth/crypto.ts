import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {hash, verify} from '@node-rs/argon2';

/** Token opaco de 256 bits (base64url). No banco vai só o SHA-256. */
export const newToken = (): string => randomBytes(32).toString('base64url');
export const sha256 = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

/**
 * Token CSRF da sessão web DERIVADO do token de sessão (que é secreto e só o cookie HttpOnly carrega): a tela
 * recupera o mesmo token depois de recarregar (`GET /auth/csrf`) e todas as abas usam o mesmo — sem guardar segredo
 * novo. Quem não tem o cookie não consegue calcular.
 */
export const csrfFor = (sessionToken: string): string =>
  createHash('sha256').update(`vz-csrf:${sessionToken}`, 'utf8').digest('base64url');

export function sameHash(a: Buffer | null | undefined, b: Buffer): boolean {
  return !!a && a.length === b.length && timingSafeEqual(a, b);
}

/** Argon2id com o mínimo da OWASP (m = 19 MiB, t = 2, p = 1). `2` = Argon2id (enum const do pacote). */
const ARGON2ID = {algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1} as const;

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export const hashPassword = (password: string): Promise<string> =>
  hash(password, ARGON2ID as unknown as Parameters<typeof hash>[1]);

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

/** Hash fixo para gastar o mesmo tempo quando a conta não existe (não revela quem tem conta). */
let dummy: Promise<string> | undefined;
export const dummyPasswordHash = (): Promise<string> => (dummy ??= hashPassword('nao-existe-' + newToken()));
