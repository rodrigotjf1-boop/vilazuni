import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createFund,createAccount,toggleFinancial,createEntry,transfer,createPayable,importPurchase,payPayable,changePayable,editPayable,reverseEntry,financeView,financialReport,financialClosureReport,closeMonth,reopenMonth} from '../finance.mjs';
import {revision,balance} from '../finance-ledger.mjs';
const now=Date.parse('2026-10-19T12:00:00-03:00'),root={id:'s',name:'Gestão',tenant:'a',role:'sindico'};
function base(openingCents=10000){const state={},general=createFund(state,root,{name:'Ordinário',purpose:'Operação corrente'},now),reserve=createFund(state,root,{name:'Reserva',purpose:'Reserva de teste'},now),bank=createAccount(state,root,{name:'Banco de teste',kind:'bank',fundId:general.id,openingOn:'2026-09-01',openingCents,reason:'Saldo sintético conferido'},now);return {state,general,reserve,bank,current:()=>state.financialAccounts.find(a=>a.id===bank.id)};}
function entry(b,patch={}){return {operationId:randomUUID(),kind:'income',accountId:b.bank.id,accountVersion:b.current().version,fundId:b.general.id,date:'2026-09-10',amountCents:1000,description:'Receita sintética',category:'Receita de teste',reference:randomUUID(),reason:'Registro conferido',...patch};}
function payable(b,patch={}){return createPayable(b.state,root,{description:'Conta sintética',creditor:'Credor de teste',reference:randomUUID(),amountCents:1000,fundId:b.general.id,issuedOn:'2026-09-02',dueOn:'2026-09-20',category:'Manutenção',...patch},now);}
function pay(b,p,patch={}){return {id:p.id,version:p.version,operationId:randomUUID(),accountId:b.bank.id,accountVersion:b.current().version,date:'2026-09-15',reference:randomUUID(),reason:'Saída conferida',...patch};}
function reversal(b,e,patch={}){return {id:e.id,version:e.version,operationId:randomUUID(),date:'2026-09-16',reference:randomUUID(),reason:'Correção conferida',accountVersions:[...new Set(e.postings.map(p=>p.accountId))].map(id=>({id,version:b.state.financialAccounts.find(a=>a.id===id).version})),...patch};}

