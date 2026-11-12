import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed, actor} from '../domain.mjs';
import {createResident, visibleResidents, readResidentPhoto} from '../residents.mjs';
import {houseHousehold} from '../household.mjs';
import {tourView} from '../tour.mjs';

// fundacao/PILOTO_ASAAS_E_ACESSOS.md: o temporário (hóspede) "não recebe fichas de moradores". Antes, ele recebia
// telefone, WhatsApp, e-mail, placas e a foto do proprietário pela ficha da casa e pelo passeio 3D.
// O inquilino anual (ocupante) continua vendo o contato do proprietário da própria casa (decisão de produto
// já guardada em household-api.test.mjs).
const now = Date.parse('2026-10-19T12:00:00-03:00'),
  photo =
    'data:image/png;base64,' + Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString('base64');
const syndic = {...actor(), id: 'syndic'},
  coOwner = {...actor('proprietario'), id: 'co-owner'},
  agency = {...actor('imobiliaria'), id: 'agency', houses: ['c01']};
const ownerInput = {
  houseId: 'c01',
  kind: 'owner',
  ownerOccupancy: 'rented',
  name: 'Proprietária Exemplo',
  contact: 'Contato pessoal reservado da proprietária',
  phone: '5521999990011',
  whatsapp: '5521999990012',
  email: 'proprietaria@example.test',
  people: ['Proprietária Exemplo'],
  vehicles: ['OWN1E23'],
  startDate: '2026-01-01',
  photo,
};
const secrets = [ownerInput.contact, ownerInput.phone, ownerInput.whatsapp, ownerInput.email, 'OWN1E23'];

function setup() {
  const state = seed();
  const owner = createResident(state, syndic, ownerInput, now).record;
  const lease = createResident(
    state,
    syndic,
    {
      houseId: 'c01',
      kind: 'annual',
      name: 'Inquilina Exemplo',
      people: ['Inquilina Exemplo'],
      startDate: '2026-10-01',
      contractEndDate: '2027-09-30',
    },
    now,
  ).record;
  state.stays = [
    {
      id: 'stay-c01',
      tenant: 'chandra',
      houseId: 'c01',
      status: 'approved',
      start: new Date(now - 3600000).toISOString(),
      end: new Date(now + 86400000).toISOString(),
      responsible: 'Hóspede Exemplo',
      people: ['Hóspede Exemplo'],
    },
  ];
  const tenantUser = {
    ...actor('ocupante'),
    id: 'tenant-user',
    houses: ['c01'],
    residentId: lease.id,
    validUntil: '2027-09-30T23:59:59-03:00',
    active: true,
  };
  const guestUser = {
    ...actor('temporario'),
    id: 'guest-user',
    houses: ['c01'],
    stayId: 'stay-c01',
    validUntil: state.stays[0].end,
    active: true,
  };
  return {state, owner, tenantUser, guestUser};
}
const leaks = (value) => secrets.filter((secret) => JSON.stringify(value).includes(secret));

test('hóspede vê o nome do proprietário, mas não o contato, as placas nem a foto, em nenhuma porta', () => {
  const {state, owner, guestUser} = setup();
  for (const u of [guestUser]) {
    const residents = visibleResidents(state, u, now),
      household = houseHousehold(state, u, 'c01', now),
      tour = tourView(state, u, now);
    const ownerView = household.owners.find((r) => r.id === owner.id);
    assert.equal(ownerView?.name, ownerInput.name, `${u.role}: o nome do proprietário continua na ficha`);
    assert.equal(ownerView.contactsVisible, false);
    assert.equal(ownerView.photo, false);
    assert.deepEqual(leaks(residents), [], `${u.role}: lista de moradores vazou dado pessoal`);
    assert.deepEqual(leaks(household), [], `${u.role}: ficha da casa vazou dado pessoal`);
    assert.ok(
      JSON.stringify(tour).includes(ownerInput.name),
      `${u.role}: o passeio precisa mostrar a ficha da casa para o teste valer`,
    );
    assert.deepEqual(leaks(tour), [], `${u.role}: passeio 3D vazou dado pessoal`);
    assert.throws(() => readResidentPhoto(state, u, owner.id, owner.version, now), /Foto indisponível/);
  }
});

test('gestão, coproprietário, imobiliária e inquilino anual da casa continuam vendo o contato do proprietário', () => {
  const {state, owner, tenantUser} = setup();
  const tenantView = houseHousehold(state, tenantUser, 'c01', now).owners.find((r) => r.id === owner.id);
  assert.equal(tenantView.phone, ownerInput.phone, 'inquilino anual mantém o contato do proprietário');
  for (const u of [syndic, coOwner, agency]) {
    const ownerView = houseHousehold(state, u, 'c01', now).owners.find((r) => r.id === owner.id);
    assert.equal(ownerView.phone, ownerInput.phone, `${u.role}`);
    assert.equal(ownerView.contactsVisible, true);
    assert.equal(ownerView.photo, true);
    assert.ok(readResidentPhoto(state, u, owner.id, owner.version, now).bytes.length);
  }
});
