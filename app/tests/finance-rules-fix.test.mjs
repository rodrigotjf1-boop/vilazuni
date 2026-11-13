import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {
  createFund,
  createAccount,
  createReceivable,
  editReceivable,
  createAgreement,
  approveAgreement,
} from '../finance.mjs';
import {createFeeRule, decideFeeRule, previewFeeAccrual} from '../finance-fees.mjs';

// Achados M2, M3 e M17 da auditoria (fase 2, dinheiro).

const now = Date.parse('2026-10-19T12:00:00-03:00'),
  until = '2027-12-31T00:00:00-03:00',
  root = {id: 's', name: 'Gestão', role: 'sindico', tenant: 'a', active: true},
  control = {
    id: 'ctl',
    name: 'Outro controle',
    role: 'administradora',
    tenant: 'a',
    active: true,
    validUntil: until,
    delegations: ['financeClose'],
  };
function base() {
  const s = {},
    fund = createFund(s, root, {name: 'Ordinário', purpose: 'Operação teste'}, now),
    account = createAccount(
      s,
      root,
      {
        name: 'Banco teste',
        kind: 'bank',
        fundId: fund.id,
        openingOn: '2026-01-01',
        openingCents: 10000,
        reason: 'Saldo sintético',
      },
      now,
    ),
    r = createReceivable(
      s,
      root,
      {
        debtor: 'Pagador teste',
        reference: 'TAXA-001',
        description: 'Contribuição teste',
        category: 'Taxas',
        fundId: fund.id,
        issuedOn: '2026-03-01',
        dueOn: '2026-03-10',
        amountCents: 100000,
      },
      now,
    );
  return {s, fund, account, r};
}
const rule = (b, fineBps = 200) => {
  const r = createFeeRule(
    b.s,
    root,
    {
      reference: randomUUID(),
      basis: 'Convenção fictícia validada para este teste',
      dueFrom: '2026-01-01',
      dueThrough: '2026-12-31',
      fineBps,
      annualInterestBps: 1200,
      reason: 'Regra de teste',
    },
    now,
  );
  return decideFeeRule(
    b.s,
    control,
    {id: r.id, version: 1, action: 'approve', validated: true, reason: 'Conferido em teste'},
    now,
  );
};
const preview = (b, r) =>
  previewFeeAccrual(
    b.s,
    control,
    {
      sourceId: b.r.id,
      sourceVersion: b.s.financialReceivables[0].version,
      ruleId: r.id,
      ruleVersion: r.version,
      through: '2026-10-19',
    },
    now,
  );

test('M2: multa acima de 2% é recusada; regra antiga acima do limite cobra no máximo 2%', () => {
  const b = base();
  assert.throws(() => rule(b, 201), /até 2%/);
  const r = rule(b, 200);
  // Regra aprovada antes do limite, com 10%: a memória cobra 2% e mostra 2%.
  b.s.financialFeeRules.find((x) => x.id === r.id).fineBps = 1000;
  const memo = preview(b, r);
  assert.equal(memo.fineBps, 200);
  assert.equal(memo.fineCents, 2000, '2% de R$ 1.000,00');
});

test('M3: trocar só a categoria (ou o fundo) não zera os juros; mudar o vencimento recomeça', () => {
  const b = base(),
    r = rule(b),
    before = preview(b, r);
  assert.ok(before.interestCents > 5000, 'juros de março a outubro');
  const current = () => b.s.financialReceivables[0];
  editReceivable(
    b.s,
    root,
    {
      id: b.r.id,
      version: current().version,
      fundId: b.fund.id,
      dueOn: current().dueOn,
      category: 'Taxas extraordinárias',
      reason: 'Reclassificação contábil',
    },
    now,
  );
  const after = preview(b, r);
  assert.equal(after.interestCents, before.interestCents, 'a categoria não mexe nos juros');
  assert.equal(after.from, before.from);
  editReceivable(
    b.s,
    root,
    {
      id: b.r.id,
      version: current().version,
      fundId: b.fund.id,
      dueOn: '2026-10-10',
      category: 'Taxas extraordinárias',
      reason: 'Prorrogação combinada',
    },
    now,
  );
  assert.ok(preview(b, r).interestCents < before.interestCents, 'vencimento novo recomeça os juros');
});

test('M17: quem redigiu o acordo não aprova quando há outra pessoa com controle; sendo a única, aprova marcado', () => {
  const draft = (b) =>
    createAgreement(
      b.s,
      root,
      {
        sourceId: b.r.id,
        sourceVersion: b.s.financialReceivables[0].version,
        reference: 'ACORDO-' + randomUUID(),
        terms: 'Concordância sintética informada',
        count: 3,
        firstDueOn: '2026-10-31',
        reason: 'Parcelamento conferido',
      },
      now,
    );
  let b = base(),
    a = draft(b);
  assert.throws(
    () =>
      approveAgreement(b.s, root, {id: a.id, version: a.version, reason: 'Conferido'}, now, [root, control]),
    /Outra pessoa com controle financeiro/,
  );
  const approved = approveAgreement(
    b.s,
    control,
    {id: a.id, version: a.version, reason: 'Conferido por outra pessoa'},
    now,
    [root, control],
  );
  assert.equal(approved.approval.selfApproved, false);
  // Outra pessoa com controle, mas com o acesso vencido, não conta.
  b = base();
  a = draft(b);
  const expired = {...control, validUntil: '2026-01-01T00:00:00-03:00'},
    self = approveAgreement(b.s, root, {id: a.id, version: a.version, reason: 'Conferido'}, now, [
      root,
      expired,
    ]);
  assert.equal(self.approval.selfApproved, true);
  assert.match(self.history.at(-1).action, /próprio redator/);
});
