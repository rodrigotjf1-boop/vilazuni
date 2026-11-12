import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixture} from './helpers.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Pedidos sem login que antes encerravam o processo: `new URL()` falhava fora de qualquer tratamento.
const malformed = [
  'GET http://[::1 HTTP/1.1',
  'GET //[ HTTP/1.1',
  'GET /\\[ HTTP/1.1',
  'GET //[/api/session HTTP/1.1',
];

function rawRequest(port, requestLine) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1', () =>
      socket.write(`${requestLine}\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`),
    );
    let response = '';
    socket.setTimeout(5000, () => {
      socket.destroy();
      resolve('TEMPO ESGOTADO');
    });
    socket.on('data', (chunk) => {
      response += chunk;
    });
    socket.on('end', () => resolve(response));
    socket.on('error', (error) => resolve('ERRO ' + error.code));
  });
}

test('servidor responde 400 a endereço malformado e continua no ar', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vilazuni-url-'));
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: '',
      APP_ORIGIN: '',
      HOST: '127.0.0.1',
      PORT: '0',
      VILAZUNI_DATA_DIR: directory,
    },
  });
  try {
    const origin = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Servidor não ficou pronto.')), 20000);
      child.stdout.on('data', (data) => {
        const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) {
          clearTimeout(timer);
          resolve(match[0]);
        }
      });
      child.on('exit', (code) => reject(Error('Servidor encerrou: ' + code)));
    });
    const port = Number(new URL(origin).port);
    for (const line of malformed) {
      const response = await rawRequest(port, line);
      assert.match(response, /^HTTP\/1\.1 400 /, `${line} → ${response.slice(0, 80)}`);
      assert.equal(child.exitCode, null, `o processo encerrou depois de ${line}`);
    }
    const health = await fetch(origin + '/healthz');
    assert.equal(health.status, 200);
    assert.equal(child.exitCode, null);
  } finally {
    child.kill();
    await new Promise((resolve) => (child.exitCode !== null ? resolve() : child.once('exit', resolve)));
    await fs.rm(directory, {recursive: true, force: true});
  }
});

test('API usada sem o server.mjs também recusa endereço malformado sem lançar exceção', async () => {
  const f = await fixture();
  try {
    const port = Number(new URL(f.origin).port);
    for (const line of malformed) {
      const response = await rawRequest(port, line);
      assert.match(response, /^HTTP\/1\.1 400 /, `${line} → ${response.slice(0, 80)}`);
      assert.match(response, /Endereço inválido/);
    }
    const session = await f.request('/session');
    assert.equal(session.status, 200);
  } finally {
    await f.close();
  }
});
