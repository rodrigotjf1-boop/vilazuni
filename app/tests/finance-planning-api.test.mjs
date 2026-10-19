import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './helpers.mjs';
const expiry={validUntil:'2026-12-31',delegationReason:'Financeiro sintético'};
async function setup(f){
 const fund=(await f.request('/finance/funds/create',{name:'Ordinário',purpose:'Operação sintética'},f.admin.cookie)).body;
 const account=(await f.request('/finance/accounts/create',{name:'Caixa sintético',kind:'cash',openingOn:'2026-10-01',openingCents:10000,fundId:fund.id,reason:'Saldo conferido'},f.admin.cookie)).body;
 return {fund,account};
}
const receivable=base=>({debtor:'Pagador sintético',reference:'DOC-001',description:'Contribuição sintética',category:'Contribuições',issuedOn:'2026-10-01',dueOn:'2026-10-15',fundId:base.fund.id,amountCents:2501});
const plan=base=>({month:'2026-10',fundId:base.fund.id,kind:'income',category:'Contribuições',plannedCents:3000,reason:'Previsão conferida'});

test('API serializa cadastro e recebimento concorrentes e estorno reabre a conta sem duplicar receita',async()=>{
 const f=await fixture();try{
  const {request,admin}=f,base=await setup(f),input=receivable(base);
  const created=await Promise.all([request('/finance/receivables/create',input,admin.cookie),request('/finance/receivables/create',input,admin.cookie)]);assert.deepEqual(created.map(r=>r.status).sort(),[200,403]);
  const r=created.find(r=>r.status===200).body,receipt={id:r.id,version:1,accountId:base.account.id,accountVersion:1,date:'2026-10-10',reference:'ENTRADA-001',reason:'Conferida em teste',operationId:randomUUID(),amountCents:1};
  const received=await Promise.all([request('/finance/receivables/record',receipt,admin.cookie),request('/finance/receivables/record',{...receipt,operationId:randomUUID()},admin.cookie)]);assert.deepEqual(received.map(r=>r.status).sort(),[200,403]);
  const entry=received.find(r=>r.status===200).body.entry;let finance=(await request('/state',undefined,admin.cookie)).body.state.finance;assert.equal(finance.totalCents,12501);assert.equal(finance.receivables[0].status,'received');assert.equal(entry.amountCents,2501);
  const reversed=await request('/finance/reverse',{id:entry.id,version:1,date:'2026-10-19',reference:'ESTORNO-001',reason:'Correção sintética',operationId:randomUUID(),accountVersions:[{id:base.account.id,version:finance.accounts[0].version}]},admin.cookie);assert.equal(reversed.status,200);
  finance=(await request('/state',undefined,admin.cookie)).body.state.finance;assert.equal(finance.totalCents,10000);assert.equal(finance.receivables[0].status,'open');
  assert.equal((await request('/finance/receivables/record',{...receipt,version:finance.receivables[0].version,accountVersion:finance.accounts[0].version,operationId:randomUUID(),reference:'ENTRADA-002'},admin.cookie)).status,403);
  const report=(await request('/finance/report?month=2026-10',undefined,admin.cookie)).body.report;assert.equal(report.receivableOutstanding.length,1);assert.equal(report.budget.totals.income.actualCents,0);
 }finally{await f.close();}
});

