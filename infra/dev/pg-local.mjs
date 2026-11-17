// Banco Postgres LOCAL do Vilazuni v1, só para desenvolvimento e testes neste PC.
// Cria um cluster próprio em .pgdata/ (ignorado pelo git), na porta 55432, sem mexer em outros bancos do PC
// nem precisar de administrador. Uso:  node infra/dev/pg-local.mjs start | stop | status
// PG_BIN aponta para os executáveis (padrão: C:\Program Files\PostgreSQL\18\bin).
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = path.join(root, '.pgdata', 'cluster');
const logFile = path.join(root, '.pgdata', 'postgres.log');
const port = process.env.VZ_PG_PORT || '55432';
const bin = process.env.PG_BIN || 'C:\\Program Files\\PostgreSQL\\18\\bin';
const exe = (name) => path.join(bin, process.platform === 'win32' ? `${name}.exe` : name);
const command = process.argv[2] || 'status';

function run(name, args, opts = {}) {
  return execFileSync(exe(name), args, {stdio: opts.quiet ? 'pipe' : 'inherit', encoding: 'utf8'});
}

if (command === 'start') {
  if (!existsSync(path.join(dataDir, 'PG_VERSION'))) {
    mkdirSync(dataDir, {recursive: true});
    // Só conexões locais, por senha não exigida para o superusuário local deste cluster de desenvolvimento.
    run('initdb', ['-D', dataDir, '-U', 'postgres', '--auth-local=trust', '--auth-host=trust', '-E', 'UTF8', '--no-locale'], {quiet: true});
    writeFileSync(path.join(dataDir, 'postgresql.auto.conf'), `listen_addresses = '127.0.0.1'\nport = ${port}\n`);
    console.log(`Cluster criado em ${dataDir}`);
  }
  const status = spawnSync(exe('pg_ctl'), ['-D', dataDir, 'status'], {encoding: 'utf8'});
  if (status.status !== 0) {
    // stdio 'ignore': o processo do Postgres herdaria a saída e a chamada ficaria esperando para sempre.
    const started = spawnSync(exe('pg_ctl'), ['-D', dataDir, '-l', logFile, '-w', 'start'], {stdio: 'ignore'});
    if (started.status !== 0) {
      console.error(`Postgres não subiu; veja ${logFile}`);
      process.exit(1);
    }
  }
  console.log(`Postgres local no ar: 127.0.0.1:${port} (superusuário postgres, só local).`);
} else if (command === 'stop') {
  run('pg_ctl', ['-D', dataDir, '-w', 'stop'], {quiet: true});
  console.log('Postgres local parado.');
} else {
  const status = spawnSync(exe('pg_ctl'), ['-D', dataDir, 'status'], {encoding: 'utf8'});
  console.log(status.status === 0 ? `No ar na porta ${port}.` : 'Parado (ou ainda não criado).');
}
