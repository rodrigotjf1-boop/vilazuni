import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';

// A conta de proprietário não era ligada ao cadastro de proprietário da casa: encerrar o vínculo (casa vendida)
// não tirava nada, e o ex-dono continuava vendo os contatos do novo inquilino, criando estadias e reservando áreas.
// Agora o síndico marca, no encerramento, quais contas perdem a casa; a sessão delas cai na hora.
const today = '2026-10-19';

async function ownerRecord(f, email) {
  const r = await f.request(
    '/residents',
    {
      houseId: 'c01',
      kind: 'owner',
      ownerOccupancy: 'rented',
      name: 'Dono Antigo',
      email,
      startDate: '2026-01-01',
    },
    f.admin.cookie,
  );
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.id;
}
async function accountsOf(f, houseId) {
  const r = await f.request('/residents/owner-accounts?houseId=' + houseId, undefined, f.admin.cookie);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.accounts;
}

test('encerrar o proprietário com a conta marcada tira a casa da conta e derruba a sessão na hora', async () => {
  const f = await fixture();
  try {
    const seller = await f.invite('proprietario', {houses: ['c01', 'c02']});
    const id = await ownerRecord(f, seller.email);
    const account = (await accountsOf(f, 'c01')).find((a) => a.email === seller.email);
    assert.ok(account, 'a conta do proprietário aparece entre as que acessam a casa');
    assert.equal((await f.request('/state', undefined, seller.cookie)).status, 200);
    const end = await f.request(
      '/residents/end',
      {id, endedOn: today, reason: 'Casa vendida', revokeAccountIds: [account.id]},
      f.admin.cookie,
    );
    assert.equal(end.status, 200, JSON.stringify(end.body));
    assert.deepEqual(
      end.body.revoked.map((a) => a.id),
      [account.id],
    );
    assert.equal(
      (await f.request('/state', undefined, seller.cookie)).status,
      401,
      'sessão antiga derrubada',
    );
    const again = await f.request('/login', {email: seller.email, password: f.password});
    assert.equal(again.status, 200, 'a conta continua ativa porque ainda tem a casa 02');
    const houses = (await f.request('/state', undefined, again.cookie)).body.state.houses.map((h) => h.id);
    assert.ok(!houses.includes('c01'), 'perdeu a casa vendida');
    assert.ok(houses.includes('c02'), 'manteve a outra casa');
    assert.equal((await accountsOf(f, 'c01')).length, 0);
  } finally {
    await f.close();
  }
});

test('conta que perde a única casa é desativada e não entra mais', async () => {
  const f = await fixture();
  try {
    const seller = await f.invite('proprietario', {houses: ['c01']});
    const id = await ownerRecord(f, seller.email);
    const [account] = await accountsOf(f, 'c01');
    const end = await f.request(
      '/residents/end',
      {id, endedOn: today, reason: 'Casa vendida', revokeAccountIds: [account.id]},
      f.admin.cookie,
    );
    assert.equal(end.status, 200, JSON.stringify(end.body));
    assert.equal((await f.request('/login', {email: seller.email, password: f.password})).status, 401);
  } finally {
    await f.close();
  }
});

test('sem marcar contas nada muda nos acessos, e a resposta avisa quem ainda acessa a casa', async () => {
  const f = await fixture();
  try {
    const seller = await f.invite('proprietario', {houses: ['c01']});
    const id = await ownerRecord(f, seller.email);
    const end = await f.request('/residents/end', {id, endedOn: today, reason: 'Inventário'}, f.admin.cookie);
    assert.equal(end.status, 200, JSON.stringify(end.body));
    assert.deepEqual(end.body.revoked, []);
    assert.deepEqual(
      end.body.remainingAccounts.map((a) => a.email),
      [seller.email],
    );
    assert.equal((await f.request('/state', undefined, seller.cookie)).status, 200);
  } finally {
    await f.close();
  }
});

test('delegado não retira contas, conta de outra casa é recusada, e a recusa não encerra o vínculo', async () => {
  const f = await fixture();
  try {
    const seller = await f.invite('proprietario', {houses: ['c01']});
    const outsider = await f.invite('proprietario', {houses: ['c02']});
    const delegate = await f.invite('administradora', {
      delegations: ['residents'],
      delegationReason: 'Apoio à gestão de moradores',
      validUntil: '2027-01-01T00:00:00-03:00',
    });
    const id = await ownerRecord(f, seller.email);
    const [account] = await accountsOf(f, 'c01');
    const outsiderAccount = (await accountsOf(f, 'c02')).find((a) => a.email === outsider.email);
    assert.equal(
      (await f.request('/residents/owner-accounts?houseId=c01', undefined, delegate.cookie)).status,
      403,
    );
    const byDelegate = await f.request(
      '/residents/end',
      {id, endedOn: today, reason: 'Casa vendida', revokeAccountIds: [account.id]},
      delegate.cookie,
    );
    assert.equal(byDelegate.status, 403, JSON.stringify(byDelegate.body));
    const wrongHouse = await f.request(
      '/residents/end',
      {id, endedOn: today, reason: 'Casa vendida', revokeAccountIds: [outsiderAccount.id]},
      f.admin.cookie,
    );
    assert.equal(wrongHouse.status, 403, JSON.stringify(wrongHouse.body));
    const state = (await f.request('/state', undefined, f.admin.cookie)).body.state;
    assert.equal(state.residents.find((r) => r.id === id).endedOn ?? null, null, 'vínculo continua aberto');
    assert.equal((await f.request('/state', undefined, seller.cookie)).status, 200);
    assert.equal((await f.request('/state', undefined, outsider.cookie)).status, 200);
  } finally {
    await f.close();
  }
});
