import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../domain.mjs';
import {saveUnit, previewMasterImport} from '../tenants.mjs';

// Achado M18 da auditoria: o número da casa entrava nas telas sem escape — um link cadastrado no lugar do
// número aparecia ativo no painel. As telas agora escapam (roteiro de navegador `house-number-browser`), e o
// cadastro recusa marcação na identificação da unidade.

const now = Date.parse('2026-11-12T10:00:00-03:00'),
  sindico = {id: 'u-s', role: 'sindico', tenant: 'chandra', name: 'Síndica Sintética', active: true},
  fields = {type: 'Casa', parking: 1, floors: 2, rooms: 3, reason: 'Revisão sintética do cadastro'};

test('identificação da unidade com marcação é recusada; sinais comuns continuam aceitos', () => {
  const db = {state: seed(), users: []},
    house = db.state.houses.find((h) => h.id === 'c03'),
    edit = (number) =>
      saveUnit(db, sindico, {...fields, id: house.id, version: house.version || 0, number}, now);
  for (const number of ['<a href="https://exemplo.invalid">03</a>', '03<img src=x>', 'Casa\u000703'])
    assert.throws(() => edit(number), /sem < ou >/, number);
  assert.equal(house.number, '03');
  assert.equal(edit('Bloco A-101/2').unit.number, 'Bloco A-101/2');
});

test('importação do cadastro mestre recusa a mesma marcação', () => {
  const db = {state: seed(), users: []};
  assert.throws(
    () =>
      previewMasterImport(db, sindico, {
        data: {
          format: 'vilazuni-master-data-v1',
          units: [{...fields, number: '<b onmouseover=alert(1)>99</b>'}],
        },
      }),
    /sem < ou >/,
  );
});
