import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {seed} from '../domain.mjs';
import {saveDevice, queueGate, claimGate, deliverGate, plateEvent, cameraSnapshot} from '../physical.mjs';

// Cada adaptador configurado no servidor pertence a UM condomínio (ACCESS_<CHAVE>_TENANT).
// Antes, a chave era texto livre e valia para qualquer condomínio: o síndico de outro
// condomínio cadastrava um relé com a chave do Chandra e abria o portão / via a câmera dele.
const now = Date.parse('2026-10-19T12:00:00-03:00');
const chandra = {
  id: 's-chandra',
  name: 'Gestão Chandra',
  tenant: 'chandra',
  role: 'sindico',
  active: true,
  houses: [],
};
const beta = {id: 's-beta', name: 'Gestão Beta', tenant: 'beta', role: 'sindico', active: true, houses: []};
const env = {
  ACCESS_PORTAO_PRINCIPAL_TENANT: 'chandra',
  ACCESS_PORTAO_PRINCIPAL_URL: 'https://portao.chandra.test/pulse',
  ACCESS_PORTAO_PRINCIPAL_SECRET: 'segredo-sintetico-do-chandra',
  ACCESS_PORTAO_PRINCIPAL_EVENT_SECRET: 'evento-sintetico-do-chandra',
  ACCESS_CAMERA_ENTRADA_TENANT: 'chandra',
  ACCESS_CAMERA_ENTRADA_SNAPSHOT_URL: 'https://camera.chandra.test/snapshot',
  ACCESS_CAMERA_ENTRADA_CAMERA_TOKEN: 'token-sintetico-do-chandra',
};
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=',
  'base64',
);

function scenario() {
  const state = seed();
  const window = {
    status: 'approved',
    start: new Date(now - 1000).toISOString(),
    end: new Date(now + 3600000).toISOString(),
  };
  state.stays = [
    {id: 'stay-chandra', tenant: 'chandra', houseId: 'c01', ...window},
    {id: 'stay-beta', tenant: 'beta', houseId: 'b01', ...window},
  ];
  return state;
}
const gateInput = (deviceId, stayId, requestId) => ({
  deviceId,
  stayId,
  requestId,
  confirmed: true,
  reason: 'Conferência sintética',
});
function countingFetcher(response) {
  const calls = [];
  return {
    calls,
    fetcher: async (url, options) => {
      calls.push({url: String(url), options});
      return response();
    },
  };
}

test('outro condomínio não cadastra relé nem câmera com a chave do Chandra, e a recusa não revela se a chave existe', () => {
  const state = scenario();
  const errorOf = (input) => {
    try {
      saveDevice(
        state,
        beta,
        {name: 'Portão', reason: 'Cadastro sintético', mode: 'relay', ...input},
        now,
        env,
      );
    } catch (error) {
      return error.message;
    }
    return null;
  };
  const foreign = errorOf({adapterKey: 'PORTAO_PRINCIPAL'});
  const foreignCamera = errorOf({adapterKey: 'CAMERA_ENTRADA', kind: 'camera'});
  const missing = errorOf({adapterKey: 'CHAVE_QUE_NAO_EXISTE'});
  assert.match(foreign ?? '', /não liberado para este condomínio/);
  assert.equal(foreignCamera, foreign);
  assert.equal(missing, foreign, 'chave de outro condomínio e chave inexistente recebem a mesma resposta');
  assert.equal((state.accessDevices || []).filter((d) => d.tenant === 'beta').length, 0);
});

test('equipamento já gravado em outro condomínio com a chave do Chandra não aciona o portão, a câmera nem a leitura de placa', async () => {
  const state = scenario();
  state.accessDevices = [
    {
      id: 'portao-beta',
      tenant: 'beta',
      name: 'Portão',
      kind: 'gate',
      mode: 'relay',
      adapterKey: 'PORTAO_PRINCIPAL',
      active: true,
      version: 1,
    },
    {
      id: 'camera-beta',
      tenant: 'beta',
      name: 'Câmera',
      kind: 'camera',
      mode: 'relay',
      adapterKey: 'CAMERA_ENTRADA',
      active: true,
      version: 1,
    },
  ];
  const command = queueGate(
    state,
    beta,
    gateInput('portao-beta', 'stay-beta', 'cross-tenant-request-1234'),
    now,
  );
  const prepared = claimGate(state, beta, {id: command.id}, now);
  const gate = countingFetcher(() => new Response(JSON.stringify({commandId: command.id, accepted: true})));
  const result = await deliverGate(prepared, env, gate.fetcher);
  assert.equal(result.status, 'failed');
  assert.equal(gate.calls.length, 0, 'nenhuma chamada ao portão do Chandra');

  const camera = countingFetcher(() => new Response(png));
  await assert.rejects(() => cameraSnapshot(state.accessDevices[1], env, camera.fetcher));
  assert.equal(camera.calls.length, 0, 'nenhuma chamada à câmera do Chandra');

  const raw = JSON.stringify({plate: 'ABC1D23', timestamp: now, nonce: 'cross-tenant-nonce-123456'});
  const signature = createHmac('sha256', env.ACCESS_PORTAO_PRINCIPAL_EVENT_SECRET).update(raw).digest('hex');
  assert.throws(() => plateEvent(state, 'portao-beta', raw, signature, env, now), /não autenticado/);
  assert.equal((state.plateEvents || []).length, 0);
});

test('o próprio condomínio continua usando o seu portão, a sua câmera e a leitura de placa', async () => {
  const state = scenario();
  const gateDevice = saveDevice(
    state,
    chandra,
    {name: 'Portão principal', mode: 'relay', adapterKey: 'PORTAO_PRINCIPAL', reason: 'Adaptador homologado'},
    now,
    env,
  );
  const command = queueGate(
    state,
    chandra,
    gateInput(gateDevice.id, 'stay-chandra', 'own-tenant-request-1234'),
    now,
  );
  const prepared = claimGate(state, chandra, {id: command.id}, now);
  const gate = countingFetcher(() => new Response(JSON.stringify({commandId: command.id, accepted: true})));
  assert.equal((await deliverGate(prepared, env, gate.fetcher)).status, 'acknowledged');
  assert.equal(gate.calls.length, 1);
  assert.equal(gate.calls[0].url, env.ACCESS_PORTAO_PRINCIPAL_URL);
  const body = gate.calls[0].options.body;
  assert.equal(
    gate.calls[0].options.headers['X-Vilazuni-Signature'],
    createHmac('sha256', env.ACCESS_PORTAO_PRINCIPAL_SECRET).update(body).digest('hex'),
  );

  const cameraDevice = saveDevice(
    state,
    chandra,
    {
      name: 'Câmera da entrada',
      kind: 'camera',
      mode: 'relay',
      adapterKey: 'CAMERA_ENTRADA',
      reason: 'Câmera homologada',
    },
    now,
    env,
  );
  const camera = countingFetcher(() => new Response(png));
  assert.equal((await cameraSnapshot(cameraDevice, env, camera.fetcher)).mime, 'image/png');
  assert.equal(camera.calls.length, 1);

  const raw = JSON.stringify({plate: 'ABC1D23', timestamp: now, nonce: 'own-tenant-nonce-1234567'});
  const signature = createHmac('sha256', env.ACCESS_PORTAO_PRINCIPAL_EVENT_SECRET).update(raw).digest('hex');
  assert.equal(plateEvent(state, gateDevice.id, raw, signature, env, now).status, 'unverified');
});
