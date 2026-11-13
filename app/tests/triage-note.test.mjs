import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../domain.mjs';
import {createIncident} from '../incidents.mjs';
import {createIncidentAlert, alertsView, updateAlert} from '../alerts.mjs';

// Achado M12 da auditoria: a justificativa interna da triagem de uma ocorrência ia no histórico que o
// destinatário — às vezes o próprio morador acusado — recebe, com o nome de quem reclamou.

const now = Date.parse('2026-11-12T10:00:00-03:00'),
  sindico = {id: 'u-s', role: 'sindico', tenant: 'chandra', name: 'Síndica Sintética', active: true},
  accused = {
    id: 'u-a',
    role: 'proprietario',
    tenant: 'chandra',
    name: 'Proprietário Sintético 03',
    houses: ['c03'],
    active: true,
  },
  neighbor = {
    id: 'u-v',
    role: 'proprietario',
    tenant: 'chandra',
    name: 'Vizinho Sintético 07',
    houses: ['c07'],
    active: true,
  },
  reason = 'Relato do vizinho da casa 07, terceira queixa dele',
  revised = 'Recebemos relato de som alto após 23h. Pedimos atenção ao regimento.';

function triage() {
  const s = seed(),
    incident = createIncident(
      s,
      neighbor,
      {title: 'Barulho', area: 'Casa 03', description: 'Som alto após 23h na casa 03'},
      now,
    );
  s.incidents.find((i) => i.id === incident.id).houseId = 'c03';
  const alert = createIncidentAlert(
    s,
    [sindico, accused, neighbor],
    sindico,
    {
      incidentId: incident.id,
      recipients: [accused.id],
      title: 'Barulho noturno',
      message: revised,
      reason,
      reviewed: true,
    },
    now,
  );
  return {s, alert};
}

test('a justificativa da triagem fica com a gestão; o destinatário vê só a mensagem revisada', () => {
  const {s, alert} = triage();
  const seen = alertsView(s, accused);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].message, revised);
  assert.ok(
    !JSON.stringify(seen).includes('vizinho da casa 07'),
    'a justificativa não chega ao destinatário',
  );
  const managed = alertsView(s, sindico)[0];
  assert.equal(managed.history[0].message, reason);
  assert.equal(managed.history[0].internal, true);
  // O acompanhamento seguinte da gestão é para o destinatário, e ele continua vendo.
  updateAlert(
    s,
    sindico,
    {id: alert.id, version: alert.version, status: 'checking', message: 'Em apuração'},
    now,
  );
  assert.deepEqual(
    alertsView(s, accused)[0].history.map((h) => h.message),
    ['Em apuração'],
  );
});

test('triagem gravada antes da correção, sem a marca, também esconde a justificativa', () => {
  const {s} = triage();
  delete s.operationalAlerts[0].history[0].internal;
  assert.ok(!JSON.stringify(alertsView(s, accused)).includes('vizinho da casa 07'));
  assert.equal(alertsView(s, sindico)[0].history[0].message, reason);
});
