import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createFund,createAccount,createReceivable,receiveReceivablePartial,editReceivable,changeReceivable,createAgreement,approveAgreement,activateAgreement,cancelAgreement,reverseEntry,financeView,financialReport,closeMonth} from '../finance.mjs';
import {revision,balance} from '../finance-ledger.mjs';
const now=Date.parse('2026-10-19T12:00:00-03:00'),root={id:'s',tenant:'a',role:'sindico',name:'Gestão'};
function base(){const s={},fund=createFund(s,root,{name:'Ordinário',purpose:'Operação corrente'},now),account=createAccount(s,root,{name:'Caixa teste',kind:'cash',fundId:fund.id,openingOn:'2026-09-01',openingCents:10000,reason:'Saldo conferido'},now),r=createReceivable(s,root,{description:'Contribuição teste',debtor:'Pagador teste',reference:'DOC-001',fundId:fund.id,category:'Contribuições',amountCents:10001,issuedOn:'2026-09-01',dueOn:'2026-09-30'},now);return {s,fund,account,r};}
const input=(b,patch={})=>({sourceId:b.r.id,sourceVersion:b.s.financialReceivables[0].version,reference:'ACORDO-001',terms:'Concordância sintética informada',count:3,firstDueOn:'2026-10-31',reason:'Parcelamento conferido',...patch});
function approve(b,a){return approveAgreement(b.s,root,{id:a.id,version:a.version,reason:'Conferido'},now);}
function activate(b,a,patch={}){return activateAgreement(b.s,root,{id:a.id,version:a.version,reason:'Ativação conferida',operationId:randomUUID(),...patch},now);}
function receive(b,r,value,date='2026-10-19'){return receiveReceivablePartial(b.s,root,{id:r.id,version:r.version,amountCents:value,date,operationId:randomUUID(),reference:randomUUID(),reason:'Entrada conferida',accountId:b.account.id,accountVersion:b.s.financialAccounts[0].version},now);}
function reverse(b,e){return reverseEntry(b.s,root,{id:e.id,version:e.version,date:'2026-10-19',reference:randomUUID(),reason:'Correção conferida',operationId:randomUUID(),accountVersions:[{id:b.account.id,version:b.s.financialAccounts[0].version}]},now);}

