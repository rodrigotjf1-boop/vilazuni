import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fixture} from './helpers.mjs';

// Achados A7, A8 e M13 da auditoria: a API tem uma fila única para todos os condomínios. Antes, (1) o corpo
// do pedido era lido DENTRO dela — um envio lento travava todo mundo; (2) avisos anônimos forjados copiavam a
// base inteira antes de conferir a assinatura, sem limite; (3) o n8n regravava a base a cada 30 s mesmo sem
// mensagem nenhuma.

const within = (promise, ms, label) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(Error(label)), ms))]);

test('um envio lento não segura os pedidos dos outros', async () => {
  const f = await fixture();
  const {port, host} = new URL(f.origin);
  const slow = net.connect(Number(port), '127.0.0.1');
  try {
    await new Promise((resolve) => slow.once('connect', resolve));
    // Promete 1000 bytes e manda só 10: o servidor fica esperando o resto.
    slow.write(
      `POST /api/login HTTP/1.1\r\nHost: ${host}\r\nOrigin: ${f.origin}\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n{"email":"`,
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    const response = await within(
      fetch(f.origin + '/api/session'),
      2500,
      'a fila ficou presa no envio lento',
    );
    assert.equal(response.status, 200);
  } finally {
    slow.destroy();
    await f.close();
  }
});

test('aviso anônimo com assinatura errada é recusado, e há teto por minuto', async () => {
  const f = await fixture();
  try {
    const statuses = [];
    for (let i = 0; i < 245; i++) {
      const r = await fetch(f.origin + '/api/physical/plate-event?device=nao-existe', {
        method: 'POST',
        headers: {'x-vilazuni-signature': 'a'.repeat(64)},
        body: JSON.stringify({plate: 'ABC1D23', timestamp: Date.now(), nonce: 'nonce-' + i + '-abcdefghij'}),
      });
      statuses.push(r.status);
      await r.arrayBuffer();
    }
    assert.ok(
      statuses.slice(0, 240).every((s) => s === 403),
      'recusado por assinatura',
    );
    assert.ok(
      statuses.slice(240).every((s) => s === 429),
      'acima do teto por minuto',
    );
  } finally {
    await f.close();
  }
});

test('o n8n consultando a fila vazia não regrava a base', async () => {
  const f = await fixture();
  try {
    const r = await f.request(
      '/automation/save',
      {version: 0, groupJid: '120363000000000000@g.us', enabled: true},
      f.admin.cookie,
    );
    assert.equal(r.status, 200);
    const store = path.join(f.directory, 'store.json'),
      before = (await fs.stat(store)).mtimeMs;
    await new Promise((resolve) => setTimeout(resolve, 30));
    for (let i = 0; i < 3; i++) {
      const claim = await fetch(f.origin + '/api/automation/claim', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'x-vilazuni-token': r.body.token},
        body: '{}',
      });
      assert.deepEqual(await claim.json(), {message: null});
    }
    assert.equal((await fs.stat(store)).mtimeMs, before, 'a base não foi regravada');
  } finally {
    await f.close();
  }
});
