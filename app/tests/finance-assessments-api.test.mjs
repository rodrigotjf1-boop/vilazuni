import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './helpers.mjs';
const expiry={validUntil:'2026-12-31',delegationReason:'Contribuições sintéticas'};
async function setup(f){
 const fund=(await f.request('/finance/funds/create',{name:'Ordinário',purpose:'Operação sintética'},f.admin.cookie)).body;
 const account=(await f.request('/finance/accounts/create',{name:'Caixa sintético',kind:'cash',fundId:fund.id,openingOn:'2026-10-01',openingCents:0,reason:'Caixa inicia zerado'},f.admin.cookie)).body;return {fund,account};
}
function input(base,patch={}){return {title:'Contribuição sintética',reference:'RAT-OUT-001',month:'2026-10',issuedOn:'2026-10-01',dueOn:'2026-10-25',fundId:base.fund.id,category:'Contribuições',totalCents:10001,method:'equal',basis:'Decisão sintética informada',reason:'Prévia conferida',lines:[1,2,3].map(n=>({houseId:'c0'+n,debtor:'Pagador sintético '+n,weight:1})),...patch};}

test('API mantém controle e emissão separados, dados mínimos de unidades e avisos sujeitos à revogação',async()=>{
 const f=await fixture();try{
  const {request,admin}=f,base=await setup(f),controller=await f.invite('administradora',{...expiry,delegations:['financeClose']}),writer=await f.invite('administradora',{...expiry,delegations:['finance']}),viewer=await f.invite('subsindico',{...expiry,delegations:['financeRead']}),owner=await f.invite('proprietario',{houses:['c01']});
  for(const u of [writer,viewer,owner])assert.equal((await request('/finance/assessments/save',input(base),u.cookie)).status,403);
  let response=await request('/finance/assessments/save',input(base),controller.cookie);assert.equal(response.status,200);let a=response.body;
  for(const u of [writer,viewer,owner])assert.equal((await request('/finance/assessments/approve',{id:a.id,version:a.version,reason:'Tentativa'},u.cookie)).status,403);
  response=await request('/finance/assessments/approve',{id:a.id,version:a.version,reason:'Distribuição conferida'},controller.cookie);assert.equal(response.status,200);a=response.body;
  assert.equal((await request('/finance/assessments/generate',{id:a.id,version:a.version,operationId:randomUUID(),reason:'Tentativa'},controller.cookie)).status,403);
  response=await request('/finance/assessments/generate',{id:a.id,version:a.version,operationId:randomUUID(),reason:'Lote conferido'},writer.cookie);assert.equal(response.status,200);
  let state=(await request('/state',undefined,writer.cookie)).body.state;assert.equal(state.houses.length,0);assert.equal(state.residents.length,0);assert.equal(state.finance.units.length,14);assert.deepEqual(Object.keys(state.finance.units[0]).sort(),['id','number']);assert.equal(state.finance.receivables.length,3);assert.equal((await request('/state',undefined,owner.cookie)).body.state.finance,null);
  state=(await request('/state',undefined,viewer.cookie)).body.state;assert.ok(state.notifications.some(n=>n.kind==='financialAssessments'));
  await request('/admin/delegation',{id:viewer.body.user.id,version:0,...expiry,delegations:['tasks']},admin.cookie);assert.equal((await request('/state',undefined,viewer.cookie)).status,401);const login=await request('/login',{email:viewer.email,password:f.password});state=(await request('/state',undefined,login.cookie)).body.state;assert.equal(state.finance,null);assert.ok(!state.notifications.some(n=>n.kind==='financialAssessments'));
 }finally{await f.close();}
});

