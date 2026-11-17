import {Inject, Injectable} from '@nestjs/common';
import {randomBytes} from 'node:crypto';
import {xchacha20poly1305} from '@noble/ciphers/chacha.js';
import {CONFIG, type AppConfig} from '../config.js';
import {ApiError} from '../http/errors.js';

/**
 * Cofre de campo (ADR-0007): AEAD XChaCha20-Poly1305 com ENVELOPE — cada valor tem a sua chave de dados, embrulhada
 * pela chave-mestra (que vive só no ambiente). O `context` (ex.: "totp:<pessoa>") entra como dado associado:
 * o texto cifrado de uma linha não abre noutra.
 *
 * Formato guardado: `v1.<id da chave>.<chave de dados embrulhada>.<valor cifrado>` (base64url; nonce na frente).
 */
export const VAULT = Symbol('VAULT');

const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64url');
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64url'));
const enc = (s: string) => new TextEncoder().encode(s);

function seal(key: Uint8Array, plain: Uint8Array, aad: Uint8Array): Uint8Array {
  const nonce = new Uint8Array(randomBytes(24));
  const ct = xchacha20poly1305(key, nonce, aad).encrypt(plain);
  const out = new Uint8Array(24 + ct.length);
  out.set(nonce);
  out.set(ct, 24);
  return out;
}

function open(key: Uint8Array, box: Uint8Array, aad: Uint8Array): Uint8Array {
  return xchacha20poly1305(key, box.subarray(0, 24), aad).decrypt(box.subarray(24));
}

@Injectable()
export class Vault {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  private unavailable() {
    return new ApiError(
      503,
      'cofre_indisponivel',
      'Recurso indisponível: configuração pendente do servidor.',
    );
  }

  get ready(): boolean {
    return this.config.VILAZUNI_MASTER_KEYS.length > 0;
  }

  seal(value: string, context: string): string {
    const master = this.config.VILAZUNI_MASTER_KEYS[0];
    if (!master) throw this.unavailable();
    const dataKey = new Uint8Array(randomBytes(32));
    const wrapped = seal(master.key, dataKey, enc(`vz-dek:${master.id}`));
    const box = seal(dataKey, enc(value), enc(context));
    dataKey.fill(0);
    return `v1.${master.id}.${b64(wrapped)}.${b64(box)}`;
  }

  open(stored: string, context: string): string {
    const [version, id, wrapped, box] = stored.split('.');
    const master = this.config.VILAZUNI_MASTER_KEYS.find((k) => k.id === id);
    if (version !== 'v1' || !master || !wrapped || !box) throw this.unavailable();
    const dataKey = open(master.key, unb64(wrapped), enc(`vz-dek:${master.id}`));
    try {
      return new TextDecoder().decode(open(dataKey, unb64(box), enc(context)));
    } finally {
      dataKey.fill(0);
    }
  }
}
