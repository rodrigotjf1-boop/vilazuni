import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {seed} from '../domain.mjs';
import {
  saveChannel,
  channelLinkCode,
  channelsView,
  prepareChannel,
  scheduledChannels,
  telegramWebhook,
  claimChannelMessage,
} from '../channels.mjs';
import {fixture} from './helpers.mjs';

// Achado M5 da auditoria: o síndico digitava o identificador do grupo, e qualquer um podia apontar o canal
// para o grupo de outro condomínio (o bot é o mesmo para todos) e mandar os resumos para lá — ou ocupar o
// grupo antes do dono. Agora o canal só vale depois que o código de uso único é postado NO grupo informado.

const now = Date.parse('2026-11-12T10:00:00-03:00'),
  env = {TELEGRAM_WEBHOOK_SECRET: 'segredo-sintetico'},
  gestor = (tenant) => ({id: 'g-' + tenant, name: 'Gestão ' + tenant, tenant, role: 'sindico', active: true}),
  A = gestor('chandra'),
  B = gestor('outro'),
  group = '-1001234567890',
  input = {
    name: 'Grupo sintético',
    chatId: group,
    botName: '@vilazuni_bot',
    dailyAt: '00:00',
    active: true,
    scheduled: true,
    reviewed: true,
    reason: 'Conferência sintética do grupo',
  };
let update = 0;
const post = (state, text, chat = {id: Number(group), type: 'supergroup'}, at = now) =>
  telegramWebhook(state, {update_id: ++update, message: {chat, text}}, env.TELEGRAM_WEBHOOK_SECRET, env, at);

test('sem o código postado no grupo, o canal não agenda, não prepara, não responde e não envia', () => {
  const s = seed(),
    c = saveChannel(s, B, input, now);
  assert.equal(c.linked, false);
  assert.match(c.linkCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.deepEqual(scheduledChannels(s, now), []);
  assert.throws(() => prepareChannel(s, B, {id: c.id}, now), /Vincule o grupo/);
  assert.equal(post(s, '@vilazuni_bot piscina').ignored, true);
  // Mesmo uma mensagem que já estivesse na fila (registro antigo) não sai.
  s.channelOutbox = [
    {id: 'm', tenant: 'outro', channelId: c.id, channelVersion: s.channels[0].version, status: 'pending'},
  ];
  s.channelOutbox[0].evidence = [];
  assert.throws(() => claimChannelMessage(s, 'outro', 'm', now), /Grupo ou fontes mudaram/);
});

test('o código só vale no grupo informado, em grupo, dentro de 24 h e uma vez', () => {
  const s = seed(),
    c = saveChannel(s, A, input, now);
  assert.equal(post(s, '/vincular ' + c.linkCode, {id: -1009999999999, type: 'supergroup'}).ignored, true);
  assert.equal(post(s, '/vincular ' + c.linkCode, {id: Number(group), type: 'private'}).ignored, true);
  assert.equal(
    post(s, '/vincular ' + c.linkCode, {id: Number(group), type: 'supergroup'}, now + 24 * 3600000 + 1)
      .ignored,
    true,
  );
  assert.equal(post(s, '/vincular@vilazuni_bot ' + c.linkCode.toLowerCase()).linked, true);
  assert.equal(post(s, '/vincular ' + c.linkCode).ignored, true, 'uso único');
  assert.equal(channelsView(s, A).channels[0].linked, true);
  assert.equal(scheduledChannels(s, now).length, 1);
  assert.throws(() => channelLinkCode(s, A, {id: c.id}, now), /já está vinculado/);
});

test('cadastro sem vínculo não ocupa o grupo; grupo vinculado não troca de dono', () => {
  const s = seed(),
    intruso = saveChannel(s, B, input, now),
    dono = saveChannel(s, A, input, now);
  assert.equal(post(s, '/vincular ' + dono.linkCode).linked, true);
  assert.equal(post(s, '/vincular ' + intruso.linkCode).ignored, true);
  assert.throws(() => saveChannel(s, B, input, now), /vinculado a outro condomínio/);
  assert.deepEqual(
    scheduledChannels(s, now).map((c) => c.tenant),
    ['chandra'],
  );
});

test('o código não fica guardado nem aparece na lista; gerar outro invalida o anterior', () => {
  const s = seed(),
    c = saveChannel(s, A, input, now),
    raw = c.linkCode.replace('-', '');
  assert.ok(!JSON.stringify(s.channels).includes(raw), 'só o resumo (sha256) fica guardado');
  const listed = JSON.stringify(channelsView(s, A));
  assert.ok(!listed.includes('linkCodeHash') && !listed.includes(raw), 'a lista não traz código nem resumo');
  const novo = channelLinkCode(s, A, {id: c.id}, now);
  assert.notEqual(novo.linkCode, c.linkCode);
  assert.equal(post(s, '/vincular ' + c.linkCode).ignored, true);
  assert.equal(post(s, '/vincular ' + novo.linkCode).linked, true);
});

test('API: salvar devolve o código uma vez, e a rotina do Telegram não regrava a base sem nada a fazer', async () => {
  const f = await fixture(),
    previous = process.env.TELEGRAM_ENABLED;
  try {
    const saved = await f.request('/channels/save', input, f.admin.cookie);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.match(saved.body.linkCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const list = await f.request('/channels', undefined, f.admin.cookie);
    assert.equal(list.body.channels[0].linked, false);
    assert.ok(!JSON.stringify(list.body).includes(saved.body.linkCode));
    const again = await f.request('/channels/link-code', {id: saved.body.id}, f.admin.cookie);
    assert.equal(again.status, 200);
    assert.notEqual(again.body.linkCode, saved.body.linkCode);
    process.env.TELEGRAM_ENABLED = 'true';
    const file = path.join(f.directory, 'store.json'),
      before = (await fs.stat(file)).mtimeMs;
    await new Promise((resolve) => setTimeout(resolve, 30));
    await f.api.tick();
    await f.api.tick();
    assert.equal((await fs.stat(file)).mtimeMs, before, 'canal sem vínculo e fila vazia: nada a gravar');
  } finally {
    if (previous === undefined) delete process.env.TELEGRAM_ENABLED;
    else process.env.TELEGRAM_ENABLED = previous;
    await f.close();
  }
});