test('API gera lote uma vez em concorrência, ignora valores forjados e não persiste lote parcial',async()=>{
 const f=await fixture();try{
  const {request,admin}=f,base=await setup(f);let a=(await request('/finance/assessments/save',input(base),admin.cookie)).body;a=(await request('/finance/assessments/approve',{id:a.id,version:a.version,reason:'Conferido'},admin.cookie)).body;
  const payload={id:a.id,version:a.version,operationId:randomUUID(),reason:'Gerado em teste',totalCents:1,lines:[],fundId:'foreign'};
  const race=await Promise.all([request('/finance/assessments/generate',payload,admin.cookie),request('/finance/assessments/generate',{...payload,operationId:randomUUID()},admin.cookie)]);assert.deepEqual(race.map(r=>r.status).sort(),[200,403]);
  let finance=(await request('/state',undefined,admin.cookie)).body.state.finance;assert.equal(finance.totalCents,0);assert.deepEqual(finance.receivables.map(r=>r.amountCents),[3334,3334,3333]);assert.equal(finance.assessments[0].status,'generated');
  let b=(await request('/finance/assessments/save',input(base,{reference:'RAT-OUT-002'}),admin.cookie)).body;b=(await request('/finance/assessments/approve',{id:b.id,version:b.version,reason:'Conferido'},admin.cookie)).body;
  const line=b.lines.at(-1);assert.equal((await request('/finance/receivables/create',{debtor:line.debtor,reference:line.reference,description:'Documento sintético anterior',category:'Contribuições',amountCents:1,issuedOn:'2026-10-01',dueOn:'2026-10-25',fundId:base.fund.id},admin.cookie)).status,200);
  finance=(await request('/state',undefined,admin.cookie)).body.state.finance;const revision=finance.revision;assert.equal((await request('/finance/assessments/generate',{id:b.id,version:b.version,operationId:randomUUID(),reason:'Colisão em teste'},admin.cookie)).status,403);
  await f.restart();const login=await request('/login',{email:'admin@example.test',password:f.password});finance=(await request('/state',undefined,login.cookie)).body.state.finance;assert.equal(finance.receivables.length,4);assert.equal(finance.assessments.find(r=>r.id===b.id).status,'approved');assert.equal(finance.revision,revision);assert.equal(finance.receivables.filter(r=>r.assessmentId===a.id).length,3);
 }finally{await f.close();}
});

test('API bloqueia fechamento pendente e preserva rateios/recebíveis na data de corte após recebimento e reinício',async()=>{
 const f=await fixture();try{
  const {request,admin}=f,base=await setup(f);let a=(await request('/finance/assessments/save',input(base),admin.cookie)).body;a=(await request('/finance/assessments/approve',{id:a.id,version:a.version,reason:'Conferido'},admin.cookie)).body;
  f.advance(15*86400000);let login=await request('/login',{email:'admin@example.test',password:f.password});let report=(await request('/finance/report?month=2026-10',undefined,login.cookie)).body.report;assert.equal(report.unissuedAssessments.length,1);assert.equal((await request('/finance/close',{month:'2026-10',revision:report.revision,reason:'Conferido'},login.cookie)).status,403);
  const generated=await request('/finance/assessments/generate',{id:a.id,version:a.version,operationId:randomUUID(),reason:'Gerado para fechamento'},login.cookie);assert.equal(generated.status,200);report=(await request('/finance/report?month=2026-10',undefined,login.cookie)).body.report;assert.equal(report.assessments[0].totalCents,10001);assert.equal(report.receivableOutstanding.length,3);
  const closed=await request('/finance/close',{month:'2026-10',revision:report.revision,reason:'Conferido'},login.cookie);assert.equal(closed.status,200);
  let finance=(await request('/state',undefined,login.cookie)).body.state.finance;const r=finance.receivables[0];assert.equal((await request('/finance/receivables/record',{id:r.id,version:r.version,operationId:randomUUID(),accountId:base.account.id,accountVersion:1,date:'2026-11-03',reference:'REC-NOV-001',reason:'Entrada conferida'},login.cookie)).status,200);
  await f.restart();login=await request('/login',{email:'admin@example.test',password:f.password});const saved=await request('/finance/export?closureId='+closed.body.id,undefined,login.cookie);assert.equal(saved.status,200);assert.equal(saved.body.sha256,closed.body.sha256);assert.ok(saved.body.report.assessments[0].lines.every(l=>l.status==='open'));assert.equal(saved.body.report.receivables[0].houseId,'c01');
  const current=(await request('/finance/report?month=2026-11',undefined,login.cookie)).body.report;assert.equal(current.assessments[0].lines[0].status,'received');assert.equal(current.budget.totals.income.actualCents,3334);finance=(await request('/state',undefined,login.cookie)).body.state.finance;assert.equal(finance.totalCents,3334);
 }finally{await f.close();}
});