test('API separa recebimento de revisão orçamentária e revalida consulta e avisos ao revogar',async()=>{
 const f=await fixture();try{
  const {request,admin}=f,base=await setup(f),viewer=await f.invite('subsindico',{...expiry,delegations:['financeRead']}),writer=await f.invite('administradora',{...expiry,delegations:['finance']}),controller=await f.invite('administradora',{...expiry,delegations:['financeClose']}),owner=await f.invite('proprietario',{houses:['c01']});
  for(const account of [viewer,controller,owner])assert.equal((await request('/finance/receivables/create',receivable(base),account.cookie)).status,403);
  for(const account of [viewer,writer,owner])assert.equal((await request('/finance/budgets/save',plan(base),account.cookie)).status,403);
  assert.equal((await request('/finance/receivables/create',receivable(base),writer.cookie)).status,200);const saved=await request('/finance/budgets/save',plan(base),controller.cookie);assert.equal(saved.status,200);
  const revised={...plan(base),id:saved.body.id,version:1,plannedCents:4000};const attempts=await Promise.all([request('/finance/budgets/save',revised,controller.cookie),request('/finance/budgets/save',{...revised,plannedCents:5000},controller.cookie)]);assert.deepEqual(attempts.map(r=>r.status).sort(),[200,403]);
  let state=(await request('/state',undefined,viewer.cookie)).body.state;assert.equal(state.finance.budgets[0].history.length,2);assert.equal(state.finance.receivables.length,1);assert.ok(state.notifications.some(n=>n.kind==='financialReceivables'));assert.ok(state.notifications.some(n=>n.kind==='financialBudgets'));assert.equal((await request('/state',undefined,owner.cookie)).body.state.finance,null);
  assert.equal((await request('/admin/delegation',{...expiry,id:viewer.body.user.id,version:0,delegations:['tasks']},admin.cookie)).status,200);assert.equal((await request('/state',undefined,viewer.cookie)).status,401);
  const login=await request('/login',{email:viewer.email,password:f.password});state=(await request('/state',undefined,login.cookie)).body.state;assert.equal(state.finance,null);assert.equal(state.notifications.filter(n=>n.page==='finance').length,0);assert.equal((await request('/finance/report?month=2026-10',undefined,login.cookie)).status,403);
 }finally{await f.close();}
});

test('API congela recebíveis e orçamento no fechamento exportado e mantém hash após reinício',async()=>{
 const f=await fixture();try{
  const {request,admin}=f,base=await setup(f);assert.equal((await request('/finance/receivables/create',receivable(base),admin.cookie)).status,200);const saved=await request('/finance/budgets/save',plan(base),admin.cookie);assert.equal(saved.status,200);
  f.advance(15*86400000);let login=await request('/login',{email:'admin@example.test',password:f.password});let report=(await request('/finance/report?month=2026-10',undefined,login.cookie)).body.report;
  const closed=await request('/finance/close',{month:'2026-10',revision:report.revision,reason:'Conferido em teste'},login.cookie);assert.equal(closed.status,200);const closure=closed.body;
  assert.equal((await request('/finance/budgets/save',{...plan(base),id:saved.body.id,version:1,plannedCents:5000},login.cookie)).status,403);
  let finance=(await request('/state',undefined,login.cookie)).body.state.finance,r=finance.receivables[0];const received=await request('/finance/receivables/record',{id:r.id,version:r.version,accountId:base.account.id,accountVersion:finance.accounts[0].version,date:'2026-11-03',operationId:randomUUID(),reference:'ENTRADA-NOV-001',reason:'Entrada conferida'},login.cookie);assert.equal(received.status,200);
  await f.restart();login=await request('/login',{email:'admin@example.test',password:f.password});const exported=await request('/finance/export?closureId='+closure.id,undefined,login.cookie);assert.equal(exported.status,200);assert.equal(exported.body.sha256,closure.sha256);report=exported.body.report;
  assert.equal(report.receivableOutstanding.length,1);assert.equal(report.receivables[0].receivedCents,0);assert.equal(report.budget.totals.income.plannedCents,3000);assert.equal(report.budget.totals.income.actualCents,0);
  finance=(await request('/state',undefined,login.cookie)).body.state.finance;assert.equal(finance.receivables[0].status,'received');assert.equal(finance.totalCents,12501);assert.equal(finance.budgets[0].version,1);assert.equal((await request('/finance/report?month=2026-11',undefined,login.cookie)).body.report.budget.totals.income.actualCents,2501);
 }finally{await f.close();}
});
