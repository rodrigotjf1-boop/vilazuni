import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createFund,createAccount,createPayable,payPayable,payPayablePartial,createReceivable,receiveReceivable,receiveReceivablePartial,changeReceivable,changePayable,reverseEntry,financeView,financialReport,closeMonth} from '../finance.mjs';
import {revision} from '../finance-ledger.mjs';
const now=Date.parse('2026-10-19T12:00:00-03:00'),root={id:'s',name:'Gestão',role:'sindico',tenant:'a'};
function base(){const s={},fund=createFund(s,root,{name:'Ordinário',purpose:'Operação corrente'},now),account=createAccount(s,root,{name:'Caixa teste',kind:'cash',fundId:fund.id,openingOn:'2026-09-01',openingCents:20000,reason:'Saldo conferido'},now);return {s,fund,account};}
function claim(b,kind){return (kind==='payable'?createPayable:createReceivable)(b.s,root,{description:'Conta teste',creditor:'Credor teste',debtor:'Pagador teste',reference:'DOC-001',category:'Operação',fundId:b.fund.id,amountCents:10001,issuedOn:'2026-09-01',dueOn:'2026-09-30'},now);}
function record(b,r,amountCents,date='2026-09-10'){return {id:r.id,version:r.version,amountCents,date,accountId:b.account.id,accountVersion:b.s.financialAccounts[0].version,reference:randomUUID(),reason:'Baixa conferida',operationId:randomUUID()};}
function reverse(b,e,date){return reverseEntry(b.s,root,{id:e.id,version:e.version,date,reference:randomUUID(),reason:'Estorno conferido',operationId:randomUUID(),accountVersions:[{id:b.account.id,version:b.s.financialAccounts[0].version}]},now);}

test('baixas parciais em centavos preservam residual a pagar/receber e conclusão pelo saldo restante',()=>{
 for(const kind of ['payable','receivable']){
  const b=base(),r=claim(b,kind),partial=kind==='payable'?payPayablePartial:receiveReceivablePartial,full=kind==='payable'?payPayable:receiveReceivable;
  const first=partial(b.s,root,record(b,r,3001),now),current=b.s[kind==='payable'?'financialPayables':'financialReceivables'][0];assert.equal(current.status,'partial');let view=financeView(b.s,root,now)[kind==='payable'?'payables':'receivables'][0];assert.equal(view.remainingCents,7000);
  assert.throws(()=>(kind==='payable'?changePayable:changeReceivable)(b.s,root,{id:r.id,version:current.version,status:'cancelled',reason:'Tentativa'},now),/Estorne/);
  const last=full(b.s,root,record(b,current,1,'2026-09-11'),now);assert.equal(last.entry.amountCents,7000);assert.equal(current.status,kind==='payable'?'paid':'received');view=financeView(b.s,root,now)[kind==='payable'?'payables':'receivables'][0];assert.equal(view.remainingCents,0);
  reverse(b,first.entry,'2026-10-19');assert.equal(current.status,'partial');assert.equal(financeView(b.s,root,now)[kind==='payable'?'payables':'receivables'][0].remainingCents,3001);
 }
});
test('exceder residual, centavos inválidos e baixas retroativas falham sem efeitos parciais',()=>{
 const b=base(),r=claim(b,'receivable');receiveReceivablePartial(b.s,root,record(b,r,4000,'2026-09-15'),now);const current=b.s.financialReceivables[0],before=structuredClone(b.s);
 for(const value of [6002,0,-1,1.1,'100',Infinity])assert.throws(()=>receiveReceivablePartial(b.s,root,record(b,current,value,'2026-09-16'),now));assert.throws(()=>receiveReceivablePartial(b.s,root,record(b,current,1,'2026-09-14'),now),/última alteração/);assert.deepEqual(b.s,before);
});
test('relatório congela baixas parciais e residual na data de corte, mesmo após estorno posterior',()=>{
 const b=base(),r=claim(b,'receivable'),first=receiveReceivablePartial(b.s,root,record(b,r,3334),now);const closed=closeMonth(b.s,root,{month:'2026-09',revision:revision(b.s,'a'),reason:'Mês conferido'},now);
 assert.equal(closed.report.receivableOutstanding[0].remainingCents,6667);reverse(b,first.entry,'2026-10-19');assert.equal(financialReport(b.s,root,'2026-09').sha256,closed.sha256);assert.equal(financialReport(b.s,root,'2026-09').report.receivables[0].status,'partial');assert.equal(financialReport(b.s,root,'2026-10').report.receivables[0].remainingCents,10001);
});
