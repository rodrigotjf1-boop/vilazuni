import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {runtimeConfig, clientAddress} from '../runtime-config.mjs';

// Achado M7 da auditoria: o limite de login era só por endereço e contava TODA tentativa — 25 entradas, até
// as certas, de quem divide a mesma rede (Wi-Fi do condomínio, operadora de celular) travavam todos por
// 15 min; e não havia limite por conta (senha testada de vários endereços passava).

async function login(f, email, password, ip) {
  const r = await fetch(f.origin + '/api/login', {
    method: 'POST',
    headers: {
      Origin: f.origin,
      'Content-Type': 'application/json',
      ...(ip ? {'x-vilazuni-client-ip': ip} : {}),
    },
    body: JSON.stringify({email, password}),
  });
  await r.arrayBuffer();
  return r.status;
}

test('login certo não gasta a cota do endereço; senha errada continua limitada por endereço', async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 30; i++)
      assert.equal(await login(f, 'admin@example.test', f.password), 200, 'entrada ' + i);
    // E-mails diferentes, para medir só o limite do endereço (o da conta é outro). A criação da conta
    // inicial do `fixture` já gastou 1 das 25 (criar conta e aceitar convite contam sempre).
    const statuses = [];
    for (let i = 0; i < 25; i++)
      statuses.push(await login(f, `ausente${i}@example.test`, 'Senha-errada-123456'));
    assert.ok(
      statuses.slice(0, 24).every((s) => s === 401),
      statuses.join(','),
    );
    assert.equal(statuses[24], 429);
  } finally {
    await f.close();
  }
});

test('dez senhas erradas travam a conta, venham de onde vierem; as outras contas seguem entrando', async () => {
  const sent = [],
    f = await fixture({
      config: runtimeConfig({TRUST_PROXY: 'true'}),
      mailProvider: {
        async sendReset(email, token) {
          sent.push({email, token});
        },
      },
    });
  try {
    const other = await f.invite('proprietario', {houses: ['c03']});
    for (let i = 0; i < 10; i++)
      assert.equal(await login(f, 'admin@example.test', 'Senha-errada-123456', `203.0.113.${i + 1}`), 401);
    assert.equal(await login(f, 'admin@example.test', 'Senha-errada-123456', '203.0.113.50'), 429);
    assert.equal(
      await login(f, 'admin@example.test', f.password, '203.0.113.51'),
      429,
      'a conta está travada',
    );
    assert.equal(await login(f, other.email, f.password, '203.0.113.51'), 200, 'outra conta entra');
    // E-mail sem conta trava igual, para não revelar quem tem conta.
    for (let i = 0; i < 10; i++)
      assert.equal(await login(f, 'ninguem@example.test', 'Senha-errada-123456', `198.51.100.${i + 1}`), 401);
    assert.equal(await login(f, 'ninguem@example.test', 'Senha-errada-123456', '198.51.100.50'), 429);
    // A recuperação de senha segue aberta e destrava a conta.
    await f.request('/recovery/request', {email: 'admin@example.test'});
    assert.equal(sent.length, 1);
    const fresh = 'Nova-senha-sintetica-para-testes-2026';
    assert.equal((await f.request('/recovery/reset', {token: sent[0].token, password: fresh})).status, 200);
    assert.equal(await login(f, 'admin@example.test', fresh, '203.0.113.52'), 200);
  } finally {
    await f.close();
  }
});

test('a trava da conta passa em 15 minutos, e o login certo zera a contagem', async () => {
  const f = await fixture({config: runtimeConfig({TRUST_PROXY: 'true'})});
  try {
    for (let i = 0; i < 9; i++)
      await login(f, 'admin@example.test', 'Senha-errada-123456', `203.0.113.${i + 1}`);
    assert.equal(await login(f, 'admin@example.test', f.password, '203.0.113.20'), 200);
    for (let i = 0; i < 9; i++)
      assert.equal(await login(f, 'admin@example.test', 'Senha-errada-123456', `203.0.113.${i + 30}`), 401);
    assert.equal(await login(f, 'admin@example.test', 'Senha-errada-123456', '203.0.113.40'), 401);
    assert.equal(await login(f, 'admin@example.test', f.password, '203.0.113.41'), 429);
    f.advance(15 * 60000 + 1000);
    assert.equal(await login(f, 'admin@example.test', f.password, '203.0.113.42'), 200);
  } finally {
    await f.close();
  }
});

test('proxy na rede privada IPv6 (Docker) também é reconhecido', () => {
  const config = {trustProxy: true},
    from = (remoteAddress) =>
      clientAddress({socket: {remoteAddress}, headers: {'x-vilazuni-client-ip': '203.0.113.7'}}, config);
  assert.equal(from('fd12:3456:789a::2'), '203.0.113.7');
  assert.equal(from('fe80::1'), '203.0.113.7');
  assert.equal(from('2001:db8::5'), '2001:db8::5', 'endereço público não é proxy confiável');
  assert.equal(from('fd::1'), 'fd::1', 'fd sem os quatro dígitos não é rede privada');
});
