import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fixture} from './helpers.mjs';

// Achado M6 da auditoria: fotos e PDFs nunca eram apagados do disco, nem quando trocados ou removidos (LGPD e
// disco). Agora o arquivo que nenhum registro aponta sai na limpeza que segue uma gravação — com mais de 1 h
// pelo relógio do disco e no máximo a cada 10 min.

const red =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=',
  white =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  hour = 3600000;

async function files(f) {
  const root = path.join(f.directory, 'private-files'),
    out = [];
  for (const d of await fs.readdir(root).catch(() => []))
    for (const n of await fs.readdir(path.join(root, d))) out.push(path.join(root, d, n));
  return out.sort();
}
const age = (file, ms) => fs.utimes(file, new Date(Date.now() - ms), new Date(Date.now() - ms));

test('foto trocada ou removida sai do disco depois do prazo; a que está em uso fica', async () => {
  const f = await fixture();
  try {
    const profile = {
        slot: 'sindico',
        name: 'Síndico de teste',
        age: 45,
        userId: f.admin.body.user.id,
        houseId: 'c01',
        isOwner: true,
      },
      save = async (extra) => {
        const current = await f.request('/community/profile?slot=sindico', undefined, f.admin.cookie),
          r = await f.request(
            '/community/profile/save',
            {...profile, version: current.body.profile.version, ...extra},
            f.admin.cookie,
          );
        assert.equal(r.status, 200, JSON.stringify(r.body));
      };
    await save({photo: red});
    const [first] = await files(f);
    await save({photo: white});
    assert.equal((await files(f)).length, 2, 'a troca grava a nova; a antiga ainda está no disco');
    const second = (await files(f)).find((file) => file !== first);
    // Gravação recente (menos de 1 h) não sai, mesmo sem referência: pode ser de outra instância.
    f.advance(11 * 60000);
    await save({name: 'Síndico de teste revisado'});
    assert.deepEqual(await files(f), [first, second].sort());
    // Com mais de 1 h e passados 10 min da última limpeza, sai a que ninguém aponta; a em uso fica.
    await age(first, 2 * hour);
    await age(second, 2 * hour);
    f.advance(11 * 60000);
    await save({name: 'Síndico de teste'});
    assert.deepEqual(await files(f), [second]);
    // Remover a foto: o arquivo sai na limpeza seguinte.
    await save({photo: null});
    f.advance(11 * 60000);
    await save({name: 'Síndico sem foto'});
    assert.deepEqual(await files(f), []);
    // A base continua abrindo depois de reiniciar (nenhum arquivo em uso foi apagado).
    await f.restart();
    assert.equal(
      (await f.request('/login', {email: 'admin@example.test', password: f.password})).status,
      200,
    );
  } finally {
    await f.close();
  }
});

test('a limpeza não apaga o que não é dela nem a foto em uso por outro registro com o mesmo conteúdo', async () => {
  const f = await fixture();
  try {
    const base = {age: 45, houseId: 'c01', isOwner: false},
      save = async (slot, extra) => {
        const current = await f.request('/community/profile?slot=' + slot, undefined, f.admin.cookie),
          r = await f.request(
            '/community/profile/save',
            {...base, slot, version: current.body.profile.version, ...extra},
            f.admin.cookie,
          );
        assert.equal(r.status, 200, JSON.stringify(r.body));
      };
    // Duas fichas com a MESMA foto gravam um arquivo só; tirar de uma não pode apagar o da outra.
    await save('sindico', {name: 'Síndico de teste', userId: f.admin.body.user.id, photo: red});
    await save('zelador', {name: 'Zelador de teste', photo: red});
    const [shared] = await files(f),
      foreign = path.join(path.dirname(shared), 'anotacao.txt');
    await fs.writeFile(foreign, 'arquivo que não é do Vilazuni');
    await save('zelador', {name: 'Zelador de teste', photo: null});
    await age(shared, 2 * hour);
    await age(foreign, 2 * hour);
    f.advance(11 * 60000);
    await save('sindico', {name: 'Síndico revisado', userId: f.admin.body.user.id});
    assert.deepEqual(await files(f), [foreign, shared].sort());
  } finally {
    await f.close();
  }
});
