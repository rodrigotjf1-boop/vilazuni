import {spawn, type ChildProcess} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/**
 * Sobe o conjunto inteiro para os testes de ponta a ponta e devolve a rotina que desmonta tudo:
 * 1) banco NOVO no Postgres (local: o cluster do projeto; CI: o serviço do workflow), papéis e migrations;
 * 2) semeadura demonstrativa do Chandra (as senhas geradas vão para os testes pela variável VZ_E2E_CREDS);
 * 3) a API COMPILADA (`apps/api/dist`) e a prévia do app web (`vite preview`, que repassa /api para a API).
 * Requer `npm run build` antes.
 */
const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const apiDist = path.resolve(here, '..', '..', 'api', 'dist');
const webDir = path.resolve(here, '..');
// o Vite não expõe o executável no "exports": acha a pasta do pacote e monta o caminho
const viteBin = path.join(
  path.dirname(require.resolve('vite/package.json', {paths: [webDir]})),
  'bin',
  'vite.js',
);

const API_PORT = Number(process.env.VZ_E2E_API_PORT || 3197);
const WEB_PORT = Number(process.env.VZ_WEB_PORT || 4173);

async function waitFor(url: string, child: ChildProcess, name: string, log: string[]) {
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(`${name} parou ao subir:\n${log.join('')}`);
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${name} não respondeu em ${url}:\n${log.join('')}`);
}

function start(name: string, args: string[], cwd: string, env: Record<string, string>) {
  const log: string[] = [];
  const child = spawn(process.execPath, args, {
    cwd,
    env: {...process.env, ...env},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (d) => log.push(String(d)));
  child.stderr?.on('data', (d) => log.push(String(d)));
  return {child, log};
}

export default async function globalSetup() {
  const {provision, roleUrl, dropDatabase} = require(path.join(apiDist, 'db', 'provision.js'));
  const {migrate} = require(path.join(apiDist, 'db', 'migrate.js'));
  const {seedDemoChandra} = require(path.join(apiDist, 'seed', 'demo-chandra.js'));
  const {Pool} = require('pg');

  const adminUrl = process.env.VZ_TEST_ADMIN_URL || 'postgresql://postgres@127.0.0.1:55432/postgres';
  const database = `vz_e2e_${Date.now()}_${process.pid}`;
  const passwords = {owner: randomBytes(18).toString('hex'), app: randomBytes(18).toString('hex')};
  await provision(adminUrl, database, passwords);
  const ownerPool = new Pool({
    connectionString: roleUrl(adminUrl, database, 'vilazuni_owner', passwords.owner),
    max: 1,
  });
  await migrate(ownerPool);
  await ownerPool.end();
  const appUrl = roleUrl(adminUrl, database, 'vilazuni_app', passwords.app);
  const appPool = new Pool({connectionString: appUrl, max: 2});
  const seed = await seedDemoChandra(appPool, {env: 'demo'});
  const {withCondominium} = require(path.join(apiDist, 'db', 'tenant.js'));
  // A subsindica da base e2e tem consulta de estadias delegada para exercitar a Mesa.
  await withCondominium(appPool, seed.condominiumId, (client: import('pg').PoolClient) =>
    client.query(
      `update delegation set actions = array_append(actions, 'stay.read.all')
        where condominium_id = $1 and 'ownership.validate' = any(actions)`,
      [seed.condominiumId],
    ),
  );
  await appPool.end();
  process.env.VZ_E2E_CREDS = JSON.stringify(seed.credentials);
  process.env.VZ_E2E_API = `http://127.0.0.1:${API_PORT}/api/v1`;

  const api = start('API', [path.join(apiDist, 'main.js')], path.resolve(apiDist, '..'), {
    DATABASE_URL: appUrl,
    VILAZUNI_ENV: 'demo',
    PORT: String(API_PORT),
    ALLOWED_ORIGINS: `http://127.0.0.1:${WEB_PORT}`,
    COOKIE_SECURE: 'false',
    VILAZUNI_MASTER_KEYS: `e2e:${randomBytes(32).toString('base64')}`,
    // e-mail em modo demonstração: nada sai; a caixa da demonstração (rota) entrega o código aos testes
    MESSAGING_MODE: 'demo',
    DEMO_MAILBOX_ROUTE: 'true',
    OUTBOX_INTERVAL_MS: '200',
  });
  await waitFor(`http://127.0.0.1:${API_PORT}/api/v1/ready`, api.child, 'API', api.log);
  const web = start('Prévia do app web', [viteBin, 'preview'], webDir, {
    VZ_API_URL: `http://127.0.0.1:${API_PORT}`,
    VZ_WEB_PORT: String(WEB_PORT),
  });
  await waitFor(`http://127.0.0.1:${WEB_PORT}/`, web.child, 'Prévia do app web', web.log);

  return async () => {
    web.child.kill();
    api.child.kill();
    await new Promise((r) => setTimeout(r, 300));
    await dropDatabase(adminUrl, database);
  };
}
