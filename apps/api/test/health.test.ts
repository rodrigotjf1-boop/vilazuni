import 'reflect-metadata';
import {afterEach, describe, expect, it} from 'vitest';
import type {INestApplication} from '@nestjs/common';
import type {Pool} from 'pg';
import {createApp} from '../src/bootstrap.js';
import {loadConfig} from '../src/config.js';

const config = loadConfig({
  DATABASE_URL: 'postgres://nao-usado-neste-teste',
  ALLOWED_ORIGINS: 'https://app.exemplo.test',
});
const pool = (ok: boolean) =>
  ({
    query: async () => {
      if (!ok) throw new Error('banco fora');
      return {rows: [{ok: 1}]};
    },
    end: async () => {},
  }) as unknown as Pool;

let app: INestApplication | undefined;
async function start(dbOk = true) {
  app = await createApp(config, pool(dbOk), {quiet: true});
  await app.listen(0, '127.0.0.1');
  return (await app.getUrl()).replace('[::1]', '127.0.0.1');
}
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('saúde e prontidão', () => {
  it('health responde com a versão e o ambiente', async () => {
    const url = await start();
    const r = await fetch(url + '/api/v1/health');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({status: 'ok', version: '1.0.0-alpha.0', environment: 'demo'});
  });

  it('ready = 200 com o banco respondendo e 503 sem ele', async () => {
    let url = await start(true);
    expect((await fetch(url + '/api/v1/ready')).status).toBe(200);
    await app!.close();
    url = await start(false);
    const r = await fetch(url + '/api/v1/ready');
    expect(r.status).toBe(503);
    expect(JSON.stringify(await r.json())).not.toMatch(/banco fora/); // sem detalhe interno
  });

  it('CORS só libera as origens configuradas', async () => {
    const url = await start();
    const permitida = await fetch(url + '/api/v1/health', {headers: {Origin: 'https://app.exemplo.test'}});
    expect(permitida.headers.get('access-control-allow-origin')).toBe('https://app.exemplo.test');
    const estranha = await fetch(url + '/api/v1/health', {headers: {Origin: 'https://malicioso.test'}});
    expect(estranha.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('cabeçalhos seguros (helmet) presentes', async () => {
    const url = await start();
    const r = await fetch(url + '/api/v1/health');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('x-powered-by')).toBeNull();
  });
});

describe('configuração na partida', () => {
  it('produção recusa adaptador de demonstração (ADR-0008)', () => {
    expect(() =>
      loadConfig({DATABASE_URL: 'postgres://x', VILAZUNI_ENV: 'production', BILLING_MODE: 'demo'}),
    ).toThrow(/Produção não aceita adaptador de demonstração/);
  });

  it('origem curinga é recusada; falta de DATABASE_URL também', () => {
    expect(() => loadConfig({DATABASE_URL: 'postgres://x', ALLOWED_ORIGINS: '*'})).toThrow(/curinga/);
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });
});