test('contas e fundos representam o mesmo dinheiro, transferências não viram receitas/despesas',()=>{
 const b=base(),{state,general,reserve,bank}=b,cash=createAccount(state,root,{name:'Caixa de teste',kind:'cash',fundId:general.id,openingOn:'2026-09-01',openingCents:0,reason:'Caixa inicia zerado'},now);
 transfer(state,root,{...entry(b),kind:'fundTransfer',targetFundId:reserve.id,amountCents:2000,date:'2026-09-02'},now);
 transfer(state,root,{...entry(b),kind:'transfer',targetAccountId:cash.id,targetAccountVersion:1,amountCents:3000,date:'2026-09-03'},now);
 createEntry(state,root,entry(b,{amountCents:2500}),now);createEntry(state,root,entry(b,{kind:'expense',accountId:cash.id,accountVersion:state.financialAccounts.find(a=>a.id===cash.id).version,amountCents:1000,date:'2026-09-12'}),now);
 const view=financeView(state,root,now);assert.equal(view.totalCents,11500);assert.equal(view.accounts.reduce((n,a)=>n+a.balanceCents,0),11500);assert.equal(view.funds.reduce((n,a)=>n+a.balanceCents,0),11500);assert.equal(view.accounts.find(a=>a.id===bank.id).balanceCents,9500);assert.equal(view.funds.find(a=>a.id===reserve.id).balanceCents,2000);
 const report=financialReport(state,root,'2026-09').report;assert.equal(report.summary.incomeCents,2500);assert.equal(report.summary.expenseCents,1000);assert.equal(report.summary.transferInCents,5000);assert.equal(report.summary.transferOutCents,5000);assert.equal(report.summary.closingCents,11500);
});
test('centavos, saldo por fundo e saldo histórico são preservados sem arredondamento',()=>{
 const b=base(10001);createEntry(b.state,root,entry(b,{amountCents:1}),now);createEntry(b.state,root,entry(b,{kind:'expense',amountCents:2}),now);assert.equal(balance(b.state,'a'),10000);
 assert.throws(()=>createEntry(b.state,root,entry(b,{kind:'expense',fundId:b.reserve.id,amountCents:1}),now),/Saldo insuficiente/);
 const zero=base(0);createEntry(zero.state,root,entry(zero,{date:'2026-09-10',amountCents:10000}),now);const before=structuredClone(zero.state);assert.throws(()=>createEntry(zero.state,root,entry(zero,{kind:'expense',date:'2026-09-05',amountCents:1000}),now),/data afetada/);assert.deepEqual(zero.state,before);
});
test('versões, idempotência, referências e valores inválidos recusam repetição sem efeitos parciais',()=>{
 const b=base(),input=entry(b);createEntry(b.state,root,input,now);const before=structuredClone(b.state);assert.throws(()=>createEntry(b.state,root,{...input,accountVersion:b.current().version},now),/já registrada/);assert.deepEqual(b.state,before);
 assert.throws(()=>createEntry(b.state,root,entry(b,{reference:input.reference}),now),/Referência já/);assert.throws(()=>createEntry(b.state,root,entry(b,{accountVersion:1}),now),/conta mudou/);
 for(const amountCents of [0,-1,1.1,Infinity,'100',100000001])assert.throws(()=>createEntry(b.state,root,entry(b,{amountCents}),now));
 assert.throws(()=>createEntry(b.state,root,entry(b,{date:'2026-02-30'}),now));assert.throws(()=>createEntry(b.state,root,entry(b,{date:'2026-10-20'}),now));assert.throws(()=>createEntry(b.state,root,entry(b,{date:'2026-08-31'}),now));assert.deepEqual(b.state,before);
});
test('estorno mantém original e refaz saldo; estornar receita gasta é recusado',()=>{
 const b=base(),expense=createEntry(b.state,root,entry(b,{kind:'expense',amountCents:1000}),now);const r=reverseEntry(b.state,root,reversal(b,expense),now);assert.equal(balance(b.state,'a'),10000);assert.equal(b.state.financialEntries[0].postings[0].amountCents,-1000);assert.equal(b.state.financialEntries[0].reversalId,r.id);assert.throws(()=>reverseEntry(b.state,root,reversal(b,expense),now));
 const zero=base(0),income=createEntry(zero.state,root,entry(zero),now);createEntry(zero.state,root,entry(zero,{kind:'expense',date:'2026-09-12'}),now);assert.throws(()=>reverseEntry(zero.state,root,reversal(zero,income),now),/Saldo insuficiente/);
});
test('baixa e estorno de compromisso preservam a situação em cada mês',()=>{
 const b=base(),p=payable(b);const paid=payPayable(b.state,root,pay(b,p),now);assert.equal(paid.payable.status,'paid');assert.equal(financialReport(b.state,root,'2026-09').report.outstanding.length,0);
 reverseEntry(b.state,root,reversal(b,paid.entry,{date:'2026-10-19'}),now);assert.equal(b.state.financialPayables[0].status,'open');assert.equal(financialReport(b.state,root,'2026-09').report.outstanding.length,0);assert.equal(financialReport(b.state,root,'2026-10').report.outstanding.length,1);assert.equal(balance(b.state,'a'),10000);
});
test('cancelar, reabrir e atualizar compromisso não reescreve o retrato de mês anterior',()=>{
 const b=base(),p=payable(b);let edited=editPayable(b.state,root,{id:p.id,version:1,fundId:b.reserve.id,dueOn:'2026-11-01',category:'Nova categoria',reason:'Destinação revista'},now);
 let old=financialReport(b.state,root,'2026-09').report.outstanding[0];assert.equal(old.fundId,b.general.id);assert.equal(old.dueOn,'2026-09-20');
 edited=changePayable(b.state,root,{id:p.id,version:edited.version,status:'cancelled',reason:'Registro conferido'},now);assert.equal(financialReport(b.state,root,'2026-09').report.outstanding.length,1);assert.equal(financialReport(b.state,root,'2026-10').report.outstanding.length,0);assert.equal(financialReport(b.state,root,'2026-10').report.commitments[0].status,'cancelled');assert.equal(financialReport(b.state,root,'2026-10').report.commitments[0].statusReason,'Registro conferido');
 edited=changePayable(b.state,root,{id:p.id,version:edited.version,status:'open',reason:'Compromisso mantido'},now);assert.throws(()=>payPayable(b.state,root,pay(b,edited),now),/última alteração/);
});
test('consulta, operação, controle e exportação são delegações independentes e isoladas por condomínio',()=>{
 const b=base(),viewer={id:'v',tenant:'a',role:'subsindico',delegations:['financeRead']},writer={id:'w',tenant:'a',role:'administradora',delegations:['finance']},controller={id:'c',tenant:'a',role:'administradora',delegations:['financeClose']};
 assert.equal(financeView(b.state,viewer).totalCents,10000);assert.equal(financeView(b.state,{...viewer,tenant:'b'}).totalCents,0);assert.equal(financeView(b.state,{role:'proprietario',tenant:'a'}),null);assert.throws(()=>createEntry(b.state,viewer,entry(b),now));assert.throws(()=>createFund(b.state,writer,{name:'Indevido',purpose:'Sem controle'},now));assert.throws(()=>createEntry(b.state,controller,entry(b),now));
 assert.throws(()=>transfer(b.state,writer,{...entry(b),kind:'fundTransfer',targetFundId:b.reserve.id},now));const adjustment=createEntry(b.state,controller,entry(b,{kind:'adjustment',direction:'credit',amountCents:1}),now);reverseEntry(b.state,controller,reversal(b,adjustment),now);assert.equal(balance(b.state,'a'),10000);
 assert.throws(()=>createEntry(b.state,{...root,tenant:'b'},entry(b),now));
});
test('fechamento bloqueia lançamentos retroativos, preserva snapshot e reabertura mantém versões',()=>{
 const b=base();createEntry(b.state,root,entry(b,{amountCents:1000}),now);const closed=closeMonth(b.state,root,{month:'2026-09',revision:revision(b.state,'a'),reason:'Mês conferido'},now);assert.equal(closed.report.summary.closingCents,11000);
 assert.throws(()=>createEntry(b.state,root,entry(b),now),/Período encerrado/);assert.throws(()=>createAccount(b.state,root,{name:'Outra conta',kind:'cash',fundId:b.general.id,openingOn:'2026-08-01',openingCents:0,reason:'Inserção retroativa'},now),/Período/);
 createEntry(b.state,root,entry(b,{date:'2026-10-19',amountCents:500}),now);assert.equal(financialReport(b.state,root,'2026-09').report.summary.closingCents,11000);
 assert.throws(()=>reopenMonth(b.state,{id:'c',role:'subsindico',tenant:'a',delegations:['financeClose']},{id:closed.id,version:1,revision:revision(b.state,'a'),reason:'Rever'},now),/síndico/);
 reopenMonth(b.state,root,{id:closed.id,version:1,revision:revision(b.state,'a'),reason:'Correção identificada'},now);assert.throws(()=>closeMonth(b.state,root,{month:'2026-10',revision:revision(b.state,'a'),reason:'Pular mês reaberto'},Date.parse('2026-11-10T12:00Z')),/reaberto/);createEntry(b.state,root,entry(b,{amountCents:100}),now);const newer=closeMonth(b.state,root,{month:'2026-09',revision:revision(b.state,'a'),reason:'Mês corrigido'},now);
 assert.equal(newer.report.summary.closingCents,11100);assert.equal(financialClosureReport(b.state,root,closed.id).report.summary.closingCents,11000);assert.equal(b.state.financialClosures.length,2);assert.equal(b.state.financialClosures[0].status,'reopened');
 b.state.financialClosures[1].report.summary.closingCents++;assert.throws(()=>financialReport(b.state,root,'2026-09'),/Integridade/);
});
test('fechamento exige revisão atual, calendário encerrado e sequência mensal',()=>{
 const b=base(),rev=revision(b.state,'a');createEntry(b.state,root,entry(b),now);assert.throws(()=>closeMonth(b.state,root,{month:'2026-09',revision:rev,reason:'Relatório antigo'},now),/mudou/);assert.throws(()=>closeMonth(b.state,root,{month:'2026-10',revision:revision(b.state,'a'),reason:'Ainda em curso'},now),/calendário/);
 const sep=closeMonth(b.state,root,{month:'2026-09',revision:revision(b.state,'a'),reason:'Conferido'},now),dec=Date.parse('2026-12-10T12:00Z');assert.throws(()=>closeMonth(b.state,root,{month:'2026-11',revision:revision(b.state,'a'),reason:'Pular mês'},dec),/sequência/);closeMonth(b.state,root,{month:'2026-10',revision:revision(b.state,'a'),reason:'Outubro conferido'},dec);assert.throws(()=>reopenMonth(b.state,root,{id:sep.id,version:1,revision:revision(b.state,'a'),reason:'Antigo'},dec),/último mês/);
});
test('compra recebida gera obrigação única pelo valor aprovado e impede fechamento com importação pendente',()=>{
 const b=base();b.state.purchases=[{id:'p',tenant:'a',status:'received',version:5,title:'Compra recebida',approval:{quote:{supplierId:'v',supplierName:'Fornecedor',totalCents:3000}},receipt:{at:'2026-09-10T12:00:00-03:00',reference:'NF-TESTE'}}];
 assert.throws(()=>closeMonth(b.state,root,{month:'2026-09',revision:revision(b.state,'a'),reason:'Sem obrigação'},now),/compromissos/);
 const p=importPurchase(b.state,root,{purchaseId:'p',purchaseVersion:5,fundId:b.general.id,issuedOn:'2026-10-19',dueOn:'2026-10-20',category:'Material',amountCents:1},now);assert.equal(p.amountCents,3000);assert.equal(p.issuedOn,'2026-09-10');assert.throws(()=>importPurchase(b.state,root,{purchaseId:'p',purchaseVersion:5,fundId:b.general.id,dueOn:'2026-10-20',category:'Material'},now),/já registrado/);
 const closed=closeMonth(b.state,root,{month:'2026-09',revision:revision(b.state,'a'),reason:'Obrigação conferida'},now);assert.equal(closed.report.outstanding[0].amountCents,3000);assert.equal(closed.report.summary.expenseCents,0);
});
test('arquivar conta ou fundo exige saldo zero e fundo sem compromisso aberto',()=>{
 const b=base();assert.throws(()=>toggleFinancial(b.state,root,{kind:'account',id:b.bank.id,version:b.current().version,active:false,reason:'Ainda possui saldo'},now),/Zere/);const p=payable(b,{fundId:b.reserve.id});assert.throws(()=>toggleFinancial(b.state,root,{kind:'fund',id:b.reserve.id,version:1,active:false,reason:'Possui compromisso'},now),/compromissos/);changePayable(b.state,root,{id:p.id,version:1,status:'cancelled',reason:'Não devido'},now);const archived=toggleFinancial(b.state,root,{kind:'fund',id:b.reserve.id,version:1,active:false,reason:'Sem uso'},now);assert.equal(archived.active,false);
});