test('parcelamento usa somente residual, distribui centavos e ajusta meses curtos sem alterar caixa',()=>{
 const b=base();receive(b,b.r,3334,'2026-09-15');const a=createAgreement(b.s,root,input(b,{firstDueOn:'2027-01-31'}),now);assert.equal(a.principalCents,6667);assert.deepEqual(a.installments.map(i=>i.amountCents),[2223,2222,2222]);assert.deepEqual(a.installments.map(i=>i.dueOn),['2027-01-31','2027-02-28','2027-03-31']);
 activate(b,approve(b,a),{principalCents:1,installments:[]});assert.equal(balance(b.s,'a'),13334);const view=financeView(b.s,root,now);assert.equal(view.receivables[0].status,'renegotiated');assert.equal(view.receivables[0].remainingCents,0);assert.equal(view.receivables[0].transferredCents,6667);assert.equal(view.receivables.reduce((n,r)=>n+r.remainingCents,0),6667);assert.equal(view.agreements[0].status,'active');
});
test('baixas das parcelas aceitam parcial e total, mas origem e termos ficam protegidos',()=>{
 const b=base(),payment=receive(b,b.r,3000,'2026-09-10');activate(b,approve(b,createAgreement(b.s,root,input(b),now)));const child=b.s.financialReceivables[1];receive(b,child,1000);assert.equal(child.status,'partial');
 assert.throws(()=>reverse(b,payment.entry),/Cancele o acordo/);assert.throws(()=>receive(b,b.s.financialReceivables[0],1),/em aberto/);assert.throws(()=>createAgreement(b.s,root,input(b,{sourceId:child.id,sourceVersion:child.version,reference:'OUTRO'}),now),/conta original/);
 assert.throws(()=>editReceivable(b.s,root,{id:child.id,version:child.version,fundId:b.fund.id,dueOn:'2027-01-01',category:'Outra',reason:'Trocar'},now),/preservados/);assert.throws(()=>changeReceivable(b.s,root,{id:child.id,version:child.version,status:'cancelled',reason:'Trocar'},now),/acordo/);
});
test('cancelar acordo exige estornar parcelas e restaura só o saldo original sem duplicar dívida',()=>{
 const b=base();receive(b,b.r,3000,'2026-09-10');const a=activate(b,approve(b,createAgreement(b.s,root,input(b),now))),child=b.s.financialReceivables[1],entry=receive(b,child,1000).entry;
 const cancel={id:a.id,version:a.version,reason:'Condições revistas'},before=structuredClone(b.s);assert.throws(()=>cancelAgreement(b.s,root,cancel,now),/Estorne todas/);assert.deepEqual(b.s,before);reverse(b,entry);cancelAgreement(b.s,root,cancel,now);
 const view=financeView(b.s,root,now);assert.equal(view.agreements[0].status,'cancelled');assert.equal(view.receivables[0].status,'partial');assert.equal(view.receivables[0].remainingCents,7001);assert.ok(view.receivables.slice(1).every(r=>r.status==='cancelled'&&r.remainingCents===0));assert.equal(view.receivables.reduce((n,r)=>n+r.remainingCents,0),7001);assert.equal(balance(b.s,'a'),13000);
});
test('mudança na origem invalida proposta/aprovação sem transferir saldo antigo',()=>{
 const b=base(),a=createAgreement(b.s,root,input(b),now);receive(b,b.s.financialReceivables[0],1);assert.throws(()=>approve(b,a),/origem mudou/);
 const other=base(),approved=approve(other,createAgreement(other.s,root,input(other),now));receive(other,other.s.financialReceivables[0],1);const before=structuredClone(other.s);assert.throws(()=>activate(other,approved),/origem mudou/);assert.deepEqual(other.s,before);
});
test('quitar parcelas conclui acordo sem duplicar dívida e estorno reabre somente a parcela afetada',()=>{
 const b=base(),a=activate(b,approve(b,createAgreement(b.s,root,input(b),now))),entries=[];
 for(const i of a.installments){const child=b.s.financialReceivables.find(r=>r.id===i.receivableId);entries.push(receive(b,child,i.amountCents).entry);}
 let view=financeView(b.s,root,now);assert.equal(view.agreements[0].status,'settled');assert.equal(view.receivables.reduce((n,r)=>n+r.remainingCents,0),0);assert.equal(financialReport(b.s,root,'2026-10').report.receivableOutstanding.length,0);
 reverse(b,entries[0]);view=financeView(b.s,root,now);assert.equal(view.agreements[0].status,'active');assert.equal(view.agreements[0].remainingCents,a.installments[0].amountCents);assert.equal(view.receivables[0].status,'renegotiated');
});
test('colisão em parcela e repetição de ativação não deixam lote parcial',()=>{
 const b=base(),a=approve(b,createAgreement(b.s,root,input(b),now)),last=a.installments.at(-1);createReceivable(b.s,root,{debtor:a.debtor,description:'Documento anterior',reference:last.reference,amountCents:1,category:a.category,fundId:b.fund.id,issuedOn:'2026-10-19',dueOn:'2026-10-31'},now);
 const before=structuredClone(b.s);assert.throws(()=>activate(b,a),/já registrada/);assert.deepEqual(b.s,before);
 const other=base(),active=activate(other,approve(other,createAgreement(other.s,root,input(other),now))),saved=structuredClone(other.s);assert.throws(()=>activate(other,active),/ainda não gerado/);assert.deepEqual(other.s,saved);
});
test('acordos obedecem módulo, condomínio e parâmetros sem juros ou principal informado pelo cliente',()=>{
 const b=base(),write={...root,role:'administradora',delegations:['finance']},control={...root,role:'administradora',delegations:['financeClose']},reader={...root,role:'subsindico',delegations:['financeRead']};
 for(const u of [control,reader,{...root,tenant:'b'}])assert.throws(()=>createAgreement(b.s,u,input(b),now));for(const patch of [{count:1},{count:37},{count:1.5},{count:'3'},{firstDueOn:'2026-10-18'},{firstDueOn:'2026-02-30'}])assert.throws(()=>createAgreement(b.s,root,input(b,patch),now));
 const a=createAgreement(b.s,write,input(b,{principalCents:1,interestCents:999}),now);assert.equal(a.principalCents,10001);assert.throws(()=>approveAgreement(b.s,write,{id:a.id,version:1,reason:'Conferido'},now));const approved=approveAgreement(b.s,control,{id:a.id,version:1,reason:'Conferido'},now);assert.throws(()=>activateAgreement(b.s,control,{id:a.id,version:approved.version,reason:'Conferido',operationId:randomUUID()},now));
});
test('fechamento e corte histórico preservam origem antes do acordo e parcelas após cancelamento posterior',()=>{
 const b=base();receive(b,b.r,3000,'2026-09-10');const closed=closeMonth(b.s,root,{month:'2026-09',revision:revision(b.s,'a'),reason:'Conferido'},now);const active=activate(b,approve(b,createAgreement(b.s,root,input(b),now)));assert.equal(financialReport(b.s,root,'2026-09').sha256,closed.sha256);assert.equal(financialReport(b.s,root,'2026-09').report.receivableOutstanding[0].remainingCents,7001);assert.equal(financialReport(b.s,root,'2026-10').report.agreements[0].status,'active');
 const later=Date.parse('2026-11-03T12:00:00-03:00'),octClosed=closeMonth(b.s,root,{month:'2026-10',revision:revision(b.s,'a'),reason:'Acordo conferido'},later);cancelAgreement(b.s,root,{id:active.id,version:active.version,reason:'Cancelado'},later);const oct=financialReport(b.s,root,'2026-10').report,nov=financialReport(b.s,root,'2026-11').report;assert.equal(financialReport(b.s,root,'2026-10').sha256,octClosed.sha256);assert.equal(oct.agreements[0].status,'active');assert.equal(oct.receivables[0].status,'renegotiated');assert.equal(nov.agreements[0].status,'cancelled');assert.equal(nov.receivableOutstanding.length,1);
});
