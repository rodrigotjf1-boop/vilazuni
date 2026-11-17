import {randomBytes} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {loadConfig} from '../src/config.js';
import {Vault} from '../src/crypto/vault.js';

// Cofre de campo (ADR-0007): envelope com XChaCha20-Poly1305; a chave-mestra só no ambiente.
const key = () => randomBytes(32).toString('base64');
const vault = (keys: string) =>
  new Vault(loadConfig({DATABASE_URL: 'postgres://x', VILAZUNI_MASTER_KEYS: keys}));

describe('cofre', () => {
  it('abre só com o mesmo contexto: o segredo de uma pessoa não serve para outra', () => {
    const v = vault(`k1:${key()}`);
    const blob = v.seal('JBSWY3DPEHPK3PXP', 'totp:pessoa-a');
    expect(blob.startsWith('v1.k1.')).toBe(true);
    expect(blob).not.toContain('JBSWY3DPEHPK3PXP');
    expect(v.open(blob, 'totp:pessoa-a')).toBe('JBSWY3DPEHPK3PXP');
    expect(() => v.open(blob, 'totp:pessoa-b')).toThrow();
  });

  it('cada gravação tem nonce e chave de dados próprios', () => {
    const v = vault(`k1:${key()}`);
    expect(v.seal('mesmo valor', 'c')).not.toBe(v.seal('mesmo valor', 'c'));
  });

  it('rotação: a chave nova cifra; a antiga continua abrindo o que já existia', () => {
    const antiga = key();
    const blobAntigo = vault(`k1:${antiga}`).seal('segredo', 'c');
    const rodado = vault(`k2:${key()},k1:${antiga}`);
    expect(rodado.open(blobAntigo, 'c')).toBe('segredo');
    expect(rodado.seal('novo', 'c').startsWith('v1.k2.')).toBe(true);
  });

  it('outra chave-mestra não abre; texto adulterado também não', () => {
    const v = vault(`k1:${key()}`);
    const blob = v.seal('segredo', 'c');
    expect(() => vault(`k1:${key()}`).open(blob, 'c')).toThrow();
    const partes = blob.split('.');
    const box = Buffer.from(partes[3]!, 'base64url');
    box[box.length - 1]! ^= 1;
    partes[3] = box.toString('base64url');
    expect(() => v.open(partes.join('.'), 'c')).toThrow();
  });

  it('sem chave-mestra: recusa com "configuração pendente" (503), nunca grava em claro', () => {
    const v = vault('');
    expect(v.ready).toBe(false);
    expect(() => v.seal('segredo', 'c')).toThrow(/configuração pendente/);
  });

  it('configuração: chave fora do formato e falta de chave fora da demonstração são recusadas', () => {
    expect(() => loadConfig({DATABASE_URL: 'postgres://x', VILAZUNI_MASTER_KEYS: 'k1:curta'})).toThrow(
      /32 bytes/,
    );
    expect(() => loadConfig({DATABASE_URL: 'postgres://x', VILAZUNI_ENV: 'sandbox'})).toThrow(/chave-mestra/);
  });
});
